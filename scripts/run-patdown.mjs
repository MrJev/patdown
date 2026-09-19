#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const cliBin = join(workspaceRoot, 'apps/patdown/dist/patdown-cli-bin.js')

// pnpm may forward a literal `--` before script args (`pnpm -w patdown -- --rules …`).
const rawArgv = process.argv.slice(2)
const argv = rawArgv[0] === '--' ? rawArgv.slice(1) : rawArgv

const build = spawnSync(
	'pnpm',
	['exec', 'turbo', 'run', 'build', '-F', 'patdown', '--output-logs=errors-only'],
	{
		cwd: workspaceRoot,
		env: process.env,
		stdio: 'inherit',
	},
)

if (build.status !== 0) {
	process.exit(build.status ?? 1)
}

const run = spawnSync(process.execPath, [cliBin, ...argv], {
	cwd: process.cwd(),
	env: process.env,
	stdio: 'inherit',
})

process.exit(run.status ?? 1)
