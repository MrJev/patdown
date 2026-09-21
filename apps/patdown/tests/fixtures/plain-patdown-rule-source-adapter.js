/** @param {string | null} override */
export function loadPatdownRules(override) {
	return {
		patdownRulesFilePath: override ?? 'plain-adapter',
		patdownRules: [
			{
				patdownRuleBody: 'Plain body.',
				patdownRuleGlobs: ['**/*.md'],
				patdownRuleTitle: 'From plain adapter',
			},
		],
	}
}
