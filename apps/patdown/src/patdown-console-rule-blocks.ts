import type { PatdownLintResult } from '#src/patdown-output'
import { formatPatdownProbabilityBar } from '#src/patdown-probability-bar'

const patdownRuleBlockWidth = 64

function formatPatdownConsoleElapsed(elapsedMs: number): string {
	return `${String(elapsedMs)}ms`
}

function padPatdownRuleBlockTitle(title: string, failCount: number, judgedCount: number): string {
	const suffix = ` ${String(failCount)}✗ / ${String(judgedCount)}`
	const prefix = `┌ ${title} `
	const fill = Math.max(2, patdownRuleBlockWidth - prefix.length - suffix.length)

	return `${prefix}${'─'.repeat(fill)}${suffix}`
}

function formatPatdownRuleBlockRow(result: PatdownLintResult): string {
	const mark = result.violated ? '✗' : '·'
	const bar = formatPatdownProbabilityBar(result.violationProbability)
	const score = result.violationProbability.toFixed(2)
	const time = formatPatdownConsoleElapsed(result.elapsedMs)

	return `│  ${mark} ${result.filePath}  ${bar} ${score}  ${time}`
}

/** Quiet one-line lint result. */
export function formatPatdownLintResultLine(result: PatdownLintResult): string {
	const verdict = result.violated ? 'FAIL' : 'PASS'

	return `${verdict} ${result.filePath}: ${result.ruleTitle}`
}

/**
 * Verbose local console: one box per rule, only files that were judged. Empty results mean the rule
 * matched no files.
 */
export function formatPatdownRuleBlock(
	ruleTitle: string,
	results: ReadonlyArray<PatdownLintResult>,
): string {
	const failCount = results.filter((result) => result.violated).length
	const lines = [padPatdownRuleBlockTitle(ruleTitle, failCount, results.length)]

	if (results.length === 0) {
		lines.push('│  (no files matched)')
	} else {
		for (const result of results) {
			lines.push(formatPatdownRuleBlockRow(result))
		}
	}

	lines.push('└')

	return lines.join('\n')
}
