import {
	decodePatdownPiMode,
	decodePatdownPiWhen,
	patdownPiPolicyForMode,
	patdownPiPolicyWithWhen,
} from '#src/patdown-pi-policy'
import {
	setPatdownPiEnabled,
	setPatdownPiPolicy,
	type PatdownPiSession,
} from '#src/patdown-pi-session'

/** One `/patdown` argument shown in Pi's slash-command autocomplete. */
export type PatdownPiCommandCompletion = {
	readonly value: string
	readonly label: string
	readonly description: string
}

const patdownPiCommandCompletions: ReadonlyArray<PatdownPiCommandCompletion> = [
	{ value: 'status', label: 'status', description: 'Show current mode, when, and rule source' },
	{ value: 'on', label: 'on', description: 'Resume judging writes' },
	{ value: 'off', label: 'off', description: 'Stop judging writes this session' },
	{ value: 'block', label: 'block', description: 'Stop the tool before it hits disk' },
	{
		value: 'steer',
		label: 'steer',
		description: 'Let it write, then follow up so the agent can fix it',
	},
	{ value: 'warn', label: 'warn', description: 'TUI notify only' },
	{ value: 'before', label: 'before', description: 'Judge on tool_call (proposed file)' },
	{ value: 'after', label: 'after', description: 'Judge on tool_result (file that landed)' },
	{ value: 'both', label: 'both', description: 'Judge before and after' },
]

export const patdownPiCommandUsage =
	'usage: /patdown [on|off|status|block|steer|warn|before|after|both]'

/** Completions for `/patdown `. Empty prefix lists every subcommand. */
export function patdownPiCommandArgumentCompletions(
	prefix: string,
): ReadonlyArray<PatdownPiCommandCompletion> | null {
	const needle = prefix.trim()
	const items = patdownPiCommandCompletions.filter((item) => item.value.startsWith(needle))

	return items.length === 0 ? null : items
}

/** Apply a `/patdown` argument. Null means the token was not recognized. */
export function applyPatdownPiCommand(
	session: PatdownPiSession,
	args: string,
): PatdownPiSession | null {
	const action = args.trim()

	if (action === 'off') return setPatdownPiEnabled(session, false)

	if (action === 'on') return setPatdownPiEnabled(session, true)

	if (action.length === 0 || action === 'status') return session

	const mode = decodePatdownPiMode(action)

	if (mode !== null) return setPatdownPiPolicy(session, patdownPiPolicyForMode(mode))

	const when = decodePatdownPiWhen(action)

	if (when !== null)
		return setPatdownPiPolicy(session, patdownPiPolicyWithWhen(session.policy, when))

	return null
}
