import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { SqliteMetadataRepository } from '../apps/local-core/dist/metadata-repository.js'
import { createMvpSampleSnapshot } from '../apps/local-core/dist/mvp-sample-project.js'
import { createLocalCoreServer } from '../apps/local-core/dist/server.js'

const directory = await mkdtemp(join(tmpdir(), 'lcos-lcosproj-browser-smoke-'))
let server
let metadata
try {
  metadata = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'))
  const graph = createMvpSampleSnapshot(join(directory, 'private-project-root'), '2026-08-05T00:00:00.000Z')
  metadata.save(graph)
  const projectId = String(graph.project.id)
  const token = 'lcosproj-browser-smoke-token'
  const origin = 'http://127.0.0.1:43120'
  server = createLocalCoreServer({
    port: 0,
    metadataRepository: metadata,
    apiToken: token,
    allowedOrigins: [origin],
  })
  const address = await server.start()
  const baseUrl = `http://${address.host}:${address.port}`
  const authHeaders = { authorization: `Bearer ${token}`, origin }

  const unauthenticated = await fetch(`${baseUrl}/projects/${encodeURIComponent(projectId)}/export-lcosproj-file`)
  assert.equal(unauthenticated.status, 401, 'Browser export must require the Local Core token.')

  const exported = await fetch(`${baseUrl}/projects/${encodeURIComponent(projectId)}/export-lcosproj-file`, {
    headers: { ...authHeaders, accept: 'application/vnd.local-creative-os.project' },
  })
  assert.equal(exported.status, 200)
  assert.match(exported.headers.get('content-type') ?? '', /application\/vnd\.local-creative-os\.project/)
  assert.match(exported.headers.get('content-disposition') ?? '', /\.lcosproj/i)
  const bytes = Buffer.from(await exported.arrayBuffer())
  assert.equal(bytes.subarray(0, 16).toString('utf8'), 'SQLite format 3\u0000')
  const exportedPath = join(directory, 'downloaded.lcosproj')
  await writeFile(exportedPath, bytes)

  const packageDatabase = new DatabaseSync(exportedPath, { readOnly: true })
  try {
    const meta = packageDatabase.prepare('SELECT project_id, schema_version, root_hint FROM lcosproj_meta WHERE id = 1').get()
    assert.equal(String(meta.project_id), projectId)
    assert.equal(Number(meta.schema_version), 18)
    assert.ok(typeof meta.root_hint === 'string' && meta.root_hint.length > 0)
    const sessionCount = Number(packageDatabase.prepare('SELECT COUNT(*) AS count FROM conversation_sessions').get().count)
    const vectorCount = Number(packageDatabase.prepare('SELECT COUNT(*) AS count FROM conversation_embeddings').get().count)
    assert.equal(vectorCount, 0, 'Rebuildable vectors must not be packed by default.')
    assert.ok(sessionCount >= 0)
  } finally {
    packageDatabase.close()
  }

  metadata.save({ ...graph, project: { ...graph.project, name: 'Locally Modified After Export' } })
  assert.equal(metadata.getProject(projectId)?.name, 'Locally Modified After Export')

  const form = new FormData()
  form.set('file', new Blob([bytes], { type: 'application/vnd.local-creative-os.project' }), 'restored.lcosproj')
  const opened = await fetch(`${baseUrl}/lcosproj/open-upload`, {
    method: 'POST',
    headers: authHeaders,
    body: form,
  })
  const openedBody = await opened.json()
  assert.equal(opened.status, 200, JSON.stringify(openedBody))
  assert.equal(openedBody.ok, true)
  assert.equal(openedBody.value.project.id, projectId)
  assert.equal(metadata.getProject(projectId)?.name, graph.project.name, 'Uploaded project package did not restore Project Truth.')
  assert.equal(JSON.stringify(openedBody).includes('lcosproj-open-'), false, 'Temporary upload paths leaked into the browser response.')

  const invalidForm = new FormData()
  invalidForm.set('file', new Blob([bytes]), 'not-a-project.sqlite')
  const invalid = await fetch(`${baseUrl}/lcosproj/open-upload`, {
    method: 'POST',
    headers: authHeaders,
    body: invalidForm,
  })
  assert.equal(invalid.status, 400)

  process.stdout.write(`${JSON.stringify({
    ok: true,
    projectId,
    bytes: bytes.length,
    schemaVersion: 18,
    browserDownload: true,
    browserUploadRestore: true,
    temporaryPathHidden: true,
  }, null, 2)}\n`)
} finally {
  await server?.close().catch(() => undefined)
  metadata?.close()
  await rm(directory, { recursive: true, force: true })
}
