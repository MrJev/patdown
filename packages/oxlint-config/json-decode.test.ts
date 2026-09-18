import assert from 'node:assert/strict'
import test from 'node:test'

import {
	asAstNode,
	asAstNodeArray,
	decodeJsonText,
	decodePackageManifestValue,
	decodePathList,
	isJsonObjectValue,
	jsonObjectEntries,
	jsonValueAt,
	PackageManifestSchema,
} from './json-decode.ts'

void test('JSON null, scalar, array, and object distinction', () => {
	assert.equal(isJsonObjectValue(null), false)
	assert.equal(isJsonObjectValue('exports'), false)
	assert.equal(isJsonObjectValue(12), false)
	assert.equal(isJsonObjectValue(true), false)
	assert.equal(isJsonObjectValue(['./src/index.ts']), false)
	assert.equal(isJsonObjectValue({ default: './dist/index.js' }), true)
	assert.deepEqual(jsonObjectEntries(null), [])
	assert.deepEqual(jsonObjectEntries({ default: './dist/index.js' }), [
		['default', './dist/index.js'],
	])
	assert.equal(jsonValueAt({ default: './dist/index.js' }, 'default'), './dist/index.js')
	assert.equal(jsonValueAt(['./src/index.ts'], 'default'), undefined)
})

void test('empty versus non-empty path lists', () => {
	assert.deepEqual(decodePathList('./src/index.ts'), ['./src/index.ts'])
	assert.deepEqual(decodePathList(['./src/index.ts', './src/cli.ts']), [
		'./src/index.ts',
		'./src/cli.ts',
	])
	assert.equal(decodePathList([]), null)
	const missingPath = decodePathList(jsonValueAt({}, 'paths'))
	assert.equal(missingPath, null)
	assert.equal(decodePathList({ default: './dist/index.js' }), null)
})

void test('manifest defaults and malformed input', () => {
	assert.deepEqual(decodePackageManifestValue({}), {})
	assert.equal(decodeJsonText(PackageManifestSchema, '{'), undefined)
	assert.equal(decodeJsonText(PackageManifestSchema, 'null'), undefined)
	assert.equal(decodeJsonText(PackageManifestSchema, '[]'), undefined)
	assert.equal(decodePackageManifestValue({ name: 12 }).name, undefined)
	assert.equal(decodePackageManifestValue({ name: 'fixture' }).name, 'fixture')
})

void test('AST values with missing or non-string type are rejected', () => {
	assert.equal(asAstNode(null), false)
	assert.equal(asAstNode('Program'), false)
	assert.equal(asAstNode({ name: 'fixture' }), false)
	assert.equal(asAstNode({ type: 12 }), false)
	assert.deepEqual(asAstNodeArray([]), [])
	const missingBody = jsonValueAt({}, 'body')
	assert.deepEqual(Array.isArray(missingBody) ? asAstNodeArray(missingBody) : [], [])
})

void test('valid AST nodes keep extra fields', () => {
	const fixture = { extra: true, name: 'Fixture', type: 'Identifier' }
	assert.equal(asAstNode(fixture), true)
	assert.deepEqual(fixture, { extra: true, name: 'Fixture', type: 'Identifier' })
})

void test('cyclic AST host objects do not throw', () => {
	type CyclicHost = { child?: CyclicHost; type: string }

	const cyclic: CyclicHost = { type: 'Program' }
	cyclic.child = cyclic
	assert.equal(asAstNode(cyclic), true)
	assert.equal(cyclic.type, 'Program')
	assert.equal(asAstNodeArray([cyclic, null, { type: 'Identifier' }]).length, 2)
})
