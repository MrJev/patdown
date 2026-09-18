import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { lintArtifactEntrypoints } from './artifact-entrypoint-lint.ts'
import { readPackageManifest } from './json-decode.ts'
import type { AstNode } from './json-decode.ts'
import { lintPackageManifest } from './manifest-lint.ts'
import { lintPhantomNeverMappedTypes } from './no-phantom-never-mapped-type-lint.ts'
import { lintNoRecordStringUnknown } from './no-record-string-unknown-lint.ts'
import { lintUnconstrainedInputGenerics } from './no-unconstrained-input-generic-lint.ts'
import { lintSourceResolution } from './source-resolution-lint.ts'
import { lintVitestTsconfigSplit, readTsconfigFile } from './tsconfig-split-lint.ts'
import { lintVitestResolution } from './vitest-resolution-lint.ts'
import {
	collectWorkspacePackages,
	lintWorkspaceVerification,
} from './workspace-verification-lint.ts'

interface RuleReportDescriptor {
	message: string
	node: unknown
}

interface RuleContext {
	filename: string
	report: (descriptor: RuleReportDescriptor) => void
}

interface RuleModule {
	meta: {
		docs: {
			description: string
		}
		schema: []
		type: 'problem'
	}
	create: (context: RuleContext) => {
		Program: (node: AstNode) => void
	}
}

interface OxlintJsPlugin {
	meta: {
		name: string
	}
	rules: Record<string, RuleModule>
}

function readOptionalTextFile(filePath: string): string | undefined {
	if (!existsSync(filePath)) {
		return undefined
	}

	return readFileSync(filePath, 'utf8')
}

const manifestContractRule: RuleModule = {
	meta: {
		type: 'problem',
		docs: {
			description: 'Enforce package.json imports-map conventions.',
		},
		schema: [],
	},
	create(context) {
		return {
			Program(node) {
				if (path.basename(context.filename) !== 'oxlint.config.ts') {
					return
				}

				const packageDirectory = path.dirname(context.filename)
				const manifestPath = path.join(packageDirectory, 'package.json')

				if (!existsSync(manifestPath)) {
					return
				}

				const diagnostics = lintPackageManifest({
					hasSourceDirectory: existsSync(path.join(packageDirectory, 'src')),
					manifest: readPackageManifest(manifestPath),
				})

				for (const message of diagnostics) {
					context.report({ node, message })
				}
			},
		}
	},
}

const artifactRule: RuleModule = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Require buildable runtime packages to keep top-level entrypoint fields aligned with built dist artifacts.',
		},
		schema: [],
	},
	create(context) {
		return {
			Program(node) {
				if (path.basename(context.filename) !== 'oxlint.config.ts') {
					return
				}

				const packageDirectory = path.dirname(context.filename)
				const manifestPath = path.join(packageDirectory, 'package.json')

				if (!existsSync(manifestPath)) {
					return
				}

				const diagnostics = lintArtifactEntrypoints({
					hasSourceDirectory: existsSync(path.join(packageDirectory, 'src')),
					manifest: readPackageManifest(manifestPath),
					packageDirectory,
				})

				for (const message of diagnostics) {
					context.report({ node, message })
				}
			},
		}
	},
}

const sourceResolutionRule: RuleModule = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Require validation tsconfigs to resolve package self-imports from source instead of built output.',
		},
		schema: [],
	},
	create(context) {
		return {
			Program(node) {
				if (path.basename(context.filename) !== 'oxlint.config.ts') return

				const packageDirectory = path.dirname(context.filename)
				const manifestPath = path.join(packageDirectory, 'package.json')

				if (!existsSync(manifestPath)) return

				const diagnostics = lintSourceResolution({
					hasSourceDirectory: existsSync(path.join(packageDirectory, 'src')),
					manifest: readPackageManifest(manifestPath),
					packageDirectory,
				})

				for (const message of diagnostics) context.report({ node, message })
			},
		}
	},
}

const vitestSplitRule: RuleModule = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Require separate tsconfig.app.json and tsconfig.vitest.json graphs for Vitest packages.',
		},
		schema: [],
	},
	create(context) {
		return {
			Program(node) {
				if (path.basename(context.filename) !== 'oxlint.config.ts') {
					return
				}

				const packageDirectory = path.dirname(context.filename)
				const manifestPath = path.join(packageDirectory, 'package.json')

				if (!existsSync(manifestPath)) {
					return
				}

				const diagnostics = lintVitestTsconfigSplit({
					hasSourceDirectory: existsSync(path.join(packageDirectory, 'src')),
					hasVitestConfig: existsSync(path.join(packageDirectory, 'vitest.config.ts')),
					manifest: readPackageManifest(manifestPath),
					rootTsconfig: readTsconfigFile(path.join(packageDirectory, 'tsconfig.json')),
					appTsconfig: readTsconfigFile(path.join(packageDirectory, 'tsconfig.app.json')),
					vitestTsconfig: readTsconfigFile(path.join(packageDirectory, 'tsconfig.vitest.json')),
				})

				for (const message of diagnostics) {
					context.report({ node, message })
				}
			},
		}
	},
}

