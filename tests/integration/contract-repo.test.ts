/**
 * Integration Tests — Phase 2.5 full stack contracts → repository → SQLite
 *
 * INT-001: Full CRUD cycle → save → reload
 * INT-002: 409 Stale Version
 * INT-004: Presentation = no semantic version conflict
 * INT-006: Checkpoint survives restart
 * INT-007: Scope parent/container recovery
 */

import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { MetadataForeignKeyConstraintError, SqliteMetadataRepository } from '../../apps/local-core/src/metadata-repository'
import type { ArtifactView } from '../../packages/domain/src'

const now = () => new Date().toISOString()

function fullSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 4, graphVersion: 1,
    project: { id: 'proj', name: 'Integration', rootPath: 'd://proj', graphVersion: 1, createdAt: now(), updatedAt: now() },
    scopes: [{ id: 's-root', projectId: 'proj', parentScopeId: null, containerViewId: null, kind: 'root', name: 'Root', createdAt: now(), updatedAt: now() }],
    workspaces: [{ id: 'ws-1', projectId: 'proj', scopeId: 's-root', name: 'Main', intent: null, viewport: { x: 0, y: 0, zoom: 1 }, focusedViewIds: [], visibleLayers: ['core', 'process'], contextPolicy: 'selection-only', updatedAt: now() }],
    artifacts: [{ id: 'art-a', projectId: 'proj', title: 'Doc A', kind: 'markdown', availability: 'available', createdAt: now(), updatedAt: now() }],
    artifactViews: [{ id: 'v-a1', artifactId: 'art-a', scopeId: 's-root', referenceKind: 'primary', position: { x: 100, y: 100 }, size: { width: 200, height: 150 }, displayMode: 'card', collapsed: false }],
    relations: [{ id: 'rel-1', projectId: 'proj', sourceEntityType: 'artifact', sourceEntityId: 'art-a', targetEntityType: 'artifact', targetEntityId: 'art-a', kind: 'reference', createdAt: now(), updatedAt: now() }],
    notes: [{ id: 'note-1', projectId: 'proj', anchor: { type: 'artifact', artifactId: 'art-a' }, body: 'A note', createdAt: now(), updatedAt: now() }],
    artifactRevisions: [],
    fileRecords: [],
    checkpoints: [{ id: 'cp-1', projectId: 'proj', scopeId: 's-root', label: 'V1', snapshotJson: { nodes: [{ id: 'v-a1', x: 100, y: 100 }], camera: { x: 0, y: 0, zoom: 1 } }, createdAt: now() }],
    ...overrides,
  } as any
}

// ==================== INT-001: Full CRUD cycle ====================

describe('INT-001 Full CRUD cycle', () => {
  let repo: SqliteMetadataRepository
  let dir: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'int-001-'))
    repo = new SqliteMetadataRepository(join(dir, 'test.sqlite'))
  })

  afterAll(() => {
    repo.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('creates, saves, closes, reopens — all data intact', () => {
    const snap = fullSnapshot()
    repo.save(snap)

    // Close and reopen
    repo.close()
    repo = new SqliteMetadataRepository(join(dir, 'test.sqlite'))

    const loaded = repo.get('proj')
    expect(loaded).toBeDefined()
    expect(loaded!.scopes).toHaveLength(1)
    expect(loaded!.workspaces).toHaveLength(1)
    expect(loaded!.artifacts).toHaveLength(1)
    expect(loaded!.artifactViews).toHaveLength(1)
    expect(loaded!.relations).toHaveLength(1)
    expect(loaded!.notes).toHaveLength(1)
    expect(loaded!.checkpoints).toHaveLength(1)

    // Verify position
    expect(loaded!.artifactViews[0].position).toEqual({ x: 100, y: 100 })
  })
})

// ==================== INT-002: 409 Stale Version ====================

