import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { Option, Schema } from 'effect'

const workspaceRoot = path.resolve(import.meta.dirname, '../..')

const PackageManifestRawSchema = Schema.fromJsonString(
	Schema.Struct({
		patdown: Schema.optionalKey(
			Schema.Struct({
				packageKind: Schema.optionalKey(Schema.String),
			}),
		),
		scripts: Schema.optionalKey(Schema.Record(Schema.String, Schema.Json)),
	}),
)

const TurboTaskInspectionSchema = Schema.Struct({
	dependsOn: Schema.optionalKey(Schema.Array(Schema.String)),
	outputs: Schema.optionalKey(Schema.Array(Schema.String)),
})

const TurboConfigInspectionSchema = Schema.fromJsonString(
	Schema.Struct({
		tasks: Schema.Struct({
			lint: Schema.optionalKey(TurboTaskInspectionSchema),
			typecheck: Schema.optionalKey(TurboTaskInspectionSchema),
		}),
	}),
)

type PackageScriptsInspection = {
	lint?: string
	packageKind?: string
	typecheck?: string
}

type TurboConfigInspection = typeof TurboConfigInspectionSchema.Type

function decodedOption<A>(decoded: Option.Option<A>): A | undefined {
	return Option.isSome(decoded) ? decoded.value : undefined
}

function parsePackageScriptsInspection(text: string): PackageScriptsInspection | undefined {
	const manifest = decodedOption(Schema.decodeOption(PackageManifestRawSchema)(text))

	if (manifest === undefined || manifest.scripts === undefined) return undefined

	const inspection: PackageScriptsInspection = {}

	const lint = decodedOption(Schema.decodeUnknownOption(Schema.String)(manifest.scripts.lint))

	const typecheck = decodedOption(
		Schema.decodeUnknownOption(Schema.String)(manifest.scripts.typecheck),
	)

	const packageKind = manifest.patdown?.packageKind

	if (lint !== undefined) inspection.lint = lint

	if (typecheck !== undefined) inspection.typecheck = typecheck

	if (packageKind !== undefined) inspection.packageKind = packageKind

	return inspection
}

function readPackageScriptsInspection(filePath: string): PackageScriptsInspection | undefined {
	return parsePackageScriptsInspection(readFileSync(filePath, 'utf8'))
}

function parseTurboConfigInspection(text: string): TurboConfigInspection | undefined {
	return decodedOption(Schema.decodeOption(TurboConfigInspectionSchema)(text))
}

function readTurboConfigInspection(filePath: string): TurboConfigInspection | undefined {
	return parseTurboConfigInspection(readFileSync(filePath, 'utf8'))
}

function readPackageManifests(directoryName: 'apps' | 'packages'): Array<string> {
	const directoryPath = path.join(workspaceRoot, directoryName)

	return readdirSync(directoryPath, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join(directoryPath, entry.name, 'package.json'))
		.filter((manifestPath) => existsSync(manifestPath))
}

const packageManifests = [...readPackageManifests('apps'), ...readPackageManifests('packages')]

function assertSafeTypecheck(manifestPath: string, typecheck: string): void {
	const tscInvocations = typecheck
		.split(/\s*(?:&&|\|\||;)\s*/u)
		.filter((command) => command.startsWith('tsc '))

	if (tscInvocations.length === 0) throw new Error(`Missing tsc invocation in ${manifestPath}`)

	for (const tscInvocation of tscInvocations) {
		if (tscInvocation.endsWith(' --noEmit')) continue

		assert.doesNotMatch(tscInvocation, /^tsc -b(?:\s|$)/u, manifestPath)
		assert.match(
			tscInvocation,
			/^tsc -p(?:\s+\S+)*\s+--incremental\s+--tsBuildInfoFile\s+\S+\.tsbuildinfo$/u,
			manifestPath,
		)
	}
}

function isSourceFreePackage(packageKind: string | undefined): boolean {
	return packageKind === 'config-package' || packageKind === 'content-package'
}

void test('workspace typechecks produce safely reusable build information', () => {
	for (const manifestPath of packageManifests) {
		const inspection = readPackageScriptsInspection(manifestPath)
		const typecheck = inspection?.typecheck

		if (typecheck === undefined) continue

		if (isSourceFreePackage(inspection?.packageKind)) continue

		assertSafeTypecheck(manifestPath, typecheck)
	}
})

void test('source-free packages may typecheck without tsc', () => {
	assert.equal(
		parsePackageScriptsInspection(
			JSON.stringify({
				patdown: { packageKind: 'content-package' },
				scripts: { typecheck: "printf 'no TypeScript\\n'" },
			}),
		)?.packageKind,
		'content-package',
	)
})

void test('lint scripts leave TypeScript validation to the typecheck task', () => {
	for (const manifestPath of packageManifests) {
		const lint = readPackageScriptsInspection(manifestPath)?.lint

		if (lint === undefined) continue
		assert.doesNotMatch(lint, /(?:^|\s)tsc\s/u, manifestPath)
	}
})

void test('Turbo separates package-local validation from package builds', () => {
	const turboConfig = readTurboConfigInspection(path.join(workspaceRoot, 'turbo.json'))
	assert.ok(turboConfig)
	const { lint, typecheck } = turboConfig.tasks
	assert.ok(typecheck)
	assert.deepEqual(typecheck.dependsOn, ['^build'])
	assert.deepEqual(typecheck.outputs, ['*.tsbuildinfo'])
	assert.ok(lint)
	assert.deepEqual(lint.dependsOn, ['^build'])
})

void test('package script inspection preserves valid siblings', () => {
	assert.deepEqual(
		parsePackageScriptsInspection('{"scripts":{"lint":12,"typecheck":"tsc -p tsconfig.json"}}'),
		{ typecheck: 'tsc -p tsconfig.json' },
	)
	assert.equal(parsePackageScriptsInspection('null'), undefined)
	assert.equal(parsePackageScriptsInspection('{'), undefined)
})

void test('Turbo inspection rejects malformed task arrays', () => {
	assert.equal(parseTurboConfigInspection('{"tasks":{"typecheck":{"outputs":[1]}}}'), undefined)
})

void test('project-mode typecheck rejects a stale incremental false pass', () => {
	const fixtureDirectory = mkdtempSync(path.join(os.tmpdir(), 'typecheck-cache-safety-'))

	try {
		const sourcePath = path.join(fixtureDirectory, 'index.ts')
		const tsconfigPath = path.join(fixtureDirectory, 'tsconfig.json')
		writeFileSync(sourcePath, "export const value: string = 'valid'\n")
		writeFileSync(
			tsconfigPath,
			JSON.stringify({
				compilerOptions: { incremental: true, noEmit: true, strict: true },
				files: ['index.ts'],
			}),
		)

		const typecheckArguments = [
			'-p',
			tsconfigPath,
			'--incremental',
			'--tsBuildInfoFile',
			path.join(fixtureDirectory, 'typecheck.tsbuildinfo'),
		]

		const initialResult = spawnSync('tsc', typecheckArguments, { encoding: 'utf8' })
		assert.equal(initialResult.status, 0)
		writeFileSync(sourcePath, 'export const value: string = 1\n')

		const staleTimestamp = new Date(Date.now() - 60_000)
		utimesSync(sourcePath, staleTimestamp, staleTimestamp)

		const incrementalResult = spawnSync('tsc', typecheckArguments, { encoding: 'utf8' })
		assert.notEqual(incrementalResult.status, 0)
		assert.match(`${incrementalResult.stdout}${incrementalResult.stderr}`, /TS2322/)
	} finally {
		rmSync(fixtureDirectory, { force: true, recursive: true })
	}
})
