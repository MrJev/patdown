import { readFileSync } from 'node:fs'

import { Option, Schema } from 'effect'

export const StringMapSchema = Schema.Record(Schema.String, Schema.String)

export type StringMap = typeof StringMapSchema.Type

export const ManifestPathValueSchema = Schema.Union([Schema.String, Schema.Array(Schema.String)])

export type ManifestPathValue = typeof ManifestPathValueSchema.Type

export const ManifestConditionObjectSchema = Schema.Record(Schema.String, ManifestPathValueSchema)

export type ManifestConditionObject = typeof ManifestConditionObjectSchema.Type

export const ManifestTargetSchema = Schema.Union([
	ManifestPathValueSchema,
	ManifestConditionObjectSchema,
])

export type ManifestTarget = typeof ManifestTargetSchema.Type

export const BinSchema = Schema.Union([Schema.String, StringMapSchema])

export type Bin = typeof BinSchema.Type

export const PackageManifestSchema = Schema.Struct({
	bin: Schema.optionalKey(BinSchema),
	dependencies: Schema.optionalKey(StringMapSchema),
	devDependencies: Schema.optionalKey(StringMapSchema),
	exports: Schema.optionalKey(Schema.Json),
	files: Schema.optionalKey(Schema.Array(Schema.Json)),
	imports: Schema.optionalKey(Schema.Json),
	main: Schema.optionalKey(Schema.String),
	patdown: Schema.optionalKey(
		Schema.Struct({
			packageKind: Schema.optionalKey(Schema.String),
		}),
	),
	name: Schema.optionalKey(Schema.String),
	peerDependencies: Schema.optionalKey(StringMapSchema),
	private: Schema.optionalKey(Schema.Boolean),
	scripts: Schema.optionalKey(StringMapSchema),
	type: Schema.optionalKey(Schema.String),
	types: Schema.optionalKey(Schema.String),
})

export type PackageManifest = typeof PackageManifestSchema.Type

export const TsconfigCompilerOptionsSchema = Schema.Struct({
	customConditions: Schema.optionalKey(Schema.Array(Schema.String)),
	noEmit: Schema.optionalKey(Schema.Boolean),
	rootDir: Schema.optionalKey(Schema.String),
})

export type TsconfigCompilerOptions = typeof TsconfigCompilerOptionsSchema.Type

export const TsconfigReferenceSchema = Schema.Struct({
	path: Schema.optionalKey(Schema.String),
})

export const TsconfigFileSchema = Schema.Struct({
	compilerOptions: Schema.optionalKey(TsconfigCompilerOptionsSchema),
	extends: Schema.optionalKey(Schema.String),
	files: Schema.optionalKey(Schema.Json),
	include: Schema.optionalKey(Schema.Json),
	references: Schema.optionalKey(Schema.Array(TsconfigReferenceSchema)),
})

export type TsconfigFile = typeof TsconfigFileSchema.Type

export interface AstNode {
	readonly body?: unknown
	readonly callee?: unknown
	readonly declarations?: unknown
	readonly expression?: unknown
	readonly id?: unknown
	readonly init?: unknown
	readonly key?: unknown
	readonly name?: unknown
	readonly params?: unknown
	readonly property?: unknown
	readonly type: string
	readonly typeAnnotation?: unknown
	readonly typeArguments?: unknown
	readonly typeName?: unknown
	readonly typeParameters?: unknown
	readonly value?: unknown
}

export function decodedOption<A>(decoded: Option.Option<A>): A | undefined {
	return Option.isSome(decoded) ? decoded.value : undefined
}

export function decodeJsonValue<A, I>(
	schema: Schema.Codec<A, I>,
	input: Schema.Json,
): A | undefined {
	return decodedOption(Schema.decodeUnknownOption(schema)(input))
}

export function decodeJsonText<A, I>(schema: Schema.Codec<A, I>, text: string): A | undefined {
	try {
		const json = Schema.decodeUnknownSync(Schema.Json)(JSON.parse(text))

		return decodeJsonValue(schema, json)
	} catch {
		return undefined
	}
}

