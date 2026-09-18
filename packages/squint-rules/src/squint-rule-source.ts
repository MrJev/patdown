import { Context, Data, Effect, FileSystem, Layer, Option, Path } from 'effect'

import { parseMarkdownSquintRules } from '#/markdown-squint-rule-parser'
import { defaultSquintRulesFileName, type SquintRulesDocument } from '#/squint-rule'

/** No AGENTS.SQUINT.md (or override path) existed walking up from the start directory. */
export class SquintRulesFileMissing extends Data.TaggedError('SquintRulesFileMissing')<{
	readonly squintRulesFileName: string
	readonly startDirectory: string
}> {
	override get message(): string {
		return `squint: no ${this.squintRulesFileName} found walking up from ${this.startDirectory}`
	}
}

/** The rules file existed but could not be read. */
export class SquintRulesReadFailed extends Data.TaggedError('SquintRulesReadFailed')<{
	readonly squintRulesFilePath: string
}> {
	override get message(): string {
		return `squint: failed to read ${this.squintRulesFilePath}`
	}
}

/**
 * Loads fuzzy squint rules for a run. Swap the live layer to change file format without touching
 * the CLI command.
 */
export class SquintRuleSource extends Context.Service<
	SquintRuleSource,
	{
		readonly loadSquintRules: (
			rulesFilePathOverride: Option.Option<string>,
		) => Effect.Effect<
			SquintRulesDocument,
			SquintRulesFileMissing | SquintRulesReadFailed,
			FileSystem.FileSystem | Path.Path
		>
	}
>()('@squint/rules/SquintRuleSource') {}

function pathExists(
	filePath: string,
): Effect.Effect<boolean, SquintRulesReadFailed, FileSystem.FileSystem> {
	return FileSystem.FileSystem.use((fileSystem) =>
		fileSystem
			.exists(filePath)
			.pipe(Effect.mapError(() => new SquintRulesReadFailed({ squintRulesFilePath: filePath }))),
	)
}

function findSquintRulesFilePath(
	startDirectory: string,
	fileName: string,
): Effect.Effect<
	string,
	SquintRulesFileMissing | SquintRulesReadFailed,
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
				return yield* new SquintRulesFileMissing({
					squintRulesFileName: fileName,
					startDirectory,
				})
			}

			directory = parent
		}
	})
}

function resolveSquintRulesFilePath(
	rulesFilePathOverride: Option.Option<string>,
): Effect.Effect<
	string,
	SquintRulesFileMissing | SquintRulesReadFailed,
	FileSystem.FileSystem | Path.Path
> {
	return Effect.gen(function* () {
		const path = yield* Path.Path
		const startDirectory = path.resolve('.')

		if (Option.isNone(rulesFilePathOverride)) {
			return yield* findSquintRulesFilePath(startDirectory, defaultSquintRulesFileName)
		}

		const candidate = path.resolve(startDirectory, rulesFilePathOverride.value)

		if (yield* pathExists(candidate)) return candidate

		return yield* new SquintRulesFileMissing({
			squintRulesFileName: rulesFilePathOverride.value,
			startDirectory,
		})
	})
}

function loadMarkdownSquintRules(
	rulesFilePathOverride: Option.Option<string>,
): Effect.Effect<
	SquintRulesDocument,
	SquintRulesFileMissing | SquintRulesReadFailed,
	FileSystem.FileSystem | Path.Path
> {
	return Effect.gen(function* () {
		const squintRulesFilePath = yield* resolveSquintRulesFilePath(rulesFilePathOverride)
		const fileSystem = yield* FileSystem.FileSystem

		const markdown = yield* fileSystem
			.readFileString(squintRulesFilePath)
			.pipe(Effect.mapError(() => new SquintRulesReadFailed({ squintRulesFilePath })))

		return {
			squintRules: parseMarkdownSquintRules(markdown),
			squintRulesFilePath,
		}
	})
}

/** Live squint rule source that reads markdown (`AGENTS.SQUINT.md` by default). */
export const MarkdownSquintRuleSourceLive = Layer.succeed(SquintRuleSource, {
	loadSquintRules: loadMarkdownSquintRules,
})
