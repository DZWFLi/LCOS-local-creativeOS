import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ObsidianConnectorSessionStore, ObsidianReadOnlyConnector } from '../apps/local-core/dist/connectors/obsidian-connector.js'

const root = await mkdtemp(join(tmpdir(), 'lcos-obsidian-smoke-'))
try {
  await mkdir(join(root, '.obsidian'), { recursive: true })
  await mkdir(join(root, 'folder'), { recursive: true })
  await writeFile(join(root, '.obsidian', 'workspace.json'), '{}')
  await writeFile(join(root, 'brief.md'), '---\ntitle: Creative Brief\ntags: [client, launch]\n---\n# Brief\nSee [[folder/script]].\n')
  await writeFile(join(root, 'folder', 'script.md'), '# Script\n#storyboard\n')
  const before = createHash('sha256').update(await readFile(join(root, 'brief.md'))).digest('hex')
  if (process.platform !== 'win32') {
    await symlink(join(root, 'brief.md'), join(root, 'folder', 'linked.md')).catch(() => {})
  }

  const connector = new ObsidianReadOnlyConnector()
  const scan = await connector.scan(root)
  assert.equal(scan.readOnly, true)
  assert.equal(scan.noteCount, 2)
  assert.equal(scan.notes.some((note) => note.relativePath.startsWith('.obsidian/')), false)
  assert.equal(scan.notes.find((note) => note.relativePath === 'brief.md')?.title, 'Creative Brief')
  assert.deepEqual(scan.notes.find((note) => note.relativePath === 'brief.md')?.outlinks, ['folder/script'])

  const sessions = new ObsidianConnectorSessionStore()
  const stored = sessions.create(root, scan)
  assert.ok(stored.scanId.startsWith('obsidian-scan-'))
  const note = await connector.read(root, 'brief.md')
  assert.equal(note.contentHash, before)
  await assert.rejects(() => connector.read(root, '../outside.md'))
  const after = createHash('sha256').update(await readFile(join(root, 'brief.md'))).digest('hex')
  assert.equal(after, before)

  process.stdout.write(`${JSON.stringify({ readOnly: true, notes: scan.noteCount, sessionStored: true, sourceUnchanged: true })}\n`)
} finally {
  await rm(root, { recursive: true, force: true })
}
