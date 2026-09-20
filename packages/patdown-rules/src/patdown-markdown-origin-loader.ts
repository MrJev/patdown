import { Effect, FileSystem, Path } from 'effect'

import {
	parseMarkdownPatdownFrontmatter,
	type PatdownMarkdownFrontmatter,
} from '#src/markdown-patdown-frontmatter'
import { parseMarkdownPatdownRules } from '#src/markdown-patdown-rule-parser'
import {
	PatdownGitHubAnnotationInvalid,
	type PatdownGitHubAnnotationLevel,
} from '#src/patdown-github-annotation'
import type { PatdownRule, PatdownRulesDocument } from '#src/patdown-rule'
import { PatdownRulesLoadFailed, PatdownRulesReadFailed } from '#src/patdown-rule-errors'
import { PatdownYesThresholdInvalid } from '#src/patdown-yes-threshold'

export type MarkdownRulesLoadError =
	| PatdownRulesReadFailed
	| PatdownRulesLoadFailed
	| PatdownYesThresholdInvalid
	| PatdownGitHubAnnotationInvalid

export type MarkdownRulesLoad = Effect.Effect<
	PatdownRulesDocument,
	MarkdownRulesLoadError,
	FileSystem.FileSystem | Path.Path
>

function parseMarkdownPatdownRulesFile(
	markdown: string,
): Effect.Effect<
	ReadonlyArray<PatdownRule>,
	PatdownRulesLoadFailed | PatdownYesThresholdInvalid | PatdownGitHubAnnotationInvalid
> {
	return Effect.try({
		try: () => parseMarkdownPatdownRules(markdown),
		catch: (cause) =>
			cause instanceof PatdownYesThresholdInvalid || cause instanceof PatdownGitHubAnnotationInvalid
				? cause
				: new PatdownRulesLoadFailed({
						message: cause instanceof Error ? cause.message : String(cause),
					}),
	})
}

function parseMarkdownPatdownFrontmatterBlock(
	markdown: string,
): Effect.Effect<
	PatdownMarkdownFrontmatter,
	PatdownRulesLoadFailed | PatdownGitHubAnnotationInvalid
> {
	return Effect.try({
		try: () => parseMarkdownPatdownFrontmatter(markdown),
		catch: (cause) =>
			cause instanceof PatdownGitHubAnnotationInvalid
				? cause
				: new PatdownRulesLoadFailed({
						message: cause instanceof Error ? cause.message : String(cause),
					}),
	})
}

function withPatdownRuleSourcePath(rule: PatdownRule, sourcePath: string): PatdownRule {
	if (rule.patdownRuleSourcePath !== undefined) return rule

	return { ...rule, patdownRuleSourcePath: sourcePath }
}

function withPatdownRuleGitHubAnnotationDefault(
	rule: PatdownRule,
	defaultLevel: PatdownGitHubAnnotationLevel | undefined,
): PatdownRule {
	if (rule.patdownRuleGitHubAnnotation !== undefined || defaultLevel === undefined) {
		return rule
	}

	return { ...rule, patdownRuleGitHubAnnotation: defaultLevel }
}

function duplicatePatdownRuleTitleMessage(rules: ReadonlyArray<PatdownRule>): string | undefined {
	const firstSourcePath = new Map<string, string>()

	for (const rule of rules) {
		const sourcePath = rule.patdownRuleSourcePath ?? 'unknown'
		const existing = firstSourcePath.get(rule.patdownRuleTitle)

		if (existing !== undefined) {
			return `patdown: duplicate rule title ${JSON.stringify(rule.patdownRuleTitle)} in ${existing} and ${sourcePath}`
		}

		firstSourcePath.set(rule.patdownRuleTitle, sourcePath)
	}

	return undefined
}

function requireUniquePatdownRuleTitles(
	rules: ReadonlyArray<PatdownRule>,
): Effect.Effect<ReadonlyArray<PatdownRule>, PatdownRulesLoadFailed> {
	const message = duplicatePatdownRuleTitleMessage(rules)

	if (message === undefined) return Effect.succeed(rules)

	return Effect.fail(new PatdownRulesLoadFailed({ message }))
}

