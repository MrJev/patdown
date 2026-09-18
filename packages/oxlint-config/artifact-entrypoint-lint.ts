import path from 'node:path'

import { Schema } from 'effect'

import {
	decodeString,
	decodeStringMap,
	isJsonObjectValue,
	jsonValueAt,
	type PackageManifest,
} from './json-decode.ts'

function hasBuildScript(manifest: PackageManifest): boolean {
	return decodeString(manifest.scripts?.build) !== undefined
}

function isConfigPackage(manifest: PackageManifest): boolean {
	return manifest.squint?.packageKind === 'config-package'
}

function hasBin(manifest: PackageManifest): boolean {
	return manifest.bin !== undefined
}

function requiresFilesCoverage(manifest: PackageManifest, packageDirectory: string): boolean {
	return path.basename(path.dirname(packageDirectory)) === 'packages' || hasBin(manifest)
}

function isBuildableRuntimePackage(
	manifest: PackageManifest,
	hasSourceDirectory: boolean,
): boolean {
	return hasSourceDirectory && hasBuildScript(manifest) && !isConfigPackage(manifest)
}

function isExpoRouterRuntimeEntryApp(manifest: PackageManifest): boolean {
	return (
		manifest.private === true &&
		decodeString(manifest.dependencies?.['expo-router']) !== undefined &&
		(manifest.main === 'expo-router/entry' || manifest.main === './index.ts')
	)
}

function createMissingRequiredFieldDiagnostics(
	manifest: PackageManifest,
	packageName: string,
): string[] {
	const missingFields = [
		decodeString(manifest.main) === undefined ? 'main' : null,
		decodeString(manifest.types) === undefined ? 'types' : null,
	].filter((field): field is string => field !== null)

	if (missingFields.length === 0) {
		return []
	}

	return [
		`${JSON.stringify(packageName)} is a buildable runtime package and must define ${missingFields.map((field) => JSON.stringify(field)).join(' and ')} so consumers resolve built dist entrypoints explicitly.`,
	]
}

function createDistEntrypointDiagnostic(
	packageName: string,
	fieldName: 'main' | 'types',
	value: string,
): string[] {
	if (value.startsWith('./dist/')) {
		return []
	}

	return [
		`${JSON.stringify(packageName)} ${JSON.stringify(fieldName)} must point under ${JSON.stringify('./dist/')}. Found ${JSON.stringify(value)}.`,
	]
}

function createRootExportDefaultAlignmentDiagnostic(
	manifest: PackageManifest,
	packageName: string,
	rootExport: Schema.Json,
): string[] {
	const defaultExport = decodeString(jsonValueAt(rootExport, 'default'))
	const main = decodeString(manifest.main)

	if (defaultExport === undefined || main === undefined) {
		return []
	}

	if (defaultExport === main) {
		return []
	}

	if (isExpoRouterRuntimeEntryApp(manifest) && defaultExport.startsWith('./dist/')) {
		return []
	}

	return [
		`${JSON.stringify(packageName)} exports[${JSON.stringify('.')}] default must match package.json ${JSON.stringify('main')}. Found ${JSON.stringify(defaultExport)} vs ${JSON.stringify(main)}.`,
	]
}

function createRootExportTypesAlignmentDiagnostic(
	manifest: PackageManifest,
	packageName: string,
	rootExport: Schema.Json,
): string[] {
	const typesExport = decodeString(jsonValueAt(rootExport, 'types'))
	const types = decodeString(manifest.types)

	if (typesExport === undefined || types === undefined) {
		return []
	}

	if (typesExport === types) {
		return []
	}

	return [
		`${JSON.stringify(packageName)} exports[${JSON.stringify('.')}] types must match package.json ${JSON.stringify('types')}. Found ${JSON.stringify(typesExport)} vs ${JSON.stringify(types)}.`,
	]
}

function createRootExportAlignmentDiagnostics(
	manifest: PackageManifest,
	packageName: string,
): string[] {
	const rootExport = jsonValueAt(manifest.exports, '.')

	if (rootExport === undefined || !isJsonObjectValue(rootExport)) {
		return []
	}

	return [
		...createRootExportDefaultAlignmentDiagnostic(manifest, packageName, rootExport),
		...createRootExportTypesAlignmentDiagnostic(manifest, packageName, rootExport),
	]
}

function createBinDiagnostics(manifest: PackageManifest, packageName: string): string[] {
	const binPath = decodeString(manifest.bin)

	if (binPath !== undefined) {
		return binPath.startsWith('./dist/')
			? []
			: [
					`${JSON.stringify(packageName)} bin entry must point under ${JSON.stringify('./dist/')}. Found ${JSON.stringify(binPath)}.`,
				]
	}

	const binMap = decodeStringMap(manifest.bin)

	if (binMap === undefined) {
		return []
	}

	return Object.entries(binMap).flatMap(([binName, mappedPath]) => {
		if (mappedPath.startsWith('./dist/')) {
			return []
		}

		return [
			`${JSON.stringify(packageName)} bin ${JSON.stringify(binName)} must point under ${JSON.stringify('./dist/')}. Found ${JSON.stringify(mappedPath)}.`,
		]
	})
}

function createFilesDiagnostics(manifest: PackageManifest, packageName: string): string[] {
	if (
		manifest.files !== undefined &&
		manifest.files.some((entry) => {
			const value = decodeString(entry)

			return value !== undefined && value.startsWith('dist')
		})
	) {
		return []
	}

	return [
		`${JSON.stringify(packageName)} must include ${JSON.stringify('dist')} in package.json ${JSON.stringify('files')} so published entrypoints include built artifacts.`,
	]
}

export function lintArtifactEntrypoints({
	hasSourceDirectory,
	manifest,
	packageDirectory,
}: {
	hasSourceDirectory: boolean
	manifest: PackageManifest
	packageDirectory: string
}): string[] {
	if (!isBuildableRuntimePackage(manifest, hasSourceDirectory)) {
		return []
	}

	const packageName = manifest.name ?? packageDirectory
	const main = decodeString(manifest.main)
	const types = decodeString(manifest.types)

	return [
		...createMissingRequiredFieldDiagnostics(manifest, packageName),
		...(main === undefined
			? []
			: isExpoRouterRuntimeEntryApp(manifest)
				? []
				: createDistEntrypointDiagnostic(packageName, 'main', main)),
		...(types === undefined ? [] : createDistEntrypointDiagnostic(packageName, 'types', types)),
		...createRootExportAlignmentDiagnostics(manifest, packageName),
		...createBinDiagnostics(manifest, packageName),
		...(requiresFilesCoverage(manifest, packageDirectory)
			? createFilesDiagnostics(manifest, packageName)
			: []),
	]
}
