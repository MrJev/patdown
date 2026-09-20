import {
	decodePatdownGitHubAnnotationLevel,
	PatdownGitHubAnnotationInvalid,
	type PatdownGitHubAnnotationLevel,
} from '#src/patdown-github-annotation'
import type { PatdownRule } from '#src/patdown-rule'
import {
	decodePatdownYesThresholdText,
	PatdownYesThresholdInvalid,
} from '#src/patdown-yes-threshold'

const atxHeadingPattern = /^#\s+(.*)$/u

const globLinePattern = /^globs:\s*(.*)$/u

const yesThresholdLinePattern = /^yes-threshold:\s*(.*)$/u

const githubAnnotationLinePattern = /^github-annotation:\s*(.*)$/u

function isFenceToggleLine(line: string): boolean {
	return line.startsWith('```')
}

function atxHeadingTitle(line: string): string | undefined {
	const match = atxHeadingPattern.exec(line)

	if (match === null) return undefined

	const title = match[1]?.trim() ?? ''

	return title.length === 0 ? undefined : title
}

function unwrapGlobToken(token: string): string {
	const trimmed = token.trim()

	if (trimmed.length >= 2 && trimmed.startsWith('`') && trimmed.endsWith('`')) {
		return trimmed.slice(1, -1)
	}

	return trimmed
}

function splitGlobList(raw: string): ReadonlyArray<string> {
	return raw
		.split(/[,\s]+/u)
		.map(unwrapGlobToken)
		.filter((part) => part.length > 0)
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
	readonly patdownRuleGitHubAnnotation?: PatdownGitHubAnnotationLevel
}

function yesThresholdFromLine(line: string): string | undefined {
	const match = yesThresholdLinePattern.exec(line)

	return match === null ? undefined : (match[1] ?? '')
}

function githubAnnotationFromLine(line: string): string | undefined {
	const match = githubAnnotationLinePattern.exec(line)

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

type PatdownRuleMetadataState = {
	readonly yesThreshold: number | undefined
	readonly githubAnnotation: PatdownGitHubAnnotationLevel | undefined
}

type PatdownRuleMetadataLine = {
	readonly consumed: boolean
	readonly state: PatdownRuleMetadataState
}

function decodeRuleGitHubAnnotation(title: string, rawLevel: string): PatdownGitHubAnnotationLevel {
	const decoded = decodePatdownGitHubAnnotationLevel(
		rawLevel,
		`rule ${JSON.stringify(title)} github-annotation`,
	)

	if (decoded instanceof PatdownGitHubAnnotationInvalid) throw decoded

	return decoded
}

function applyRuleMetadataLine(
	title: string,
	line: string,
	globs: string[],
	state: PatdownRuleMetadataState,
): PatdownRuleMetadataLine {
	const globValues = globValuesFromLine(line)

	if (globValues !== undefined) {
		globs.push(...globValues)

		return { consumed: true, state }
	}

	const rawThreshold = yesThresholdFromLine(line)

	if (rawThreshold !== undefined) {
		if (state.yesThreshold !== undefined) {
			throw new Error(`patdown: rule ${JSON.stringify(title)} has more than one yes-threshold line`)
		}

		return {
			consumed: true,
			state: {
				yesThreshold: decodeRuleYesThreshold(title, rawThreshold),
				githubAnnotation: state.githubAnnotation,
			},
		}
	}

	const rawAnnotation = githubAnnotationFromLine(line)

	if (rawAnnotation === undefined) return { consumed: false, state }

	if (state.githubAnnotation !== undefined) {
		throw new Error(
			`patdown: rule ${JSON.stringify(title)} has more than one github-annotation line`,
		)
	}

	return {
		consumed: true,
		state: {
			yesThreshold: state.yesThreshold,
			githubAnnotation: decodeRuleGitHubAnnotation(title, rawAnnotation),
		},
	}
}

function splitMetadataFromRuleBody(title: string, lines: readonly string[]): PatdownRuleBodyParts {
	let index = skipBlankPrefix(lines)
	const globs: string[] = []

	let state: PatdownRuleMetadataState = {
		yesThreshold: undefined,
		githubAnnotation: undefined,
	}

	while (index < lines.length) {
		const applied = applyRuleMetadataLine(title, lines[index] ?? '', globs, state)

		if (!applied.consumed) break

		state = applied.state
		index += 1
	}

	let bodyParts: PatdownRuleBodyParts = {
		patdownRuleBody: lines.slice(index).join('\n').trim(),
		patdownRuleGlobs: globs,
	}

	if (state.yesThreshold !== undefined) {
		bodyParts = {
			...bodyParts,
			patdownRuleYesThreshold: state.yesThreshold,
		}
	}

	if (state.githubAnnotation !== undefined) {
		bodyParts = {
			...bodyParts,
			patdownRuleGitHubAnnotation: state.githubAnnotation,
		}
	}

	return bodyParts
}

function finishPatdownRule(title: string, lines: readonly string[]): PatdownRule {
	const bodyParts = splitMetadataFromRuleBody(title, lines)

	let rule: PatdownRule = {
		patdownRuleBody: bodyParts.patdownRuleBody,
		patdownRuleGlobs: bodyParts.patdownRuleGlobs,
		patdownRuleTitle: title,
	}

	if (bodyParts.patdownRuleYesThreshold !== undefined) {
		rule = {
			...rule,
			patdownRuleYesThreshold: bodyParts.patdownRuleYesThreshold,
		}
	}

	if (bodyParts.patdownRuleGitHubAnnotation !== undefined) {
		rule = {
			...rule,
			patdownRuleGitHubAnnotation: bodyParts.patdownRuleGitHubAnnotation,
		}
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
