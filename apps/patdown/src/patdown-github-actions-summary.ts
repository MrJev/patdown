import type { PatdownLintResult } from '#src/patdown-output'
import { formatPatdownProbabilityBar } from '#src/patdown-probability-bar'

/** GitHub only shows about ten workflow-command annotations per step. */
export const patdownGitHubActionsAnnotationLimit = 10

/** How far below the cutoff still counts as a near miss in the summary. */
export const patdownGitHubActionsNearMissWindow = 0.2

export type PatdownGitHubActionsSummaryInput = {
	readonly failed: boolean
	readonly elapsedMs: number
	readonly results: ReadonlyArray<PatdownLintResult>
}

type PatdownSummaryAxes = {
	readonly files: ReadonlyArray<string>
	readonly rules: ReadonlyArray<string>
	readonly byFileRule: Map<string, PatdownLintResult>
}

function escapePatdownGitHubActionsData(value: string): string {
	return value.replace(/%/gu, '%25').replace(/\r/gu, '%0D').replace(/\n/gu, '%0A')
}

function escapePatdownGitHubActionsProperty(value: string): string {
	return escapePatdownGitHubActionsData(value).replace(/:/gu, '%3A').replace(/,/gu, '%2C')
}

function formatPatdownElapsedLabel(elapsedMs: number): string {
	if (elapsedMs >= 10_000) return `${(elapsedMs / 1000).toFixed(1)}s`

	return `${String(elapsedMs)}ms`
}

function formatPatdownProbabilityCell(result: PatdownLintResult): string {
	const bar = formatPatdownProbabilityBar(result.violationProbability)
	const score = result.violationProbability.toFixed(2)

	if (result.violated) return `${bar} **${score}** ❌`

	return `${bar} ${score}`
}

/** Near misses are below the cutoff but close enough to show in the heatmap. */
export function patdownLintResultIsNearMiss(result: PatdownLintResult): boolean {
	if (result.violated) return false

	const floor = Math.max(0, result.yesThreshold - patdownGitHubActionsNearMissWindow)

	return result.violationProbability >= floor
}

function patdownLintResultHeat(result: PatdownLintResult): number {
	if (result.violated) return 2 + result.violationProbability

	if (patdownLintResultIsNearMiss(result)) return 1 + result.violationProbability

	return result.violationProbability
}

function comparePatdownLintResultsHottestFirst(
	left: PatdownLintResult,
	right: PatdownLintResult,
): number {
	if (left.violated !== right.violated) return left.violated ? -1 : 1

	const leftNear = patdownLintResultIsNearMiss(left)
	const rightNear = patdownLintResultIsNearMiss(right)

	if (leftNear !== rightNear) return leftNear ? -1 : 1

	if (right.violationProbability !== left.violationProbability) {
		return right.violationProbability - left.violationProbability
	}

	const byFile = left.filePath.localeCompare(right.filePath)

	if (byFile !== 0) return byFile

	return left.ruleTitle.localeCompare(right.ruleTitle)
}

/** Workflow commands for the PR Files tab. Failures only; capped. */
export function formatPatdownGitHubActionsAnnotations(
	results: ReadonlyArray<PatdownLintResult>,
): ReadonlyArray<string> {
	const failures = results
		.filter((result) => result.violated)
		.toSorted(comparePatdownLintResultsHottestFirst)
		.slice(0, patdownGitHubActionsAnnotationLimit)

	return failures.map((result) => {
		const bar = formatPatdownProbabilityBar(result.violationProbability)
		const message = `${bar} P(yes) ${String(result.violationProbability)} exceeds cutoff >${String(result.yesThreshold)}`
		const file = escapePatdownGitHubActionsProperty(result.filePath)
		const title = escapePatdownGitHubActionsProperty(`patdown: ${result.ruleTitle}`)

		return `::error file=${file},title=${title}::${escapePatdownGitHubActionsData(message)}`
	})
}

