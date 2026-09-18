import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Schema } from 'effect'

const PatdownCliPackageJsonSchema = Schema.Struct({
	version: Schema.NonEmptyString,
})

function readPatdownCliPackageVersion(): string {
	const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json')

	try {
		return Schema.decodeUnknownSync(PatdownCliPackageJsonSchema)(
			JSON.parse(readFileSync(packageJsonPath, 'utf8')),
		).version
	} catch {
		throw new Error(`patdown: failed to read CLI version from ${packageJsonPath}`)
	}
}

/** Version printed by `patdown --version`. Comes from apps/patdown/package.json. */
export const patdownCliVersion = readPatdownCliPackageVersion()
