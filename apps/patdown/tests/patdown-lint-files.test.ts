import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { NodeServices } from '@effect/platform-node'
import { afterEach, describe, expect, it } from '@effect/vitest'
import { Effect, Option } from 'effect'

import { resolvePatdownLintFileSelection, selectPatdownRuleFiles } from '#src/patdown-lint-files'

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

	it.effect('normalizes, dedupes, and drops excluded or outside paths', () =>
		Effect.gen(function* () {
			const cwd = tempDirectory()

			const selection = yield* resolvePatdownLintFileSelection(
				cwd,
				['./README.md', 'README.md', 'node_modules/x.js', '../outside.ts', 'src/cli.ts'],
				Option.none(),
			)

			expect(selection?.relativePaths).toEqual(['README.md', 'src/cli.ts'])
		}).pipe(Effect.provide(NodeServices.layer)),
	)

	it.effect('reads --files-from and fails when the list is missing', () =>
		Effect.gen(function* () {
			const cwd = tempDirectory()

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
		}).pipe(Effect.provide(NodeServices.layer)),
	)

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
