import { isAbsolute, relative, resolve, sep } from 'node:path'

import { patdownPathIsExcluded } from 'patdown'

/** One exact replacement from a Pi `edit` tool call. */
export type PatdownProposedEdit = {
	readonly oldText: string
	readonly newText: string
}

/** Cwd-relative path plus the file contents the tool is about to write. */
export type PatdownProposedFile = {
	readonly relativePath: string
	readonly contents: string
}

type PatdownMatchedEdit = {
	readonly index: number
	readonly length: number
	readonly newText: string
}

/** Cwd-relative POSIX path, or null when the tool path is outside cwd. */
export function patdownRelativeToolPath(cwd: string, rawPath: string): string | null {
	const trimmed = rawPath.trim()

	if (trimmed.length === 0) return null

	const absolutePath = isAbsolute(trimmed) ? resolve(trimmed) : resolve(cwd, trimmed)
	const relativePath = relative(cwd, absolutePath).split(sep).join('/')

	if (relativePath === '' || relativePath === '..' || relativePath.startsWith('../')) {
		return null
	}

	if (patdownPathIsExcluded(relativePath)) return null

	return relativePath
}

function patdownEditOverlapsClaimed(
	index: number,
	length: number,
	claimed: ReadonlyArray<PatdownMatchedEdit>,
): boolean {
	return claimed.some((match) => index < match.index + match.length && match.index < index + length)
}

function matchExactPatdownEdit(
	contents: string,
	edit: PatdownProposedEdit,
	claimed: ReadonlyArray<PatdownMatchedEdit>,
): PatdownMatchedEdit | null {
	if (edit.oldText.length === 0) return null

	let searchFrom = 0

	while (searchFrom <= contents.length) {
		const index = contents.indexOf(edit.oldText, searchFrom)

		if (index === -1) return null

		if (!patdownEditOverlapsClaimed(index, edit.oldText.length, claimed)) {
			return { index, length: edit.oldText.length, newText: edit.newText }
		}

		searchFrom = index + 1
	}

	return null
}

function collectExactPatdownEdits(
	contents: string,
	edits: ReadonlyArray<PatdownProposedEdit>,
): ReadonlyArray<PatdownMatchedEdit> | null {
	const claimed: PatdownMatchedEdit[] = []

	for (const edit of edits) {
		const matched = matchExactPatdownEdit(contents, edit, claimed)

		if (matched === null) return null

		claimed.push(matched)
	}

	return claimed
}

/**
 * Apply `edit` replacements against the original file. All matches are against the original
 * contents, then applied last-to-first so offsets stay valid. Returns null when a span is missing
 * or overlapping.
 */
export function applyExactPatdownEdits(
	contents: string,
	edits: ReadonlyArray<PatdownProposedEdit>,
): string | null {
	if (edits.length === 0) return contents

	const claimed = collectExactPatdownEdits(contents, edits)

	if (claimed === null) return null

	const ordered = [...claimed].toSorted((left, right) => right.index - left.index)
	let next = contents

	for (const match of ordered) {
		next = `${next.slice(0, match.index)}${match.newText}${next.slice(match.index + match.length)}`
	}

	return next
}
