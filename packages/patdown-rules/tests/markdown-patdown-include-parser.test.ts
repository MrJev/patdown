import { describe, expect, it } from 'vitest'

import {
	parseMarkdownPatdownFrontmatter,
	parseMarkdownPatdownIncludes,
} from '#src/markdown-patdown-include-parser'

describe('parseMarkdownPatdownIncludes', () => {
	it('collects a single include path', () => {
		const includes = parseMarkdownPatdownIncludes(
			[
				'---',
				'include: ./packs/typescript',
				'---',
				'',
				'# No title case',
				'',
				'Use sentence case.',
				'',
			].join('\n'),
		)

		expect(includes).toEqual(['./packs/typescript'])
	})

	it('collects a YAML list under include', () => {
		const includes = parseMarkdownPatdownIncludes(
			[
				'---',
				'include:',
				'  - ./packs/typescript',
				'  - `./node_modules/@patdown/packs/effect`',
				'---',
				'',
				'# Rule',
				'',
			].join('\n'),
		)

		expect(includes).toEqual(['./packs/typescript', './node_modules/@patdown/packs/effect'])
	})

	it('returns no includes when the file has no frontmatter', () => {
		expect(
			parseMarkdownPatdownIncludes('include: ./not-frontmatter\n\n# First rule\n\nDo the thing.\n'),
		).toEqual([])
	})

	it('rejects a second include key, unknown keys, empty include, and unterminated frontmatter', () => {
		expect(() =>
			parseMarkdownPatdownIncludes('---\ninclude: ./a\ninclude: ./b\n---\n\n# Rule\n'),
		).toThrow(/only one include key/u)
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

	it('reads github-annotation from frontmatter', () => {
		expect(
			parseMarkdownPatdownFrontmatter(
				[
					'---',
					'include: ./packs/typescript',
					'github-annotation: warning',
					'---',
					'',
					'# Rule',
					'',
				].join('\n'),
			),
		).toEqual({
			includes: ['./packs/typescript'],
			githubAnnotation: 'warning',
		})

		expect(() =>
			parseMarkdownPatdownFrontmatter(
				'---\ngithub-annotation: warning\ngithub-annotation: notice\n---\n\n# Rule\n',
			),
		).toThrow(/only one github-annotation key/u)

		expect(() =>
			parseMarkdownPatdownFrontmatter('---\ngithub-annotation: info\n---\n\n# Rule\n'),
		).toThrow(/error, warning, or notice/u)
	})
})
