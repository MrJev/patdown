/**
 * One fuzzy patdown rule loaded from a rules file. Globs are optional; an empty list means the rule
 * applies to the whole run.
 */
export type PatdownRule = {
	readonly patdownRuleBody: string
	readonly patdownRuleGlobs: ReadonlyArray<string>
	readonly patdownRuleTitle: string
}

/** Parsed patdown rules plus the file they were loaded from. */
export type PatdownRulesDocument = {
	readonly patdownRules: ReadonlyArray<PatdownRule>
	readonly patdownRulesFilePath: string
}

/** Default markdown rules file name walked from the working directory. */
export const defaultPatdownRulesFileName = 'AGENTS.PATDOWN.md'
