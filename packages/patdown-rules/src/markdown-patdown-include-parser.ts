const frontmatterFencePattern = /^---\s*$/u

const includeKeyPattern = /^include:\s*(.*)$/u

const includeListItemPattern = /^\s+-\s+(.*)$/u

function unwrapIncludeToken(token: string): string {
	const trimmed = token.trim()

	if (trimmed.length >= 2 && trimmed.startsWith('`') && trimmed.endsWith('`')) {
		return trimmed.slice(1, -1)
	}

	return trimmed
}

function requireIncludePath(raw: string): string {
	const includePath = unwrapIncludeToken(raw)

	if (includePath.length === 0) {
		throw new Error('patdown: include path is empty')
	}

	return includePath
}

function skipLeadingBlankLines(lines: readonly string[]): number {
	let index = 0

	while (index < lines.length && lines[index]?.trim() === '') {
		index += 1
	}

	return index
}

function frontmatterCloseIndex(lines: readonly string[], start: number): number {
	let index = start

	while (index < lines.length) {
		if (frontmatterFencePattern.test(lines[index] ?? '')) return index

		index += 1
	}

	throw new Error('patdown: unterminated frontmatter; expected a closing ---')
}

function extractPatdownFrontmatterLines(markdown: string): ReadonlyArray<string> | undefined {
	const lines = markdown.split(/\r?\n/u)
	const start = skipLeadingBlankLines(lines)

	if (!frontmatterFencePattern.test(lines[start] ?? '')) return undefined

	const close = frontmatterCloseIndex(lines, start + 1)

	return lines.slice(start + 1, close)
}

function includeListItemPath(line: string): string | undefined {
	const item = includeListItemPattern.exec(line)

	return item === null ? undefined : requireIncludePath(item[1] ?? '')
}

function appendIncludeListItems(
	lines: readonly string[],
	start: number,
	includes: string[],
): number {
	let index = start

	while (index < lines.length) {
		const includePath = includeListItemPath(lines[index] ?? '')

		if (includePath === undefined) break

		includes.push(includePath)
		index += 1
	}

	if (index === start) {
		throw new Error('patdown: include path is empty')
	}

	return index
}

function applyIncludeFrontmatterValue(
	lines: readonly string[],
	index: number,
	value: string,
	includes: string[],
): number {
	if (value.length > 0) {
		includes.push(value)

		return index + 1
	}

	return appendIncludeListItems(lines, index + 1, includes)
}

function applyFrontmatterLine(lines: readonly string[], index: number, includes: string[]): number {
	const line = lines[index] ?? ''

	if (line.trim() === '') return index + 1

	const include = includeKeyPattern.exec(line)

	if (include === null) {
		throw new Error(`patdown: unknown frontmatter key ${JSON.stringify(line)}`)
	}

	return applyIncludeFrontmatterValue(lines, index, unwrapIncludeToken(include[1] ?? ''), includes)
}

/**
 * Collect include paths from a leading `---` frontmatter block. Only `include:` is accepted.
 * Repeated keys stack. A bare `include:` may be followed by indented `- path` list items. Paths
 * stay relative to the including file.
 */
export function parseMarkdownPatdownIncludes(markdown: string): ReadonlyArray<string> {
	const frontmatter = extractPatdownFrontmatterLines(markdown)

	if (frontmatter === undefined) return []

	const includes: string[] = []
	let index = 0

	while (index < frontmatter.length) {
		index = applyFrontmatterLine(frontmatter, index, includes)
	}

	return includes
}
