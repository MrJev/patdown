import { describe, expect, it } from '@effect/vitest'
import { ConfigProvider, Effect } from 'effect'
import { HttpClient, HttpClientError, HttpClientResponse } from 'effect/unstable/http'

import type { JevNoulAnswer } from '#src/jev-noul-schema'
import { JevSystemOne, JevSystemOneLive, type JevRequestFailed } from '#src/jev-system-one'

const testConfig = ConfigProvider.fromUnknown({ TYPESAFE_API_KEY: 'test-key-not-a-secret' })

function askWithClient(
	client: HttpClient.HttpClient,
): Effect.Effect<JevNoulAnswer, JevRequestFailed> {
	return Effect.gen(function* () {
		const jev = yield* JevSystemOne

		return yield* jev.askNoul('Question?', 'synthetic input 🐈')
	}).pipe(
		Effect.provide(JevSystemOneLive),
		Effect.provideService(HttpClient.HttpClient, client),
		Effect.provideService(ConfigProvider.ConfigProvider, testConfig),
	)
}

function askWithResponse(
	status: number,
	body: string,
): Effect.Effect<JevNoulAnswer, JevRequestFailed> {
	return askWithClient(
		HttpClient.make((request) =>
			Effect.succeed(
				HttpClientResponse.fromWeb(
					request,
					new Response(body, { status, headers: { 'x-typesafe-request-id': 'req_test123' } }),
				),
			),
		),
	)
}

describe('Jev System One HTTP errors', () => {
	it.effect('reports the observed token limit failure without leaking response prose', () =>
		Effect.gen(function* () {
			const error = yield* askWithResponse(
				400,
				JSON.stringify({ detail: { error_type: 'max_tokens_exceeded', message: 'PRIVATE INPUT' } }),
			).pipe(Effect.flip)

			expect(error.status).toBe(400)
			expect(error.providerErrorCode).toBe('max_tokens_exceeded')
			expect(error.requestId).toBe('req_test123')
			expect(error.message).toContain('model token limit exceeded')
			expect(error.message).toContain('input UTF-8 bytes: 20')
			expect(error.message).toContain('request ID: req_test123')
			expect(error.message).not.toContain('PRIVATE INPUT')
		}),
	)

	for (const [status, expected] of [
		[413, 'HTTP payload too large'],
		[401, 'authentication or access rejected'],
		[403, 'authentication or access rejected'],
		[429, 'rate or quota limit'],
		[502, 'server or upstream failure'],
		[504, 'server or upstream failure'],
		[400, 'request rejected'],
	] as const) {
		it.effect(`preserves HTTP ${String(status)} even when the response is not JSON`, () =>
			Effect.gen(function* () {
				const error = yield* askWithResponse(
					status,
					'<html>PRIVATE INPUT: proxy error</html>',
				).pipe(Effect.flip)

				expect(error.status).toBe(status)
				expect(error.message).toContain(`HTTP ${String(status)}`)
				expect(error.message).toContain(expected)
				expect(error.message).not.toContain('PRIVATE INPUT')
			}),
		)
	}

	it.effect('discards unsafe machine identifiers', () =>
		Effect.gen(function* () {
			const error = yield* askWithResponse(
				400,
				JSON.stringify({ detail: { error_type: 'untrusted\nPRIVATE INPUT' } }),
			).pipe(Effect.flip)

			expect(error.providerErrorCode).toBeUndefined()
			expect(error.message).not.toContain('PRIVATE INPUT')
		}),
	)

	it.effect('distinguishes an invalid success body from an HTTP rejection', () =>
		Effect.gen(function* () {
			const error = yield* askWithResponse(200, 'not json').pipe(Effect.flip)

			expect(error.status).toBe(200)
			expect(error.message).toContain('could not be decoded')
			expect(error.requestId).toBe('req_test123')
		}),
	)

	it.effect('reports transport failure separately without printing credentials or input', () =>
		Effect.gen(function* () {
			const client = HttpClient.make((request) =>
				Effect.fail(
					new HttpClientError.HttpClientError({
						reason: new HttpClientError.TransportError({ request, cause: 'PRIVATE INPUT' }),
					}),
				),
			)

			const error = yield* askWithClient(client).pipe(Effect.flip)

			expect(error.status).toBeUndefined()
			expect(error.message).toContain('transport/request failure (TransportError)')
			expect(error.message).not.toContain('PRIVATE INPUT')
			expect(error.message).not.toContain('test-key-not-a-secret')
		}),
	)

	it.effect('still decodes successful judgments', () =>
		Effect.gen(function* () {
			const answer = yield* askWithResponse(
				200,
				JSON.stringify({
					model: 'jev-1.13.0',
					answers: { noul: { type: 'noul', noul: 0.04 } },
					usage: { input_tokens: 630, output_tokens: 21 },
				}),
			)

			expect(answer.noul).toBe(0.04)
		}),
	)
})
