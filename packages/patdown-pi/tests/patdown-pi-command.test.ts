import { describe, expect, it } from 'vitest'

import { applyPatdownPiCommand } from '#src/patdown-pi-command'
import { idlePatdownPiSession, type PatdownPiSession } from '#src/patdown-pi-session'

function sessionWithRules(): PatdownPiSession {
	return {
		enabled: true,
		document: {
			patdownRulesFilePath: 'AGENTS.PATDOWN.md',
			patdownRules: [
				{
					patdownRuleTitle: 'No title case',
					patdownRuleBody: 'Use sentence case.',
					patdownRuleGlobs: ['**/*.md'],
				},
			],
		},
		yesThreshold: 0.85,
		loadError: null,
		policy: { mode: 'block', when: 'before' },
	}
}

describe('pi slash commands', () => {
	it('toggles on/off and sets mode/when', () => {
		const loaded = sessionWithRules()

		expect(applyPatdownPiCommand(loaded, 'off')?.enabled).toBe(false)
		expect(applyPatdownPiCommand(loaded, 'steer')?.policy).toEqual({
			mode: 'steer',
			when: 'after',
		})
		expect(applyPatdownPiCommand(loaded, 'both')?.policy).toEqual({
			mode: 'block',
			when: 'before',
		})
		expect(
			applyPatdownPiCommand(applyPatdownPiCommand(loaded, 'steer') ?? loaded, 'both')?.policy,
		).toEqual({
			mode: 'steer',
			when: 'both',
		})
		expect(applyPatdownPiCommand(loaded, 'status')).toBe(loaded)
		expect(applyPatdownPiCommand(idlePatdownPiSession(), 'wat')).toBeNull()
	})
})
