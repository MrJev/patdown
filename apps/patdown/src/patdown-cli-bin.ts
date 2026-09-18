#!/usr/bin/env node

import { NodeRuntime } from '@effect/platform-node'

import { runPatdownCli } from '#/run-patdown-cli'

NodeRuntime.runMain(runPatdownCli())
