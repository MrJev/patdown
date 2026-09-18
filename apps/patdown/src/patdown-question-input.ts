import { Effect, Option, Stdio, Stream } from 'effect'

import { PatdownJudgeFailed } from '#/patdown-judge'

/** Reads piped UTF-8 input only when requested; explicit text and stdin are mutually exclusive. */
export function readPatdownQuestionInput(
	inputText: Option.Option<string>,
	stdin: boolean,
): Effect.Effect<string, PatdownJudgeFailed, Stdio.Stdio> {
	return Effect.gen(function* () {
		if (stdin && Option.isSome(inputText)) {
			return yield* new PatdownJudgeFailed({
				message: 'patdown: choose either --input-text or --stdin, not both',
			})
		}

		if (!stdin) return Option.getOrElse(inputText, () => '')

		const stdio = yield* Stdio.Stdio

		if (yield* stdio.stdinIsTerminal) {
			return yield* new PatdownJudgeFailed({
				message: 'patdown: --stdin requires piped or redirected input',
			})
		}

		return yield* stdio.stdin.pipe(
			Stream.decodeText(),
			Stream.mkString,
			Effect.mapError(() => new PatdownJudgeFailed({ message: 'patdown: failed to read stdin' })),
		)
	})
}
