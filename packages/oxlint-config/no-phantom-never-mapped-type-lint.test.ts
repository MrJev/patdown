import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const packageDirectory = path.dirname(fileURLToPath(import.meta.url))

const oxlintFileUrl = pathToFileURL(
	path.join(packageDirectory, 'node_modules/oxlint/dist/index.js'),
).href

const oxlintBinaryPath = path.join(packageDirectory, 'node_modules/.bin/oxlint')

const pluginSpecifier = path.join(packageDirectory, 'manifest-plugin.ts')

const ruleOnlyConfig = [
	`import { defineConfig } from ${JSON.stringify(oxlintFileUrl)}`,
	'',
	'export default defineConfig({',
	`  jsPlugins: [{ name: 'squint-contracts', specifier: ${JSON.stringify(pluginSpecifier)} }],`,
	'  rules: {',
	"    'squint-contracts/no-phantom-never-mapped-type': 'error',",
	'  },',
	'})',
	'',
].join('\n')

function withFixture<T>(sourceText: string, run: (fixtureDirectory: string) => T): T {
	const fixtureDirectory = mkdtempSync(path.join(os.tmpdir(), 'oxlint-phantom-never-'))

	try {
		writeFileSync(path.join(fixtureDirectory, 'fixture.ts'), sourceText)
		writeFileSync(path.join(fixtureDirectory, 'oxlint.config.ts'), ruleOnlyConfig)

		return run(fixtureDirectory)
	} finally {
		rmSync(fixtureDirectory, { force: true, recursive: true })
	}
}

function runFixtureLint(fixtureDirectory: string): string {
	return execFileSync(
		oxlintBinaryPath,
		['-c', path.join(fixtureDirectory, 'oxlint.config.ts'), '.'],
		{
			cwd: fixtureDirectory,
			encoding: 'utf8',
			stdio: 'pipe',
		},
	)
}

void test('rejects mapped types over never', () => {
	withFixture(
		[
			'type AssignedTarget<T, V> = T & { readonly [K in never]: V }',
			'export type Keep = AssignedTarget<{ a: 1 }, string>',
		].join('\n'),
		(fixtureDirectory) => {
			assert.throws(
				() => runFixtureLint(fixtureDirectory),
				(cause: unknown) => {
					assert(cause instanceof Error)

					// SAFETY: node:test assert.throws exposes execFileSync failures as Error plus status/stdio fields.
					const errorWithOutput = cause as Error & {
						status?: number
						stdout?: string
						stderr?: string
					}

					assert.equal(errorWithOutput.status, 1)
					assert.match(
						`${errorWithOutput.stdout ?? ''}${errorWithOutput.stderr ?? ''}`,
						/phantom mapped types over `never`/u,
					)

					return true
				},
			)
		},
	)
})

void test('allows mapped types over keyof T', () => {
	withFixture(
		[
			'type PickKnown<T, K extends keyof T> = { readonly [P in K]: T[P] }',
			'export type Keep = PickKnown<{ a: 1 }, "a">',
		].join('\n'),
		(fixtureDirectory) => {
			assert.doesNotThrow(() => runFixtureLint(fixtureDirectory))
		},
	)
})