function collectPatdownSummaryAxes(results: ReadonlyArray<PatdownLintResult>): PatdownSummaryAxes {
	const files = [...new Set(results.map((result) => result.filePath))].toSorted()
	const rules = [...new Set(results.map((result) => result.ruleTitle))].toSorted()
	const byFileRule = new Map<string, PatdownLintResult>()

	for (const result of results) {
		byFileRule.set(`${result.filePath}\0${result.ruleTitle}`, result)
	}

	return { files, rules, byFileRule }
}

function hottestPatdownFileScore(
	results: ReadonlyArray<PatdownLintResult>,
	filePath: string,
): number {
	let hottest = 0

	for (const result of results) {
		if (result.filePath !== filePath) continue

		hottest = Math.max(hottest, patdownLintResultHeat(result))
	}

	return hottest
}

function patdownFileRowFailed(
	byFileRule: Map<string, PatdownLintResult>,
	filePath: string,
	rules: ReadonlyArray<string>,
): boolean {
	for (const ruleTitle of rules) {
		const result = byFileRule.get(`${filePath}\0${ruleTitle}`)

		if (result?.violated === true) return true
	}

	return false
}

function formatPatdownHeatmapTable(results: ReadonlyArray<PatdownLintResult>): string {
	const { files, rules, byFileRule } = collectPatdownSummaryAxes(results)

	if (files.length === 0 || rules.length === 0) return '_No judgments._'

	const header = `| file | status | ${rules.map((rule) => rule.replace(/\|/gu, '\\|')).join(' | ')} |`
	const divider = `|---|---|${rules.map(() => '---').join('|')}|`

	const fileOrder = [...files].toSorted((left, right) => {
		const leftHot = hottestPatdownFileScore(results, left)
		const rightHot = hottestPatdownFileScore(results, right)

		if (rightHot !== leftHot) return rightHot - leftHot

		return left.localeCompare(right)
	})

	const rows = fileOrder.map((filePath) => {
		const failed = patdownFileRowFailed(byFileRule, filePath, rules)

		const cells = rules.map((ruleTitle) => {
			const result = byFileRule.get(`${filePath}\0${ruleTitle}`)

			if (result === undefined) return '—'

			return formatPatdownProbabilityCell(result)
		})

		return `| \`${filePath.replace(/\|/gu, '\\|')}\` | ${failed ? '❌' : '✅'} | ${cells.join(' | ')} |`
	})

	return [header, divider, ...rows].join('\n')
}

function formatPatdownFailureDetails(results: ReadonlyArray<PatdownLintResult>): string {
	const failures = results
		.filter((result) => result.violated)
		.toSorted(comparePatdownLintResultsHottestFirst)

	if (failures.length === 0) return ''

	const lines = ['## Failures', '']

	for (const result of failures) {
		const bar = formatPatdownProbabilityBar(result.violationProbability)

		lines.push(
			`### \`${result.filePath}\` · ${result.ruleTitle}`,
			'',
			`${bar} estimated P(yes) **${String(result.violationProbability)}** exceeds cutoff \`>${String(result.yesThreshold)}\` · ${formatPatdownElapsedLabel(result.elapsedMs)}`,
			'',
		)
	}

	return lines.join('\n')
}

/** Markdown for $GITHUB_STEP_SUMMARY. Hottest files first. */
export function formatPatdownGitHubActionsSummary(input: PatdownGitHubActionsSummaryInput): string {
	const failedCount = input.results.filter((result) => result.violated).length
	const passedCount = input.results.length - failedCount
	const status = input.failed || failedCount > 0 ? 'failed' : 'passed'

	const lines = [
		`# patdown ${status}`,
		'',
		`${String(passedCount)} passed · ${String(failedCount)} failed · ${formatPatdownElapsedLabel(input.elapsedMs)}`,
		'',
		'## Heatmap',
		'',
		formatPatdownHeatmapTable(input.results),
		'',
	]

	const failureDetails = formatPatdownFailureDetails(input.results)

	if (failureDetails.length > 0) {
		lines.push(failureDetails)
	}

	const omitted = failedCount - patdownGitHubActionsAnnotationLimit

	if (omitted > 0) {
		lines.push(
			'',
			`_${String(omitted)} more failure(s) are in this summary only; GitHub caps workflow annotations per step._`,
			'',
		)
	}

	return lines.join('\n')
}
