import assert from 'node:assert/strict'
import test from 'node:test'

import { lintArtifactEntrypoints } from './artifact-entrypoint-lint.ts'

function lintArtifactPackage(overrides = {}): string[] {
	return lintArtifactEntrypoints({
		hasSourceDirectory: true,
		manifest: {
			exports: {
				'.': {
					default: './dist/index.js',
					types: './dist/index.d.ts',
				},
			},
			files: ['dist', 'src'],
			main: './dist/index.js',
			name: '@patdown/example',
			scripts: { build: 'tsc -p tsconfig.build.json' },
			type: 'module',
			types: './dist/index.d.ts',
		},
		packageDirectory: '/repo/packages/example',
		...overrides,
	})
}

void test('skips non-buildable packages', () => {
	const diagnostics = lintArtifactEntrypoints({
		hasSourceDirectory: false,
		manifest: { name: '@patdown/example', scripts: {} },
		packageDirectory: '/repo/packages/example',
	})

	assert.deepEqual(diagnostics, [])
})

void test('accepts aligned buildable package entrypoints', () => {
	assert.deepEqual(lintArtifactPackage(), [])
})

void test('requires main and types for buildable runtime packages', () => {
	const diagnostics = lintArtifactPackage({
		manifest: {
			exports: {
				'.': {
					default: './dist/index.js',
					types: './dist/index.d.ts',
				},
			},
			files: ['dist'],
			name: '@patdown/example',
			scripts: { build: 'tsc -p tsconfig.build.json' },
		},
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /must define "main" and "types"/u)
})

void test('requires main and types to stay under dist', () => {
	const diagnostics = lintArtifactPackage({
		manifest: {
			exports: {
				'.': {
					default: './src/index.ts',
					types: './src/index.ts',
				},
			},
			files: ['dist'],
			main: './src/index.ts',
			name: '@patdown/example',
			scripts: { build: 'tsc -p tsconfig.build.json' },
			types: './src/index.ts',
		},
	})

	assert.equal(diagnostics.length, 2)
	assert.match(diagnostics[0], /"main" must point under/u)
	assert.match(diagnostics[1], /"types" must point under/u)
})

void test('requires root export alignment with main and types', () => {
	const diagnostics = lintArtifactPackage({
		manifest: {
			exports: {
				'.': {
					default: './dist/other.js',
					types: './dist/other.d.ts',
				},
			},
			files: ['dist'],
			main: './dist/index.js',
			name: '@patdown/example',
			scripts: { build: 'tsc -p tsconfig.build.json' },
			types: './dist/index.d.ts',
		},
	})

	assert.equal(diagnostics.length, 2)
	assert.match(diagnostics[0], /default must match package\.json "main"/u)
	assert.match(diagnostics[1], /types must match package\.json "types"/u)
})

void test('accepts private Expo Router apps with dist package exports', () => {
	const diagnostics = lintArtifactPackage({
		manifest: {
			dependencies: {
				'expo-router': 'catalog:expo',
			},
			exports: {
				'.': {
					default: './dist/index.js',
					types: './dist/index.d.ts',
				},
			},
			main: 'expo-router/entry',
			name: '@patdown/example-mobile',
			private: true,
			scripts: { build: 'expo export --platform android' },
			types: './dist/index.d.ts',
		},
		packageDirectory: '/repo/apps/example-mobile',
	})

	assert.deepEqual(diagnostics, [])
})

void test('accepts private Expo Router apps with a custom source entrypoint', () => {
	const diagnostics = lintArtifactPackage({
		manifest: {
			dependencies: {
				'expo-router': 'catalog:expo',
			},
			exports: {
				'.': {
					default: './dist/index.js',
					types: './dist/index.d.ts',
				},
			},
			main: './index.ts',
			name: '@patdown/example-mobile',
			private: true,
			scripts: { build: 'expo export --platform android' },
			types: './dist/index.d.ts',
		},
		packageDirectory: '/repo/apps/example-mobile',
	})

	assert.deepEqual(diagnostics, [])
})

void test('requires bin entries under dist', () => {
	const diagnostics = lintArtifactPackage({
		manifest: {
			bin: {
				example: './src/index.ts',
			},
			exports: {
				'.': {
					default: './dist/index.js',
					types: './dist/index.d.ts',
				},
			},
			files: ['dist'],
			main: './dist/index.js',
			name: '@patdown/example',
			scripts: { build: 'tsc -p tsconfig.build.json' },
			types: './dist/index.d.ts',
		},
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /bin "example" must point under/u)
})

void test('requires dist in files for libraries and cli packages', () => {
	const diagnostics = lintArtifactPackage({
		manifest: {
			exports: {
				'.': {
					default: './dist/index.js',
					types: './dist/index.d.ts',
				},
			},
			files: ['src'],
			main: './dist/index.js',
			name: '@patdown/example',
			scripts: { build: 'tsc -p tsconfig.build.json' },
			types: './dist/index.d.ts',
		},
	})

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /must include "dist" in package\.json "files"/u)
})

void test('hosted apps are not forced to declare files', () => {
	const diagnostics = lintArtifactPackage({
		manifest: {
			exports: {
				'.': {
					default: './dist/index.js',
					types: './dist/index.d.ts',
				},
			},
			main: './dist/index.js',
			name: '@patdown/example-app',
			scripts: { build: 'vite build' },
			types: './dist/index.d.ts',
		},
		packageDirectory: '/repo/apps/example-app',
	})

	assert.deepEqual(diagnostics, [])
})

void test('config-package exemptions skip artifact contract', () => {
	const diagnostics = lintArtifactPackage({
		manifest: {
			patdown: { packageKind: 'config-package' },
			name: '@patdown/config',
			scripts: { build: 'tsc -p tsconfig.build.json' },
		},
	})

	assert.deepEqual(diagnostics, [])
})
