import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { NodeServices } from '@effect/platform-node'
import { afterEach, describe, expect, it } from '@effect/vitest'
import { MarkdownPatdownRuleSourceLive } from '@patdown/rules'
import { Effect, Layer } from 'effect'
import { TestConsole } from 'effect/testing'

import { PatdownJudge } from '#src/patdown-judge'
import { PatdownOutputLive } from '#src/patdown-output'
import { runPatdownCli } from '#src/run-patdown-cli'

const directories: string[] = []

const originalCwd = process.cwd()

afterEach(() => {
	process.chdir(originalCwd)

	for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function projectDirectory(): string {
	const directory = mkdtempSync(join(tmpdir(), 'patdown-files-cli-'))
	directories.push(directory)

	return directory
}

const outputHarness = Layer.mergeAll(PatdownOutputLive, TestConsole.layer, NodeServices.layer)

describe('lint file flags', () => {
	it.effect('intersects --files with rule globs and skips unmatched rules quietly', () =>
		Effect.gen(function* () {
			const root = projectDirectory()

			writeFileSync(
				join(root, 'AGENTS.PATDOWN.md'),
				[
					'# Markdown only',
					'globs: **/*.md',
					'',
					'Use sentence case.',
					'',
					'# TypeScript only',
					'globs: **/*.ts',
					'',
					'Prefer explicit actors.',
					'',
				].join('\n'),
			)
			writeFileSync(join(root, 'README.md'), '# Hello World\n')
			writeFileSync(join(root, 'service.ts'), 'export const x = 1\n')
			process.chdir(root)

			const asked: string[] = []

			const judge = Layer.succeed(PatdownJudge, {
				ask: (question, text) =>
					Effect.sync(() => {
						asked.push(`${question}\n${text}`)

						return { yesProbability: 0.1 }
					}),
			})

			yield* runPatdownCli(MarkdownPatdownRuleSourceLive, ['--files', 'service.ts'], judge)

			const lines = yield* TestConsole.logLines

			expect(asked).toHaveLength(1)
			expect(asked[0]).toContain('path: service.ts')
			expect(lines.join('\n')).toContain('patdown: linting 1 file against 2 rules')
			expect(lines.join('\n')).not.toContain('no files matched')
			expect(lines.join('\n')).toContain('PASS service.ts: TypeScript only')
			expect(lines.join('\n')).not.toContain('README.md')
		}).pipe(Effect.provide(outputHarness)),
	)

	it.effect('expands a --files directory before intersecting rule globs', () =>
		Effect.gen(function* () {
			const root = projectDirectory()
			const src = join(root, 'src')

			mkdirSync(src, { recursive: true })
			writeFileSync(
				join(root, 'AGENTS.PATDOWN.md'),
				['# TypeScript only', 'globs: **/*.ts', '', 'Prefer explicit actors.', ''].join('\n'),
			)
			writeFileSync(join(root, 'README.md'), '# Hello World\n')
			writeFileSync(join(src, 'service.ts'), 'export const x = 1\n')
			process.chdir(root)

			const asked: string[] = []

			const judge = Layer.succeed(PatdownJudge, {
				ask: (question, text) =>
					Effect.sync(() => {
						asked.push(`${question}\n${text}`)

						return { yesProbability: 0.1 }
					}),
			})

			yield* runPatdownCli(MarkdownPatdownRuleSourceLive, ['--files', 'src'], judge)

			const lines = yield* TestConsole.logLines

			expect(asked).toHaveLength(1)
			expect(asked[0]).toContain('path: src/service.ts')
			expect(lines.join('\n')).toContain('patdown: linting 1 file against 1 rule')
			expect(lines.join('\n')).toContain('PASS src/service.ts: TypeScript only')
		}).pipe(Effect.provide(outputHarness)),
	)
})
