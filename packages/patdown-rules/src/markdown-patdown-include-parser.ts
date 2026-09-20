const atxHeadingPattern = /^#\s+(.*)$/u

const includeLinePattern = /^include:\s*(.*)$/u

function isFenceToggleLine(line: string): boolean {
	return line.startsWith('```')
}

function unwrapIncludeToken(token: string): string {
	const trimmed = token.trim()

	if (trimmed.length >= 2 && trimmed.startsWith('`') && trimmed.endsWith('`')) {
		return trimmed.slice(1, -1)
	}

	return trimmed
}

function includePathFromLine(line: string): string | undefined {
	const match = includeLinePattern.exec(line)

	if (match === null) return undefined

	return unwrapIncludeToken(match[1] ?? '')
}

function isPreambleHeading(line: string, inFence: boolean): boolean {
	if (inFence) return false

	const match = atxHeadingPattern.exec(line)

	if (match === null) return false

	const title = match[1]?.trim() ?? ''

	return title.length > 0
}

/**
 * Collect `include:` paths from text above the first `# heading`. Headings and include lines inside
 * fenced code are ignored. Paths stay relative to the including file.
 */
export function parseMarkdownPatdownIncludes(markdown: string): ReadonlyArray<string> {
	const includes: string[] = []
	let inFence = false

	for (const line of markdown.split(/\r?\n/u)) {
		if (isFenceToggleLine(line)) {
			inFence = !inFence
			continue
		}

		if (isPreambleHeading(line, inFence)) break

		if (inFence) continue

		const includePath = includePathFromLine(line)

		if (includePath === undefined) continue

		if (includePath.length === 0) {
			throw new Error('patdown: include path is empty')
		}

		includes.push(includePath)
	}

	return includes
}
