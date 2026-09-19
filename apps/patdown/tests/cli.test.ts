import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { NodeServices } from '@effect/platform-node'
import { describe, expect, it } from '@effect/vitest'
import {
	PatdownRuleSource,
	PatdownRulesFileMissing,
	type PatdownRulesDocument,
} from '@patdown/rules'
import { Effect, Layer } from 'effect'
import { TestConsole } from 'effect/testing'
import { CliOutput, Command } from 'effect/unstable/cli'

import { patdownCommand } from '#src/cli'
import { PatdownJudge } from '#src/patdown-judge'
import { PatdownOutputLive } from '#src/patdown-output'

const sampleDocument: PatdownRulesDocument = {
	patdownRules: [
		{
			patdownRuleBody: 'Use sentence case.',
			patdownRuleGlobs: ['**/*.md'],
			patdownRuleTitle: 'No title case',
		},
	],
	patdownRulesFilePath: '/tmp/AGENTS.PATDOWN.md',
}

const succeedingSource = Layer.succeed(PatdownRuleSource, {
	loadPatdownRules: (_rulesFilePathOverride) => Effect.succeed(sampleDocument),
})

const missingSource = Layer.succeed(PatdownRuleSource, {
	loadPatdownRules: (_rulesFilePathOverride) =>
		Effect.fail(
			new PatdownRulesFileMissing({
				patdownRulesFileName: 'AGENTS.PATDOWN.md',
				startDirectory: '/tmp',
			}),
		),
})

const judgeSource = Layer.succeed(PatdownJudge, {
	ask: (_question, _text) => Effect.succeed({ yesProbability: 0.81 }),
})

const cliHarnessLayer = Layer.mergeAll(
	NodeServices.layer,
	TestConsole.layer,
	CliOutput.layer(CliOutput.defaultFormatter({ colors: false })),
	PatdownOutputLive,
)

const runPatdown = Command.runWith(patdownCommand, { version: '0.0.0' })

describe('patdown CLI', () => {
	it.layer(Layer.mergeAll(succeedingSource, judgeSource, cliHarnessLayer))((layeredIt) => {
		layeredIt.effect('prints loaded rule titles from the rules command', () =>
			Effect.gen(function* () {
				yield* runPatdown(['rules'])
				const lines = yield* TestConsole.logLines
				expect(lines.join('\n')).toContain('patdown: 1 rules from /tmp/AGENTS.PATDOWN.md')
				expect(lines.join('\n')).toContain('No title case')
				expect(lines.join('\n')).toContain('globs: **/*.md')
			}),
		)
	})

	it.layer(Layer.mergeAll(missingSource, judgeSource, cliHarnessLayer))((layeredIt) => {
		layeredIt.effect('fails quietly when the rules file is missing', () =>
			Effect.gen(function* () {
				const previousExitCode = process.exitCode
				yield* runPatdown([])
				expect(process.exitCode).toBe(1)
				process.exitCode = previousExitCode
			}),
		)
	})

	it.layer(Layer.mergeAll(succeedingSource, judgeSource, cliHarnessLayer))((layeredIt) => {
		layeredIt.effect('ask ignores a broken adapter and prints a yes/no decision', () =>
			Effect.gen(function* () {
				const cwd = process.cwd()
				const directory = mkdtempSync(join(tmpdir(), 'patdown-ask-'))
				writeFileSync(join(directory, 'package.json'), '{broken')
				process.chdir(directory)

				try {
					yield* runPatdown(['ask', 'Is this urgent?', '--input-text', 'ASAP'])
					const lines = yield* TestConsole.logLines
					expect(lines.at(-1)).toBe('no')
				} finally {
					process.chdir(cwd)
					rmSync(directory, { recursive: true, force: true })
				}
			}),
		)
	})
})
