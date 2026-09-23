#!/usr/bin/env node

const taskName = process.argv[2] ?? process.env.npm_lifecycle_event ?? 'this task'
const packageName = process.env.npm_package_name ?? 'this package'

if (process.env.TURBO_HASH || process.env.ALLOW_DIRECT_TASK) {
	process.exit(0)
}

const workspaceCommand = `pnpm -w ${taskName} -F ${packageName}`

console.warn('')
console.warn(
	`Direct package task warning: ${packageName}#${taskName} is not running through Turborepo.`,
)
console.warn('Dependency graph ordering, cache behavior, and upstream builds may be skipped.')
console.warn(`Prefer: ${workspaceCommand}`)
console.warn('Use ALLOW_DIRECT_TASK=1 only for intentional local debugging.')
console.warn('')
process.exit(1)
