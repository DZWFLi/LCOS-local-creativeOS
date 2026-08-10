import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import type { PresentationStateV0, PresentationViewV0 } from '@local-creative-os/contracts'
import type { ProjectId } from '@local-creative-os/domain'

import { SqliteMetadataRepository } from '../src/metadata-repository.js'
import { createMvpSampleSnapshot } from '../src/mvp-sample-project.js'
import { PresentationApplicationService, PresentationConflictError } from '../src/presentation-application-service.js'
import { createLocalCoreServer, type LocalCoreServer } from '../src/server.js'

const roots: string[] = []
const repositories: SqliteMetadataRepository[] = []
const servers: LocalCoreServer[] = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
  for (const repository of repositories.splice(0)) repository.close()
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function freshDb() {
  const dbRoot = mkdtempSync(join(tmpdir(), 'lcos-presentation-db-'))
  const projectRoot = mkdtempSync(join(tmpdir(), 'lcos-presentation-project-'))
  roots.push(dbRoot, projectRoot)
  const repository = new SqliteMetadataRepository(join(dbRoot, 'metadata.sqlite'))
  repositories.push(repository)
  const snapshot = createMvpSampleSnapshot(projectRoot, '2026-08-01T09:00:00.000Z')
  repository.save(snapshot)
  return { repository, snapshot, dbPath: join(dbRoot, 'metadata.sqlite') }
}

const stateFor = (memberViewIds: string[]): PresentationStateV0 => ({
  memberViewIds,
  hiddenViewIds: [],
  positions: Object.fromEntries(memberViewIds.map((id, index) => [id, { x: index * 40, y: 40 }])),
  hierarchy: { parentByViewId: Object.fromEntries(memberViewIds.map((id) => [id, null])), orderByParent: { '': memberViewIds } },
  presentationEdges: [],
  pinnedViewIds: [],
  emphasisByViewId: {},
})

const viewFor = (projectId: string, scopeId: string, memberViewIds: string[], version = 0, updatedBy: PresentationViewV0['updatedBy'] = 'web'): PresentationViewV0 => ({
  schemaVersion: 0,
  id: 'presentation:context:scope-test',
  projectId,
  scopeId,
  capability: 'context',
  renderer: 'strands',
  state: stateFor(memberViewIds),
  version,
  updatedBy,
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-01T09:00:00.000Z',
})

