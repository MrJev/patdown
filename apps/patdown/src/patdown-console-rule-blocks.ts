import type { PatdownLintResult } from '#src/patdown-output'
import { formatPatdownProbabilityBar } from '#src/patdown-probability-bar'

const patdownRuleBlockWidth = 64

/** Soft cap so extreme paths do not dominate the line; prefer the right-hand segments. */
export const patdownConsolePathMaxWidth = 48

function formatPatdownConsoleElapsed(elapsedMs: number): string {
	return `${String(elapsedMs)}ms`
}

function padPatdownRuleBlockTitle(title: string, failCount: number, judgedCount: number): string {
	const suffix = ` ${String(failCount)}✗ / ${String(judgedCount)}`
	const prefix = `┌ ${title} `
	const fill = Math.max(2, patdownRuleBlockWidth - prefix.length - suffix.length)

	return `${prefix}${'─'.repeat(fill)}${suffix}`
}

/** Keep the basename side of long paths: `…/src/patdown-github-actions-summary.ts`. */
export function formatPatdownConsolePath(
	filePath: string,
	maxWidth: number = patdownConsolePathMaxWidth,
): string {
	if (filePath.length <= maxWidth) return filePath

	const ellipsis = '…'
	const keep = Math.max(1, maxWidth - ellipsis.length)
	const tail = filePath.slice(-keep)
	const slash = tail.indexOf('/')

	if (slash > 0 && slash < tail.length - 1) {
		return `${ellipsis}${tail.slice(slash)}`
	}

	return `${ellipsis}${tail}`
}

function formatPatdownRuleBlockRow(
	result: PatdownLintResult,
	timeWidth: number,
	pathWidth: number,
): string {
	const mark = result.violated ? '✗' : '·'
	const bar = formatPatdownProbabilityBar(result.violationProbability)
	const score = result.violationProbability.toFixed(2).padStart(4, ' ')
	const time = formatPatdownConsoleElapsed(result.elapsedMs).padStart(timeWidth, ' ')
	const path = formatPatdownConsolePath(result.filePath).padEnd(pathWidth, ' ')

	// Fixed columns first so long paths cannot shove the bar/score/time around.
	return `│  ${mark}  ${bar}  ${score}  ${time}  ${path}`.trimEnd()
}

/** Quiet one-line lint result. */
export function formatPatdownLintResultLine(result: PatdownLintResult): string {
	const verdict = result.violated ? 'FAIL' : 'PASS'

	return `${verdict} ${result.filePath}: ${result.ruleTitle}`
}

/**
 * Verbose local console: one box per rule, only files that were judged. Empty results mean the rule
 * matched no files. Mark, bar, score, and time share fixed columns; path comes last.
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
		const displayPaths = results.map((result) => formatPatdownConsolePath(result.filePath))
		const pathWidth = Math.max(...displayPaths.map((path) => path.length))

		const timeWidth = Math.max(
			...results.map((result) => formatPatdownConsoleElapsed(result.elapsedMs).length),
		)

		for (const result of results) {
			lines.push(formatPatdownRuleBlockRow(result, timeWidth, pathWidth))
		}
	}

	lines.push('└')

	return lines.join('\n')
}
