import { describe, expect, it } from 'vitest'

import { parseMarkdownSquintRules } from '#/markdown-squint-rule-parser'

describe('parseMarkdownSquintRules', () => {
	it('ignores text above the first heading', () => {
		const rules = parseMarkdownSquintRules('Preamble notes.\n\n# First rule\n\nDo the thing.\n')

		expect(rules).toEqual([
			{
				squintRuleBody: 'Do the thing.',
				squintRuleGlobs: [],
				squintRuleTitle: 'First rule',
			},
		])
	})

	it('reads globs from the first lines of a rule body', () => {
		const rules = parseMarkdownSquintRules(
			['# No title case', 'globs: **/*.md, docs/**/*.mdx', '', 'Use sentence case.', ''].join('\n'),
		)

		expect(rules).toEqual([
			{
				squintRuleBody: 'Use sentence case.',
				squintRuleGlobs: ['**/*.md', 'docs/**/*.mdx'],
				squintRuleTitle: 'No title case',
			},
		])
	})

	it('stacks consecutive glob lines', () => {
		const rules = parseMarkdownSquintRules(
			['# Paths', 'globs: **/*.ts', 'globs: **/*.tsx', '', 'Keep it typed.', ''].join('\n'),
		)

		expect(rules[0]?.squintRuleGlobs).toEqual(['**/*.ts', '**/*.tsx'])
	})

	it('does not treat headings inside fences as rules', () => {
		const rules = parseMarkdownSquintRules(
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
		expect(rules[0]?.squintRuleTitle).toBe('Real rule')
		expect(rules[0]?.squintRuleBody).toContain('# Fake heading')
	})

	it('splits multiple heading rules', () => {
		const rules = parseMarkdownSquintRules('# One\n\nFirst.\n\n# Two\n\nSecond.\n')

		expect(rules.map((rule) => rule.squintRuleTitle)).toEqual(['One', 'Two'])
	})
})