const vitestResolutionRule: RuleModule = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Require Vitest runtime resolution to use package.json test conditions instead of depending on built dist output.',
		},
		schema: [],
	},
	create(context) {
		return {
			Program(node) {
				if (path.basename(context.filename) !== 'oxlint.config.ts') {
					return
				}

				const packageDirectory = path.dirname(context.filename)
				const manifestPath = path.join(packageDirectory, 'package.json')

				if (!existsSync(manifestPath)) {
					return
				}

				const diagnostics = lintVitestResolution({
					hasSourceDirectory: existsSync(path.join(packageDirectory, 'src')),
					hasVitestConfig: existsSync(path.join(packageDirectory, 'vitest.config.ts')),
					manifest: readPackageManifest(manifestPath),
					rootTsconfig: readTsconfigFile(path.join(packageDirectory, 'tsconfig.json')),
					vitestConfigText: readOptionalTextFile(path.join(packageDirectory, 'vitest.config.ts')),
					vitestTsconfig: readTsconfigFile(path.join(packageDirectory, 'tsconfig.vitest.json')),
				})

				for (const message of diagnostics) {
					context.report({ node, message })
				}
			},
		}
	},
}

const workspaceVerificationRule: RuleModule = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Require shared verification coverage and explicit config-package exemptions across the workspace.',
		},
		schema: [],
	},
	create(context) {
		return {
			Program(node) {
				if (path.basename(context.filename) !== 'oxlint.config.ts') {
					return
				}

				const packageDirectory = path.dirname(context.filename)
				const manifestPath = path.join(packageDirectory, 'package.json')

				if (!existsSync(manifestPath)) {
					return
				}

				const manifest = readPackageManifest(manifestPath)

				if (manifest.name !== '@squint/oxlint-config') {
					return
				}

				const workspacePackages = collectWorkspacePackages(path.resolve(packageDirectory, '../..'))
				const diagnostics = lintWorkspaceVerification(workspacePackages)

				for (const message of diagnostics) {
					context.report({ node, message })
				}
			},
		}
	},
}

const noPhantomNeverMappedTypeRule: RuleModule = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Ban phantom mapped types over `never` that exist only to make a type parameter look used.',
		},
		schema: [],
	},
	create(context) {
		return {
			Program(node) {
				for (const diagnostic of lintPhantomNeverMappedTypes(node)) {
					context.report(diagnostic)
				}
			},
		}
	},
}

const noUnconstrainedInputGenericRule: RuleModule = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Ban unconstrained `<Input>(value: Input)` first-decoder evasions; keep honest `unknown` at the edge.',
		},
		schema: [],
	},
	create(context) {
		return {
			Program(node) {
				for (const diagnostic of lintUnconstrainedInputGenerics(node)) {
					context.report(diagnostic)
				}
			},
		}
	},
}

const noRecordStringUnknownRule: RuleModule = {
	meta: {
		type: 'problem',
		docs: {
			description:
				'Discourage anonymous Record<string, unknown> bags; allow named boundary aliases.',
		},
		schema: [],
	},
	create(context) {
		return {
			Program(node) {
				for (const diagnostic of lintNoRecordStringUnknown(node)) {
					context.report(diagnostic)
				}
			},
		}
	},
}

const plugin: OxlintJsPlugin = {
	meta: {
		name: 'squint-contracts',
	},
	rules: {
		'artifact-entrypoint-contract': artifactRule,
		'no-phantom-never-mapped-type': noPhantomNeverMappedTypeRule,
		'no-record-string-unknown': noRecordStringUnknownRule,
		'no-unconstrained-input-generic': noUnconstrainedInputGenericRule,
		'package-imports-contract': manifestContractRule,
		'source-resolution-contract': sourceResolutionRule,
		'vitest-test-resolution-contract': vitestResolutionRule,
		'vitest-tsconfig-split-contract': vitestSplitRule,
		'workspace-package-verification-contract': workspaceVerificationRule,
	},
}

export default plugin
