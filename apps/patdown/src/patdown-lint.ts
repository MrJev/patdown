import { isAbsolute, resolve } from 'node:path'

import {
	defaultPatdownYesThreshold,
	PatdownYesThresholdInvalid,
	type PatdownRule,
	type PatdownRulesDocument,
	type PatdownYesThreshold,
} from '@patdown/rules'
import { Clock, Effect, FileSystem, Option, Path, Ref } from 'effect'

import {
	formatPatdownEvidenceChoiceState,
	patdownEvidenceChoiceCriteria,
	patdownEvidenceChoiceInstructions,
	splitPatdownEvidenceCandidates,
} from '#src/patdown-evidence-regions'
import { judgePatdownFileContents } from '#src/patdown-file-judgment'
import { patdownGlobExcludes, patdownGlobPatterns } from '#src/patdown-glob'
import { PatdownJudge, PatdownJudgeFailed, locatePatdownEvidence } from '#src/patdown-judge'
import {
	countPlannedPatdownJudgments,
	formatPatdownJudgmentBudgetExceeded,
	PatdownJudgmentBudgetExceeded,
	type PatdownJudgmentBudget,
} from '#src/patdown-judgment-budget'
import { selectPatdownRuleFiles, type PatdownLintFileSelection } from '#src/patdown-lint-files'
import { PatdownOutput, type PatdownLintEvidenceSpan } from '#src/patdown-output'
import { decodePatdownRuleYesThreshold } from '#src/patdown-yes-threshold-config'

/** File contents read once per run and reused by every rule that matches the same file. */
type PatdownFileContentsCache = Ref.Ref<ReadonlyMap<string, string>>

/** Glob rule targets and keep files only. Effect FileSystem.glob also returns directories. */
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

			for (const match of found) {
				const absolutePath = isAbsolute(match) ? match : resolve(cwd, match)
				const info = yield* fileSystem.stat(absolutePath).pipe(Effect.option)

				if (Option.isNone(info) || info.value.type !== 'File') continue

				matches.push(absolutePath)
			}
		}

		return [...new Set(matches)].toSorted()
	})
}

/**
 * Read a file at most once per run. A file matched by several rules was read once per rule, so a
 * tree linted against a pack of rules paid for the same bytes as many times as it had rules.
 */
function readPatdownFileContents(
	cache: PatdownFileContentsCache,
	filePath: string,
	relativePath: string,
): Effect.Effect<string, PatdownJudgeFailed, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const cached = (yield* Ref.get(cache)).get(filePath)

		if (cached !== undefined) return cached

		const fileSystem = yield* FileSystem.FileSystem

		const contents = yield* fileSystem.readFileString(filePath).pipe(
			Effect.mapError(
				() =>
					new PatdownJudgeFailed({
						message: `patdown: failed to read ${relativePath}`,
					}),
			),
		)

		yield* Ref.update(cache, (entries) => new Map(entries).set(filePath, contents))

		return contents
	})
}

function lintPatdownRuleFile(
	rule: PatdownRule,
	filePath: string,
	options: {
		readonly cwd: string
		readonly verbose: boolean
		readonly yesThreshold: PatdownYesThreshold
		readonly cache: PatdownFileContentsCache
	},
): Effect.Effect<
	boolean,
	PatdownJudgeFailed,
	FileSystem.FileSystem | PatdownJudge | Path.Path | PatdownOutput
> {
	return Effect.gen(function* () {
		const path = yield* Path.Path
		const output = yield* PatdownOutput
		const relativePath = path.relative(options.cwd, filePath)

		const contents = yield* readPatdownFileContents(options.cache, filePath, relativePath)

		const judged = yield* judgePatdownFileContents(
			rule,
			relativePath,
			contents,
			options.yesThreshold,
		)

		let evidence: PatdownLintEvidenceSpan | undefined
		let elapsedMs = judged.elapsedMs

		if (judged.violated) {
			const evidenceStartedAt = yield* Clock.currentTimeMillis
			const candidates = splitPatdownEvidenceCandidates(contents)

			const candidatesById = new Map(
				candidates.map((candidate) => [
					candidate.id,
					{ startLine: candidate.startLine, endLine: candidate.endLine },
				]),
			)

			const located = yield* locatePatdownEvidence(
				patdownEvidenceChoiceInstructions(),
				formatPatdownEvidenceChoiceState({
					relativePath,
					ruleTitle: rule.patdownRuleTitle,
					ruleBody: rule.patdownRuleBody,
					violationProbability: judged.violationProbability,
					contents,
					candidates,
				}),
				patdownEvidenceChoiceCriteria(candidates),
				candidatesById,
			).pipe(Effect.catchTag('PatdownJudgeFailed', () => Effect.succeed(null)))

			const evidenceFinishedAt = yield* Clock.currentTimeMillis

			elapsedMs += Math.max(0, evidenceFinishedAt - evidenceStartedAt)

			if (located !== null) {
				evidence = {
					startLine: located.startLine,
					endLine: located.endLine,
					confidence: located.confidence,
				}
			}
		}

		const lintResult = { ...judged, elapsedMs }

		yield* output.writeLintResult(
			evidence === undefined ? lintResult : { ...lintResult, evidence },
			options.verbose,
		)

		return judged.violated
	})
}

