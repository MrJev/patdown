import { JevRequestFailed, JevSystemOne } from '@patdown/jev'
import { PatdownRuleSource, PatdownRulesFileMissing, PatdownRulesReadFailed } from '@patdown/rules'
import { Effect, FileSystem, Path } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import type { HttpClient } from 'effect/unstable/http'

import { runPatdownLint } from '#/patdown-lint'
import { PatdownOutput } from '#/patdown-output'

const failPatdown = (message: string): Effect.Effect<void> =>
	Effect.sync(() => {
		process.exitCode = 1
		process.stderr.write(`${message}\n`)
	})

const rulesFileFlag = Flag.optional(Flag.string('rules')).pipe(
	Flag.withDescription('Rules file path, skipping the AGENTS.PATDOWN.md walk'),
)

type PatdownLintServices =
	| FileSystem.FileSystem
	| HttpClient.HttpClient
	| JevSystemOne
	| Path.Path
	| PatdownOutput
	| PatdownRuleSource

const rulesCommand = Command.make(
	'rules',
	{ rules: rulesFileFlag },
	({
		rules,
	}): Effect.Effect<
		void,
		never,
		FileSystem.FileSystem | Path.Path | PatdownOutput | PatdownRuleSource
	> =>
		Effect.gen(function* () {
			const patdownRuleSource = yield* PatdownRuleSource
			const output = yield* PatdownOutput
			const document = yield* patdownRuleSource.loadPatdownRules(rules)

			yield* output.writeRulesDocument(document)
		}).pipe(
			Effect.catchTags({
				PatdownRulesFileMissing: (error: PatdownRulesFileMissing) => failPatdown(error.message),
				PatdownRulesReadFailed: (error: PatdownRulesReadFailed) => failPatdown(error.message),
			}),
		),
).pipe(Command.withDescription('Load and print patdown rules'))

const askCommand = Command.make(
	'ask',
	{
		noul: Flag.string('noul').pipe(Flag.withDescription('Noul (yes/no) question for Jev')),
		state: Flag.string('state').pipe(
			Flag.withDefault(''),
			Flag.withDescription('State text for Jev to evaluate'),
		),
	},
	({
		noul,
		state,
	}): Effect.Effect<void, never, HttpClient.HttpClient | JevSystemOne | PatdownOutput> =>
		Effect.gen(function* () {
			const jev = yield* JevSystemOne
			const output = yield* PatdownOutput
			const answer = yield* jev.askNoul(noul, state)

			yield* output.writeNoulDecision(answer.noul)
		}).pipe(
			Effect.catchTags({
				JevRequestFailed: (error: JevRequestFailed) => failPatdown(error.message),
			}),
		),
).pipe(Command.withDescription('Ask Jev a noul question via TypeSafe System One'))

function finishPatdownLint(failed: boolean): Effect.Effect<void, never, PatdownOutput> {
	return Effect.gen(function* () {
		const output = yield* PatdownOutput

		if (failed) {
			yield* output.writeLintFailed()
			yield* Effect.sync(() => {
				process.exitCode = 1
			})

			return
		}

		yield* output.writeLintOk()
	})
}

/** Root Effect CLI command for patdown. Default action lints files against AGENTS.PATDOWN.md. */
export const patdownCommand = Command.make(
	'patdown',
	{ rules: rulesFileFlag },
	({ rules }): Effect.Effect<void, never, PatdownLintServices> =>
		Effect.gen(function* () {
			const patdownRuleSource = yield* PatdownRuleSource
			const document = yield* patdownRuleSource.loadPatdownRules(rules)
			const failed = yield* runPatdownLint(document)

			yield* finishPatdownLint(failed)
		}).pipe(
			Effect.catchTags({
				JevRequestFailed: (error: JevRequestFailed) => failPatdown(error.message),
				PatdownRulesFileMissing: (error: PatdownRulesFileMissing) => failPatdown(error.message),
				PatdownRulesReadFailed: (error: PatdownRulesReadFailed) => failPatdown(error.message),
			}),
		),
).pipe(
	Command.withDescription('Lint a tree against fuzzy markdown rules'),
	Command.withShortDescription('Patdown CLI'),
	Command.withSubcommands([askCommand, rulesCommand]),
)
