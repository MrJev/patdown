import { NodeServices } from '@effect/platform-node'
import {
	MarkdownPatdownRuleSourceLive,
	PatdownGitHubAnnotationInvalid,
	type PatdownRulesLoadFailed,
} from '@patdown/rules'
import { Effect, Layer, Option } from 'effect'
import { Command } from 'effect/unstable/cli'
import type { CliError } from 'effect/unstable/cli/CliError'

import { makePatdownCommand } from '#src/cli'
import { patdownCliVersion } from '#src/patdown-cli-version'
import { patdownGitHubActionsIsEnabled } from '#src/patdown-github-actions-env'
import { makePatdownGitHubActionsOutputLive } from '#src/patdown-github-actions-output'
import { resolvePatdownConfiguredGitHubAnnotation } from '#src/patdown-github-annotation-config'
import type { PatdownJudge, PatdownJudgeFailed } from '#src/patdown-judge'
import { PatdownOutputLive, type PatdownOutput } from '#src/patdown-output'
import type { PatdownRuleSourceLayer } from '#src/patdown-rule-source-adapter'
import { TypeSafeJudgeLive } from '#src/typesafe-judge'

function argvDisablesPatdownGitHubActions(argv: readonly string[]): boolean {
	return argv.includes('--no-github')
}

function argvPatdownGitHubAnnotationFlag(argv: readonly string[]): Option.Option<string> {
	const index = argv.indexOf('--github-annotation')

	if (index < 0) return Option.none()

	const value = argv[index + 1]

	if (value === undefined || value.startsWith('-')) return Option.none()

	return Option.some(value)
}

/**
 * Returns a runnable CLI Effect. A supplied rule source disables discovery; argv excludes node and
 * script. The third and fourth arguments replace the judge and output layers independently. Without
 * an output layer, GitHub Actions summary/annotations turn on when GITHUB_ACTIONS and
 * GITHUB_STEP_SUMMARY are set, unless argv includes --no-github.
 */
export function runPatdownCli(
	ruleSourceLayer?: PatdownRuleSourceLayer,
	argv: readonly string[] = process.argv.slice(2),
	judgeLayer: Layer.Layer<PatdownJudge, PatdownJudgeFailed> = TypeSafeJudgeLive,
	outputLayer?: Layer.Layer<PatdownOutput>,
): Effect.Effect<
	void,
	PatdownRulesLoadFailed | PatdownJudgeFailed | PatdownGitHubAnnotationInvalid | CliError
> {
	const command = makePatdownCommand(ruleSourceLayer === undefined)
	const source = ruleSourceLayer ?? MarkdownPatdownRuleSourceLive

	return Effect.gen(function* () {
		const useGitHub =
			outputLayer === undefined &&
			!argvDisablesPatdownGitHubActions(argv) &&
			(yield* patdownGitHubActionsIsEnabled)

		const selectedOutput =
			outputLayer ??
			(useGitHub
				? makePatdownGitHubActionsOutputLive(
						yield* resolvePatdownConfiguredGitHubAnnotation(argvPatdownGitHubAnnotationFlag(argv)),
					)
				: PatdownOutputLive)

		yield* Command.runWith(command, { version: patdownCliVersion })(argv).pipe(
			Effect.provide(Layer.mergeAll(source, judgeLayer, selectedOutput)),
		)
	}).pipe(Effect.provide(NodeServices.layer))
}
