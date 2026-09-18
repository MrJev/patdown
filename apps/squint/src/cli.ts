import { JevRequestFailed, JevSystemOne } from '@squint/jev'
import { SquintRuleSource, SquintRulesFileMissing, SquintRulesReadFailed } from '@squint/rules'
import { Effect, FileSystem, Path } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import type { HttpClient } from 'effect/unstable/http'

import { runSquintLint } from '#/squint-lint'
import { SquintOutput } from '#/squint-output'

const failSquint = (message: string): Effect.Effect<void> =>
	Effect.sync(() => {
		process.exitCode = 1
		process.stderr.write(`${message}\n`)
	})

const rulesFileFlag = Flag.optional(Flag.string('rules')).pipe(
	Flag.withDescription('Rules file path, skipping the AGENTS.SQUINT.md walk'),
)

type SquintLintServices =
	| FileSystem.FileSystem
	| HttpClient.HttpClient
	| JevSystemOne
	| Path.Path
	| SquintOutput
	| SquintRuleSource

const rulesCommand = Command.make(
	'rules',
	{ rules: rulesFileFlag },
	({
		rules,
	}): Effect.Effect<
		void,
		never,
		FileSystem.FileSystem | Path.Path | SquintOutput | SquintRuleSource
	> =>
		Effect.gen(function* () {
			const squintRuleSource = yield* SquintRuleSource
			const output = yield* SquintOutput
			const document = yield* squintRuleSource.loadSquintRules(rules)

			yield* output.writeRulesDocument(document)
		}).pipe(
			Effect.catchTags({
				SquintRulesFileMissing: (error: SquintRulesFileMissing) => failSquint(error.message),
				SquintRulesReadFailed: (error: SquintRulesReadFailed) => failSquint(error.message),
			}),
		),
).pipe(Command.withDescription('Load and print squint rules'))

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
	}): Effect.Effect<void, never, HttpClient.HttpClient | JevSystemOne | SquintOutput> =>
		Effect.gen(function* () {
			const jev = yield* JevSystemOne
			const output = yield* SquintOutput
			const answer = yield* jev.askNoul(noul, state)

			yield* output.writeNoulDecision(answer.noul)
		}).pipe(
			Effect.catchTags({
				JevRequestFailed: (error: JevRequestFailed) => failSquint(error.message),
			}),
		),
).pipe(Command.withDescription('Ask Jev a noul question via TypeSafe System One'))

function finishSquintLint(failed: boolean): Effect.Effect<void, never, SquintOutput> {
	return Effect.gen(function* () {
		const output = yield* SquintOutput

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

/** Root Effect CLI command for squint. Default action lints files against AGENTS.SQUINT.md. */
export const squintCommand = Command.make(
	'squint',
	{ rules: rulesFileFlag },
	({ rules }): Effect.Effect<void, never, SquintLintServices> =>
		Effect.gen(function* () {
			const squintRuleSource = yield* SquintRuleSource
			const document = yield* squintRuleSource.loadSquintRules(rules)
			const failed = yield* runSquintLint(document)

			yield* finishSquintLint(failed)
		}).pipe(
			Effect.catchTags({
				JevRequestFailed: (error: JevRequestFailed) => failSquint(error.message),
				SquintRulesFileMissing: (error: SquintRulesFileMissing) => failSquint(error.message),
				SquintRulesReadFailed: (error: SquintRulesReadFailed) => failSquint(error.message),
			}),
		),
).pipe(
	Command.withDescription('Lint a tree against fuzzy markdown rules'),
	Command.withShortDescription('Squint CLI'),
	Command.withSubcommands([askCommand, rulesCommand]),
)
