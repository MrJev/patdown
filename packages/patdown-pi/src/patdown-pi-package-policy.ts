import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import {
	decodePatdownPiPolicyFromPackageJsonText,
	defaultPatdownPiPolicy,
	type PatdownPiPolicy,
} from '#src/patdown-pi-policy'

function readPatdownPiPackageJsonText(filename: string): string | null {
	if (!existsSync(filename)) return null

	try {
		return readFileSync(filename, 'utf8')
	} catch {
		return null
	}
}

function policyFromPatdownPackageFile(filename: string): PatdownPiPolicy | null {
	const text = readPatdownPiPackageJsonText(filename)

	if (text === null) return null

	return decodePatdownPiPolicyFromPackageJsonText(text)
}

/** Walk up from cwd; nearer `patdown.pi` wins. Missing or invalid config keeps the default. */
export function discoverPatdownPiPolicy(startDirectory: string): PatdownPiPolicy {
	let directory = resolve(startDirectory)

	while (true) {
		const decoded = policyFromPatdownPackageFile(join(directory, 'package.json'))

		if (decoded !== null) return decoded

		const parent = dirname(directory)

		if (parent === directory) return defaultPatdownPiPolicy

		directory = parent
	}
}
