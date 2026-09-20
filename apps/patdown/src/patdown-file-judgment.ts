import {
	PatdownYesThresholdInvalid,
	type PatdownRule,
	type PatdownRulesDocument,
	type PatdownYesThreshold,
} from '@patdown/rules'
import { Effect } from 'effect'

import { patdownPathIsExcluded, patdownPathMatchesRuleGlobs } from '#src/patdown-glob'
import {
	PatdownJudge,
	PatdownJudgeFailed,
	askPatdownJudge,
	patdownJudgmentIsYes,
} from '#src/patdown-judge'
import type { PatdownLintResult } from '#src/patdown-output'
import { decodePatdownRuleYesThreshold } from '#src/patdown-yes-threshold-config'

/** Question sent to the judge for a file/rule pair. */
export function patdownViolationInstructions(rule: PatdownRule): string {
	return [
		'Does this file violate the following patdown rule? Answer yes only if there is a clear violation.',
		'',
		`# ${rule.patdownRuleTitle}`,
		'',
		rule.patdownRuleBody,
	].join('\n')
}

/** File payload the judge sees: path plus contents. */
export function patdownFileState(relativePath: string, contents: string): string {
	return `path: ${relativePath}\n\n${contents}`
}

/** True when this rule applies to a cwd-relative path. */
export function patdownRuleAppliesToPath(rule: PatdownRule, relativePath: string): boolean {
	if (patdownPathIsExcluded(relativePath)) return false

	return patdownPathMatchesRuleGlobs(relativePath, rule.patdownRuleGlobs)
}

/** Judge one in-memory file against one rule. Does not locate evidence or print. */
export function judgePatdownFileContents(
	rule: PatdownRule,
	relativePath: string,
	contents: string,
	yesThreshold: PatdownYesThreshold,
): Effect.Effect<PatdownLintResult, PatdownJudgeFailed, PatdownJudge> {
	return Effect.gen(function* () {
		const timed = yield* askPatdownJudge(
			patdownViolationInstructions(rule),
			patdownFileState(relativePath, contents),
		)

		const result: PatdownLintResult = {
			violated: patdownJudgmentIsYes(timed.judgment, yesThreshold),
			ruleTitle: rule.patdownRuleTitle,
			ruleBody: rule.patdownRuleBody,
			ruleGlobs: rule.patdownRuleGlobs,
			filePath: relativePath,
			violationProbability: timed.judgment.yesProbability,
			yesThreshold,
			elapsedMs: timed.elapsedMs,
		}

		if (rule.patdownRuleGitHubAnnotation === undefined) return result

		return {
			...result,
			githubAnnotation: rule.patdownRuleGitHubAnnotation,
		}
	})
}

/** Judge one in-memory file against every matching rule in a document. */
export function judgePatdownMatchingRules(
	document: PatdownRulesDocument,
	relativePath: string,
	contents: string,
	defaultYesThreshold: PatdownYesThreshold,
): Effect.Effect<
	ReadonlyArray<PatdownLintResult>,
	PatdownJudgeFailed | PatdownYesThresholdInvalid,
	PatdownJudge
> {
	return Effect.gen(function* () {
		const results: PatdownLintResult[] = []

		for (const rule of document.patdownRules) {
			if (!patdownRuleAppliesToPath(rule, relativePath)) continue

			const yesThreshold =
				rule.patdownRuleYesThreshold === undefined
					? defaultYesThreshold
					: yield* decodePatdownRuleYesThreshold(
							rule.patdownRuleYesThreshold,
							rule.patdownRuleTitle,
						)

			results.push(yield* judgePatdownFileContents(rule, relativePath, contents, yesThreshold))
		}

		return results
	})
}
