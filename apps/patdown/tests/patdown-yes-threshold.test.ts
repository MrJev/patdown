import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { NodeServices } from '@effect/platform-node'
import { afterEach, describe, expect, it } from '@effect/vitest'
import { MarkdownPatdownRuleSourceLive } from '@patdown/rules'
import { Effect, Layer, Option } from 'effect'
import { TestConsole } from 'effect/testing'

import { PatdownJudge } from '#src/patdown-judge'
import { PatdownOutputLive } from '#src/patdown-output'
import { resolvePatdownYesThreshold } from '#src/patdown-yes-threshold-config'
import { runPatdownCli } from '#src/run-patdown-cli'

const directories: string[] = []

const originalCwd = process.cwd()

function projectDirectory(): string {
	const directory = mkdtempSync(join(tmpdir(), 'patdown-threshold-'))
	directories.push(directory)

	return directory
}

afterEach(() => {
	process.chdir(originalCwd)

	for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

const outputHarness = Layer.mergeAll(PatdownOutputLive, TestConsole.layer, NodeServices.layer)

describe('configurable yes thresholds', () => {
	it.effect('CLI flag wins over package.json', () =>
		Effect.gen(function* () {
			const root = projectDirectory()
			writeFileSync(join(root, 'package.json'), JSON.stringify({ patdown: { yesThreshold: 0.5 } }))
			process.chdir(root)
			expect(yield* resolvePatdownYesThreshold(Option.none())).toBe(0.5)
			expect(yield* resolvePatdownYesThreshold(Option.some(0.9))).toBe(0.9)
		}).pipe(Effect.provide(NodeServices.layer)),
	)

	it.effect('rejects an invalid package.json cutoff', () =>
		Effect.gen(function* () {
			const root = projectDirectory()
			writeFileSync(join(root, 'package.json'), JSON.stringify({ patdown: { yesThreshold: 1 } }))
			process.chdir(root)
			const error = yield* Effect.flip(resolvePatdownYesThreshold(Option.none()))
			expect(error.message).toContain('[0, 1)')
		}).pipe(Effect.provide(NodeServices.layer)),
	)

	it.effect('ask ignores broken adapter JSON when reading a cutoff', () =>
		Effect.gen(function* () {
			const root = projectDirectory()
			writeFileSync(join(root, 'package.json'), '{broken')
			process.chdir(root)
			expect(yield* resolvePatdownYesThreshold(Option.none())).toBe(0.85)
		}).pipe(Effect.provide(NodeServices.layer)),
	)

	it.effect('applies a per-rule cutoff during lint', () =>
		Effect.gen(function* () {
			const root = projectDirectory()
			writeFileSync(
				join(root, 'AGENTS.PATDOWN.md'),
				[
					'# Strict headings',
					'globs: **/*.md',
					'yes-threshold: 0.8',
					'',
					'Use sentence case.',
					'',
				].join('\n'),
			)
			writeFileSync(join(root, 'README.md'), '# Hello World\n')
			process.chdir(root)
			const previousExitCode = process.exitCode

			const judge = Layer.succeed(PatdownJudge, {
				ask: () => Effect.succeed({ yesProbability: 0.81 }),
			})

			yield* runPatdownCli(MarkdownPatdownRuleSourceLive, ['--verbose', '--no-github'], judge)

			const lines = yield* TestConsole.logLines
			const text = lines.join('\n')

			expect(text).toContain('┌ Strict headings')
			expect(text).toContain('README.md')
			expect(text).toContain('0.81')
			expect(process.exitCode).toBe(1)
			process.exitCode = previousExitCode
		}).pipe(Effect.provide(outputHarness)),
	)
})