function patdownIncludeCycleMessage(
	includeStack: ReadonlyArray<string>,
	originPath: string,
): string {
	return `patdown: include cycle ${[...includeStack, originPath].join(' -> ')}`
}

function pathExists(
	filePath: string,
): Effect.Effect<boolean, PatdownRulesReadFailed, FileSystem.FileSystem> {
	return FileSystem.FileSystem.use((fileSystem) =>
		fileSystem
			.exists(filePath)
			.pipe(Effect.mapError(() => new PatdownRulesReadFailed({ patdownRulesFilePath: filePath }))),
	)
}

function canonicalizePatdownOriginPath(
	filePath: string,
): Effect.Effect<string, PatdownRulesReadFailed, FileSystem.FileSystem> {
	return FileSystem.FileSystem.use((fileSystem) =>
		fileSystem
			.realPath(filePath)
			.pipe(Effect.mapError(() => new PatdownRulesReadFailed({ patdownRulesFilePath: filePath }))),
	)
}

function readPatdownMarkdown(
	patdownRulesFilePath: string,
): Effect.Effect<string, PatdownRulesReadFailed, FileSystem.FileSystem> {
	return FileSystem.FileSystem.use((fileSystem) =>
		fileSystem
			.readFileString(patdownRulesFilePath)
			.pipe(Effect.mapError(() => new PatdownRulesReadFailed({ patdownRulesFilePath }))),
	)
}

function missingPatdownInclude(fromFilePath: string, includePath: string): PatdownRulesLoadFailed {
	return new PatdownRulesLoadFailed({
		message: `patdown: include ${JSON.stringify(includePath)} from ${fromFilePath} was not found`,
	})
}

function concatPatdownRuleDocuments(
	documents: ReadonlyArray<PatdownRulesDocument>,
	patdownRulesFilePath: string,
): Effect.Effect<PatdownRulesDocument, PatdownRulesLoadFailed> {
	return Effect.gen(function* () {
		const rules = documents.flatMap((document) => document.patdownRules)
		const unique = yield* requireUniquePatdownRuleTitles(rules)

		return {
			patdownRules: unique,
			patdownRulesFilePath,
		}
	})
}

function markdownRuleFileNames(entries: ReadonlyArray<string>): ReadonlyArray<string> {
	return entries
		.filter((entry) => entry.toLowerCase().endsWith('.md'))
		.filter((entry) => entry.toLowerCase() !== 'readme.md')
		.toSorted((left, right) => left.localeCompare(right))
}

function emptyPatdownRulesDirectory(directoryPath: string): PatdownRulesLoadFailed {
	return new PatdownRulesLoadFailed({
		message: `patdown: rules directory ${directoryPath} has no rule markdown files`,
	})
}

type LoadPatdownMarkdownOrigin = (
	originPath: string,
	includeStack: ReadonlyArray<string>,
) => MarkdownRulesLoad

function loadIncludedPatdownOrigins(
	fromFilePath: string,
	includePaths: ReadonlyArray<string>,
	includeStack: ReadonlyArray<string>,
	loadOrigin: LoadPatdownMarkdownOrigin,
): Effect.Effect<
	ReadonlyArray<PatdownRulesDocument>,
	MarkdownRulesLoadError,
	FileSystem.FileSystem | Path.Path
> {
	return Effect.gen(function* () {
		const path = yield* Path.Path
		const included: PatdownRulesDocument[] = []

		for (const includePath of includePaths) {
			const resolved = path.resolve(path.dirname(fromFilePath), includePath)

			if (!(yield* pathExists(resolved))) {
				return yield* missingPatdownInclude(fromFilePath, includePath)
			}

			const canonical = yield* canonicalizePatdownOriginPath(resolved)

			included.push(yield* loadOrigin(canonical, includeStack))
		}

		return included
	})
}

