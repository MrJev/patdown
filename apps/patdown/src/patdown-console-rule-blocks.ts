import { dirname, basename } from 'node:path'

import type { PatdownLintResult } from '#src/patdown-output'
import { formatPatdownProbabilityBar } from '#src/patdown-probability-bar'

const patdownRuleBlockWidth = 64

/** Soft cap so extreme directory labels do not dominate the header line. */
export const patdownConsolePathMaxWidth = 48

/** Fixed elapsed column so streaming rows stay aligned without buffering. */
export const patdownConsoleElapsedColumnWidth = 6

function formatPatdownConsoleElapsed(elapsedMs: number): string {
	return `${String(elapsedMs)}ms`
}

function padPatdownRuleBlockTitle(title: string, right: string): string {
	const suffix = ` ${right}`
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
	timeWidth: number = patdownConsoleElapsedColumnWidth,
): string {
	const mark = result.violated ? '✗' : '✓'
	const bar = formatPatdownProbabilityBar(result.violationProbability)
	const score = result.violationProbability.toFixed(2).padStart(4, ' ')
	const time = formatPatdownConsoleElapsed(result.elapsedMs).padStart(timeWidth, ' ')
	const name = formatPatdownConsolePath(basename(result.filePath))

	return `│  ${mark}  ${bar}  ${score}  ${time}  ${name}`
}

/** Quiet one-line lint result. */
export function formatPatdownLintResultLine(result: PatdownLintResult): string {
	const verdict = result.violated ? 'FAIL' : 'PASS'

	return `${verdict} ${result.filePath}: ${result.ruleTitle}`
}

/** Opens a verbose rule box with the planned file count. */
export function formatPatdownRuleBlockOpen(ruleTitle: string, plannedFileCount: number): string {
	return [padPatdownRuleBlockTitle(ruleTitle, String(plannedFileCount)), '│'].join('\n')
}

/** One streaming verbose chunk: optional directory header plus the metric row. */
export type PatdownRuleBlockStreamChunk = {
	readonly text: string
	readonly directory: string
}

/** Streaming verbose body for one judgment. Includes a directory header when the directory changes. */
export function formatPatdownRuleBlockStreamChunk(
	result: PatdownLintResult,
	previousDirectory: string | null,
): PatdownRuleBlockStreamChunk {
	const directory = patdownConsoleDirectoryLabel(result.filePath)
	const lines: string[] = []

	if (directory !== previousDirectory) {
		if (previousDirectory !== null) {
			lines.push('│')
		}

		lines.push(formatPatdownDirectoryHeader(directory))
		lines.push('│')
	}

	lines.push(formatPatdownRuleBlockRow(result))

	const chunk: PatdownRuleBlockStreamChunk = {
		text: lines.join('\n'),
		directory,
	}

	return chunk
}

/** Closes a verbose rule box with the final fail / judged counts. */
export function formatPatdownRuleBlockClose(failCount: number, judgedCount: number): string {
	return `└ ${String(failCount)}✗ / ${String(judgedCount)}`
}

/**
 * Verbose local console: one complete box per rule. Used for empty matches and tests. Live lint
 * streams with formatPatdownRuleBlockOpen / StreamChunk / Close instead.
 */
export function formatPatdownRuleBlock(
	ruleTitle: string,
	results: ReadonlyArray<PatdownLintResult>,
): string {
	const failCount = results.filter((result) => result.violated).length
	const lines = [formatPatdownRuleBlockOpen(ruleTitle, results.length)]

	if (results.length === 0) {
		lines.push('│  (no files matched)')
	} else {
		const ordered = [...results].toSorted((left, right) =>
			left.filePath.localeCompare(right.filePath),
		)

		let currentDirectory: string | null = null

		for (const result of ordered) {
			const chunk = formatPatdownRuleBlockStreamChunk(result, currentDirectory)

			currentDirectory = chunk.directory
			lines.push(chunk.text)
		}
	}

	lines.push(formatPatdownRuleBlockClose(failCount, results.length))

	return lines.join('\n')
}
