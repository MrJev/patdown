import { describe, expect, it } from '@effect/vitest'
import type { PatdownRulesDocument } from '@patdown/rules'
import { Effect, Layer } from 'effect'

import { judgePatdownMatchingRules, patdownRuleAppliesToPath } from '#src/patdown-file-judgment'
import { PatdownJudge } from '#src/patdown-judge'

const document: PatdownRulesDocument = {
	patdownRulesFilePath: 'AGENTS.PATDOWN.md',
	patdownRules: [
		{
			patdownRuleTitle: 'No title case',
			patdownRuleBody: 'Use sentence case.',
			patdownRuleGlobs: ['**/*.md'],
		},
		{
			patdownRuleTitle: 'Do not launder types with casts',
			patdownRuleBody: 'Do not use as to hide a type.',
			patdownRuleGlobs: ['**/*.ts'],
			patdownRuleYesThreshold: 0.8,
		},
	],
}

describe('in-memory file judgments', () => {
	it('applies globs and skipped directories', () => {
		const markdownRule = document.patdownRules[0]
		const typescriptRule = document.patdownRules[1]

		expect(markdownRule !== undefined && patdownRuleAppliesToPath(markdownRule, 'README.md')).toBe(
			true,
		)
		expect(
			markdownRule !== undefined &&
				patdownRuleAppliesToPath(markdownRule, 'apps/patdown/src/cli.ts'),
		).toBe(false)
		expect(
			typescriptRule !== undefined &&
				patdownRuleAppliesToPath(typescriptRule, 'apps/patdown/src/cli.ts'),
		).toBe(true)
		expect(
			typescriptRule !== undefined &&
				patdownRuleAppliesToPath(typescriptRule, 'node_modules/pkg/index.ts'),
		).toBe(false)
		expect(typescriptRule !== undefined && patdownRuleAppliesToPath(typescriptRule, 'id_rsa')).toBe(
			false,
		)
		expect(markdownRule !== undefined && patdownRuleAppliesToPath(markdownRule, '.env.local')).toBe(
			false,
		)
	})

	it.effect('judges only matching rules against supplied contents', () =>
		Effect.gen(function* () {
			const asked: string[] = []

			const judge = Layer.succeed(PatdownJudge, {
				ask: (question, text) => {
					asked.push(`${question}\n${text}`)

					return Effect.succeed({ yesProbability: 0.91 })
				},
			})

			const results = yield* judgePatdownMatchingRules(
				document,
				'apps/patdown/src/cli.ts',
				'const n = value as number\n',
				0.85,
			).pipe(Effect.provide(judge))

			expect(results).toHaveLength(1)
			expect(results[0]?.ruleTitle).toBe('Do not launder types with casts')
			expect(results[0]?.violated).toBe(true)
			expect(results[0]?.yesThreshold).toBe(0.8)
			expect(asked).toHaveLength(1)
			expect(asked[0]).toContain('path: apps/patdown/src/cli.ts')
			expect(asked[0]).toContain('const n = value as number')
		}),
	)
})
