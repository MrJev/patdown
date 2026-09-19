import { describe, expect, it } from 'vitest'

import {
	decodePatdownYesThreshold,
	decodePatdownYesThresholdText,
	defaultPatdownYesThreshold,
	patdownJudgmentIsYes,
	PatdownYesThresholdInvalid,
} from '#src/patdown-yes-threshold'

describe('yes threshold policy', () => {
	it('keeps equality below the cutoff', () => {
		expect(patdownJudgmentIsYes(defaultPatdownYesThreshold)).toBe(false)
		expect(patdownJudgmentIsYes(0.851)).toBe(true)
		expect(patdownJudgmentIsYes(0.81, 0.8)).toBe(true)
		expect(patdownJudgmentIsYes(0.81, 0.81)).toBe(false)
	})

	it('accepts the inclusive lower bound and rejects 1', () => {
		expect(decodePatdownYesThreshold(0, 'flag')).toBe(0)
		expect(decodePatdownYesThresholdText('0.0', 'flag')).toBe(0)
		expect(decodePatdownYesThreshold(1, 'flag')).toBeInstanceOf(PatdownYesThresholdInvalid)
		expect(decodePatdownYesThresholdText('1', 'flag')).toBeInstanceOf(PatdownYesThresholdInvalid)
		expect(decodePatdownYesThreshold(Number.NaN, 'flag')).toBeInstanceOf(PatdownYesThresholdInvalid)
		expect(decodePatdownYesThresholdText('nope', 'flag')).toBeInstanceOf(PatdownYesThresholdInvalid)
	})
})
