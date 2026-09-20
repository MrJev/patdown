import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDirectory = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(packageDirectory, '..')
const repoRoot = join(packageRoot, '../..')
const packsRoot = join(repoRoot, 'packs')

export const patdownPackNames = ['anti-slop', 'effect', 'typescript']

function isMarkdownFile(fileName) {
	return fileName.toLowerCase().endsWith('.md')
}

function isReadme(fileName) {
	return fileName.toLowerCase() === 'readme.md'
}

function listPackMarkdownFiles(packName) {
	const packDirectory = join(packsRoot, packName)

	if (!existsSync(packDirectory) || !statSync(packDirectory).isDirectory()) {
		throw new Error(`patdown packs: missing ${packDirectory}`)
	}

	return readdirSync(packDirectory)
		.filter((fileName) => isMarkdownFile(fileName))
		.toSorted((left, right) => left.localeCompare(right))
}

function listPackRuleFiles(packName) {
	return listPackMarkdownFiles(packName).filter((fileName) => !isReadme(fileName))
}

export function collectPatdownPackExports() {
	const exportsMap = {}

	for (const packName of patdownPackNames) {
		const files = listPackMarkdownFiles(packName)

		if (!files.some((fileName) => isReadme(fileName))) {
			throw new Error(`patdown packs: ${packName} is missing README.md`)
		}

		if (listPackRuleFiles(packName).length === 0) {
			throw new Error(`patdown packs: ${packName} has no rule markdown files`)
		}

		exportsMap[`./${packName}`] = `./${packName}/README.md`
		exportsMap[`./${packName}/*`] = `./${packName}/*`
	}

	return exportsMap
}

export function syncPatdownPacks() {
	for (const packName of patdownPackNames) {
		const source = join(packsRoot, packName)
		const destination = join(packageRoot, packName)

		rmSync(destination, { recursive: true, force: true })
		mkdirSync(destination, { recursive: true })
		cpSync(source, destination, { recursive: true })
	}

	return collectPatdownPackExports()
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	syncPatdownPacks()
}
