import type { PatdownRulesDocument } from '@patdown/rules'
import { defaultPatdownYesThreshold, type PatdownYesThreshold } from '@patdown/rules'
import { Console, Context, Effect, Layer, Ref } from 'effect'

import {
	formatPatdownLintResultLine,
	formatPatdownRuleBlock,
} from '#src/patdown-console-rule-blocks'
import { patdownJudgmentIsYes, type PatdownJudgment } from '#src/patdown-judge'
import { formatPatdownProbabilityBar } from '#src/patdown-probability-bar'

/** Optional 1-based span from a FAIL-only evidence Choice. */
export type PatdownLintEvidenceSpan = {
	readonly startLine: number
	readonly endLine: number
	readonly confidence: number
}

/** One file/rule result; probability estimates a violation, not correctness of the verdict. */
export type PatdownLintResult = {
	readonly violated: boolean
	readonly ruleTitle: string
	readonly ruleBody: string
	readonly ruleGlobs: ReadonlyArray<string>
	readonly filePath: string
	readonly violationProbability: number
	readonly yesThreshold: PatdownYesThreshold
	readonly elapsedMs: number
	readonly evidence?: PatdownLintEvidenceSpan
}

type PatdownConsoleLintBuffer = {
	readonly ruleTitle: string | null
	readonly results: ReadonlyArray<PatdownLintResult>
}

function formatPatdownElapsedMs(elapsedMs: number): string {
	return `${String(elapsedMs)}ms`
}

function formatPatdownProbability(
	probability: number,
	yesThreshold: PatdownYesThreshold,
	elapsedMs: number,
): string {
	return `${formatPatdownProbabilityBar(probability)} estimated P(yes): ${String(probability)}; cutoff: >${String(yesThreshold)}; elapsed: ${formatPatdownElapsedMs(elapsedMs)}`
}

function formatPatdownAnswer(
	judgment: PatdownJudgment,
	verbose: boolean,
	yesThreshold: PatdownYesThreshold,
	elapsedMs: number,
): string {
	const answer = patdownJudgmentIsYes(judgment, yesThreshold) ? 'yes' : 'no'

	return verbose
		? `${answer} (${formatPatdownProbability(judgment.yesProbability, yesThreshold, elapsedMs)})`
		: answer
}

function formatPatdownRulesDocument(document: PatdownRulesDocument): string {
	const lines = [
		`patdown: ${String(document.patdownRules.length)} rules from ${document.patdownRulesFilePath}`,
	]

	for (const rule of document.patdownRules) {
		lines.push('')
		lines.push(rule.patdownRuleTitle)
		lines.push(
			`globs: ${rule.patdownRuleGlobs.length === 0 ? '*' : rule.patdownRuleGlobs.join(' ')}`,
		)

		if (rule.patdownRuleYesThreshold !== undefined) {
			lines.push(`yes-threshold: ${String(rule.patdownRuleYesThreshold)}`)
		}
	}

	return lines.join('\n')
}

/** Writers used by the PatdownOutput service. */
export type PatdownOutputWriters = {
	readonly writeLintFailed: (elapsedMs?: number) => Effect.Effect<void>
	readonly writeLintOk: (elapsedMs?: number) => Effect.Effect<void>
	readonly writeLintResult: (result: PatdownLintResult, verbose: boolean) => Effect.Effect<void>
	readonly writeNoFilesMatched: (ruleTitle: string) => Effect.Effect<void>
	readonly writeAnswer: (
		judgment: PatdownJudgment,
		verbose: boolean,
		yesThreshold?: PatdownYesThreshold,
		elapsedMs?: number,
	) => Effect.Effect<void>
	readonly writeRulesDocument: (document: PatdownRulesDocument) => Effect.Effect<void>
}

/** Swappable output service. Probability details are opt-in. */
export class PatdownOutput extends Context.Service<PatdownOutput, PatdownOutputWriters>()(
	'@patdown/cli/PatdownOutput',
) {}

function flushPatdownConsoleRuleBlock(buffer: PatdownConsoleLintBuffer): Effect.Effect<void> {
	if (buffer.ruleTitle === null) return Effect.void

	return Console.log(formatPatdownRuleBlock(buffer.ruleTitle, buffer.results))
}

