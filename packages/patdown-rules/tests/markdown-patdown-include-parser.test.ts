import { describe, expect, it } from 'vitest'

import { parseMarkdownPatdownIncludes } from '#src/markdown-patdown-include-parser'

describe('parseMarkdownPatdownIncludes', () => {
	it('collects include lines above the first heading', () => {
		const includes = parseMarkdownPatdownIncludes(
			[
				'Project rules.',
				'include: ./packs/typescript',
				'include: `./node_modules/@patdown/packs/effect`',
				'',
				'# No title case',
				'',
				'Use sentence case.',
				'',
			].join('\n'),
		)

		expect(includes).toEqual(['./packs/typescript', './node_modules/@patdown/packs/effect'])
	})

	it('ignores include lines after the first heading and inside fences', () => {
		const includes = parseMarkdownPatdownIncludes(
			[
				'```',
				'include: ./ignored-fence',
				'```',
				'',
				'# First rule',
				'include: ./ignored-body',
				'',
				'Do the thing.',
				'',
			].join('\n'),
		)

		expect(includes).toEqual([])
	})

	it('rejects an empty include path', () => {
		expect(() => parseMarkdownPatdownIncludes('include:   \n\n# Rule\n\nBody.\n')).toThrow(
			/include path is empty/u,
		)
	})
})
