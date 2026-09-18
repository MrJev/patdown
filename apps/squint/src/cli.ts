import { Console, Effect } from 'effect'
import { Argument, Command } from 'effect/unstable/cli'

/**
 * Root Effect CLI command for squint. Prints a hello world greeting from a positional name
 * argument.
 */
export const squintCommand = Command.make(
	'squint',
	{
		name: Argument.string('name').pipe(
			Argument.withDefault('world'),
			Argument.withDescription('Who to greet'),
		),
	},
	({ name }): Effect.Effect<void> => Console.log(`Hello, ${name}!`),
).pipe(Command.withDescription('Say hello'), Command.withShortDescription('Hello world'))
