import { jevNoulIsYes, jevNoulYesThreshold } from '@patdown/jev'
import type { PatdownRulesDocument } from '@patdown/rules'
import { Console, Context, Effect, Layer } from 'effect'

function formatPatdownNoulDecision(noul: number): string {
	const decision = jevNoulIsYes(noul) ? 'yes' : 'no'

	return `patdown: ${decision} (${String(noul)}, thresh ${String(jevNoulYesThreshold)})`
}

function formatPatdownLintLine(
	failed: boolean,
	ruleTitle: string,
	relativePath: string,
	noul: number,
): string {
	const verdict = failed ? 'fail' : 'pass'

	return `patdown: ${verdict} ${ruleTitle} ${relativePath} (${String(noul)}, thresh ${String(jevNoulYesThreshold)})`
}

function formatPatdownRuleGlobs(globs: ReadonlyArray<string>): string {
	return globs.length === 0 ? '*' : globs.join(' ')
}

function formatPatdownRulesDocument(document: PatdownRulesDocument): string {
	const lines = [
		`patdown: ${String(document.patdownRules.length)} rules from ${document.patdownRulesFilePath}`,
	]

	for (const rule of document.patdownRules) {
		lines.push('')
		lines.push(rule.patdownRuleTitle)
		lines.push(`globs: ${formatPatdownRuleGlobs(rule.patdownRuleGlobs)}`)
	}

	return lines.join('\n')
}

/** How patdown prints. Swap the live layer for JSON, SARIF, or another line shape. */
export class PatdownOutput extends Context.Service<
	PatdownOutput,
	{
		readonly writeLintFailed: () => Effect.Effect<void>
		readonly writeLintLine: (
			failed: boolean,
			ruleTitle: string,
			relativePath: string,
			noul: number,
		) => Effect.Effect<void>
		readonly writeLintOk: () => Effect.Effect<void>
		readonly writeNoFilesMatched: (ruleTitle: string) => Effect.Effect<void>
		readonly writeNoulDecision: (noul: number) => Effect.Effect<void>
		readonly writeRulesDocument: (document: PatdownRulesDocument) => Effect.Effect<void>
	}
>()('@patdown/cli/PatdownOutput') {}

/** Human line-oriented patdown output. */
export const PatdownOutputLive = Layer.succeed(PatdownOutput, {
	writeLintFailed: (): Effect.Effect<void> => Console.log('patdown: failed'),
	writeLintLine: (
		failed: boolean,
		ruleTitle: string,
		relativePath: string,
		noul: number,
	): Effect.Effect<void> =>
		Console.log(formatPatdownLintLine(failed, ruleTitle, relativePath, noul)),
	writeLintOk: (): Effect.Effect<void> => Console.log('patdown: ok'),
	writeNoFilesMatched: (ruleTitle: string): Effect.Effect<void> =>
		Console.log(`patdown: no files matched ${ruleTitle}`),
	writeNoulDecision: (noul: number): Effect.Effect<void> =>
		Console.log(formatPatdownNoulDecision(noul)),
	writeRulesDocument: (document: PatdownRulesDocument): Effect.Effect<void> =>
		Console.log(formatPatdownRulesDocument(document)),
})
