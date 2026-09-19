import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { NodeServices } from '@effect/platform-node'
import { afterEach, describe, expect, it } from '@effect/vitest'
import { MarkdownPatdownRuleSourceLive, PatdownRuleSource } from '@patdown/rules'
import { Effect, Layer, Option } from 'effect'
import { TestConsole } from 'effect/testing'
import { CliOutput, Command } from 'effect/unstable/cli'

import { patdownCommand } from '#src/cli'
import { PatdownJudge } from '#src/patdown-judge'
import { PatdownOutputLive } from '#src/patdown-output'

const directories: string[] = []

afterEach(() => {
	for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function packDirectory(): string {
	const directory = mkdtempSync(join(tmpdir(), 'patdown-pack-cli-'))
	directories.push(directory)

	return directory
}

const judgeSource = Layer.succeed(PatdownJudge, {
	ask: () => Effect.succeed({ yesProbability: 0.1 }),
})

const cliHarnessLayer = Layer.mergeAll(
	MarkdownPatdownRuleSourceLive,
	judgeSource,
	NodeServices.layer,
	TestConsole.layer,
	CliOutput.layer(CliOutput.defaultFormatter({ colors: false })),
	PatdownOutputLive,
)

const runPatdown = Command.runWith(patdownCommand, { version: '0.0.0' })

describe('pack directories', () => {
	it.layer(cliHarnessLayer)((layeredIt) => {
		layeredIt.effect('loads every rule markdown file from --rules <dir>', () =>
			Effect.gen(function* () {
				const directory = packDirectory()
				writeFileSync(join(directory, 'README.md'), '# typescript pack\n\nNot a rule.\n')
				writeFileSync(
					join(directory, 'prefer-unions.md'),
					'# Prefer unions\nglobs: **/*.ts\n\nUse unions.\n',
				)
				writeFileSync(
					join(directory, 'no-casts.md'),
					'# No casts\nglobs: **/*.ts\nglobs: **/*.tsx\n\nDo not cast.\n',
				)

				yield* runPatdown(['rules', '--rules', directory])
				const lines = yield* TestConsole.logLines
				const text = lines.join('\n')

				expect(text).toContain(`patdown: 2 rules from ${directory}`)
				expect(text).toContain('Prefer unions')
				expect(text).toContain('No casts')
				expect(text).toContain('globs: **/*.ts **/*.tsx')
			}),
		)
	})

	it.effect('rejects an empty pack directory through the rule source', () =>
		Effect.gen(function* () {
			const directory = packDirectory()
			writeFileSync(join(directory, 'README.md'), '# empty pack\n')

			const source = yield* PatdownRuleSource
			const error = yield* source.loadPatdownRules(Option.some(directory)).pipe(Effect.flip)

			expect(error.message).toContain('has no rule markdown files')
		}).pipe(Effect.provide(Layer.mergeAll(MarkdownPatdownRuleSourceLive, NodeServices.layer))),
	)
})
