import { Data } from 'effect'

/** GitHub workflow-command annotation levels. There is no `::info`. */
export type PatdownGitHubAnnotationLevel = 'error' | 'warning' | 'notice'

/** Default FAIL annotation level when nothing else is configured. */
export const defaultPatdownGitHubAnnotationLevel: PatdownGitHubAnnotationLevel = 'error'

/** Invalid github-annotation value from markdown, package.json, or CLI. */
export class PatdownGitHubAnnotationInvalid extends Data.TaggedError(
	'PatdownGitHubAnnotationInvalid',
)<{
	readonly message: string
}> {}

function isPatdownGitHubAnnotationLevel(value: string): value is PatdownGitHubAnnotationLevel {
	return value === 'error' || value === 'warning' || value === 'notice'
}

/** Decode a github-annotation string. Empty or unknown values fail. */
export function decodePatdownGitHubAnnotationLevel(
	value: string,
	label: string,
): PatdownGitHubAnnotationLevel | PatdownGitHubAnnotationInvalid {
	const trimmed = value.trim()

	if (trimmed.length === 0) {
		return new PatdownGitHubAnnotationInvalid({
			message: `patdown: ${label} is empty; use error, warning, or notice`,
		})
	}

	if (!isPatdownGitHubAnnotationLevel(trimmed)) {
		return new PatdownGitHubAnnotationInvalid({
			message: `patdown: ${label} must be error, warning, or notice; got ${JSON.stringify(trimmed)}`,
		})
	}

	return trimmed
}

/**
 * Resolve annotation level for one FAIL. Per-rule (including a baked frontmatter default) wins,
 * then package/CLI default, then error.
 */
export function resolvePatdownGitHubAnnotationLevel(options: {
	readonly ruleLevel: PatdownGitHubAnnotationLevel | undefined
	readonly configuredLevel: PatdownGitHubAnnotationLevel | undefined
}): PatdownGitHubAnnotationLevel {
	return options.ruleLevel ?? options.configuredLevel ?? defaultPatdownGitHubAnnotationLevel
}
