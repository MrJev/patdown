import { describe, expect, it } from 'vitest'

import {
	decodePatdownPiMode,
	decodePatdownPiPolicyFromPackageJsonText,
	decodePatdownPiWhen,
	defaultPatdownPiPolicy,
	formatPatdownPiPolicy,
	patdownPiJudgesAfter,
	patdownPiJudgesBefore,
	patdownPiPolicyForMode,
	patdownPiPolicyWithWhen,
} from '#src/patdown-pi-policy'

describe('pi policy', () => {
	it('defaults to block/before', () => {
		expect(defaultPatdownPiPolicy).toEqual({ mode: 'block', when: 'before' })
		expect(formatPatdownPiPolicy(defaultPatdownPiPolicy)).toBe('block/before')
	})

	it('pairs modes with a default when', () => {
		expect(patdownPiPolicyForMode('block')).toEqual({ mode: 'block', when: 'before' })
		expect(patdownPiPolicyForMode('steer')).toEqual({ mode: 'steer', when: 'after' })
		expect(patdownPiPolicyForMode('warn')).toEqual({ mode: 'warn', when: 'after' })
	})

	it('clamps block to before even if when is after', () => {
		const blockedAfter = patdownPiPolicyWithWhen(patdownPiPolicyForMode('block'), 'after')

		expect(blockedAfter).toEqual({ mode: 'block', when: 'before' })
		expect(patdownPiJudgesBefore(blockedAfter)).toBe(true)
		expect(patdownPiJudgesAfter(blockedAfter)).toBe(false)
	})

	it('lets steer/warn judge before, after, or both', () => {
		const steerBefore = { mode: 'steer', when: 'before' } as const
		const warnBoth = { mode: 'warn', when: 'both' } as const

		expect(patdownPiJudgesBefore(steerBefore)).toBe(true)
		expect(patdownPiJudgesAfter(steerBefore)).toBe(false)
		expect(patdownPiJudgesBefore(warnBoth)).toBe(true)
		expect(patdownPiJudgesAfter(warnBoth)).toBe(true)
	})

	it('decodes package.json patdown.pi and ignores junk', () => {
		expect(decodePatdownPiMode('steer')).toBe('steer')
		expect(decodePatdownPiWhen('both')).toBe('both')
		expect(decodePatdownPiMode('hold')).toBeNull()
		expect(
			decodePatdownPiPolicyFromPackageJsonText(
				JSON.stringify({ patdown: { pi: { mode: 'warn', when: 'both' } } }),
			),
		).toEqual({ mode: 'warn', when: 'both' })
		expect(
			decodePatdownPiPolicyFromPackageJsonText(
				JSON.stringify({ patdown: { pi: { mode: 'steer' } } }),
			),
		).toEqual({ mode: 'steer', when: 'after' })
		expect(decodePatdownPiPolicyFromPackageJsonText(JSON.stringify({ name: 'x' }))).toBeNull()
	})
})
