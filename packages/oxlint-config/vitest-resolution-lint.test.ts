import assert from 'node:assert/strict'
import test from 'node:test'

import { lintVitestResolution } from './vitest-resolution-lint.ts'

function lintVitestResolutionForPackage(overrides = {}): string[] {
	return lintVitestResolution({
		hasSourceDirectory: true,
		hasVitestConfig: true,
		manifest: {
			imports: {
				'#/*': {
					source: './src/*.ts',
					types: './dist/*.d.ts',
					test: './src/*.ts',
					node: './dist/*.js',
					default: './dist/*.js',
				},
			},
			scripts: { test: 'vitest run' },
		},
		rootTsconfig: {
			extends: '@patdown/tsconfig/node-library.json',
		},
		vitestConfigText: `export default defineConfig({\n  resolve: {\n    conditions: ['test'],\n  },\n  ssr: { resolve: { conditions: ['test'] } },\n})\n`,
		vitestTsconfig: {
			compilerOptions: {
				customConditions: ['test'],
			},
		},
		...overrides,
	})
}

void test('skips packages without src directories', () => {
	const diagnostics = lintVitestResolutionForPackage({ hasSourceDirectory: false })

	assert.deepEqual(diagnostics, [])
})

void test('skips packages without code imports', () => {
	const diagnostics = lintVitestResolutionForPackage({
		manifest: { scripts: { test: 'vitest run' } },
	})

	assert.deepEqual(diagnostics, [])
})

void test('accepts node-library packages with test-aware resolution wiring', () => {
	assert.deepEqual(lintVitestResolutionForPackage(), [])
})

void test('requires test conditions in package imports', () => {
	const diagnostics = lintVitestResolutionForPackage({
		manifest: {
			imports: {
				'#/*': {
					source: './src/*.ts',
					types: './dist/*.d.ts',
					default: './dist/*.js',
				},
			},
			scripts: { test: 'vitest run' },
		},
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /must include a "test" condition/u)
})

void test('requires Vitest resolve conditions', () => {
	const diagnostics = lintVitestResolutionForPackage({
		vitestConfigText: `export default defineConfig({\n  test: {}\n})\n`,
	})

	assert.equal(diagnostics.length, 2)
	assert.match(diagnostics[0], /resolve\.conditions to \["test"]/)
})

void test('requires Vitest SSR resolve conditions', () => {
	const diagnostics = lintVitestResolutionForPackage({
		vitestConfigText: `export default defineConfig({\n  resolve: { conditions: ['test'] },\n})\n`,
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /ssr\.resolve\.conditions/u)
})

void test('does not treat the nested SSR resolver as the normal resolver', () => {
	const diagnostics = lintVitestResolutionForPackage({
		vitestConfigText: `export default defineConfig({\n  ssr: { resolve: { conditions: ['test'] } },\n})\n`,
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /resolve\.conditions/u)
})

void test('requires customConditions for node-library packages', () => {
	const diagnostics = lintVitestResolutionForPackage({
		vitestTsconfig: { compilerOptions: {} },
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /customConditions must include "test"/u)
})

void test('app-shaped packages do not require customConditions', () => {
	const diagnostics = lintVitestResolutionForPackage({
		rootTsconfig: {
			extends: '@patdown/tsconfig/base.json',
		},
		vitestTsconfig: {
			compilerOptions: {},
		},
	})

	assert.deepEqual(diagnostics, [])
})