type PatdownRulePlanOptions = {
	readonly cwd: string
	readonly defaultYesThreshold: PatdownYesThreshold
	readonly selection: PatdownLintFileSelection | null
}

/** One rule's resolved work: which files it will judge, and the cutoff it will judge them at. */
type PatdownRulePlan = {
	readonly rule: PatdownRule
	readonly files: ReadonlyArray<string>
	readonly yesThreshold: PatdownYesThreshold
}

/**
 * Resolve a rule's files and cutoff without calling the judge. Globbing every rule up front is what
 * makes the judgment count knowable before the run spends anything, and it moves an invalid
 * per-rule `yes-threshold:` to the same place.
 */
function planPatdownRule(
	rule: PatdownRule,
	options: PatdownRulePlanOptions,
): Effect.Effect<PatdownRulePlan, PatdownYesThresholdInvalid, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const files = selectPatdownRuleFiles(
			options.cwd,
			options.selection,
			rule.patdownRuleGlobs,
			options.selection === null
				? yield* globPatdownRuleFiles(options.cwd, rule.patdownRuleGlobs)
				: [],
		)

		const yesThreshold =
			rule.patdownRuleYesThreshold === undefined
				? options.defaultYesThreshold
				: yield* decodePatdownRuleYesThreshold(rule.patdownRuleYesThreshold, rule.patdownRuleTitle)

		return { rule, files, yesThreshold }
	})
}

function lintPatdownRulePlan(
	plan: PatdownRulePlan,
	options: {
		readonly cwd: string
		readonly verbose: boolean
		readonly selection: PatdownLintFileSelection | null
		readonly cache: PatdownFileContentsCache
	},
): Effect.Effect<
	boolean,
	PatdownJudgeFailed,
	FileSystem.FileSystem | PatdownJudge | Path.Path | PatdownOutput
> {
	return Effect.gen(function* () {
		const output = yield* PatdownOutput

		if (plan.files.length === 0) {
			if (options.selection === null) {
				yield* output.writeNoFilesMatched(plan.rule.patdownRuleTitle)
			}

			return false
		}

		yield* output.writeLintRuleStart(plan.rule.patdownRuleTitle, plan.files.length, options.verbose)

		const failures = yield* Effect.forEach(
			plan.files,
			(filePath) =>
				lintPatdownRuleFile(plan.rule, filePath, {
					cwd: options.cwd,
					verbose: options.verbose,
					yesThreshold: plan.yesThreshold,
					cache: options.cache,
				}),
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
	scope: {
		readonly selection?: PatdownLintFileSelection | null
		readonly judgmentBudget?: PatdownJudgmentBudget
	} = {},
): Effect.Effect<
	{ readonly failed: boolean; readonly elapsedMs: number },
	PatdownJudgeFailed | PatdownYesThresholdInvalid | PatdownJudgmentBudgetExceeded,
	FileSystem.FileSystem | PatdownJudge | Path.Path | PatdownOutput
> {
	return Effect.gen(function* () {
		const path = yield* Path.Path
		const output = yield* PatdownOutput
		const cwd = path.resolve('.')
		const startedAt = yield* Clock.currentTimeMillis
		const selection = scope.selection ?? null
		const judgmentBudget = scope.judgmentBudget ?? null

		yield* output.writeLintStart(
			document.patdownRules.length,
			selection === null ? null : selection.relativePaths.length,
		)

		const plans = yield* Effect.forEach(
			document.patdownRules,
			(rule) =>
				planPatdownRule(rule, {
					cwd,
					defaultYesThreshold: yesThreshold,
					selection,
				}),
			{ concurrency: 1 },
		)

		if (judgmentBudget !== null) {
			const planned = countPlannedPatdownJudgments(plans.map((plan) => plan.files.length))

			if (planned > judgmentBudget) {
				return yield* new PatdownJudgmentBudgetExceeded({
					message: formatPatdownJudgmentBudgetExceeded(planned, judgmentBudget),
				})
			}
		}

		const cache: PatdownFileContentsCache = yield* Ref.make<ReadonlyMap<string, string>>(new Map())

		const failures = yield* Effect.forEach(
			plans,
			(plan) => lintPatdownRulePlan(plan, { cwd, verbose, selection, cache }),
			{ concurrency: 1 },
		)

		const finishedAt = yield* Clock.currentTimeMillis

		return {
			failed: failures.some((failed) => failed),
			elapsedMs: Math.max(0, finishedAt - startedAt),
		}
	})
}
