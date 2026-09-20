import type { PatdownRulesDocument } from '@patdown/rules'
import { defaultPatdownYesThreshold, type PatdownYesThreshold } from '@patdown/rules'
import { Console, Context, Effect, Layer, Ref } from 'effect'

import {
	formatPatdownLintResultLine,
	formatPatdownRuleBlock,
	formatPatdownRuleBlockClose,
	formatPatdownRuleBlockOpen,
	formatPatdownRuleBlockStreamChunk,
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

type PatdownConsoleLintStream = {
	readonly ruleTitle: string | null
	readonly directory: string | null
	readonly failCount: number
	readonly judgedCount: number
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

		if (rule.patdownRuleSourcePath !== undefined) {
			lines.push(`from: ${rule.patdownRuleSourcePath}`)
		}

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
	readonly writeLintRuleStart: (
		ruleTitle: string,
		plannedFileCount: number,
		verbose: boolean,
	) => Effect.Effect<void>
	readonly writeLintStart: (
		ruleCount: number,
		selectionFileCount: number | null,
	) => Effect.Effect<void>
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

function formatPatdownCountNoun(count: number, singular: string, plural: string): string {
	return `${String(count)} ${count === 1 ? singular : plural}`
}

/** First line before any judgments, so a long run does not look hung. */
export function formatPatdownLintStartLine(
	ruleCount: number,
	selectionFileCount: number | null,
): string {
	const rules = formatPatdownCountNoun(ruleCount, 'rule', 'rules')

	if (selectionFileCount === null) {
		return `patdown: linting against ${rules}`
	}

	const files = formatPatdownCountNoun(selectionFileCount, 'file', 'files')

	return `patdown: linting ${files} against ${rules}`
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
	writeLintRuleStart: (_ruleTitle, _plannedFileCount, _verbose): Effect.Effect<void> => Effect.void,
	writeLintStart: (ruleCount, selectionFileCount): Effect.Effect<void> =>
		Console.log(formatPatdownLintStartLine(ruleCount, selectionFileCount)),
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
 * Local human output. Quiet mode streams one PASS/FAIL line per judgment. Verbose mode opens a rule
 * box, streams rows as judgments finish, then closes with the fail tally.
 */
export const PatdownOutputLive: Layer.Layer<PatdownOutput> = Layer.effect(
	PatdownOutput,
	Effect.gen(function* () {
		const stream = yield* Ref.make<PatdownConsoleLintStream>({
			ruleTitle: null,
			directory: null,
			failCount: 0,
			judgedCount: 0,
		})

		const closeOpenRule = (): Effect.Effect<void> =>
			Effect.gen(function* () {
				const current = yield* Ref.get(stream)

				if (current.ruleTitle === null) return

				yield* Console.log(formatPatdownRuleBlockClose(current.failCount, current.judgedCount))
				yield* Ref.set(stream, {
					ruleTitle: null,
					directory: null,
					failCount: 0,
					judgedCount: 0,
				})
			})

		const writers: PatdownOutputWriters = {
			writeAnswer: patdownStreamingHumanOutput.writeAnswer,
			writeRulesDocument: patdownStreamingHumanOutput.writeRulesDocument,
			writeLintStart: patdownStreamingHumanOutput.writeLintStart,
			writeLintRuleStart: (ruleTitle, plannedFileCount, verbose) => {
				if (!verbose) return Effect.void

				return Effect.gen(function* () {
					yield* closeOpenRule()
					yield* Console.log(formatPatdownRuleBlockOpen(ruleTitle, plannedFileCount))
					yield* Ref.set(stream, {
						ruleTitle,
						directory: null,
						failCount: 0,
						judgedCount: 0,
					})
				})
			},
			writeLintResult: (result, verbose) => {
				if (!verbose) {
					return patdownStreamingHumanOutput.writeLintResult(result, false)
				}

				return Effect.gen(function* () {
					const current = yield* Ref.get(stream)

					if (current.ruleTitle === null) {
						yield* Console.log(formatPatdownRuleBlockOpen(result.ruleTitle, 1))
					} else if (current.ruleTitle !== result.ruleTitle) {
						yield* closeOpenRule()
						yield* Console.log(formatPatdownRuleBlockOpen(result.ruleTitle, 1))
					}

					const open = yield* Ref.get(stream)
					const previousDirectory = open.ruleTitle === result.ruleTitle ? open.directory : null
					const chunk = formatPatdownRuleBlockStreamChunk(result, previousDirectory)

					yield* Console.log(chunk.text)
					yield* Ref.set(stream, {
						ruleTitle: result.ruleTitle,
						directory: chunk.directory,
						failCount:
							(open.ruleTitle === result.ruleTitle ? open.failCount : 0) +
							(result.violated ? 1 : 0),
						judgedCount: (open.ruleTitle === result.ruleTitle ? open.judgedCount : 0) + 1,
					})
				})
			},
			writeNoFilesMatched: (title) =>
				Effect.gen(function* () {
					yield* closeOpenRule()
					yield* Console.log(formatPatdownRuleBlock(title, []))
				}),
			writeLintOk: (elapsedMs) =>
				Effect.gen(function* () {
					const current = yield* Ref.get(stream)
					const hadVerboseBlock = current.ruleTitle !== null

					yield* closeOpenRule()

					if (hadVerboseBlock) {
						yield* Console.log('')
					}

					yield* patdownStreamingHumanOutput.writeLintOk(elapsedMs)
				}),
			writeLintFailed: (elapsedMs) =>
				Effect.gen(function* () {
					const current = yield* Ref.get(stream)
					const hadVerboseBlock = current.ruleTitle !== null

					yield* closeOpenRule()

					if (hadVerboseBlock) {
						yield* Console.log('')
					}

					yield* patdownStreamingHumanOutput.writeLintFailed(elapsedMs)
				}),
		}

		return writers
	}),
)

/** @deprecated Use patdownStreamingHumanOutput for one-line logs. */
export const patdownHumanOutput = patdownStreamingHumanOutput
