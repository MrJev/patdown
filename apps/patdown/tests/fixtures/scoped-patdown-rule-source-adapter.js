import { PatdownRuleSource } from '@patdown/rules'
import { Effect, FileSystem, Layer, Option, Path } from 'effect'

export const PatdownRuleSourceLive = Layer.effect(
	PatdownRuleSource,
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem
		const path = yield* Path.Path
		const marker = path.resolve('adapter-closed')

		yield* Effect.acquireRelease(Effect.void, () =>
			fs.writeFileString(marker, 'closed').pipe(Effect.orDie),
		)

		return {
			loadPatdownRules: (override) =>
				Effect.succeed({
					patdownRulesFilePath: Option.getOrElse(override, () => 'scoped-adapter'),
					patdownRules: [],
				}),
		}
	}),
)
