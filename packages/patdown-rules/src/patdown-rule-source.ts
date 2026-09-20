import { Context, Effect, FileSystem, Layer, Option, Path } from 'effect'

import { loadMarkdownPatdownOrigin } from '#src/patdown-markdown-origin-loader'
import { defaultPatdownRulesFileName, type PatdownRulesDocument } from '#src/patdown-rule'
import {
	PatdownRulesFileMissing,
	PatdownRulesLoadFailed,
	PatdownRulesReadFailed,
} from '#src/patdown-rule-errors'
import { PatdownYesThresholdInvalid } from '#src/patdown-yes-threshold'

export {
	PatdownRulesFileMissing,
	PatdownRulesLoadFailed,
	PatdownRulesReadFailed,
} from '#src/patdown-rule-errors'

type MarkdownRulesLoadError =
	| PatdownRulesFileMissing
	| PatdownRulesReadFailed
	| PatdownRulesLoadFailed
	| PatdownYesThresholdInvalid

/**
 * Loads fuzzy patdown rules for a run. Provide a live layer to parse markdown, YAML, frontmatter
 * files, or any other source. The shipped CLI defaults to MarkdownPatdownRuleSourceLive.
 */
export class PatdownRuleSource extends Context.Service<
	PatdownRuleSource,
	{
		readonly loadPatdownRules: (
			rulesFilePathOverride: Option.Option<string>,
		) => Effect.Effect<
			PatdownRulesDocument,
			MarkdownRulesLoadError,
			FileSystem.FileSystem | Path.Path
		>
	}
>()('@patdown/rules/PatdownRuleSource') {}

function pathExists(
	filePath: string,
): Effect.Effect<boolean, PatdownRulesReadFailed, FileSystem.FileSystem> {
	return FileSystem.FileSystem.use((fileSystem) =>
		fileSystem
			.exists(filePath)
			.pipe(Effect.mapError(() => new PatdownRulesReadFailed({ patdownRulesFilePath: filePath }))),
	)
}

/** Walks up from startDirectory until fileName exists. Adapters can reuse this for other filenames. */
export function findPatdownRulesFilePath(
	startDirectory: string,
	fileName: string,
): Effect.Effect<
	string,
	PatdownRulesFileMissing | PatdownRulesReadFailed,
	FileSystem.FileSystem | Path.Path
> {
	return Effect.gen(function* () {
		const path = yield* Path.Path
		let directory = startDirectory

		while (true) {
			const candidate = path.join(directory, fileName)

			if (yield* pathExists(candidate)) return candidate

			const parent = path.dirname(directory)

			if (parent === directory) {
				return yield* new PatdownRulesFileMissing({
					patdownRulesFileName: fileName,
					startDirectory,
				})
			}

			directory = parent
		}
	})
}

/**
 * Resolves --rules to an existing path, or walks up for rulesFileName (AGENTS.PATDOWN.md by
 * default).
 */
export function resolvePatdownRulesFilePath(
	rulesFilePathOverride: Option.Option<string>,
	rulesFileName: string = defaultPatdownRulesFileName,
): Effect.Effect<
	string,
	PatdownRulesFileMissing | PatdownRulesReadFailed,
	FileSystem.FileSystem | Path.Path
> {
	return Effect.gen(function* () {
		const path = yield* Path.Path
		const startDirectory = path.resolve('.')

		if (Option.isNone(rulesFilePathOverride)) {
			return yield* findPatdownRulesFilePath(startDirectory, rulesFileName)
		}

		const candidate = path.resolve(startDirectory, rulesFilePathOverride.value)

		if (yield* pathExists(candidate)) return candidate

		return yield* new PatdownRulesFileMissing({
			patdownRulesFileName: rulesFilePathOverride.value,
			startDirectory,
		})
	})
}

function loadMarkdownPatdownRules(
	rulesFilePathOverride: Option.Option<string>,
): Effect.Effect<PatdownRulesDocument, MarkdownRulesLoadError, FileSystem.FileSystem | Path.Path> {
	return Effect.gen(function* () {
		const patdownRulesFilePath = yield* resolvePatdownRulesFilePath(rulesFilePathOverride)

		return yield* loadMarkdownPatdownOrigin(patdownRulesFilePath, [])
	})
}

/** Live patdown rule source that reads markdown (`AGENTS.PATDOWN.md` by default). */
export const MarkdownPatdownRuleSourceLive = Layer.succeed(PatdownRuleSource, {
	loadPatdownRules: loadMarkdownPatdownRules,
})
