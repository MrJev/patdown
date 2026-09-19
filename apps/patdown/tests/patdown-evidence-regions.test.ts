import { describe, expect, it } from 'vitest'

import {
	formatPatdownEvidenceChoiceState,
	patdownEvidenceChoiceCriteria,
	patdownEvidenceNoMatchChoice,
	splitPatdownEvidenceRegions,
} from '#src/patdown-evidence-regions'

describe('evidence regions', () => {
	it('splits files into numbered line ranges', () => {
		const contents = Array.from({ length: 100 }, (_, index) => `line ${String(index + 1)}`).join(
			'\n',
		)

		const regions = splitPatdownEvidenceRegions(contents, 40, 3)

		expect(regions).toHaveLength(3)
		expect(regions[0]).toMatchObject({ id: 'r1', startLine: 1, endLine: 40 })
		expect(regions[1]).toMatchObject({ id: 'r2', startLine: 41, endLine: 80 })
		expect(regions[2]).toMatchObject({ id: 'r3', startLine: 81, endLine: 100 })
	})

	it('always offers noMatch beside region labels', () => {
		const regions = splitPatdownEvidenceRegions('# Hello World\n\nbody\n', 80)
		const criteria = patdownEvidenceChoiceCriteria(regions)

		expect(criteria[patdownEvidenceNoMatchChoice()]).toContain('No region')
		expect(criteria['r1']).toContain('Lines 1-')
		expect(
			formatPatdownEvidenceChoiceState('x.md', 'No title case', 'Use sentence case.', regions),
		).toContain('## r1')
	})
})
