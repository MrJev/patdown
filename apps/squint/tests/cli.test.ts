import { NodeServices } from '@effect/platform-node'
import { describe, expect, it } from '@effect/vitest'
import { JevSystemOne } from '@squint/jev'
import { SquintRuleSource, SquintRulesFileMissing, type SquintRulesDocument } from '@squint/rules'
import { Effect, Layer } from 'effect'
import { TestConsole } from 'effect/testing'
import { CliOutput, Command } from 'effect/unstable/cli'
import { FetchHttpClient } from 'effect/unstable/http'

import { squintCommand } from '#/cli'
import { SquintOutputLive } from '#/squint-output'

const sampleDocument: SquintRulesDocument = {
	squintRules: [
		{
			squintRuleBody: 'Use sentence case.',
			squintRuleGlobs: ['**/*.md'],
			squintRuleTitle: 'No title case',
		},
	],
	squintRulesFilePath: '/tmp/AGENTS.SQUINT.md',
}

const succeedingSource = Layer.succeed(SquintRuleSource, {
	loadSquintRules: (_rulesFilePathOverride) => Effect.succeed(sampleDocument),
})

const missingSource = Layer.succeed(SquintRuleSource, {
	loadSquintRules: (_rulesFilePathOverride) =>
		Effect.fail(
			new SquintRulesFileMissing({
				squintRulesFileName: 'AGENTS.SQUINT.md',
				startDirectory: '/tmp',
			}),
		),
})

const jevSource = Layer.succeed(JevSystemOne, {
	askNoul: (_instructions, _state) => Effect.succeed({ noul: 0.81, type: 'noul' as const }),
})

const cliHarnessLayer = Layer.mergeAll(
	NodeServices.layer,
	TestConsole.layer,
	CliOutput.layer(CliOutput.defaultFormatter({ colors: false })),
	FetchHttpClient.layer,
	SquintOutputLive,
)

const runSquint = Command.runWith(squintCommand, { version: '0.0.0' })

describe('squint CLI', () => {
	it.layer(Layer.mergeAll(succeedingSource, jevSource, cliHarnessLayer))((layeredIt) => {
		layeredIt.effect('prints loaded rule titles from the rules command', () =>
			Effect.gen(function* () {
				yield* runSquint(['rules'])
				const lines = yield* TestConsole.logLines
				expect(lines.join('\n')).toContain('squint: 1 rules from /tmp/AGENTS.SQUINT.md')
				expect(lines.join('\n')).toContain('No title case')
				expect(lines.join('\n')).toContain('globs: **/*.md')
			}),
		)
	})

	it.layer(Layer.mergeAll(missingSource, jevSource, cliHarnessLayer))((layeredIt) => {
		layeredIt.effect('fails quietly when the rules file is missing', () =>
			Effect.gen(function* () {
				const previousExitCode = process.exitCode
				yield* runSquint([])
				expect(process.exitCode).toBe(1)
				process.exitCode = previousExitCode
			}),
		)
	})

	it.layer(Layer.mergeAll(succeedingSource, jevSource, cliHarnessLayer))((layeredIt) => {
		layeredIt.effect('prints a yes/no decision from ask', () =>
			Effect.gen(function* () {
				yield* runSquint(['ask', '--noul', 'Is this urgent?', '--state', 'ASAP'])
				const lines = yield* TestConsole.logLines
				expect(lines.at(-1)).toBe('squint: no (0.81, thresh 0.85)')
			}),
		)
	})
})
