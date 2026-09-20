import type { PatdownLintResult } from 'patdown'
import { describe, expect, it } from 'vitest'

import { formatPatdownSteerReason, patdownSteerFailures } from '#src/patdown-pi-steer'

function result(
	partial: Pick<PatdownLintResult, 'violated' | 'violationProbability' | 'ruleTitle'>,
): PatdownLintResult {
	return {
		ruleBody: 'Do not hide a type with a cast.',
		ruleGlobs: ['**/*.ts'],
		filePath: 'src/cli.ts',
		yesThreshold: 0.85,
		elapsedMs: 12,
		...partial,
	}
}

describe('steer messages', () => {
	it('quotes failing rules for the agent', () => {
		const failures = patdownSteerFailures([
			result({
				violated: false,
				violationProbability: 0.1,
				ruleTitle: 'Keep branded types',
			}),
			result({
				violated: true,
				violationProbability: 0.91,
				ruleTitle: 'Do not launder types with casts',
			}),
		])

		expect(failures).toHaveLength(1)

		const reason = formatPatdownSteerReason('src/cli.ts', failures)

		expect(reason).toContain('patdown blocked write to src/cli.ts')
		expect(formatPatdownSteerReason('src/cli.ts', failures, 'steer')).toContain(
			'patdown flagged write to src/cli.ts',
		)
		expect(reason).toContain('# Do not launder types with casts')
		expect(reason).toContain('P(yes) 0.91 exceeds cutoff >0.85')
		expect(reason).toContain('Do not hide a type with a cast.')
	})
})
