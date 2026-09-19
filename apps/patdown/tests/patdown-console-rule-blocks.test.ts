import { describe, expect, it } from 'vitest'

import { formatPatdownRuleBlock } from '#src/patdown-console-rule-blocks'
import type { PatdownLintResult } from '#src/patdown-output'

function result(
	partial: Pick<PatdownLintResult, 'filePath' | 'violated' | 'violationProbability' | 'elapsedMs'>,
): PatdownLintResult {
	return {
		ruleTitle: 'Follow Effect diagnostics',
		ruleBody: 'Address Effect diagnostics.',
		ruleGlobs: ['**/*.ts'],
		yesThreshold: 0.85,
		...partial,
	}
}

describe('console rule blocks', () => {
	it('formats a per-rule box with only judged files', () => {
		const block = formatPatdownRuleBlock('Follow Effect diagnostics', [
			result({
				filePath: 'apps/patdown/src/cli.ts',
				violated: false,
				violationProbability: 0.22,
				elapsedMs: 131,
			}),
			result({
				filePath: 'apps/patdown/src/index.ts',
				violated: false,
				violationProbability: 0.06,
				elapsedMs: 127,
			}),
			result({
				filePath: 'apps/patdown/src/broken.ts',
				violated: true,
				violationProbability: 0.91,
				elapsedMs: 90,
			}),
		])

		expect(block).toContain('┌ Follow Effect diagnostics')
		expect(block).toContain('1✗ / 3')
		expect(block).toContain('│  · apps/patdown/src/cli.ts')
		expect(block).toContain('▓▓░░░░░░░░ 0.22')
		expect(block).toContain('131ms')
		expect(block).toContain('│  ✗ apps/patdown/src/broken.ts')
		expect(block).toContain('└')
	})

	it('shows an empty rule block when no files matched', () => {
		const block = formatPatdownRuleBlock('No title case', [])

		expect(block.split('\n')[0]).toMatch(/^┌ No title case ─+ 0✗ \/ 0$/u)
		expect(block).toContain('│  (no files matched)')
		expect(block.endsWith('└')).toBe(true)
	})
})
