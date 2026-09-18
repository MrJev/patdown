#!/usr/bin/env node

import { NodeRuntime, NodeServices } from '@effect/platform-node'
import { JevSystemOneLive } from '@squint/jev'
import { MarkdownSquintRuleSourceLive } from '@squint/rules'
import { Effect, Layer } from 'effect'
import { Command } from 'effect/unstable/cli'
import { FetchHttpClient } from 'effect/unstable/http'

import { squintCommand } from '#/cli'
import { SquintOutputLive } from '#/squint-output'

squintCommand.pipe(
	Command.run({
		version: '0.0.0',
	}),
	Effect.provide(
		Layer.mergeAll(
			JevSystemOneLive,
			MarkdownSquintRuleSourceLive,
			SquintOutputLive,
			FetchHttpClient.layer,
			NodeServices.layer,
		),
	),
	NodeRuntime.runMain,
)
