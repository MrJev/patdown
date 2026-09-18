import type { SquintRule } from '#/squint-rule'

const atxHeadingPattern = /^#\s+(.*)$/u

const globLinePattern = /^globs:\s*(.*)$/u

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

type SquintRuleBodyParts = {
	readonly squintRuleBody: string
	readonly squintRuleGlobs: ReadonlyArray<string>
}

function splitGlobsFromRuleBody(lines: readonly string[]): SquintRuleBodyParts {
	let index = 0

	while (index < lines.length && lines[index]?.trim() === '') {
		index += 1
	}

	const globs: string[] = []

	while (index < lines.length) {
		const globValues = globValuesFromLine(lines[index] ?? '')

		if (globValues === undefined) break

		globs.push(...globValues)
		index += 1
	}

	return {
		squintRuleBody: lines.slice(index).join('\n').trim(),
		squintRuleGlobs: globs,
	}
}

function finishSquintRule(title: string, lines: readonly string[]): SquintRule {
	const bodyParts = splitGlobsFromRuleBody(lines)

	return {
		squintRuleBody: bodyParts.squintRuleBody,
		squintRuleGlobs: bodyParts.squintRuleGlobs,
		squintRuleTitle: title,
	}
}

type MarkdownParseState = {
	currentLines: string[]
	currentTitle: string | undefined
	inFence: boolean
	rules: SquintRule[]
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
			state.rules.push(finishSquintRule(state.currentTitle, state.currentLines))
		}

		state.currentTitle = headingTitle
		state.currentLines = []

		return
	}

	if (state.currentTitle !== undefined) state.currentLines.push(line)
}

/**
 * Parse fuzzy squint rules from a markdown document. Text above the first `# heading` is ignored.
 * Headings inside fenced code are ignored.
 */
export function parseMarkdownSquintRules(markdown: string): ReadonlyArray<SquintRule> {
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
		state.rules.push(finishSquintRule(state.currentTitle, state.currentLines))
	}

	return state.rules
}
