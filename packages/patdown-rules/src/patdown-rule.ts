import type { PatdownGitHubAnnotationLevel } from '#src/patdown-github-annotation'

/**
 * One fuzzy patdown rule loaded from a rules file. Globs are optional; an empty list means the rule
 * applies to the whole run.
 */
export type PatdownRule = {
	readonly patdownRuleBody: string
	readonly patdownRuleGlobs: ReadonlyArray<string>
	readonly patdownRuleTitle: string
	readonly patdownRuleSourcePath?: string
	readonly patdownRuleYesThreshold?: number
	readonly patdownRuleGitHubAnnotation?: PatdownGitHubAnnotationLevel
}

/**
 * Parsed patdown rules plus an origin path for output. Adapters may use a file, a directory, or
 * another source label.
 */
export type PatdownRulesDocument = {
	readonly patdownRules: ReadonlyArray<PatdownRule>
	readonly patdownRulesFilePath: string
}

/** Default markdown rules file name walked from the working directory. */
export const defaultPatdownRulesFileName = 'AGENTS.PATDOWN.md'
