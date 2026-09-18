import { PatdownRuleSource } from '@patdown/rules'
import { Effect, Layer } from 'effect'

export const missingService = Layer.empty

export const invalidService = Layer.succeed(PatdownRuleSource, {})

export const invalidDocument = Layer.succeed(PatdownRuleSource, {
	loadPatdownRules: () => Effect.succeed({ patdownRules: 'not an array' }),
})
