import { matchesGlob } from 'node:path'

/** Directories skipped for every rule glob and every --files path. */
export const patdownGlobExcludes = [
	'**/.git/**',
	'**/.turbo/**',
	'**/coverage/**',
	'**/dist/**',
	'**/node_modules/**',
] as const

/** Empty rule globs mean the whole tree. */
export function patdownGlobPatterns(globs: ReadonlyArray<string>): ReadonlyArray<string> {
	return globs.length === 0 ? ['**/*'] : globs
}

/** True when a cwd-relative path is under a skipped directory. */
export function patdownPathIsExcluded(relativePath: string): boolean {
	return patdownGlobExcludes.some((pattern) => matchesGlob(relativePath, pattern))
}

/** True when a cwd-relative path matches any rule glob after the empty-glob default. */
export function patdownPathMatchesRuleGlobs(
	relativePath: string,
	globs: ReadonlyArray<string>,
): boolean {
	return patdownGlobPatterns(globs).some((pattern) => matchesGlob(relativePath, pattern))
}
