import { describe, expect, it } from 'vitest'

import {
	formatPatdownEvidenceChoiceState,
	patdownEvidenceChoiceCriteria,
	patdownEvidenceNoMatchChoice,
	splitPatdownEvidenceCandidates,
} from '#src/patdown-evidence-regions'

describe('evidence candidates', () => {
	it('uses one candidate per line for small files', () => {
		const contents = ['alpha', '# The Complete Guide To Fuzzy Rules', 'omega'].join('\n')
		const candidates = splitPatdownEvidenceCandidates(contents)

		expect(candidates).toEqual([
			{ id: 'L1', startLine: 1, endLine: 1, content: 'alpha' },
			{ id: 'L2', startLine: 2, endLine: 2, content: '# The Complete Guide To Fuzzy Rules' },
			{ id: 'L3', startLine: 3, endLine: 3, content: 'omega' },
		])
		expect(splitPatdownEvidenceCandidates('one line\n')).toEqual([
			{ id: 'L1', startLine: 1, endLine: 1, content: 'one line' },
		])
		expect(splitPatdownEvidenceCandidates('')).toEqual([
			{ id: 'L1', startLine: 1, endLine: 1, content: '' },
		])

		const criteria = patdownEvidenceChoiceCriteria(candidates)

		expect(criteria[patdownEvidenceNoMatchChoice()]).toContain('No candidate')
		expect(criteria['L2']).toContain('Line 2')
		expect(criteria['L2']).toContain('The Complete Guide To Fuzzy Rules')
	})

	it('falls back to chunks when the file is too large for per-line Choice', () => {
		const contents = Array.from({ length: 501 }, (_, index) => `line ${String(index + 1)}`).join(
			'\n',
		)

		const candidates = splitPatdownEvidenceCandidates(contents, 500, 40, 3)

		expect(candidates).toHaveLength(3)
		expect(candidates[0]).toMatchObject({ id: 'c1', startLine: 1, endLine: 40 })
		expect(candidates[1]).toMatchObject({ id: 'c2', startLine: 41, endLine: 80 })
		expect(candidates[2]).toMatchObject({ id: 'c3', startLine: 81, endLine: 120 })
	})

	it('includes the original FAIL and full file in Choice state', () => {
		const contents = '# The Complete Guide To Fuzzy Rules\n'
		const candidates = splitPatdownEvidenceCandidates(contents)

		const state = formatPatdownEvidenceChoiceState({
			relativePath: 'x.md',
			ruleTitle: 'No title case',
			ruleBody: 'Use sentence case.',
			violationProbability: 0.98,
			contents,
			candidates,
		})

		expect(state).toContain('noul P(yes): 0.98')
		expect(state).toContain('candidate mode: per-line')
		expect(state).toContain('Full file:')
		expect(state).toContain('# The Complete Guide To Fuzzy Rules')
		expect(state).toContain('- L1: line 1')
	})
})
