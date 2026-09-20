import assert from 'node:assert/strict'
import test from 'node:test'

import { collectPatdownPackExports, patdownPackNames } from '../scripts/sync-patdown-packs.mjs'

test('exports a pack root and a wildcard for every rule file', () => {
	const exportsMap = collectPatdownPackExports()

	assert.deepEqual(Object.keys(exportsMap).toSorted(), [
		'./anti-slop',
		'./anti-slop/*',
		'./effect',
		'./effect/*',
		'./typescript',
		'./typescript/*',
	])

	for (const packName of patdownPackNames) {
		assert.equal(exportsMap[`./${packName}`], `./${packName}/README.md`)
		assert.equal(exportsMap[`./${packName}/*`], `./${packName}/*`)
	}
})
