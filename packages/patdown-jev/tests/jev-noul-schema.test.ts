import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import { JevNoulResultSchema } from '#/jev-noul-schema'

describe('JevNoulResultSchema', () => {
	it('decodes a System One noul response', () => {
		const decoded = Schema.decodeSync(JevNoulResultSchema)({
			answers: {
				noul: {
					noul: 0.92,
					type: 'noul',
				},
			},
			model: 'jev-latest',
			usage: {
				input_tokens: 12,
				output_tokens: 4,
			},
		})

		expect(decoded.model).toBe('jev-latest')
		expect(decoded.answers['noul']?.noul).toBe(0.92)
	})
})
