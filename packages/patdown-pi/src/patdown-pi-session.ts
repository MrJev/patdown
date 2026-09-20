import { NodeServices } from '@effect/platform-node'
import {
	MarkdownPatdownRuleSourceLive,
	defaultPatdownYesThreshold,
	type PatdownRulesDocument,
	type PatdownYesThreshold,
} from '@patdown/rules'
import { Cause, Effect, Layer, Option } from 'effect'
import {
	judgePatdownMatchingRules,
	loadConfiguredPatdownRules,
	resolvePatdownYesThreshold,
	TypeSafeJudgeLive,
	type PatdownLintResult,
} from 'patdown'

import { discoverPatdownPiPolicy } from '#src/patdown-pi-package-policy'
import {
	defaultPatdownPiPolicy,
	formatPatdownPiPolicy,
	type PatdownPiPolicy,
} from '#src/patdown-pi-policy'

/** Loaded rules for the current Pi session. Missing rules disable judging. */
export type PatdownPiSession = {
	readonly enabled: boolean
	readonly document: PatdownRulesDocument | null
	readonly yesThreshold: PatdownYesThreshold
	readonly loadError: string | null
	readonly policy: PatdownPiPolicy
}

export function idlePatdownPiSession(): PatdownPiSession {
	return {
		enabled: false,
		document: null,
		yesThreshold: defaultPatdownYesThreshold,
		loadError: null,
		policy: defaultPatdownPiPolicy,
	}
}

function patdownPiSessionFromDocument(
	document: PatdownRulesDocument,
	yesThreshold: PatdownYesThreshold,
	policy: PatdownPiPolicy,
): PatdownPiSession {
	return {
		enabled: true,
		document,
		yesThreshold,
		loadError: null,
		policy,
	}
}

function patdownPiSessionFromError(message: string, policy: PatdownPiPolicy): PatdownPiSession {
	return {
		enabled: false,
		document: null,
		yesThreshold: defaultPatdownYesThreshold,
		loadError: message,
		policy,
	}
}

function prettyPatdownPiCause(cause: Cause.Cause<unknown>): string {
	const messages = Cause.prettyErrors(cause)
		.map((error) => error.message)
		.filter((message) => message.length > 0)

	return messages.length === 0 ? 'patdown: failed to load rules' : messages.join('; ')
}

/** Load markdown / adapter rules the same way the CLI does. */
export async function loadPatdownPiSession(cwd: string): Promise<PatdownPiSession> {
	const policy = discoverPatdownPiPolicy(cwd)

	const loaded = Effect.gen(function* () {
		const document = yield* loadConfiguredPatdownRules(Option.none(), Option.none())
		const yesThreshold = yield* resolvePatdownYesThreshold(Option.none())

		return patdownPiSessionFromDocument(document, yesThreshold, policy)
	}).pipe(
		Effect.provide(Layer.mergeAll(MarkdownPatdownRuleSourceLive, NodeServices.layer)),
		Effect.catchCause((cause) =>
			Effect.succeed(patdownPiSessionFromError(prettyPatdownPiCause(cause), policy)),
		),
	)

	const session = await Effect.runPromise(loaded)

	return session
}

/** Judge proposed file contents. Judge failures stay failures; they are not converted to a pass. */
export async function judgePatdownPiProposedFile(
	session: PatdownPiSession,
	relativePath: string,
	contents: string,
): Promise<ReadonlyArray<PatdownLintResult>> {
	if (session.document === null) return []

	const results = await Effect.runPromise(
		judgePatdownMatchingRules(session.document, relativePath, contents, session.yesThreshold).pipe(
			Effect.provide(TypeSafeJudgeLive),
		),
	)

	return results
}

export function setPatdownPiEnabled(session: PatdownPiSession, enabled: boolean): PatdownPiSession {
	if (session.document === null) return session

	return { ...session, enabled }
}

export function setPatdownPiPolicy(
	session: PatdownPiSession,
	policy: PatdownPiPolicy,
): PatdownPiSession {
	return { ...session, policy }
}

/** Footer / notify line for the current session. */
export function formatPatdownPiStatus(session: PatdownPiSession): string {
	const policy = formatPatdownPiPolicy(session.policy)

	if (session.loadError !== null) return `patdown off ${policy} (${session.loadError})`

	if (session.document === null) return `patdown off ${policy} (no rules)`

	const count = session.document.patdownRules.length
	const rulesLabel = count === 1 ? '1 rule' : `${String(count)} rules`
	const path = session.document.patdownRulesFilePath

	if (!session.enabled) return `patdown off ${policy} (${rulesLabel} from ${path})`

	return `patdown on ${policy} (${rulesLabel} from ${path})`
}
