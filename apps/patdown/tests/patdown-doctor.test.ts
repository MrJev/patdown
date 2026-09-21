import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { NodeServices } from '@effect/platform-node'
import { afterEach, describe, expect, it } from '@effect/vitest'
import { MarkdownPatdownRuleSourceLive } from '@patdown/rules'
import { Effect, Layer } from 'effect'

import { formatPatdownDoctorReport, runPatdownDoctor } from '#src/patdown-doctor'

const directories: string[] = []

const originalCwd = process.cwd()

// Doctor reads TYPESAFE_API_KEY through Effect Config, so the test sets the process env.
// oxlint-disable-next-line node/no-process-env
const originalKey = process.env['TYPESAFE_API_KEY']

afterEach(() => {
	process.chdir(originalCwd)

	// oxlint-disable-next-line node/no-process-env
	if (originalKey === undefined) delete process.env['TYPESAFE_API_KEY']
	// oxlint-disable-next-line node/no-process-env
	else process.env['TYPESAFE_API_KEY'] = originalKey

	for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('patdown doctor', () => {
	it.effect('reports loaded rules and a missing judge key without calling the judge', () =>
		Effect.gen(function* () {
			const root = mkdtempSync(join(tmpdir(), 'patdown-doctor-'))
			directories.push(root)
			writeFileSync(join(root, 'AGENTS.PATDOWN.md'), '# One rule\n\nUse sentence case.')
			process.chdir(root)
			// oxlint-disable-next-line node/no-process-env
			delete process.env['TYPESAFE_API_KEY']

			const report = yield* runPatdownDoctor('0.10.2')
			const text = formatPatdownDoctorReport(report)

			expect(text).toContain('ok rules: 1 rule from')
			expect(text).toContain('fail TYPESAFE_API_KEY: missing in this process')
			expect(report.failed).toBe(true)
		}).pipe(Effect.provide(Layer.mergeAll(MarkdownPatdownRuleSourceLive, NodeServices.layer))),
	)
})
