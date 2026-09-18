import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { decodeString, readPackageManifest, type PackageManifest } from './json-decode.ts'

interface WorkspacePackageInfo {
	hasOxlintConfig: boolean
	hasSourceDirectory: boolean
	manifest: PackageManifest
	oxlintConfigText: string | undefined
	packageDirectory: string
}

function createWorkspacePackageInfo(packageDirectory: string): WorkspacePackageInfo {
	const oxlintConfigPath = path.join(packageDirectory, 'oxlint.config.ts')

	return {
		hasOxlintConfig: existsSync(oxlintConfigPath),
		hasSourceDirectory: existsSync(path.join(packageDirectory, 'src')),
		manifest: readPackageManifest(path.join(packageDirectory, 'package.json')),
		oxlintConfigText: existsSync(oxlintConfigPath)
			? readFileSync(oxlintConfigPath, 'utf8')
			: undefined,
		packageDirectory,
	}
}

function isConfigPackage(manifest: PackageManifest): boolean {
	return manifest.squint?.packageKind === 'config-package'
}

function hasScript(manifest: PackageManifest, scriptName: string): boolean {
	return decodeString(manifest.scripts?.[scriptName]) !== undefined
}

function usesSharedBaseConfig(oxlintConfigText: string | undefined): boolean {
	if (oxlintConfigText === undefined) {
		return false
	}

	return /\bbaseConfig\b/u.test(oxlintConfigText) && /\.\.\.baseConfig/u.test(oxlintConfigText)
}

function createStandardPackageDiagnostics(
	pkg: WorkspacePackageInfo,
	packageName: string,
): string[] {
	const diagnostics = []

	if (!pkg.hasOxlintConfig) {
		diagnostics.push(
			`${JSON.stringify(packageName)} must define oxlint.config.ts and use the shared @squint/oxlint-config baseConfig.`,
		)

		return diagnostics
	}

	if (!usesSharedBaseConfig(pkg.oxlintConfigText)) {
		diagnostics.push(
			`${JSON.stringify(packageName)} oxlint.config.ts must spread shared ${JSON.stringify('baseConfig')} from @squint/oxlint-config.`,
		)
	}

	if (!hasScript(pkg.manifest, 'lint')) {
		diagnostics.push(
			`${JSON.stringify(packageName)} must define a ${JSON.stringify('lint')} script so workspace verification always includes linting.`,
		)
	}

	if (!hasScript(pkg.manifest, 'typecheck')) {
		diagnostics.push(
			`${JSON.stringify(packageName)} must define a ${JSON.stringify('typecheck')} script so workspace verification always includes TypeScript validation.`,
		)
	}

	return diagnostics
}

function lintWorkspacePackage(pkg: WorkspacePackageInfo): string[] {
	const packageName = pkg.manifest.name ?? pkg.packageDirectory
	const diagnostics = []

	if (!hasScript(pkg.manifest, 'format:check')) {
		diagnostics.push(
			`${JSON.stringify(packageName)} must define a ${JSON.stringify('format:check')} script so workspace verification always includes formatter checks.`,
		)
	}

	if (isConfigPackage(pkg.manifest)) {
		if (pkg.hasSourceDirectory) {
			diagnostics.push(
				`${JSON.stringify(packageName)} is marked as ${JSON.stringify('config-package')} but still has a src/ directory. Config-package exemptions are only for source-free config/tooling packages.`,
			)
		}

		return diagnostics
	}

	return [...diagnostics, ...createStandardPackageDiagnostics(pkg, packageName)]
}

export function lintWorkspaceVerification(packages: WorkspacePackageInfo[]): string[] {
	return packages.flatMap((pkg) => lintWorkspacePackage(pkg))
}

export function collectWorkspacePackages(rootDirectory: string): WorkspacePackageInfo[] {
	const packages = []

	for (const workspaceDirectoryName of ['apps', 'packages']) {
		const workspaceDirectory = path.join(rootDirectory, workspaceDirectoryName)

		const entries = readdirSync(workspaceDirectory, { withFileTypes: true }).toSorted(
			(left, right) => left.name.localeCompare(right.name),
		)

		for (const entry of entries) {
			if (!entry.isDirectory()) {
				continue
			}

			const packageDirectory = path.join(workspaceDirectory, entry.name)
			const manifestPath = path.join(packageDirectory, 'package.json')

			if (!existsSync(manifestPath)) {
				continue
			}

			packages.push(createWorkspacePackageInfo(packageDirectory))
		}
	}

	return packages
}
