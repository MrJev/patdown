import { Context, Data, Effect, Schema } from 'effect'

/** Provider-neutral estimate. This is P(yes), not confidence in whichever answer wins. */
export const PatdownJudgmentSchema = Schema.Struct({
	yesProbability: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
})

/** A judge estimates the probability that the question is true of the supplied text. */
export type PatdownJudgment = typeof PatdownJudgmentSchema.Type

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

/** Patdown policy, not provider policy: only probabilities strictly above this count as yes. */
export const patdownYesThreshold = 0.85

/** Applies the same yes cutoff to direct questions and rule violations. */
export function patdownJudgmentIsYes(judgment: PatdownJudgment): boolean {
	return judgment.yesProbability > patdownYesThreshold
}

/** Validates custom judge responses at the service boundary before applying policy or printing. */
export function askPatdownJudge(
	question: string,
	inputText: string,
): Effect.Effect<PatdownJudgment, PatdownJudgeFailed, PatdownJudge> {
	return Effect.gen(function* () {
		const judge = yield* PatdownJudge
		const answer = yield* judge.ask(question, inputText)

		return yield* Schema.decodeEffect(PatdownJudgmentSchema)(answer).pipe(
			Effect.mapError(
				() =>
					new PatdownJudgeFailed({ message: 'patdown: judge returned an invalid yes probability' }),
			),
		)
	})
}
