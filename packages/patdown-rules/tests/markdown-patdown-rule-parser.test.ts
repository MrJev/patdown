import { describe, expect, it } from 'vitest'

import { parseMarkdownPatdownRules } from '#src/markdown-patdown-rule-parser'

describe('parseMarkdownPatdownRules', () => {
	it('ignores text above the first heading', () => {
		const rules = parseMarkdownPatdownRules('Preamble notes.\n\n# First rule\n\nDo the thing.\n')

		expect(rules).toEqual([
			{
				patdownRuleBody: 'Do the thing.',
				patdownRuleGlobs: [],
				patdownRuleTitle: 'First rule',
			},
		])
	})

	it('reads globs from the first lines of a rule body', () => {
		const rules = parseMarkdownPatdownRules(
			['# No title case', 'globs: **/*.md, docs/**/*.mdx', '', 'Use sentence case.', ''].join('\n'),
		)

		expect(rules).toEqual([
			{
				patdownRuleBody: 'Use sentence case.',
				patdownRuleGlobs: ['**/*.md', 'docs/**/*.mdx'],
				patdownRuleTitle: 'No title case',
			},
		])
	})

	it('stacks consecutive glob lines', () => {
		const rules = parseMarkdownPatdownRules(
			['# Paths', 'globs: **/*.ts', 'globs: **/*.tsx', '', 'Keep it typed.', ''].join('\n'),
		)

		expect(rules[0]?.patdownRuleGlobs).toEqual(['**/*.ts', '**/*.tsx'])
	})

	it('does not treat headings inside fences as rules', () => {
		const rules = parseMarkdownPatdownRules(
			[
				'# Real rule',
				'',
				'Not allowed:',
				'```',
				'# Fake heading',
				'```',
				'',
				'Still the same rule.',
				'',
			].join('\n'),
		)

		expect(rules).toHaveLength(1)
		expect(rules[0]?.patdownRuleTitle).toBe('Real rule')
		expect(rules[0]?.patdownRuleBody).toContain('# Fake heading')
	})

	it('preserves h2 and deeper headings in the rule body', () => {
		const body = [
			'Use sentence case.',
			'',
			'## Not allowed',
			'Title case headings.',
			'',
			'## Exceptions',
			'### Proper nouns',
			'Keep their spelling.',
		].join('\n')

		const rules = parseMarkdownPatdownRules(
			`# First rule\nglobs: **/*.md\n\n${body}\n\n# Second rule\n\nAnother rule.`,
		)

		expect(rules).toEqual([
			{ patdownRuleTitle: 'First rule', patdownRuleBody: body, patdownRuleGlobs: ['**/*.md'] },
			{ patdownRuleTitle: 'Second rule', patdownRuleBody: 'Another rule.', patdownRuleGlobs: [] },
		])
	})

	it('splits multiple heading rules', () => {
		const rules = parseMarkdownPatdownRules('# One\n\nFirst.\n\n# Two\n\nSecond.\n')

		expect(rules.map((rule) => rule.patdownRuleTitle)).toEqual(['One', 'Two'])
	})
})
