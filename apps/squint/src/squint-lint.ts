import { JevRequestFailed, JevSystemOne, jevNoulIsYes } from '@squint/jev'
import type { SquintRule, SquintRulesDocument } from '@squint/rules'
import { Effect, FileSystem, Path } from 'effect'
import type { HttpClient } from 'effect/unstable/http'

import { SquintOutput } from '#/squint-output'

const squintGlobExcludes = [
	'**/.git/**',
	'**/.turbo/**',
	'**/coverage/**',
	'**/dist/**',
	'**/node_modules/**',
] as const

function squintGlobPatterns(globs: ReadonlyArray<string>): ReadonlyArray<string> {
	return globs.length === 0 ? ['**/*'] : globs
}

function squintViolationInstructions(rule: SquintRule): string {
	return [
		'Does this file violate the following squint rule? Answer yes only if there is a clear violation.',
		'',
		`# ${rule.squintRuleTitle}`,
		'',
		rule.squintRuleBody,
	].join('\n')
}

function squintFileState(relativePath: string, contents: string): string {
	return `path: ${relativePath}\n\n${contents}`
}

function globSquintRuleFiles(
	cwd: string,
	globs: ReadonlyArray<string>,
): Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem
		const patterns = squintGlobPatterns(globs)
		const matches: string[] = []

		for (const pattern of patterns) {
			const found = yield* fileSystem
				.glob(pattern, {
					exclude: squintGlobExcludes,
					root: cwd,
				})
				.pipe(Effect.orElseSucceed((): string[] => []))

			matches.push(...found)
		}

		return [...new Set(matches)].toSorted()
	})
}

function lintSquintRuleFile(
	rule: SquintRule,
	cwd: string,
	filePath: string,
): Effect.Effect<
	boolean,
	JevRequestFailed,
	FileSystem.FileSystem | HttpClient.HttpClient | JevSystemOne | Path.Path | SquintOutput
> {
	return Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem
		const path = yield* Path.Path
		const jev = yield* JevSystemOne
		const output = yield* SquintOutput
		const relativePath = path.relative(cwd, filePath)

		const contents = yield* fileSystem.readFileString(filePath).pipe(
			Effect.mapError(
				() =>
					new JevRequestFailed({
						message: `squint: failed to read ${relativePath}`,
					}),
			),
		)

		const answer = yield* jev.askNoul(
			squintViolationInstructions(rule),
			squintFileState(relativePath, contents),
		)

		const failed = jevNoulIsYes(answer.noul)

		yield* output.writeLintLine(failed, rule.squintRuleTitle, relativePath, answer.noul)

		return failed
	})
}

function lintSquintRule(
	rule: SquintRule,
	cwd: string,
): Effect.Effect<
	boolean,
	JevRequestFailed,
	FileSystem.FileSystem | HttpClient.HttpClient | JevSystemOne | Path.Path | SquintOutput
> {
	return Effect.gen(function* () {
		const output = yield* SquintOutput
		const files = yield* globSquintRuleFiles(cwd, rule.squintRuleGlobs)

		if (files.length === 0) {
			yield* output.writeNoFilesMatched(rule.squintRuleTitle)

			return false
		}

		const failures = yield* Effect.forEach(
			files,
			(filePath) => lintSquintRuleFile(rule, cwd, filePath),
			{ concurrency: 1 },
		)

		return failures.some((failed) => failed)
	})
}

/** Lint files matched by each rule's globs. Yes on the noul means a violation. */
export function runSquintLint(
	document: SquintRulesDocument,
): Effect.Effect<
	boolean,
	JevRequestFailed,
	FileSystem.FileSystem | HttpClient.HttpClient | JevSystemOne | Path.Path | SquintOutput
> {
	return Effect.gen(function* () {
		const path = yield* Path.Path
		const cwd = path.resolve('.')

		const failures = yield* Effect.forEach(
			document.squintRules,
			(rule) => lintSquintRule(rule, cwd),
			{ concurrency: 1 },
		)

		return failures.some((failed) => failed)
	})
}
