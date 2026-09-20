import type { PatdownLintResult } from 'patdown'
import { formatPatdownRuleGuidance } from 'patdown'

import type { PatdownPiMode } from '#src/patdown-pi-policy'

/** Failures first, then hottest P(yes). */
export function patdownSteerFailures(
	results: ReadonlyArray<PatdownLintResult>,
): ReadonlyArray<PatdownLintResult> {
	return results
		.filter((result) => result.violated)
		.toSorted((left, right) => right.violationProbability - left.violationProbability)
}

function formatPatdownSteerFailure(result: PatdownLintResult): string {
	return [
		formatPatdownRuleGuidance(result),
		'',
		`P(yes) ${String(result.violationProbability)} exceeds cutoff >${String(result.yesThreshold)}`,
	].join('\n')
}

function patdownSteerVerb(mode: PatdownPiMode): string {
	return mode === 'block' ? 'blocked' : 'flagged'
}

/** Message the agent or UI sees. Quotes the broken rule; does not fail closed as a pass. */
export function formatPatdownSteerReason(
	relativePath: string,
	failures: ReadonlyArray<PatdownLintResult>,
	mode: PatdownPiMode = 'block',
): string {
	const details = failures.map(formatPatdownSteerFailure).join('\n\n')

	return [`patdown ${patdownSteerVerb(mode)} write to ${relativePath}`, '', details].join('\n')
}
