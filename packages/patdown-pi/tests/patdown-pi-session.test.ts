import { describe, expect, it } from 'vitest'

import {
	formatPatdownPiStatus,
	idlePatdownPiSession,
	setPatdownPiEnabled,
	type PatdownPiSession,
} from '#src/patdown-pi-session'

function sessionWithRules(enabled: boolean): PatdownPiSession {
	return {
		enabled,
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

describe('pi session status', () => {
	it('reports idle, loaded, disabled, and load errors', () => {
		expect(formatPatdownPiStatus(idlePatdownPiSession())).toBe(
			'patdown off block/before (no rules)',
		)
		expect(formatPatdownPiStatus(sessionWithRules(true))).toBe(
			'patdown on block/before (1 rule from AGENTS.PATDOWN.md)',
		)
		expect(formatPatdownPiStatus(setPatdownPiEnabled(sessionWithRules(true), false))).toBe(
			'patdown off block/before (1 rule from AGENTS.PATDOWN.md)',
		)
		expect(
			formatPatdownPiStatus({
				...idlePatdownPiSession(),
				loadError: 'patdown: no AGENTS.PATDOWN.md found walking up from /tmp',
			}),
		).toBe('patdown off block/before (patdown: no AGENTS.PATDOWN.md found walking up from /tmp)')
	})
})
