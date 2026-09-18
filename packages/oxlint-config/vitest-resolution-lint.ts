import { Schema } from 'effect'

import {
	decodePathList,
	isJsonObjectValue,
	jsonObjectEntries,
	jsonValueAt,
	type PackageManifest,
} from './json-decode.ts'
import type { TsconfigFile } from './tsconfig-split-lint.ts'

export interface VitestResolutionInputs {
	hasSourceDirectory: boolean
	hasVitestConfig: boolean
	manifest: PackageManifest
	rootTsconfig: TsconfigFile | undefined
	vitestConfigText: string | undefined
	vitestTsconfig: TsconfigFile | undefined
}

const CODE_PATH_PATTERN = /(?:^|\/|\*)(?:[^/]*)(?:\.[cm]?[jt]sx?|\.d\.ts)$/u

const SOURCE_CONDITION = 'source'

function isCodeLikePath(candidate: string): boolean {
	return CODE_PATH_PATTERN.test(candidate)
}

function isAssetOnlySourceEntry(target: Schema.Json): boolean {
	if (!isJsonObjectValue(target)) {
		return false
	}

	const conditionNames = jsonObjectEntries(target).map(([name]) => name)

	if (conditionNames.length !== 1 || conditionNames[0] !== SOURCE_CONDITION) {
		return false
	}

	const sourcePaths = decodePathList(jsonValueAt(target, SOURCE_CONDITION))

	return sourcePaths !== null && sourcePaths.every((candidate) => !isCodeLikePath(candidate))
}

function usesVitest(manifest: PackageManifest, hasVitestConfig: boolean): boolean {
	if (hasVitestConfig) {
		return true
	}

	return Object.values(manifest.scripts ?? {}).some((scriptCommand) =>
		scriptCommand.includes('vitest'),
	)
}

function hasCodeImports(manifest: PackageManifest): boolean {
	if (manifest.imports === undefined || !isJsonObjectValue(manifest.imports)) {
		return false
	}

	return jsonObjectEntries(manifest.imports).some(
		([, target]) => isJsonObjectValue(target) && !isAssetOnlySourceEntry(target),
	)
}

function createMissingImportTestDiagnostics(manifest: PackageManifest): string[] {
	if (manifest.imports === undefined || !isJsonObjectValue(manifest.imports)) {
		return []
	}

	return jsonObjectEntries(manifest.imports).flatMap(([specifier, target]) => {
		if (
			!isJsonObjectValue(target) ||
			isAssetOnlySourceEntry(target) ||
			jsonValueAt(target, 'test') !== undefined
		) {
			return []
		}

		return [
			`package.json imports[${JSON.stringify(specifier)}] must include a ${JSON.stringify('test')} condition so Vitest resolves source files instead of built dist output.`,
		]
	})
}

function hasTestResolveCondition(vitestConfigText: string | undefined): boolean {
	if (vitestConfigText === undefined) {
		return false
	}

	const testResolve = /resolve\s*:\s*\{[\s\S]*?conditions\s*:\s*\[\s*['"]test['"]\s*\]/u.exec(
		vitestConfigText,
	)

	const ssr = /ssr\s*:/u.exec(vitestConfigText)

	return testResolve !== null && (ssr === null || testResolve.index < ssr.index)
}

function hasSsrTestResolveCondition(vitestConfigText: string | undefined): boolean {
	if (vitestConfigText === undefined) {
		return false
	}

	return /ssr\s*:\s*\{[\s\S]*?resolve\s*:\s*\{[\s\S]*?conditions\s*:\s*\[\s*['"]test['"]\s*\]/u.test(
		vitestConfigText,
	)
}

function isNodeLibraryPackage(rootTsconfig: TsconfigFile | undefined): boolean {
	return rootTsconfig?.extends === '@patdown/tsconfig/node-library.json'
}

function hasVitestCustomCondition(vitestTsconfig: TsconfigFile | undefined): boolean {
	const customConditions = vitestTsconfig?.compilerOptions?.customConditions

	return customConditions?.includes('test') ?? false
}

export function lintVitestResolution(inputs: VitestResolutionInputs): string[] {
	if (!inputs.hasSourceDirectory || !usesVitest(inputs.manifest, inputs.hasVitestConfig)) {
		return []
	}

	if (!hasCodeImports(inputs.manifest)) {
		return []
	}

	const diagnostics = createMissingImportTestDiagnostics(inputs.manifest)

	if (!hasTestResolveCondition(inputs.vitestConfigText)) {
		diagnostics.push(
			'vitest.config.ts must set resolve.conditions to ["test"] so Vitest resolves internal package imports from the package.json test condition instead of dist output.',
		)
	}

	if (!hasSsrTestResolveCondition(inputs.vitestConfigText)) {
		diagnostics.push(
			'vitest.config.ts must set ssr.resolve.conditions to ["test"] because Vitest executes test modules through its SSR resolver.',
		)
	}

	if (
		isNodeLibraryPackage(inputs.rootTsconfig) &&
		!hasVitestCustomCondition(inputs.vitestTsconfig)
	) {
		diagnostics.push(
			'tsconfig.vitest.json compilerOptions.customConditions must include "test" for node-library-style packages so the test type graph matches Vitest runtime resolution.',
		)
	}

	return diagnostics
}
