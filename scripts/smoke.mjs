import { access, readFile, readdir } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'dist')
const required = [
  resolve(dist, 'index.html'),
  resolve(root, 'apps/web/src/App.tsx'),
  resolve(root, 'apps/web/src/features/workspace/WorkspaceDock.tsx'),
]

for (const file of required) await access(file, constants.R_OK)
const html = await readFile(resolve(dist, 'index.html'), 'utf8')
if (!html.includes('id="root"')) throw new Error('dist/index.html does not contain the React root')
const assets = await readdir(resolve(dist, 'assets'))
if (!assets.some((name) => name.endsWith('.js'))) throw new Error('No JavaScript bundle found')
if (!assets.some((name) => name.endsWith('.css'))) throw new Error('No CSS bundle found')
console.log(`Smoke OK: ${assets.length} built assets, React root present.`)
