import { Result, Schema } from 'effect'

/** What to do when a matching rule fires. */
export type PatdownPiMode = 'block' | 'steer' | 'warn'

/** Which Pi lifecycle events to judge. Block always uses tool_call. */
export type PatdownPiWhen = 'before' | 'after' | 'both'

export type PatdownPiPolicy = {
	readonly mode: PatdownPiMode
	readonly when: PatdownPiWhen
}

export const defaultPatdownPiPolicy: PatdownPiPolicy = {
	mode: 'block',
	when: 'before',
}

const patdownPiModes: ReadonlyArray<PatdownPiMode> = ['block', 'steer', 'warn']

const patdownPiWhens: ReadonlyArray<PatdownPiWhen> = ['before', 'after', 'both']

function isPatdownPiMode(value: string): value is PatdownPiMode {
	return patdownPiModes.some((mode) => mode === value)
}

function isPatdownPiWhen(value: string): value is PatdownPiWhen {
	return patdownPiWhens.some((when) => when === value)
}

export function decodePatdownPiMode(value: string): PatdownPiMode | null {
	return isPatdownPiMode(value) ? value : null
}

export function decodePatdownPiWhen(value: string): PatdownPiWhen | null {
	return isPatdownPiWhen(value) ? value : null
}

/** `block` can only stop a tool before it runs. */
export function normalizePatdownPiPolicy(
	mode: PatdownPiMode,
	when: PatdownPiWhen,
): PatdownPiPolicy {
	if (mode === 'block') return { mode, when: 'before' }

	return { mode, when }
}

/** Mode commands also pick a sensible when: block→before, steer/warn→after. */
export function patdownPiPolicyForMode(mode: PatdownPiMode): PatdownPiPolicy {
	if (mode === 'block') return { mode, when: 'before' }

	return { mode, when: 'after' }
}

export function patdownPiPolicyWithWhen(
	policy: PatdownPiPolicy,
	when: PatdownPiWhen,
): PatdownPiPolicy {
	return normalizePatdownPiPolicy(policy.mode, when)
}

/** Block can only stop a tool before it runs. */
export function patdownPiJudgesBefore(policy: PatdownPiPolicy): boolean {
	if (policy.mode === 'block') return true

	return policy.when === 'before' || policy.when === 'both'
}

/** After the file is on disk. Block mode never reaches this. */
export function patdownPiJudgesAfter(policy: PatdownPiPolicy): boolean {
	if (policy.mode === 'block') return false

	return policy.when === 'after' || policy.when === 'both'
}

export function formatPatdownPiPolicy(policy: PatdownPiPolicy): string {
	return `${policy.mode}/${policy.when}`
}

const PatdownPiPackageJsonSchema = Schema.fromJsonString(
	Schema.Struct({
		patdown: Schema.optionalKey(
			Schema.Struct({
				pi: Schema.optionalKey(
					Schema.Struct({
						mode: Schema.optionalKey(Schema.String),
						when: Schema.optionalKey(Schema.String),
					}),
				),
			}),
		),
	}),
)

function omittedOrDecodedMode(value: string | undefined): PatdownPiMode | null | undefined {
	if (value === undefined) return undefined

	return decodePatdownPiMode(value)
}

function omittedOrDecodedWhen(value: string | undefined): PatdownPiWhen | null | undefined {
	if (value === undefined) return undefined

	return decodePatdownPiWhen(value)
}

function policyFromDecodedFields(
	mode: PatdownPiMode | undefined,
	when: PatdownPiWhen | undefined,
): PatdownPiPolicy | null {
	if (mode === undefined && when === undefined) return null

	const resolvedMode = mode ?? defaultPatdownPiPolicy.mode
	const resolvedWhen = when ?? patdownPiPolicyForMode(resolvedMode).when

	return normalizePatdownPiPolicy(resolvedMode, resolvedWhen)
}

/** Decode `package.json` text for `patdown.pi`. Unknown shapes are ignored. */
export function decodePatdownPiPolicyFromPackageJsonText(text: string): PatdownPiPolicy | null {
	const decoded = Schema.decodeResult(PatdownPiPackageJsonSchema)(text)

	if (Result.isFailure(decoded)) return null

	const pi = decoded.success.patdown?.pi

	if (pi === undefined) return null

	const mode = omittedOrDecodedMode(pi.mode)
	const when = omittedOrDecodedWhen(pi.when)

	if (mode === null || when === null) return null

	return policyFromDecodedFields(mode, when)
}
