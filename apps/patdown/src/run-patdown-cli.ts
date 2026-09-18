import { NodeServices } from '@effect/platform-node'
import { JevSystemOneLive } from '@patdown/jev'
import { MarkdownPatdownRuleSourceLive, type PatdownRulesLoadFailed } from '@patdown/rules'
import { Effect, Layer } from 'effect'
import { Command } from 'effect/unstable/cli'
import type { CliError } from 'effect/unstable/cli/CliError'
import { FetchHttpClient } from 'effect/unstable/http'

import { makePatdownCommand } from '#/cli'
import { patdownCliVersion } from '#/patdown-cli-version'
import { PatdownOutputLive } from '#/patdown-output'
import type { PatdownRuleSourceLayer } from '#/patdown-rule-source-adapter'

/**
 * Returns a runnable CLI Effect. A supplied layer disables discovery; argv excludes node and
 * script.
 */
export function runPatdownCli(
	ruleSourceLayer?: PatdownRuleSourceLayer,
	argv: readonly string[] = process.argv.slice(2),
): Effect.Effect<void, PatdownRulesLoadFailed | CliError> {
	const command = makePatdownCommand(ruleSourceLayer === undefined)
	const source = ruleSourceLayer ?? MarkdownPatdownRuleSourceLive

	return Command.runWith(command, { version: patdownCliVersion })(argv).pipe(
		Effect.provide(
			Layer.mergeAll(source, JevSystemOneLive, PatdownOutputLive, FetchHttpClient.layer).pipe(
				Layer.provideMerge(NodeServices.layer),
			),
		),
	)
}
