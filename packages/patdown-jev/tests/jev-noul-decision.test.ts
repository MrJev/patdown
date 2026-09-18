import { describe, expect, it } from 'vitest'

import { jevNoulIsYes, jevNoulYesThreshold } from '#/jev-noul-decision'

describe('jevNoulIsYes', () => {
	it('is no at the threshold', () => {
		expect(jevNoulIsYes(jevNoulYesThreshold)).toBe(false)
	})

	it('is yes only above the threshold', () => {
		expect(jevNoulIsYes(0.74)).toBe(false)
		expect(jevNoulIsYes(0.851)).toBe(true)
	})
})
