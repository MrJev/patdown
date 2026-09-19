/** One Choice candidate with a known 1-based line span. */
export type PatdownEvidenceCandidate = {
	readonly id: string
	readonly startLine: number
	readonly endLine: number
	readonly content: string
}

/** Prefer one Choice label per source line while the file stays under this size. */
export const patdownEvidencePerLineMaxCount = 500

/** Chunk height when the file is too large for per-line Choice. */
export const patdownEvidenceChunkLineCount = 80

/** Cap chunked candidates so the second pass stays bounded. */
export const patdownEvidenceChunkMaxCount = 24

/** Truncate long line text used as Choice descriptions. */
export const patdownEvidenceDescriptionMaxChars = 160

/** Minimum Choice confidence before a FAIL annotation uses the selected span. */
export const patdownEvidenceMinConfidence = 0.55

const patdownEvidenceNoMatchLabel = 'noMatch'

/** Label returned when no candidate is strong enough. */
export function patdownEvidenceNoMatchChoice(): string {
	return patdownEvidenceNoMatchLabel
}

function normalizePatdownEvidenceLines(contents: string): string[] {
	const normalized = contents.replace(/\r\n/gu, '\n')

	if (normalized.length === 0) return ['']

	// Trailing newline must not create a phantom empty line / endLine past EOF.
	const withoutTrailingNewline = normalized.endsWith('\n') ? normalized.slice(0, -1) : normalized

	return withoutTrailingNewline.length === 0 ? [''] : withoutTrailingNewline.split('\n')
}

function truncatePatdownEvidenceDescription(text: string): string {
	const collapsed = text.replace(/\s+/gu, ' ').trim()

	if (collapsed.length === 0) return '(empty line)'

	if (collapsed.length <= patdownEvidenceDescriptionMaxChars) return collapsed

	return `${collapsed.slice(0, patdownEvidenceDescriptionMaxChars - 1)}…`
}

function splitPatdownEvidenceChunks(
	lines: ReadonlyArray<string>,
	lineCount: number,
	maxChunks: number,
): ReadonlyArray<PatdownEvidenceCandidate> {
	const candidates: PatdownEvidenceCandidate[] = []
	const step = Math.max(1, lineCount)

	for (let startIndex = 0; startIndex < lines.length; startIndex += step) {
		if (candidates.length >= maxChunks) break

		const endIndex = Math.min(lines.length, startIndex + step)
		const startLine = startIndex + 1
		const endLine = endIndex
		const id = `c${String(candidates.length + 1)}`

		candidates.push({
			id,
			startLine,
			endLine,
			content: lines.slice(startIndex, endIndex).join('\n'),
		})
	}

	return candidates
}

function splitPatdownEvidenceLines(
	lines: ReadonlyArray<string>,
): ReadonlyArray<PatdownEvidenceCandidate> {
	return lines.map((content, index) => {
		const startLine = index + 1

		return {
			id: `L${String(startLine)}`,
			startLine,
			endLine: startLine,
			content,
		}
	})
}

/**
 * Build FAIL-only Choice candidates. Prefer one label per line. Past
 * {@link patdownEvidencePerLineMaxCount}, fall back to chunks. Smarter units (functions, headings,
 * hunks) can replace this later without changing the Choice pass.
 */
export function splitPatdownEvidenceCandidates(
	contents: string,
	perLineMaxCount: number = patdownEvidencePerLineMaxCount,
	chunkLineCount: number = patdownEvidenceChunkLineCount,
	chunkMaxCount: number = patdownEvidenceChunkMaxCount,
): ReadonlyArray<PatdownEvidenceCandidate> {
	const lines = normalizePatdownEvidenceLines(contents)

	if (lines.length <= perLineMaxCount) {
		return splitPatdownEvidenceLines(lines)
	}

	return splitPatdownEvidenceChunks(lines, chunkLineCount, chunkMaxCount)
}

/** Choice criteria: candidate ids plus noMatch. Descriptions stay short. */
export type PatdownEvidenceChoiceCriteria = {
	readonly [label: string]: string
}

export function patdownEvidenceChoiceCriteria(
	candidates: ReadonlyArray<PatdownEvidenceCandidate>,
): PatdownEvidenceChoiceCriteria {
	const entries: Array<readonly [string, string]> = [
		[patdownEvidenceNoMatchLabel, 'No candidate provides clear, direct evidence of the violation'],
	]

	for (const candidate of candidates) {
		const span =
			candidate.startLine === candidate.endLine
				? `Line ${String(candidate.startLine)}`
				: `Lines ${String(candidate.startLine)}-${String(candidate.endLine)}`

		entries.push([
			candidate.id,
			`${span}: ${truncatePatdownEvidenceDescription(candidate.content)}`,
		])
	}

	return Object.fromEntries(entries) satisfies PatdownEvidenceChoiceCriteria
}

/** Inputs for FAIL-only evidence Choice state. */
export type PatdownEvidenceChoiceStateInput = {
	readonly relativePath: string
	readonly ruleTitle: string
	readonly ruleBody: string
	readonly violationProbability: number
	readonly contents: string
	readonly candidates: ReadonlyArray<PatdownEvidenceCandidate>
}

/** State for the evidence Choice: original FAIL, full file, and candidate index. */
export function formatPatdownEvidenceChoiceState(input: PatdownEvidenceChoiceStateInput): string {
	const mode =
		input.candidates.length > 0 && input.candidates[0]?.startLine === input.candidates[0]?.endLine
			? 'per-line'
			: 'chunked'

	const parts = [
		`path: ${input.relativePath}`,
		`noul P(yes): ${String(input.violationProbability)}`,
		`candidate mode: ${mode}`,
		'',
		`# ${input.ruleTitle}`,
		'',
		input.ruleBody,
		'',
		'Full file:',
		input.contents,
		'',
		'Candidates (choose the strongest direct evidence of the violation):',
	]

	for (const candidate of input.candidates) {
		const span =
			candidate.startLine === candidate.endLine
				? `line ${String(candidate.startLine)}`
				: `lines ${String(candidate.startLine)}-${String(candidate.endLine)}`

		parts.push(`- ${candidate.id}: ${span}`)
	}

	return parts.join('\n')
}

/** Instructions for selecting the strongest violating candidate. */
export function patdownEvidenceChoiceInstructions(): string {
	return [
		'Which candidate provides the strongest direct evidence that this file violates the rule?',
		'When candidates are single lines, pick the specific line that contains the violation.',
		'Select noMatch when no candidate provides sufficient evidence.',
		'Prefer the clearest violation, not merely related text.',
	].join(' ')
}
