import { NodeServices } from '@effect/platform-node'
import { MarkdownPatdownRuleSourceLive, type PatdownRulesLoadFailed } from '@patdown/rules'
import { Effect, Layer } from 'effect'
import { Command } from 'effect/unstable/cli'
import type { CliError } from 'effect/unstable/cli/CliError'

import { makePatdownCommand } from '#/cli'
import { patdownCliVersion } from '#/patdown-cli-version'
import type { PatdownJudge, PatdownJudgeFailed } from '#/patdown-judge'
import { PatdownOutputLive } from '#/patdown-output'
import type { PatdownRuleSourceLayer } from '#/patdown-rule-source-adapter'
import { TypeSafeJudgeLive } from '#/typesafe-judge'

/**
 * Returns a runnable CLI Effect. A supplied rule source disables discovery; argv excludes node and
 * script. The third argument replaces the default judge independently of the rules source.
 */
export function runPatdownCli(
	ruleSourceLayer?: PatdownRuleSourceLayer,
	argv: readonly string[] = process.argv.slice(2),
	judgeLayer: Layer.Layer<PatdownJudge, PatdownJudgeFailed> = TypeSafeJudgeLive,
): Effect.Effect<void, PatdownRulesLoadFailed | PatdownJudgeFailed | CliError> {
	const command = makePatdownCommand(ruleSourceLayer === undefined)
	const source = ruleSourceLayer ?? MarkdownPatdownRuleSourceLive

	return Command.runWith(command, { version: patdownCliVersion })(argv).pipe(
		Effect.provide(
			Layer.mergeAll(source, judgeLayer, PatdownOutputLive).pipe(
				Layer.provideMerge(NodeServices.layer),
			),
		),
	)
}
