import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from '@effect/vitest'

import { patdownCliVersion } from '#/patdown-cli-version'

describe('patdown CLI version', () => {
	it('matches apps/patdown/package.json', () => {
		const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), '../package.json')
		const packageJson: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf8'))

		expect(packageJson).toMatchObject({ version: patdownCliVersion })
	})
})
