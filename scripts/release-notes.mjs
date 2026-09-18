import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Reads the deliberately small release frontmatter schema and returns the GitHub body separately. */
export function parsePatdownReleaseNotes(markdown, tag) {
	if (!/^v\d+\.\d+\.\d+$/u.test(tag)) throw new Error('patdown release notes: invalid tag')

	const match =
		/^---\r?\nversion: (\d+\.\d+\.\d+)\r?\ntag: (v\d+\.\d+\.\d+)\r?\nbreaking: (true|false)\r?\n---\r?\n([\s\S]+)$/u.exec(
			markdown,
		)

	if (match === null)
		throw new Error('patdown release notes: expected version, tag, and breaking frontmatter')
	if (match[2] !== tag || `v${match[1]}` !== tag)
		throw new Error('patdown release notes: tag/version mismatch')

	const body = match[4].trim()

	if (body.length === 0) throw new Error('patdown release notes: empty body')

	return { version: match[1], tag, breaking: match[3] === 'true', body: `${body}\n` }
}

/** Loads release notes from the repository rather than the caller's working directory. */
export function readPatdownReleaseNotes(tag) {
	if (!/^v\d+\.\d+\.\d+$/u.test(tag)) throw new Error('patdown release notes: invalid tag')

	return parsePatdownReleaseNotes(
		readFileSync(new URL(`../releases/${tag}.md`, import.meta.url), 'utf8'),
		tag,
	)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const notes = readPatdownReleaseNotes(process.argv[2] ?? '')

	if (process.argv.includes('--verify-version')) {
		const manifest = JSON.parse(
			readFileSync(new URL('../apps/patdown/package.json', import.meta.url), 'utf8'),
		)

		if (manifest.version !== notes.version)
			throw new Error('patdown release notes: CLI version does not match tag')
	}

	process.stdout.write(notes.body)
}
