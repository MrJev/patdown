import { describe, expect, it } from 'vitest'

import {
	patdownModuleHasPlainRuleSource,
	type PatdownPlainRulesDocument,
} from '#src/patdown-plain-rule-source'

describe('plain rule source', () => {
	it('recognizes a loadPatdownRules export and rejects a layer-only module shape', () => {
		const plain = {
			loadPatdownRules: (): PatdownPlainRulesDocument => ({
				patdownRules: [],
				patdownRulesFilePath: 'conventions',
			}),
		}

		expect(patdownModuleHasPlainRuleSource(plain)).toBe(true)
		expect(patdownModuleHasPlainRuleSource({ PatdownRuleSourceLive: {} })).toBe(false)
		expect(patdownModuleHasPlainRuleSource(null)).toBe(false)
	})
})
