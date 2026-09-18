import { Schema } from 'effect'

import {
	decodeManifestConditionObject,
	decodePathList,
	hasJsonKey,
	isJsonObjectValue,
	jsonObjectEntries,
	jsonValueAt,
	type ManifestConditionObject,
	type ManifestPathValue,
	type ManifestTarget,
	type PackageManifest,
} from './json-decode.ts'

export type { ManifestPathValue, ManifestTarget, PackageManifest }

const CODE_PATH_PATTERN = /(?:^|\/|\*)(?:[^/]*)(?:\.[cm]?[jt]sx?|\.d\.ts)$/u

const SOURCE_CONDITION = 'source'

const SOURCE_STYLE_EXPORT_PATTERN = /^\.\/(?:.*\/)?[^/]+\.source\.css$/u

function isCodeLikePath(candidate: string): boolean {
	return CODE_PATH_PATTERN.test(candidate)
}

function isAssetOnlySourceEntry(target: Schema.Json): boolean {
	const conditionObject = decodeManifestConditionObject(target)

	if (conditionObject === undefined) return false

	const conditionNames = Object.keys(conditionObject)

	if (conditionNames.length !== 1 || conditionNames[0] !== SOURCE_CONDITION) {
		return false
	}

	const sourcePaths = decodePathList(conditionObject[SOURCE_CONDITION])

	return sourcePaths !== null && sourcePaths.every((candidate) => !isCodeLikePath(candidate))
}

function isAssetImportEntry(target: ManifestConditionObject): boolean {
	const conditionNames = Object.keys(target)

	if (
		conditionNames.length === 0 ||
		!conditionNames.every((conditionName) =>
			[SOURCE_CONDITION, 'test', 'types', 'default'].includes(conditionName),
		)
	) {
		return false
	}

	return conditionNames.every((conditionName) => {
		const paths = decodePathList(target[conditionName])

		if (paths === null) return false

		return conditionName === 'types' || paths.every((candidate) => !isCodeLikePath(candidate))
	})
}

function createPathFamilyDiagnostics({
	propertyName,
	specifier,
	conditionName,
	value,
	expectedPrefix,
}: {
	propertyName: 'exports' | 'imports'
	specifier: string
	conditionName: string
	value: Schema.Json
	expectedPrefix: string
}): string[] {
	const paths = decodePathList(value)

	if (paths === null) {
		return [
			`package.json ${propertyName}[${JSON.stringify(specifier)}].${conditionName} must be a string or a non-empty array of strings.`,
		]
	}

	return paths.flatMap((candidate) => {
		if (candidate.startsWith(expectedPrefix)) {
			return []
		}

		return [
			`package.json ${propertyName}[${JSON.stringify(specifier)}].${conditionName} must point under ${JSON.stringify(expectedPrefix)}. Found ${JSON.stringify(candidate)}.`,
		]
	})
}

function createMissingImportConditionDiagnostics(
	specifier: string,
	target: ManifestConditionObject,
): string[] {
	const missingParts = [
		!Object.hasOwn(target, SOURCE_CONDITION) ? SOURCE_CONDITION : null,
		!Object.hasOwn(target, 'test') ? 'test' : null,
		!Object.hasOwn(target, 'types') ? 'types' : null,
		!Object.hasOwn(target, 'default') ? 'default' : null,
	].filter((part): part is string => part !== null)

	if (missingParts.length === 0) {
		return []
	}

	return [
		`package.json imports[${JSON.stringify(specifier)}] is missing ${missingParts.join(', ')}. Code entries must include ${JSON.stringify(SOURCE_CONDITION)}, ${JSON.stringify('test')}, ${JSON.stringify('types')}, and ${JSON.stringify('default')}.`,
	]
}

function createMissingExportConditionDiagnostics(
	specifier: string,
	target: ManifestConditionObject,
): string[] {
	const missingParts = [
		!Object.hasOwn(target, 'types') ? 'types' : null,
		!Object.hasOwn(target, 'default') ? 'default' : null,
	].filter((part): part is string => part !== null)

	if (missingParts.length === 0) {
		return []
	}

	return [
		`package.json exports[${JSON.stringify(specifier)}] is missing ${missingParts.join(', ')}. Public code exports must include ${JSON.stringify('types')} and ${JSON.stringify('default')} and resolve to built ${JSON.stringify('./dist/')} outputs.`,
	]
}

