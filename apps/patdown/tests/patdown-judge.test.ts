import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { TestConsole } from 'effect/testing'

import {
	PatdownJudge,
	PatdownJudgeFailed,
	askPatdownJudge,
	patdownJudgmentIsYes,
	patdownYesThreshold,
} from '#src/patdown-judge'
import { PatdownOutput, PatdownOutputLive } from '#src/patdown-output'
import { runPatdownCli } from '#src/run-patdown-cli'

const outputHarness = Layer.mergeAll(PatdownOutputLive, TestConsole.layer)

describe('provider-neutral judgments', () => {
	it('keeps threshold policy outside the provider', () => {
		expect(patdownJudgmentIsYes({ yesProbability: patdownYesThreshold })).toBe(false)
		expect(patdownJudgmentIsYes({ yesProbability: 0.851 })).toBe(true)
		expect(patdownJudgmentIsYes({ yesProbability: 0.02 })).toBe(false)
		expect(patdownJudgmentIsYes({ yesProbability: 0.81 }, 0.8)).toBe(true)
		expect(patdownJudgmentIsYes({ yesProbability: 0.81 }, 0.81)).toBe(false)
	})

	it.effect('accepts a custom judge without TypeSafe or HTTP services', () =>
		Effect.gen(function* () {
			const judge = Layer.succeed(PatdownJudge, {
				ask: (question, text) => {
					expect(question).toBe('Urgent?')
					expect(text).toBe('ASAP')

					return Effect.succeed({ yesProbability: 0.9 })
				},
			})

			const result = yield* askPatdownJudge('Urgent?', 'ASAP').pipe(Effect.provide(judge))
			expect(result.judgment.yesProbability).toBe(0.9)
			expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
		}),
	)

	it.effect('rejects non-finite and out-of-range probabilities', () =>
		Effect.gen(function* () {
			for (const yesProbability of [NaN, Infinity, -0.1, 1.1]) {
				const judge = Layer.succeed(PatdownJudge, { ask: () => Effect.succeed({ yesProbability }) })

				const error = yield* askPatdownJudge('Question?', '').pipe(
					Effect.provide(judge),
					Effect.flip,
				)

				expect(error.message).toContain('invalid yes probability')
			}
		}),
	)

	it.effect('preserves provider failures', () =>
		Effect.gen(function* () {
			const judge = Layer.succeed(PatdownJudge, {
				ask: () => Effect.fail(new PatdownJudgeFailed({ message: 'offline' })),
			})

			const error = yield* askPatdownJudge('Question?', '').pipe(Effect.provide(judge), Effect.flip)
			expect(error.message).toBe('offline')
		}),
	)

	it.effect('runner accepts another provider and positional question syntax', () =>
		Effect.gen(function* () {
			const judge = Layer.succeed(PatdownJudge, {
				ask: (question, text) => {
					expect(question).toBe('Heading?')
					expect(text).toBe('# Hello')

					return Effect.succeed({ yesProbability: 0.9 })
				},
			})

			const result = yield* runPatdownCli(
				undefined,
				['ask', 'Heading?', '--input-text', '# Hello', '--verbose'],
				judge,
			)

			expect(result).toBeUndefined()
		}),
	)
})

describe('human-readable judgments', () => {
	it.effect('hides probabilities by default and exposes them in verbose output', () =>
		Effect.gen(function* () {
			const output = yield* PatdownOutput
			yield* output.writeAnswer({ yesProbability: 0.86 }, false)
			yield* output.writeAnswer({ yesProbability: 0.02 }, true, 0.85, 12)
			yield* output.writeLintResult(
				{
					violated: true,
					filePath: 'README.md',
					ruleTitle: 'Sentence case',
					ruleBody: 'Use sentence case.',
					ruleGlobs: ['**/*.md'],
					violationProbability: 0.91,
					yesThreshold: 0.85,
					elapsedMs: 40,
				},
				true,
			)
			const lines = yield* TestConsole.logLines
			expect(lines).toEqual([
				'yes',
				'no (░░░░░░░░░░ estimated P(yes): 0.02; cutoff: >0.85; elapsed: 12ms)',
				'FAIL README.md: Sentence case (▓▓▓▓▓▓▓▓▓░ estimated P(yes): 0.91; cutoff: >0.85; elapsed: 40ms)',
			])
		}).pipe(Effect.provide(outputHarness)),
	)
})
