import assert from 'node:assert/strict'
import test from 'node:test'

import { lintWorkspaceVerification } from './workspace-verification-lint.ts'

type WorkspacePackageFixture = {
	hasOxlintConfig: boolean
	hasSourceDirectory: boolean
	manifest: {
		patdown?: { packageKind: string }
		name: string
		scripts: Record<string, string>
	}
	oxlintConfigText: string | undefined
	packageDirectory: string
}

function createWorkspacePackage(overrides = {}): WorkspacePackageFixture {
	return {
		hasOxlintConfig: true,
		hasSourceDirectory: true,
		manifest: {
			name: '@patdown/example',
			scripts: {
				'format:check': 'oxfmt --check .',
				'lint': 'oxlint .',
				'typecheck': 'tsc -p tsconfig.json',
			},
		},
		oxlintConfigText: `import { baseConfig } from '@patdown/oxlint-config/base'\nexport default defineConfig({ ...baseConfig })\n`,
		packageDirectory: '/repo/packages/example',
		...overrides,
	}
}

void test('accepts standard shared verification packages', () => {
	assert.deepEqual(lintWorkspaceVerification([createWorkspacePackage()]), [])
})

void test('requires format:check for every workspace package', () => {
	const diagnostics = lintWorkspaceVerification([
		createWorkspacePackage({
			manifest: { name: '@patdown/example', scripts: { lint: 'oxlint .' } },
		}),
	])

	assert.equal(diagnostics.length, 2)
	assert.match(diagnostics[0], /must define a "format:check" script/u)
})

void test('requires oxlint config for standard packages', () => {
	const diagnostics = lintWorkspaceVerification([
		createWorkspacePackage({ hasOxlintConfig: false, oxlintConfigText: undefined }),
	])

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /must define oxlint\.config\.ts/u)
})

void test('requires shared baseConfig usage', () => {
	const diagnostics = lintWorkspaceVerification([
		createWorkspacePackage({ oxlintConfigText: `export default defineConfig({})\n` }),
	])

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /must spread shared "baseConfig"/u)
})

void test('requires lint and typecheck scripts for standard packages', () => {
	const diagnostics = lintWorkspaceVerification([
		createWorkspacePackage({
			manifest: {
				name: '@patdown/example',
				scripts: {
					'format:check': 'oxfmt --check .',
				},
			},
		}),
	])

	assert.equal(diagnostics.length, 2)
	assert.match(diagnostics[0], /must define a "lint" script/u)
	assert.match(diagnostics[1], /must define a "typecheck" script/u)
})

void test('config-package exemption allows missing lint and typecheck', () => {
	const diagnostics = lintWorkspaceVerification([
		createWorkspacePackage({
			hasOxlintConfig: false,
			hasSourceDirectory: false,
			manifest: {
				patdown: { packageKind: 'config-package' },
				name: '@patdown/config-package',
				scripts: {
					'format:check': 'oxfmt --check .',
				},
			},
			oxlintConfigText: undefined,
		}),
	])

	assert.deepEqual(diagnostics, [])
})

void test('config-package exemption rejects src directories', () => {
	const diagnostics = lintWorkspaceVerification([
		createWorkspacePackage({
			manifest: {
				patdown: { packageKind: 'config-package' },
				name: '@patdown/config-package',
				scripts: {
					'format:check': 'oxfmt --check .',
				},
			},
		}),
	])

	assert.equal(diagnostics.length, 1)
	assert.match(diagnostics[0], /still has a src\/ directory/u)
})
