import { JevSystemOne, JevSystemOneLive } from '@patdown/jev'
import { Effect, Layer } from 'effect'
import { FetchHttpClient } from 'effect/unstable/http'

import { PatdownJudge, PatdownJudgeFailed, type PatdownJudgment } from '#src/patdown-judge'

/**
 * Temporary TypeSafe backend. Replace this layer with Effect Decision/DecisionModel when available;
 * see issue #1.
 */
export const TypeSafeJudgeLive = Layer.effect(
	PatdownJudge,
	Effect.gen(function* () {
		const client = yield* JevSystemOne

		return {
			ask: (question, inputText): Effect.Effect<PatdownJudgment, PatdownJudgeFailed> =>
				client.askNoul(question, inputText).pipe(
					Effect.map((answer) => ({ yesProbability: answer.noul })),
					Effect.mapError((error) => new PatdownJudgeFailed({ message: error.message })),
					Effect.provide(FetchHttpClient.layer),
				),
		}
	}),
).pipe(Layer.provide(JevSystemOneLive))
