import assert from 'node:assert/strict'
import test from 'node:test'

import { type TsconfigSplitInputs, lintVitestTsconfigSplit } from './tsconfig-split-lint.ts'

function lintVitestPackage(overrides: Partial<TsconfigSplitInputs> = {}): string[] {
	return lintVitestTsconfigSplit({
		hasSourceDirectory: true,
		hasVitestConfig: true,
		manifest: { scripts: { test: 'vitest run' } },
		rootTsconfig: {
			files: [],
			references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.vitest.json' }],
		},
		appTsconfig: {
			compilerOptions: {
				noEmit: true,
				rootDir: './src',
			},
			include: ['src/**/*.ts'],
		},
		vitestTsconfig: {
			compilerOptions: {
				noEmit: true,
				rootDir: '.',
			},
			include: ['tests/**/*.test.ts', 'vitest.config.ts'],
		},
		...overrides,
	})
}

void test('skips packages without src directories', () => {
	const diagnostics = lintVitestTsconfigSplit({
		hasSourceDirectory: false,
		hasVitestConfig: true,
		manifest: { scripts: { test: 'vitest run' } },
		rootTsconfig: undefined,
		appTsconfig: undefined,
		vitestTsconfig: undefined,
	})

	assert.deepEqual(diagnostics, [])
})

void test('skips packages that do not use vitest', () => {
	const diagnostics = lintVitestTsconfigSplit({
		hasSourceDirectory: true,
		hasVitestConfig: false,
		manifest: { scripts: { test: 'node --test' } },
		rootTsconfig: undefined,
		appTsconfig: undefined,
		vitestTsconfig: undefined,
	})

	assert.deepEqual(diagnostics, [])
})

void test('accepts the split tsconfig pattern', () => {
	assert.deepEqual(lintVitestPackage(), [])
})

void test('requires root solution references', () => {
	const diagnostics = lintVitestPackage({ rootTsconfig: { files: [] } })

	assert.equal(diagnostics.length, 2)
	assert.match(diagnostics[0], /must reference \.\/tsconfig\.app\.json/u)
	assert.match(diagnostics[1], /must reference \.\/tsconfig\.vitest\.json/u)
})

void test('requires tsconfig.json files to stay empty', () => {
	const diagnostics = lintVitestPackage({
		rootTsconfig: { files: ['src/index.ts'], references: [] },
	})

	assert.match(diagnostics[0], /must use "files": \[\]/u)
})

void test('requires tsconfig.app.json', () => {
	const diagnostics = lintVitestPackage({ appTsconfig: undefined })

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /must define tsconfig\.app\.json/u)
})

void test('requires tsconfig.vitest.json', () => {
	const diagnostics = lintVitestPackage({ vitestTsconfig: undefined })

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /must define tsconfig\.vitest\.json/u)
})

void test('validates tsconfig.app.json role', () => {
	const diagnostics = lintVitestPackage({
		appTsconfig: {
			compilerOptions: { noEmit: false, rootDir: '.' },
			include: ['tests/**/*.test.ts'],
		},
	})

	assert.equal(diagnostics.length, 3)
	assert.match(diagnostics[0], /noEmit must be true/u)
	assert.match(diagnostics[1], /rootDir must be "\.\/src"/u)
	assert.match(diagnostics[2], /include entries must stay under src\//u)
})

void test('validates tsconfig.vitest.json role', () => {
	const diagnostics = lintVitestPackage({
		vitestTsconfig: {
			compilerOptions: { noEmit: false, rootDir: './src' },
			include: ['tests/**/*.test.ts'],
		},
	})

	assert.equal(diagnostics.length, 3)
	assert.match(diagnostics[0], /noEmit must be true/u)
	assert.match(diagnostics[1], /rootDir must be "\."/u)
	assert.match(diagnostics[2], /must include vitest\.config\.ts/u)
})

void test('requires at least one test include beyond vitest config', () => {
	const diagnostics = lintVitestPackage({
		vitestTsconfig: {
			compilerOptions: { noEmit: true, rootDir: '.' },
			include: ['vitest.config.ts'],
		},
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /must include at least one test file glob/u)
})
