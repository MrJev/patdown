import { copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

copyFileSync(join(repoRoot, 'LICENSE'), join(process.cwd(), 'LICENSE'))
