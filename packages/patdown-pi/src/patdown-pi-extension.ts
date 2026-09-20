import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
	isToolCallEventType,
	type ExtensionAPI,
	type ExtensionContext,
	type ToolCallEvent,
} from '@earendil-works/pi-coding-agent'

import {
	applyExactPatdownEdits,
	patdownRelativeToolPath,
	type PatdownProposedFile,
} from '#src/patdown-pi-proposed-file'
import {
	formatPatdownPiStatus,
	idlePatdownPiSession,
	judgePatdownPiProposedFile,
	loadPatdownPiSession,
	setPatdownPiEnabled,
	type PatdownPiSession,
} from '#src/patdown-pi-session'
import { formatPatdownSteerReason, patdownSteerFailures } from '#src/patdown-pi-steer'

function readExistingPatdownFile(cwd: string, relativePath: string): string | null {
	try {
		return readFileSync(join(cwd, relativePath), 'utf8')
	} catch {
		return null
	}
}

function proposedPatdownWrite(
	cwd: string,
	input: { readonly path: string; readonly content: string },
): PatdownProposedFile | null {
	const relativePath = patdownRelativeToolPath(cwd, input.path)

	if (relativePath === null) return null

	return { relativePath, contents: input.content }
}

function proposedPatdownEdit(
	cwd: string,
	input: {
		readonly path: string
		readonly edits: ReadonlyArray<{ readonly oldText: string; readonly newText: string }>
	},
): PatdownProposedFile | null {
	const relativePath = patdownRelativeToolPath(cwd, input.path)

	if (relativePath === null) return null

	const existing = readExistingPatdownFile(cwd, relativePath)

	if (existing === null) return null

	const contents = applyExactPatdownEdits(existing, input.edits)

	if (contents === null) return null

	return { relativePath, contents }
}

function proposedPatdownToolFile(cwd: string, event: ToolCallEvent): PatdownProposedFile | null {
	if (isToolCallEventType('write', event)) {
		return proposedPatdownWrite(cwd, event.input)
	}

	if (isToolCallEventType('edit', event)) {
		return proposedPatdownEdit(cwd, event.input)
	}

	return null
}

type PatdownPiBlock = {
	readonly block: true
	readonly reason: string
}

function notifyPatdownPiBlock(
	ctx: ExtensionContext,
	relativePath: string,
	failureCount: number,
): void {
	if (!ctx.hasUI) return

	ctx.ui.notify(`patdown blocked ${relativePath}`, 'warning')
	ctx.ui.setStatus('patdown', `patdown: ${String(failureCount)}✗`)
}

async function blockPatdownProposedWrite(
	session: PatdownPiSession,
	proposed: PatdownProposedFile,
	ctx: ExtensionContext,
): Promise<PatdownPiBlock | undefined> {
	try {
		const results = await judgePatdownPiProposedFile(
			session,
			proposed.relativePath,
			proposed.contents,
		)

		const failures = patdownSteerFailures(results)

		if (failures.length === 0) return undefined

		notifyPatdownPiBlock(ctx, proposed.relativePath, failures.length)

		return { block: true, reason: formatPatdownSteerReason(proposed.relativePath, failures) }
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : String(cause)

		return { block: true, reason: `patdown: judge failed: ${message}` }
	}
}

function applyPatdownPiCommand(session: PatdownPiSession, args: string): PatdownPiSession | null {
	const action = args.trim()

	if (action === 'off') return setPatdownPiEnabled(session, false)

	if (action === 'on') return setPatdownPiEnabled(session, true)

	if (action.length === 0 || action === 'status') return session

	return null
}

function notifyPatdownPiStatus(ctx: ExtensionContext, status: string): void {
	if (!ctx.hasUI) return

	ctx.ui.setStatus('patdown', status)
	ctx.ui.notify(status, 'info')
}

/** Pi extension factory. Default export is required by pi package loading. */
export function installPatdownPiExtension(pi: ExtensionAPI): void {
	let session = idlePatdownPiSession()

	pi.on('session_start', async (_event, ctx) => {
		session = await loadPatdownPiSession()

		if (ctx.hasUI) {
			ctx.ui.setStatus('patdown', formatPatdownPiStatus(session))
		}
	})

	pi.on('tool_call', async (event, ctx): Promise<PatdownPiBlock | undefined> => {
		if (!session.enabled || session.document === null) return undefined

		const proposed = proposedPatdownToolFile(ctx.cwd, event)

		if (proposed === null) return undefined

		const blocked = await blockPatdownProposedWrite(session, proposed, ctx)

		return blocked
	})

	pi.registerCommand('patdown', {
		description: 'Show or toggle in-agent patdown write steering',
		handler: async (args, ctx): Promise<void> => {
			await Promise.resolve()

			const next = applyPatdownPiCommand(session, args)

			if (next === null) {
				ctx.ui.notify('usage: /patdown [on|off|status]', 'warning')

				return
			}

			session = next
			notifyPatdownPiStatus(ctx, formatPatdownPiStatus(session))
		},
	})
}

// oxlint-disable-next-line import/no-default-export -- pi packages load a default factory
export default installPatdownPiExtension
