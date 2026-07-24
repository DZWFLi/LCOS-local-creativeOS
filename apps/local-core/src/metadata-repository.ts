import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

import type {
  Artifact,
  ArtifactId,
  ArtifactRevision,
  ArtifactRevisionId,
  ArtifactView,
  ArtifactViewId,
  Checkpoint,
  CheckpointId,
  GraphVersion,
  Note,
  NoteId,
  Project,
  ProjectId,
  Relation,
  RelationId,
  Scope,
  ScopeId,
  Workspace,
  WorkspaceId,
} from '@local-creative-os/domain'
import type { MutationBatch, ProjectGraphSnapshot } from '@local-creative-os/contracts'

type Row = Record<string, SQLInputValue | undefined>

function json<T>(value: SQLInputValue): T {
  if (typeof value !== 'string') return JSON.parse('null') as unknown as T
  try { return JSON.parse(value) as T } catch { return JSON.parse('null') as unknown as T }
}

export interface MetadataRepositoryOptions {
  readonly disposableOnly?: boolean
}

export class SqliteMetadataRepository {
  readonly databasePath: string
  readonly #database: DatabaseSync
  readonly #disposableOnly: boolean

  constructor(databasePath: string, options: MetadataRepositoryOptions = {}) {
    this.databasePath = resolve(databasePath)
    this.#disposableOnly = options.disposableOnly ?? false
    mkdirSync(dirname(this.databasePath), { recursive: true })
    this.#database = new DatabaseSync(this.databasePath)
    this.#database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')
    this.#migrate()
  }

