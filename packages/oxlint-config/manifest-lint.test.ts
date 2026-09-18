import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { lintPackageManifest, type PackageManifest } from './manifest-lint.ts'

const packageDirectory = path.dirname(fileURLToPath(import.meta.url))

const baseConfigFileUrl = pathToFileURL(path.join(packageDirectory, 'base.ts')).href

const oxlintFileUrl = pathToFileURL(
	path.join(packageDirectory, 'node_modules/oxlint/dist/index.js'),
).href

const oxlintBinaryPath = path.join(packageDirectory, 'node_modules/.bin/oxlint')

function lintManifest(manifest: PackageManifest): string[] {
	return lintPackageManifest({
		hasSourceDirectory: true,
		manifest,
	})
}

function withFixtureWorkspace<T>(
	manifest: PackageManifest,
	run: (fixtureDirectory: string) => T,
): T {
	const fixtureDirectory = mkdtempSync(path.join(os.tmpdir(), 'oxlint-manifest-fixture-'))

	try {
		mkdirSync(path.join(fixtureDirectory, 'src'))
		writeFileSync(
			path.join(fixtureDirectory, 'package.json'),
			`${JSON.stringify(manifest, null, 2)}\n`,
		)
		writeFileSync(path.join(fixtureDirectory, 'src/index.ts'), 'export const fixture = true\n')
		writeFileSync(
			path.join(fixtureDirectory, 'oxlint.config.ts'),
			[
				`import { defineConfig } from ${JSON.stringify(oxlintFileUrl)}`,
				'',
				`import { baseConfig } from ${JSON.stringify(baseConfigFileUrl)}`,
				'',
				'export default defineConfig({',
				'  ...baseConfig,',
				'})',
				'',
			].join('\n'),
		)

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

function assertFixtureLintFails(fixtureDirectory: string): void {
	assert.throws(
		() => {
			runFixtureLint(fixtureDirectory)
		},
		(cause: unknown) => {
			assert(cause instanceof Error)

			// SAFETY: node:test assert.throws exposes execFileSync failures as Error plus status/stdio fields.
			const errorWithOutput = cause as Error & {
				status?: number
			}

			assert.equal(errorWithOutput.status, 1)

			return true
		},
	)
}

void test('skips packages without src directories', () => {
	const diagnostics = lintPackageManifest({
		hasSourceDirectory: false,
		manifest: { name: '@patdown/config' },
	})

	assert.deepEqual(diagnostics, [])
})

void test('requires an imports map for runtime packages', () => {
	const diagnostics = lintManifest({
		name: '@patdown/example',
		exports: {
			'.': {
				default: './dist/index.js',
				types: './dist/index.d.ts',
			},
		},
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /must define an imports map/u)
})

void test('requires a catch-all #/* entry', () => {
	const diagnostics = lintManifest({
		name: '@patdown/example',
		exports: {
			'.': {
				default: './dist/index.js',
				types: './dist/index.d.ts',
			},
		},
		imports: {
			'#/feature': {
				source: './src/feature.ts',
				test: './src/feature.ts',
				types: './dist/feature.d.ts',
				default: './dist/feature.js',
			},
		},
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /must include "#\/\*"/u)
})

void test('allows condition-based code entries', () => {
	const diagnostics = lintManifest({
		name: '@patdown/example',
		exports: {
			'.': {
				default: './dist/index.js',
				types: './dist/index.d.ts',
			},
			'./styles.css': './dist/styles.css',
		},
		imports: {
			'#/*': {
				source: './src/*.ts',
				test: './src/*.ts',
				types: './dist/*.d.ts',
				default: './dist/*.js',
			},
			'#/feature': {
				source: './src/feature.ts',
				test: './src/feature.ts',
				types: './dist/feature.d.ts',
				node: './dist/feature.js',
				default: './dist/feature.js',
			},
		},
	})

	assert.deepEqual(diagnostics, [])
})

void test('rejects code entries without source conditions', () => {
	const diagnostics = lintManifest({
		name: '@patdown/example',
		exports: {
			'.': {
				default: './dist/index.js',
				types: './dist/index.d.ts',
			},
		},
		imports: {
			'#/*': {
				test: './src/*.ts',
				types: './dist/*.d.ts',
				default: './dist/*.js',
			},
		},
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /must include "source"/u)
})

void test('allows source-only asset entries', () => {
	const diagnostics = lintManifest({
		name: '@patdown/example',
		exports: {
			'.': {
				default: './dist/index.js',
				types: './dist/index.d.ts',
			},
		},
		imports: {
			'#/*': {
				source: './src/*.ts',
				test: './src/*.ts',
				types: './dist/*.d.ts',
				default: './dist/*.js',
			},
			'#/styles/*': { source: './src/styles/*' },
		},
	})

	assert.deepEqual(diagnostics, [])
})

void test('allows condition-based asset entries', () => {
	const diagnostics = lintManifest({
		name: '@patdown/example',
		exports: {
			'.': {
				default: './dist/index.js',
				types: './dist/index.d.ts',
			},
		},
		imports: {
			'#/*': {
				source: './src/*.ts',
				test: './src/*.ts',
				types: './dist/*.d.ts',
				default: './dist/*.js',
			},
			'#/page.css': {
				source: './src/page.css',
				types: './dist/page.css.d.ts',
				test: './src/page.css',
				default: './dist/page.css',
			},
			'#/styles/*': { source: './src/styles/*', test: './src/styles/*' },
		},
	})

	assert.deepEqual(diagnostics, [])
})

void test('rejects asset types outside dist', () => {
	const diagnostics = lintManifest({
		name: '@patdown/example',
		exports: {
			'.': {
				default: './dist/index.js',
				types: './dist/index.d.ts',
			},
		},
		imports: {
			'#/*': {
				source: './src/*.ts',
				test: './src/*.ts',
				types: './dist/*.d.ts',
				default: './dist/*.js',
			},
			'#/page.css': {
				source: './src/page.css',
				types: './src/page.css',
				test: './src/page.css',
				default: './dist/page.css',
			},
		},
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /imports\["#\/page\.css"\]\.types must point under "\.\/dist\/"/u)
})

void test('allows explicit CSS source exports', () => {
	const diagnostics = lintManifest({
		name: '@patdown/example',
		exports: {
			'.': {
				default: './dist/index.js',
				types: './dist/index.d.ts',
			},
			'./styles.css': './dist/styles.css',
			'./styles.source.css': './src/styles.css',
		},
		imports: {
			'#/*': {
				source: './src/*.ts',
				test: './src/*.ts',
				types: './dist/*.d.ts',
				default: './dist/*.js',
			},
		},
	})

	assert.deepEqual(diagnostics, [])
})

void test('rejects non-source CSS source exports', () => {
	const diagnostics = lintManifest({
		name: '@patdown/example',
		exports: {
			'.': {
				default: './dist/index.js',
				types: './dist/index.d.ts',
			},
			'./styles.source.css': './dist/styles.css',
		},
		imports: {
			'#/*': {
				source: './src/*.ts',
				test: './src/*.ts',
				types: './dist/*.d.ts',
				default: './dist/*.js',
			},
		},
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /must point under "\.\/src\/"/u)
})

void test('rejects code entries that only provide source', () => {
	const diagnostics = lintManifest({
		name: '@patdown/example',
		exports: {
			'.': {
				default: './dist/index.js',
				types: './dist/index.d.ts',
			},
		},
		imports: {
			'#/*': { source: './src/*.ts' },
		},
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /must include "source", "test", "types", and "default"/u)
})

void test('rejects non-object imports targets', () => {
	const diagnostics = lintManifest({
		name: '@patdown/example',
		exports: {
			'.': {
				default: './dist/index.js',
				types: './dist/index.d.ts',
			},
		},
		imports: {
			'#/*': './src/*.ts',
		},
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /must be a condition object/u)
})

void test('rejects wrong path families', () => {
	const diagnostics = lintManifest({
		name: '@patdown/example',
		exports: {
			'.': {
				default: './dist/index.js',
				types: './dist/index.d.ts',
			},
		},
		imports: {
			'#/*': {
				source: './dist/*.ts',
				test: './dist/*.ts',
				types: './src/*.d.ts',
				node: './src/*.js',
				default: './src/*.js',
			},
		},
	})

	assert.equal(diagnostics.length, 5)
	assert.match(diagnostics[0], /must point under "\.\/src\/"/u)
	assert.match(diagnostics[1], /must point under "\.\/src\/"/u)
	assert.match(diagnostics[2], /must point under "\.\/dist\/"/u)
	assert.match(diagnostics[3], /must point under "\.\/dist\/"/u)
	assert.match(diagnostics[4], /must point under "\.\/dist\/"/u)
})

void test('requires an exports map for runtime packages', () => {
	const diagnostics = lintManifest({
		name: '@patdown/example',
		imports: {
			'#/*': {
				source: './src/*.ts',
				test: './src/*.ts',
				types: './dist/*.d.ts',
				default: './dist/*.js',
			},
		},
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /must define an exports map/u)
})

void test('requires a root exports entry', () => {
	const diagnostics = lintManifest({
		name: '@patdown/example',
		exports: {
			'./feature': {
				default: './dist/feature.js',
				types: './dist/feature.d.ts',
			},
		},
		imports: {
			'#/*': {
				source: './src/*.ts',
				test: './src/*.ts',
				types: './dist/*.d.ts',
				node: './dist/*.js',
				default: './dist/*.js',
			},
		},
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /must include "\."/u)
})

void test('requires condition objects for code exports', () => {
	const diagnostics = lintManifest({
		name: '@patdown/example',
		exports: {
			'.': './dist/index.js',
		},
		imports: {
			'#/*': {
				source: './src/*.ts',
				test: './src/*.ts',
				types: './dist/*.d.ts',
				node: './dist/*.js',
				default: './dist/*.js',
			},
		},
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /must be a condition object for code entries/u)
})

void test('requires types and default for code exports', () => {
	const diagnostics = lintManifest({
		name: '@patdown/example',
		exports: {
			'.': {
				types: './dist/index.d.ts',
			},
		},
		imports: {
			'#/*': {
				source: './src/*.ts',
				test: './src/*.ts',
				types: './dist/*.d.ts',
				node: './dist/*.js',
				default: './dist/*.js',
			},
		},
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /Public code exports must include "types" and "default"/u)
})

void test('requires built dist paths for all export conditions', () => {
	const diagnostics = lintManifest({
		name: '@patdown/example',
		exports: {
			'.': {
				default: './src/index.ts',
				types: './src/index.ts',
			},
		},
		imports: {
			'#/*': {
				source: './src/*.ts',
				test: './src/*.ts',
				types: './dist/*.d.ts',
				node: './dist/*.js',
				default: './dist/*.js',
			},
		},
	})

	assert.equal(diagnostics.length, 2)
	assert(
		diagnostics.some((diagnostic) =>
			/package\.json exports\["\."\]\.types must point under/u.test(diagnostic),
		),
	)
	assert(
		diagnostics.some((diagnostic) =>
			/package\.json exports\["\."\]\.default must point under/u.test(diagnostic),
		),
	)
})

void test('oxlint executes the plugin for a conforming fixture', () => {
	withFixtureWorkspace(
		{
			name: '@patdown/manifest-pass-fixture',
			private: true,
			imports: {
				'#/*': {
					source: './src/*.ts',
					test: './src/*.ts',
					types: './dist/*.d.ts',
					node: './dist/*.js',
					default: './dist/*.js',
				},
			},
			exports: {
				'.': {
					default: './dist/index.js',
					types: './dist/index.d.ts',
				},
			},
			type: 'module',
		},
		(fixtureDirectory) => {
			runFixtureLint(fixtureDirectory)
		},
	)
})

void test('oxlint executes the plugin for a failing fixture', () => {
	withFixtureWorkspace(
		{
			name: '@patdown/manifest-fail-fixture',
			private: true,
			type: 'module',
		},
		(fixtureDirectory) => {
			assertFixtureLintFails(fixtureDirectory)
		},
	)
})
