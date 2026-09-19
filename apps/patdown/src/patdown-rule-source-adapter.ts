import { isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import {
	PatdownRuleSource,
	PatdownRulesLoadFailed,
	type PatdownRulesDocument,
} from '@patdown/rules'
import { Cause, Context, Effect, FileSystem, Layer, Option, Path, Schema } from 'effect'
import { resolve as resolveModule } from 'import-meta-resolve'

import { discoverPatdownPackageConfig } from '#src/patdown-package-config'

const AdapterModuleSchema = Schema.Struct({ PatdownRuleSourceLive: Schema.Unknown })

const RulesDocumentSchema = Schema.Struct({
	patdownRulesFilePath: Schema.String,
	patdownRules: Schema.Array(
		Schema.Struct({
			patdownRuleTitle: Schema.String,
			patdownRuleBody: Schema.String,
			patdownRuleGlobs: Schema.Array(Schema.String),
			patdownRuleYesThreshold: Schema.optionalKey(Schema.Finite),
		}),
	),
})

/**
 * Adapter layers may acquire resources using FileSystem and Path; provide other dependencies
 * internally.
 */
export type PatdownRuleSourceLayer = Layer.Layer<
	PatdownRuleSource,
	PatdownRulesLoadFailed,
	FileSystem.FileSystem | Path.Path
>

function importPatdownAdapter(
	moduleSpecifier: string,
	fromDirectory: string,
): Effect.Effect<
	Layer.Layer<unknown, unknown, FileSystem.FileSystem | Path.Path>,
	PatdownRulesLoadFailed
> {
	return Effect.gen(function* () {
		const imported = yield* Effect.tryPromise({
			// Raw module import is the untyped I/O boundary. The next Effect step decodes it,
			// preserving schema failures in the error channel instead of decoding synchronously here.
			// oxlint-disable-next-line anti-slop/no-unknown-returns
			try: async (): Promise<unknown> => {
				const importUrl =
					moduleSpecifier.startsWith('.') || isAbsolute(moduleSpecifier)
						? pathToFileURL(resolve(fromDirectory, moduleSpecifier)).href
						: resolveModule(
								moduleSpecifier,
								pathToFileURL(join(fromDirectory, 'package.json')).href,
							)

				const exports: unknown = await import(importUrl)

				return exports
			},
			catch: (cause) =>
				new PatdownRulesLoadFailed({
					message: cause instanceof Error ? cause.message : String(cause),
				}),
		})

		const decoded = yield* Schema.decodeUnknownEffect(AdapterModuleSchema)(imported)

		if (!Layer.isLayer(decoded.PatdownRuleSourceLive)) {
			return yield* new PatdownRulesLoadFailed({
				message: 'patdown: adapter must export a PatdownRuleSourceLive Layer',
			})
		}

		// SAFETY: The boundary retains unknown failures/output. Host requirements alone are asserted;
		// missing dependencies are caught at build, and service presence and returned rules are checked.
		// oxlint-disable-next-line typescript/no-unsafe-type-assertion
		return decoded.PatdownRuleSourceLive as Layer.Layer<
			unknown,
			unknown,
			FileSystem.FileSystem | Path.Path
		>
	}).pipe(
		Effect.mapError(
			(cause) =>
				new PatdownRulesLoadFailed({
					message: `patdown: cannot import adapter ${moduleSpecifier}: ${cause instanceof Error ? cause.message : String(cause)}`,
				}),
		),
	)
}

/** Loads configured rules only for lint/rules. Imported adapter resources close after loading. */
export function loadConfiguredPatdownRules(
	adapter: Option.Option<string>,
	rules: Option.Option<string>,
): Effect.Effect<
	PatdownRulesDocument,
	PatdownRulesLoadFailed,
	PatdownRuleSource | FileSystem.FileSystem | Path.Path
> {
	return Effect.scoped(
		Effect.gen(function* () {
			const selected = Option.isSome(adapter)
				? { moduleSpecifier: adapter.value, fromDirectory: process.cwd() }
				: yield* discoverPatdownPackageConfig().pipe(
						Effect.map((config) =>
							config?.adapter === undefined
								? null
								: { moduleSpecifier: config.adapter, fromDirectory: config.fromDirectory },
						),
					)

			if (selected === null) {
				const source = yield* PatdownRuleSource

				return yield* source.loadPatdownRules(rules)
			}

			const layer = yield* importPatdownAdapter(selected.moduleSpecifier, selected.fromDirectory)
			const context = yield* Layer.build(layer)
			const source = Context.getOption(context, PatdownRuleSource)

			if (Option.isNone(source)) {
				return yield* new PatdownRulesLoadFailed({
					message: 'patdown: adapter Layer did not provide PatdownRuleSource',
				})
			}

			const document: unknown = yield* source.value.loadPatdownRules(rules)

			return yield* Schema.decodeUnknownEffect(RulesDocumentSchema)(document)
		}),
	).pipe(
		Effect.catchCause((cause) =>
			Effect.fail(
				new PatdownRulesLoadFailed({
					message: `patdown: failed to load rules: ${Cause.prettyErrors(cause)
						.map((error) => error.message)
						.join('; ')}`,
				}),
			),
		),
	)
}
