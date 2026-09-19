import { isAbsolute, relative, resolve, sep } from 'node:path'

import { Effect, FileSystem, Option } from 'effect'

import { patdownPathIsExcluded, patdownPathMatchesRuleGlobs } from '#src/patdown-glob'
import { PatdownJudgeFailed } from '#src/patdown-judge'

/** Explicit path list from --files and/or --files-from, already cwd-relative and deduped. */
export type PatdownLintFileSelection = {
	readonly relativePaths: ReadonlyArray<string>
}

function normalizePatdownRelativePath(cwd: string, rawPath: string): string | null {
	const trimmed = rawPath.trim()

	if (trimmed.length === 0) return null

	if (trimmed.startsWith('#')) return null

	const absolutePath = isAbsolute(trimmed) ? resolve(trimmed) : resolve(cwd, trimmed)
	const relativePath = relative(cwd, absolutePath).split(sep).join('/')

	if (relativePath === '') return null

	if (relativePath === '..' || relativePath.startsWith('../')) {
		return null
	}

	if (patdownPathIsExcluded(relativePath)) return null

	return relativePath
}

function parsePatdownFilesFromText(cwd: string, text: string): ReadonlyArray<string> {
	const paths: string[] = []

	for (const line of text.split(/\r?\n/u)) {
		const relativePath = normalizePatdownRelativePath(cwd, line)

		if (relativePath === null) continue

		paths.push(relativePath)
	}

	return [...new Set(paths)].toSorted()
}

/**
 * Builds the optional lint path list. --files and --files-from may be combined. Missing
 * --files-from paths fail. Empty selections stay empty and still succeed.
 */
export function resolvePatdownLintFileSelection(
	cwd: string,
	files: ReadonlyArray<string>,
	filesFrom: Option.Option<string>,
): Effect.Effect<PatdownLintFileSelection | null, PatdownJudgeFailed, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		if (files.length === 0 && Option.isNone(filesFrom)) return null

		const paths: string[] = []

		for (const file of files) {
			const relativePath = normalizePatdownRelativePath(cwd, file)

			if (relativePath === null) continue

			paths.push(relativePath)
		}

		if (Option.isSome(filesFrom)) {
			const fileSystem = yield* FileSystem.FileSystem

			const listPath = isAbsolute(filesFrom.value)
				? resolve(filesFrom.value)
				: resolve(cwd, filesFrom.value)

			const text = yield* fileSystem.readFileString(listPath).pipe(
				Effect.mapError(
					() =>
						new PatdownJudgeFailed({
							message: `patdown: failed to read --files-from ${relative(cwd, listPath).split(sep).join('/') || filesFrom.value}`,
						}),
				),
			)

			paths.push(...parsePatdownFilesFromText(cwd, text))
		}

		return {
			relativePaths: [...new Set(paths)].toSorted(),
		}
	})
}

/** Intersects an explicit path list with one rule's globs. Absolute paths are for reading. */
export function selectPatdownRuleFiles(
	cwd: string,
	selection: PatdownLintFileSelection | null,
	globs: ReadonlyArray<string>,
	globbedAbsolutePaths: ReadonlyArray<string>,
): ReadonlyArray<string> {
	if (selection === null) return globbedAbsolutePaths

	const absolutePaths: string[] = []

	for (const relativePath of selection.relativePaths) {
		if (!patdownPathMatchesRuleGlobs(relativePath, globs)) continue

		if (patdownPathIsExcluded(relativePath)) continue

		absolutePaths.push(resolve(cwd, relativePath))
	}

	return absolutePaths.toSorted()
}
