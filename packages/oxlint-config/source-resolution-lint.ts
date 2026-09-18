import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

import {
	decodePathList,
	decodeString,
	decodeStringList,
	isJsonObjectValue,
	jsonObjectEntries,
	jsonValueAt,
	type PackageManifest,
} from './json-decode.ts'
import { readTsconfigFile, type TsconfigFile } from './tsconfig-split-lint.ts'

const CODE_PATH_PATTERN = /\.[cm]?[jt]sx?$/u

const SOURCE_CONDITION = 'source'

function hasSourceCodeImports(manifest: PackageManifest): boolean {
	if (manifest.imports === undefined || !isJsonObjectValue(manifest.imports)) return false

	return jsonObjectEntries(manifest.imports).some(([, target]) => {
		if (!isJsonObjectValue(target)) return false
		const sourceTargets = decodePathList(jsonValueAt(target, SOURCE_CONDITION))

		return sourceTargets?.some((sourceTarget) => CODE_PATH_PATTERN.test(sourceTarget)) ?? false
	})
}

function isSolutionConfig(config: TsconfigFile): boolean {
	const files = decodeStringList(config.files)

	return (
		files !== null &&
		files.length === 0 &&
		(config.references?.length ?? 0) > 0 &&
		config.include === undefined
	)
}

function resolveLocalExtends(configPath: string, extendsTarget: string): string | null {
	if (!extendsTarget.startsWith('.')) return null

	const resolvedTarget = path.resolve(path.dirname(configPath), extendsTarget)

	if (path.extname(resolvedTarget) === '.json') return resolvedTarget

	return `${resolvedTarget}.json`
}

function readOwnSourceCondition(config: TsconfigFile): boolean | null {
	const compilerOptions = config.compilerOptions

	if (compilerOptions === undefined || compilerOptions.customConditions === undefined) {
		return null
	}

	return compilerOptions.customConditions.includes(SOURCE_CONDITION)
}

function resolveParentConfigPath(configPath: string, config: TsconfigFile): string | null {
	const extendsTarget = decodeString(config.extends)

	if (extendsTarget === undefined) return null

	const parentPath = resolveLocalExtends(configPath, extendsTarget)

	return parentPath !== null && existsSync(parentPath) ? parentPath : null
}

function hasEffectiveSourceCondition(configPath: string, visited: ReadonlySet<string>): boolean {
	if (visited.has(configPath)) return false

	const config = readTsconfigFile(configPath)

	if (config === undefined) return false

	const ownSourceCondition = readOwnSourceCondition(config)

	if (ownSourceCondition !== null) return ownSourceCondition

	const parentPath = resolveParentConfigPath(configPath, config)

	if (parentPath === null) return false

	return hasEffectiveSourceCondition(parentPath, new Set([...visited, configPath]))
}

export function lintSourceResolution(inputs: {
	hasSourceDirectory: boolean
	manifest: PackageManifest
	packageDirectory: string
}): string[] {
	if (!inputs.hasSourceDirectory || !hasSourceCodeImports(inputs.manifest)) return []

	return readdirSync(inputs.packageDirectory, { withFileTypes: true })
		.filter((entry) => entry.isFile() && /^tsconfig(?:\.[a-z0-9-]+)?\.json$/u.test(entry.name))
		.toSorted((left, right) => left.name.localeCompare(right.name))
		.flatMap((entry) => {
			const configPath = path.join(inputs.packageDirectory, entry.name)
			const config = readTsconfigFile(configPath)

			if (config === undefined || isSolutionConfig(config)) return []

			if (hasEffectiveSourceCondition(configPath, new Set())) return []

			return [
				`${entry.name} compilerOptions.customConditions must effectively include ${JSON.stringify(SOURCE_CONDITION)} so package self-imports resolve source without requiring prebuilt dist output.`,
			]
		})
}