export function isJsonObjectValue(input: Schema.Json): input is Schema.JsonObject {
	if (Schema.is(Schema.Null)(input)) return false

	if (Schema.is(Schema.String)(input)) return false

	if (Schema.is(Schema.Number)(input)) return false

	if (Schema.is(Schema.Boolean)(input)) return false

	return !Schema.is(Schema.Array(Schema.Json))(input)
}

export function jsonObjectEntries(
	input: Schema.Json,
): ReadonlyArray<readonly [string, Schema.Json]> {
	if (!isJsonObjectValue(input)) return []

	return Object.entries(input)
}

export function jsonValueAt(input: Schema.Json | undefined, key: string): Schema.Json | undefined {
	if (input === undefined || !isJsonObjectValue(input)) return undefined

	return input[key]
}

export function hasJsonKey(input: Schema.Json, key: string): boolean {
	return jsonValueAt(input, key) !== undefined
}

export function decodeString(input: Schema.Json | undefined): string | undefined {
	if (input === undefined) return undefined

	return decodedOption(Schema.decodeUnknownOption(Schema.String)(input))
}

export function decodeBoolean(input: Schema.Json | undefined): boolean | undefined {
	if (input === undefined) return undefined

	return decodedOption(Schema.decodeUnknownOption(Schema.Boolean)(input))
}

export function decodeStringMap(input: Schema.Json | undefined): StringMap | undefined {
	if (input === undefined) return undefined

	return decodedOption(Schema.decodeUnknownOption(StringMapSchema)(input))
}

export function decodePathList(input: Schema.Json | undefined): string[] | null {
	if (input === undefined) return null
	const asString = decodeString(input)

	if (asString !== undefined) return [asString]
	const asArray = decodedOption(Schema.decodeUnknownOption(Schema.Array(Schema.String))(input))

	if (asArray === undefined || asArray.length === 0) return null

	return [...asArray]
}

export function decodeStringList(input: Schema.Json | undefined): string[] | null {
	if (input === undefined) return null
	const asString = decodeString(input)

	if (asString !== undefined) return [asString]
	const asArray = decodedOption(Schema.decodeUnknownOption(Schema.Array(Schema.String))(input))

	if (asArray === undefined) return null

	return [...asArray]
}

export function decodeManifestTarget(input: Schema.Json): ManifestTarget | undefined {
	return decodedOption(Schema.decodeUnknownOption(ManifestTargetSchema)(input))
}

export function decodeManifestConditionObject(
	input: Schema.Json,
): ManifestConditionObject | undefined {
	return decodedOption(Schema.decodeUnknownOption(ManifestConditionObjectSchema)(input))
}

export function decodePackageManifestValue(input: Schema.Json): PackageManifest {
	return decodedOption(Schema.decodeUnknownOption(PackageManifestSchema)(input)) ?? {}
}

export function readPackageManifest(manifestPath: string): PackageManifest {
	return decodeJsonText(PackageManifestSchema, readFileSync(manifestPath, 'utf8')) ?? {}
}

export function decodeTsconfigFileValue(input: Schema.Json): TsconfigFile | undefined {
	return decodedOption(Schema.decodeUnknownOption(TsconfigFileSchema)(input))
}

/** FIRST-DECODER(unknown): TypeScript parseConfigFileTextToJson returns untyped host JSON. */
export function isJsonValue(input: unknown): input is Schema.Json {
	return Option.isSome(Schema.decodeUnknownOption(Schema.Json)(input))
}

export function decodeTsconfigHostValue(input: Schema.Json): TsconfigFile | undefined {
	return decodeTsconfigFileValue(input)
}

/** FIRST-DECODER(unknown, typeof): oxlint host AST nodes are cyclic and are not Schema.Json. */
export function asAstNode(value: unknown): value is AstNode {
	if (typeof value !== 'object' || value === null || !('type' in value)) return false

	return typeof value.type === 'string'
}

export function asAstNodeArray(value: readonly unknown[]): AstNode[] {
	return value.filter(asAstNode)
}
