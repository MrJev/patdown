import assert from 'node:assert/strict'
import test from 'node:test'

import {
	applyClaudeEdit,
	patdownRelativeToolPath,
	proposedClaudeToolFile,
} from './proposed-file.mjs'

test('patdownRelativeToolPath keeps cwd-relative paths and drops excludes', () => {
	assert.equal(patdownRelativeToolPath('/repo', '/repo/src/cli.ts'), 'src/cli.ts')
	assert.equal(patdownRelativeToolPath('/repo', '/repo/node_modules/x.js'), null)
	assert.equal(patdownRelativeToolPath('/repo', '/elsewhere/x.ts'), null)
})

test('applyClaudeEdit replaces one unique occurrence or all when asked', () => {
	assert.equal(applyClaudeEdit('one two one', 'one', '1', false), null)
	assert.equal(applyClaudeEdit('one two', 'one', '1', false), '1 two')
	assert.equal(applyClaudeEdit('one two one', 'one', '1', true), '1 two 1')
	assert.equal(applyClaudeEdit('nope', 'one', '1', false), null)
})

test('proposedClaudeToolFile rebuilds Write and Edit payloads', () => {
	const write = proposedClaudeToolFile(
		'/repo',
		'Write',
		{ file_path: '/repo/src/a.ts', content: 'export {}\n' },
		() => {
			throw new Error('unused')
		},
	)

	assert.deepEqual(write, { relativePath: 'src/a.ts', contents: 'export {}\n' })

	const replaced = proposedClaudeToolFile(
		'/repo',
		'Edit',
		{
			file_path: '/repo/src/a.ts',
			old_string: 'x = 1',
			new_string: 'x = 2',
			replace_all: false,
		},
		() => 'const x = 1\n',
	)

	assert.deepEqual(replaced, { relativePath: 'src/a.ts', contents: 'const x = 2\n' })

	const ambiguous = proposedClaudeToolFile(
		'/repo',
		'Edit',
		{
			file_path: '/repo/src/a.ts',
			old_string: 'x',
			new_string: 'y',
			replace_all: false,
		},
		() => 'x x\n',
	)

	assert.equal(ambiguous, null)
})
