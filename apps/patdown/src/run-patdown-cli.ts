import { NodeServices } from '@effect/platform-node'
import { MarkdownPatdownRuleSourceLive, type PatdownRulesLoadFailed } from '@patdown/rules'
import { Effect, Layer } from 'effect'
import { Command } from 'effect/unstable/cli'
import type { CliError } from 'effect/unstable/cli/CliError'

import { makePatdownCommand } from '#src/cli'
import { patdownCliVersion } from '#src/patdown-cli-version'
import type { PatdownJudge, PatdownJudgeFailed } from '#src/patdown-judge'
import { PatdownOutputLive, type PatdownOutput } from '#src/patdown-output'
import type { PatdownRuleSourceLayer } from '#src/patdown-rule-source-adapter'
import { TypeSafeJudgeLive } from '#src/typesafe-judge'

/**
 * Returns a runnable CLI Effect. A supplied rule source disables discovery; argv excludes node and
 * script. The third and fourth arguments replace the judge and output layers independently.
 */
export function runPatdownCli(
	ruleSourceLayer?: PatdownRuleSourceLayer,
	argv: readonly string[] = process.argv.slice(2),
	judgeLayer: Layer.Layer<PatdownJudge, PatdownJudgeFailed> = TypeSafeJudgeLive,
	outputLayer: Layer.Layer<PatdownOutput> = PatdownOutputLive,
): Effect.Effect<void, PatdownRulesLoadFailed | PatdownJudgeFailed | CliError> {
	const command = makePatdownCommand(ruleSourceLayer === undefined)
	const source = ruleSourceLayer ?? MarkdownPatdownRuleSourceLive

	return Command.runWith(command, { version: patdownCliVersion })(argv).pipe(
		Effect.provide(
			Layer.mergeAll(source, judgeLayer, outputLayer).pipe(Layer.provideMerge(NodeServices.layer)),
		),
	)
}
