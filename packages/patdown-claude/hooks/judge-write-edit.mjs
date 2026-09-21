#!/usr/bin/env node

import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
	patdownClaudeJudgeTimeoutMs,
	proposedClaudeToolFile,
	readFileInsideCwd,
} from './proposed-file.mjs'

const require = createRequire(import.meta.url)
const pluginRoot = dirname(fileURLToPath(import.meta.url))

function readStdin() {
	return new Promise((resolve, reject) => {
		const chunks = []

		process.stdin.setEncoding('utf8')
		process.stdin.on('data', (chunk) => {
			chunks.push(chunk)
		})
		process.stdin.on('end', () => {
			resolve(chunks.join(''))
		})
		process.stdin.on('error', reject)
	})
}

function writeDeny(reason) {
	process.stdout.write(
		`${JSON.stringify({
			hookSpecificOutput: {
				hookEventName: 'PreToolUse',
				permissionDecision: 'deny',
				permissionDecisionReason: reason,
			},
		})}\n`,
	)
}

function formatFailure(result) {
	const globs = result.ruleGlobs.length === 0 ? '*' : result.ruleGlobs.join(' ')

	return [
		`# ${result.ruleTitle}`,
		`globs: ${globs}`,
		'',
		result.ruleBody,
		'',
		`P(yes) ${String(result.violationProbability)} exceeds cutoff >${String(result.yesThreshold)}`,
	].join('\n')
}

function formatBlockReason(relativePath, failures) {
	const details = failures.map(formatFailure).join('\n\n')

	return [`patdown blocked write to ${relativePath}`, '', details].join('\n')
}

function resolveFrom(specifier, paths) {
	return require.resolve(specifier, { paths })
}

function isMissingRulesMessage(message) {
	return message.includes('patdown: no ') && message.includes(' found walking up from ')
}

function isMissingModuleMessage(message) {
	return (
		message.includes("Cannot find module 'patdown'") ||
		message.includes('Cannot find module "patdown"') ||
		message.includes("Cannot find package 'patdown'") ||
		message.includes('Cannot find package "patdown"') ||
		message.includes("Cannot find module '@patdown/rules'") ||
		message.includes('Cannot find module "@patdown/rules"')
	)
}

function formatMissingInstall(cwd, cause) {
	const detail = cause instanceof Error ? cause.message : String(cause)

	return [
		`patdown: cannot resolve CLI packages from ${cwd}.`,
		'The Claude plugin cache does not ship `patdown` / `@patdown/rules`; install them in the project being edited:',
		'',
		'  pnpm add -D patdown @patdown/rules',
		'',
		'Needs TYPESAFE_API_KEY for the default judge.',
		`Resolve detail: ${detail}`,
	].join('\n')
}

async function importPatdownModules(cwd) {
	// Resolve from the project cwd first. The plugin cache under ~/.claude never contains
	// patdown itself; join(pluginRoot, '..') only helps monorepo --plugin-dir checkouts.
	const searchPaths = [cwd, join(pluginRoot, '..'), pluginRoot]

	try {
		const patdownEntry = resolveFrom('patdown', searchPaths)
		const rulesEntry = resolveFrom('@patdown/rules', searchPaths)
		const effectEntry = resolveFrom('effect', searchPaths)
		const platformEntry = resolveFrom('@effect/platform-node', searchPaths)

		const [patdown, rules, effect, platformNode] = await Promise.all([
			import(patdownEntry),
			import(rulesEntry),
			import(effectEntry),
			import(platformEntry),
		])

		return { patdown, rules, effect, platformNode }
	} catch (cause) {
		const detail = cause instanceof Error ? cause.message : String(cause)

		if (isMissingModuleMessage(detail)) {
			throw new Error(formatMissingInstall(cwd, cause))
		}

		throw new Error(`patdown: failed to import judge modules from ${cwd}: ${detail}`)
	}
}

function withPatdownClaudeDeadline(promise, timeoutMs) {
	let timeoutId

	const timeoutPromise = new Promise((_, reject) => {
		timeoutId = setTimeout(() => {
			reject(
				new Error(
					`patdown: judge timed out after ${String(timeoutMs)}ms (fail-closed before Claude hook timeout)`,
				),
			)
		}, timeoutMs)
	})

	return Promise.race([promise, timeoutPromise]).finally(() => {
		clearTimeout(timeoutId)
	})
}

async function judgeProposedFile(cwd, proposed) {
	const { patdown, rules, effect, platformNode } = await importPatdownModules(cwd)
	const { Effect, Layer, Option } = effect
	const { NodeServices } = platformNode

	const previousCwd = process.cwd()
	process.chdir(cwd)

	try {
		const program = Effect.gen(function* () {
			const document = yield* patdown.loadConfiguredPatdownRules(Option.none(), Option.none())
			const yesThreshold = yield* patdown.resolvePatdownYesThreshold(Option.none())
			const results = yield* patdown.judgePatdownMatchingRules(
				document,
				proposed.relativePath,
				proposed.contents,
				yesThreshold,
			)

			return results
		}).pipe(
			Effect.provide(
				Layer.mergeAll(
					rules.MarkdownPatdownRuleSourceLive,
					patdown.TypeSafeJudgeLive,
					NodeServices.layer,
				),
			),
		)

		return await withPatdownClaudeDeadline(Effect.runPromise(program), patdownClaudeJudgeTimeoutMs)
	} finally {
		process.chdir(previousCwd)
	}
}

async function main() {
	const raw = await readStdin()
	const event = JSON.parse(raw)
	const toolName = event.tool_name
	const toolInput = event.tool_input ?? {}
	const cwd = typeof event.cwd === 'string' && event.cwd.length > 0 ? event.cwd : process.cwd()

	if (toolName !== 'Write' && toolName !== 'Edit') {
		process.exit(0)
	}

	const proposed = proposedClaudeToolFile(cwd, toolName, toolInput, (relativePath) =>
		readFileInsideCwd(cwd, relativePath),
	)

	if (proposed === null) {
		process.exit(0)
	}

	try {
		const results = await judgeProposedFile(cwd, proposed)
		const failures = results
			.filter((result) => result.violated)
			.toSorted((left, right) => right.violationProbability - left.violationProbability)

		if (failures.length === 0) {
			process.exit(0)
		}

		writeDeny(formatBlockReason(proposed.relativePath, failures))
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : String(cause)

		// Same policy as Pi: no rules file means skip judging, do not block every write.
		if (isMissingRulesMessage(message)) {
			process.exit(0)
		}

		writeDeny(`patdown judge failed (not converted to a pass): ${message}`)
	}
}

await main()