  close(): void { this.#database.close() }

  // ==================== Migration ====================

  #migrate(): void {
    const version = this.#database.prepare('PRAGMA user_version').get() as { user_version: number }
    if (version.user_version === 0) { this.#migrate_001(); return }
    if (version.user_version === 1) { this.#migrate_002_from_v1(); return }
    if (version.user_version === 2) { this.#migrate_003_from_v2(); return }
    // v3 = current
  }

  #migrate_001(): void {
    this.#database.exec(`
      BEGIN;
      CREATE TABLE projects (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, root_path TEXT NOT NULL,
        graph_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE scopes (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        parent_scope_id TEXT, container_view_id TEXT,
        kind TEXT NOT NULL, name TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        scope_id TEXT NOT NULL, name TEXT NOT NULL, intent TEXT,
        viewport TEXT NOT NULL, focused_node_ids TEXT NOT NULL DEFAULT '[]',
        visible_layers TEXT NOT NULL DEFAULT '["core","process"]',
        context_policy TEXT NOT NULL DEFAULT 'selection-only',
        updated_at TEXT NOT NULL
      );
      CREATE TABLE artifacts (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL, kind TEXT NOT NULL, local_path TEXT NOT NULL,
        availability TEXT NOT NULL, current_revision_id TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE artifact_views (
        id TEXT PRIMARY KEY, artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
        scope_id TEXT NOT NULL, revision_id TEXT,
        reference_kind TEXT NOT NULL, position TEXT NOT NULL, size TEXT NOT NULL,
        display_mode TEXT NOT NULL, collapsed INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE relations (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        source_entity_type TEXT NOT NULL, source_entity_id TEXT NOT NULL,
        target_entity_type TEXT NOT NULL, target_entity_id TEXT NOT NULL,
        kind TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE artifact_revisions (
        id TEXT PRIMARY KEY, artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
        parent_revision_id TEXT, local_path TEXT NOT NULL, content_hash TEXT NOT NULL,
        source TEXT NOT NULL, run_id TEXT, status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE notes (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        anchor_scope TEXT NOT NULL, artifact_id TEXT, artifact_view_id TEXT, page_index INTEGER,
        body TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE checkpoints (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        scope_id TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
        snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL
      );
      PRAGMA user_version = 3;
      CREATE UNIQUE INDEX idx_revision_current
        ON artifact_revisions(artifact_id) WHERE status = 'current';
      COMMIT;
    `)
  }

  #migrate_002_from_v1(): void {
    // v1 → v3: drop old schema, create new. Phase 2 data is disposable.
    const backup = this.databasePath + '.bak'
    this.#database.exec(`VACUUM INTO '${backup.replace(/\\/g, '\\\\')}'`)
    this.#database.exec(`
      BEGIN;
      DROP TABLE IF EXISTS workspaces;
      DROP TABLE IF EXISTS artifacts;
      DROP TABLE IF EXISTS artifact_views;
      DROP TABLE IF EXISTS relations;
      DROP TABLE IF EXISTS artifact_revisions;
      DROP TABLE IF EXISTS notes;
      DROP TABLE IF EXISTS checkpoints;
      DROP TABLE IF EXISTS projects;
      CREATE TABLE projects (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, root_path TEXT NOT NULL,
        graph_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE scopes (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        parent_scope_id TEXT, container_view_id TEXT,
        kind TEXT NOT NULL, name TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        scope_id TEXT NOT NULL, name TEXT NOT NULL, intent TEXT,
        viewport TEXT NOT NULL, focused_node_ids TEXT NOT NULL DEFAULT '[]',
        visible_layers TEXT NOT NULL DEFAULT '["core","process"]',
        context_policy TEXT NOT NULL DEFAULT 'selection-only',
        updated_at TEXT NOT NULL
      );
      CREATE TABLE artifacts (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL, kind TEXT NOT NULL, local_path TEXT NOT NULL,
        availability TEXT NOT NULL, current_revision_id TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE artifact_views (
        id TEXT PRIMARY KEY, artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
        scope_id TEXT NOT NULL, revision_id TEXT,
        reference_kind TEXT NOT NULL, position TEXT NOT NULL, size TEXT NOT NULL,
        display_mode TEXT NOT NULL, collapsed INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE relations (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        source_entity_type TEXT NOT NULL, source_entity_id TEXT NOT NULL,
        target_entity_type TEXT NOT NULL, target_entity_id TEXT NOT NULL,
        kind TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE artifact_revisions (
        id TEXT PRIMARY KEY, artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
        parent_revision_id TEXT, local_path TEXT NOT NULL, content_hash TEXT NOT NULL,
        source TEXT NOT NULL, run_id TEXT, status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE notes (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        anchor_scope TEXT NOT NULL, artifact_id TEXT, artifact_view_id TEXT, page_index INTEGER,
        body TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE checkpoints (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        scope_id TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
        snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL
      );
      PRAGMA user_version = 3;
      CREATE UNIQUE INDEX idx_revision_current
        ON artifact_revisions(artifact_id) WHERE status = 'current';
      COMMIT;
    `)
  }

  #migrate_003_from_v2(): void {
    // v2 (old Phase 2 schema with canvas_snapshot) → v3
    const backup = this.databasePath + '.bak'
    this.#database.exec(`VACUUM INTO '${backup.replace(/\\/g, '\\\\')}'`)
    this.#database.exec(`DROP TABLE IF EXISTS checkpoint_revision_ids`)
    this.#database.exec(`DROP TABLE IF EXISTS checkpoint_run_ids`)
    this.#database.exec(`DROP TABLE IF EXISTS checkpoints`)
    this.#database.exec(`
      CREATE TABLE checkpoints (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        scope_id TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
        snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL
      );
    `)
    // Add scope_id to workspaces if missing
    try { this.#database.exec(`ALTER TABLE workspaces ADD COLUMN scope_id TEXT NOT NULL DEFAULT ''`) } catch {}
    try { this.#database.exec(`ALTER TABLE workspaces ADD COLUMN context_policy TEXT NOT NULL DEFAULT 'selection-only'`) } catch {}
    try { this.#database.exec(`ALTER TABLE projects ADD COLUMN graph_version INTEGER NOT NULL DEFAULT 1`) } catch {}
    this.#database.exec(`PRAGMA user_version = 3`)
  }

  // ==================== Graph Save/Load ====================

  save(snapshot: ProjectGraphSnapshot): void {
    if (this.#disposableOnly) {
      if (!String(snapshot.project.id).startsWith('disposable-')) {
        throw new Error('Only disposable projects are accepted.')
      }
    }
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      const pid = snapshot.project.id
      // Delete in reverse dependency order
      this.#database.prepare('DELETE FROM checkpoints WHERE project_id = ?').run(pid as SQLInputValue)
      this.#database.prepare('DELETE FROM notes WHERE project_id = ?').run(pid as SQLInputValue)
      this.#database.prepare('DELETE FROM relations WHERE project_id = ?').run(pid as SQLInputValue)
      this.#database.prepare('DELETE FROM artifact_views WHERE artifact_id IN (SELECT id FROM artifacts WHERE project_id = ?)').run(pid as SQLInputValue)
      this.#database.prepare('DELETE FROM artifact_revisions WHERE artifact_id IN (SELECT id FROM artifacts WHERE project_id = ?)').run(pid as SQLInputValue)
      this.#database.prepare('DELETE FROM artifacts WHERE project_id = ?').run(pid as SQLInputValue)
      this.#database.prepare('DELETE FROM workspaces WHERE project_id = ?').run(pid as SQLInputValue)
      this.#database.prepare('DELETE FROM scopes WHERE project_id = ?').run(pid as SQLInputValue)

      // Re-insert
      this.#upsertProject(snapshot.project)
      for (const scope of snapshot.scopes) this.#upsertScope(scope, pid)
      for (const workspace of snapshot.workspaces) this.#upsertWorkspace(workspace)
      for (const artifact of snapshot.artifacts) this.#upsertArtifact(artifact)
      for (const revision of snapshot.artifactRevisions) this.#upsertArtifactRevision(revision)
      for (const view of snapshot.artifactViews) this.#upsertArtifactView(view)
      for (const relation of snapshot.relations) this.#upsertRelation(relation)
      for (const note of snapshot.notes) this.#upsertNote(note)
      for (const checkpoint of snapshot.checkpoints) this.#upsertCheckpoint(checkpoint)

      this.#database.exec('COMMIT;')
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
  }

  get(projectId: string): ProjectGraphSnapshot | undefined {
    const projectRows = this.#database.prepare('SELECT * FROM projects WHERE id = ?').all(projectId as SQLInputValue) as Row[]
    if (!projectRows.length) return undefined
    const project = this.#project(projectRows[0] as Row)

    const scopes = (this.#database.prepare('SELECT * FROM scopes WHERE project_id = ?').all(project.id as SQLInputValue) as Row[]).map((r) => this.#scope(r))
    const workspaces = (this.#database.prepare('SELECT * FROM workspaces WHERE project_id = ?').all(project.id as SQLInputValue) as Row[]).map((r) => this.#workspace(r))
    const artifacts = (this.#database.prepare('SELECT * FROM artifacts WHERE project_id = ?').all(project.id as SQLInputValue) as Row[]).map((r) => this.#artifact(r))
    const revisionRows = (this.#database.prepare('SELECT r.* FROM artifact_revisions r JOIN artifacts a ON r.artifact_id = a.id WHERE a.project_id = ?').all(project.id as SQLInputValue) as Row[])
    const artifactRevisions = revisionRows.map((r) => this.#artifactRevision(r))
    const viewRows = (this.#database.prepare('SELECT v.* FROM artifact_views v JOIN artifacts a ON v.artifact_id = a.id WHERE a.project_id = ?').all(project.id as SQLInputValue) as Row[])
    const artifactViews = viewRows.map((r) => this.#artifactView(r))
    const relations = (this.#database.prepare('SELECT * FROM relations WHERE project_id = ?').all(project.id as SQLInputValue) as Row[]).map((r) => this.#relation(r))
    const notes = (this.#database.prepare('SELECT * FROM notes WHERE project_id = ?').all(project.id as SQLInputValue) as Row[]).map((r) => this.#note(r))
    const checkpoints = (this.#database.prepare('SELECT * FROM checkpoints WHERE project_id = ?').all(project.id as SQLInputValue) as Row[]).map((r) => this.#checkpoint(r))

    return {
      schemaVersion: 3,
      graphVersion: project.graphVersion as GraphVersion,
      project,
      scopes,
      workspaces,
      artifacts,
      artifactViews,
      relations,
      artifactRevisions,
      notes,
      checkpoints,
    }
  }

  // ==================== Mutation ====================

  applyMutations(batch: MutationBatch): void {
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      for (const op of batch.ops) {
        switch (op.type) {
          case 'bootstrap':
            this.save(op.snapshot)
            break
          case 'move_artifact_view':
            this.#database.prepare(`UPDATE artifact_views SET position = json_set(position, '$.x', ?, '$.y', ?) WHERE id = ?`)
              .run(op.x as SQLInputValue, op.y as SQLInputValue, op.viewId as SQLInputValue)
            break
          case 'upsert_workspace':
            this.#upsertWorkspace(op.workspace)
            break
          case 'upsert_scope':
            this.#upsertScope(op.scope, op.scope.projectId)
            break
          case 'upsert_artifact':
            this.#upsertArtifact(op.artifact)
            break
          case 'upsert_artifact_view':
            this.#upsertArtifactView(op.view)
            break
          case 'delete_artifact_view':
            this.#database.prepare('DELETE FROM artifact_views WHERE id = ?').run(op.viewId as SQLInputValue)
            break
          case 'upsert_relation':
            this.#upsertRelation(op.relation)
            break
          case 'delete_relation':
            this.#database.prepare('DELETE FROM relations WHERE id = ?').run(op.relationId as SQLInputValue)
            break
          case 'upsert_note':
            this.#upsertNote(op.note)
            break
          case 'create_checkpoint':
            this.#upsertCheckpoint(op.checkpoint)
            break
          case 'upsert_artifact_revision':
            this.#upsertArtifactRevision(op.revision)
            break
        }
      }

      this.#database.exec('COMMIT;')
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
  }

  // ==================== Public CRUD (exposed for server routes) ====================

  getProject(projectId: string): Project | undefined {
    const rows = this.#database.prepare('SELECT * FROM projects WHERE id = ?').all(projectId as SQLInputValue) as Row[]
    return rows.length ? this.#project(rows[0] as Row) : undefined
  }

  listProjects(): Project[] {
    return (this.#database.prepare('SELECT * FROM projects').all() as Row[]).map((r) => this.#project(r as Row))
  }

  getWorkspaces(projectId: string): Workspace[] {
    return (this.#database.prepare('SELECT * FROM workspaces WHERE project_id = ?').all(projectId as SQLInputValue) as Row[]).map((r) => this.#workspace(r))
  }

  getWorkspace(workspaceId: string): Workspace | undefined {
    const rows = this.#database.prepare('SELECT * FROM workspaces WHERE id = ?').all(workspaceId as SQLInputValue) as Row[]
    return rows.length ? this.#workspace(rows[0] as Row) : undefined
  }

  upsertWorkspace(value: Workspace): void { this.#upsertWorkspace(value) }

  getArtifacts(projectId: string): Artifact[] {
    return (this.#database.prepare('SELECT * FROM artifacts WHERE project_id = ?').all(projectId as SQLInputValue) as Row[]).map((r) => this.#artifact(r))
  }

  getArtifact(artifactId: string): Artifact | undefined {
    const rows = this.#database.prepare('SELECT * FROM artifacts WHERE id = ?').all(artifactId as SQLInputValue) as Row[]
    return rows.length ? this.#artifact(rows[0] as Row) : undefined
  }

  upsertArtifact(value: Artifact): void { this.#upsertArtifact(value) }

  getArtifactViews(artifactId: string): ArtifactView[] {
    return (this.#database.prepare('SELECT * FROM artifact_views WHERE artifact_id = ?').all(artifactId as SQLInputValue) as Row[]).map((r) => this.#artifactView(r))
  }

  getArtifactView(viewId: string): ArtifactView | undefined {
    const rows = this.#database.prepare('SELECT * FROM artifact_views WHERE id = ?').all(viewId as SQLInputValue) as Row[]
    return rows.length ? this.#artifactView(rows[0] as Row) : undefined
  }

  upsertArtifactView(value: ArtifactView): void { this.#upsertArtifactView(value) }
  deleteArtifactView(viewId: string): void { this.#database.prepare('DELETE FROM artifact_views WHERE id = ?').run(viewId as SQLInputValue) }

  getRelations(projectId: string): Relation[] {
    return (this.#database.prepare('SELECT * FROM relations WHERE project_id = ?').all(projectId as SQLInputValue) as Row[]).map((r) => this.#relation(r))
  }

  getRelation(relationId: string): Relation | undefined {
    const rows = this.#database.prepare('SELECT * FROM relations WHERE id = ?').all(relationId as SQLInputValue) as Row[]
    return rows.length ? this.#relation(rows[0] as Row) : undefined
  }

  upsertRelation(value: Relation): void { this.#upsertRelation(value) }
  deleteRelation(relationId: string): void { this.#database.prepare('DELETE FROM relations WHERE id = ?').run(relationId as SQLInputValue) }

  getNotes(projectId: string): Note[] {
    return (this.#database.prepare('SELECT * FROM notes WHERE project_id = ?').all(projectId as SQLInputValue) as Row[]).map((r) => this.#note(r))
  }

  getNote(noteId: string): Note | undefined {
    const rows = this.#database.prepare('SELECT * FROM notes WHERE id = ?').all(noteId as SQLInputValue) as Row[]
    return rows.length ? this.#note(rows[0] as Row) : undefined
  }

  upsertNote(value: Note): void { this.#upsertNote(value) }
  deleteNote(noteId: string): void { this.#database.prepare('DELETE FROM notes WHERE id = ?').run(noteId as SQLInputValue) }

  getArtifactRevisions(artifactId: string): ArtifactRevision[] {
    return (this.#database.prepare('SELECT * FROM artifact_revisions WHERE artifact_id = ?').all(artifactId as SQLInputValue) as Row[]).map((r) => this.#artifactRevision(r))
  }

  getArtifactRevision(revisionId: string): ArtifactRevision | undefined {
    const rows = this.#database.prepare('SELECT * FROM artifact_revisions WHERE id = ?').all(revisionId as SQLInputValue) as Row[]
    return rows.length ? this.#artifactRevision(rows[0] as Row) : undefined
  }

  getCheckpoints(projectId: string): Checkpoint[] {
    return (this.#database.prepare('SELECT * FROM checkpoints WHERE project_id = ?').all(projectId as SQLInputValue) as Row[]).map((r) => this.#checkpoint(r))
  }

  getCheckpoint(checkpointId: string): Checkpoint | undefined {
    const rows = this.#database.prepare('SELECT * FROM checkpoints WHERE id = ?').all(checkpointId as SQLInputValue) as Row[]
    return rows.length ? this.#checkpoint(rows[0] as Row) : undefined
  }

  upsertCheckpoint(value: Checkpoint): void { this.#upsertCheckpoint(value) }

  get schemaVersion(): number { return 3 }

  // ==================== Private helpers ====================

  #upsertProject(value: Project): void {
    this.#database.prepare(`
      INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, graph_version=graph_version+1, updated_at=excluded.updated_at
    `).run(value.id as SQLInputValue, value.name, value.rootPath, value.graphVersion as unknown as number, value.createdAt, value.updatedAt)
  }

  #upsertScope(value: Scope, projectId: ProjectId): void {
    this.#database.prepare(`
      INSERT INTO scopes VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET parent_scope_id=excluded.parent_scope_id, name=excluded.name, updated_at=excluded.updated_at
    `).run(value.id as SQLInputValue, projectId as SQLInputValue, value.parentScopeId as SQLInputValue ?? null, value.containerViewId as SQLInputValue ?? null, value.kind, value.name, value.createdAt, value.updatedAt)
  }

  #upsertWorkspace(value: Workspace): void {
    this.#database.prepare(`
      INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, viewport=excluded.viewport, visible_layers=excluded.visible_layers, context_policy=excluded.context_policy, updated_at=excluded.updated_at
    `).run(
      value.id as SQLInputValue, value.projectId as SQLInputValue, value.scopeId as SQLInputValue,
      value.name, value.intent, JSON.stringify(value.viewport),
      JSON.stringify(value.focusedNodeIds), JSON.stringify(value.visibleLayers),
      value.contextPolicy, value.updatedAt,
    )
  }

  #upsertArtifact(value: Artifact): void {
    this.#database.prepare(`
      INSERT INTO artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, availability=excluded.availability, current_revision_id=excluded.current_revision_id, updated_at=excluded.updated_at
    `).run(value.id as SQLInputValue, value.projectId as SQLInputValue, value.title, value.kind, value.localPath, value.availability, value.currentRevisionId as SQLInputValue ?? null, value.createdAt, value.updatedAt)
  }

  #upsertArtifactView(value: ArtifactView): void {
    this.#database.prepare(`
      INSERT INTO artifact_views VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET position=excluded.position, size=excluded.size, display_mode=excluded.display_mode
    `).run(value.id as SQLInputValue, value.artifactId as SQLInputValue, value.scopeId as SQLInputValue, value.revisionId as SQLInputValue ?? null,
      value.referenceKind, JSON.stringify(value.position), JSON.stringify(value.size),
      value.displayMode, value.collapsed ? 1 : 0)
  }

  #upsertRelation(value: Relation): void {
    this.#database.prepare(`
      INSERT INTO relations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, updated_at=excluded.updated_at
    `).run(value.id as SQLInputValue, value.projectId as SQLInputValue, value.sourceEntityType, value.sourceEntityId, value.targetEntityType, value.targetEntityId, value.kind, value.createdAt, value.updatedAt)
  }

  #upsertArtifactRevision(value: ArtifactRevision): void {
    this.#database.prepare(`
      INSERT INTO artifact_revisions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status
    `).run(value.id as SQLInputValue, value.artifactId as SQLInputValue, value.parentRevisionId as SQLInputValue ?? null, value.localPath, value.contentHash as SQLInputValue, value.source, value.runId as SQLInputValue ?? null, value.status, value.createdAt)
  }

  #upsertNote(value: Note): void {
    this.#database.prepare(`
      INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET body=excluded.body, updated_at=excluded.updated_at
    `).run(value.id as SQLInputValue, value.projectId as SQLInputValue, JSON.stringify(value.anchor),
      (value.anchor.scope === 'artifact' ? (value.anchor as {artifactId: string}).artifactId : null) ?? null,
      (value.anchor.scope === 'artifact_view' ? (value.anchor as {artifactViewId: string}).artifactViewId : null) ?? null,
      (value.anchor.scope === 'page' ? (value.anchor as {pageIndex: number}).pageIndex : null) ?? null,
      value.body, value.createdAt, value.updatedAt)
  }

  #upsertCheckpoint(value: Checkpoint): void {
    this.#database.prepare(`
      INSERT INTO checkpoints VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run(value.id as SQLInputValue, value.projectId as SQLInputValue, value.scopeId as SQLInputValue, value.label, JSON.stringify(value.snapshotJson), value.createdAt)
  }

  // ==================== Row → Entity ====================

  #project(row: Row): Project {
    return { id: row.id as ProjectId, name: String(row.name), rootPath: String(row.root_path), graphVersion: (row.graph_version as number) as GraphVersion, createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
  }

  #scope(row: Row): Scope {
    return { id: row.id as ScopeId, projectId: row.project_id as ProjectId, parentScopeId: (row.parent_scope_id ?? null) as ScopeId | null, containerViewId: (row.container_view_id ?? null) as ArtifactViewId | null, kind: String(row.kind) as Scope['kind'], name: String(row.name), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
  }

  #workspace(row: Row): Workspace {
    const id = row.id as WorkspaceId
    const projectId = row.project_id as ProjectId
    const scopeId = (row.scope_id as SQLInputValue) as unknown as ScopeId
    const name = String(row.name)
    const intent = row.intent ? String(row.intent) as Workspace['intent'] : null
    const viewport = json<Workspace['viewport']>(row.viewport as SQLInputValue)
    const focusedNodeIds = json<string[]>((row.focused_node_ids ?? '[]') as SQLInputValue)
    const visibleLayers = json<string[]>((row.visible_layers ?? '["core","process"]') as SQLInputValue)
    const contextPolicy = (String(row.context_policy ?? 'selection-only')) as Workspace['contextPolicy']
    const updatedAt = String(row.updated_at)
    return { id, projectId, scopeId, name, intent, viewport, focusedNodeIds, visibleLayers, contextPolicy, updatedAt }
  }

  #artifact(row: Row): Artifact {
    return { id: row.id as ArtifactId, projectId: row.project_id as ProjectId, title: String(row.title), kind: String(row.kind) as Artifact['kind'], localPath: String(row.local_path), availability: String(row.availability) as Artifact['availability'], ...(row.current_revision_id === null || row.current_revision_id === undefined ? {} : { currentRevisionId: row.current_revision_id as ArtifactRevisionId }), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
  }

  #artifactView(row: Row): ArtifactView {
    return { id: row.id as ArtifactViewId, artifactId: row.artifact_id as ArtifactId, scopeId: (row.scope_id ?? '') as unknown as ScopeId, ...(row.revision_id ? { revisionId: row.revision_id as ArtifactRevisionId } : {}), referenceKind: String(row.reference_kind) as ArtifactView['referenceKind'], position: json<ArtifactView['position']>(row.position as SQLInputValue), size: json<ArtifactView['size']>(row.size as SQLInputValue), displayMode: String(row.display_mode) as ArtifactView['displayMode'], collapsed: (row.collapsed as number) === 1 } as ArtifactView
  }

  #relation(row: Row): Relation {
    return { id: row.id as RelationId, projectId: row.project_id as ProjectId, sourceEntityType: String(row.source_entity_type) as Relation['sourceEntityType'], sourceEntityId: String(row.source_entity_id), targetEntityType: String(row.target_entity_type) as Relation['targetEntityType'], targetEntityId: String(row.target_entity_id), kind: String(row.kind), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
  }

  #artifactRevision(row: Row): ArtifactRevision {
    return { id: row.id as ArtifactRevisionId, artifactId: row.artifact_id as ArtifactId, localPath: String(row.local_path), contentHash: String(row.content_hash) as ArtifactRevision['contentHash'], source: String(row.source) as ArtifactRevision['source'], status: String(row.status) as ArtifactRevision['status'], createdAt: String(row.created_at), ...(row.parent_revision_id ? { parentRevisionId: row.parent_revision_id as ArtifactRevisionId } : {}), ...(row.run_id ? { runId: row.run_id as ArtifactRevision['runId'] } : {}) } as ArtifactRevision
  }

  #note(row: Row): Note {
    const anchorScope = String(row.anchor_scope)
    let anchor: Note['anchor']
    if (anchorScope === 'artifact_view') {
      anchor = { scope: 'artifact_view', artifactId: row.artifact_id as ArtifactId, artifactViewId: row.artifact_view_id as ArtifactViewId }
    } else if (anchorScope === 'page') {
      anchor = { scope: 'page', artifactId: row.artifact_id as ArtifactId, pageIndex: (row.page_index as number) ?? 0 }
    } else {
      anchor = { scope: 'artifact', artifactId: (row.artifact_id ?? '') as ArtifactId }
    }
    return { id: row.id as NoteId, projectId: row.project_id as ProjectId, anchor, body: String(row.body), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
  }

  #checkpoint(row: Row): Checkpoint {
    return { id: row.id as CheckpointId, projectId: row.project_id as ProjectId, scopeId: (row.scope_id ?? '') as unknown as ScopeId, label: String(row.label ?? ''), snapshotJson: json<Checkpoint['snapshotJson']>(row.snapshot_json as SQLInputValue), createdAt: String(row.created_at) }
  }
}
