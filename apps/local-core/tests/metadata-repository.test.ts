import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Checkpoint, Note, ProjectGraphSnapshot } from '@local-creative-os/contracts'
import { afterEach, describe, expect, it } from 'vitest'

import { MetadataForeignKeyConstraintError, SqliteMetadataRepository } from '../src/metadata-repository.js'

const cleanup: string[] = []
const SCHEMA_VERSION = 9

function disposableSnapshot(): ProjectGraphSnapshot {
  const now = '2026-07-24T12:00:00.000Z'
  const projectId = 'disposable-portasplit' as ProjectGraphSnapshot['project']['id']
  const workspaceId = 'workspace-main' as ProjectGraphSnapshot['workspaces'][number]['id']
  const scopeId = 'scope-root' as ProjectGraphSnapshot['scopes'][number]['id']
  const firstArtifactId = 'artifact-brief' as ProjectGraphSnapshot['artifacts'][number]['id']
  const secondArtifactId = 'artifact-board' as ProjectGraphSnapshot['artifacts'][number]['id']
  const firstViewId = 'view-brief' as ProjectGraphSnapshot['artifactViews'][number]['id']
  const secondViewId = 'view-board' as ProjectGraphSnapshot['artifactViews'][number]['id']
  const revisionId = 'rev-1' as ProjectGraphSnapshot['artifactRevisions'][number]['id']
  const fileRecordId = 'file-brief' as ProjectGraphSnapshot['fileRecords'][number]['id']
  const noteId = 'note-1' as ProjectGraphSnapshot['notes'][number]['id']
  const checkpointId = 'checkpoint-1' as ProjectGraphSnapshot['checkpoints'][number]['id']
  return {
    schemaVersion: SCHEMA_VERSION,
    graphVersion: 1 as ProjectGraphSnapshot['graphVersion'],
    project: {
      id: projectId, name: 'PortaSplit', rootPath: 'disposable://portasplit',
      graphVersion: 1 as ProjectGraphSnapshot['project']['graphVersion'],
      createdAt: now, updatedAt: now,
    },
    scopes: [{
      id: scopeId, projectId, parentScopeId: null, containerViewId: null,
      kind: 'root', name: 'Root', createdAt: now, updatedAt: now,
    }],
    workspaces: [{
      id: workspaceId, projectId, scopeId, name: 'Main', intent: 'build',
      viewport: { x: 12, y: 34, zoom: 0.9 }, focusedViewIds: [], visibleLayers: ['core'], updatedAt: now,
      contextPolicy: 'selection-only',
    }],
    artifacts: [
      { id: firstArtifactId, projectId, title: 'Brief', kind: 'markdown', availability: 'available', currentRevisionId: revisionId, createdAt: now, updatedAt: now },
      { id: secondArtifactId, projectId, title: 'Board', kind: 'image', availability: 'available', createdAt: now, updatedAt: now },
    ],
    artifactViews: [
      { id: firstViewId, artifactId: firstArtifactId, scopeId, referenceKind: 'primary', position: { x: 10, y: 20 }, size: { width: 200, height: 140 }, displayMode: 'card', collapsed: false },
      { id: secondViewId, artifactId: secondArtifactId, scopeId, referenceKind: 'primary', position: { x: 310, y: 20 }, size: { width: 240, height: 160 }, displayMode: 'thumbnail', collapsed: false },
    ],
    relations: [{
      id: 'relation-1' as ProjectGraphSnapshot['relations'][number]['id'],
      projectId, sourceEntityType: 'artifact', sourceEntityId: firstArtifactId,
      targetEntityType: 'artifact', targetEntityId: secondArtifactId,
      kind: 'informs', createdAt: now, updatedAt: now,
    }],
    notes: [{
      id: noteId, projectId,
      anchor: { type: 'artifact', artifactId: firstArtifactId } as Note['anchor'],
      body: 'This brief needs more context.', createdAt: now, updatedAt: now,
    }],
    artifactRevisions: [{
      id: revisionId, artifactId: firstArtifactId,
      fileRecordId, contentHash: 'abc123def' as ProjectGraphSnapshot['artifactRevisions'][number]['contentHash'],
      source: 'import', status: 'current', createdAt: now,
    }],
    fileRecords: [{
      id: fileRecordId,
      projectId,
      observedPath: 'disposable://brief',
      observedHash: 'abc123def' as ProjectGraphSnapshot['fileRecords'][number]['observedHash'],
      size: 0,
      modifiedAt: now,
      mimeType: 'text/markdown',
      availability: 'current',
      observedAt: now,
    }],
    checkpoints: [{
      id: checkpointId, projectId, scopeId, label: 'Initial',
      snapshotJson: { nodes: [] }, createdAt: now,
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

  it('backs up a malformed v1 database before migration fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-phase2-'))
    cleanup.push(directory)
    const path = join(directory, 'metadata.sqlite')

    // Corrupt legacy metadata must fail loudly without losing the original bytes.
    const { DatabaseSync } = await import('node:sqlite')
    const db1 = new DatabaseSync(path)
    db1.exec('PRAGMA foreign_keys = ON;')
    db1.exec(`
      BEGIN;
      CREATE TABLE projects (id TEXT PRIMARY KEY);
      CREATE TABLE scopes (id TEXT PRIMARY KEY);
      PRAGMA user_version = 1;
      COMMIT;
    `)
    db1.close()
    await delay(100)

    expect(() => new SqliteMetadataRepository(path)).toThrow()
    const { stat } = await import('node:fs/promises')
    await expect(stat(`${path}.bak`)).resolves.toMatchObject({ size: expect.any(Number) })
  })

  it('migrates v3 revisions to v4 FileRecords and preserves a backup', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-phase3-v3-'))
    cleanup.push(directory)
    const path = join(directory, 'metadata.sqlite')
    const { DatabaseSync } = await import('node:sqlite')
    const legacy = new DatabaseSync(path)
    legacy.exec(`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, root_path TEXT NOT NULL,
        graph_version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE artifacts (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
        title TEXT NOT NULL, kind TEXT NOT NULL, local_path TEXT NOT NULL,
        availability TEXT NOT NULL, current_revision_id TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE artifact_revisions (
        id TEXT PRIMARY KEY, artifact_id TEXT NOT NULL REFERENCES artifacts(id),
        parent_revision_id TEXT, local_path TEXT NOT NULL, content_hash TEXT NOT NULL,
        source TEXT NOT NULL, run_id TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL
      );
      INSERT INTO projects VALUES (
        'disposable-v3', 'Legacy', 'disposable://v3', 1,
        '2026-07-24T00:00:00.000Z', '2026-07-24T00:00:00.000Z'
      );
      INSERT INTO artifacts VALUES (
        'artifact-v3', 'disposable-v3', 'Legacy source', 'markdown',
        'disposable://legacy.md', 'available', 'revision-v3',
        '2026-07-24T00:00:00.000Z', '2026-07-24T00:00:00.000Z'
      );
      INSERT INTO artifact_revisions VALUES (
        'revision-v3', 'artifact-v3', NULL, 'disposable://legacy.md', 'legacy-hash',
        'import', NULL, 'current', '2026-07-24T00:00:00.000Z'
      );
      PRAGMA user_version = 3;
    `)
    legacy.close()

    const migrated = new SqliteMetadataRepository(path)
    const revision = migrated.getArtifactRevision('revision-v3')
    const record = migrated.getFileRecord('migrated-revision-v3')
    migrated.close()
    const { stat } = await import('node:fs/promises')

    expect(revision).toMatchObject({
      id: 'revision-v3',
      fileRecordId: 'migrated-revision-v3',
      contentHash: 'legacy-hash',
      status: 'current',
    })
    expect(record).toMatchObject({
      id: 'migrated-revision-v3',
      projectId: 'disposable-v3',
      observedPath: 'disposable://legacy.md',
      observedHash: 'legacy-hash',
      availability: 'unreadable',
    })
    await expect(stat(`${path}.v3.bak`)).resolves.toMatchObject({ size: expect.any(Number) })
  })

  it('deletes a view without deleting its artifact', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-phase2-'))
    cleanup.push(directory)
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'), { disposableOnly: true })
    repository.save(disposableSnapshot())
    repository.deleteArtifactView('view-brief')
    const restored = repository.get('disposable-portasplit')
    expect(restored?.artifactViews).toHaveLength(1)
    expect(restored?.artifacts).toHaveLength(2)
    expect(restored?.relations).toHaveLength(1) // relations target entities, not views
    repository.close()
  })

  it('rejects non-disposable projects', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-phase2-'))
    cleanup.push(directory)
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'), { disposableOnly: true })
    const value = disposableSnapshot()
    expect(() => repository.save({
      ...value,
      project: { ...value.project, id: 'real-project' as typeof value.project.id },
    })).toThrow('Only disposable')
    repository.close()
  })

  it('reports the missing Project FK before a runtime mutation inserts an Artifact', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-phase3-fk-'))
    cleanup.push(directory)
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'))

    const write = () => repository.applyMutations({
      baseVersion: 1 as ProjectGraphSnapshot['graphVersion'],
      ops: [{
        type: 'upsert_artifact',
        artifact: {
          id: 'artifact-orphan' as ProjectGraphSnapshot['artifacts'][number]['id'],
          projectId: 'project-portasplit' as ProjectGraphSnapshot['project']['id'],
          title: 'Orphan',
          kind: 'markdown',
          availability: 'available',
          createdAt: '2026-07-24T12:00:00.000Z',
          updatedAt: '2026-07-24T12:00:00.000Z',
        },
      }],
    })

    expect(write).toThrow(MetadataForeignKeyConstraintError)
    try { write() } catch (error) {
      expect(error).toBeInstanceOf(MetadataForeignKeyConstraintError)
      const context = (error as MetadataForeignKeyConstraintError).context
      expect(context).toMatchObject({
        operationType: 'upsert_artifact',
        entityId: 'artifact-orphan',
        table: 'artifacts',
        statement: 'INSERT INTO artifacts',
        foreignKeyColumn: 'project_id',
        referencedTable: 'projects',
        referencedId: 'project-portasplit',
        foreignKeyCheck: [],
      })
    }
    repository.close()
  })

  it('reports the Phase 3 v4 missing FileRecord FK before saving an ArtifactRevision', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'local-core-phase3-fk-'))
    cleanup.push(directory)
    const repository = new SqliteMetadataRepository(join(directory, 'metadata.sqlite'))
    const snap = disposableSnapshot()
    const broken = {
      ...snap,
      fileRecords: [],
      artifactRevisions: [{
        ...snap.artifactRevisions[0],
        fileRecordId: 'file-missing' as ProjectGraphSnapshot['artifactRevisions'][number]['fileRecordId'],
      }],
    }

    const write = () => repository.save(broken)

    expect(write).toThrow(MetadataForeignKeyConstraintError)
    try { write() } catch (error) {
      expect(error).toBeInstanceOf(MetadataForeignKeyConstraintError)
      const context = (error as MetadataForeignKeyConstraintError).context
      expect(context).toMatchObject({
        operationType: 'save_artifact_revision',
        entityId: 'rev-1',
        table: 'artifact_revisions',
        statement: 'INSERT INTO artifact_revisions',
        foreignKeyColumn: 'file_record_id',
        referencedTable: 'file_records',
        referencedId: 'file-missing',
        foreignKeyCheck: [],
      })
    }
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
      anchor: { type: 'page', revisionId: snap.artifactRevisions[0].id, pageIndex: 3 },
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
    const revision = {
      id: 'rev-2' as typeof snap.artifactRevisions[0]['id'],
      artifactId: snap.artifacts[0].id,
      fileRecordId: snap.fileRecords[0].id,
      contentHash: 'def456abc' as typeof snap.artifactRevisions[0]['contentHash'],
      source: 'run',
      status: 'draft',
      createdAt: now,
    } as const
    repository.save({ ...snap, artifactRevisions: [...snap.artifactRevisions, revision] })
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
      scopeId: snap.scopes[0].id,
      label: 'Review',
      snapshotJson: { nodes: [{ id: 'n1' }], camera: { x: 100, y: 200, zoom: 1.5 } },
      createdAt: now,
    }
    repository.createCheckpoint(cp)
    const checkpoints = repository.getCheckpoints('disposable-portasplit')
    expect(checkpoints).toHaveLength(2)
    const restored = checkpoints.find((c) => c.id === 'cp-2')
    expect(restored).toBeDefined()
    expect(restored!.snapshotJson).toEqual({ nodes: [{ id: 'n1' }], camera: { x: 100, y: 200, zoom: 1.5 } })
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
