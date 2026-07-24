import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Checkpoint, Note, ProjectGraphSnapshot } from '@local-creative-os/contracts'
import { afterEach, describe, expect, it } from 'vitest'

import { SCHEMA_VERSION, SqliteMetadataRepository } from '../src/metadata-repository.js'

const cleanup: string[] = []

function disposableSnapshot(): ProjectGraphSnapshot {
  const now = '2026-07-24T12:00:00.000Z'
  const projectId = 'disposable-portasplit' as ProjectGraphSnapshot['project']['id']
  const workspaceId = 'workspace-main' as ProjectGraphSnapshot['workspaces'][number]['id']
  const firstArtifactId = 'artifact-brief' as ProjectGraphSnapshot['artifacts'][number]['id']
  const secondArtifactId = 'artifact-board' as ProjectGraphSnapshot['artifacts'][number]['id']
  const firstViewId = 'view-brief' as ProjectGraphSnapshot['artifactViews'][number]['id']
  const secondViewId = 'view-board' as ProjectGraphSnapshot['artifactViews'][number]['id']
  const revisionId = 'rev-1' as ProjectGraphSnapshot['artifactRevisions'][number]['id']
  const noteId = 'note-1' as ProjectGraphSnapshot['notes'][number]['id']
  const checkpointId = 'checkpoint-1' as ProjectGraphSnapshot['checkpoints'][number]['id']
  return {
    schemaVersion: SCHEMA_VERSION,
    project: { id: projectId, name: 'PortaSplit', rootPath: 'disposable://portasplit', createdAt: now, updatedAt: now },
    workspaces: [{
      id: workspaceId, projectId, name: 'Main', intent: 'build',
      viewport: { x: 12, y: 34, zoom: 0.9 }, focusedNodeIds: [], visibleLayers: ['core'], updatedAt: now,
    }],
    artifacts: [
      { id: firstArtifactId, projectId, title: 'Brief', kind: 'markdown', localPath: 'disposable://brief', availability: 'available', createdAt: now, updatedAt: now },
      { id: secondArtifactId, projectId, title: 'Board', kind: 'image', localPath: 'disposable://board', availability: 'available', createdAt: now, updatedAt: now },
    ],
    artifactViews: [
      { id: firstViewId, artifactId: firstArtifactId, workspaceId, referenceKind: 'primary', position: { x: 10, y: 20 }, size: { width: 200, height: 140 }, displayMode: 'card', collapsed: false },
      { id: secondViewId, artifactId: secondArtifactId, workspaceId, referenceKind: 'primary', position: { x: 310, y: 20 }, size: { width: 240, height: 160 }, displayMode: 'thumbnail', collapsed: false },
    ],
    relations: [{
      id: 'relation-1' as ProjectGraphSnapshot['relations'][number]['id'],
      projectId, workspaceId, sourceArtifactViewId: firstViewId, targetArtifactViewId: secondViewId,
      kind: 'informs', createdAt: now, updatedAt: now,
    }],
    notes: [{
      id: noteId, projectId,
      anchor: { scope: 'artifact', artifactId: firstArtifactId } as Note['anchor'],
      body: 'This brief needs more context.', createdAt: now, updatedAt: now,
    }],
    artifactRevisions: [{
      id: revisionId, artifactId: firstArtifactId,
      localPath: 'disposable://brief', contentHash: 'abc123def' as ProjectGraphSnapshot['artifactRevisions'][number]['contentHash'],
      source: 'import', status: 'current', createdAt: now,
    }],
    checkpoints: [{
      id: checkpointId, projectId, workspaceId,
      artifactRevisionIds: [revisionId], relatedRunIds: [],
      canvasSnapshot: { nodes: [] }, createdAt: now,
    } as Checkpoint],
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

afterEach(async () => {
  await delay(200)
  await Promise.all(cleanup.splice(0).map((path) => rm(path, { recursive: true, force: true, maxRetries: 3 }).catch(() => { /* ignore EBUSY */ })))
})

describe('SqliteMetadataRepository', () => {
  it('migrates from empty, saves metadata, and restores after reopening', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-phase2-'))
    cleanup.push(directory)
    const path = join(directory, 'metadata.sqlite')
    const first = new SqliteMetadataRepository(path)
    expect(first.schemaVersion).toBe(SCHEMA_VERSION)
    first.save(disposableSnapshot())
    first.close()
    await delay(100)

    const reopened = new SqliteMetadataRepository(path)
    const restored = reopened.get('disposable-portasplit')
    reopened.close()
    expect(restored).toBeDefined()
    expect(restored!.project.name).toBe('PortaSplit')
    expect(restored!.workspaces).toHaveLength(1)
    expect(restored!.artifacts).toHaveLength(2)
    expect(restored!.artifactViews).toHaveLength(2)
    expect(restored!.relations).toHaveLength(1)
    expect(restored!.notes).toHaveLength(1)
    expect(restored!.notes[0].body).toBe('This brief needs more context.')
    expect(restored!.artifactRevisions).toHaveLength(1)
    expect(restored!.artifactRevisions[0].status).toBe('current')
    expect(restored!.checkpoints).toHaveLength(1)
  })

  it('migrates from v1 database (full Phase 2 Lite schema) to v2', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-phase2-'))
    cleanup.push(directory)
    const path = join(directory, 'metadata.sqlite')

    // Create a full v1 Phase 2 Lite database manually
    const { DatabaseSync } = await import('node:sqlite')
    const db1 = new DatabaseSync(path)
    db1.exec('PRAGMA foreign_keys = ON;')
    db1.exec(`
      BEGIN;
      CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, root_path TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        name TEXT NOT NULL, intent TEXT, camera_x REAL NOT NULL, camera_y REAL NOT NULL,
        camera_zoom REAL NOT NULL CHECK(camera_zoom > 0), focused_node_ids TEXT NOT NULL,
        visible_layers TEXT NOT NULL, layout_preset TEXT, context_policy TEXT,
        selection_state TEXT, updated_at TEXT NOT NULL
      );
      CREATE TABLE artifacts (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL, kind TEXT NOT NULL, local_path TEXT NOT NULL,
        availability TEXT NOT NULL, current_revision_id TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE artifact_views (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        revision_id TEXT, reference_kind TEXT NOT NULL,
        position_x REAL NOT NULL, position_y REAL NOT NULL,
        width REAL NOT NULL CHECK(width > 0), height REAL NOT NULL CHECK(height > 0),
        display_mode TEXT NOT NULL, collapsed INTEGER NOT NULL CHECK(collapsed IN (0, 1))
      );
      CREATE TABLE relations (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        source_view_id TEXT NOT NULL REFERENCES artifact_views(id) ON DELETE CASCADE,
        target_view_id TEXT NOT NULL REFERENCES artifact_views(id) ON DELETE CASCADE,
        kind TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        CHECK(source_view_id <> target_view_id)
      );
      PRAGMA user_version = 1;
      COMMIT;
    `)
    db1.close()
    await delay(100)

    // Now open with SqliteMetadataRepository — it should migrate v1→v2 then save
    const repo = new SqliteMetadataRepository(path)
    expect(repo.schemaVersion).toBe(SCHEMA_VERSION)
    repo.save(disposableSnapshot())
    const restored = repo.get('disposable-portasplit')
    expect(restored).toBeDefined()
    expect(restored!.notes).toHaveLength(1)
    expect(restored!.artifactRevisions).toHaveLength(1)
    expect(restored!.checkpoints).toHaveLength(1)
    repo.close()
  })

  it('deletes a view without deleting its artifact', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-phase2-'))
    cleanup.push(directory)
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'))
    repository.save(disposableSnapshot())
    repository.deleteArtifactView('view-brief')
    const restored = repository.get('disposable-portasplit')
    expect(restored?.artifactViews).toHaveLength(1)
    expect(restored?.artifacts).toHaveLength(2)
    expect(restored?.relations).toHaveLength(0) // cascaded
    repository.close()
  })

  it('rejects non-disposable projects', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-phase2-'))
    cleanup.push(directory)
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'))
    const value = disposableSnapshot()
    expect(() => repository.save({
      ...value,
      project: { ...value.project, id: 'real-project' as typeof value.project.id },
    })).toThrow('Only disposable')
    repository.close()
  })

  // ==================== Individual CRUD tests ====================

  it('CRUD for Notes works individually', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-phase2-'))
    cleanup.push(directory)
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'))
    const snap = disposableSnapshot()
    repository.save(snap)

    const now = '2026-07-24T13:00:00.000Z'
    const newNote: Note = {
      id: 'note-new' as Note['id'],
      projectId: snap.project.id,
      anchor: { scope: 'page', artifactId: snap.artifacts[0].id, pageIndex: 3 },
      body: 'Page 3 commentary.',
      createdAt: now,
      updatedAt: now,
    }
    repository.upsertNote(newNote)
    let notes = repository.getNotes('disposable-portasplit')
    expect(notes).toHaveLength(2)
    expect(notes.find((n) => n.id === 'note-new')?.body).toBe('Page 3 commentary.')

    repository.upsertNote({ ...newNote, body: 'Updated commentary.', updatedAt: now })
    expect(repository.getNote('note-new')?.body).toBe('Updated commentary.')

    repository.deleteNote('note-new')
    notes = repository.getNotes('disposable-portasplit')
    expect(notes).toHaveLength(1)
    repository.close()
  })

  it('CRUD for ArtifactRevisions works', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-phase2-'))
    cleanup.push(directory)
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'))
    const snap = disposableSnapshot()
    repository.save(snap)

    const now = '2026-07-24T14:00:00.000Z'
    repository.upsertArtifactRevision({
      id: 'rev-2' as typeof snap.artifactRevisions[0]['id'],
      artifactId: snap.artifacts[0].id,
      localPath: 'disposable://brief-v2',
      contentHash: 'def456abc' as typeof snap.artifactRevisions[0]['contentHash'],
      source: 'run',
      status: 'draft',
      createdAt: now,
    })
    const revisions = repository.getArtifactRevisions('artifact-brief')
    expect(revisions).toHaveLength(2)
    expect(revisions.find((r) => r.id === 'rev-2')?.status).toBe('draft')
    repository.close()
  })

  it('Checkpoint CRUD stores snapshot_json', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-phase2-'))
    cleanup.push(directory)
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'))
    const snap = disposableSnapshot()
    repository.save(snap)

    const now = '2026-07-24T15:00:00.000Z'
    const cp: Checkpoint = {
      id: 'cp-2' as Checkpoint['id'],
      projectId: snap.project.id,
      workspaceId: snap.workspaces[0].id,
      artifactRevisionIds: [],
      relatedRunIds: [],
      canvasSnapshot: { nodes: [{ id: 'n1' }], camera: { x: 100, y: 200, zoom: 1.5 } },
      createdAt: now,
    }
    repository.upsertCheckpoint(cp)
    const checkpoints = repository.getCheckpoints('disposable-portasplit')
    expect(checkpoints).toHaveLength(2)
    const restored = checkpoints.find((c) => c.id === 'cp-2')
    expect(restored).toBeDefined()
    expect(restored!.canvasSnapshot).toEqual({ nodes: [{ id: 'n1' }], camera: { x: 100, y: 200, zoom: 1.5 } })
    repository.close()
  })

  it('restart recovery: save, close, reopen, restore', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-phase2-'))
    cleanup.push(directory)
    const path = join(directory, 'metadata.sqlite')

    const session1 = new SqliteMetadataRepository(path)
    session1.save(disposableSnapshot())
    session1.close()
    await delay(100)

    const session2 = new SqliteMetadataRepository(path)
    const restored = session2.get('disposable-portasplit')
    session2.close()

    expect(restored).toBeDefined()
    expect(restored!.project.name).toBe('PortaSplit')
    expect(restored!.workspaces[0].viewport).toEqual({ x: 12, y: 34, zoom: 0.9 })
    expect(restored!.notes).toHaveLength(1)
    expect(restored!.artifactRevisions).toHaveLength(1)
    expect(restored!.checkpoints).toHaveLength(1)
  })
})
