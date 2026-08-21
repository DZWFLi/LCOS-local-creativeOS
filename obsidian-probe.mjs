import { mkdtemp, mkdir, symlink, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ObsidianReadOnlyConnector } from './apps/local-core/dist/connectors/obsidian-connector.js'

const root = await mkdtemp(join(tmpdir(), 'lcos-obs-probe-'))
await mkdir(join(root, '.obsidian'), { recursive: true })
await mkdir(join(root, 'Projects'), { recursive: true })
await writeFile(join(root, '.obsidian', 'workspace.json'), '{}')
await writeFile(join(root, 'Projects', 'Brief.md'), '# Brief\n')
await writeFile(join(root, 'Script.md'), '# Script\n')
await writeFile(join(root, 'ignore.txt'), 'no')
const outside = await mkdtemp(join(tmpdir(), 'lcos-obs-out-'))
await writeFile(join(outside, 'secret.md'), '# secret')
try { await symlink(join(outside, 'secret.md'), join(root, 'linked.md')) } catch (e) { console.log('symlink failed:', e.message) }
const connector = new ObsidianReadOnlyConnector()
const scan = await connector.scan(root)
console.log('noteCount:', scan.noteCount)
console.log('notes:', scan.notes.map(n => n.relativePath))
console.log('warnings:', scan.warnings)
await rm(root, { recursive: true, force: true }).catch(()=>{})
