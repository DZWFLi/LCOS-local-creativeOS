import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

import type {
  Artifact,
  ArtifactRevision,
  ArtifactView,
  Checkpoint,
  Note,
  Project,
  ProjectGraphSnapshot,
  Relation,
  Workspace,
} from '@local-creative-os/contracts'

const SCHEMA_VERSION = 2

type Row = Record<string, unknown>

function json<T>(value: unknown): T {
  return JSON.parse(String(value)) as T
}

export interface MetadataRepositoryOptions {
  /** When true, only projects with 'disposable-' prefix are writable (Phase 2 default). */
  readonly disposableOnly?: boolean
}

export class SqliteMetadataRepository {
  readonly databasePath: string
  readonly #database: DatabaseSync
  readonly #disposableOnly: boolean

  constructor(databasePath: string, options: MetadataRepositoryOptions = {}) {
    this.databasePath = resolve(databasePath)
    this.#disposableOnly = options.disposableOnly ?? true
    mkdirSync(dirname(this.databasePath), { recursive: true })
    this.#database = new DatabaseSync(this.databasePath)
    this.#database.exec('PRAGMA foreign_keys = ON;')
    this.#migrate()
  }

  get schemaVersion(): number {
    return Number((this.#database.prepare('PRAGMA user_version').get() as Row).user_version)
  }

  close(): void {
    this.#database.close()
  }

  // ==================== snapshot save/get ====================

  save(snapshot: ProjectGraphSnapshot): void {
    if (snapshot.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`Expected schemaVersion ${SCHEMA_VERSION}.`)
    }
    if (this.#disposableOnly) {
      if (!String(snapshot.project.id).startsWith('disposable-')) {
        throw new Error('Only disposable projects are accepted. Disable disposableOnly to allow real projects.')
      }
      if (!snapshot.project.rootPath.startsWith('disposable://')) {
        throw new Error('Disposable projects must use a disposable:// root.')
      }
    }
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      this.#upsertProject(snapshot.project)
      // Clear existing children in dependency order
      this.#database.prepare('DELETE FROM checkpoints WHERE project_id = ?').run(snapshot.project.id)
      this.#database.prepare('DELETE FROM notes WHERE project_id = ?').run(snapshot.project.id)
      this.#database.prepare('DELETE FROM artifact_revisions WHERE artifact_id IN (SELECT id FROM artifacts WHERE project_id = ?)').run(snapshot.project.id)
      this.#database.prepare('DELETE FROM relations WHERE project_id = ?').run(snapshot.project.id)
      this.#database.prepare('DELETE FROM artifact_views WHERE project_id = ?').run(snapshot.project.id)
      this.#database.prepare('DELETE FROM artifacts WHERE project_id = ?').run(snapshot.project.id)
      this.#database.prepare('DELETE FROM workspaces WHERE project_id = ?').run(snapshot.project.id)
      // Re-insert all
      for (const workspace of snapshot.workspaces) this.#upsertWorkspace(workspace)
      for (const artifact of snapshot.artifacts) this.#upsertArtifact(artifact)
      for (const view of snapshot.artifactViews) this.#upsertArtifactView(view, snapshot.project.id)
      for (const relation of snapshot.relations) this.#upsertRelation(relation)
      for (const revision of snapshot.artifactRevisions ?? []) this.#upsertArtifactRevision(revision)
      for (const note of snapshot.notes ?? []) this.#upsertNote(note)
      for (const checkpoint of snapshot.checkpoints ?? []) this.#upsertCheckpoint(checkpoint)
      this.#database.exec('COMMIT;')
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('FOREIGN KEY')) {
        // Log FK detail to help diagnose which constraint failed
        process.stderr.write(`[FK] save() failed for project=${String(snapshot.project.id)}. ` +
          `workspaces=${snapshot.workspaces.length} artifacts=${snapshot.artifacts.length} ` +
          `views=${snapshot.artifactViews.length} relatives=${snapshot.relations.length} ` +
          `checkpoints=${(snapshot.checkpoints ?? []).length}. ` +
          `activeWorkspaceId from checkpoint context not available in inner scope.n`)
      }
      throw error
    }
  }

  get(projectId: string): ProjectGraphSnapshot | undefined {
    const projectRow = this.#database.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Row | undefined
    if (projectRow === undefined) return undefined
    const rows = (sql: string, ...params: SQLInputValue[]): Row[] =>
      (this.#database.prepare(sql).all(...params) as Row[])
    return {
      schemaVersion: this.schemaVersion,
      project: this.#project(projectRow),
      workspaces: rows('SELECT * FROM workspaces WHERE project_id = ? ORDER BY id', projectId).map((r) => this.#workspace(r)),
      artifacts: rows('SELECT * FROM artifacts WHERE project_id = ? ORDER BY id', projectId).map((r) => this.#artifact(r)),
      artifactViews: rows('SELECT * FROM artifact_views WHERE project_id = ? ORDER BY id', projectId).map((r) => this.#artifactView(r)),
      relations: rows('SELECT * FROM relations WHERE project_id = ? ORDER BY id', projectId).map((r) => this.#relation(r)),
      notes: rows('SELECT * FROM notes WHERE project_id = ? ORDER BY created_at', projectId).map((r) => this.#note(r)),
      artifactRevisions: rows('SELECT ar.* FROM artifact_revisions ar JOIN artifacts a ON a.id = ar.artifact_id WHERE a.project_id = ? ORDER BY ar.created_at', projectId).map((r) => this.#artifactRevision(r)),
      checkpoints: rows('SELECT * FROM checkpoints WHERE project_id = ? ORDER BY created_at', projectId).map((r) => this.#checkpoint(r)),
    }
  }

  listProjects(): readonly Project[] {
    return (this.#database.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as Row[])
      .map((row) => this.#project(row))
  }

  // ==================== individual CRUD ====================

  // -- Project --

  getProject(projectId: string): Project | undefined {
    const row = this.#database.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Row | undefined
    return row === undefined ? undefined : this.#project(row)
  }

  createProject(project: Project): void {
    if (this.#disposableOnly) {
      if (!String(project.id).startsWith('disposable-')) throw new Error('Only disposable projects are accepted.')
      if (!project.rootPath.startsWith('disposable://')) throw new Error('Disposable projects must use a disposable:// root.')
    }
    this.#upsertProject(project)
  }

  // -- Workspace --

  getWorkspace(workspaceId: string): Workspace | undefined {
    const row = this.#database.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId) as Row | undefined
    return row === undefined ? undefined : this.#workspace(row)
  }

  getWorkspaces(projectId: string): readonly Workspace[] {
    return (this.#database.prepare('SELECT * FROM workspaces WHERE project_id = ? ORDER BY id').all(projectId) as Row[])
      .map((r) => this.#workspace(r))
  }

  upsertWorkspace(workspace: Workspace): void {
    this.#upsertWorkspace(workspace)
  }

  // -- Artifact --

  getArtifact(artifactId: string): Artifact | undefined {
    const row = this.#database.prepare('SELECT * FROM artifacts WHERE id = ?').get(artifactId) as Row | undefined
    return row === undefined ? undefined : this.#artifact(row)
  }

  getArtifacts(projectId: string): readonly Artifact[] {
    return (this.#database.prepare('SELECT * FROM artifacts WHERE project_id = ? ORDER BY id').all(projectId) as Row[])
      .map((r) => this.#artifact(r))
  }

  upsertArtifact(artifact: Artifact): void {
    this.#upsertArtifact(artifact)
  }

  // -- ArtifactView --

  getArtifactView(viewId: string): ArtifactView | undefined {
    const row = this.#database.prepare('SELECT * FROM artifact_views WHERE id = ?').get(viewId) as Row | undefined
    return row === undefined ? undefined : this.#artifactView(row)
  }

  getArtifactViews(projectId: string): readonly ArtifactView[] {
    return (this.#database.prepare('SELECT * FROM artifact_views WHERE project_id = ? ORDER BY id').all(projectId) as Row[])
      .map((r) => this.#artifactView(r))
  }

  upsertArtifactView(view: ArtifactView, projectId: string): void {
    this.#upsertArtifactView(view, projectId)
  }

  deleteArtifactView(viewId: string): void {
    this.#database.prepare('DELETE FROM relations WHERE source_view_id = ? OR target_view_id = ?').run(viewId, viewId)
    this.#database.prepare('DELETE FROM artifact_views WHERE id = ?').run(viewId)
  }

  // -- Relation --

  getRelation(relationId: string): Relation | undefined {
    const row = this.#database.prepare('SELECT * FROM relations WHERE id = ?').get(relationId) as Row | undefined
    return row === undefined ? undefined : this.#relation(row)
  }

  getRelations(projectId: string): readonly Relation[] {
    return (this.#database.prepare('SELECT * FROM relations WHERE project_id = ? ORDER BY id').all(projectId) as Row[])
      .map((r) => this.#relation(r))
  }

  upsertRelation(relation: Relation): void {
    this.#upsertRelation(relation)
  }

  deleteRelation(relationId: string): void {
    this.#database.prepare('DELETE FROM relations WHERE id = ?').run(relationId)
  }

  // -- Note --

  getNote(noteId: string): Note | undefined {
    const row = this.#database.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as Row | undefined
    return row === undefined ? undefined : this.#note(row)
  }

  getNotes(projectId: string): readonly Note[] {
    return (this.#database.prepare('SELECT * FROM notes WHERE project_id = ? ORDER BY created_at').all(projectId) as Row[])
      .map((r) => this.#note(r))
  }

  upsertNote(note: Note): void {
    this.#upsertNote(note)
  }

  deleteNote(noteId: string): void {
    this.#database.prepare('DELETE FROM notes WHERE id = ?').run(noteId)
  }

  // -- ArtifactRevision --

  getArtifactRevision(revisionId: string): ArtifactRevision | undefined {
    const row = this.#database.prepare('SELECT * FROM artifact_revisions WHERE id = ?').get(revisionId) as Row | undefined
    return row === undefined ? undefined : this.#artifactRevision(row)
  }

  getArtifactRevisions(artifactId: string): readonly ArtifactRevision[] {
    return (this.#database.prepare('SELECT * FROM artifact_revisions WHERE artifact_id = ? ORDER BY created_at').all(artifactId) as Row[])
      .map((r) => this.#artifactRevision(r))
  }

  upsertArtifactRevision(revision: ArtifactRevision): void {
    this.#upsertArtifactRevision(revision)
  }

  // -- Checkpoint --

  getCheckpoint(checkpointId: string): Checkpoint | undefined {
    const row = this.#database.prepare('SELECT * FROM checkpoints WHERE id = ?').get(checkpointId) as Row | undefined
    return row === undefined ? undefined : this.#checkpoint(row)
  }

  getCheckpoints(projectId: string): readonly Checkpoint[] {
    return (this.#database.prepare('SELECT * FROM checkpoints WHERE project_id = ? ORDER BY created_at').all(projectId) as Row[])
      .map((r) => this.#checkpoint(r))
  }

  upsertCheckpoint(checkpoint: Checkpoint): void {
    this.#upsertCheckpoint(checkpoint)
  }

  // ==================== migration ====================

  #migrate(): void {
    let version = this.schemaVersion
    if (version > SCHEMA_VERSION) throw new Error(`Unsupported schemaVersion ${version}.`)

    if (version === 0) {
      this.#database.exec(`
        BEGIN;
        CREATE TABLE projects (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, root_path TEXT NOT NULL,
          created_at TEXT NOT NULL, updated_at TEXT NOT NULL
        );
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
      version = 1
    }

    if (version === 1) {
      this.#database.exec(`
        BEGIN;
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
          workspace_id TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
          snapshot_json TEXT NOT NULL, created_at TEXT NOT NULL
        );
        PRAGMA user_version = 2;
        COMMIT;
      `)
    }
  }

  // ==================== upsert helpers ====================

  #upsertProject(value: Project): void {
    this.#database.prepare(`
      INSERT INTO projects VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, root_path=excluded.root_path, updated_at=excluded.updated_at
    `).run(value.id, value.name, value.rootPath, value.createdAt, value.updatedAt)
  }

  #upsertWorkspace(value: Workspace): void {
    this.#database.prepare(`
      INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, intent=excluded.intent,
      camera_x=excluded.camera_x, camera_y=excluded.camera_y, camera_zoom=excluded.camera_zoom,
      focused_node_ids=excluded.focused_node_ids, visible_layers=excluded.visible_layers,
      layout_preset=excluded.layout_preset, context_policy=excluded.context_policy,
      selection_state=excluded.selection_state, updated_at=excluded.updated_at
    `).run(
      value.id, value.projectId, value.name, value.intent,
      value.viewport.x, value.viewport.y, value.viewport.zoom,
      JSON.stringify(value.focusedNodeIds), JSON.stringify(value.visibleLayers),
      value.layoutPreset ?? null,
      value.contextPolicy === undefined ? null : JSON.stringify(value.contextPolicy),
      value.selectionState === undefined ? null : JSON.stringify(value.selectionState),
      value.updatedAt,
    )
  }

  #upsertArtifact(value: Artifact): void {
    this.#database.prepare(`
      INSERT INTO artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, kind=excluded.kind,
      local_path=excluded.local_path, availability=excluded.availability, updated_at=excluded.updated_at
    `).run(
      value.id, value.projectId, value.title, value.kind, value.localPath,
      value.availability, value.currentRevisionId ?? null, value.createdAt, value.updatedAt,
    )
  }

  #upsertArtifactView(value: ArtifactView, projectId: string): void {
    this.#database.prepare(`
      INSERT INTO artifact_views VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET position_x=excluded.position_x, position_y=excluded.position_y,
      width=excluded.width, height=excluded.height, display_mode=excluded.display_mode, collapsed=excluded.collapsed
    `).run(
      value.id, projectId, value.artifactId, value.workspaceId, value.revisionId ?? null,
      value.referenceKind, value.position.x, value.position.y, value.size.width, value.size.height,
      value.displayMode, value.collapsed ? 1 : 0,
    )
  }

  #upsertRelation(value: Relation): void {
    this.#database.prepare(`
      INSERT INTO relations VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, updated_at=excluded.updated_at
    `).run(
      value.id, value.projectId, value.workspaceId, value.sourceArtifactViewId,
      value.targetArtifactViewId, value.kind, value.createdAt, value.updatedAt,
    )
  }

  #upsertNote(value: Note): void {
    const anchor = value.anchor as { scope: string; artifactId?: string; artifactViewId?: string; pageIndex?: number }
    this.#database.prepare(`
      INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET body=excluded.body, updated_at=excluded.updated_at
    `).run(
      value.id, value.projectId, anchor.scope,
      anchor.artifactId ?? null, anchor.artifactViewId ?? null,
      anchor.pageIndex ?? null,
      value.body, value.createdAt, value.updatedAt,
    )
  }

  #upsertArtifactRevision(value: ArtifactRevision): void {
    this.#database.prepare(`
      INSERT INTO artifact_revisions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status
    `).run(
      value.id, value.artifactId, value.parentRevisionId ?? null,
      value.localPath, value.contentHash, value.source,
      value.runId ?? null, value.status, value.createdAt,
    )
  }

  #upsertCheckpoint(value: Checkpoint): void {
    const snapshot = JSON.stringify(value.canvasSnapshot)
    this.#database.prepare(`
      INSERT INTO checkpoints VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET snapshot_json=excluded.snapshot_json
    `).run(
      value.id, value.projectId, value.workspaceId,
      '',
      snapshot, value.createdAt,
    )
  }

  // ==================== row mappers ====================

  #project(row: Row): Project {
    return { id: row.id as Project['id'], name: String(row.name), rootPath: String(row.root_path), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
  }

  #workspace(row: Row): Workspace {
    return {
      id: row.id as Workspace['id'], projectId: row.project_id as Workspace['projectId'],
      name: String(row.name), intent: row.intent as Workspace['intent'],
      viewport: { x: Number(row.camera_x), y: Number(row.camera_y), zoom: Number(row.camera_zoom) },
      focusedNodeIds: json<readonly string[]>(row.focused_node_ids),
      visibleLayers: json<readonly string[]>(row.visible_layers),
      ...(row.layout_preset === null ? {} : { layoutPreset: String(row.layout_preset) }),
      ...(row.context_policy === null ? {} : { contextPolicy: json<NonNullable<Workspace['contextPolicy']>>(row.context_policy) }),
      ...(row.selection_state === null ? {} : { selectionState: json<NonNullable<Workspace['selectionState']>>(row.selection_state) }),
      updatedAt: String(row.updated_at),
    }
  }

  #artifact(row: Row): Artifact {
    return {
      id: row.id as Artifact['id'], projectId: row.project_id as Artifact['projectId'],
      title: String(row.title), kind: row.kind as Artifact['kind'], localPath: String(row.local_path),
      availability: row.availability as Artifact['availability'],
      ...(row.current_revision_id === null ? {} : { currentRevisionId: row.current_revision_id as NonNullable<Artifact['currentRevisionId']> }),
      createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    }
  }

  #artifactView(row: Row): ArtifactView {
    return {
      id: row.id as ArtifactView['id'], artifactId: row.artifact_id as ArtifactView['artifactId'],
      workspaceId: row.workspace_id as ArtifactView['workspaceId'],
      ...(row.revision_id === null ? {} : { revisionId: row.revision_id as NonNullable<ArtifactView['revisionId']> }),
      referenceKind: row.reference_kind as ArtifactView['referenceKind'],
      position: { x: Number(row.position_x), y: Number(row.position_y) },
      size: { width: Number(row.width), height: Number(row.height) },
      displayMode: row.display_mode as ArtifactView['displayMode'], collapsed: Number(row.collapsed) === 1,
    }
  }

  #relation(row: Row): Relation {
    return {
      id: row.id as Relation['id'], projectId: row.project_id as Relation['projectId'],
      workspaceId: row.workspace_id as Relation['workspaceId'],
      sourceArtifactViewId: row.source_view_id as Relation['sourceArtifactViewId'],
      targetArtifactViewId: row.target_view_id as Relation['targetArtifactViewId'],
      kind: String(row.kind), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    }
  }

  #note(row: Row): Note {
    const scope = String(row.anchor_scope)
    const base = { scope: scope as Note['anchor']['scope'], artifactId: row.artifact_id as string | undefined } as Note['anchor']
    if (scope === 'artifact_view') {
      ;(base as { scope: 'artifact_view'; artifactId: string; artifactViewId: string }).artifactViewId = String(row.artifact_view_id)
    }
    if (scope === 'page' && row.page_index !== null) {
      ;(base as { scope: 'page'; artifactId: string; pageIndex: number }).pageIndex = Number(row.page_index)
    }
    return {
      id: row.id as Note['id'], projectId: row.project_id as Note['projectId'],
      anchor: base, body: String(row.body),
      createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    }
  }

  #artifactRevision(row: Row): ArtifactRevision {
    return {
      id: row.id as ArtifactRevision['id'], artifactId: row.artifact_id as ArtifactRevision['artifactId'],
      ...(row.parent_revision_id === null ? {} : { parentRevisionId: row.parent_revision_id as NonNullable<ArtifactRevision['parentRevisionId']> }),
      localPath: String(row.local_path), contentHash: row.content_hash as ArtifactRevision['contentHash'],
      source: row.source as ArtifactRevision['source'],
      ...(row.run_id === null ? {} : { runId: row.run_id as NonNullable<ArtifactRevision['runId']> }),
      status: row.status as ArtifactRevision['status'], createdAt: String(row.created_at),
    }
  }

  #checkpoint(row: Row): Checkpoint {
    return {
      id: row.id as Checkpoint['id'], projectId: row.project_id as Checkpoint['projectId'],
      workspaceId: row.workspace_id as Checkpoint['workspaceId'],
      artifactRevisionIds: [],
      relatedRunIds: [],
      canvasSnapshot: json<Checkpoint['canvasSnapshot']>(row.snapshot_json),
      createdAt: String(row.created_at),
    }
  }
}

export { SCHEMA_VERSION }
