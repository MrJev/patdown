import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
	applyClaudeEdit,
	patdownRelativeToolPath,
	proposedClaudeToolFile,
	readFileInsideCwd,
	resolvePathInsideCwd,
} from './proposed-file.mjs'

function makeRepo() {
	const root = mkdtempSync(join(tmpdir(), 'patdown-claude-repo-'))
	mkdirSync(join(root, 'src'), { recursive: true })
	mkdirSync(join(root, 'node_modules'), { recursive: true })
	writeFileSync(join(root, 'src/cli.ts'), 'export {}\n')
	writeFileSync(join(root, 'node_modules/x.js'), 'export {}\n')

	return root
}

test('patdownRelativeToolPath keeps cwd-relative paths and drops excludes', () => {
	const root = makeRepo()

	try {
		assert.equal(patdownRelativeToolPath(root, join(root, 'src/cli.ts')), 'src/cli.ts')
		assert.equal(patdownRelativeToolPath(root, join(root, 'node_modules/x.js')), null)
		assert.equal(patdownRelativeToolPath(root, '/elsewhere/x.ts'), null)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test('applyClaudeEdit replaces one unique occurrence or all when asked', () => {
	assert.equal(applyClaudeEdit('one two one', 'one', '1', false), null)
	assert.equal(applyClaudeEdit('one two', 'one', '1', false), '1 two')
	assert.equal(applyClaudeEdit('one two one', 'one', '1', true), '1 two 1')
	assert.equal(applyClaudeEdit('nope', 'one', '1', false), null)
})

test('proposedClaudeToolFile rebuilds Write and Edit payloads', () => {
	const root = makeRepo()

	try {
		const write = proposedClaudeToolFile(
			root,
			'Write',
			{ file_path: join(root, 'src/a.ts'), content: 'export {}\n' },
			() => {
				throw new Error('unused')
			},
		)

		assert.deepEqual(write, { relativePath: 'src/a.ts', contents: 'export {}\n' })

		writeFileSync(join(root, 'src/a.ts'), 'const x = 1\n')

		const replaced = proposedClaudeToolFile(
			root,
			'Edit',
			{
				file_path: join(root, 'src/a.ts'),
				old_string: 'x = 1',
				new_string: 'x = 2',
				replace_all: false,
			},
			(relativePath) => readFileInsideCwd(root, relativePath),
		)

		assert.deepEqual(replaced, { relativePath: 'src/a.ts', contents: 'const x = 2\n' })

		const ambiguous = proposedClaudeToolFile(
			root,
			'Edit',
			{
				file_path: join(root, 'src/a.ts'),
				old_string: 'x',
				new_string: 'y',
				replace_all: false,
			},
			() => 'x x\n',
		)

		assert.equal(ambiguous, null)
	} finally {
		rmSync(root, { recursive: true, force: true })
	}
})

test('resolvePathInsideCwd and readFileInsideCwd reject symlink escapes', () => {
	const root = makeRepo()
	const outside = mkdtempSync(join(tmpdir(), 'patdown-claude-outside-'))

	try {
		writeFileSync(join(outside, 'secret.txt'), 'nope\n')
		symlinkSync(join(outside, 'secret.txt'), join(root, 'src/link.txt'))

		assert.equal(resolvePathInsideCwd(root, join(root, 'src/link.txt')), null)
		assert.equal(patdownRelativeToolPath(root, join(root, 'src/link.txt')), null)
		assert.throws(() => readFileInsideCwd(root, 'src/link.txt'), /escapes workspace/)
	} finally {
		rmSync(root, { recursive: true, force: true })
		rmSync(outside, { recursive: true, force: true })
	}
})
