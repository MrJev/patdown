#!/usr/bin/env node

import { NodeRuntime } from '@effect/platform-node'

import { runPatdownCli } from '#src/run-patdown-cli'

NodeRuntime.runMain(runPatdownCli())
