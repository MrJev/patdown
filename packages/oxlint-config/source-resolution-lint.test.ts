import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { Schema } from 'effect'

import type { PackageManifest } from './manifest-lint.ts'
import { lintSourceResolution } from './source-resolution-lint.ts'

const sourceImportsManifest: PackageManifest = {
	imports: {
		'#src/*': {
			source: './src/*.ts',
			default: './dist/*.js',
			types: './dist/*.d.ts',
		},
	},
}

function withPackageFixture(
	configs: Readonly<Record<string, Schema.Json>>,
	run: (packageDirectory: string) => void,
): void {
	const packageDirectory = mkdtempSync(path.join(os.tmpdir(), 'source-resolution-lint-'))

	try {
		mkdirSync(path.join(packageDirectory, 'src'))

		for (const [fileName, config] of Object.entries(configs)) {
			writeFileSync(path.join(packageDirectory, fileName), JSON.stringify(config))
		}

		run(packageDirectory)
	} finally {
		rmSync(packageDirectory, { force: true, recursive: true })
	}
}

void test('rejects validation configs that resolve package self-imports through dist', () => {
	withPackageFixture(
		{
			'tsconfig.app.json': { compilerOptions: { noEmit: true }, include: ['src/**/*.ts'] },
			'tsconfig.json': { files: [], references: [{ path: './tsconfig.app.json' }] },
		},
		(packageDirectory) => {
			assert.deepEqual(
				lintSourceResolution({
					hasSourceDirectory: true,
					manifest: sourceImportsManifest,
					packageDirectory,
				}),
				[
					'tsconfig.app.json compilerOptions.customConditions must effectively include "source" so package self-imports resolve source without requiring prebuilt dist output.',
				],
			)
		},
	)
})

void test('accepts direct and locally inherited source conditions while skipping solutions', () => {
	withPackageFixture(
		{
			'tsconfig.app.json': {
				compilerOptions: { customConditions: ['source'], noEmit: true },
				include: ['src/**/*.ts'],
			},
			'tsconfig.lint.json': { extends: './tsconfig.app.json' },
			'tsconfig.json': { files: [], references: [{ path: './tsconfig.app.json' }] },
		},
		(packageDirectory) => {
			assert.deepEqual(
				lintSourceResolution({
					hasSourceDirectory: true,
					manifest: sourceImportsManifest,
					packageDirectory,
				}),
				[],
			)
		},
	)
})

void test('ignores packages whose import maps contain only source assets', () => {
	withPackageFixture(
		{ 'tsconfig.json': { compilerOptions: { noEmit: true }, include: ['src/**/*.ts'] } },
		(packageDirectory) => {
			assert.deepEqual(
				lintSourceResolution({
					hasSourceDirectory: true,
					manifest: {
						imports: { '#src/styles/*': { source: './src/styles/*.css' } },
					},
					packageDirectory,
				}),
				[],
			)
		},
	)
})
