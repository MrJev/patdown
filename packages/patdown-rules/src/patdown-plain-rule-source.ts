import { Effect, FileSystem, Layer, Option, Path, Result, Schema } from 'effect'

import type { PatdownGitHubAnnotationLevel } from '#src/patdown-github-annotation'
import { PatdownGitHubAnnotationInvalid } from '#src/patdown-github-annotation'
import type { PatdownRulesDocument } from '#src/patdown-rule'
import { PatdownRulesLoadFailed } from '#src/patdown-rule-errors'
import { PatdownRuleSource } from '#src/patdown-rule-source'
import { PatdownYesThresholdInvalid } from '#src/patdown-yes-threshold'

/**
 * One rule from a plain adapter. Same fields as a loaded rule, without Effect types in the adapter
 * file.
 */
export type PatdownPlainRule = {
	readonly patdownRuleBody: string
	readonly patdownRuleGlobs: ReadonlyArray<string>
	readonly patdownRuleTitle: string
	readonly patdownRuleSourcePath?: string
	readonly patdownRuleYesThreshold?: number
	readonly patdownRuleGitHubAnnotation?: PatdownGitHubAnnotationLevel
}

/** Document a plain adapter returns. `patdownRulesFilePath` is the display label for the source. */
export type PatdownPlainRulesDocument = {
	readonly patdownRules: ReadonlyArray<PatdownPlainRule>
	readonly patdownRulesFilePath: string
}

/**
 * Adapter entry that does not import `effect`. Use this when the app stays on another Effect
 * version. `override` is the raw `--rules` path, or null when the CLI did not pass one.
 */
export type PatdownPlainRuleSource = {
	readonly loadPatdownRules: (
		override: string | null,
	) => PatdownPlainRulesDocument | Promise<PatdownPlainRulesDocument>
}

const PlainRuleSchema = Schema.Struct({
	patdownRuleBody: Schema.String,
	patdownRuleGlobs: Schema.Array(Schema.String),
	patdownRuleGitHubAnnotation: Schema.optionalKey(Schema.Literals(['error', 'warning', 'notice'])),
	patdownRuleSourcePath: Schema.optionalKey(Schema.String),
	patdownRuleTitle: Schema.NonEmptyString,
	patdownRuleYesThreshold: Schema.optionalKey(
		Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1, exclusiveMaximum: true })),
	),
})

const PlainDocumentSchema = Schema.Struct({
	patdownRules: Schema.Array(PlainRuleSchema),
	patdownRulesFilePath: Schema.NonEmptyString,
})

const PlainRuleSourceSchema = Schema.Struct({
	loadPatdownRules: Schema.instanceOf(Function),
})

function invalidPlainAdapter(message: string): PatdownRulesLoadFailed {
	return new PatdownRulesLoadFailed({ message: `patdown: plain adapter ${message}` })
}

function decodePlainDocument(
	document: PatdownPlainRulesDocument,
): PatdownRulesDocument | PatdownRulesLoadFailed {
	const decoded = Schema.decodeResult(PlainDocumentSchema)(document)

	if (Result.isFailure(decoded)) {
		return invalidPlainAdapter(
			`returned a document that failed validation: ${decoded.failure.message}`,
		)
	}

	return decoded.success
}

function loadPlainRules(
	source: PatdownPlainRuleSource,
	override: Option.Option<string>,
): Effect.Effect<PatdownRulesDocument, PatdownRulesLoadFailed> {
	return Effect.tryPromise({
		// The plain adapter may return a document or a Promise. Promise.resolve covers both.
		// oxlint-disable-next-line typescript/promise-function-async
		try: () => Promise.resolve(source.loadPatdownRules(Option.getOrNull(override))),
		catch: (cause) =>
			invalidPlainAdapter(`load failed: ${cause instanceof Error ? cause.message : String(cause)}`),
	}).pipe(
		Effect.flatMap((document) => {
			const decoded = decodePlainDocument(document)

			return decoded instanceof PatdownRulesLoadFailed
				? Effect.fail(decoded)
				: Effect.succeed(decoded)
		}),
	)
}

/**
 * Wraps a plain `{ loadPatdownRules }` export as the Layer adapters already use. Hosts that import
 * `effect` can keep exporting `PatdownRuleSourceLive` directly.
 */
export function patdownPlainRuleSourceLayer(
	source: PatdownPlainRuleSource,
): Layer.Layer<
	PatdownRuleSource,
	PatdownRulesLoadFailed | PatdownYesThresholdInvalid | PatdownGitHubAnnotationInvalid,
	FileSystem.FileSystem | Path.Path
> {
	return Layer.succeed(PatdownRuleSource, {
		loadPatdownRules: (override) => loadPlainRules(source, override),
	})
}

/** True when an adapter module exports the plain loader instead of an Effect Layer. */
export function patdownModuleHasPlainRuleSource(value: unknown): value is PatdownPlainRuleSource {
	const decoded = Schema.decodeUnknownResult(PlainRuleSourceSchema)(value)

	return Result.isSuccess(decoded)
}
