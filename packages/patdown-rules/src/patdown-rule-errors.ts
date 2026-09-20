import { Data } from 'effect'

/** No AGENTS.PATDOWN.md (or override path) existed walking up from the start directory. */
export class PatdownRulesFileMissing extends Data.TaggedError('PatdownRulesFileMissing')<{
	readonly patdownRulesFileName: string
	readonly startDirectory: string
}> {
	override get message(): string {
		return `patdown: no ${this.patdownRulesFileName} found walking up from ${this.startDirectory}`
	}
}

/** The rules file existed but could not be read. */
export class PatdownRulesReadFailed extends Data.TaggedError('PatdownRulesReadFailed')<{
	readonly patdownRulesFilePath: string
}> {
	override get message(): string {
		return `patdown: failed to read ${this.patdownRulesFilePath}`
	}
}

/**
 * Adapter discovery, parsing, or loading failed. Preserve the source-specific diagnostic in
 * message.
 */
export class PatdownRulesLoadFailed extends Data.TaggedError('PatdownRulesLoadFailed')<{
	readonly message: string
}> {}
