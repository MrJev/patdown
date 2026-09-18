import { NodeServices } from '@effect/platform-node'
import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { TestConsole } from 'effect/testing'
import { CliOutput, Command } from 'effect/unstable/cli'

import { squintCommand } from '#/cli'

const TestLayer = Layer.mergeAll(
	NodeServices.layer,
	TestConsole.layer,
	CliOutput.layer(CliOutput.defaultFormatter({ colors: false })),
)

const runSquint = Command.runWith(squintCommand, { version: '0.0.0' })

const expectLastLogLine = (expected: string): Effect.Effect<void> =>
	Effect.gen(function* () {
		const lines = yield* TestConsole.logLines
		expect(lines.at(-1)).toBe(expected)
	})

describe('squint CLI', () => {
	it.layer(TestLayer)((layeredIt) => {
		layeredIt.effect('greets the world by default', () =>
			Effect.gen(function* () {
				yield* runSquint([])
				yield* expectLastLogLine('Hello, world!')
			}),
		)
	})

	it.layer(TestLayer)((layeredIt) => {
		layeredIt.effect('greets a positional name', () =>
			Effect.gen(function* () {
				yield* runSquint(['Ada'])
				yield* expectLastLogLine('Hello, Ada!')
			}),
		)
	})
})
