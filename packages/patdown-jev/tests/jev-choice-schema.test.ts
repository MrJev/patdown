import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import { JevChoiceResultSchema } from '#src/jev-choice-schema'

describe('JevChoiceResultSchema', () => {
	it('decodes a System One choice response', () => {
		const decoded = Schema.decodeSync(JevChoiceResultSchema)({
			answers: {
				choice: {
					choice: 'r2',
					confidence: 0.81,
					probabilities: { r1: 0.1, r2: 0.81, noMatch: 0.09 },
					type: 'choice',
				},
			},
			model: 'jev-latest',
			usage: {
				input_tokens: 40,
				output_tokens: 8,
			},
		})

		expect(decoded.answers['choice']?.choice).toBe('r2')
		expect(decoded.answers['choice']?.confidence).toBe(0.81)
	})
})
