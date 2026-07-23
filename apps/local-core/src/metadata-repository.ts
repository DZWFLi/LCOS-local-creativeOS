import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import type {
  Artifact,
  ArtifactView,
  Project,
  ProjectGraphSnapshot,
  Relation,
  Workspace,
} from '@local-creative-os/contracts'

const SCHEMA_VERSION = 1

type Row = Record<string, unknown>

function json<T>(value: unknown): T {
  return JSON.parse(String(value)) as T
}

export class SqliteMetadataRepository {
  readonly databasePath: string
  readonly #database: DatabaseSync

  constructor(databasePath: string) {
    this.databasePath = resolve(databasePath)
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

  save(snapshot: ProjectGraphSnapshot): void {
    if (snapshot.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`Expected schemaVersion ${SCHEMA_VERSION}.`)
    }
    if (!String(snapshot.project.id).startsWith('disposable-')) {
      throw new Error('Phase 2 Lite only accepts disposable projects.')
    }
    if (!snapshot.project.rootPath.startsWith('disposable://')) {
      throw new Error('Phase 2 Lite disposable projects must use a disposable:// root.')
    }
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      this.#upsertProject(snapshot.project)
      this.#database.prepare('DELETE FROM relations WHERE project_id = ?').run(snapshot.project.id)
      this.#database.prepare('DELETE FROM artifact_views WHERE project_id = ?').run(snapshot.project.id)
      this.#database.prepare('DELETE FROM artifacts WHERE project_id = ?').run(snapshot.project.id)
      this.#database.prepare('DELETE FROM workspaces WHERE project_id = ?').run(snapshot.project.id)
      for (const workspace of snapshot.workspaces) this.#upsertWorkspace(workspace)
      for (const artifact of snapshot.artifacts) this.#upsertArtifact(artifact)
      for (const view of snapshot.artifactViews) this.#upsertArtifactView(view, snapshot.project.id)
      for (const relation of snapshot.relations) this.#upsertRelation(relation)
      this.#database.exec('COMMIT;')
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
  }

  get(projectId: string): ProjectGraphSnapshot | undefined {
    const projectRow = this.#database.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Row | undefined
    if (projectRow === undefined) return undefined
    const rows = (sql: string): Row[] => this.#database.prepare(sql).all(projectId) as Row[]
    return {
      schemaVersion: this.schemaVersion,
      project: this.#project(projectRow),
      workspaces: rows('SELECT * FROM workspaces WHERE project_id = ? ORDER BY id').map((row) => this.#workspace(row)),
      artifacts: rows('SELECT * FROM artifacts WHERE project_id = ? ORDER BY id').map((row) => this.#artifact(row)),
      artifactViews: rows('SELECT * FROM artifact_views WHERE project_id = ? ORDER BY id').map((row) => this.#artifactView(row)),
      relations: rows('SELECT * FROM relations WHERE project_id = ? ORDER BY id').map((row) => this.#relation(row)),
    }
  }

  listProjects(): readonly Project[] {
    return (this.#database.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as Row[])
      .map((row) => this.#project(row))
  }

  deleteArtifactView(viewId: string): void {
    this.#database.prepare('DELETE FROM artifact_views WHERE id = ?').run(viewId)
  }

  #migrate(): void {
    const version = this.schemaVersion
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
    }
  }

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
}

export { SCHEMA_VERSION }
