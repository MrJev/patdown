import {
	PatdownRuleSource,
	PatdownRulesFileMissing,
	PatdownRulesReadFailed,
	PatdownRulesLoadFailed,
	PatdownYesThresholdInvalid,
} from '@patdown/rules'
import { Effect, FileSystem, Path, Stdio } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'

import { PatdownJudge, PatdownJudgeFailed, askPatdownJudge } from '#src/patdown-judge'
import { runPatdownLint } from '#src/patdown-lint'
import { PatdownOutput } from '#src/patdown-output'
import { readPatdownQuestionInput } from '#src/patdown-question-input'
import { loadConfiguredPatdownRules } from '#src/patdown-rule-source-adapter'
import { resolvePatdownYesThreshold } from '#src/patdown-yes-threshold-config'

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
	Flag.withDescription(
		'Show estimated yes probabilities, the decision cutoff, and elapsed judge time',
	),
)

const adapterFlag = Flag.optional(Flag.string('adapter')).pipe(
	Flag.withDescription('Module exporting PatdownRuleSourceLive, replacingkdown rule parsing'),
)

const yesThresholdFlag = Flag.optional(Flag.float('yes-threshold')).pipe(
	Flag.withDescription('Minimum exclusive P(yes) for yes; default 0.85, overridable per rule'),
)

type PatdownLintServices =
	| FileSystem.FileSystem
	| Stdio.Stdio
	| PatdownJudge
	| Path.Path
	| PatdownOutput
	| PatdownRuleSource

function finishPatdownLint(
	failed: boolean,
	verbose: boolean,
	elapsedMs: number,
): Effect.Effect<void, never, PatdownOutput> {
	return Effect.gen(function* () {
		const output = yield* PatdownOutput

		if (failed) {
			yield* output.writeLintFailed(verbose ? elapsedMs : undefined)
			yield* Effect.sync(() => {
				process.exitCode = 1
			})

			return
		}

		yield* output.writeLintOk(verbose ? elapsedMs : undefined)
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
					PatdownYesThresholdInvalid: (error: PatdownYesThresholdInvalid) =>
						failPatdown(error.message),
				}),
			),
	).pipe(Command.withDescription('Load and print patdown rules'))

	const askCommand = Command.make(
		'ask',
		{
			question: Argument.string('question'),
			verbose: verboseFlag,
			yesThreshold: yesThresholdFlag,
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
			yesThreshold,
		}): Effect.Effect<
			void,
			never,
			PatdownJudge | PatdownOutput | Stdio.Stdio | FileSystem.FileSystem
		> =>
			Effect.gen(function* () {
				const output = yield* PatdownOutput
				const text = yield* readPatdownQuestionInput(inputText, stdin)
				const cutoff = yield* resolvePatdownYesThreshold(yesThreshold)
				const timed = yield* askPatdownJudge(question, text)

				yield* output.writeAnswer(timed.judgment, verbose, cutoff, timed.elapsedMs)
			}).pipe(
				Effect.catchTags({
					PatdownJudgeFailed: (error: PatdownJudgeFailed) => failPatdown(error.message),
					PatdownYesThresholdInvalid: (error: PatdownYesThresholdInvalid) =>
						failPatdown(error.message),
				}),
			),
	).pipe(Command.withDescription('Ask a yes/no question about text'))

	/** Root Effect CLI command for patdown. Default action lints files against AGENTS.PATDOWN.md. */
	return Command.make(
		'patdown',
		{
			adapter: adapterFlag,
			rules: rulesFileFlag,
			verbose: verboseFlag,
			yesThreshold: yesThresholdFlag,
		},
		({ rules, adapter, verbose, yesThreshold }): Effect.Effect<void, never, PatdownLintServices> =>
			Effect.gen(function* () {
				const patdownRuleSource = yield* PatdownRuleSource
				const cutoff = yield* resolvePatdownYesThreshold(yesThreshold)

				const document = yield* discoverAdapters
					? loadConfiguredPatdownRules(adapter, rules)
					: patdownRuleSource.loadPatdownRules(rules)

				const linted = yield* runPatdownLint(document, verbose, cutoff)

				yield* finishPatdownLint(linted.failed, verbose, linted.elapsedMs)
			}).pipe(
				Effect.catchTags({
					PatdownRulesLoadFailed: (error: PatdownRulesLoadFailed) => failPatdown(error.message),
					PatdownJudgeFailed: (error: PatdownJudgeFailed) => failPatdown(error.message),
					PatdownYesThresholdInvalid: (error: PatdownYesThresholdInvalid) =>
						failPatdown(error.message),
					PatdownRulesFileMissing: (error: PatdownRulesFileMissing) => failPatdown(error.message),
					PatdownRulesReadFailed: (error: PatdownRulesReadFailed) => failPatdown(error.message),
				}),
			),
	).pipe(
		Command.withDescription('Lint a tree against fuzzykdown rules'),
		Command.withShortDescription('Patdown CLI'),
		Command.withSubcommands([askCommand, rulesCommand]),
	)
}

/** Default commands use explicit or package.json adapter discovery. */
export const patdownCommand = makePatdownCommand()
