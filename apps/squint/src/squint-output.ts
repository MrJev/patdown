import { jevNoulIsYes, jevNoulYesThreshold } from '@squint/jev'
import type { SquintRulesDocument } from '@squint/rules'
import { Console, Context, Effect, Layer } from 'effect'

function formatSquintNoulDecision(noul: number): string {
	const decision = jevNoulIsYes(noul) ? 'yes' : 'no'

	return `squint: ${decision} (${String(noul)}, thresh ${String(jevNoulYesThreshold)})`
}

function formatSquintLintLine(
	failed: boolean,
	ruleTitle: string,
	relativePath: string,
	noul: number,
): string {
	const verdict = failed ? 'fail' : 'pass'

	return `squint: ${verdict} ${ruleTitle} ${relativePath} (${String(noul)}, thresh ${String(jevNoulYesThreshold)})`
}

function formatSquintRuleGlobs(globs: ReadonlyArray<string>): string {
	return globs.length === 0 ? '*' : globs.join(' ')
}

function formatSquintRulesDocument(document: SquintRulesDocument): string {
	const lines = [
		`squint: ${String(document.squintRules.length)} rules from ${document.squintRulesFilePath}`,
	]

	for (const rule of document.squintRules) {
		lines.push('')
		lines.push(rule.squintRuleTitle)
		lines.push(`globs: ${formatSquintRuleGlobs(rule.squintRuleGlobs)}`)
	}

	return lines.join('\n')
}

/** How squint prints. Swap the live layer for JSON, SARIF, or another line shape. */
export class SquintOutput extends Context.Service<
	SquintOutput,
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
		readonly writeRulesDocument: (document: SquintRulesDocument) => Effect.Effect<void>
	}
>()('@squint/cli/SquintOutput') {}

/** Human line-oriented squint output. */
export const SquintOutputLive = Layer.succeed(SquintOutput, {
	writeLintFailed: (): Effect.Effect<void> => Console.log('squint: failed'),
	writeLintLine: (
		failed: boolean,
		ruleTitle: string,
		relativePath: string,
		noul: number,
	): Effect.Effect<void> =>
		Console.log(formatSquintLintLine(failed, ruleTitle, relativePath, noul)),
	writeLintOk: (): Effect.Effect<void> => Console.log('squint: ok'),
	writeNoFilesMatched: (ruleTitle: string): Effect.Effect<void> =>
		Console.log(`squint: no files matched ${ruleTitle}`),
	writeNoulDecision: (noul: number): Effect.Effect<void> =>
		Console.log(formatSquintNoulDecision(noul)),
	writeRulesDocument: (document: SquintRulesDocument): Effect.Effect<void> =>
		Console.log(formatSquintRulesDocument(document)),
})
