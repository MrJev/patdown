import { dirname, join, resolve } from 'node:path'

import {
	decodePatdownGitHubAnnotationLevel,
	decodePatdownYesThreshold,
	PatdownGitHubAnnotationInvalid,
	PatdownRulesLoadFailed,
	PatdownYesThresholdInvalid,
	type PatdownGitHubAnnotationLevel,
	type PatdownYesThreshold,
} from '@patdown/rules'
import { Effect, FileSystem, Schema } from 'effect'

const PatdownPackageJsonSchema = Schema.fromJsonString(
	Schema.Struct({
		patdown: Schema.optionalKey(
			Schema.Struct({
				adapter: Schema.optionalKey(Schema.NonEmptyString),
				githubAnnotation: Schema.optionalKey(Schema.NonEmptyString),
				yesThreshold: Schema.optionalKey(Schema.Finite),
			}),
		),
	}),
)

export type PatdownPackageConfig = {
	readonly adapter?: string
	readonly fromDirectory: string
	readonly githubAnnotation?: PatdownGitHubAnnotationLevel
	readonly yesThreshold?: PatdownYesThreshold
}

type DecodedPatdownPackageJson = {
	readonly adapter?: string
	readonly githubAnnotation?: string
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

function decodeConfiguredGitHubAnnotation(
	value: string,
	filename: string,
): Effect.Effect<PatdownGitHubAnnotationLevel, PatdownGitHubAnnotationInvalid> {
	const decoded = decodePatdownGitHubAnnotationLevel(
		value,
		`package.json ${filename} patdown.githubAnnotation`,
	)

	return decoded instanceof PatdownGitHubAnnotationInvalid
		? Effect.fail(decoded)
		: Effect.succeed(decoded)
}

function failedPackageJson(filename: string): PatdownRulesLoadFailed {
	return new PatdownRulesLoadFailed({
		message: `patdown: failed to read ${filename}`,
	})
}

function decodedPackageJson(patdown: {
	readonly adapter?: string
	readonly yesThreshold?: number
	readonly githubAnnotation?: string
}): DecodedPatdownPackageJson {
	let decoded: DecodedPatdownPackageJson = {}

	if (patdown.adapter !== undefined) {
		decoded = { ...decoded, adapter: patdown.adapter }
	}

	if (patdown.yesThreshold !== undefined) {
		decoded = { ...decoded, yesThreshold: patdown.yesThreshold }
	}

	if (patdown.githubAnnotation !== undefined) {
		decoded = { ...decoded, githubAnnotation: patdown.githubAnnotation }
	}

	return decoded
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

		return decodedPackageJson(decoded.patdown)
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

type DiscoveredGitHubAnnotation = {
	readonly value: string
	readonly filename: string
}

type CollectedPackageConfig = {
	readonly adapter: DiscoveredAdapter | undefined
	readonly yesThresholdValue: DiscoveredYesThreshold | undefined
	readonly githubAnnotationValue: DiscoveredGitHubAnnotation | undefined
}

type CollectPackageConfigInput = {
	readonly directory: string
	readonly adapter: DiscoveredAdapter | undefined
	readonly yesThresholdValue: DiscoveredYesThreshold | undefined
	readonly githubAnnotationValue: DiscoveredGitHubAnnotation | undefined
	readonly decoded: DecodedPatdownPackageJson
}

function collectPackageConfig(input: CollectPackageConfigInput): CollectedPackageConfig {
	const nextAdapter: DiscoveredAdapter | undefined =
		input.adapter ??
		(input.decoded.adapter === undefined
			? undefined
			: { moduleSpecifier: input.decoded.adapter, fromDirectory: input.directory })

	const nextYesThreshold: DiscoveredYesThreshold | undefined =
		input.yesThresholdValue ??
		(input.decoded.yesThreshold === undefined
			? undefined
			: {
					value: input.decoded.yesThreshold,
					filename: join(input.directory, 'package.json'),
				})

	const nextGitHubAnnotation: DiscoveredGitHubAnnotation | undefined =
		input.githubAnnotationValue ??
		(input.decoded.githubAnnotation === undefined
			? undefined
			: {
					value: input.decoded.githubAnnotation,
					filename: join(input.directory, 'package.json'),
				})

	return {
		adapter: nextAdapter,
		yesThresholdValue: nextYesThreshold,
		githubAnnotationValue: nextGitHubAnnotation,
	}
}

function packageConfigFromDiscovery(
	directory: string,
	adapter: DiscoveredAdapter | undefined,
	yesThreshold: PatdownYesThreshold | undefined,
	githubAnnotation: PatdownGitHubAnnotationLevel | undefined,
): PatdownPackageConfig {
	let config: PatdownPackageConfig = {
		fromDirectory: adapter?.fromDirectory ?? directory,
	}

	if (adapter !== undefined) {
		config = { ...config, adapter: adapter.moduleSpecifier }
	}

	if (yesThreshold !== undefined) {
		config = { ...config, yesThreshold }
	}

	if (githubAnnotation !== undefined) {
		config = { ...config, githubAnnotation }
	}

	return config
}

function discoveryNeedsMore(
	adapter: DiscoveredAdapter | undefined,
	yesThresholdValue: DiscoveredYesThreshold | undefined,
	githubAnnotationValue: DiscoveredGitHubAnnotation | undefined,
): boolean {
	return (
		adapter === undefined || yesThresholdValue === undefined || githubAnnotationValue === undefined
	)
}

function discoveryFoundNothing(
	adapter: DiscoveredAdapter | undefined,
	yesThresholdValue: DiscoveredYesThreshold | undefined,
	githubAnnotationValue: DiscoveredGitHubAnnotation | undefined,
): boolean {
	return (
		adapter === undefined && yesThresholdValue === undefined && githubAnnotationValue === undefined
	)
}

function decodeDiscoveredPackageValues(
	yesThresholdValue: DiscoveredYesThreshold | undefined,
	githubAnnotationValue: DiscoveredGitHubAnnotation | undefined,
): Effect.Effect<
	{
		readonly yesThreshold: PatdownYesThreshold | undefined
		readonly githubAnnotation: PatdownGitHubAnnotationLevel | undefined
	},
	PatdownYesThresholdInvalid | PatdownGitHubAnnotationInvalid
> {
	return Effect.gen(function* () {
		const yesThreshold =
			yesThresholdValue === undefined
				? undefined
				: yield* decodeConfiguredYesThreshold(yesThresholdValue.value, yesThresholdValue.filename)

		const githubAnnotation =
			githubAnnotationValue === undefined
				? undefined
				: yield* decodeConfiguredGitHubAnnotation(
						githubAnnotationValue.value,
						githubAnnotationValue.filename,
					)

		return { yesThreshold, githubAnnotation }
	})
}

/**
 * Walks from cwd for package.json `patdown` settings. A nearer file without a key does not hide a
 * parent that has it. Invalid JSON fails immediately.
 */
export function discoverPatdownPackageConfig(
	startDirectory: string = process.cwd(),
): Effect.Effect<
	PatdownPackageConfig | null,
	PatdownRulesLoadFailed | PatdownYesThresholdInvalid | PatdownGitHubAnnotationInvalid,
	FileSystem.FileSystem
> {
	return Effect.gen(function* () {
		let directory = resolve(startDirectory)
		let adapter: DiscoveredAdapter | undefined
		let yesThresholdValue: DiscoveredYesThreshold | undefined
		let githubAnnotationValue: DiscoveredGitHubAnnotation | undefined

		while (discoveryNeedsMore(adapter, yesThresholdValue, githubAnnotationValue)) {
			const filename = join(directory, 'package.json')
			const decoded = yield* readPatdownPackageJson(filename)

			if (decoded !== null) {
				const collected = collectPackageConfig({
					directory,
					adapter,
					yesThresholdValue,
					githubAnnotationValue,
					decoded,
				})

				adapter = collected.adapter
				yesThresholdValue = collected.yesThresholdValue
				githubAnnotationValue = collected.githubAnnotationValue
			}

			const parent = dirname(directory)

			if (parent === directory) break

			directory = parent
		}

		if (discoveryFoundNothing(adapter, yesThresholdValue, githubAnnotationValue)) {
			return null
		}

		const decodedValues = yield* decodeDiscoveredPackageValues(
			yesThresholdValue,
			githubAnnotationValue,
		)

		return packageConfigFromDiscovery(
			directory,
			adapter,
			decodedValues.yesThreshold,
			decodedValues.githubAnnotation,
		)
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

/** Reads only githubAnnotation from package.json. Broken adapter config is skipped. */
export function discoverPatdownGitHubAnnotationConfig(
	startDirectory: string = process.cwd(),
): Effect.Effect<
	PatdownGitHubAnnotationLevel | null,
	PatdownGitHubAnnotationInvalid,
	FileSystem.FileSystem
> {
	return Effect.gen(function* () {
		let directory = resolve(startDirectory)

		while (true) {
			const filename = join(directory, 'package.json')
			const decoded = yield* readPatdownPackageJson(filename).pipe(Effect.orElseSucceed(() => null))

			if (decoded?.githubAnnotation !== undefined) {
				return yield* decodeConfiguredGitHubAnnotation(decoded.githubAnnotation, filename)
			}

			const parent = dirname(directory)

			if (parent === directory) return null

			directory = parent
		}
	})
}