describe('Presentation persistence (Phase B)', () => {
  it('survives repository restart with CAS version intact', () => {
    const { repository, snapshot, dbPath } = freshDb()
    const scopeId = String(snapshot.scopes.find((scope) => scope.kind === 'root')!.id)
    const memberViewId = String(snapshot.artifactViews[0]!.id)
    const view = viewFor(String(snapshot.project.id), scopeId, [memberViewId])
    repository.insertPresentationView(view)

    repositories.splice(repositories.indexOf(repository), 1)
    repository.close()
    const reopened = new SqliteMetadataRepository(dbPath)
    repositories.push(reopened)

    const loaded = reopened.getPresentationView(String(snapshot.project.id), view.id)
    expect(loaded).toMatchObject({ id: view.id, version: 0, capability: 'context', renderer: 'strands' })
    expect(loaded?.state.memberViewIds).toEqual([memberViewId])
  })

  it('CAS rejects stale versions and exposes currentVersion', () => {
    const { repository, snapshot } = freshDb()
    const scopeId = String(snapshot.scopes.find((scope) => scope.kind === 'root')!.id)
    const projectId = String(snapshot.project.id)
    const memberViewId = String(snapshot.artifactViews[0]!.id)
    const view = viewFor(projectId, scopeId, [memberViewId])
    repository.insertPresentationView(view)

    const stale = repository.compareAndSwapPresentationView(viewFor(projectId, scopeId, [memberViewId], 0), 7)
    expect(stale).toEqual({ updated: false, currentVersion: 0 })

    const ok = repository.compareAndSwapPresentationView(viewFor(projectId, scopeId, [memberViewId], 0), 0)
    expect(ok.updated).toBe(true)
    expect(ok.currentVersion).toBe(1)
    expect(repository.getPresentationView(projectId, view.id)?.version).toBe(1)
  })

  it('service rejects non-member hierarchy/edges and CAS conflicts', () => {
    const { repository, snapshot } = freshDb()
    const scopeId = String(snapshot.scopes.find((scope) => scope.kind === 'root')!.id)
    const projectId = String(snapshot.project.id)
    const memberViewId = String(snapshot.artifactViews[0]!.id)
    const service = new PresentationApplicationService(repository, repository)

    const danglingEdge: PresentationStateV0 = {
      ...stateFor([memberViewId]),
      presentationEdges: [{ id: 'edge-x', fromViewId: memberViewId, toViewId: 'view-does-not-exist' }],
    }
    expect(() => service.save(projectId, {
      presentationId: 'presentation:context:scope-test',
      scopeId,
      capability: 'context',
      renderer: 'strands',
      state: danglingEdge,
      expectedVersion: 0,
      updatedBy: 'web',
    })).toThrow(/Presentation edge/)

    const crossProject: PresentationStateV0 = {
      ...stateFor(['view-foreign-project']),
      hierarchy: { parentByViewId: { 'view-foreign-project': null }, orderByParent: { '': ['view-foreign-project'] } },
    }
    expect(() => service.save(projectId, {
      presentationId: 'presentation:context:scope-test',
      scopeId,
      capability: 'context',
      renderer: 'strands',
      state: crossProject,
      expectedVersion: 0,
      updatedBy: 'web',
    })).toThrow(/does not belong to the project/)

    const first = service.save(projectId, {
      presentationId: 'presentation:context:scope-test',
      scopeId,
      capability: 'context',
      renderer: 'strands',
      state: stateFor([memberViewId]),
      expectedVersion: 0,
      updatedBy: 'web',
    })
    expect(first.version).toBe(0)
    service.save(projectId, {
      presentationId: 'presentation:context:scope-test',
      scopeId,
      capability: 'context',
      renderer: 'strands',
      state: stateFor([memberViewId]),
      expectedVersion: 0,
      updatedBy: 'web',
    })
    expect(() => service.save(projectId, {
      presentationId: 'presentation:context:scope-test',
      scopeId,
      capability: 'context',
      renderer: 'strands',
      state: stateFor([memberViewId]),
      expectedVersion: 0,
      updatedBy: 'web',
    })).toThrow(PresentationConflictError)
  })

  it('HTTP roundtrip: PUT persists, GET reads, DELETE removes, graphVersion unchanged', async () => {
    const { repository, snapshot } = freshDb()
    const server = createLocalCoreServer({ port: 0, metadataRepository: repository })
    servers.push(server)
    const address = await server.start()
    const baseUrl = `http://${address.host}:${address.port}`
    const projectId = String(snapshot.project.id)
    const scopeId = String(snapshot.scopes.find((scope) => scope.kind === 'root')!.id)
    const memberViewId = String(snapshot.artifactViews[0]!.id)
    const presentationId = 'presentation:context:scope-test'

    const before = await (await fetch(`${baseUrl}/projects/${projectId}/graph`)).json() as { value: { project: { graphVersion: number } } }
    const contract = viewFor(projectId, scopeId, [memberViewId])
    const created = await fetch(`${baseUrl}/projects/${projectId}/presentations/${presentationId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contract, expectedVersion: 0 }),
    })
    if (created.status !== 200) {
      console.log('PUT DEBUG BODY:', await created.clone().text())
    }
    expect(created.status).toBe(200)
    await expect(created.json()).resolves.toMatchObject({ ok: true, value: { id: presentationId, version: 0 } })

    const after = await (await fetch(`${baseUrl}/projects/${projectId}/graph`)).json() as { value: { project: { graphVersion: number } } }
    expect(after.value.project.graphVersion).toBe(before.value.project.graphVersion)

    const listed = await fetch(`${baseUrl}/projects/${projectId}/presentations`)
    await expect(listed.json()).resolves.toMatchObject({ ok: true, value: [{ id: presentationId }] })

    const stale = await fetch(`${baseUrl}/projects/${projectId}/presentations/${presentationId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contract: { ...contract, version: 0 }, expectedVersion: 9 }),
    })
    expect(stale.status).toBe(409)

    const removed = await fetch(`${baseUrl}/projects/${projectId}/presentations/${presentationId}`, { method: 'DELETE' })
    expect(removed.status).toBe(200)
    const missing = await fetch(`${baseUrl}/projects/${projectId}/presentations/${presentationId}`)
    expect(missing.status).toBe(404)
  })

  it('SSE stream pushes lightweight change notifications after save', async () => {
    const { repository, snapshot } = freshDb()
    const server = createLocalCoreServer({ port: 0, metadataRepository: repository })
    servers.push(server)
    const address = await server.start()
    const baseUrl = `http://${address.host}:${address.port}`
    const projectId = String(snapshot.project.id)
    const scopeId = String(snapshot.scopes.find((scope) => scope.kind === 'root')!.id)
    const memberViewId = String(snapshot.artifactViews[0]!.id)
    const presentationId = 'presentation:context:scope-test'
    const contract = viewFor(projectId, scopeId, [memberViewId])

    await fetch(`${baseUrl}/projects/${projectId}/presentations/${presentationId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contract, expectedVersion: 0 }),
    })

    const controller = new AbortController()
    const response = await fetch(`${baseUrl}/projects/${projectId}/presentations/${presentationId}/stream?afterVersion=0`, { signal: controller.signal })
    expect(response.status).toBe(200)
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let received = ''
    const readUntil = async (needle: string, timeoutMs: number): Promise<boolean> => {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        if (received.includes(needle)) return true
        const { value, done } = await reader.read()
        if (done) break
        received += decoder.decode(value, { stream: true })
      }
      return received.includes(needle)
    }

    expect(await readUntil('event: snapshot', 5000)).toBe(true)

    const updated = await fetch(`${baseUrl}/projects/${projectId}/presentations/${presentationId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contract: { ...contract, updatedBy: 'agent' as const }, expectedVersion: 0 }),
    })
    expect(updated.status).toBe(200)

    expect(await readUntil('event: update', 5000)).toBe(true)
    expect(received).toContain('"updatedBy":"agent"')
    controller.abort()
  })
})