function loadMarkdownPatdownRulesFromFile(
	patdownRulesFilePath: string,
	includeStack: ReadonlyArray<string>,
	loadOrigin: LoadPatdownMarkdownOrigin,
): MarkdownRulesLoad {
	return Effect.gen(function* () {
		const markdown = yield* readPatdownMarkdown(patdownRulesFilePath)
		const frontmatter = yield* parseMarkdownPatdownFrontmatterBlock(markdown)

		const included = yield* loadIncludedPatdownOrigins(
			patdownRulesFilePath,
			frontmatter.includes,
			includeStack,
			loadOrigin,
		)

		const parsed = yield* parseMarkdownPatdownRulesFile(markdown)

		const localRules = parsed.map((rule) =>
			withPatdownRuleGitHubAnnotationDefault(
				withPatdownRuleSourcePath(rule, patdownRulesFilePath),
				frontmatter.githubAnnotation,
			),
		)

		return yield* concatPatdownRuleDocuments(
			[...included, { patdownRules: localRules, patdownRulesFilePath }],
			patdownRulesFilePath,
		)
	})
}

function loadMarkdownDirectoryEntries(
	patdownRulesDirectoryPath: string,
): Effect.Effect<ReadonlyArray<string>, PatdownRulesReadFailed, FileSystem.FileSystem> {
	return FileSystem.FileSystem.use((fileSystem) =>
		fileSystem
			.readDirectory(patdownRulesDirectoryPath)
			.pipe(
				Effect.mapError(
					() => new PatdownRulesReadFailed({ patdownRulesFilePath: patdownRulesDirectoryPath }),
				),
			),
	)
}

function loadMarkdownPatdownRulesFromDirectory(
	patdownRulesDirectoryPath: string,
	includeStack: ReadonlyArray<string>,
	loadOrigin: LoadPatdownMarkdownOrigin,
): MarkdownRulesLoad {
	return Effect.gen(function* () {
		const path = yield* Path.Path
		const entries = yield* loadMarkdownDirectoryEntries(patdownRulesDirectoryPath)
		const ruleFiles = markdownRuleFileNames(entries)

		if (ruleFiles.length === 0) {
			return yield* emptyPatdownRulesDirectory(patdownRulesDirectoryPath)
		}

		const documents: PatdownRulesDocument[] = []

		for (const ruleFile of ruleFiles) {
			const rulePath = path.join(patdownRulesDirectoryPath, ruleFile)
			const document = yield* loadOrigin(rulePath, includeStack)

			if (document.patdownRules.length === 0) {
				return yield* new PatdownRulesLoadFailed({
					message: `patdown: rules file ${rulePath} has no # headings`,
				})
			}

			documents.push(document)
		}

		return yield* concatPatdownRuleDocuments(documents, patdownRulesDirectoryPath)
	})
}

/** Load a markdown file or pack directory, following frontmatter `include:` lines. */
export function loadMarkdownPatdownOrigin(
	originPath: string,
	includeStack: ReadonlyArray<string>,
): MarkdownRulesLoad {
	return Effect.gen(function* () {
		const canonicalPath = yield* canonicalizePatdownOriginPath(originPath)

		if (includeStack.includes(canonicalPath)) {
			return yield* new PatdownRulesLoadFailed({
				message: patdownIncludeCycleMessage(includeStack, canonicalPath),
			})
		}

		const nextStack = [...includeStack, canonicalPath]
		const fileSystem = yield* FileSystem.FileSystem

		const info = yield* fileSystem
			.stat(canonicalPath)
			.pipe(
				Effect.mapError(() => new PatdownRulesReadFailed({ patdownRulesFilePath: canonicalPath })),
			)

		if (info.type === 'Directory') {
			return yield* loadMarkdownPatdownRulesFromDirectory(
				canonicalPath,
				nextStack,
				loadMarkdownPatdownOrigin,
			)
		}

		return yield* loadMarkdownPatdownRulesFromFile(
			canonicalPath,
			nextStack,
			loadMarkdownPatdownOrigin,
		)
	})
}
