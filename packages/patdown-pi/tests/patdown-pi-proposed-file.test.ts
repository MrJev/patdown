import { describe, expect, it } from 'vitest'

import { applyExactPatdownEdits, patdownRelativeToolPath } from '#src/patdown-pi-proposed-file'

describe('proposed file reconstruction', () => {
	it('applies disjoint edits against the original contents', () => {
		const next = applyExactPatdownEdits('alpha beta gamma', [
			{ oldText: 'alpha', newText: 'ALPHA' },
			{ oldText: 'gamma', newText: 'GAMMA' },
		])

		expect(next).toBe('ALPHA beta GAMMA')
	})

	it('rejects overlapping or missing edits', () => {
		expect(applyExactPatdownEdits('alpha', [{ oldText: 'missing', newText: 'x' }])).toBeNull()
		expect(
			applyExactPatdownEdits('overlap zone', [
				{ oldText: 'overlap zone', newText: 'a' },
				{ oldText: 'zone', newText: 'b' },
			]),
		).toBeNull()
	})

	it('drops paths outside cwd and skipped directories', () => {
		expect(patdownRelativeToolPath('/repo', 'src/cli.ts')).toBe('src/cli.ts')
		expect(patdownRelativeToolPath('/repo', '/repo/src/cli.ts')).toBe('src/cli.ts')
		expect(patdownRelativeToolPath('/repo', '../outside.ts')).toBeNull()
		expect(patdownRelativeToolPath('/repo', 'node_modules/pkg/index.ts')).toBeNull()
	})
})
