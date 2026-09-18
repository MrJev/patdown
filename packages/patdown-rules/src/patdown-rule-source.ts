import { Context, Data, Effect, FileSystem, Layer, Option, Path } from 'effect'

import { parseMarkdownPatdownRules } from '#/markdown-patdown-rule-parser'
import { defaultPatdownRulesFileName, type PatdownRulesDocument } from '#/patdown-rule'

/** No AGENTS.PATDOWN.md (or override path) existed walking up from the start directory. */
export class PatdownRulesFileMissing extends Data.TaggedError('PatdownRulesFileMissing')<{
	readonly patdownRulesFileName: string
	readonly startDirectory: string
}> {
	override get message(): string {
		return `patdown: no ${this.patdownRulesFileName} found walking up from ${this.startDirectory}`
	}
}

/** The rules file existed but could not be read. */
export class PatdownRulesReadFailed extends Data.TaggedError('PatdownRulesReadFailed')<{
	readonly patdownRulesFilePath: string
}> {
	override get message(): string {
		return `patdown: failed to read ${this.patdownRulesFilePath}`
	}
}

/**
 * Loads fuzzy patdown rules for a run. Swap the live layer to change file format without touching
 * the CLI command.
 */
export class PatdownRuleSource extends Context.Service<
	PatdownRuleSource,
	{
		readonly loadPatdownRules: (
			rulesFilePathOverride: Option.Option<string>,
		) => Effect.Effect<
			PatdownRulesDocument,
			PatdownRulesFileMissing | PatdownRulesReadFailed,
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

function findPatdownRulesFilePath(
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

function resolvePatdownRulesFilePath(
	rulesFilePathOverride: Option.Option<string>,
): Effect.Effect<
	string,
	PatdownRulesFileMissing | PatdownRulesReadFailed,
	FileSystem.FileSystem | Path.Path
> {
	return Effect.gen(function* () {
		const path = yield* Path.Path
		const startDirectory = path.resolve('.')

		if (Option.isNone(rulesFilePathOverride)) {
			return yield* findPatdownRulesFilePath(startDirectory, defaultPatdownRulesFileName)
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
): Effect.Effect<
	PatdownRulesDocument,
	PatdownRulesFileMissing | PatdownRulesReadFailed,
	FileSystem.FileSystem | Path.Path
> {
	return Effect.gen(function* () {
		const patdownRulesFilePath = yield* resolvePatdownRulesFilePath(rulesFilePathOverride)
		const fileSystem = yield* FileSystem.FileSystem

		const markdown = yield* fileSystem
			.readFileString(patdownRulesFilePath)
			.pipe(Effect.mapError(() => new PatdownRulesReadFailed({ patdownRulesFilePath })))

		return {
			patdownRules: parseMarkdownPatdownRules(markdown),
			patdownRulesFilePath,
		}
	})
}

/** Live patdown rule source that reads markdown (`AGENTS.PATDOWN.md` by default). */
export const MarkdownPatdownRuleSourceLive = Layer.succeed(PatdownRuleSource, {
	loadPatdownRules: loadMarkdownPatdownRules,
})