describe('INT-002 409 Stale Version', () => {
  const dir = mkdtempSync(join(tmpdir(), 'int-002-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('later mutation with stale baseVersion should be detectable', () => {
    const repo = new SqliteMetadataRepository(join(dir, 'test.sqlite'))
    const before = fullSnapshot()
    repo.save(before)

    // Apply a mutation
    repo.applyMutations({ baseVersion: 1, ops: [{ type: 'upsert_artifact', artifact: { id: 'art-b', projectId: 'proj', title: 'Doc B', kind: 'markdown', localPath: 'd://b', availability: 'available', createdAt: now(), updatedAt: now() } }] })

    const afterMutation = repo.get('proj')!
    const vAfter = Number(afterMutation.graphVersion)
    expect(vAfter).toBe(2)

    const attempt = () => repo.applyMutations({ baseVersion: 1, ops: [{ type: 'move_artifact_view', viewId: 'v-a1', x: 999, y: 888 }] })
    expect(attempt).toThrowError(/stale/i)
    repo.close()
  })
})

// ==================== INT-006: Checkpoint survives restart ====================

describe('INT-006 Checkpoint survives restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'int-006-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('checkpoint remains unchanged after mutations and restart', () => {
    let repo = new SqliteMetadataRepository(join(dir, 'test.sqlite'))
    repo.save(fullSnapshot())

    const originalCp = JSON.stringify(repo.get('proj')!.checkpoints[0].snapshotJson)

    // Mutate
    repo.applyMutations({ baseVersion: 1, ops: [{ type: 'move_artifact_view', viewId: 'v-a1' as ArtifactView['id'], x: 999, y: 888 }] })

    // Close and reopen
    repo.close()
    repo = new SqliteMetadataRepository(join(dir, 'test.sqlite'))

    const loaded = repo.get('proj')!
    const cp = loaded.checkpoints[0]
    expect(JSON.stringify(cp.snapshotJson)).toBe(originalCp)
    // But current state reflects mutation
    expect(loaded.artifactViews[0].position).toEqual({ x: 999, y: 888 })
    repo.close()
  })
})

// ==================== INT-007: Scope parent/container recovery ====================

describe('INT-007 Scope parent/container recovery', () => {
  const dir = mkdtempSync(join(tmpdir(), 'int-007-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('child scope with parentScopeId and containerViewId survives restart', () => {
    const repo = new SqliteMetadataRepository(join(dir, 'test.sqlite'))
    repo.save(fullSnapshot({
      scopes: [
        { id: 's-root', projectId: 'proj', parentScopeId: null, containerViewId: null, kind: 'root', name: 'Root', createdAt: now(), updatedAt: now() },
        { id: 's-child', projectId: 'proj', parentScopeId: 's-root', containerViewId: 'v-a1', kind: 'collection', name: 'Child', createdAt: now(), updatedAt: now() },
      ],
    }))

    const loaded = repo.get('proj')!
    expect(loaded!.scopes).toHaveLength(2)
    const child = loaded!.scopes.find(s => s.id === 's-child')
    expect(child).toBeDefined()
    expect(child!.parentScopeId).toBe('s-root')
    expect(child!.containerViewId).toBe('v-a1')
    expect(child!.kind).toBe('collection')
    repo.close()
  })
})

describe('INT-008 Runtime mutation FK diagnostics', () => {
  const dir = mkdtempSync(join(tmpdir(), 'int-008-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('rejects artifact mutation for a missing Project with operation-level FK context', () => {
    const repo = new SqliteMetadataRepository(join(dir, 'test.sqlite'))

    const write = () => repo.applyMutations({
      baseVersion: 1,
      ops: [{
        type: 'upsert_artifact',
        artifact: {
          id: 'artifact-orphan',
          projectId: 'project-portasplit',
          title: 'Orphan',
          kind: 'markdown',
          availability: 'available',
          createdAt: now(),
          updatedAt: now(),
        },
      }],
    } as any)

    expect(write).toThrow(MetadataForeignKeyConstraintError)
    try { write() } catch (error) {
      const context = (error as MetadataForeignKeyConstraintError).context
      expect(context.operationType).toBe('upsert_artifact')
      expect(context.table).toBe('artifacts')
      expect(context.foreignKeyColumn).toBe('project_id')
      expect(context.referencedTable).toBe('projects')
      expect(context.referencedId).toBe('project-portasplit')
      expect(context.foreignKeyCheck).toEqual([])
    }
    repo.close()
  })
})
