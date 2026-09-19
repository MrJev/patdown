import { JevSystemOne, JevSystemOneLive } from '@patdown/jev'
import { Effect, Layer } from 'effect'
import { FetchHttpClient } from 'effect/unstable/http'

import { patdownEvidenceNoMatchChoice } from '#src/patdown-evidence-regions'
import {
	PatdownJudge,
	PatdownJudgeFailed,
	type PatdownEvidenceChoice,
	type PatdownJudgment,
} from '#src/patdown-judge'

/** Minimum Choice confidence before a FAIL annotation uses the selected region. */
export const patdownEvidenceMinConfidence = 0.55

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
			locateEvidence: (
				question,
				inputText,
				criteria,
			): Effect.Effect<PatdownEvidenceChoice | null, PatdownJudgeFailed> =>
				client.askChoice(question, inputText, criteria).pipe(
					Effect.map((answer) => {
						if (answer.choice === patdownEvidenceNoMatchChoice()) return null

						if (answer.confidence < patdownEvidenceMinConfidence) return null

						if (!(answer.choice in criteria)) return null

						return {
							regionId: answer.choice,
							confidence: answer.confidence,
						}
					}),
					Effect.mapError((error) => new PatdownJudgeFailed({ message: error.message })),
					Effect.provide(FetchHttpClient.layer),
				),
		}
	}),
).pipe(Layer.provide(JevSystemOneLive))
