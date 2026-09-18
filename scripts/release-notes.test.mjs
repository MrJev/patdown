import assert from 'node:assert/strict'
import { readdirSync } from 'node:fs'
import test from 'node:test'

import { parsePatdownReleaseNotes, readPatdownReleaseNotes } from './release-notes.mjs'

const example = '---\nversion: 0.2.0\ntag: v0.2.0\nbreaking: true\n---\n\n## Changes\n\nNew CLI.\n'

test('extracts metadata without including frontmatter in the GitHub body', () => {
	assert.deepEqual(parsePatdownReleaseNotes(example, 'v0.2.0'), {
		version: '0.2.0',
		tag: 'v0.2.0',
		breaking: true,
		body: '## Changes\n\nNew CLI.\n',
	})
	assert.equal(parsePatdownReleaseNotes(example.replaceAll('\n', '\r\n'), 'v0.2.0').breaking, true)
})

test('rejects mismatches, invalid frontmatter, empty bodies, and unsafe tags', () => {
	assert.throws(() => parsePatdownReleaseNotes(example, 'v0.1.0'), /mismatch/u)
	assert.throws(
		() => parsePatdownReleaseNotes(example.replace('breaking: true', 'breaking: maybe'), 'v0.2.0'),
		/frontmatter/u,
	)
	assert.throws(
		() => parsePatdownReleaseNotes(example.replace('## Changes\n\nNew CLI.', ''), 'v0.2.0'),
		/empty body/u,
	)
	assert.throws(() => readPatdownReleaseNotes('../README'), /invalid tag/u)
})

test('all checked-in release notes match their filenames', () => {
	for (const filename of readdirSync(new URL('../releases/', import.meta.url))) {
		if (!/^v.*\.md$/u.test(filename)) continue

		assert.ok(readPatdownReleaseNotes(filename.slice(0, -3)).body.length > 0)
	}
})
