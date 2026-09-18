import { describe, expect, it } from 'vitest'

import { parseMarkdownPatdownRules } from '#src/markdown-patdown-rule-parser'
import { PatdownYesThresholdInvalid } from '#src/patdown-yes-threshold'

describe('markdown per-rule yes thresholds', () => {
	it('reads a cutoff from consecutive metadata lines', () => {
		const rules = parseMarkdownPatdownRules(
			[
				'# No title case',
				'globs: **/*.md',
				'yes-threshold: 0.9',
				'',
				'Use sentence case.',
				'',
			].join('\n'),
		)

		expect(rules).toEqual([
			{
				patdownRuleBody: 'Use sentence case.',
				patdownRuleGlobs: ['**/*.md'],
				patdownRuleTitle: 'No title case',
				patdownRuleYesThreshold: 0.9,
			},
		])
	})

	it('accepts a cutoff before globs and omits it when absent', () => {
		const rules = parseMarkdownPatdownRules(
			[
				'# First',
				'yes-threshold: 0.7',
				'globs: **/*.md',
				'',
				'Body.',
				'',
				'# Second',
				'',
				'Also body.',
			].join('\n'),
		)

		expect(rules[0]?.patdownRuleYesThreshold).toBe(0.7)
		expect(rules[1]?.patdownRuleYesThreshold).toBeUndefined()
	})

	it('rejects invalid or duplicate per-rule cutoffs', () => {
		expect(() => parseMarkdownPatdownRules('# One\nyes-threshold: 1\n\nBody.\n')).toThrow(
			PatdownYesThresholdInvalid,
		)
		expect(() =>
			parseMarkdownPatdownRules('# One\nyes-threshold: 0.8\nyes-threshold: 0.9\n\nBody.\n'),
		).toThrow(/more than one yes-threshold line/u)
	})

	it('leaves a later yes-threshold line in the rule body', () => {
		const rules = parseMarkdownPatdownRules('# One\n\nBody.\nyes-threshold: 0.9\n')

		expect(rules[0]?.patdownRuleYesThreshold).toBeUndefined()
		expect(rules[0]?.patdownRuleBody).toContain('yes-threshold: 0.9')
	})
})
