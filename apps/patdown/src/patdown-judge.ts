import {
	defaultPatdownYesThreshold,
	patdownJudgmentIsYes as comparePatdownYesProbability,
	type PatdownYesThreshold,
} from '@patdown/rules'
import { Clock, Context, Data, Effect, Schema } from 'effect'

/** Provider-neutral estimate. This is P(yes), not confidence in whichever answer wins. */
export const PatdownJudgmentSchema = Schema.Struct({
	yesProbability: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
})

/** A judge estimates the probability that the question is true of the supplied text. */
export type PatdownJudgment = typeof PatdownJudgmentSchema.Type

/** A validated judgment plus how long the judge call took. */
export type PatdownTimedJudgment = {
	readonly judgment: PatdownJudgment
	readonly elapsedMs: number
}

/** Provider or response validation failure, independent of the backend. */
export class PatdownJudgeFailed extends Data.TaggedError('PatdownJudgeFailed')<{
	readonly message: string
}> {}

/** Swappable judge service. Providers supply their own transport dependencies internally. */
export class PatdownJudge extends Context.Service<
	PatdownJudge,
	{
		readonly ask: (
			question: string,
			inputText: string,
		) => Effect.Effect<PatdownJudgment, PatdownJudgeFailed>
	}
>()('@patdown/cli/PatdownJudge') {}

/** Default cutoff, still used when no flag, package.json, or per-rule value is set. */
export const patdownYesThreshold = defaultPatdownYesThreshold

/** Applies a cutoff to a validated probability. Equality is not yes. */
export function patdownJudgmentIsYes(
	judgment: PatdownJudgment,
	yesThreshold: PatdownYesThreshold = defaultPatdownYesThreshold,
): boolean {
	return comparePatdownYesProbability(judgment.yesProbability, yesThreshold)
}

/** Validates custom judge responses at the service boundary before applying policy or printing. */
export function askPatdownJudge(
	question: string,
	inputText: string,
): Effect.Effect<PatdownTimedJudgment, PatdownJudgeFailed, PatdownJudge> {
	return Effect.gen(function* () {
		const judge = yield* PatdownJudge
		const startedAt = yield* Clock.currentTimeMillis
		const answer = yield* judge.ask(question, inputText)
		const finishedAt = yield* Clock.currentTimeMillis

		const judgment = yield* Schema.decodeEffect(PatdownJudgmentSchema)(answer).pipe(
			Effect.mapError(
				() =>
					new PatdownJudgeFailed({ message: 'patdown: judge returned an invalid yes probability' }),
			),
		)

		return {
			judgment,
			elapsedMs: Math.max(0, finishedAt - startedAt),
		}
	})
}
