import { describe, expect, it } from 'vitest'

import {
	formatPatdownGitHubActionsAnnotations,
	formatPatdownGitHubActionsSummary,
	patdownLintResultIsNearMiss,
} from '#src/patdown-github-actions-summary'
import type { PatdownLintResult } from '#src/patdown-output'

function result(
	partial: Omit<PatdownLintResult, 'elapsedMs' | 'yesThreshold'> & {
		readonly elapsedMs?: number
		readonly yesThreshold?: number
	},
): PatdownLintResult {
	return {
		elapsedMs: partial.elapsedMs ?? 10,
		yesThreshold: partial.yesThreshold ?? 0.85,
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
			'::error file=README.md,title=patdown%3A sentence-case::❌ ▓▓▓▓▓▓▓▓▓░ P(yes) 0.91 exceeds cutoff >0.85',
			'::error file=src/cli.ts,title=patdown%3A explicit-actor::❌ ▓▓▓▓▓▓▓▓▒░ P(yes) 0.86 exceeds cutoff >0.85',
		])

		const summary = formatPatdownGitHubActionsSummary({
			failed: true,
			elapsedMs: 1840,
			results,
		})

		expect(summary).toContain('# patdown ❌ failed')
		expect(summary).toContain('✅ 1 passed · ❌ 2 failed · 1840ms')
		expect(summary).toContain('| file | status | explicit-actor | sentence-case |')
		expect(summary).toContain('| `src/cli.ts` | ❌ | ❌ ▓▓▓▓▓▓▓▓▒░ **0.86** | — |')
		expect(summary).toContain('| `README.md` | ❌ | — | ❌ ▓▓▓▓▓▓▓▓▓░ **0.91** |')
		expect(summary).toContain('### ❌ `README.md` · sentence-case')

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

		expect(passed).toContain('# patdown ✅ passed')
		expect(passed).toContain('✅ 1 passed · ❌ 0 failed · 12ms')
		expect(passed).toContain('| `README.md` | ✅ | ✅ ░░░░░░░░░░ 0.04 |')
	})
})
