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
	it('formats aligned columns for judged files', () => {
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
		expect(rows[0]).toBe('│  · apps/patdown/src/cli.ts        ▓▓░░░░░░░░  0.22  131ms')
		expect(rows[1]).toBe('│  · apps/patdown/oxlint.config.ts  ▒░░░░░░░░░  0.06    9ms')
		expect(rows[2]).toBe('│  ✗ apps/patdown/src/broken.ts     ▓▓▓▓▓▓▓▓▓░  0.91   90ms')
		expect(block.endsWith('└')).toBe(true)
	})

	it('shows an empty rule block when no files matched', () => {
		const block = formatPatdownRuleBlock('No title case', [])

		expect(block.split('\n')[0]).toMatch(/^┌ No title case ─+ 0✗ \/ 0$/u)
		expect(block).toContain('│  (no files matched)')
		expect(block.endsWith('└')).toBe(true)
	})
})
