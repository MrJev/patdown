import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { NodeServices } from '@effect/platform-node'
import { afterEach, describe, expect, it } from '@effect/vitest'
import {
	MarkdownPatdownRuleSourceLive,
	type PatdownRulesDocument,
	type PatdownRulesLoadFailed,
} from '@patdown/rules'
import { Effect, Layer, Option } from 'effect'

import { loadConfiguredPatdownRules } from '#/patdown-rule-source-adapter'
import { runPatdownCli } from '#/run-patdown-cli'

const fixture = fileURLToPath(
	new URL('./fixtures/fixed-patdown-rule-source-adapter.js', import.meta.url),
)

const directories: string[] = []

const originalCwd = process.cwd()

const adapterHost = Layer.mergeAll(MarkdownPatdownRuleSourceLive, NodeServices.layer)

function adapterProject(): string {
	const directory = mkdtempSync(join(tmpdir(), 'patdown-adapter-'))
	directories.push(directory)

	return directory
}

function loadAdapter(
	specifier?: string,
): Effect.Effect<PatdownRulesDocument, PatdownRulesLoadFailed> {
	return loadConfiguredPatdownRules(Option.fromUndefinedOr(specifier), Option.none()).pipe(
		Effect.provide(adapterHost),
	)
}

afterEach(() => {
	process.chdir(originalCwd)

	for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('rule source adapters', () => {
	it.effect('executes a layer and returns its rules', () =>
		Effect.gen(function* () {
			const document = yield* loadAdapter(fixture)
			expect(document.patdownRules[0]?.patdownRuleTitle).toBe('From adapter')
		}),
	)

	it.effect('discovers a parent config, but explicit adapters override invalid config', () =>
		Effect.gen(function* () {
			const root = adapterProject()
			mkdirSync(join(root, 'nested'))
			writeFileSync(join(root, 'package.json'), JSON.stringify({ patdown: { adapter: fixture } }))
			process.chdir(join(root, 'nested'))
			expect((yield* loadAdapter()).patdownRules).toHaveLength(1)
			writeFileSync(join(root, 'package.json'), '{broken')
			const error = yield* Effect.flip(loadAdapter())
			expect(error.message).toContain('failed to load rules')
			expect((yield* loadAdapter(fixture)).patdownRules).toHaveLength(1)
		}),
	)

	it.effect('resolves consumer-installed packages, including exports', () =>
		Effect.gen(function* () {
			const root = adapterProject()
			const pkg = join(root, 'node_modules', 'consumer-adapter')
			mkdirSync(pkg, { recursive: true })
			writeFileSync(
				join(pkg, 'package.json'),
				JSON.stringify({ type: 'module', exports: { import: './adapter.js' } }),
			)
			writeFileSync(
				join(pkg, 'adapter.js'),
				`export { PatdownRuleSourceLive } from ${JSON.stringify(fixture)}`,
			)
			process.chdir(root)
			expect((yield* loadAdapter('consumer-adapter')).patdownRules).toHaveLength(1)
		}),
	)

	it.effect('loads markdown by default and rejects malformed adapter settings', () =>
		Effect.gen(function* () {
			const root = adapterProject()
			writeFileSync(join(root, 'package.json'), '{}')
			writeFileSync(join(root, 'AGENTS.PATDOWN.md'), '# Default rule\n\nUse this rule.')
			process.chdir(root)
			expect((yield* loadAdapter()).patdownRules[0]?.patdownRuleTitle).toBe('Default rule')
			writeFileSync(join(root, 'package.json'), JSON.stringify({ patdown: { adapter: 42 } }))
			const error = yield* Effect.flip(loadAdapter())
			expect(error.message).toContain('invalid adapter config')
		}),
	)

	it.effect('rejects missing exports and import failures', () =>
		Effect.gen(function* () {
			const root = adapterProject()
			const filename = join(root, 'bad.mjs')
			writeFileSync(filename, 'export const unrelated = true')
			const invalid = yield* Effect.flip(loadAdapter(filename))
			const missing = yield* Effect.flip(loadAdapter(join(root, 'missing.mjs')))
			expect(invalid.message).toContain('failed to load rules')
			expect(missing.message).toContain('failed to load rules')
		}),
	)
})

describe('adapter execution', () => {
	it.effect('preserves the missing-module diagnostic without an Effect wrapper stack', () =>
		Effect.gen(function* () {
			const filename = join(adapterProject(), 'missing.mjs')
			const error = yield* Effect.flip(loadAdapter(filename))

			expect(error.message).toContain('missing.mjs')
			expect(error.message).not.toContain('UnknownError')
			expect(error.message).not.toContain('\n    at ')
		}),
	)

	it.effect('checks service presence and document shape', () =>
		Effect.gen(function* () {
			const root = adapterProject()

			const invalid = fileURLToPath(
				new URL('./fixtures/invalid-patdown-rule-source-adapters.js', import.meta.url),
			)

			for (const name of ['missingService', 'invalidService', 'invalidDocument']) {
				const filename = join(root, `${name}.mjs`)
				writeFileSync(
					filename,
					`export { ${name} as PatdownRuleSourceLive } from ${JSON.stringify(invalid)}`,
				)
				const error = yield* Effect.flip(loadAdapter(filename))
				expect(error.message).toContain('failed to load rules')
			}
		}),
	)

	it.effect(
		'provides filesystem/path to scoped layers, forwards --rules, and closes resources',
		() =>
			Effect.gen(function* () {
				const root = adapterProject()

				const scoped = fileURLToPath(
					new URL('./fixtures/scoped-patdown-rule-source-adapter.js', import.meta.url),
				)

				process.chdir(root)

				const result = yield* loadConfiguredPatdownRules(
					Option.some(scoped),
					Option.some('custom-directory'),
				).pipe(Effect.provide(adapterHost))

				expect(result.patdownRulesFilePath).toBe('custom-directory')
				expect(readFileSync(join(root, 'adapter-closed'), 'utf8')).toBe('closed')
			}),
	)

	it.effect('embedded layers bypass discovery and the returned Effect finishes execution', () =>
		Effect.gen(function* () {
			const root = adapterProject()
			writeFileSync(join(root, 'package.json'), '{broken')
			writeFileSync(join(root, 'AGENTS.PATDOWN.md'), '# Embedded\n\nUse this rule.')
			process.chdir(root)
			const result = yield* runPatdownCli(MarkdownPatdownRuleSourceLive, ['rules'])
			expect(result).toBeUndefined()
		}),
	)

	it.effect('does not load adapters for help or version', () =>
		Effect.gen(function* () {
			const root = adapterProject()
			writeFileSync(join(root, 'package.json'), '{broken')
			process.chdir(root)
			const help = yield* runPatdownCli(undefined, ['--help'])
			const version = yield* runPatdownCli(undefined, ['--version'])
			expect(help).toBeUndefined()
			expect(version).toBeUndefined()
		}),
	)
})
