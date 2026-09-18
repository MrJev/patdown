import { PatdownRuleSource } from '@patdown/rules'
import { Effect, Layer } from 'effect'

export const PatdownRuleSourceLive = Layer.succeed(PatdownRuleSource, {
	loadPatdownRules: () =>
		Effect.succeed({
			patdownRules: [
				{
					patdownRuleBody: 'Adapter body.',
					patdownRuleGlobs: ['**/*.md'],
					patdownRuleTitle: 'From adapter',
				},
			],
			patdownRulesFilePath: '/tmp/adapter-rules',
		}),
})
