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

export const patdownPiCommandUsage =
	'usage: /patdown [on|off|status|block|steer|warn|before|after|both]'

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
