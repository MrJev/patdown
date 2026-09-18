import { existsSync, readFileSync } from 'node:fs'

import * as ts from '@typescript/typescript6'

import {
	decodeStringList,
	decodeTsconfigHostValue,
	isJsonValue,
	type PackageManifest,
	type TsconfigFile,
} from './json-decode.ts'

export type { PackageManifest, TsconfigFile }

export interface TsconfigSplitInputs {
	appTsconfig: TsconfigFile | undefined
	hasSourceDirectory: boolean
	hasVitestConfig: boolean
	manifest: PackageManifest
	rootTsconfig: TsconfigFile | undefined
	vitestTsconfig: TsconfigFile | undefined
}

function usesVitest(manifest: PackageManifest, hasVitestConfig: boolean): boolean {
	if (hasVitestConfig) {
		return true
	}

	return Object.values(manifest.scripts ?? {}).some((scriptCommand) =>
		scriptCommand.includes('vitest'),
	)
}

function hasReference(tsconfig: TsconfigFile | undefined, referencePath: string): boolean {
	return (tsconfig?.references ?? []).some((reference) => reference.path === referencePath)
}

function lintAppTsconfig(appTsconfig: TsconfigFile | undefined): string[] {
	if (appTsconfig === undefined) {
		return [
			'Vitest packages with src/ must define tsconfig.app.json so app/runtime source has its own non-test type graph.',
		]
	}

	const compilerOptions = appTsconfig.compilerOptions ?? {}
	const diagnostics = []

	if (compilerOptions.noEmit !== true) {
		diagnostics.push('tsconfig.app.json compilerOptions.noEmit must be true.')
	}

	if (compilerOptions.rootDir !== './src') {
		diagnostics.push('tsconfig.app.json compilerOptions.rootDir must be "./src".')
	}

	const include = decodeStringList(appTsconfig.include)

	if (include === null || include.length === 0) {
		diagnostics.push('tsconfig.app.json must include src files only.')
	} else if (!include.every((entry) => entry === 'src' || entry.startsWith('src/'))) {
		diagnostics.push('tsconfig.app.json include entries must stay under src/.')
	}

	return diagnostics
}

function createVitestIncludeDiagnostics(include: string[] | null): string[] {
	if (include === null || include.length === 0) {
		return ['tsconfig.vitest.json must include Vitest-managed files.']
	}

	const diagnostics = []

	if (!include.includes('vitest.config.ts')) {
		diagnostics.push('tsconfig.vitest.json must include vitest.config.ts.')
	}

	if (!include.some((entry) => entry !== 'vitest.config.ts')) {
		diagnostics.push(
			'tsconfig.vitest.json must include at least one test file glob in addition to vitest.config.ts.',
		)
	}

	return diagnostics
}

function lintVitestTsconfig(vitestTsconfig: TsconfigFile | undefined): string[] {
	if (vitestTsconfig === undefined) {
		return [
			'Vitest packages with src/ must define tsconfig.vitest.json so tests and Vitest config use a separate test-focused type graph.',
		]
	}

	const compilerOptions = vitestTsconfig.compilerOptions ?? {}
	const diagnostics = []

	if (compilerOptions.noEmit !== true) {
		diagnostics.push('tsconfig.vitest.json compilerOptions.noEmit must be true.')
	}

	if (compilerOptions.rootDir !== '.') {
		diagnostics.push('tsconfig.vitest.json compilerOptions.rootDir must be ".".')
	}

	return [
		...diagnostics,
		...createVitestIncludeDiagnostics(decodeStringList(vitestTsconfig.include)),
	]
}

function lintRootTsconfig(rootTsconfig: TsconfigFile | undefined): string[] {
	if (rootTsconfig === undefined) {
		return [
			'Vitest packages with src/ must keep tsconfig.json as the solution config that references tsconfig.app.json and tsconfig.vitest.json.',
		]
	}

	const diagnostics = []
	const files = decodeStringList(rootTsconfig.files)

	if (files === null || files.length > 0) {
		diagnostics.push(
			'tsconfig.json must use "files": [] so the root config stays a solution-style project.',
		)
	}

	if (!hasReference(rootTsconfig, './tsconfig.app.json')) {
		diagnostics.push('tsconfig.json must reference ./tsconfig.app.json.')
	}

	if (!hasReference(rootTsconfig, './tsconfig.vitest.json')) {
		diagnostics.push('tsconfig.json must reference ./tsconfig.vitest.json.')
	}

	return diagnostics
}

export function lintVitestTsconfigSplit(inputs: TsconfigSplitInputs): string[] {
	if (!inputs.hasSourceDirectory || !usesVitest(inputs.manifest, inputs.hasVitestConfig)) {
		return []
	}

	return [
		...lintRootTsconfig(inputs.rootTsconfig),
		...lintAppTsconfig(inputs.appTsconfig),
		...lintVitestTsconfig(inputs.vitestTsconfig),
	]
}

export function readTsconfigFile(filePath: string): TsconfigFile | undefined {
	if (!existsSync(filePath)) {
		return undefined
	}

	const parsedConfig = ts.parseConfigFileTextToJson(filePath, readFileSync(filePath, 'utf8'))

	if (parsedConfig.error !== undefined || !isJsonValue(parsedConfig.config)) {
		return undefined
	}

	return decodeTsconfigHostValue(parsedConfig.config)
}