function createConditionPathFamilyDiagnostics({
	conditionNames,
	expectedPrefix,
	propertyName,
	specifier,
	target,
}: {
	conditionNames: readonly string[]
	expectedPrefix: string
	propertyName: 'exports' | 'imports'
	specifier: string
	target: ManifestConditionObject
}): string[] {
	return conditionNames.flatMap((conditionName) => {
		if (!Object.hasOwn(target, conditionName)) {
			return []
		}

		return createPathFamilyDiagnostics({
			propertyName,
			specifier,
			conditionName,
			value: target[conditionName],
			expectedPrefix,
		})
	})
}

function createCodeEntryPathDiagnostics(
	propertyName: 'exports' | 'imports',
	specifier: string,
	target: ManifestConditionObject,
): string[] {
	return [
		...createConditionPathFamilyDiagnostics({
			conditionNames: [SOURCE_CONDITION, 'test'],
			expectedPrefix: './src/',
			propertyName,
			specifier,
			target,
		}),
		...createConditionPathFamilyDiagnostics({
			conditionNames: ['types', 'node'],
			expectedPrefix: './dist/',
			propertyName,
			specifier,
			target,
		}),
		...(Object.hasOwn(target, 'default')
			? createPathFamilyDiagnostics({
					propertyName,
					specifier,
					conditionName: 'default',
					value: target.default,
					expectedPrefix: './dist/',
				})
			: []),
	]
}

function createAssetImportEntryDiagnostics(
	specifier: string,
	target: ManifestConditionObject,
): string[] {
	return [
		...createConditionPathFamilyDiagnostics({
			conditionNames: [SOURCE_CONDITION, 'test'],
			expectedPrefix: './src/',
			propertyName: 'imports',
			specifier,
			target,
		}),
		...createConditionPathFamilyDiagnostics({
			conditionNames: ['types', 'default'],
			expectedPrefix: './dist/',
			propertyName: 'imports',
			specifier,
			target,
		}),
	]
}

function lintImportEntry(specifier: string, target: Schema.Json): string[] {
	const conditionObject = decodeManifestConditionObject(target)

	if (conditionObject === undefined) {
		return [
			`package.json imports[${JSON.stringify(specifier)}] must be a condition object. Use { ${SOURCE_CONDITION}, types, test, default } for code entries.`,
		]
	}

	if (isAssetOnlySourceEntry(target)) {
		return createPathFamilyDiagnostics({
			propertyName: 'imports',
			specifier,
			conditionName: SOURCE_CONDITION,
			value: jsonValueAt(target, SOURCE_CONDITION) ?? null,
			expectedPrefix: './src/',
		})
	}

	if (isAssetImportEntry(conditionObject)) {
		return createAssetImportEntryDiagnostics(specifier, conditionObject)
	}

	return [
		...createMissingImportConditionDiagnostics(specifier, conditionObject),
		...createCodeEntryPathDiagnostics('imports', specifier, conditionObject),
	]
}

function isAssetExportTarget(target: ManifestTarget): boolean {
	return decodePathList(target)?.every((candidate) => !isCodeLikePath(candidate)) ?? false
}

function isSourceStyleExport(specifier: string, target: Schema.Json): boolean {
	if (!SOURCE_STYLE_EXPORT_PATTERN.test(specifier)) {
		return false
	}

	const paths = decodePathList(target)

	return paths !== null && paths.every((candidate) => candidate.startsWith('./src/'))
}

