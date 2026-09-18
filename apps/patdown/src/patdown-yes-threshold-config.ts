import {
	decodePatdownYesThreshold,
	defaultPatdownYesThreshold,
	PatdownYesThresholdInvalid,
	type PatdownYesThreshold,
} from '@patdown/rules'
import { Effect, FileSystem, Option } from 'effect'

import { discoverPatdownYesThresholdConfig } from '#src/patdown-package-config'

/** CLI flag wins, then package.json, then the default 0.85 cutoff. */
export function resolvePatdownYesThreshold(
	flag: Option.Option<number>,
): Effect.Effect<PatdownYesThreshold, PatdownYesThresholdInvalid, FileSystem.FileSystem> {
	if (Option.isSome(flag)) {
		const decoded = decodePatdownYesThreshold(flag.value, '--yes-threshold')

		return decoded instanceof PatdownYesThresholdInvalid
			? Effect.fail(decoded)
			: Effect.succeed(decoded)
	}

	return discoverPatdownYesThresholdConfig().pipe(
		Effect.map((configured) => configured ?? defaultPatdownYesThreshold),
	)
}

/** Decode a markdown or adapter-supplied per-rule cutoff. */
export function decodePatdownRuleYesThreshold(
	value: number,
	ruleTitle: string,
): Effect.Effect<PatdownYesThreshold, PatdownYesThresholdInvalid> {
	const decoded = decodePatdownYesThreshold(
		value,
		`rule ${JSON.stringify(ruleTitle)} yes-threshold`,
	)

	return decoded instanceof PatdownYesThresholdInvalid
		? Effect.fail(decoded)
		: Effect.succeed(decoded)
}
