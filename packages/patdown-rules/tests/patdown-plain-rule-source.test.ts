import { describe, expect, it } from 'vitest'

import {
	patdownModuleHasPlainRuleSource,
	patdownPlainRuleSourceLayer,
	type PatdownPlainRulesDocument,
} from '#src/patdown-plain-rule-source'
import { PatdownRulesLoadFailed } from '#src/patdown-rule-errors'

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
		expect(patdownPlainRuleSourceLayer(plain)).toBeDefined()
	})

	it('names the load failure type adapters should surface', () => {
		const error = new PatdownRulesLoadFailed({
			message:
				'patdown: plain adapter rule "broken" yes-threshold must be a finite number in [0, 1)',
		})

		expect(error.message).toContain('yes-threshold')
	})
})
