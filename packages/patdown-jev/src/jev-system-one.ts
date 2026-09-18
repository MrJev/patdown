import { Config, Context, Data, Effect, Layer, Redacted, Schema } from 'effect'
import type { ConfigError } from 'effect/Config'
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/unstable/http'

import { JevNoulResultSchema, type JevNoulAnswer } from '#src/jev-noul-schema'

const defaultJevBaseUrl = 'https://api.typesafe.ai'

const defaultJevModel = 'jev-latest'

const defaultNoulQuestionName = 'noul'

/** Jev / System One HTTP or config failure. Swap this service later for Effect's Decision API. */
export class JevRequestFailed extends Data.TaggedError('JevRequestFailed')<{
	readonly message: string
	readonly status?: number
	readonly providerErrorCode?: string | undefined
	readonly requestId?: string | undefined
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
>()('@patdown/jev/JevSystemOne') {}

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

const JevErrorBodySchema = Schema.Struct({
	detail: Schema.Struct({ error_type: Schema.String }),
})

/** Only machine identifiers are logged: provider prose can contain submitted text or credentials. */
function safeJevErrorIdentifier(value: string | undefined): string | undefined {
	return value !== undefined && /^[a-zA-Z0-9_.:-]{1,128}$/u.test(value) ? value : undefined
}

function describeJevHttpFailure(status: number, providerErrorCode: string | undefined): string {
	if (providerErrorCode === 'max_tokens_exceeded') {
		return 'model token limit exceeded; shorten the question/input or split it into smaller requests'
	}

	if (status === 413) return 'HTTP payload too large; reduce the request body size'

	if (status === 401 || status === 403)
		return 'authentication or access rejected; check API credentials and permissions'

	if (status === 429) return 'rate or quota limit reached; check provider limits before retrying'

	if (status >= 500)
		return 'server or upstream failure; this response does not establish an input-size limit'

	return 'request rejected'
}

function jevHttpFailure(
	response: HttpClientResponse.HttpClientResponse,
	state: string,
): Effect.Effect<JevRequestFailed> {
	return Effect.gen(function* () {
		const body = yield* HttpClientResponse.schemaBodyJson(JevErrorBodySchema)(response).pipe(
			Effect.catch(() => Effect.void),
		)

		const providerErrorCode = safeJevErrorIdentifier(body?.detail.error_type)
		const requestId = safeJevErrorIdentifier(response.headers['x-typesafe-request-id'])
		const codeLabel = providerErrorCode === undefined ? '' : `; code: ${providerErrorCode}`
		const requestLabel = requestId === undefined ? '' : `; request ID: ${requestId}`
		const inputBytes = new TextEncoder().encode(state).byteLength

		return new JevRequestFailed({
			message: `jev: System One HTTP ${String(response.status)}: ${describeJevHttpFailure(response.status, providerErrorCode)}${codeLabel}; input UTF-8 bytes: ${String(inputBytes)}${requestLabel}`,
			status: response.status,
			providerErrorCode,
			requestId,
		})
	})
}

function askJevNoul(
	instructions: string,
	state: string,
): Effect.Effect<JevNoulAnswer, JevRequestFailed, HttpClient.HttpClient> {
	return Effect.gen(function* () {
		const apiKey = yield* readJevApiKey()
		const baseUrl = yield* Effect.orDie(readJevBaseUrl())
		const model = yield* Effect.orDie(readJevModel())
		const client = yield* HttpClient.HttpClient

		const prepared = HttpClientRequest.post(`${baseUrl}/v1/systemone`).pipe(
			HttpClientRequest.bearerToken(apiKey),
			HttpClientRequest.acceptJson,
		)

		const request = yield* encodeJevNoulBody(prepared, model, instructions, state)

		const response = yield* client.execute(request).pipe(
			Effect.mapError(
				(error) =>
					new JevRequestFailed({
						message: `jev: System One transport/request failure (${error.reason._tag}); no usable HTTP response`,
					}),
			),
		)

		if (response.status < 200 || response.status >= 300) {
			const error = yield* jevHttpFailure(response, state)

			return yield* error
		}

		const result = yield* HttpClientResponse.schemaBodyJson(JevNoulResultSchema)(response).pipe(
			Effect.mapError(
				() =>
					new JevRequestFailed({
						message: `jev: System One HTTP ${String(response.status)} response could not be decoded as the expected noul result`,
						status: response.status,
						requestId: safeJevErrorIdentifier(response.headers['x-typesafe-request-id']),
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
