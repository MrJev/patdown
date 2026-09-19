/** One numbered slice of a file used as a Choice candidate. */
export type PatdownEvidenceRegion = {
	readonly id: string
	readonly startLine: number
	readonly endLine: number
	readonly content: string
}

/** Default region height for FAIL-only evidence Choice. */
export const patdownEvidenceRegionLineCount = 80

/** Cap Choice options so the second pass stays bounded. */
export const patdownEvidenceRegionMaxCount = 24

const patdownEvidenceNoMatchLabel = 'noMatch'

/** Label returned when no region is strong enough. */
export function patdownEvidenceNoMatchChoice(): string {
	return patdownEvidenceNoMatchLabel
}

/**
 * Split file text into contiguous regions with known 1-based line ranges. Empty files yield one
 * empty region at line 1.
 */
export function splitPatdownEvidenceRegions(
	contents: string,
	lineCount: number = patdownEvidenceRegionLineCount,
	maxRegions: number = patdownEvidenceRegionMaxCount,
): ReadonlyArray<PatdownEvidenceRegion> {
	const normalized = contents.replace(/\r\n/gu, '\n')
	const lines = normalized.length === 0 ? [''] : normalized.split('\n')
	const regions: PatdownEvidenceRegion[] = []
	const step = Math.max(1, lineCount)

	for (let startIndex = 0; startIndex < lines.length; startIndex += step) {
		if (regions.length >= maxRegions) break

		const endIndex = Math.min(lines.length, startIndex + step)
		const startLine = startIndex + 1
		const endLine = endIndex
		const id = `r${String(regions.length + 1)}`

		regions.push({
			id,
			startLine,
			endLine,
			content: lines.slice(startIndex, endIndex).join('\n'),
		})
	}

	return regions
}

/** Choice criteria: region ids plus noMatch. Descriptions stay short. */
export type PatdownEvidenceChoiceCriteria = {
	readonly [label: string]: string
}

export function patdownEvidenceChoiceCriteria(
	regions: ReadonlyArray<PatdownEvidenceRegion>,
): PatdownEvidenceChoiceCriteria {
	const entries: Array<readonly [string, string]> = [
		[patdownEvidenceNoMatchLabel, 'No region provides clear, direct evidence of the violation'],
	]

	for (const region of regions) {
		entries.push([
			region.id,
			`Lines ${String(region.startLine)}-${String(region.endLine)} of the file`,
		])
	}

	return Object.fromEntries(entries) satisfies PatdownEvidenceChoiceCriteria
}

/** State text for the evidence Choice: rule plus numbered region bodies. */
export function formatPatdownEvidenceChoiceState(
	relativePath: string,
	ruleTitle: string,
	ruleBody: string,
	regions: ReadonlyArray<PatdownEvidenceRegion>,
): string {
	const parts = [
		`path: ${relativePath}`,
		'',
		`# ${ruleTitle}`,
		'',
		ruleBody,
		'',
		'Candidate regions:',
	]

	for (const region of regions) {
		parts.push('')
		parts.push(`## ${region.id} (lines ${String(region.startLine)}-${String(region.endLine)})`)
		parts.push(region.content)
	}

	return parts.join('\n')
}

/** Instructions for selecting the strongest violating region. */
export function patdownEvidenceChoiceInstructions(): string {
	return [
		'Which candidate region provides the strongest direct evidence that this file violates the rule?',
		'Select noMatch when no region provides sufficient evidence.',
		'Prefer the region that contains the clearest violation, not merely related text.',
	].join(' ')
}
