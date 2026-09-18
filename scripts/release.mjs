#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const patdownCliPackageJsonPath = join(repoRoot, 'apps/patdown/package.json')

function runReleaseCommand(command, args) {
	const result = spawnSync(command, args, {
		cwd: repoRoot,
		stdio: 'inherit',
	})

	if (result.error !== undefined) {
		process.stderr.write(`patdown: release: failed to start ${command}\n`)
		process.exit(1)
	}

	if (result.status !== 0) {
		process.exit(result.status ?? 1)
	}
}

function gitStdout(args) {
	const result = spawnSync('git', args, {
		cwd: repoRoot,
		encoding: 'utf8',
	})

	if (result.error !== undefined) {
		process.stderr.write('patdown: release: failed to start git\n')
		process.exit(1)
	}

	if (result.status !== 0) {
		process.stderr.write(result.stderr)
		process.exit(result.status ?? 1)
	}

	return result.stdout
}

function assertGitWorkingTreeClean() {
	if (gitStdout(['status', '--porcelain']).trim() !== '') {
		process.stderr.write('patdown: release: working tree is dirty\n')
		process.exit(1)
	}
}

function gitRemoteNames() {
	return gitStdout(['remote'])
		.split(/\s+/u)
		.filter((name) => name.length > 0)
}

function bumpPatdownCliSemver(version, bumpKind) {
	const parts = version.split('.')
	const major = Number(parts[0])
	const minor = Number(parts[1])
	const patch = Number(parts[2])

	if (
		parts.length !== 3 ||
		!Number.isInteger(major) ||
		!Number.isInteger(minor) ||
		!Number.isInteger(patch)
	) {
		process.stderr.write('patdown: release: package.json version is not x.y.z\n')
		process.exit(1)
	}

	if (bumpKind === 'major') return `${String(major + 1)}.0.0`
	if (bumpKind === 'minor') return `${String(major)}.${String(minor + 1)}.0`

	return `${String(major)}.${String(minor)}.${String(patch + 1)}`
}

function readPatdownCliPackageVersion() {
	const packageJson = JSON.parse(readFileSync(patdownCliPackageJsonPath, 'utf8'))

	if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
		process.stderr.write('patdown: release: package.json version is not x.y.z\n')
		process.exit(1)
	}

	return packageJson.version
}

function writePatdownCliPackageVersion(nextVersion) {
	const packageJsonText = readFileSync(patdownCliPackageJsonPath, 'utf8')
	const nextPackageJsonText = packageJsonText.replace(
		/("version":\s*")([^"]+)(")/u,
		`$1${nextVersion}$3`,
	)

	if (nextPackageJsonText === packageJsonText) {
		process.stderr.write('patdown: release: failed to write package.json version\n')
		process.exit(1)
	}

	writeFileSync(patdownCliPackageJsonPath, nextPackageJsonText)
}

function pushPatdownReleaseRemotes() {
	const remotes = gitRemoteNames()

	if (!remotes.includes('github')) {
		process.stderr.write('patdown: release: no github remote\n')
		process.exit(1)
	}

	runReleaseCommand('git', ['push', 'github', 'HEAD', '--follow-tags'])

	if (remotes.includes('gitea')) {
		runReleaseCommand('git', ['push', 'gitea', 'HEAD', '--follow-tags'])
	}
}

function ghIsAvailable() {
	const result = spawnSync('gh', ['--version'], {
		cwd: repoRoot,
		stdio: 'ignore',
	})

	return result.status === 0
}

const bumpKind = process.argv[2]

if (bumpKind !== 'patch' && bumpKind !== 'minor' && bumpKind !== 'major') {
	process.stderr.write('patdown: release: usage: pnpm -w release <patch|minor|major>\n')
	process.exit(1)
}

assertGitWorkingTreeClean()
runReleaseCommand('pnpm', ['check'])

const nextVersion = bumpPatdownCliSemver(readPatdownCliPackageVersion(), bumpKind)
const tagName = `v${nextVersion}`

writePatdownCliPackageVersion(nextVersion)
runReleaseCommand('git', ['add', 'apps/patdown/package.json'])
runReleaseCommand('git', ['commit', '-m', tagName])
runReleaseCommand('git', ['tag', '-a', tagName, '-m', tagName])
pushPatdownReleaseRemotes()

if (ghIsAvailable()) {
	runReleaseCommand('gh', ['run', 'watch', '--exit-status'])
}
