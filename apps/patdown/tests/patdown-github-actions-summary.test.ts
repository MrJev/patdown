import { describe, expect, it } from 'vitest'

import {
	formatPatdownGitHubActionsAnnotations,
	formatPatdownGitHubActionsSummary,
	patdownLintResultIsNearMiss,
} from '#src/patdown-github-actions-summary'
import type { PatdownLintResult } from '#src/patdown-output'

function result(
	partial: Omit<PatdownLintResult, 'elapsedMs' | 'yesThreshold' | 'ruleBody' | 'ruleGlobs'> & {
		readonly elapsedMs?: number
		readonly yesThreshold?: number
		readonly ruleBody?: string
		readonly ruleGlobs?: ReadonlyArray<string>
	},
): PatdownLintResult {
	return {
		elapsedMs: partial.elapsedMs ?? 10,
		yesThreshold: partial.yesThreshold ?? 0.85,
		ruleBody: partial.ruleBody ?? 'Rule guidance body.',
		ruleGlobs: partial.ruleGlobs ?? ['**/*'],
		...partial,
	}
}

describe('GitHub Actions summary', () => {
	it('marks near misses below the cutoff', () => {
		expect(
			patdownLintResultIsNearMiss(
				result({
					violated: false,
					filePath: 'a.ts',
					ruleTitle: 'rule',
					violationProbability: 0.7,
				}),
			),
		).toBe(true)
		expect(
			patdownLintResultIsNearMiss(
				result({
					violated: false,
					filePath: 'a.ts',
					ruleTitle: 'rule',
					violationProbability: 0.2,
				}),
			),
		).toBe(false)
	})

	it('formats annotations and a heatmap summary', () => {
		const results = [
			result({
				violated: true,
				filePath: 'src/cli.ts',
				ruleTitle: 'explicit-actor',
				violationProbability: 0.86,
				elapsedMs: 312,
			}),
			result({
				violated: false,
				filePath: 'README.md',
				ruleTitle: 'sentence-case',
				violationProbability: 0.04,
			}),
			result({
				violated: true,
				filePath: 'README.md',
				ruleTitle: 'sentence-case',
				violationProbability: 0.91,
			}),
		]

		expect(formatPatdownGitHubActionsAnnotations(results)).toEqual([
			'::error file=README.md,line=1,title=patdown%3A sentence-case::▓▓▓▓▓▓▓▓▓░ P(yes) 0.91 exceeds cutoff >0.85%0A%0A# sentence-case%0Aglobs: **/*%0A%0ARule guidance body.',
			'::error file=src/cli.ts,line=1,title=patdown%3A explicit-actor::▓▓▓▓▓▓▓▓▒░ P(yes) 0.86 exceeds cutoff >0.85%0A%0A# explicit-actor%0Aglobs: **/*%0A%0ARule guidance body.',
		])

		const titleCaseGuidance = [
			'Markdown headings must use sentence case, not title case.',
			'',
			'## Not allowed',
			'',
			'```',
			'# The Complete Guide To Fuzzy Rules',
			'```',
		].join('\n')

		expect(
			formatPatdownGitHubActionsAnnotations([
				result({
					violated: true,
					filePath: 'fixtures/ci/intentional-title-case-fail.md',
					ruleTitle: 'No title case',
					ruleBody: titleCaseGuidance,
					ruleGlobs: ['**/*.md'],
					violationProbability: 0.93,
					evidence: { startLine: 3, endLine: 3, confidence: 0.81 },
				}),
			]),
		).toEqual([
			'::error file=fixtures/ci/intentional-title-case-fail.md,line=3,endLine=3,title=patdown%3A No title case::▓▓▓▓▓▓▓▓▓░ P(yes) 0.93 exceeds cutoff >0.85 lines 3-3%0A%0A# No title case%0Aglobs: **/*.md%0A%0AMarkdown headings must use sentence case, not title case.%0A%0A## Not allowed%0A%0A```%0A# The Complete Guide To Fuzzy Rules%0A```',
		])

		const summary = formatPatdownGitHubActionsSummary({
			failed: true,
			elapsedMs: 1840,
			results,
		})

		expect(summary).toContain('# patdown failed')
		expect(summary).toContain('1 passed · 2 failed · 1840ms')
		expect(summary).toContain('| file | status | explicit-actor | sentence-case |')
		expect(summary).toContain('| `src/cli.ts` | ❌ | ▓▓▓▓▓▓▓▓▒░ **0.86** ❌ | — |')
		expect(summary).toContain('| `README.md` | ❌ | — | ▓▓▓▓▓▓▓▓▓░ **0.91** ❌ |')
		expect(summary).toContain('### `README.md` · sentence-case')
		expect(summary).toContain('# sentence-case')
		expect(summary).toContain('Rule guidance body.')

		const passed = formatPatdownGitHubActionsSummary({
			failed: false,
			elapsedMs: 12,
			results: [
				result({
					violated: false,
					filePath: 'README.md',
					ruleTitle: 'sentence-case',
					violationProbability: 0.04,
				}),
			],
		})

		expect(passed).toContain('# patdown passed')
		expect(passed).toContain('1 passed · 0 failed · 12ms')
		expect(passed).toContain('| `README.md` | ✅ | ░░░░░░░░░░ 0.04 |')
	})
})
