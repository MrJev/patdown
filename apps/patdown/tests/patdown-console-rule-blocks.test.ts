import { describe, expect, it } from 'vitest'

import { formatPatdownConsolePath, formatPatdownRuleBlock } from '#src/patdown-console-rule-blocks'
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
	it('keeps bar score and time in fixed columns before the path', () => {
		const block = formatPatdownRuleBlock('Follow Effect diagnostics', [
			result({
				filePath: 'apps/patdown/src/cli.ts',
				violated: false,
				violationProbability: 0.22,
				elapsedMs: 131,
			}),
			result({
				filePath: 'apps/patdown/oxlint.config.ts',
				violated: false,
				violationProbability: 0.06,
				elapsedMs: 9,
			}),
			result({
				filePath: 'apps/patdown/src/broken.ts',
				violated: true,
				violationProbability: 0.91,
				elapsedMs: 90,
			}),
		])

		const rows = block.split('\n').slice(1, -1)

		expect(block).toContain('┌ Follow Effect diagnostics')
		expect(block).toContain('1✗ / 3')
		expect(rows[0]).toBe('│  ·  ▓▓░░░░░░░░  0.22  131ms  apps/patdown/src/cli.ts')
		expect(rows[1]).toBe('│  ·  ▒░░░░░░░░░  0.06    9ms  apps/patdown/oxlint.config.ts')
		expect(rows[2]).toBe('│  ✗  ▓▓▓▓▓▓▓▓▓░  0.91   90ms  apps/patdown/src/broken.ts')
		expect(block.endsWith('└')).toBe(true)
	})

	it('truncates long paths from the left', () => {
		expect(formatPatdownConsolePath('apps/patdown/src/cli.ts', 48)).toBe('apps/patdown/src/cli.ts')
		expect(
			formatPatdownConsolePath(
				'apps/patdown/src/really/deeply/nested/patdown-github-actions-summary.ts',
				40,
			),
		).toBe('…/patdown-github-actions-summary.ts')
	})

	it('shows an empty rule block when no files matched', () => {
		const block = formatPatdownRuleBlock('No title case', [])

		expect(block.split('\n')[0]).toMatch(/^┌ No title case ─+ 0✗ \/ 0$/u)
		expect(block).toContain('│  (no files matched)')
		expect(block.endsWith('└')).toBe(true)
	})
})
