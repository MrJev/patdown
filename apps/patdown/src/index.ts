export { patdownCommand, makePatdownCommand } from '#src/cli'

export { PatdownOutput, PatdownOutputLive, type PatdownLintResult } from '#src/patdown-output'

export { PatdownGitHubActionsOutputLive } from '#src/patdown-github-actions-output'

export {
	formatPatdownGitHubActionsAnnotations,
	formatPatdownGitHubActionsSummary,
	patdownLintResultIsNearMiss,
} from '#src/patdown-github-actions-summary'

export {
	patdownGitHubActionsIsEnabled,
	readPatdownGitHubStepSummaryPath,
} from '#src/patdown-github-actions-env'

export type { PatdownLintFileSelection } from '#src/patdown-lint-files'

export type { PatdownRuleSourceLayer } from '#src/patdown-rule-source-adapter'

export { runPatdownCli } from '#src/run-patdown-cli'

export {
	PatdownJudge,
	PatdownJudgeFailed,
	PatdownJudgmentSchema,
	askPatdownJudge,
	patdownJudgmentIsYes,
	patdownYesThreshold,
	type PatdownJudgment,
	type PatdownTimedJudgment,
} from '#src/patdown-judge'

export {
	defaultPatdownYesThreshold,
	decodePatdownYesThreshold,
	PatdownYesThresholdInvalid,
	type PatdownYesThreshold,
} from '@patdown/rules'

export { TypeSafeJudgeLive } from '#src/typesafe-judge'
