import { describe, expect, it } from '@effect/vitest'
import { MarkdownPatdownRuleSourceLive } from '@patdown/rules'
import { Effect, Layer } from 'effect'

import { PatdownJudge, type PatdownJudgment } from '#/patdown-judge'
import { PatdownOutput, type PatdownLintResult } from '#/patdown-output'
import { runPatdownCli } from '#/run-patdown-cli'

const fixedJudge = Layer.succeed(PatdownJudge, {
	ask: () => Effect.succeed({ yesProbability: 0.9 }),
})

describe('custom output', () => {
	it.effect('passes structured answers and verbose flags to the supplied output layer', () =>
		Effect.gen(function* () {
			const answers: Array<{ judgment: PatdownJudgment; verbose: boolean }> = []
			const results: PatdownLintResult[] = []

			const output = Layer.succeed(PatdownOutput, {
				writeAnswer: (judgment, verbose) =>
					Effect.sync(() => {
						answers.push({ judgment, verbose })
					}),
				writeLintResult: (result) =>
					Effect.sync(() => {
						results.push(result)
					}),
				writeRulesDocument: () => Effect.void,
				writeNoFilesMatched: () => Effect.void,
				writeLintOk: Effect.void,
				writeLintFailed: Effect.void,
			})

			yield* runPatdownCli(
				MarkdownPatdownRuleSourceLive,
				['ask', 'Question?', '--input-text', 'Text'],
				fixedJudge,
				output,
			)
			yield* runPatdownCli(
				MarkdownPatdownRuleSourceLive,
				['ask', 'Question?', '--verbose'],
				fixedJudge,
				output,
			)

			expect(answers).toEqual([
				{ judgment: { yesProbability: 0.9 }, verbose: false },
				{ judgment: { yesProbability: 0.9 }, verbose: true },
			])
			expect(results).toEqual([])
		}),
	)
})
