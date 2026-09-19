import {
	defaultPatdownYesThreshold,
	PatdownYesThresholdInvalid,
	type PatdownRule,
	type PatdownRulesDocument,
	type PatdownYesThreshold,
} from '@patdown/rules'
import { Clock, Effect, FileSystem, Path } from 'effect'

import {
	PatdownJudge,
	PatdownJudgeFailed,
	askPatdownJudge,
	patdownJudgmentIsYes,
} from '#src/patdown-judge'
import { PatdownOutput } from '#src/patdown-output'
import { decodePatdownRuleYesThreshold } from '#src/patdown-yes-threshold-config'

const patdownGlobExcludes = [
	'**/.git/**',
	'**/.turbo/**',
	'**/coverage/**',
	'**/dist/**',
	'**/node_modules/**',
] as const

function patdownGlobPatterns(globs: ReadonlyArray<string>): ReadonlyArray<string> {
	return globs.length === 0 ? ['**/*'] : globs
}

function patdownViolationInstructions(rule: PatdownRule): string {
	return [
		'Does this file violate the following patdown rule? Answer yes only if there is a clear violation.',
		'',
		`# ${rule.patdownRuleTitle}`,
		'',
		rule.patdownRuleBody,
	].join('\n')
}

function patdownFileState(relativePath: string, contents: string): string {
	return `path: ${relativePath}\n\n${contents}`
}

function globPatdownRuleFiles(
	cwd: string,
	globs: ReadonlyArray<string>,
): Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem
		const patterns = patdownGlobPatterns(globs)
		const matches: string[] = []

		for (const pattern of patterns) {
			const found = yield* fileSystem
				.glob(pattern, {
					exclude: patdownGlobExcludes,
					root: cwd,
				})
				.pipe(Effect.orElseSucceed((): string[] => []))

			matches.push(...found)
		}

		return [...new Set(matches)].toSorted()
	})
}

function lintPatdownRuleFile(
	rule: PatdownRule,
	filePath: string,
	options: {
		readonly cwd: string
		readonly verbose: boolean
		readonly yesThreshold: PatdownYesThreshold
	},
): Effect.Effect<
	boolean,
	PatdownJudgeFailed,
	FileSystem.FileSystem | PatdownJudge | Path.Path | PatdownOutput
> {
	return Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem
		const path = yield* Path.Path
		const output = yield* PatdownOutput
		const relativePath = path.relative(options.cwd, filePath)

		const contents = yield* fileSystem.readFileString(filePath).pipe(
			Effect.mapError(
				() =>
					new PatdownJudgeFailed({
						message: `patdown: failed to read ${relativePath}`,
					}),
			),
		)

		const timed = yield* askPatdownJudge(
			patdownViolationInstructions(rule),
			patdownFileState(relativePath, contents),
		)

		const failed = patdownJudgmentIsYes(timed.judgment, options.yesThreshold)

		yield* output.writeLintResult(
			{
				violated: failed,
				ruleTitle: rule.patdownRuleTitle,
				filePath: relativePath,
				violationProbability: timed.judgment.yesProbability,
				yesThreshold: options.yesThreshold,
				elapsedMs: timed.elapsedMs,
			},
			options.verbose,
		)

		return failed
	})
}

function lintPatdownRule(
	rule: PatdownRule,
	cwd: string,
	verbose: boolean,
	defaultYesThreshold: PatdownYesThreshold,
): Effect.Effect<
	boolean,
	PatdownJudgeFailed | PatdownYesThresholdInvalid,
	FileSystem.FileSystem | PatdownJudge | Path.Path | PatdownOutput
> {
	return Effect.gen(function* () {
		const output = yield* PatdownOutput
		const files = yield* globPatdownRuleFiles(cwd, rule.patdownRuleGlobs)

		const yesThreshold =
			rule.patdownRuleYesThreshold === undefined
				? defaultYesThreshold
				: yield* decodePatdownRuleYesThreshold(rule.patdownRuleYesThreshold, rule.patdownRuleTitle)

		if (files.length === 0) {
			yield* output.writeNoFilesMatched(rule.patdownRuleTitle)

			return false
		}

		const failures = yield* Effect.forEach(
			files,
			(filePath) => lintPatdownRuleFile(rule, filePath, { cwd, verbose, yesThreshold }),
			{ concurrency: 1 },
		)

		return failures.some((failed) => failed)
	})
}

/** Lint files matched by each rule's globs. A yes judgment means a violation. */
export function runPatdownLint(
	document: PatdownRulesDocument,
	verbose: boolean = false,
	yesThreshold: PatdownYesThreshold = defaultPatdownYesThreshold,
): Effect.Effect<
	{ readonly failed: boolean; readonly elapsedMs: number },
	PatdownJudgeFailed | PatdownYesThresholdInvalid,
	FileSystem.FileSystem | PatdownJudge | Path.Path | PatdownOutput
> {
	return Effect.gen(function* () {
		const path = yield* Path.Path
		const cwd = path.resolve('.')
		const startedAt = yield* Clock.currentTimeMillis

		const failures = yield* Effect.forEach(
			document.patdownRules,
			(rule) => lintPatdownRule(rule, cwd, verbose, yesThreshold),
			{ concurrency: 1 },
		)

		const finishedAt = yield* Clock.currentTimeMillis

		return {
			failed: failures.some((failed) => failed),
			elapsedMs: Math.max(0, finishedAt - startedAt),
		}
	})
}
