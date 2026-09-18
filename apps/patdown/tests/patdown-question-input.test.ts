import { describe, expect, it } from '@effect/vitest'
import { Effect, Option, Stdio, Stream } from 'effect'

import { readPatdownQuestionInput } from '#/patdown-question-input'

const pipedInput = Stdio.layerTest({
	stdin: Stream.make(
		new TextEncoder().encode('first line\n'),
		new TextEncoder().encode('second line\n'),
	),
	stdinIsTerminal: Effect.succeed(false),
})

describe('question input', () => {
	it.effect('reads the entire pipe and preserves newlines', () =>
		Effect.gen(function* () {
			const text = yield* readPatdownQuestionInput(Option.none(), true).pipe(
				Effect.provide(pipedInput),
			)

			expect(text).toBe('first line\nsecond line\n')
		}),
	)

	it.effect('does not read stdin implicitly', () =>
		Effect.gen(function* () {
			const text = yield* readPatdownQuestionInput(Option.some('explicit'), false).pipe(
				Effect.provide(pipedInput),
			)

			expect(text).toBe('explicit')
		}),
	)

	it.effect('rejects both input sources even when explicit text is empty', () =>
		Effect.gen(function* () {
			const error = yield* readPatdownQuestionInput(Option.some(''), true).pipe(
				Effect.provide(pipedInput),
				Effect.flip,
			)

			expect(error.message).toContain('not both')
		}),
	)

	it.effect('rejects terminal input instead of waiting for a pipe', () =>
		Effect.gen(function* () {
			const error = yield* readPatdownQuestionInput(Option.none(), true).pipe(
				Effect.provide(Stdio.layerTest({ stdinIsTerminal: Effect.succeed(true) })),
				Effect.flip,
			)

			expect(error.message).toContain('piped or redirected')
		}),
	)

	it.effect('accepts an empty pipe', () =>
		Effect.gen(function* () {
			const text = yield* readPatdownQuestionInput(Option.none(), true).pipe(
				Effect.provide(
					Stdio.layerTest({ stdin: Stream.empty, stdinIsTerminal: Effect.succeed(false) }),
				),
			)

			expect(text).toBe('')
		}),
	)
})
