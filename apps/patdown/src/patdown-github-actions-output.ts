import { Console, Effect, FileSystem, Layer, Ref } from 'effect'

import { readPatdownGitHubStepSummaryPath } from '#src/patdown-github-actions-env'
import {
	formatPatdownGitHubActionsAnnotations,
	formatPatdownGitHubActionsSummary,
} from '#src/patdown-github-actions-summary'
import {
	PatdownOutput,
	patdownHumanOutput,
	type PatdownLintResult,
	type PatdownOutputWriters,
} from '#src/patdown-output'

type PatdownGitHubActionsState = {
	readonly results: ReadonlyArray<PatdownLintResult>
}

/**
 * Human stdout plus GitHub annotations and a step-summary heatmap. Intended when GITHUB_ACTIONS and
 * GITHUB_STEP_SUMMARY are set.
 */
export const PatdownGitHubActionsOutputLive: Layer.Layer<
	PatdownOutput,
	never,
	FileSystem.FileSystem
> = Layer.effect(
	PatdownOutput,
	Effect.gen(function* () {
		const fileSystem = yield* FileSystem.FileSystem
		const state = yield* Ref.make<PatdownGitHubActionsState>({ results: [] })

		const appendSummary = (markdown: string): Effect.Effect<void> =>
			Effect.gen(function* () {
				const summaryPath = yield* readPatdownGitHubStepSummaryPath

				if (summaryPath === null) return

				yield* fileSystem.writeFileString(summaryPath, markdown, { flag: 'a' }).pipe(
					Effect.catch(() =>
						Effect.sync(() => {
							process.stderr.write('patdown: failed to write GitHub step summary\n')
						}),
					),
				)
			})

		const publish = (
			failed: boolean,
			elapsedMs: number | undefined,
			results: ReadonlyArray<PatdownLintResult>,
		): Effect.Effect<void> =>
			Effect.gen(function* () {
				for (const line of formatPatdownGitHubActionsAnnotations(results)) {
					yield* Console.error(line)
				}

				yield* appendSummary(
					formatPatdownGitHubActionsSummary({
						failed,
						elapsedMs: elapsedMs ?? 0,
						results,
					}),
				)
			})

		const writers: PatdownOutputWriters = {
			writeAnswer: patdownHumanOutput.writeAnswer,
			writeRulesDocument: patdownHumanOutput.writeRulesDocument,
			writeNoFilesMatched: patdownHumanOutput.writeNoFilesMatched,
			writeLintResult: (result, verbose) =>
				Effect.gen(function* () {
					yield* patdownHumanOutput.writeLintResult(result, verbose)
					yield* Ref.update(state, (current) => ({
						results: [...current.results, result],
					}))
				}),
			writeLintOk: (elapsedMs) =>
				Effect.gen(function* () {
					const current = yield* Ref.get(state)

					yield* patdownHumanOutput.writeLintOk(elapsedMs)
					yield* publish(false, elapsedMs, current.results)
				}),
			writeLintFailed: (elapsedMs) =>
				Effect.gen(function* () {
					const current = yield* Ref.get(state)

					yield* patdownHumanOutput.writeLintFailed(elapsedMs)
					yield* publish(true, elapsedMs, current.results)
				}),
		}

		return writers
	}),
)
