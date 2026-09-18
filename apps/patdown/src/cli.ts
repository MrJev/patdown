import {
	PatdownRuleSource,
	PatdownRulesFileMissing,
	PatdownRulesReadFailed,
	PatdownRulesLoadFailed,
} from '@patdown/rules'
import { Effect, FileSystem, Path, Stdio } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'

import { PatdownJudge, PatdownJudgeFailed, askPatdownJudge } from '#/patdown-judge'
import { runPatdownLint } from '#/patdown-lint'
import { PatdownOutput } from '#/patdown-output'
import { readPatdownQuestionInput } from '#/patdown-question-input'
import { loadConfiguredPatdownRules } from '#/patdown-rule-source-adapter'

const failPatdown = (message: string): Effect.Effect<void> =>
	Effect.sync(() => {
		process.exitCode = 1
		process.stderr.write(`${message}\n`)
	})

const rulesFileFlag = Flag.optional(Flag.string('rules')).pipe(
	Flag.withDescription('Path passed to the rule source. Markdown skips the AGENTS.PATDOWN.md walk'),
)

const verboseFlag = Flag.boolean('verbose').pipe(
	Flag.withDefault(false),
	Flag.withDescription('Show estimated yes probabilities and the decision cutoff'),
)

const adapterFlag = Flag.optional(Flag.string('adapter')).pipe(
	Flag.withDescription('Module exporting PatdownRuleSourceLive, replacing markdown rule parsing'),
)

type PatdownLintServices =
	| FileSystem.FileSystem
	| Stdio.Stdio
	| PatdownJudge
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
			question: Argument.string('question'),
			verbose: verboseFlag,
			inputText: Flag.optional(Flag.string('input-text')).pipe(
				Flag.withDescription('Text to evaluate'),
			),
			stdin: Flag.boolean('stdin').pipe(
				Flag.withDefault(false),
				Flag.withDescription('Read UTF-8 text from piped or redirected stdin'),
			),
		},
		({
			question,
			inputText,
			stdin,
			verbose,
		}): Effect.Effect<void, never, PatdownJudge | PatdownOutput | Stdio.Stdio> =>
			Effect.gen(function* () {
				const output = yield* PatdownOutput
				const text = yield* readPatdownQuestionInput(inputText, stdin)
				const answer = yield* askPatdownJudge(question, text)

				yield* output.writeAnswer(answer, verbose)
			}).pipe(
				Effect.catchTags({
					PatdownJudgeFailed: (error: PatdownJudgeFailed) => failPatdown(error.message),
				}),
			),
	).pipe(Command.withDescription('Ask a yes/no question about text'))

	/** Root Effect CLI command for patdown. Default action lints files against AGENTS.PATDOWN.md. */
	return Command.make(
		'patdown',
		{ adapter: adapterFlag, rules: rulesFileFlag, verbose: verboseFlag },
		({ rules, adapter, verbose }): Effect.Effect<void, never, PatdownLintServices> =>
			Effect.gen(function* () {
				const patdownRuleSource = yield* PatdownRuleSource

				const document = yield* discoverAdapters
					? loadConfiguredPatdownRules(adapter, rules)
					: patdownRuleSource.loadPatdownRules(rules)

				const failed = yield* runPatdownLint(document, verbose)

				yield* finishPatdownLint(failed)
			}).pipe(
				Effect.catchTags({
					PatdownRulesLoadFailed: (error: PatdownRulesLoadFailed) => failPatdown(error.message),
					PatdownJudgeFailed: (error: PatdownJudgeFailed) => failPatdown(error.message),
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
