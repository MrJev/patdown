#!/usr/bin/env node

import { NodeRuntime, NodeServices } from '@effect/platform-node'
import { Effect } from 'effect'
import { Command } from 'effect/unstable/cli'

import { squintCommand } from '#/cli'

squintCommand.pipe(
	Command.run({
		version: '0.0.0',
	}),
	Effect.provide(NodeServices.layer),
	NodeRuntime.runMain,
)
