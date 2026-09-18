import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const packageDirectory = path.dirname(fileURLToPath(import.meta.url))

const baseConfigFileUrl = pathToFileURL(path.join(packageDirectory, 'base.ts')).href

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
	"    'squint-contracts/no-record-string-unknown': 'error',",
	'  },',
	'})',
	'',
].join('\n')

const baseConfig = [
	`import { defineConfig } from ${JSON.stringify(oxlintFileUrl)}`,
	`import { baseConfig } from ${JSON.stringify(baseConfigFileUrl)}`,
	'',
	'export default defineConfig({',
	'  ...baseConfig,',
	'})',
	'',
].join('\n')

function withFixture<T>(
	sourceText: string,
	run: (fixtureDirectory: string) => T,
	configText = ruleOnlyConfig,
): T {
	const fixtureDirectory = mkdtempSync(path.join(os.tmpdir(), 'oxlint-record-string-unknown-'))

	try {
		writeFileSync(path.join(fixtureDirectory, 'fixture.ts'), sourceText)
		writeFileSync(path.join(fixtureDirectory, 'oxlint.config.ts'), configText)

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

function assertFixtureLintFails(
	sourceText: string,
	expectedPattern: RegExp,
	configText = ruleOnlyConfig,
): void {
	withFixture(
		sourceText,
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
						expectedPattern,
					)

					return true
				},
			)
		},
		configText,
	)
}

void test('allows narrower records, index signatures, and maps', () => {
	withFixture(
		[
			'type StringMap = Record<string, string>',
			"type LiteralMap = Record<'key', unknown>",
			'type ExplicitMap = { [key: string]: unknown }',
			'type UnknownMap = Map<string, unknown>',
		].join('\n'),
		(fixtureDirectory) => {
			assert.doesNotThrow(() => runFixtureLint(fixtureDirectory))
		},
	)
})

void test('allows exact boundary alias RHS only (with transparent wrappers)', () => {
	withFixture(
		[
			'type TaskListRouteSearchInput = Readonly<Record<string, unknown>>',
			'type SqlRow = Record<string, unknown>',
			'type JwtClaims = (Record<string, unknown>)',
			'type VendorPayload = Readonly<(Record<string, unknown>)>',
			'type WireEncoded = Readonly<Record<string, unknown>>',
			'type ExpoExtra = Record<string, unknown>',
			'type CookieBag = Record<string, unknown>',
			'export type Keep = TaskListRouteSearchInput | SqlRow | JwtClaims | VendorPayload',
		].join('\n'),
		(fixtureDirectory) => {
			assert.doesNotThrow(() => runFixtureLint(fixtureDirectory))
		},
	)
})

void test('rejects nested bags inside *Input aliases (suffix is not enough)', () => {
	assertFixtureLintFails(
		[
			'type CustomerInput = { domainState: Record<string, unknown> }',
			'export type Keep = CustomerInput',
		].join('\n'),
		/Avoid anonymous `Record<string, unknown>`/u,
	)
})

void test('rejects nested Readonly bags inside boundary-named object aliases', () => {
	assertFixtureLintFails(
		[
			'type OrderPayload = { meta: Readonly<Record<string, unknown>> }',
			'export type Keep = OrderPayload',
		].join('\n'),
		/Avoid anonymous `Record<string, unknown>`/u,
	)
})

void test('rejects Record nested under another Record even on boundary-named aliases', () => {
	assertFixtureLintFails(
		[
			'type NestedInput = Record<string, Record<string, unknown>>',
			'export type Keep = NestedInput',
		].join('\n'),
		/Avoid anonymous `Record<string, unknown>`/u,
	)
})

void test('rejects anonymous broad records in domain positions', () => {
	assertFixtureLintFails(
		[
			'type UnknownMap = Record<string, unknown>',
			'const value: UnknownMap = {}',
			'function take(input: Record<string, unknown>): void {}',
		].join('\n'),
		/Avoid anonymous `Record<string, unknown>`/u,
	)
})

void test('rejects nested domain bags even under Readonly', () => {
	assertFixtureLintFails(
		[
			'type NestedMap = Record<string, Record<string, unknown>>',
			'type Task = { meta: Readonly<Record<string, unknown>> }',
			'export type Keep = NestedMap | Task',
		].join('\n'),
		/Avoid anonymous `Record<string, unknown>`/u,
	)
})

void test('base config enables the rule as error globally', () => {
	assertFixtureLintFails(
		['type UnknownMap = Record<string, unknown>', 'export type Keep = UnknownMap'].join('\n'),
		/no-record-string-unknown/u,
		baseConfig,
	)
})
