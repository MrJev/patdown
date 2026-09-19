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

function formatPatdownRuleBlockRow(
	result: PatdownLintResult,
	pathWidth: number,
	timeWidth: number,
): string {
	const mark = result.violated ? '✗' : '·'
	const path = result.filePath.padEnd(pathWidth, ' ')
	const bar = formatPatdownProbabilityBar(result.violationProbability)
	const score = result.violationProbability.toFixed(2).padStart(4, ' ')
	const time = formatPatdownConsoleElapsed(result.elapsedMs).padStart(timeWidth, ' ')

	return `│  ${mark} ${path}  ${bar}  ${score}  ${time}`
}

/** Quiet one-line lint result. */
export function formatPatdownLintResultLine(result: PatdownLintResult): string {
	const verdict = result.violated ? 'FAIL' : 'PASS'

	return `${verdict} ${result.filePath}: ${result.ruleTitle}`
}

/**
 * Verbose local console: one box per rule, only files that were judged. Empty results mean the rule
 * matched no files. Paths, bars, scores, and times share columns within a block.
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
		const pathWidth = Math.max(...results.map((result) => result.filePath.length))

		const timeWidth = Math.max(
			...results.map((result) => formatPatdownConsoleElapsed(result.elapsedMs).length),
		)

		for (const result of results) {
			lines.push(formatPatdownRuleBlockRow(result, pathWidth, timeWidth))
		}
	}

	lines.push('└')

	return lines.join('\n')
}
