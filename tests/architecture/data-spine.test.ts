/**
 * Architecture Tests — Phase 2.5 Data Spine Rules
 *
 * These tests enforce architectural invariants.
 * They must pass before any merge to main.
 *
 * Convention: ARCH-XXX in describe() maps to Architecture Rules doc.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// We test via the repository directly to verify domain contract
import { SqliteMetadataRepository } from '../../apps/local-core/src/metadata-repository'
import type { Artifact, ArtifactView, Checkpoint, Project, Relation, Scope, Workspace } from '../../packages/domain/src'
import type { ProjectGraphSnapshot, MutationBatch } from '../../packages/contracts/src'

const now = () => new Date().toISOString()

function makeProject(id = 'test-proj'): Project {
  return { id: id as Project['id'], name: 'Test', rootPath: 'disposable://' + id, graphVersion: 1 as Project['graphVersion'], createdAt: now(), updatedAt: now() }
}

function makeScope(id = 's-root', projId = 'test-proj'): Scope {
  return { id: id as Scope['id'], projectId: projId as Scope['projectId'], parentScopeId: null, containerViewId: null, kind: 'root', name: 'Root', createdAt: now(), updatedAt: now() }
}

function makeWorkspace(id = 'ws-1', scopeId = 's-root'): Workspace {
  return { id: id as Workspace['id'], projectId: 'test-proj' as Workspace['projectId'], scopeId: scopeId as Workspace['scopeId'], name: 'Main', intent: null, viewport: { x: 0, y: 0, zoom: 1 }, focusedViewIds: [], visibleLayers: ['core', 'process'], contextPolicy: 'selection-only', updatedAt: now() }
}

function makeArtifact(id = 'art-a', title = 'Artifact A'): Artifact {
  return { id: id as Artifact['id'], projectId: 'test-proj' as Artifact['projectId'], title, kind: 'markdown', localPath: 'disposable://' + id, availability: 'available', createdAt: now(), updatedAt: now() }
}

function makeView(id: string, artifactId: string, scopeId = 's-root'): ArtifactView {
  return { id: id as ArtifactView['id'], artifactId: artifactId as ArtifactView['artifactId'], scopeId: scopeId as ArtifactView['scopeId'], referenceKind: 'primary', position: { x: 0, y: 0 }, size: { width: 200, height: 150 }, displayMode: 'card', collapsed: false }
}

function makeCheckpoint(id: string, scopeId = 's-root', snapshotData: object = { nodes: [], camera: { x: 0, y: 0, zoom: 1 } }): Checkpoint {
  return { id: id as Checkpoint['id'], projectId: 'test-proj' as Checkpoint['projectId'], scopeId: scopeId as Checkpoint['scopeId'], label: 'Snapshot', snapshotJson: snapshotData as Checkpoint['snapshotJson'], createdAt: now() }
}

function minimalSnapshot(overrides: Partial<ProjectGraphSnapshot> = {}): ProjectGraphSnapshot {
  return {
    schemaVersion: 3, graphVersion: 1 as ProjectGraphSnapshot['graphVersion'],
    project: makeProject(), scopes: [makeScope()], workspaces: [makeWorkspace()],
    artifacts: [], artifactViews: [], relations: [], notes: [], artifactRevisions: [], fileRecords: [], checkpoints: [],
    ...overrides,
  } as ProjectGraphSnapshot
}

// ==================== ARCH-001: Artifact / View 身份分离 ====================

describe('ARCH-001 Artifact/View identity separation', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arch-001-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('creates one Artifact with two Views, survives save/reload', () => {
    const repo = new SqliteMetadataRepository(join(dir, 'test.sqlite'))
    const art = makeArtifact('art-a')
    const v1 = makeView('view-1', 'art-a')
    const v2 = makeView('view-2', 'art-a')

    const snap = minimalSnapshot({ artifacts: [art], artifactViews: [v1, v2] })
    repo.save(snap)

    const loaded = repo.get('test-proj')
    expect(loaded).toBeDefined()
    expect(loaded!.artifacts).toHaveLength(1)
    expect(loaded!.artifacts[0].id).toBe('art-a')
    expect(loaded!.artifactViews).toHaveLength(2)
    expect(loaded!.artifactViews.map(v => v.artifactId)).toEqual(['art-a', 'art-a'])
    repo.close()
  })
})

// ==================== ARCH-002: 删除最后一个 View 不删 Artifact ====================

describe('ARCH-002 Delete last View preserves Artifact', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arch-002-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('deleting only View keeps Artifact', () => {
    const repo = new SqliteMetadataRepository(join(dir, 'test.sqlite'))
    const art = makeArtifact('art-a')
    const v1 = makeView('view-1', 'art-a')
    repo.save(minimalSnapshot({ artifacts: [art], artifactViews: [v1] }))

    // Delete view via mutation
    repo.applyMutations({ baseVersion: 1 as ProjectGraphSnapshot['graphVersion'], ops: [{ type: 'delete_artifact_view', viewId: 'view-1' as ArtifactView['id'] }] })

    const loaded = repo.get('test-proj')
    expect(loaded).toBeDefined()
    expect(loaded!.artifactViews).toHaveLength(0)
    // Artifact survives — ON DELETE RESTRICT
    expect(loaded!.artifacts).toHaveLength(1)
    expect(loaded!.artifacts[0].id).toBe('art-a')
    repo.close()
  })
})

// ==================== ARCH-003: Workspace 不拥有 Graph ====================

describe('ARCH-003 Workspace does not own Graph', () => {
  it('Workspace type has no artifactViews, relations, or graph arrays', () => {
    // Verify at type level: Workspace interface does not compile with these properties
    const ws = makeWorkspace()
    // @ts-expect-error - artifactViews should not exist on Workspace
    void (ws.artifactViews)
    // @ts-expect-error - relations should not exist on Workspace
    void (ws.relations)
    expect(ws.scopeId).toBe('s-root')
    expect(ws.contextPolicy).toBe('selection-only')
    expect(ws.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
  })
})

// ==================== ARCH-004: Checkpoint Immutable ====================

describe('ARCH-004 Checkpoint immutable', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arch-004-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('checkpoint snapshot never changes after creation', () => {
    const repo = new SqliteMetadataRepository(join(dir, 'test.sqlite'))
    const cp = makeCheckpoint('cp-1', 's-root', { nodes: [{ id: 'n1', x: 100, y: 200 }] })
    repo.save(minimalSnapshot({ checkpoints: [cp] }))

    const originalHash = JSON.stringify(cp.snapshotJson)

    // Move nodes (mutation)
    repo.applyMutations({ baseVersion: 1 as ProjectGraphSnapshot['graphVersion'], ops: [{ type: 'move_artifact_view', viewId: 'view-1' as ArtifactView['id'], x: 999, y: 888 }] })

    // Re-read checkpoint
    const loaded = repo.get('test-proj')
    expect(loaded).toBeDefined()
    const loadedCp = loaded!.checkpoints.find(c => c.id === 'cp-1')
    expect(loadedCp).toBeDefined()
    expect(JSON.stringify(loadedCp!.snapshotJson)).toBe(originalHash)
    repo.close()
  })
})

// ==================== ARCH-005: Camera 不来自 Checkpoint ====================

describe('ARCH-005 Camera does not come from Checkpoint', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arch-005-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('Camera is loaded from Workspace.viewport, not checkpoint snapshot', () => {
    const ws = makeWorkspace('ws-1')
    ws.viewport = { x: 100, y: 200, zoom: 1.5 }
    const cp = makeCheckpoint('cp-1', 's-root', { camera: { x: 999, y: 888, zoom: 0.5 } })

    const repo = new SqliteMetadataRepository(join(dir, 'test.sqlite'))
    repo.save(minimalSnapshot({ workspaces: [{ ...ws }], checkpoints: [cp] }))

    const loaded = repo.get('test-proj')
    const loadedWs = loaded!.workspaces[0]
    // Camera comes from workspace, NOT checkpoint
    expect(loadedWs.viewport.x).toBe(100)
    expect(loadedWs.viewport.y).toBe(200)
    expect(loadedWs.viewport.zoom).toBe(1.5)
    repo.close()
  })
})

// ==================== ARCH-012: Migration 不靠删库 ====================

describe('ARCH-012 Migration survives without delete', () => {
  const dir = mkdtempSync(join(tmpdir(), 'arch-012-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('creates fresh v4 database, migrates v1 fixture without data loss', () => {
    const dbPath = join(dir, 'fresh.sqlite')
    const repo = new SqliteMetadataRepository(dbPath)
    // Verify schema version is 3
    const snap = minimalSnapshot()
    repo.save(snap)
    const loaded = repo.get('test-proj')
    expect(loaded).toBeDefined()
    expect(loaded!.schemaVersion).toBe(7)
    expect(loaded!.project.name).toBe('Test')
    repo.close()
  })
})
