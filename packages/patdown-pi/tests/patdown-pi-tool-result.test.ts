import { describe, expect, it } from 'vitest'

import { decodePatdownToolResultPath } from '#src/patdown-pi-tool-result'

describe('tool_result path parsing', () => {
	it('reads a string path and rejects missing or non-string paths', () => {
		expect(decodePatdownToolResultPath(JSON.stringify({ path: 'src/cli.ts' }))).toBe('src/cli.ts')
		expect(decodePatdownToolResultPath(JSON.stringify({ path: 12 }))).toBeNull()
		expect(decodePatdownToolResultPath('{}')).toBeNull()
	})
})
