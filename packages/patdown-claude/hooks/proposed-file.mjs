import { isAbsolute, relative, resolve, sep } from 'node:path'

/** Directories skipped the same way as the CLI. */
const patdownGlobExcludes = [
	'**/.git/**',
	'**/.turbo/**',
	'**/coverage/**',
	'**/dist/**',
	'**/node_modules/**',
]

function pathMatchesExclude(relativePath, pattern) {
	// Minimal glob: **/dir/** prefix/suffix. Enough for the fixed exclude list.
	if (pattern.startsWith('**/') && pattern.endsWith('/**')) {
		const segment = pattern.slice(3, -3)
		return (
			relativePath === segment ||
			relativePath.startsWith(`${segment}/`) ||
			relativePath.includes(`/${segment}/`)
		)
	}

	return false
}

/** Cwd-relative POSIX path, or null when the tool path is outside cwd / excluded. */
export function patdownRelativeToolPath(cwd, rawPath) {
	const trimmed = String(rawPath ?? '').trim()

	if (trimmed.length === 0) return null

	const absolutePath = isAbsolute(trimmed) ? resolve(trimmed) : resolve(cwd, trimmed)
	const relativePath = relative(cwd, absolutePath).split(sep).join('/')

	if (relativePath === '' || relativePath === '..' || relativePath.startsWith('../')) {
		return null
	}

	if (patdownGlobExcludes.some((pattern) => pathMatchesExclude(relativePath, pattern))) {
		return null
	}

	return relativePath
}

/** Apply one Claude Edit replacement. replace_all replaces every non-overlapping occurrence. */
export function applyClaudeEdit(contents, oldString, newString, replaceAll = false) {
	if (oldString.length === 0) return null

	if (!replaceAll) {
		const index = contents.indexOf(oldString)

		if (index === -1) return null

		const second = contents.indexOf(oldString, index + oldString.length)

		if (second !== -1) return null

		return contents.slice(0, index) + newString + contents.slice(index + oldString.length)
	}

	if (!contents.includes(oldString)) return null

	return contents.split(oldString).join(newString)
}

/** Reconstruct the file Claude is about to write, or null to skip judging. */
export function proposedClaudeToolFile(cwd, toolName, toolInput, readFile) {
	const relativePath = patdownRelativeToolPath(cwd, toolInput?.file_path)

	if (relativePath === null) return null

	if (toolName === 'Write') {
		if (typeof toolInput?.content !== 'string') return null

		return { relativePath, contents: toolInput.content }
	}

	if (toolName === 'Edit') {
		if (typeof toolInput?.old_string !== 'string' || typeof toolInput?.new_string !== 'string') {
			return null
		}

		let existing

		try {
			existing = readFile(relativePath)
		} catch {
			return null
		}

		const contents = applyClaudeEdit(
			existing,
			toolInput.old_string,
			toolInput.new_string,
			toolInput.replace_all === true,
		)

		if (contents === null) return null

		return { relativePath, contents }
	}

	return null
}