function lintPathExportEntry(specifier: string, target: ManifestPathValue): string[] {
	if (SOURCE_STYLE_EXPORT_PATTERN.test(specifier) && !isSourceStyleExport(specifier, target)) {
		return createPathFamilyDiagnostics({
			propertyName: 'exports',
			specifier,
			conditionName: 'default',
			value: target,
			expectedPrefix: './src/',
		})
	}

	if (isSourceStyleExport(specifier, target)) {
		return []
	}

	if (!isAssetExportTarget(target)) {
		return [
			`package.json exports[${JSON.stringify(specifier)}] must be a condition object for code entries. Use { types, default } with built ${JSON.stringify('./dist/')} paths.`,
		]
	}

	return createPathFamilyDiagnostics({
		propertyName: 'exports',
		specifier,
		conditionName: 'default',
		value: target,
		expectedPrefix: './dist/',
	})
}

function lintExportEntry(specifier: string, target: Schema.Json): string[] {
	const pathValue = decodePathList(target)

	if (pathValue !== null) {
		return lintPathExportEntry(
			specifier,
			pathValue.length === 1 ? (pathValue[0] ?? pathValue) : pathValue,
		)
	}

	const conditionObject = decodeManifestConditionObject(target)

	if (conditionObject === undefined) {
		return [
			`package.json exports[${JSON.stringify(specifier)}] must be either a built asset path or a condition object with ${JSON.stringify('types')} and ${JSON.stringify('default')}.`,
		]
	}

	return [
		...createMissingExportConditionDiagnostics(specifier, conditionObject),
		...Object.entries(conditionObject).flatMap(([conditionName, conditionTarget]) =>
			createPathFamilyDiagnostics({
				propertyName: 'exports',
				specifier,
				conditionName,
				value: conditionTarget,
				expectedPrefix: './dist/',
			}),
		),
	]
}

function createImportsPresenceDiagnostics(
	packageName: string,
	imports: Schema.Json | undefined,
): string[] {
	if (imports === undefined || !isJsonObjectValue(imports)) {
		return [
			`Runtime workspace package ${JSON.stringify(packageName)} has a src/ directory, so package.json must define an imports map with a ${JSON.stringify('#src/*')} entry for internal ${JSON.stringify('#src/...')} self-imports.`,
		]
	}

	if (hasJsonKey(imports, '#src/*')) {
		return []
	}

	return [
		`package.json imports for ${JSON.stringify(packageName)} must include ${JSON.stringify('#src/*')} so source files have a catch-all internal subpath import.`,
	]
}

function createExportsPresenceDiagnostics(
	packageName: string,
	exportsMap: Schema.Json | undefined,
): string[] {
	if (exportsMap === undefined || !isJsonObjectValue(exportsMap)) {
		return [
			`Runtime workspace package ${JSON.stringify(packageName)} has a src/ directory, so package.json must define an exports map with ${JSON.stringify('.')} for its public API and built ${JSON.stringify('./dist/')} outputs.`,
		]
	}

	if (hasJsonKey(exportsMap, '.')) {
		return []
	}

	return [
		`package.json exports for ${JSON.stringify(packageName)} must include ${JSON.stringify('.')} so the package exposes a public root entry backed by built ${JSON.stringify('./dist/')} outputs.`,
	]
}

export function lintPackageManifest({
	hasSourceDirectory,
	manifest,
}: {
	hasSourceDirectory: boolean
	manifest: PackageManifest
}): string[] {
	if (!hasSourceDirectory) {
		return []
	}

	const packageName = manifest.name ?? '<unknown-package>'
	const presenceDiagnostics = createImportsPresenceDiagnostics(packageName, manifest.imports)
	const exportPresenceDiagnostics = createExportsPresenceDiagnostics(packageName, manifest.exports)

	if (
		manifest.imports === undefined ||
		manifest.exports === undefined ||
		!isJsonObjectValue(manifest.imports) ||
		!isJsonObjectValue(manifest.exports)
	) {
		return [...presenceDiagnostics, ...exportPresenceDiagnostics]
	}

	return [
		...presenceDiagnostics,
		...exportPresenceDiagnostics,
		...jsonObjectEntries(manifest.imports).flatMap(([specifier, target]) =>
			lintImportEntry(specifier, target),
		),
		...jsonObjectEntries(manifest.exports).flatMap(([specifier, target]) =>
			lintExportEntry(specifier, target),
		),
	]
}
