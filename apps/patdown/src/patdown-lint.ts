import type { PatdownRule, PatdownRulesDocument } from '@patdown/rules'
import { Effect, FileSystem, Path } from 'effect'

import {
	PatdownJudge,
	PatdownJudgeFailed,
	askPatdownJudge,
	patdownJudgmentIsYes,
} from '#src/patdown-judge'
import { PatdownOutput } from '#src/patdown-output'

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
	cwd: string,
	filePath: string,
	verbose: boolean,
): Effect.Effect<
	boolean,
	PatdownJudgeFailed,
	FileSystem.FileSystem | PatdownJudge | Path.Path | PatdownOutput
> {
	return Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem
		const path = yield* Path.Path
		const output = yield* PatdownOutput
		const relativePath = path.relative(cwd, filePath)

		const contents = yield* fileSystem.readFileString(filePath).pipe(
			Effect.mapError(
				() =>
					new PatdownJudgeFailed({
						message: `patdown: failed to read ${relativePath}`,
					}),
			),
		)

		const answer = yield* askPatdownJudge(
			patdownViolationInstructions(rule),
			patdownFileState(relativePath, contents),
		)

		const failed = patdownJudgmentIsYes(answer)

		yield* output.writeLintResult(
			{
				violated: failed,
				ruleTitle: rule.patdownRuleTitle,
				filePath: relativePath,
				violationProbability: answer.yesProbability,
			},
			verbose,
		)

		return failed
	})
}

function lintPatdownRule(
	rule: PatdownRule,
	cwd: string,
	verbose: boolean,
): Effect.Effect<
	boolean,
	PatdownJudgeFailed,
	FileSystem.FileSystem | PatdownJudge | Path.Path | PatdownOutput
> {
	return Effect.gen(function* () {
		const output = yield* PatdownOutput
		const files = yield* globPatdownRuleFiles(cwd, rule.patdownRuleGlobs)

		if (files.length === 0) {
			yield* output.writeNoFilesMatched(rule.patdownRuleTitle)

			return false
		}

		const failures = yield* Effect.forEach(
			files,
			(filePath) => lintPatdownRuleFile(rule, cwd, filePath, verbose),
			{ concurrency: 1 },
		)

		return failures.some((failed) => failed)
	})
}

/** Lint files matched by each rule's globs. A yes judgment means a violation. */
export function runPatdownLint(
	document: PatdownRulesDocument,
	verbose: boolean = false,
): Effect.Effect<
	boolean,
	PatdownJudgeFailed,
	FileSystem.FileSystem | PatdownJudge | Path.Path | PatdownOutput
> {
	return Effect.gen(function* () {
		const path = yield* Path.Path
		const cwd = path.resolve('.')

		const failures = yield* Effect.forEach(
			document.patdownRules,
			(rule) => lintPatdownRule(rule, cwd, verbose),
			{ concurrency: 1 },
		)

		return failures.some((failed) => failed)
	})
}
