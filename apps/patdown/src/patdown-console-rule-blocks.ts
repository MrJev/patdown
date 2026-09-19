import { dirname, basename } from 'node:path'

import type { PatdownLintResult } from '#src/patdown-output'
import { formatPatdownProbabilityBar } from '#src/patdown-probability-bar'

const patdownRuleBlockWidth = 64

/** Soft cap so extreme directory labels do not dominate the header line. */
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

function patdownConsoleDirectoryLabel(filePath: string): string {
	const directory = dirname(filePath)

	return directory === '.' ? '.' : directory
}

function formatPatdownDirectoryHeader(directory: string): string {
	return `├─ ${formatPatdownConsolePath(directory)}`
}

function formatPatdownRuleBlockRow(
	result: PatdownLintResult,
	timeWidth: number,
	nameWidth: number,
): string {
	const mark = result.violated ? '✗' : '✓'
	const bar = formatPatdownProbabilityBar(result.violationProbability)
	const score = result.violationProbability.toFixed(2).padStart(4, ' ')
	const time = formatPatdownConsoleElapsed(result.elapsedMs).padStart(timeWidth, ' ')
	const name = formatPatdownConsolePath(basename(result.filePath)).padEnd(nameWidth, ' ')

	return `│  ${mark}  ${bar}  ${score}  ${time}  ${name}`.trimEnd()
}

/** Quiet one-line lint result. */
export function formatPatdownLintResultLine(result: PatdownLintResult): string {
	const verdict = result.violated ? 'FAIL' : 'PASS'

	return `${verdict} ${result.filePath}: ${result.ruleTitle}`
}

/**
 * Verbose local console: one box per rule, files grouped by directory with ├─ headers. Empty
 * results mean the rule matched no files.
 */
export function formatPatdownRuleBlock(
	ruleTitle: string,
	results: ReadonlyArray<PatdownLintResult>,
): string {
	const failCount = results.filter((result) => result.violated).length
	const lines = [padPatdownRuleBlockTitle(ruleTitle, failCount, results.length)]

	if (results.length === 0) {
		lines.push('│')
		lines.push('│  (no files matched)')
		lines.push('│')
	} else {
		const ordered = [...results].toSorted((left, right) =>
			left.filePath.localeCompare(right.filePath),
		)

		const timeWidth = Math.max(
			...ordered.map((result) => formatPatdownConsoleElapsed(result.elapsedMs).length),
		)

		const nameWidth = Math.max(
			...ordered.map((result) => formatPatdownConsolePath(basename(result.filePath)).length),
		)

		let currentDirectory: string | null = null

		for (const result of ordered) {
			const directory = patdownConsoleDirectoryLabel(result.filePath)
			const startingNewDirectory = directory !== currentDirectory

			if (startingNewDirectory && currentDirectory !== null) {
				lines.push('│')
			}

			if (startingNewDirectory) {
				lines.push(formatPatdownDirectoryHeader(directory))
				lines.push('│')
				currentDirectory = directory
			}

			lines.push(formatPatdownRuleBlockRow(result, timeWidth, nameWidth))
		}

		lines.push('│')
	}

	lines.push('└')

	return lines.join('\n')
}
