import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { NodeServices } from '@effect/platform-node'
import { describe, expect, it } from '@effect/vitest'
import { JevSystemOne } from '@patdown/jev'
import {
	PatdownRuleSource,
	PatdownRulesFileMissing,
	type PatdownRulesDocument,
} from '@patdown/rules'
import { Effect, Layer } from 'effect'
import { TestConsole } from 'effect/testing'
import { CliOutput, Command } from 'effect/unstable/cli'
import { FetchHttpClient } from 'effect/unstable/http'

import { patdownCommand } from '#/cli'
import { PatdownOutputLive } from '#/patdown-output'

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

const jevSource = Layer.succeed(JevSystemOne, {
	askNoul: (_instructions, _state) => Effect.succeed({ noul: 0.81, type: 'noul' as const }),
})

const cliHarnessLayer = Layer.mergeAll(
	NodeServices.layer,
	TestConsole.layer,
	CliOutput.layer(CliOutput.defaultFormatter({ colors: false })),
	FetchHttpClient.layer,
	PatdownOutputLive,
)

const runPatdown = Command.runWith(patdownCommand, { version: '0.0.0' })

describe('patdown CLI', () => {
	it.layer(Layer.mergeAll(succeedingSource, jevSource, cliHarnessLayer))((layeredIt) => {
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

	it.layer(Layer.mergeAll(missingSource, jevSource, cliHarnessLayer))((layeredIt) => {
		layeredIt.effect('fails quietly when the rules file is missing', () =>
			Effect.gen(function* () {
				const previousExitCode = process.exitCode
				yield* runPatdown([])
				expect(process.exitCode).toBe(1)
				process.exitCode = previousExitCode
			}),
		)
	})

	it.layer(Layer.mergeAll(succeedingSource, jevSource, cliHarnessLayer))((layeredIt) => {
		layeredIt.effect('ask ignores a broken adapter and prints a yes/no decision', () =>
			Effect.gen(function* () {
				const cwd = process.cwd()
				const directory = mkdtempSync(join(tmpdir(), 'patdown-ask-'))
				writeFileSync(join(directory, 'package.json'), '{broken')
				process.chdir(directory)

				try {
					yield* runPatdown(['ask', '--noul', 'Is this urgent?', '--state', 'ASAP'])
					const lines = yield* TestConsole.logLines
					expect(lines.at(-1)).toBe('patdown: no (0.81, thresh 0.85)')
				} finally {
					process.chdir(cwd)
					rmSync(directory, { recursive: true, force: true })
				}
			}),
		)
	})
})
