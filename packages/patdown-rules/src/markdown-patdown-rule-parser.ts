import type { PatdownRule } from '#src/patdown-rule'
import {
	decodePatdownYesThresholdText,
	PatdownYesThresholdInvalid,
} from '#src/patdown-yes-threshold'

const atxHeadingPattern = /^#\s+(.*)$/u

const globLinePattern = /^globs:\s*(.*)$/u

const yesThresholdLinePattern = /^yes-threshold:\s*(.*)$/u

function isFenceToggleLine(line: string): boolean {
	return line.startsWith('```')
}

function atxHeadingTitle(line: string): string | undefined {
	const match = atxHeadingPattern.exec(line)

	if (match === null) return undefined

	const title = match[1]?.trim() ?? ''

	return title.length === 0 ? undefined : title
}

function splitGlobList(raw: string): ReadonlyArray<string> {
	return raw.split(/[,\s]+/u).filter((part) => part.length > 0)
}

function globValuesFromLine(line: string): ReadonlyArray<string> | undefined {
	const match = globLinePattern.exec(line)

	if (match === null) return undefined

	return splitGlobList(match[1] ?? '')
}

type PatdownRuleBodyParts = {
	readonly patdownRuleBody: string
	readonly patdownRuleGlobs: ReadonlyArray<string>
	readonly patdownRuleYesThreshold?: number
}

function yesThresholdFromLine(line: string): string | undefined {
	const match = yesThresholdLinePattern.exec(line)

	return match === null ? undefined : (match[1] ?? '')
}

function skipBlankPrefix(lines: readonly string[]): number {
	let index = 0

	while (index < lines.length && lines[index]?.trim() === '') {
		index += 1
	}

	return index
}

function decodeRuleYesThreshold(title: string, rawThreshold: string): number {
	const decoded = decodePatdownYesThresholdText(
		rawThreshold,
		`rule ${JSON.stringify(title)} yes-threshold`,
	)

	if (decoded instanceof PatdownYesThresholdInvalid) throw decoded

	return decoded
}

type PatdownRuleMetadataLine = {
	readonly consumed: boolean
	readonly yesThreshold: number | undefined
}

function applyRuleMetadataLine(
	title: string,
	line: string,
	globs: string[],
	yesThreshold: number | undefined,
): PatdownRuleMetadataLine {
	const globValues = globValuesFromLine(line)

	if (globValues !== undefined) {
		globs.push(...globValues)

		return { consumed: true, yesThreshold }
	}

	const rawThreshold = yesThresholdFromLine(line)

	if (rawThreshold === undefined) return { consumed: false, yesThreshold }

	if (yesThreshold !== undefined) {
		throw new Error(`patdown: rule ${JSON.stringify(title)} has more than one yes-threshold line`)
	}

	return { consumed: true, yesThreshold: decodeRuleYesThreshold(title, rawThreshold) }
}

function splitMetadataFromRuleBody(title: string, lines: readonly string[]): PatdownRuleBodyParts {
	let index = skipBlankPrefix(lines)
	const globs: string[] = []
	let yesThreshold: number | undefined

	while (index < lines.length) {
		const applied = applyRuleMetadataLine(title, lines[index] ?? '', globs, yesThreshold)

		if (!applied.consumed) break

		yesThreshold = applied.yesThreshold
		index += 1
	}

	const bodyParts: PatdownRuleBodyParts = {
		patdownRuleBody: lines.slice(index).join('\n').trim(),
		patdownRuleGlobs: globs,
	}

	if (yesThreshold !== undefined) {
		return { ...bodyParts, patdownRuleYesThreshold: yesThreshold }
	}

	return bodyParts
}

function finishPatdownRule(title: string, lines: readonly string[]): PatdownRule {
	const bodyParts = splitMetadataFromRuleBody(title, lines)

	const rule: PatdownRule = {
		patdownRuleBody: bodyParts.patdownRuleBody,
		patdownRuleGlobs: bodyParts.patdownRuleGlobs,
		patdownRuleTitle: title,
	}

	if (bodyParts.patdownRuleYesThreshold !== undefined) {
		return { ...rule, patdownRuleYesThreshold: bodyParts.patdownRuleYesThreshold }
	}

	return rule
}

type MarkdownParseState = {
	currentLines: string[]
	currentTitle: string | undefined
	inFence: boolean
	rules: PatdownRule[]
}

function applyMarkdownLine(state: MarkdownParseState, line: string): void {
	if (isFenceToggleLine(line)) {
		state.inFence = !state.inFence

		if (state.currentTitle !== undefined) state.currentLines.push(line)

		return
	}

	const headingTitle = state.inFence ? undefined : atxHeadingTitle(line)

	if (headingTitle !== undefined) {
		if (state.currentTitle !== undefined) {
			state.rules.push(finishPatdownRule(state.currentTitle, state.currentLines))
		}

		state.currentTitle = headingTitle
		state.currentLines = []

		return
	}

	if (state.currentTitle !== undefined) state.currentLines.push(line)
}

/**
 * Parse fuzzy patdown rules from a markdown document. Text above the first `# heading` is ignored.
 * Headings inside fenced code are ignored.
 */
export function parseMarkdownPatdownRules(markdown: string): ReadonlyArray<PatdownRule> {
	const state: MarkdownParseState = {
		currentLines: [],
		currentTitle: undefined,
		inFence: false,
		rules: [],
	}

	for (const line of markdown.split(/\r?\n/u)) {
		applyMarkdownLine(state, line)
	}

	if (state.currentTitle !== undefined) {
		state.rules.push(finishPatdownRule(state.currentTitle, state.currentLines))
	}

	return state.rules
}
