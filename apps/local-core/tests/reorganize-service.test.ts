import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { PresentationStateV0 } from '@local-creative-os/contracts'
import { afterEach, describe, expect, it } from 'vitest'
import { SqliteMetadataRepository } from '../src/metadata-repository.js'
import { PresentationApplicationService } from '../src/presentation-application-service.js'
import { ReorganizeService } from '../src/reorganize-service.js'
import { createTextArtifact } from '../src/text-artifact-service.js'

const cleanup: string[] = []

function state(memberViewIds: string[]): PresentationStateV0 {
  return {
    memberViewIds,
    hiddenViewIds: [],
    positions: {},
    hierarchy: { parentByViewId: {}, orderByParent: {} },
    presentationEdges: [],
    pinnedViewIds: [],
    emphasisByViewId: {},
  }
}

async function disposable() {
  const dir = await mkdtemp(join(tmpdir(), 'lcos-reorganize-'))
  cleanup.push(dir)
  const projectRoot = join(dir, 'root')
  await mkdir(projectRoot, { recursive: true })
  const metadata = new SqliteMetadataRepository(join(dir, 'metadata.sqlite'))
  metadata.createProject({ id: 'reorg-project' as never, name: 'Reorg', rootPath: projectRoot })
  const viewA = await createTextArtifact(metadata, 'reorg-project' as never, { body: 'A', scopeId: 'scope-reorg-project-root' as never })
  const viewB = await createTextArtifact(metadata, 'reorg-project' as never, { body: 'B', scopeId: 'scope-reorg-project-root' as never })
  const viewC = await createTextArtifact(metadata, 'reorg-project' as never, { body: 'C', scopeId: 'scope-reorg-project-root' as never })
  const presentation = new PresentationApplicationService(metadata, metadata)
  const first = presentation.save('reorg-project', {
    presentationId: 'presentation-1',
    scopeId: 'scope-reorg-project-root',
    capability: 'context',
    renderer: 'graph',
    state: state([viewA.viewId, viewB.viewId, viewC.viewId]),
    expectedVersion: 0,
    updatedBy: 'web',
  })
  const service = new ReorganizeService(metadata, presentation)
  return { dir, metadata, presentation, service, first, viewA, viewB, viewC }
}

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true, maxRetries: 3 }).catch(() => { /* ignore */ })))
})

describe('ReorganizeService (Phase D)', () => {
  it('creates a pending proposal and previews non-destructive changes', async () => {
    const { service, viewB } = await disposable()
    const proposal = service.create({
      projectId: 'reorg-project',
      presentationId: 'presentation-1',
      baseVersion: 0,
      removeMemberViewIds: [viewB.viewId],
    })
    expect(proposal.status).toBe('pending')
    const preview = service.preview(proposal.id)
    expect(preview.willRemovePresentationMembers).toEqual([viewB.viewId])
    expect(preview.destructive).toBe(false)
  })

  it('applies member removal and hierarchy patch, then rollback restores', async () => {
    const { service, presentation, viewA, viewB, viewC } = await disposable()
    const proposal = service.create({
      projectId: 'reorg-project',
      presentationId: 'presentation-1',
      baseVersion: 0,
      removeMemberViewIds: [viewB.viewId],
      hierarchyPatch: { parentByViewId: { [viewC.viewId]: viewA.viewId }, orderByParent: { [viewA.viewId]: [viewC.viewId] } },
    })
    service.apply(proposal.id)
    const after = presentation.get('reorg-project', 'presentation-1')
    expect(after?.state.memberViewIds).toEqual([viewA.viewId, viewC.viewId])
    expect(after?.state.hierarchy.parentByViewId[viewC.viewId]).toBe(viewA.viewId)
    expect(service.get(proposal.id)?.status).toBe('applied')

    service.rollback(proposal.id)
    const restored = presentation.get('reorg-project', 'presentation-1')
    expect(restored?.state.memberViewIds).toEqual([viewA.viewId, viewB.viewId, viewC.viewId])
    expect(restored?.state.hierarchy.parentByViewId[viewC.viewId]).toBeUndefined()
  })

  it('requires explicit confirmation before destructive artifact deletes', async () => {
    const { service, metadata } = await disposable()
    metadata.createCaptureStagingItem
    // 造一个 artifact 用于删除验证
    const proposal = service.create({
      projectId: 'reorg-project',
      presentationId: 'presentation-1',
      baseVersion: 0,
      artifactDeleteCandidates: [{ artifactId: 'missing-artifact', reason: 'test' }],
    })
    expect(() => service.apply(proposal.id)).toThrow(/confirmDestructive/)
    expect(service.get(proposal.id)?.status).toBe('pending')
  })

  it('rejects proposal', async () => {
    const { service } = await disposable()
    const proposal = service.create({ projectId: 'reorg-project', presentationId: 'presentation-1', baseVersion: 0 })
    const rejected = service.reject(proposal.id)
    expect(rejected.status).toBe('rejected')
  })

  it('persists proposals across restart', async () => {
    const { dir } = await disposable()
    const path = join(dir, 'metadata.sqlite')
    const first = new SqliteMetadataRepository(path)
    const presentation = new PresentationApplicationService(first, first)
    const service = new ReorganizeService(first, presentation)
    const proposal = service.create({ projectId: 'reorg-project', presentationId: 'presentation-1', baseVersion: 0 })
    first.close()
    const second = new SqliteMetadataRepository(path)
    const reopened = new ReorganizeService(second, new PresentationApplicationService(second, second))
    expect(reopened.get(proposal.id)?.status).toBe('pending')
  })
})
