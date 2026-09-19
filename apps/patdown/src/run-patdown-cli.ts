import { NodeServices } from '@effect/platform-node'
import { MarkdownPatdownRuleSourceLive, type PatdownRulesLoadFailed } from '@patdown/rules'
import { Effect, Layer } from 'effect'
import { Command } from 'effect/unstable/cli'
import type { CliError } from 'effect/unstable/cli/CliError'

import { makePatdownCommand } from '#src/cli'
import { patdownCliVersion } from '#src/patdown-cli-version'
import { patdownGitHubActionsIsEnabled } from '#src/patdown-github-actions-env'
import { PatdownGitHubActionsOutputLive } from '#src/patdown-github-actions-output'
import type { PatdownJudge, PatdownJudgeFailed } from '#src/patdown-judge'
import { PatdownOutputLive, type PatdownOutput } from '#src/patdown-output'
import type { PatdownRuleSourceLayer } from '#src/patdown-rule-source-adapter'
import { TypeSafeJudgeLive } from '#src/typesafe-judge'

function argvDisablesPatdownGitHubActions(argv: readonly string[]): boolean {
	return argv.includes('--no-github')
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
): Effect.Effect<void, PatdownRulesLoadFailed | PatdownJudgeFailed | CliError> {
	const command = makePatdownCommand(ruleSourceLayer === undefined)
	const source = ruleSourceLayer ?? MarkdownPatdownRuleSourceLive

	return Effect.gen(function* () {
		const selectedOutput =
			outputLayer ??
			(argvDisablesPatdownGitHubActions(argv) || !(yield* patdownGitHubActionsIsEnabled)
				? PatdownOutputLive
				: PatdownGitHubActionsOutputLive)

		yield* Command.runWith(command, { version: patdownCliVersion })(argv).pipe(
			Effect.provide(
				Layer.mergeAll(source, judgeLayer, selectedOutput).pipe(
					Layer.provideMerge(NodeServices.layer),
				),
			),
		)
	})
}
