import {
	decodePatdownGitHubAnnotationLevel,
	defaultPatdownGitHubAnnotationLevel,
	PatdownGitHubAnnotationInvalid,
	type PatdownGitHubAnnotationLevel,
} from '@patdown/rules'
import { Effect, FileSystem, Option } from 'effect'

import { discoverPatdownGitHubAnnotationConfig } from '#src/patdown-package-config'

/** CLI flag wins, then package.json, then error. */
export function resolvePatdownConfiguredGitHubAnnotation(
	flag: Option.Option<string>,
): Effect.Effect<
	PatdownGitHubAnnotationLevel,
	PatdownGitHubAnnotationInvalid,
	FileSystem.FileSystem
> {
	if (Option.isSome(flag)) {
		const decoded = decodePatdownGitHubAnnotationLevel(flag.value, '--github-annotation')

		return decoded instanceof PatdownGitHubAnnotationInvalid
			? Effect.fail(decoded)
			: Effect.succeed(decoded)
	}

	return discoverPatdownGitHubAnnotationConfig().pipe(
		Effect.map((configured) => configured ?? defaultPatdownGitHubAnnotationLevel),
	)
}
