import type { PatdownRulesDocument } from '@patdown/rules'
import { defaultPatdownYesThreshold, type PatdownYesThreshold } from '@patdown/rules'
import { Console, Context, Effect, Layer } from 'effect'

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

function formatPatdownLintResult(result: PatdownLintResult, verbose: boolean): string {
	const verdict = result.violated ? 'FAIL' : 'PASS'
	const line = `${verdict} ${result.filePath}: ${result.ruleTitle}`

	return verbose
		? `${line} (${formatPatdownProbability(result.violationProbability, result.yesThreshold, result.elapsedMs)})`
		: line
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

/** Default human-readable writers, without provider-specific vocabulary. */
export const patdownHumanOutput: PatdownOutputWriters = {
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
		Console.log(formatPatdownLintResult(result, verbose)),
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

/** Default human-readable output layer. */
export const PatdownOutputLive = Layer.succeed(PatdownOutput, patdownHumanOutput)
