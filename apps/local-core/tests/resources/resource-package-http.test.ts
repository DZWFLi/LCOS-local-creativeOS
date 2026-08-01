import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { ProjectId } from '@local-creative-os/domain'

import { SqliteMetadataRepository } from '../../src/metadata-repository.js'
import { createLocalCoreServer, type LocalCoreServer } from '../../src/server.js'

const roots: string[] = []
const repositories: SqliteMetadataRepository[] = []
const servers: LocalCoreServer[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
  for (const repository of repositories.splice(0)) repository.close()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

async function startServer(): Promise<{ readonly baseUrl: string; readonly projectId: string }> {
  const dbRoot = mkdtempSync(join(tmpdir(), 'lcos-pkg-http-db-'))
  const projectRoot = mkdtempSync(join(tmpdir(), 'lcos-pkg-http-project-'))
  roots.push(dbRoot, projectRoot)
  const repository = new SqliteMetadataRepository(join(dbRoot, 'metadata.sqlite'))
  repositories.push(repository)
  repository.createProject({ id: 'project-pkg-http' as ProjectId, name: 'Pkg HTTP', rootPath: projectRoot })
  const server = createLocalCoreServer({ port: 0, metadataRepository: repository })
  servers.push(server)
  const address = await server.start()
  return { baseUrl: `http://${address.host}:${address.port}`, projectId: 'project-pkg-http' }
}

describe('Resource package HTTP routes (U3)', () => {
  it('imports a directory from base64 JSON and lists it', async () => {
    const { baseUrl, projectId } = await startServer()
    const response = await fetch(`${baseUrl}/projects/${projectId}/resources/import-directory`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        importRequestId: 'dir-1',
        rootName: 'skill-a',
        files: [
          { path: 'SKILL.md', content: Buffer.from('# Skill A', 'utf8').toString('base64') },
          { path: 'scripts/run.js', content: Buffer.from('console.log(1)', 'utf8').toString('base64') },
        ],
      }),
    })
    expect(response.status).toBe(201)
    const body = await response.json() as { ok: boolean; value?: { resourceId: string; sourceKind: string } }
    expect(body.value?.sourceKind).toBe('directory_copy')

    const listed = await fetch(`${baseUrl}/projects/${projectId}/resources`)
    const listedBody = await listed.json() as { ok: boolean; value: readonly { resourceId: string; title: string }[] }
    expect(listedBody.value).toContainEqual(expect.objectContaining({ resourceId: body.value!.resourceId, title: 'skill-a' }))
  })

  it('imports a ZIP archive via multipart', async () => {
    const { baseUrl, projectId } = await startServer()
    const zip = Buffer.from('PK\u0005\u0006', 'utf8')
    const form = new FormData()
    form.set('file', new Blob([zip]), 'pkg.zip')
    form.set('importRequestId', 'zip-http-1')
    form.set('scopeId', 'scope-root')
    form.set('position.x', '10')
    form.set('position.y', '20')
    const response = await fetch(`${baseUrl}/projects/${projectId}/resources/import-archive`, {
      method: 'POST',
      body: form,
    })
    expect(response.status).toBe(400)
    const body = await response.json() as { error?: { message: string } }
    expect(body.error?.message).toContain('EOCD')
  })
})
