export { patdownCommand, makePatdownCommand } from '#src/cli'

export { PatdownOutput, PatdownOutputLive, type PatdownLintResult } from '#src/patdown-output'

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
} from '#src/patdown-judge'

export {
	defaultPatdownYesThreshold,
	decodePatdownYesThreshold,
	PatdownYesThresholdInvalid,
	type PatdownYesThreshold,
} from '@patdown/rules'

export { TypeSafeJudgeLive } from '#src/typesafe-judge'