/** One-line writers shared with GitHub Actions job logs. */
export const patdownStreamingHumanOutput: PatdownOutputWriters = {
	writeLintFailed: (elapsedMs?: number): Effect.Effect<void> =>
		Console.log(
			elapsedMs === undefined
				? 'patdown: failed'
				: `patdown: failed (elapsed: ${formatPatdownElapsedMs(elapsedMs)})`,
		),
	writeLintOk: (elapsedMs?: number): Effect.Effect<void> =>
		Console.log(
			elapsedMs === undefined
				? 'patdown: passed'
				: `patdown: passed (elapsed: ${formatPatdownElapsedMs(elapsedMs)})`,
		),
	writeLintResult: (result: PatdownLintResult, verbose: boolean): Effect.Effect<void> =>
		Console.log(
			verbose
				? `${formatPatdownLintResultLine(result)} (${formatPatdownProbability(result.violationProbability, result.yesThreshold, result.elapsedMs)})`
				: formatPatdownLintResultLine(result),
		),
	writeNoFilesMatched: (title: string): Effect.Effect<void> =>
		Console.log(`patdown: no files matched ${title}`),
	writeAnswer: (
		judgment: PatdownJudgment,
		verbose: boolean,
		yesThreshold: PatdownYesThreshold = defaultPatdownYesThreshold,
		elapsedMs: number = 0,
	): Effect.Effect<void> =>
		Console.log(formatPatdownAnswer(judgment, verbose, yesThreshold, elapsedMs)),
	writeRulesDocument: (document: PatdownRulesDocument): Effect.Effect<void> =>
		Console.log(formatPatdownRulesDocument(document)),
}

/**
 * Local human output. Quiet mode streams one PASS/FAIL line per judgment. Verbose mode groups
 * judgments into per-rule console blocks.
 */
export const PatdownOutputLive: Layer.Layer<PatdownOutput> = Layer.effect(
	PatdownOutput,
	Effect.gen(function* () {
		const buffer = yield* Ref.make<PatdownConsoleLintBuffer>({
			ruleTitle: null,
			results: [],
		})

		const flush = (): Effect.Effect<void> =>
			Effect.gen(function* () {
				const current = yield* Ref.get(buffer)

				yield* flushPatdownConsoleRuleBlock(current)
				yield* Ref.set(buffer, { ruleTitle: null, results: [] })
			})

		const writers: PatdownOutputWriters = {
			writeAnswer: patdownStreamingHumanOutput.writeAnswer,
			writeRulesDocument: patdownStreamingHumanOutput.writeRulesDocument,
			writeLintResult: (result, verbose) => {
				if (!verbose) {
					return patdownStreamingHumanOutput.writeLintResult(result, false)
				}

				return Effect.gen(function* () {
					const current = yield* Ref.get(buffer)

					if (current.ruleTitle !== null && current.ruleTitle !== result.ruleTitle) {
						yield* flushPatdownConsoleRuleBlock(current)
						yield* Ref.set(buffer, {
							ruleTitle: result.ruleTitle,
							results: [result],
						})

						return
					}

					yield* Ref.set(buffer, {
						ruleTitle: result.ruleTitle,
						results: [...current.results, result],
					})
				})
			},
			writeNoFilesMatched: (title) =>
				Effect.gen(function* () {
					yield* flush()
					yield* Console.log(formatPatdownRuleBlock(title, []))
				}),
			writeLintOk: (elapsedMs) =>
				Effect.gen(function* () {
					yield* flush()
					yield* patdownStreamingHumanOutput.writeLintOk(elapsedMs)
				}),
			writeLintFailed: (elapsedMs) =>
				Effect.gen(function* () {
					yield* flush()
					yield* patdownStreamingHumanOutput.writeLintFailed(elapsedMs)
				}),
		}

		return writers
	}),
)

/** @deprecated Use patdownStreamingHumanOutput for one-line logs. */
export const patdownHumanOutput = patdownStreamingHumanOutput
