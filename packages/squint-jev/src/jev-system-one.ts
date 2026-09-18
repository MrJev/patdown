import { Config, Context, Data, Effect, Layer, Redacted } from 'effect'
import type { ConfigError } from 'effect/Config'
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/unstable/http'

import { JevNoulResultSchema, type JevNoulAnswer } from '#/jev-noul-schema'

const defaultJevBaseUrl = 'https://api.typesafe.ai'

const defaultJevModel = 'jev-latest'

const defaultNoulQuestionName = 'noul'

/** Jev / System One HTTP or config failure. Swap this service later for Effect's Decision API. */
export class JevRequestFailed extends Data.TaggedError('JevRequestFailed')<{
	readonly message: string
}> {}

/**
 * Client for TypeSafe System One (Jev). Implemented with Effect HttpClient so a Decision-based
 * layer can replace it.
 */
export class JevSystemOne extends Context.Service<
	JevSystemOne,
	{
		readonly askNoul: (
			instructions: string,
			state: string,
		) => Effect.Effect<JevNoulAnswer, JevRequestFailed, HttpClient.HttpClient>
	}
>()('@squint/jev/JevSystemOne') {}

function readJevApiKey(): Effect.Effect<Redacted.Redacted, JevRequestFailed> {
	return Config.redacted('TYPESAFE_API_KEY').pipe(
		Effect.mapError(
			() =>
				new JevRequestFailed({
					message: 'jev: TYPESAFE_API_KEY is missing or empty',
				}),
		),
	)
}

function readJevBaseUrl(): Effect.Effect<string, ConfigError> {
	return Config.string('TYPESAFE_BASE_URL').pipe(Config.withDefault(defaultJevBaseUrl))
}

function readJevModel(): Effect.Effect<string, ConfigError> {
	return Config.string('TYPESAFE_DEFAULT_MODEL').pipe(Config.withDefault(defaultJevModel))
}

function noulAnswerFromResult(
	result: typeof JevNoulResultSchema.Type,
	questionName: string,
): Effect.Effect<JevNoulAnswer, JevRequestFailed> {
	const answer = result.answers[questionName]

	if (answer === undefined) {
		return Effect.fail(
			new JevRequestFailed({
				message: `jev: response missing noul answer ${questionName}`,
			}),
		)
	}

	return Effect.succeed(answer)
}

function encodeJevNoulBody(
	prepared: HttpClientRequest.HttpClientRequest,
	model: string,
	instructions: string,
	state: string,
): Effect.Effect<HttpClientRequest.HttpClientRequest, JevRequestFailed> {
	return HttpClientRequest.bodyJson(prepared, {
		model,
		questions: {
			[defaultNoulQuestionName]: {
				criteria: {
					false: 'No. The state does not match, or there is not enough evidence.',
					true: 'Yes. The state clearly matches the question.',
				},
				instructions,
				type: 'noul',
			},
		},
		state,
	}).pipe(
		Effect.mapError(
			() =>
				new JevRequestFailed({
					message: 'jev: failed to encode System One request body',
				}),
		),
	)
}

function askJevNoul(
	instructions: string,
	state: string,
): Effect.Effect<JevNoulAnswer, JevRequestFailed, HttpClient.HttpClient> {
	return Effect.gen(function* () {
		const apiKey = yield* readJevApiKey()
		const baseUrl = yield* Effect.orDie(readJevBaseUrl())
		const model = yield* Effect.orDie(readJevModel())
		const client = HttpClient.filterStatusOk(yield* HttpClient.HttpClient)

		const prepared = HttpClientRequest.post(`${baseUrl}/v1/systemone`).pipe(
			HttpClientRequest.bearerToken(apiKey),
			HttpClientRequest.acceptJson,
		)

		const request = yield* encodeJevNoulBody(prepared, model, instructions, state)

		const response = yield* client.execute(request).pipe(
			Effect.mapError(
				() =>
					new JevRequestFailed({
						message: 'jev: System One request failed',
					}),
			),
		)

		const result = yield* HttpClientResponse.schemaBodyJson(JevNoulResultSchema)(response).pipe(
			Effect.mapError(
				() =>
					new JevRequestFailed({
						message: 'jev: System One response did not match noul schema',
					}),
			),
		)

		return yield* noulAnswerFromResult(result, defaultNoulQuestionName)
	})
}

/** Live Jev client using Effect HttpClient and TYPESAFE_* config. */
export const JevSystemOneLive = Layer.succeed(JevSystemOne, {
	askNoul: askJevNoul,
})
