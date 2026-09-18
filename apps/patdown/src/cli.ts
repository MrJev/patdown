import { JevRequestFailed, JevSystemOne } from '@patdown/jev'
import {
	PatdownRuleSource,
	PatdownRulesFileMissing,
	PatdownRulesReadFailed,
	PatdownRulesLoadFailed,
} from '@patdown/rules'
import { Effect, FileSystem, Path } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import type { HttpClient } from 'effect/unstable/http'

import { runPatdownLint } from '#/patdown-lint'
import { PatdownOutput } from '#/patdown-output'
import { loadConfiguredPatdownRules } from '#/patdown-rule-source-adapter'

const failPatdown = (message: string): Effect.Effect<void> =>
	Effect.sync(() => {
		process.exitCode = 1
		process.stderr.write(`${message}\n`)
	})

const rulesFileFlag = Flag.optional(Flag.string('rules')).pipe(
	Flag.withDescription('Path passed to the rule source. Markdown skips the AGENTS.PATDOWN.md walk'),
)

const adapterFlag = Flag.optional(Flag.string('adapter')).pipe(
	Flag.withDescription('Module exporting PatdownRuleSourceLive, replacing markdown rule parsing'),
)

type PatdownLintServices =
	| FileSystem.FileSystem
	| HttpClient.HttpClient
	| JevSystemOne
	| Path.Path
	| PatdownOutput
	| PatdownRuleSource

function finishPatdownLint(failed: boolean): Effect.Effect<void, never, PatdownOutput> {
	return Effect.gen(function* () {
		const output = yield* PatdownOutput

		if (failed) {
			yield* output.writeLintFailed
			yield* Effect.sync(() => {
				process.exitCode = 1
			})

			return
		}

		yield* output.writeLintOk
	})
}

/** Builds commands with optional adapter discovery for embedded callers. */
export function makePatdownCommand(
	discoverAdapters: boolean = true,
): Command.Command<'patdown', never, object, never, PatdownLintServices> {
	const rulesCommand = Command.make(
		'rules',
		{ adapter: adapterFlag, rules: rulesFileFlag },
		({
			rules,
			adapter,
		}): Effect.Effect<
			void,
			never,
			FileSystem.FileSystem | Path.Path | PatdownOutput | PatdownRuleSource
		> =>
			Effect.gen(function* () {
				const patdownRuleSource = yield* PatdownRuleSource
				const output = yield* PatdownOutput

				const document = yield* discoverAdapters
					? loadConfiguredPatdownRules(adapter, rules)
					: patdownRuleSource.loadPatdownRules(rules)

				yield* output.writeRulesDocument(document)
			}).pipe(
				Effect.catchTags({
					PatdownRulesFileMissing: (error: PatdownRulesFileMissing) => failPatdown(error.message),
					PatdownRulesReadFailed: (error: PatdownRulesReadFailed) => failPatdown(error.message),
					PatdownRulesLoadFailed: (error: PatdownRulesLoadFailed) => failPatdown(error.message),
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

	/** Root Effect CLI command for patdown. Default action lints files against AGENTS.PATDOWN.md. */
	return Command.make(
		'patdown',
		{ adapter: adapterFlag, rules: rulesFileFlag },
		({ rules, adapter }): Effect.Effect<void, never, PatdownLintServices> =>
			Effect.gen(function* () {
				const patdownRuleSource = yield* PatdownRuleSource

				const document = yield* discoverAdapters
					? loadConfiguredPatdownRules(adapter, rules)
					: patdownRuleSource.loadPatdownRules(rules)

				const failed = yield* runPatdownLint(document)

				yield* finishPatdownLint(failed)
			}).pipe(
				Effect.catchTags({
					PatdownRulesLoadFailed: (error: PatdownRulesLoadFailed) => failPatdown(error.message),
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
}

/** Default commands use explicit or package.json adapter discovery. */
export const patdownCommand = makePatdownCommand()
