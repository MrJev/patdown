import { Data, Result, Schema } from 'effect'

/** Default cutoff: only probabilities strictly above this count as yes. */
export const defaultPatdownYesThreshold = 0.85

/** Invalid cutoff from a flag, package.json, or rule metadata. */
export class PatdownYesThresholdInvalid extends Data.TaggedError('PatdownYesThresholdInvalid')<{
	readonly message: string
}> {}

const PatdownYesThresholdNumberSchema = Schema.Finite.check(
	Schema.isBetween({ minimum: 0, maximum: 1, exclusiveMaximum: true }),
)

const PatdownYesThresholdTextSchema = Schema.FiniteFromString.pipe(
	Schema.decodeTo(PatdownYesThresholdNumberSchema),
)

/** Finite number in `[0, 1)`. Equality uses the same cutoff as `> threshold`. */
export type PatdownYesThreshold = typeof PatdownYesThresholdNumberSchema.Type

function invalidPatdownYesThreshold(source: string, value: string): PatdownYesThresholdInvalid {
	return new PatdownYesThresholdInvalid({
		message: `patdown: ${source} must be a finite number in [0, 1); received ${value}`,
	})
}

function decodeYesThresholdNumber(
	value: number,
	source: string,
): PatdownYesThreshold | PatdownYesThresholdInvalid {
	const decoded = Schema.decodeResult(PatdownYesThresholdNumberSchema)(value)

	if (Result.isSuccess(decoded)) return decoded.success

	return invalidPatdownYesThreshold(source, String(value))
}

function decodeYesThresholdText(
	value: string,
	source: string,
): PatdownYesThreshold | PatdownYesThresholdInvalid {
	const decoded = Schema.decodeResult(PatdownYesThresholdTextSchema)(value.trim())

	if (Result.isSuccess(decoded)) return decoded.success

	return invalidPatdownYesThreshold(source, JSON.stringify(value))
}

/** Decode a CLI, config, or metadata number. 1 is rejected because nothing can exceed it. */
export function decodePatdownYesThreshold(
	value: number,
	source: string,
): PatdownYesThreshold | PatdownYesThresholdInvalid {
	return decodeYesThresholdNumber(value, source)
}

/** Decode a `yes-threshold:` line. */
export function decodePatdownYesThresholdText(
	value: string,
	source: string,
): PatdownYesThreshold | PatdownYesThresholdInvalid {
	return decodeYesThresholdText(value, source)
}

/** Shared yes policy: yes iff estimated P(yes) is strictly above the cutoff. */
export function patdownJudgmentIsYes(
	yesProbability: number,
	yesThreshold: PatdownYesThreshold = defaultPatdownYesThreshold,
): boolean {
	return yesProbability > yesThreshold
}
