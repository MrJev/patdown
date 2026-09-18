/**
 * One fuzzy squint rule loaded from a rules file. Globs are optional; an empty list means the rule
 * applies to the whole run.
 */
export type SquintRule = {
	readonly squintRuleBody: string
	readonly squintRuleGlobs: ReadonlyArray<string>
	readonly squintRuleTitle: string
}

/** Parsed squint rules plus the file they were loaded from. */
export type SquintRulesDocument = {
	readonly squintRules: ReadonlyArray<SquintRule>
	readonly squintRulesFilePath: string
}

/** Default markdown rules file name walked from the working directory. */
export const defaultSquintRulesFileName = 'AGENTS.SQUINT.md'
