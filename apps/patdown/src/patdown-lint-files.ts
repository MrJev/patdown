import { isAbsolute, relative, resolve, sep } from 'node:path'

import { Effect, FileSystem, Option, Stdio, Stream } from 'effect'

import {
	patdownGlobExcludes,
	patdownPathIsExcluded,
	patdownPathMatchesRuleGlobs,
} from '#src/patdown-glob'
import { PatdownJudgeFailed } from '#src/patdown-judge'

/** Explicit path list from --files and/or --files-from, already cwd-relative and deduped. */
export type PatdownLintFileSelection = {
	readonly relativePaths: ReadonlyArray<string>
}

/** True when a path uses glob metacharacters. */
export function patdownPathLooksLikeGlob(pathText: string): boolean {
	return pathText.includes('*') || pathText.includes('?') || pathText.includes('[')
}

function normalizePatdownRelativePath(cwd: string, rawPath: string): string | null {
	const trimmed = rawPath.trim()

	if (trimmed.length === 0) return null

	if (trimmed.startsWith('#')) return null

	const absolutePath = isAbsolute(trimmed) ? resolve(trimmed) : resolve(cwd, trimmed)
	const relativePath = relative(cwd, absolutePath).split(sep).join('/')

	// cwd itself is a valid directory selection (`--files .`).
	if (relativePath === '') return '.'

	if (relativePath === '..' || relativePath.startsWith('../')) {
		return null
	}

	if (patdownPathIsExcluded(relativePath)) return null

	return relativePath
}

function toPatdownRelativePath(cwd: string, absolutePath: string): string | null {
	const relativePath = relative(cwd, absolutePath).split(sep).join('/')

	if (relativePath === '' || relativePath === '..' || relativePath.startsWith('../')) {
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

function readPatdownFilesFromStdin(): Effect.Effect<string, PatdownJudgeFailed, Stdio.Stdio> {
	return Effect.gen(function* () {
		const stdio = yield* Stdio.Stdio

		if (yield* stdio.stdinIsTerminal) {
			return yield* new PatdownJudgeFailed({
				message: 'patdown: --files-from - requires piped or redirected input',
			})
		}

		return yield* stdio.stdin.pipe(
			Stream.decodeText(),
			Stream.mkString,
			Effect.mapError(
				() => new PatdownJudgeFailed({ message: 'patdown: failed to read --files-from -' }),
			),
		)
	})
}

function globPatdownSelectionPaths(
	cwd: string,
	pattern: string,
): Effect.Effect<ReadonlyArray<string>, PatdownJudgeFailed, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem

		const found = yield* fileSystem
			.glob(pattern, {
				exclude: patdownGlobExcludes,
				root: cwd,
			})
			.pipe(
				Effect.mapError(
					() =>
						new PatdownJudgeFailed({
							message: `patdown: failed to expand ${pattern}`,
						}),
				),
			)

		const relativePaths: string[] = []

		for (const match of found) {
			// Effect FileSystem.glob with `root` returns paths relative to that root.
			const absolutePath = isAbsolute(match) ? match : resolve(cwd, match)
			const relativePath = toPatdownRelativePath(cwd, absolutePath)

			if (relativePath === null) continue

			const info = yield* fileSystem.stat(absolutePath).pipe(Effect.option)

			if (Option.isNone(info) || info.value.type !== 'File') continue

			relativePaths.push(relativePath)
		}

		return relativePaths
	})
}

function patdownDirectorySelectionPattern(relativePath: string): string {
	return relativePath === '.' ? '**/*' : `${relativePath}/**/*`
}

function expandPatdownDirectoryOrLink(
	cwd: string,
	relativePath: string,
	infoType: 'Directory' | 'SymbolicLink',
): Effect.Effect<ReadonlyArray<string>, PatdownJudgeFailed, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const underPath = yield* globPatdownSelectionPaths(
			cwd,
			patdownDirectorySelectionPattern(relativePath),
		)

		if (underPath.length > 0 || infoType === 'Directory') return underPath

		return [relativePath]
	})
}

/**
 * Expand one --files / --files-from entry. Directories become every file under them. Globs expand
 * against cwd. Plain files stay as themselves. Missing paths fail.
 */
export function expandPatdownSelectionEntry(
	cwd: string,
	rawPath: string,
): Effect.Effect<ReadonlyArray<string>, PatdownJudgeFailed, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const relativePath = normalizePatdownRelativePath(cwd, rawPath)

		if (relativePath === null) return []

		if (patdownPathLooksLikeGlob(relativePath)) {
			return yield* globPatdownSelectionPaths(cwd, relativePath)
		}

		const fileSystem = yield* FileSystem.FileSystem
		const absolutePath = resolve(cwd, relativePath)

		const info = yield* fileSystem.stat(absolutePath).pipe(
			Effect.mapError(
				() =>
					new PatdownJudgeFailed({
						message: `patdown: --files path not found: ${relativePath}`,
					}),
			),
		)

		if (info.type === 'Directory' || info.type === 'SymbolicLink') {
			return yield* expandPatdownDirectoryOrLink(cwd, relativePath, info.type)
		}

		if (info.type === 'File') {
			return [relativePath]
		}

		return yield* new PatdownJudgeFailed({
			message: `patdown: --files path is not a file or directory: ${relativePath}`,
		})
	})
}

function expandPatdownSelectionEntries(
	cwd: string,
	entries: ReadonlyArray<string>,
): Effect.Effect<ReadonlyArray<string>, PatdownJudgeFailed, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const paths: string[] = []

		for (const entry of entries) {
			paths.push(...(yield* expandPatdownSelectionEntry(cwd, entry)))
		}

		return [...new Set(paths)].toSorted()
	})
}

/**
 * Builds the optional lint path list. --files and --files-from may be combined. Directories and
 * globs expand. `--files-from -` reads newline-separated paths from stdin. Missing list files and
 * missing --files paths fail. Empty selections stay empty and still succeed.
 */
export function resolvePatdownLintFileSelection(
	cwd: string,
	files: ReadonlyArray<string>,
	filesFrom: Option.Option<string>,
): Effect.Effect<
	PatdownLintFileSelection | null,
	PatdownJudgeFailed,
	FileSystem.FileSystem | Stdio.Stdio
> {
	return Effect.gen(function* () {
		if (files.length === 0 && Option.isNone(filesFrom)) return null

		const entries: string[] = [...files]

		if (Option.isSome(filesFrom)) {
			if (filesFrom.value === '-') {
				const text = yield* readPatdownFilesFromStdin()

				entries.push(...parsePatdownFilesFromText(cwd, text))
			} else {
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

				entries.push(...parsePatdownFilesFromText(cwd, text))
			}
		}

		const relativePaths = yield* expandPatdownSelectionEntries(cwd, entries)

		return { relativePaths }
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
