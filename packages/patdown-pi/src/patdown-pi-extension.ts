import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
	isEditToolResult,
	isToolCallEventType,
	isWriteToolResult,
	type ExtensionAPI,
	type ExtensionContext,
	type ToolCallEvent,
	type ToolResultEvent,
} from '@earendil-works/pi-coding-agent'
import type { PatdownLintResult } from 'patdown'

import { applyPatdownPiCommand, patdownPiCommandUsage } from '#src/patdown-pi-command'
import { patdownPiJudgesAfter, patdownPiJudgesBefore } from '#src/patdown-pi-policy'
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
	type PatdownPiSession,
} from '#src/patdown-pi-session'
import { formatPatdownSteerReason, patdownSteerFailures } from '#src/patdown-pi-steer'
import { decodePatdownToolResultPath } from '#src/patdown-pi-tool-result'

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

function writtenPatdownToolFile(cwd: string, event: ToolResultEvent): PatdownProposedFile | null {
	if (event.isError) return null

	if (!isWriteToolResult(event) && !isEditToolResult(event)) return null

	const path = decodePatdownToolResultPath(JSON.stringify(event.input))

	if (path === null) return null

	const relativePath = patdownRelativeToolPath(cwd, path)

	if (relativePath === null) return null

	const contents = readExistingPatdownFile(cwd, relativePath)

	if (contents === null) return null

	return { relativePath, contents }
}

type PatdownPiBlock = {
	readonly block: true
	readonly reason: string
}

type PatdownPiJudgmentOutcome =
	| { readonly kind: 'pass' }
	| { readonly kind: 'fail'; readonly failures: ReadonlyArray<PatdownLintResult> }
	| { readonly kind: 'error'; readonly message: string }

function notifyPatdownPiFinding(
	ctx: ExtensionContext,
	relativePath: string,
	failureCount: number,
): void {
	if (!ctx.hasUI) return

	ctx.ui.notify(`patdown flagged ${relativePath}`, 'warning')
	ctx.ui.setStatus('patdown', `patdown: ${String(failureCount)}✗`)
}

async function judgePatdownProposedFile(
	session: PatdownPiSession,
	proposed: PatdownProposedFile,
): Promise<PatdownPiJudgmentOutcome> {
	try {
		const results = await judgePatdownPiProposedFile(
			session,
			proposed.relativePath,
			proposed.contents,
		)

		const failures = patdownSteerFailures(results)

		if (failures.length === 0) return { kind: 'pass' }

		return { kind: 'fail', failures }
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : String(cause)

		return { kind: 'error', message }
	}
}

function headlinePatdownFinding(text: string): string {
	return text.split('\n')[0] ?? text
}

function deliverPatdownFinding(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	text: string,
	mode: 'steer' | 'warn',
): void {
	if (ctx.hasUI) {
		ctx.ui.notify(headlinePatdownFinding(text), 'warning')
	}

	if (mode === 'warn') return

	if (ctx.isIdle()) {
		pi.sendUserMessage(text)

		return
	}

	pi.sendUserMessage(text, { deliverAs: 'followUp' })
}

async function blockPatdownBeforeWrite(
	session: PatdownPiSession,
	proposed: PatdownProposedFile,
	ctx: ExtensionContext,
): Promise<PatdownPiBlock | undefined> {
	const outcome = await judgePatdownProposedFile(session, proposed)

	if (outcome.kind === 'pass') return undefined

	if (outcome.kind === 'error') {
		return { block: true, reason: `patdown: judge failed: ${outcome.message}` }
	}

	notifyPatdownPiFinding(ctx, proposed.relativePath, outcome.failures.length)

	return {
		block: true,
		reason: formatPatdownSteerReason(proposed.relativePath, outcome.failures, 'block'),
	}
}

async function reportPatdownFinding(
	pi: ExtensionAPI,
	session: PatdownPiSession,
	proposed: PatdownProposedFile,
	ctx: ExtensionContext,
): Promise<void> {
	const outcome = await judgePatdownProposedFile(session, proposed)

	if (outcome.kind === 'pass') return

	const mode = session.policy.mode === 'block' ? 'steer' : session.policy.mode

	if (outcome.kind === 'error') {
		deliverPatdownFinding(pi, ctx, `patdown: judge failed: ${outcome.message}`, mode)

		return
	}

	notifyPatdownPiFinding(ctx, proposed.relativePath, outcome.failures.length)
	deliverPatdownFinding(
		pi,
		ctx,
		formatPatdownSteerReason(proposed.relativePath, outcome.failures, session.policy.mode),
		mode,
	)
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
		session = await loadPatdownPiSession(ctx.cwd)

		if (ctx.hasUI) {
			ctx.ui.setStatus('patdown', formatPatdownPiStatus(session))
		}
	})

	pi.on('tool_call', async (event, ctx): Promise<PatdownPiBlock | undefined> => {
		if (!session.enabled || session.document === null) return undefined

		if (!patdownPiJudgesBefore(session.policy)) return undefined

		const proposed = proposedPatdownToolFile(ctx.cwd, event)

		if (proposed === null) return undefined

		if (session.policy.mode === 'block') {
			const blocked = await blockPatdownBeforeWrite(session, proposed, ctx)

			return blocked
		}

		await reportPatdownFinding(pi, session, proposed, ctx)

		return undefined
	})

	pi.on('tool_result', async (event, ctx) => {
		if (!session.enabled || session.document === null) return

		if (!patdownPiJudgesAfter(session.policy)) return

		const written = writtenPatdownToolFile(ctx.cwd, event)

		if (written === null) return

		await reportPatdownFinding(pi, session, written, ctx)
	})

	pi.registerCommand('patdown', {
		description: 'Show or set in-agent patdown write steering (block/steer/warn, before/after)',
		handler: async (args, ctx): Promise<void> => {
			await Promise.resolve()

			const next = applyPatdownPiCommand(session, args)

			if (next === null) {
				ctx.ui.notify(patdownPiCommandUsage, 'warning')

				return
			}

			session = next
			notifyPatdownPiStatus(ctx, formatPatdownPiStatus(session))
		},
	})
}

// oxlint-disable-next-line import/no-default-export -- pi packages load a default factory
export default installPatdownPiExtension
