#!/usr/bin/env node

import { NodeRuntime, NodeServices } from '@effect/platform-node'
import { JevSystemOneLive } from '@patdown/jev'
import { MarkdownPatdownRuleSourceLive } from '@patdown/rules'
import { Effect, Layer } from 'effect'
import { Command } from 'effect/unstable/cli'
import { FetchHttpClient } from 'effect/unstable/http'

import { patdownCommand } from '#/cli'
import { patdownCliVersion } from '#/patdown-cli-version'
import { PatdownOutputLive } from '#/patdown-output'

patdownCommand.pipe(
	Command.run({
		version: patdownCliVersion,
	}),
	Effect.provide(
		Layer.mergeAll(
			JevSystemOneLive,
			MarkdownPatdownRuleSourceLive,
			PatdownOutputLive,
			FetchHttpClient.layer,
			NodeServices.layer,
		),
	),
	NodeRuntime.runMain,
)
