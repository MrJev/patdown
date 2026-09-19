import { describe, expect, it } from 'vitest'

import { formatPatdownProbabilityBar } from '#src/patdown-probability-bar'

describe('probability bars', () => {
	it('renders empty, partial, and full cells', () => {
		expect(formatPatdownProbabilityBar(0)).toBe('░░░░░░░░░░')
		expect(formatPatdownProbabilityBar(0.04)).toBe('░░░░░░░░░░')
		expect(formatPatdownProbabilityBar(0.05)).toBe('▒░░░░░░░░░')
		expect(formatPatdownProbabilityBar(0.1)).toBe('▓░░░░░░░░░')
		expect(formatPatdownProbabilityBar(0.86)).toBe('▓▓▓▓▓▓▓▓▒░')
		expect(formatPatdownProbabilityBar(1)).toBe('▓▓▓▓▓▓▓▓▓▓')
	})

	it('clamps out-of-range values', () => {
		expect(formatPatdownProbabilityBar(-1)).toBe('░░░░░░░░░░')
		expect(formatPatdownProbabilityBar(2)).toBe('▓▓▓▓▓▓▓▓▓▓')
	})
})
