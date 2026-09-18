import { dirname, join, resolve } from 'node:path'

import {
	decodePatdownYesThreshold,
	PatdownRulesLoadFailed,
	PatdownYesThresholdInvalid,
	type PatdownYesThreshold,
} from '@patdown/rules'
import { Effect, FileSystem, Schema } from 'effect'

const PatdownPackageJsonSchema = Schema.fromJsonString(
	Schema.Struct({
		patdown: Schema.optionalKey(
			Schema.Struct({
				adapter: Schema.optionalKey(Schema.NonEmptyString),
				yesThreshold: Schema.optionalKey(Schema.Finite),
			}),
		),
	}),
)

export type PatdownPackageConfig = {
	readonly adapter?: string
	readonly fromDirectory: string
	readonly yesThreshold?: PatdownYesThreshold
}

type DecodedPatdownPackageJson = {
	readonly adapter?: string
	readonly yesThreshold?: number
}

function decodeConfiguredYesThreshold(
	value: number,
	filename: string,
): Effect.Effect<PatdownYesThreshold, PatdownYesThresholdInvalid> {
	const decoded = decodePatdownYesThreshold(value, `package.json ${filename} patdown.yesThreshold`)

	return decoded instanceof PatdownYesThresholdInvalid
		? Effect.fail(decoded)
		: Effect.succeed(decoded)
}

function failedPackageJson(filename: string): PatdownRulesLoadFailed {
	return new PatdownRulesLoadFailed({
		message: `patdown: failed to read ${filename}`,
	})
}

function decodedPackageJson(
	adapter: string | undefined,
	yesThreshold: number | undefined,
): DecodedPatdownPackageJson {
	const decoded: DecodedPatdownPackageJson = {}

	return {
		...(adapter === undefined ? decoded : { ...decoded, adapter }),
		...(yesThreshold === undefined ? decoded : { ...decoded, yesThreshold }),
	}
}

function readPatdownPackageJson(
	filename: string,
): Effect.Effect<DecodedPatdownPackageJson | null, PatdownRulesLoadFailed, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem

		const exists = yield* fs
			.exists(filename)
			.pipe(Effect.mapError(() => failedPackageJson(filename)))

		if (!exists) return null

		const text = yield* fs
			.readFileString(filename)
			.pipe(Effect.mapError(() => failedPackageJson(filename)))

		const decoded = yield* Schema.decodeEffect(PatdownPackageJsonSchema)(text).pipe(
			Effect.mapError(
				(cause) =>
					new PatdownRulesLoadFailed({
						message: `patdown: invalid adapter config ${filename}: ${String(cause)}`,
					}),
			),
		)

		if (decoded.patdown === undefined) return {}

		return decodedPackageJson(decoded.patdown.adapter, decoded.patdown.yesThreshold)
	})
}

type DiscoveredAdapter = {
	readonly moduleSpecifier: string
	readonly fromDirectory: string
}

type DiscoveredYesThreshold = {
	readonly value: number
	readonly filename: string
}

type CollectedPackageConfig = {
	readonly adapter: DiscoveredAdapter | undefined
	readonly yesThresholdValue: DiscoveredYesThreshold | undefined
}

function collectPackageConfig(
	directory: string,
	adapter: DiscoveredAdapter | undefined,
	yesThresholdValue: DiscoveredYesThreshold | undefined,
	decoded: DecodedPatdownPackageJson,
): CollectedPackageConfig {
	const nextAdapter: DiscoveredAdapter | undefined =
		adapter ??
		(decoded.adapter === undefined
			? undefined
			: { moduleSpecifier: decoded.adapter, fromDirectory: directory })

	const nextYesThreshold: DiscoveredYesThreshold | undefined =
		yesThresholdValue ??
		(decoded.yesThreshold === undefined
			? undefined
			: { value: decoded.yesThreshold, filename: join(directory, 'package.json') })

	const collected: CollectedPackageConfig = {
		adapter: nextAdapter,
		yesThresholdValue: nextYesThreshold,
	}

	return collected
}

function packageConfigFromDiscovery(
	directory: string,
	adapter: DiscoveredAdapter | undefined,
	yesThreshold: PatdownYesThreshold | undefined,
): PatdownPackageConfig {
	const config: PatdownPackageConfig = {
		fromDirectory: adapter?.fromDirectory ?? directory,
	}

	if (adapter !== undefined && yesThreshold !== undefined) {
		return { ...config, adapter: adapter.moduleSpecifier, yesThreshold }
	}

	if (adapter !== undefined) {
		return { ...config, adapter: adapter.moduleSpecifier }
	}

	if (yesThreshold !== undefined) {
		return { ...config, yesThreshold }
	}

	return config
}

/**
 * Walks from cwd for package.json `patdown` settings. A nearer file without adapter/yesThreshold
 * does not hide a parent that has them. Invalid JSON fails immediately.
 */
export function discoverPatdownPackageConfig(
	startDirectory: string = process.cwd(),
): Effect.Effect<
	PatdownPackageConfig | null,
	PatdownRulesLoadFailed | PatdownYesThresholdInvalid,
	FileSystem.FileSystem
> {
	return Effect.gen(function* () {
		let directory = resolve(startDirectory)
		let adapter: { readonly moduleSpecifier: string; readonly fromDirectory: string } | undefined
		let yesThresholdValue: { readonly value: number; readonly filename: string } | undefined

		while (adapter === undefined || yesThresholdValue === undefined) {
			const filename = join(directory, 'package.json')
			const decoded = yield* readPatdownPackageJson(filename)

			if (decoded !== null) {
				const collected = collectPackageConfig(directory, adapter, yesThresholdValue, decoded)
				adapter = collected.adapter
				yesThresholdValue = collected.yesThresholdValue
			}

			const parent = dirname(directory)

			if (parent === directory) break

			directory = parent
		}

		if (adapter === undefined && yesThresholdValue === undefined) return null

		const yesThreshold =
			yesThresholdValue === undefined
				? undefined
				: yield* decodeConfiguredYesThreshold(yesThresholdValue.value, yesThresholdValue.filename)

		return packageConfigFromDiscovery(directory, adapter, yesThreshold)
	})
}

/** Reads only a cutoff from package.json. Broken adapter config is skipped for `ask`. */
export function discoverPatdownYesThresholdConfig(
	startDirectory: string = process.cwd(),
): Effect.Effect<PatdownYesThreshold | null, PatdownYesThresholdInvalid, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		let directory = resolve(startDirectory)

		while (true) {
			const filename = join(directory, 'package.json')
			const decoded = yield* readPatdownPackageJson(filename).pipe(Effect.orElseSucceed(() => null))

			if (decoded?.yesThreshold !== undefined) {
				return yield* decodeConfiguredYesThreshold(decoded.yesThreshold, filename)
			}

			const parent = dirname(directory)

			if (parent === directory) return null

			directory = parent
		}
	})
}
