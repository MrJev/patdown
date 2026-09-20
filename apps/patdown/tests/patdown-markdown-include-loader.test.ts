import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { NodeServices } from '@effect/platform-node'
import { afterEach, describe, expect, it } from '@effect/vitest'
import { MarkdownPatdownRuleSourceLive, PatdownRuleSource } from '@patdown/rules'
import { Effect, Layer, Option } from 'effect'

const directories: string[] = []

const includeHarness = Layer.mergeAll(MarkdownPatdownRuleSourceLive, NodeServices.layer)

afterEach(() => {
	for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function tempDirectory(): string {
	const directory = mkdtempSync(join(tmpdir(), 'patdown-include-'))
	directories.push(directory)

	return directory
}

describe('markdown rule includes', () => {
	it.effect('loads included packs before local rules', () =>
		Effect.gen(function* () {
			const root = tempDirectory()
			const pack = join(root, 'typescript')
			mkdirSync(pack)
			writeFileSync(join(pack, 'README.md'), '# typescript pack\n')
			writeFileSync(
				join(pack, 'no-casts.md'),
				'# Do not launder types with casts\nglobs: **/*.ts\n\nDo not cast.\n',
			)
			writeFileSync(
				join(root, 'AGENTS.PATDOWN.md'),
				[
					'---',
					'include: ./typescript',
					'---',
					'',
					'# No title case',
					'globs: **/*.md',
					'',
					'Use sentence case.',
					'',
				].join('\n'),
			)

			const source = yield* PatdownRuleSource

			const document = yield* source.loadPatdownRules(Option.some(join(root, 'AGENTS.PATDOWN.md')))

			expect(document.patdownRules.map((rule) => rule.patdownRuleTitle)).toEqual([
				'Do not launder types with casts',
				'No title case',
			])
			expect(document.patdownRules[0]?.patdownRuleSourcePath).toBe(join(pack, 'no-casts.md'))
			expect(document.patdownRules[1]?.patdownRuleSourcePath).toBe(join(root, 'AGENTS.PATDOWN.md'))
		}).pipe(Effect.provide(includeHarness)),
	)

	it.effect('fails on duplicate titles across includes', () =>
		Effect.gen(function* () {
			const root = tempDirectory()
			writeFileSync(join(root, 'shared.md'), '# No title case\n\nFrom the pack.\n')
			writeFileSync(
				join(root, 'AGENTS.PATDOWN.md'),
				[
					'---',
					'include: ./shared.md',
					'---',
					'',
					'# No title case',
					'',
					'From the project.',
					'',
				].join('\n'),
			)

			const source = yield* PatdownRuleSource

			const error = yield* source
				.loadPatdownRules(Option.some(join(root, 'AGENTS.PATDOWN.md')))
				.pipe(Effect.flip)

			expect(error.message).toContain('duplicate rule title')
			expect(error.message).toContain('No title case')
		}).pipe(Effect.provide(includeHarness)),
	)

	it.effect('fails on include cycles', () =>
		Effect.gen(function* () {
			const root = tempDirectory()
			writeFileSync(join(root, 'a.md'), '---\ninclude: ./b.md\n---\n\n# A\n\nA.\n')
			writeFileSync(join(root, 'b.md'), '---\ninclude: ./a.md\n---\n\n# B\n\nB.\n')

			const source = yield* PatdownRuleSource

			const error = yield* source
				.loadPatdownRules(Option.some(join(root, 'a.md')))
				.pipe(Effect.flip)

			expect(error.message).toContain('include cycle')
		}).pipe(Effect.provide(includeHarness)),
	)

	it.effect('fails on include cycles through a symlink alias', () =>
		Effect.gen(function* () {
			const root = tempDirectory()
			writeFileSync(join(root, 'a.md'), '---\ninclude: ./alias-a.md\n---\n\n# A\n\nA.\n')
			symlinkSync(join(root, 'a.md'), join(root, 'alias-a.md'))

			const source = yield* PatdownRuleSource

			const error = yield* source
				.loadPatdownRules(Option.some(join(root, 'a.md')))
				.pipe(Effect.flip)

			expect(error.message).toContain('include cycle')
		}).pipe(Effect.provide(includeHarness)),
	)
})
