import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { NodeServices } from '@effect/platform-node'
import { afterEach, describe, expect, it } from '@effect/vitest'
import { Effect, Layer, Option, Stdio, Stream } from 'effect'

import {
	expandPatdownSelectionEntry,
	patdownPathLooksLikeGlob,
	resolvePatdownLintFileSelection,
	selectPatdownRuleFiles,
} from '#src/patdown-lint-files'

const directories: string[] = []

afterEach(() => {
	for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function tempDirectory(): string {
	const directory = mkdtempSync(join(tmpdir(), 'patdown-files-'))
	directories.push(directory)

	return directory
}

describe('lint file selection', () => {
	it.effect('returns null when neither flag is set', () =>
		Effect.gen(function* () {
			const selection = yield* resolvePatdownLintFileSelection('/tmp', [], Option.none())

			expect(selection).toBeNull()
		}).pipe(Effect.provide(NodeServices.layer)),
	)

	it.effect('expands directories and globs, and drops excluded paths', () =>
		Effect.gen(function* () {
			const cwd = tempDirectory()

			mkdirSync(join(cwd, 'src'), { recursive: true })
			mkdirSync(join(cwd, 'docs'), { recursive: true })
			mkdirSync(join(cwd, 'node_modules'), { recursive: true })
			writeFileSync(join(cwd, 'README.md'), '# Hi\n')
			writeFileSync(join(cwd, 'src/cli.ts'), 'export {}\n')
			writeFileSync(join(cwd, 'docs/guide.md'), '# Guide\n')
			writeFileSync(join(cwd, 'node_modules/x.js'), 'export {}\n')

			const fromDirectory = yield* resolvePatdownLintFileSelection(cwd, ['src'], Option.none())

			expect(fromDirectory?.relativePaths).toEqual(['src/cli.ts'])

			const fromGlob = yield* resolvePatdownLintFileSelection(cwd, ['**/*.md'], Option.none())

			expect(fromGlob?.relativePaths).toEqual(['README.md', 'docs/guide.md'])

			const error = yield* resolvePatdownLintFileSelection(cwd, ['missing.ts'], Option.none()).pipe(
				Effect.flip,
			)

			expect(error.message).toContain('--files path not found')
		}).pipe(Effect.provide(NodeServices.layer)),
	)

	it.effect('reads --files-from lists and stdin, and fails when the list is missing', () =>
		Effect.gen(function* () {
			const cwd = tempDirectory()

			mkdirSync(join(cwd, 'apps'), { recursive: true })
			writeFileSync(join(cwd, 'README.md'), '# Hi\n')
			writeFileSync(join(cwd, 'apps/a.ts'), 'export {}\n')
			writeFileSync(
				join(cwd, 'changed.txt'),
				['# comment', 'apps/a.ts', '', 'apps/a.ts'].join('\n'),
			)

			const selection = yield* resolvePatdownLintFileSelection(
				cwd,
				['README.md'],
				Option.some('changed.txt'),
			)

			expect(selection?.relativePaths).toEqual(['README.md', 'apps/a.ts'])

			const error = yield* resolvePatdownLintFileSelection(
				cwd,
				[],
				Option.some('missing.txt'),
			).pipe(Effect.flip)

			expect(error.message).toContain('--files-from')

			const fromStdin = yield* resolvePatdownLintFileSelection(cwd, [], Option.some('-'))

			expect(fromStdin?.relativePaths).toEqual(['apps/a.ts'])
		}).pipe(
			Effect.provide(
				Stdio.layerTest({
					stdin: Stream.make(new TextEncoder().encode('apps/a.ts\n')),
					stdinIsTerminal: Effect.succeed(false),
				}).pipe(Layer.provideMerge(NodeServices.layer)),
			),
		),
	)

	it.effect('expands a single directory entry', () =>
		Effect.gen(function* () {
			const cwd = tempDirectory()

			mkdirSync(join(cwd, 'apps/web/src'), { recursive: true })
			writeFileSync(join(cwd, 'apps/web/src/app.ts'), 'export {}\n')
			writeFileSync(join(cwd, 'apps/web/README.md'), '# Web\n')

			const paths = yield* expandPatdownSelectionEntry(cwd, 'apps/web')

			expect(paths).toEqual(['apps/web/README.md', 'apps/web/src/app.ts'])
		}).pipe(Effect.provide(NodeServices.layer)),
	)

	it('detects glob metacharacters', () => {
		expect(patdownPathLooksLikeGlob('apps/**/*.ts')).toBe(true)
		expect(patdownPathLooksLikeGlob('apps/web')).toBe(false)
	})

	it('intersects an explicit list with rule globs without globbing the tree', () => {
		const cwd = tempDirectory()

		const selection = {
			relativePaths: ['README.md', 'src/cli.ts', 'docs/guide.md'],
		}

		expect(selectPatdownRuleFiles(cwd, selection, ['**/*.md'], [])).toEqual([
			join(cwd, 'README.md'),
			join(cwd, 'docs/guide.md'),
		])

		expect(selectPatdownRuleFiles(cwd, null, ['**/*.md'], [join(cwd, 'only.ts')])).toEqual([
			join(cwd, 'only.ts'),
		])
	})
})
