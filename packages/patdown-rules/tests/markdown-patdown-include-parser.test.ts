import { describe, expect, it } from 'vitest'

import { parseMarkdownPatdownIncludes } from '#src/markdown-patdown-include-parser'

describe('parseMarkdownPatdownIncludes', () => {
	it('collects stacked include keys from frontmatter', () => {
		const includes = parseMarkdownPatdownIncludes(
			[
				'---',
				'include: ./packs/typescript',
				'include: `./node_modules/@patdown/packs/effect`',
				'---',
				'',
				'# No title case',
				'',
				'Use sentence case.',
				'',
			].join('\n'),
		)

		expect(includes).toEqual(['./packs/typescript', './node_modules/@patdown/packs/effect'])
	})

	it('collects a YAML list under include', () => {
		const includes = parseMarkdownPatdownIncludes(
			[
				'---',
				'include:',
				'  - ./packs/typescript',
				'  - ./packs/effect',
				'---',
				'',
				'# Rule',
				'',
			].join('\n'),
		)

		expect(includes).toEqual(['./packs/typescript', './packs/effect'])
	})

	it('returns no includes when the file has no frontmatter', () => {
		expect(
			parseMarkdownPatdownIncludes('include: ./not-frontmatter\n\n# First rule\n\nDo the thing.\n'),
		).toEqual([])
	})

	it('rejects unknown keys, empty include, and unterminated frontmatter', () => {
		expect(() => parseMarkdownPatdownIncludes('---\nomit: ./x\n---\n\n# Rule\n')).toThrow(
			/unknown frontmatter key/u,
		)
		expect(() => parseMarkdownPatdownIncludes('---\ninclude:\n---\n\n# Rule\n')).toThrow(
			/include path is empty/u,
		)
		expect(() => parseMarkdownPatdownIncludes('---\ninclude: ./x\n\n# Rule\n')).toThrow(
			/unterminated frontmatter/u,
		)
	})
})
