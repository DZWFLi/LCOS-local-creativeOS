import { mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'

import type {
  Artifact,
  ArtifactId,
  ArtifactReturn,
  ArtifactReturnId,
  ArtifactRevision,
  ArtifactRevisionId,
  ArtifactView,
  ArtifactViewId,
  Checkpoint,
  CheckpointId,
  FileRecord,
  FileRecordId,
  GraphVersion,
  Run,
  RunId,
  RuntimeBinding,
  RuntimeDispatch,
  Note,
  NoteId,
  Project,
  ProjectId,
  PreviewRecord,
  PreviewRecordId,
  Relation,
  RelationId,
  Scope,
  ScopeId,
  Workspace,
  WorkspaceId,
} from '@local-creative-os/domain'
import type {
  AcceptArtifactReturnResult,
  MutationBatch,
  PersistedContextManifestV0,
  ProjectGraphSnapshot,
  RejectArtifactReturnResult,
  RetryRunResult,
} from '@local-creative-os/contracts'

type Row = Record<string, SQLInputValue | undefined>
type ForeignKeyCheckRow = {
  readonly table: string
  readonly rowid: number
  readonly parent: string
  readonly fkid: number
}

export interface MetadataForeignKeyContext {
  readonly operationType: string
  readonly entityId: string
  readonly table: string
  readonly statement: string
  readonly foreignKeyColumn: string
  readonly referencedTable: string
  readonly referencedId: string
  readonly foreignKeyCheck: readonly ForeignKeyCheckRow[]
}

export class MetadataForeignKeyConstraintError extends Error {
  readonly context: MetadataForeignKeyContext

  constructor(context: MetadataForeignKeyContext, cause?: unknown) {
    super(`${context.operationType} ${context.entityId} violates ${context.table}.${context.foreignKeyColumn} -> ${context.referencedTable}.id (${context.referencedId})`)
    this.name = 'MetadataForeignKeyConstraintError'
    this.context = context
    this.cause = cause
  }
}

function json<T>(value: SQLInputValue): T {
  if (typeof value !== 'string') return JSON.parse('null') as unknown as T
  try { return JSON.parse(value) as T } catch { return JSON.parse('null') as unknown as T }
}

export class RuntimeLifecycleConflictError extends Error {
  readonly code = 'RUNTIME_LIFECYCLE_CONFLICT'
}

const FORBIDDEN_MANIFEST_KEYS = new Set([
  'provider',
  'bridgeTaskId',
  'externalTaskId',
  'externalSessionId',
  'runtimeRoot',
  'stagingPath',
  'mcpUrl',
])

function assertCanonicalManifest(manifest: PersistedContextManifestV0): void {
  if (manifest.schemaVersion !== 0) throw new Error('ContextManifest schemaVersion must be 0.')
  const expectedHash = createHash('sha256').update(manifest.canonicalJson, 'utf8').digest('hex')
  if (manifest.manifestHash !== expectedHash) throw new Error('ContextManifest hash does not match canonical JSON.')
  let parsed: unknown
  try { parsed = JSON.parse(manifest.canonicalJson) } catch { throw new Error('ContextManifest canonical JSON is invalid.') }
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      if (/^[A-Za-z]:[\\/]/.test(value) || value.startsWith('/') || value.startsWith('\\\\')) {
        throw new Error('ContextManifest cannot contain absolute paths.')
      }
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }
    if (typeof value !== 'object' || value === null) return
    for (const [key, nested] of Object.entries(value)) {
      if (FORBIDDEN_MANIFEST_KEYS.has(key)) throw new Error(`ContextManifest cannot contain ${key}.`)
      visit(nested)
    }
  }
  visit(parsed)
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

  foreignKeyCheck(): readonly ForeignKeyCheckRow[] {
    return (this.#database.prepare('PRAGMA foreign_key_check').all() as Row[]).map((row) => ({
      table: String(row.table),
      rowid: Number(row.rowid),
      parent: String(row.parent),
      fkid: Number(row.fkid),
    }))
  }

  // ==================== Migration ====================

  #migrate(): void {
    const version = this.#database.prepare('PRAGMA user_version').get() as { user_version: number }
    if (version.user_version === 0) { this.#migrate_001(); return }
    if (version.user_version === 1) { this.#migrate_002_from_v1(); this.#migrate_004_from_v3(); this.#migrate_005_from_v4(); this.#migrate_006_from_v5(); return }
    if (version.user_version === 2) { this.#migrate_003_from_v2(); this.#migrate_004_from_v3(); this.#migrate_005_from_v4(); this.#migrate_006_from_v5(); return }
    if (version.user_version === 3) { this.#migrate_004_from_v3(); this.#migrate_005_from_v4(); this.#migrate_006_from_v5(); return }
    if (version.user_version === 4) { this.#migrate_005_from_v4(); this.#migrate_006_from_v5(); return }
    if (version.user_version === 5) { this.#migrate_006_from_v5(); return }
    // v6 = current
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
        file_record_id TEXT NOT NULL REFERENCES file_records(id) ON DELETE RESTRICT,
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
      CREATE TABLE file_records (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        observed_path TEXT NOT NULL, observed_hash TEXT NOT NULL,
        size INTEGER NOT NULL, modified_at TEXT NOT NULL, mime_type TEXT NOT NULL,
        availability TEXT NOT NULL, observed_at TEXT NOT NULL
      );
      CREATE TABLE preview_records (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        revision_id TEXT NOT NULL REFERENCES artifact_revisions(id) ON DELETE CASCADE,
        source_content_hash TEXT NOT NULL, renderer_id TEXT NOT NULL, renderer_version TEXT NOT NULL,
        preview_profile TEXT NOT NULL, cache_key TEXT NOT NULL UNIQUE, cache_path TEXT NOT NULL,
        mime_type TEXT NOT NULL, size INTEGER NOT NULL, status TEXT NOT NULL,
        error_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE context_manifests (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        schema_version INTEGER NOT NULL CHECK (schema_version = 0),
        target_artifact_id TEXT REFERENCES artifacts(id) ON DELETE RESTRICT,
        target_revision_id TEXT REFERENCES artifact_revisions(id) ON DELETE RESTRICT,
        canonical_json TEXT NOT NULL,
        manifest_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(project_id, manifest_hash)
      );
      CREATE TABLE runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
        target_artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
        target_revision_id TEXT NOT NULL REFERENCES artifact_revisions(id) ON DELETE RESTRICT,
        context_manifest_id TEXT NOT NULL REFERENCES context_manifests(id) ON DELETE RESTRICT,
        retry_of_run_id TEXT REFERENCES runs(id) ON DELETE RESTRICT,
        provider TEXT NOT NULL CHECK (provider = 'workbuddy'),
        status TEXT NOT NULL CHECK (status IN ('created','queued','running','waiting_input','completed','failed','cancelled')),
        instruction TEXT NOT NULL,
        result_summary TEXT,
        short_summary TEXT,
        error_code TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE TABLE runtime_dispatches (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL UNIQUE REFERENCES runs(id) ON DELETE CASCADE,
        provider TEXT NOT NULL CHECK (provider = 'workbuddy'),
        idempotency_key TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('planned','dispatching','bound','failed','recovery_required')),
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
        last_error_code TEXT,
        last_error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE runtime_bindings (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL UNIQUE REFERENCES runs(id) ON DELETE CASCADE,
        provider TEXT NOT NULL CHECK (provider = 'workbuddy'),
        external_task_id TEXT,
        external_session_id TEXT,
        provider_status TEXT,
        last_synced_at TEXT,
        finalize_pending INTEGER NOT NULL DEFAULT 0 CHECK (finalize_pending IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(provider, external_task_id)
      );
      CREATE TABLE artifact_returns (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        target_artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
        base_revision_id TEXT NOT NULL REFERENCES artifact_revisions(id) ON DELETE RESTRICT,
        returned_file_id TEXT NOT NULL REFERENCES file_records(id) ON DELETE RESTRICT,
        content_hash TEXT NOT NULL,
        canonical_path TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action = 'created'),
        status TEXT NOT NULL CHECK (status IN ('pending_review','adopted','rejected')),
        draft_revision_id TEXT REFERENCES artifact_revisions(id) ON DELETE RESTRICT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(run_id, canonical_path, content_hash, action)
      );
      CREATE INDEX idx_runs_project_status ON runs(project_id, status);
      CREATE INDEX idx_runtime_dispatches_status ON runtime_dispatches(status);
      CREATE INDEX idx_runtime_bindings_provider_status ON runtime_bindings(provider, provider_status);
      PRAGMA user_version = 6;
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

  #migrate_004_from_v3(): void {
    const backup = this.databasePath + '.v3.bak'
    this.#database.exec(`VACUUM INTO '${backup.replace(/\\/g, '\\\\')}'`)
    this.#database.exec(`
      BEGIN;
      CREATE TABLE file_records (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        observed_path TEXT NOT NULL, observed_hash TEXT NOT NULL,
        size INTEGER NOT NULL, modified_at TEXT NOT NULL, mime_type TEXT NOT NULL,
        availability TEXT NOT NULL, observed_at TEXT NOT NULL
      );
      ALTER TABLE artifact_revisions ADD COLUMN file_record_id TEXT REFERENCES file_records(id) ON DELETE RESTRICT;
      INSERT INTO file_records (
        id, project_id, observed_path, observed_hash, size,
        modified_at, mime_type, availability, observed_at
      )
      SELECT
        'migrated-' || r.id, a.project_id, r.local_path, r.content_hash, 0,
        r.created_at, 'application/octet-stream', 'unreadable', r.created_at
      FROM artifact_revisions r
      JOIN artifacts a ON a.id = r.artifact_id;
      UPDATE artifact_revisions SET file_record_id = 'migrated-' || id WHERE file_record_id IS NULL;
      PRAGMA user_version = 4;
      COMMIT;
    `)
  }

  #migrate_005_from_v4(): void {
    this.#database.exec(`
      BEGIN;
      CREATE TABLE IF NOT EXISTS preview_records (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        revision_id TEXT NOT NULL REFERENCES artifact_revisions(id) ON DELETE CASCADE,
        source_content_hash TEXT NOT NULL, renderer_id TEXT NOT NULL, renderer_version TEXT NOT NULL,
        preview_profile TEXT NOT NULL, cache_key TEXT NOT NULL UNIQUE, cache_path TEXT NOT NULL,
        mime_type TEXT NOT NULL, size INTEGER NOT NULL, status TEXT NOT NULL,
        error_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      PRAGMA user_version = 5;
      COMMIT;
    `)
  }

  #migrate_006_from_v5(): void {
    const backup = this.databasePath + '.v5.bak'
    this.#database.exec(`VACUUM INTO '${backup.replace(/\\/g, '\\\\')}'`)
    this.#database.exec(`
      BEGIN;
      CREATE TABLE context_manifests (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        schema_version INTEGER NOT NULL CHECK (schema_version = 0),
        target_artifact_id TEXT REFERENCES artifacts(id) ON DELETE RESTRICT,
        target_revision_id TEXT REFERENCES artifact_revisions(id) ON DELETE RESTRICT,
        canonical_json TEXT NOT NULL,
        manifest_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(project_id, manifest_hash)
      );
      CREATE TABLE runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
        target_artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
        target_revision_id TEXT NOT NULL REFERENCES artifact_revisions(id) ON DELETE RESTRICT,
        context_manifest_id TEXT NOT NULL REFERENCES context_manifests(id) ON DELETE RESTRICT,
        retry_of_run_id TEXT REFERENCES runs(id) ON DELETE RESTRICT,
        provider TEXT NOT NULL CHECK (provider = 'workbuddy'),
        status TEXT NOT NULL CHECK (status IN ('created','queued','running','waiting_input','completed','failed','cancelled')),
        instruction TEXT NOT NULL,
        result_summary TEXT,
        short_summary TEXT,
        error_code TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE TABLE runtime_dispatches (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL UNIQUE REFERENCES runs(id) ON DELETE CASCADE,
        provider TEXT NOT NULL CHECK (provider = 'workbuddy'),
        idempotency_key TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('planned','dispatching','bound','failed','recovery_required')),
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
        last_error_code TEXT,
        last_error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE runtime_bindings (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL UNIQUE REFERENCES runs(id) ON DELETE CASCADE,
        provider TEXT NOT NULL CHECK (provider = 'workbuddy'),
        external_task_id TEXT,
        external_session_id TEXT,
        provider_status TEXT,
        last_synced_at TEXT,
        finalize_pending INTEGER NOT NULL DEFAULT 0 CHECK (finalize_pending IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(provider, external_task_id)
      );
      CREATE TABLE artifact_returns (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        target_artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
        base_revision_id TEXT NOT NULL REFERENCES artifact_revisions(id) ON DELETE RESTRICT,
        returned_file_id TEXT NOT NULL REFERENCES file_records(id) ON DELETE RESTRICT,
        content_hash TEXT NOT NULL,
        canonical_path TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action = 'created'),
        status TEXT NOT NULL CHECK (status IN ('pending_review','adopted','rejected')),
        draft_revision_id TEXT REFERENCES artifact_revisions(id) ON DELETE RESTRICT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(run_id, canonical_path, content_hash, action)
      );
      CREATE INDEX idx_runs_project_status ON runs(project_id, status);
      CREATE INDEX idx_runtime_dispatches_status ON runtime_dispatches(status);
      CREATE INDEX idx_runtime_bindings_provider_status ON runtime_bindings(provider, provider_status);
      PRAGMA user_version = 6;
      COMMIT;
    `)
  }

  // ==================== Graph Save/Load ====================

  save(snapshot: ProjectGraphSnapshot): void {
    if (this.#disposableOnly) {
      if (!String(snapshot.project.id).startsWith('disposable-')) {
        throw new Error('Only disposable projects are accepted.')
      }
    }
    this.#validateSnapshotReferences(snapshot)
    for (const artifact of snapshot.artifacts) this.#assertArtifactCurrentRevisionUnchanged(artifact)
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      const pid = snapshot.project.id
      // Delete in reverse dependency order
      this.#database.prepare('DELETE FROM checkpoints WHERE project_id = ?').run(pid as SQLInputValue)
      this.#database.prepare('DELETE FROM notes WHERE project_id = ?').run(pid as SQLInputValue)
      this.#database.prepare('DELETE FROM relations WHERE project_id = ?').run(pid as SQLInputValue)
      this.#database.prepare('DELETE FROM artifact_views WHERE artifact_id IN (SELECT id FROM artifacts WHERE project_id = ?)').run(pid as SQLInputValue)
      this.#database.prepare('DELETE FROM preview_records WHERE project_id = ?').run(pid as SQLInputValue)
      this.#database.prepare('DELETE FROM artifact_revisions WHERE artifact_id IN (SELECT id FROM artifacts WHERE project_id = ?)').run(pid as SQLInputValue)
      this.#database.prepare('DELETE FROM artifacts WHERE project_id = ?').run(pid as SQLInputValue)
      this.#database.prepare('DELETE FROM file_records WHERE project_id = ?').run(pid as SQLInputValue)
      this.#database.prepare('DELETE FROM workspaces WHERE project_id = ?').run(pid as SQLInputValue)
      this.#database.prepare('DELETE FROM scopes WHERE project_id = ?').run(pid as SQLInputValue)

      // Re-insert
      this.#upsertProject(snapshot.project)
      for (const scope of snapshot.scopes) this.#upsertScope(scope, pid)
      for (const workspace of snapshot.workspaces) this.#upsertWorkspace(workspace)
      for (const artifact of snapshot.artifacts) this.#upsertArtifact(artifact)
      for (const fileRecord of snapshot.fileRecords) this.#upsertFileRecord(fileRecord)
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
    const fileRecords = (this.#database.prepare('SELECT * FROM file_records WHERE project_id = ?').all(project.id as SQLInputValue) as Row[]).map((r) => this.#fileRecord(r))
    const revisionRows = (this.#database.prepare('SELECT r.* FROM artifact_revisions r JOIN artifacts a ON r.artifact_id = a.id WHERE a.project_id = ?').all(project.id as SQLInputValue) as Row[])
    const artifactRevisions = revisionRows.map((r) => this.#artifactRevision(r))
    const viewRows = (this.#database.prepare('SELECT v.* FROM artifact_views v JOIN artifacts a ON v.artifact_id = a.id WHERE a.project_id = ?').all(project.id as SQLInputValue) as Row[])
    const artifactViews = viewRows.map((r) => this.#artifactView(r))
    const relations = (this.#database.prepare('SELECT * FROM relations WHERE project_id = ?').all(project.id as SQLInputValue) as Row[]).map((r) => this.#relation(r))
    const notes = (this.#database.prepare('SELECT * FROM notes WHERE project_id = ?').all(project.id as SQLInputValue) as Row[]).map((r) => this.#note(r))
    const checkpoints = (this.#database.prepare('SELECT * FROM checkpoints WHERE project_id = ?').all(project.id as SQLInputValue) as Row[]).map((r) => this.#checkpoint(r))

    return {
      schemaVersion: 6,
      graphVersion: project.graphVersion as GraphVersion,
      project,
      scopes,
      workspaces,
      artifacts,
      fileRecords,
      artifactViews,
      relations,
      artifactRevisions,
      notes,
      checkpoints,
    }
  }

  // ==================== Mutation ====================

  applyMutations(batch: MutationBatch, fallbackProjectId?: string): GraphVersion {
    if (batch.ops.length === 1 && batch.ops[0]?.type === 'bootstrap') {
      this.save(batch.ops[0].snapshot)
      return batch.ops[0].snapshot.graphVersion
    }
    const projectId = this.#resolveMutationProjectId(batch.ops, fallbackProjectId)
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      this.#assertMutationProjectExists(projectId, batch.ops)
      const hasSemantic = batch.ops.some(isSemanticOp)
      if (batch.ops.length > 0) {
        if (projectId) {
          const current = this.#database.prepare('SELECT graph_version FROM projects WHERE id = ?').get(projectId as SQLInputValue) as Row | undefined
          const cv = (current?.graph_version as number) ?? 0
          if (Number(batch.baseVersion) !== cv && cv > 0) {
            const err = new Error('Graph version is stale. Refresh and retry.') as unknown as Record<string, unknown>
            err.code = 'STALE_GRAPH_VERSION'
            err.currentVersion = cv
            throw err
          }
          if (hasSemantic) {
            this.#database.prepare('UPDATE projects SET graph_version = graph_version + 1 WHERE id = ?').run(projectId as SQLInputValue)
          }
        }
      }

      for (const op of batch.ops) {
        switch (op.type) {
          case 'bootstrap':
            throw new Error('Bootstrap must be the only operation in its batch.')
          case 'move_artifact_view':
            this.#database.prepare(`UPDATE artifact_views SET position = json_set(position, '$.x', ?, '$.y', ?) WHERE id = ?`)
              .run(op.x as SQLInputValue, op.y as SQLInputValue, op.viewId as SQLInputValue)
            break
          case 'resize_artifact_view':
            this.#database.prepare('UPDATE artifact_views SET size = ? WHERE id = ?')
              .run(JSON.stringify({ width: op.width, height: op.height }), op.viewId as SQLInputValue)
            break
          case 'update_workspace_viewport':
            this.#database.prepare(`UPDATE workspaces SET viewport = ?, updated_at = ? WHERE id = ?`)
              .run(JSON.stringify(op.viewport) as SQLInputValue, new Date().toISOString(), op.workspaceId as SQLInputValue)
            break
          case 'update_workspace_presentation':
            this.#database.prepare('UPDATE workspaces SET focused_node_ids = ?, visible_layers = ?, updated_at = ? WHERE id = ?')
              .run(JSON.stringify(op.focusedViewIds), JSON.stringify(op.visibleLayers), new Date().toISOString(), op.workspaceId as SQLInputValue)
            break
          case 'upsert_workspace':
            this.#upsertWorkspace(op.workspace)
            break
          case 'delete_workspace':
            this.#database.prepare('DELETE FROM workspaces WHERE id = ?').run(op.workspaceId as SQLInputValue)
            break
          case 'upsert_scope':
            this.#upsertScope(op.scope, op.scope.projectId)
            break
          case 'upsert_artifact':
            this.#assertArtifactCurrentRevisionUnchanged(op.artifact)
            this.#upsertArtifact(op.artifact)
            break
          case 'upsert_artifact_view':
            this.#upsertArtifactView(op.view)
            break
          case 'update_artifact_view_presentation':
            this.#database.prepare('UPDATE artifact_views SET collapsed = ?, display_mode = ? WHERE id = ?')
              .run(op.collapsed ? 1 : 0, op.displayMode, op.viewId as SQLInputValue)
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
        }
      }

      this.#database.exec('COMMIT;')
      if (projectId === undefined) return 0 as GraphVersion
      const row = this.#database.prepare('SELECT graph_version FROM projects WHERE id = ?').get(projectId as SQLInputValue) as Row | undefined
      return ((row?.graph_version as number | undefined) ?? 0) as GraphVersion
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
  }

  #resolveMutationProjectId(
    ops: MutationBatch['ops'],
    fallbackProjectId?: string,
  ): string | undefined {
    const direct = resolveProjectId(ops)
    if (direct !== null && direct !== '') return direct
    if (fallbackProjectId !== undefined) return fallbackProjectId
    for (const op of ops) {
      if (op.type === 'move_artifact_view'
        || op.type === 'resize_artifact_view'
        || op.type === 'update_artifact_view_presentation'
        || op.type === 'delete_artifact_view') {
        const row = this.#database.prepare(`
          SELECT a.project_id
          FROM artifact_views v
          JOIN artifacts a ON a.id = v.artifact_id
          WHERE v.id = ?
        `).get(op.viewId as SQLInputValue) as Row | undefined
        if (typeof row?.project_id === 'string') return row.project_id
      }
      if (op.type === 'update_workspace_viewport'
        || op.type === 'update_workspace_presentation'
        || op.type === 'delete_workspace') {
        const row = this.#database.prepare('SELECT project_id FROM workspaces WHERE id = ?')
          .get(op.workspaceId as SQLInputValue) as Row | undefined
        if (typeof row?.project_id === 'string') return row.project_id
      }
      if (op.type === 'delete_relation') {
        const row = this.#database.prepare('SELECT project_id FROM relations WHERE id = ?')
          .get(op.relationId as SQLInputValue) as Row | undefined
        if (typeof row?.project_id === 'string') return row.project_id
      }
    }
    return undefined
  }

  #assertMutationProjectExists(
    projectId: string | undefined,
    ops: MutationBatch['ops'],
  ): void {
    if (projectId === undefined) return
    if (ops.length === 1 && ops[0]?.type === 'bootstrap') return
    const project = this.#database.prepare('SELECT id FROM projects WHERE id = ?').get(projectId as SQLInputValue) as Row | undefined
    if (project !== undefined) return
    const op = ops[0]
    throw new MetadataForeignKeyConstraintError({
      operationType: op?.type ?? 'mutation_batch',
      entityId: entityIdForOperation(op),
      table: tableForOperation(op),
      statement: statementForOperation(op),
      foreignKeyColumn: 'project_id',
      referencedTable: 'projects',
      referencedId: projectId,
      foreignKeyCheck: this.foreignKeyCheck(),
    })
  }

  #validateSnapshotReferences(snapshot: ProjectGraphSnapshot): void {
    const projectId = String(snapshot.project.id)
    const scopeIds = new Set(snapshot.scopes.map((scope) => String(scope.id)))
    const artifactIds = new Set(snapshot.artifacts.map((artifact) => String(artifact.id)))
    const revisionIds = new Set(snapshot.artifactRevisions.map((revision) => String(revision.id)))
    const fileRecordIds = new Set(snapshot.fileRecords.map((fileRecord) => String(fileRecord.id)))

    for (const workspace of snapshot.workspaces) {
      if (!scopeIds.has(String(workspace.scopeId))) {
        this.#throwReferenceError('save_workspace', String(workspace.id), 'workspaces', 'INSERT INTO workspaces', 'scope_id', 'scopes', String(workspace.scopeId))
      }
    }
    for (const artifact of snapshot.artifacts) {
      if (String(artifact.projectId) !== projectId) {
        this.#throwReferenceError('save_artifact', String(artifact.id), 'artifacts', 'INSERT INTO artifacts', 'project_id', 'projects', String(artifact.projectId))
      }
      if (artifact.currentRevisionId !== undefined && !revisionIds.has(String(artifact.currentRevisionId))) {
        this.#throwReferenceError('save_artifact', String(artifact.id), 'artifacts', 'INSERT INTO artifacts', 'current_revision_id', 'artifact_revisions', String(artifact.currentRevisionId))
      }
    }
    for (const view of snapshot.artifactViews) {
      if (!artifactIds.has(String(view.artifactId))) {
        this.#throwReferenceError('save_artifact_view', String(view.id), 'artifact_views', 'INSERT INTO artifact_views', 'artifact_id', 'artifacts', String(view.artifactId))
      }
      if (!scopeIds.has(String(view.scopeId))) {
        this.#throwReferenceError('save_artifact_view', String(view.id), 'artifact_views', 'INSERT INTO artifact_views', 'scope_id', 'scopes', String(view.scopeId))
      }
      if (view.revisionId !== undefined && !revisionIds.has(String(view.revisionId))) {
        this.#throwReferenceError('save_artifact_view', String(view.id), 'artifact_views', 'INSERT INTO artifact_views', 'revision_id', 'artifact_revisions', String(view.revisionId))
      }
    }
    for (const revision of snapshot.artifactRevisions) {
      if (!artifactIds.has(String(revision.artifactId))) {
        this.#throwReferenceError('save_artifact_revision', String(revision.id), 'artifact_revisions', 'INSERT INTO artifact_revisions', 'artifact_id', 'artifacts', String(revision.artifactId))
      }
      if (!fileRecordIds.has(String(revision.fileRecordId))) {
        this.#throwReferenceError('save_artifact_revision', String(revision.id), 'artifact_revisions', 'INSERT INTO artifact_revisions', 'file_record_id', 'file_records', String(revision.fileRecordId))
      }
      if (revision.parentRevisionId !== undefined && !revisionIds.has(String(revision.parentRevisionId))) {
        this.#throwReferenceError('save_artifact_revision', String(revision.id), 'artifact_revisions', 'INSERT INTO artifact_revisions', 'parent_revision_id', 'artifact_revisions', String(revision.parentRevisionId))
      }
    }
  }

  #throwReferenceError(
    operationType: string,
    entityId: string,
    table: string,
    statement: string,
    foreignKeyColumn: string,
    referencedTable: string,
    referencedId: string,
  ): never {
    throw new MetadataForeignKeyConstraintError({
      operationType,
      entityId,
      table,
      statement,
      foreignKeyColumn,
      referencedTable,
      referencedId,
      foreignKeyCheck: this.foreignKeyCheck(),
    })
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

  upsertArtifact(value: Artifact): void {
    this.#assertArtifactCurrentRevisionUnchanged(value)
    this.#upsertArtifact(value)
  }

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

  createCheckpoint(value: Checkpoint): void {
    if (this.getCheckpoint(String(value.id)) !== undefined) {
      throw new Error('Checkpoint is immutable and already exists.')
    }
    this.#upsertCheckpoint(value)
  }

  getFileRecords(projectId: string): FileRecord[] {
    return (this.#database.prepare('SELECT * FROM file_records WHERE project_id = ?').all(projectId as SQLInputValue) as Row[])
      .map((row) => this.#fileRecord(row))
  }

  getFileRecord(fileRecordId: string): FileRecord | undefined {
    const row = this.#database.prepare('SELECT * FROM file_records WHERE id = ?').get(fileRecordId as SQLInputValue) as Row | undefined
    return row === undefined ? undefined : this.#fileRecord(row)
  }

  upsertFileRecord(value: FileRecord): void { this.#upsertFileRecord(value) }

  getPreviewRecords(projectId: string): PreviewRecord[] {
    return (this.#database.prepare('SELECT * FROM preview_records WHERE project_id = ?').all(projectId as SQLInputValue) as Row[])
      .map((row) => this.#previewRecord(row))
  }

  getPreviewRecordByCacheKey(cacheKey: string): PreviewRecord | undefined {
    const row = this.#database.prepare('SELECT * FROM preview_records WHERE cache_key = ?').get(cacheKey) as Row | undefined
    return row === undefined ? undefined : this.#previewRecord(row)
  }

  getPreviewRecord(previewRecordId: string): PreviewRecord | undefined {
    const row = this.#database.prepare('SELECT * FROM preview_records WHERE id = ?').get(previewRecordId as SQLInputValue) as Row | undefined
    return row === undefined ? undefined : this.#previewRecord(row)
  }

  upsertPreviewRecord(value: PreviewRecord): void { this.#upsertPreviewRecord(value) }

  deletePreviewRecords(projectId: string): void {
    this.#database.prepare('DELETE FROM preview_records WHERE project_id = ?').run(projectId as SQLInputValue)
  }

  updateFileObservation(fileRecord: FileRecord, artifact?: Artifact): void {
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      this.#upsertFileRecord(fileRecord)
      if (artifact !== undefined) this.#upsertArtifact(artifact)
      this.#database.exec('COMMIT;')
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
  }

  registerSource(
    fileRecord: FileRecord,
    artifact: Artifact,
    revision: ArtifactRevision,
  ): void {
    if (String(fileRecord.projectId) !== String(artifact.projectId)
      || String(revision.artifactId) !== String(artifact.id)
      || String(revision.fileRecordId) !== String(fileRecord.id)
      || String(artifact.currentRevisionId) !== String(revision.id)
      || String(revision.contentHash) !== String(fileRecord.observedHash)
      || revision.source !== 'import'
      || revision.status !== 'current') {
      throw new Error('Initial source registration invariants are invalid.')
    }
    if (this.getProject(String(artifact.projectId)) === undefined) {
      throw new Error('Project not found.')
    }
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      this.#upsertFileRecord(fileRecord)
      this.#upsertArtifact(artifact)
      this.#upsertArtifactRevision(revision)
      this.#database.prepare('UPDATE projects SET graph_version = graph_version + 1, updated_at = ? WHERE id = ?')
        .run(artifact.updatedAt, artifact.projectId as SQLInputValue)
      this.#database.exec('COMMIT;')
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
  }

  adoptExternalChange(
    previousRevision: ArtifactRevision,
    nextFileRecord: FileRecord,
    nextRevision: ArtifactRevision,
    artifact: Artifact,
    views: readonly ArtifactView[],
  ): void {
    if (String(previousRevision.artifactId) !== String(artifact.id)
      || String(nextRevision.artifactId) !== String(artifact.id)
      || String(nextRevision.fileRecordId) !== String(nextFileRecord.id)
      || String(nextFileRecord.projectId) !== String(artifact.projectId)
      || String(nextRevision.parentRevisionId) !== String(previousRevision.id)
      || String(nextRevision.contentHash) !== String(nextFileRecord.observedHash)
      || nextRevision.source !== 'external'
      || nextRevision.status !== 'current'
      || previousRevision.status !== 'superseded'
      || String(artifact.currentRevisionId) !== String(nextRevision.id)) {
      throw new Error('External change adoption invariants are invalid.')
    }
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      this.#upsertFileRecord(nextFileRecord)
      this.#upsertArtifactRevision(previousRevision)
      this.#upsertArtifactRevision(nextRevision)
      this.#upsertArtifact(artifact)
      for (const view of views) this.#upsertArtifactView(view)
      this.#database.prepare('UPDATE projects SET graph_version = graph_version + 1, updated_at = ? WHERE id = ?')
        .run(artifact.updatedAt, artifact.projectId as SQLInputValue)
      this.#database.exec('COMMIT;')
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
  }

  registerImportedSource(
    fileRecord: FileRecord,
    artifact: Artifact,
    revision: ArtifactRevision,
    view: ArtifactView,
  ): void {
    if (String(fileRecord.projectId) !== String(artifact.projectId)
      || String(revision.artifactId) !== String(artifact.id)
      || String(revision.fileRecordId) !== String(fileRecord.id)
      || String(view.artifactId) !== String(artifact.id)
      || String(view.revisionId) !== String(revision.id)
      || String(artifact.currentRevisionId) !== String(revision.id)
      || String(revision.contentHash) !== String(fileRecord.observedHash)
      || revision.source !== 'import'
      || revision.status !== 'current') {
      throw new Error('Import Copy invariants are invalid.')
    }
    if (this.getProject(String(artifact.projectId)) === undefined) {
      throw new Error('Project not found.')
    }
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      this.#upsertFileRecord(fileRecord)
      this.#upsertArtifact(artifact)
      this.#upsertArtifactRevision(revision)
      this.#upsertArtifactView(view)
      this.#database.prepare('UPDATE projects SET graph_version = graph_version + 1, updated_at = ? WHERE id = ?')
        .run(artifact.updatedAt, artifact.projectId as SQLInputValue)
      this.#database.exec('COMMIT;')
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
  }

  createContextManifest(value: PersistedContextManifestV0): PersistedContextManifestV0 {
    assertCanonicalManifest(value)
    const existing = this.getContextManifest(value.id)
    if (existing !== undefined) {
      if (existing.canonicalJson !== value.canonicalJson
        || existing.manifestHash !== value.manifestHash
        || String(existing.projectId) !== String(value.projectId)) {
        throw new Error('ContextManifest is immutable and conflicts with the stored value.')
      }
      return existing
    }
    this.#database.prepare(`
      INSERT INTO context_manifests (
        id, project_id, schema_version, target_artifact_id, target_revision_id,
        canonical_json, manifest_hash, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      value.id as SQLInputValue,
      value.projectId as SQLInputValue,
      value.schemaVersion,
      value.targetArtifactId as SQLInputValue ?? null,
      value.targetRevisionId as SQLInputValue ?? null,
      value.canonicalJson,
      value.manifestHash,
      value.createdAt,
    )
    return value
  }

  getContextManifest(manifestId: PersistedContextManifestV0['id']): PersistedContextManifestV0 | undefined {
    const row = this.#database.prepare('SELECT * FROM context_manifests WHERE id = ?').get(manifestId as SQLInputValue) as Row | undefined
    if (row === undefined) return undefined
    return {
      id: String(row.id) as PersistedContextManifestV0['id'],
      projectId: String(row.project_id) as PersistedContextManifestV0['projectId'],
      schemaVersion: Number(row.schema_version) as 0,
      ...(row.target_artifact_id ? { targetArtifactId: String(row.target_artifact_id) as ArtifactId } : {}),
      ...(row.target_revision_id ? { targetRevisionId: String(row.target_revision_id) as ArtifactRevisionId } : {}),
      canonicalJson: String(row.canonical_json),
      manifestHash: String(row.manifest_hash),
      createdAt: String(row.created_at),
    }
  }

  createRunWithDispatch(run: Run, dispatch: RuntimeDispatch): void {
    if (String(dispatch.runId) !== String(run.id)) throw new Error('RuntimeDispatch must belong to the Run.')
    if (dispatch.idempotencyKey !== String(run.id)) throw new Error('RuntimeDispatch idempotencyKey must equal runId.')
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      this.#database.prepare(`
        INSERT INTO runs (
          id, project_id, workspace_id, target_artifact_id, target_revision_id,
          context_manifest_id, retry_of_run_id, provider, status, instruction,
          result_summary, short_summary, error_code, error_message,
          created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        run.id as SQLInputValue,
        run.projectId as SQLInputValue,
        run.workspaceId as SQLInputValue ?? null,
        run.targetArtifactId as SQLInputValue,
        run.targetRevisionId as SQLInputValue,
        run.contextManifestId as SQLInputValue,
        run.retryOfRunId as SQLInputValue ?? null,
        run.provider,
        run.status,
        run.instruction,
        run.resultSummary ?? null,
        run.shortSummary ?? null,
        run.errorCode ?? null,
        run.errorMessage ?? null,
        run.createdAt,
        run.updatedAt,
        run.completedAt ?? null,
      )
      this.#database.prepare(`
        INSERT INTO runtime_dispatches (
          id, run_id, provider, idempotency_key, status, attempt_count,
          last_error_code, last_error_message, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        dispatch.id as SQLInputValue,
        dispatch.runId as SQLInputValue,
        dispatch.provider,
        dispatch.idempotencyKey,
        dispatch.status,
        dispatch.attemptCount,
        dispatch.lastErrorCode ?? null,
        dispatch.lastErrorMessage ?? null,
        dispatch.createdAt,
        dispatch.updatedAt,
      )
      this.#database.exec('COMMIT;')
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
  }

  getRun(runId: RunId): Run | undefined {
    const row = this.#database.prepare('SELECT * FROM runs WHERE id = ?').get(runId as SQLInputValue) as Row | undefined
    return row === undefined ? undefined : this.#runFromRow(row)
  }

  getProjectRuns(projectId: ProjectId, limit = 20): readonly Run[] {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)))
    const rows = this.#database.prepare(
      'SELECT * FROM runs WHERE project_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
    ).all(projectId as SQLInputValue, safeLimit) as Row[]
    return rows.map((row) => this.#runFromRow(row))
  }

  #runFromRow(row: Row): Run {
    return {
      id: String(row.id) as Run['id'],
      projectId: String(row.project_id) as Run['projectId'],
      ...(row.workspace_id ? { workspaceId: String(row.workspace_id) as WorkspaceId } : {}),
      targetArtifactId: String(row.target_artifact_id) as Run['targetArtifactId'],
      targetRevisionId: String(row.target_revision_id) as Run['targetRevisionId'],
      contextManifestId: String(row.context_manifest_id) as Run['contextManifestId'],
      ...(row.retry_of_run_id ? { retryOfRunId: String(row.retry_of_run_id) as RunId } : {}),
      provider: String(row.provider) as Run['provider'],
      status: String(row.status) as Run['status'],
      instruction: String(row.instruction),
      ...(row.result_summary ? { resultSummary: String(row.result_summary) } : {}),
      ...(row.short_summary ? { shortSummary: String(row.short_summary) } : {}),
      ...(row.error_code ? { errorCode: String(row.error_code) } : {}),
      ...(row.error_message ? { errorMessage: String(row.error_message) } : {}),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      ...(row.completed_at ? { completedAt: String(row.completed_at) } : {}),
    }
  }

  getRuntimeDispatch(runId: RunId): RuntimeDispatch | undefined {
    const row = this.#database.prepare('SELECT * FROM runtime_dispatches WHERE run_id = ?').get(runId as SQLInputValue) as Row | undefined
    if (row === undefined) return undefined
    return {
      id: String(row.id) as RuntimeDispatch['id'],
      runId: String(row.run_id) as RuntimeDispatch['runId'],
      provider: String(row.provider) as RuntimeDispatch['provider'],
      idempotencyKey: String(row.idempotency_key),
      status: String(row.status) as RuntimeDispatch['status'],
      attemptCount: Number(row.attempt_count),
      ...(row.last_error_code ? { lastErrorCode: String(row.last_error_code) } : {}),
      ...(row.last_error_message ? { lastErrorMessage: String(row.last_error_message) } : {}),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }
  }

  updateRuntimeDispatch(value: RuntimeDispatch): RuntimeDispatch {
    const result = this.#database.prepare(`
      UPDATE runtime_dispatches SET
        status = ?, attempt_count = ?, last_error_code = ?,
        last_error_message = ?, updated_at = ?
      WHERE id = ? AND run_id = ? AND provider = ? AND idempotency_key = ?
    `).run(
      value.status,
      value.attemptCount,
      value.lastErrorCode ?? null,
      value.lastErrorMessage ?? null,
      value.updatedAt,
      value.id as SQLInputValue,
      value.runId as SQLInputValue,
      value.provider,
      value.idempotencyKey,
    )
    if (result.changes !== 1) throw new Error('RuntimeDispatch identity cannot be changed.')
    return value
  }

  createRuntimeBinding(value: RuntimeBinding): RuntimeBinding {
    this.#database.prepare(`
      INSERT INTO runtime_bindings (
        id, run_id, provider, external_task_id, external_session_id,
        provider_status, last_synced_at, finalize_pending, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      value.id as SQLInputValue,
      value.runId as SQLInputValue,
      value.provider,
      value.externalTaskId ?? null,
      value.externalSessionId ?? null,
      value.providerStatus ?? null,
      value.lastSyncedAt ?? null,
      value.finalizePending ? 1 : 0,
      value.createdAt,
      value.updatedAt,
    )
    return value
  }

  getRuntimeBinding(runId: RunId): RuntimeBinding | undefined {
    const row = this.#database.prepare('SELECT * FROM runtime_bindings WHERE run_id = ?').get(runId as SQLInputValue) as Row | undefined
    if (row === undefined) return undefined
    return {
      id: String(row.id) as RuntimeBinding['id'],
      runId: String(row.run_id) as RuntimeBinding['runId'],
      provider: String(row.provider) as RuntimeBinding['provider'],
      ...(row.external_task_id ? { externalTaskId: String(row.external_task_id) } : {}),
      ...(row.external_session_id ? { externalSessionId: String(row.external_session_id) } : {}),
      ...(row.provider_status ? { providerStatus: String(row.provider_status) } : {}),
      ...(row.last_synced_at ? { lastSyncedAt: String(row.last_synced_at) } : {}),
      finalizePending: Number(row.finalize_pending) === 1,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }
  }

  updateRuntimeBinding(value: RuntimeBinding): RuntimeBinding {
    const result = this.#database.prepare(`
      UPDATE runtime_bindings SET
        external_session_id = ?, provider_status = ?, last_synced_at = ?,
        finalize_pending = ?, updated_at = ?
      WHERE id = ? AND run_id = ? AND provider = ? AND external_task_id = ?
    `).run(
      value.externalSessionId ?? null,
      value.providerStatus ?? null,
      value.lastSyncedAt ?? null,
      value.finalizePending ? 1 : 0,
      value.updatedAt,
      value.id as SQLInputValue,
      value.runId as SQLInputValue,
      value.provider,
      value.externalTaskId ?? null,
    )
    if (result.changes !== 1) throw new Error('RuntimeBinding identity cannot be changed.')
    return value
  }

  updateRunStatus(runId: RunId, status: Run['status'], updatedAt: string): Run {
    const result = this.#database.prepare(
      'UPDATE runs SET status = ?, updated_at = ? WHERE id = ?',
    ).run(status, updatedAt, runId as SQLInputValue)
    if (result.changes !== 1) throw new Error('Run not found.')
    const run = this.getRun(runId)
    if (run === undefined) throw new Error('Run not found after update.')
    return run
  }

  createArtifactReturn(value: ArtifactReturn): ArtifactReturn {
    this.#database.prepare(`
      INSERT INTO artifact_returns (
        id, run_id, target_artifact_id, base_revision_id, returned_file_id,
        content_hash, canonical_path, action, status, draft_revision_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      value.id as SQLInputValue,
      value.runId as SQLInputValue,
      value.targetArtifactId as SQLInputValue,
      value.baseRevisionId as SQLInputValue,
      value.returnedFileId as SQLInputValue,
      value.contentHash as SQLInputValue,
      value.canonicalPath,
      value.action,
      value.status,
      value.draftRevisionId as SQLInputValue ?? null,
      value.createdAt,
      value.updatedAt,
    )
    return value
  }

  createRuntimeDraft(
    fileRecord: FileRecord,
    revision: ArtifactRevision,
    artifactReturn: ArtifactReturn,
  ): ArtifactReturn {
    if (
      String(fileRecord.id) !== String(artifactReturn.returnedFileId)
      || String(revision.id) !== String(artifactReturn.draftRevisionId)
      || String(revision.fileRecordId) !== String(fileRecord.id)
      || String(revision.artifactId) !== String(artifactReturn.targetArtifactId)
      || String(revision.parentRevisionId) !== String(artifactReturn.baseRevisionId)
      || String(revision.runId) !== String(artifactReturn.runId)
      || String(revision.contentHash) !== String(artifactReturn.contentHash)
      || String(fileRecord.observedHash) !== String(artifactReturn.contentHash)
      || revision.source !== 'run'
      || revision.status !== 'draft'
      || artifactReturn.status !== 'pending_review'
    ) {
      throw new Error('Runtime Draft invariants are invalid.')
    }
    const existing = this.getArtifactReturnByIdentity(
      artifactReturn.runId,
      artifactReturn.canonicalPath,
      String(artifactReturn.contentHash),
      artifactReturn.action,
    )
    if (existing !== undefined) return existing
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      this.#upsertFileRecord(fileRecord)
      this.#upsertArtifactRevision(revision)
      this.createArtifactReturn(artifactReturn)
      this.#database.exec('COMMIT;')
      return artifactReturn
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      const replay = this.getArtifactReturnByIdentity(
        artifactReturn.runId,
        artifactReturn.canonicalPath,
        String(artifactReturn.contentHash),
        artifactReturn.action,
      )
      if (replay !== undefined) return replay
      throw error
    }
  }

  getArtifactReturn(returnId: ArtifactReturnId): ArtifactReturn | undefined {
    const row = this.#database.prepare('SELECT * FROM artifact_returns WHERE id = ?').get(returnId as SQLInputValue) as Row | undefined
    if (row === undefined) return undefined
    return {
      id: String(row.id) as ArtifactReturn['id'],
      runId: String(row.run_id) as ArtifactReturn['runId'],
      targetArtifactId: String(row.target_artifact_id) as ArtifactReturn['targetArtifactId'],
      baseRevisionId: String(row.base_revision_id) as ArtifactReturn['baseRevisionId'],
      returnedFileId: String(row.returned_file_id) as ArtifactReturn['returnedFileId'],
      contentHash: String(row.content_hash) as ArtifactReturn['contentHash'],
      canonicalPath: String(row.canonical_path),
      action: String(row.action) as ArtifactReturn['action'],
      status: String(row.status) as ArtifactReturn['status'],
      ...(row.draft_revision_id ? { draftRevisionId: String(row.draft_revision_id) as ArtifactRevisionId } : {}),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }
  }

  getArtifactReturnByIdentity(
    runId: RunId,
    canonicalPath: string,
    contentHash: string,
    action: ArtifactReturn['action'],
  ): ArtifactReturn | undefined {
    const row = this.#database.prepare(`
      SELECT id FROM artifact_returns
      WHERE run_id = ? AND canonical_path = ? AND content_hash = ? AND action = ?
    `).get(runId as SQLInputValue, canonicalPath, contentHash, action) as Row | undefined
    return row === undefined ? undefined : this.getArtifactReturn(String(row.id) as ArtifactReturnId)
  }

  getArtifactReturns(runId: RunId): readonly ArtifactReturn[] {
    return (this.#database.prepare(
      'SELECT id FROM artifact_returns WHERE run_id = ? ORDER BY created_at, id',
    ).all(runId as SQLInputValue) as Row[])
      .map((row) => this.getArtifactReturn(String(row.id) as ArtifactReturnId))
      .filter((value): value is ArtifactReturn => value !== undefined)
  }

  acceptArtifactReturn(
    returnId: ArtifactReturnId,
    expectedBaseRevisionId: ArtifactRevisionId,
    updatedAt: string,
  ): AcceptArtifactReturnResult {
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      const artifactReturn = this.getArtifactReturn(returnId)
      if (artifactReturn === undefined) throw new RuntimeLifecycleConflictError('ArtifactReturn not found.')
      if (artifactReturn.status !== 'pending_review') throw new RuntimeLifecycleConflictError('ArtifactReturn is no longer pending review.')
      if (String(artifactReturn.baseRevisionId) !== String(expectedBaseRevisionId)) {
        throw new RuntimeLifecycleConflictError('Accept base revision does not match the Return base revision.')
      }
      if (artifactReturn.draftRevisionId === undefined) throw new RuntimeLifecycleConflictError('ArtifactReturn has no Draft Revision.')
      const artifact = this.getArtifact(String(artifactReturn.targetArtifactId))
      const previousRevision = this.getArtifactRevision(String(artifactReturn.baseRevisionId))
      const draftRevision = this.getArtifactRevision(String(artifactReturn.draftRevisionId))
      const run = this.getRun(artifactReturn.runId)
      if (artifact === undefined || previousRevision === undefined || draftRevision === undefined || run === undefined) {
        throw new RuntimeLifecycleConflictError('Accept lifecycle evidence is incomplete.')
      }
      if (String(artifact.currentRevisionId) !== String(expectedBaseRevisionId)) {
        throw new RuntimeLifecycleConflictError('Artifact Current changed after this Run started.')
      }
      if (previousRevision.status !== 'current' || draftRevision.status !== 'draft'
        || String(draftRevision.parentRevisionId) !== String(expectedBaseRevisionId)
        || String(draftRevision.runId) !== String(run.id)) {
        throw new RuntimeLifecycleConflictError('Accept lifecycle invariants are invalid.')
      }
      this.#database.prepare('UPDATE artifact_revisions SET status = ? WHERE id = ? AND status = ?')
        .run('superseded', previousRevision.id as SQLInputValue, 'current')
      this.#database.prepare('UPDATE artifact_revisions SET status = ? WHERE id = ? AND status = ?')
        .run('current', draftRevision.id as SQLInputValue, 'draft')
      this.#database.prepare(
        'UPDATE artifacts SET current_revision_id = ?, updated_at = ? WHERE id = ? AND current_revision_id = ?',
      ).run(draftRevision.id as SQLInputValue, updatedAt, artifact.id as SQLInputValue, expectedBaseRevisionId as SQLInputValue)
      this.#database.prepare('UPDATE artifact_returns SET status = ?, updated_at = ? WHERE id = ? AND status = ?')
        .run('adopted', updatedAt, returnId as SQLInputValue, 'pending_review')
      this.#database.prepare(
        'UPDATE runs SET status = ?, updated_at = ?, completed_at = ? WHERE id = ?',
      ).run('completed', updatedAt, updatedAt, run.id as SQLInputValue)
      this.#database.prepare(
        'UPDATE runtime_bindings SET finalize_pending = 1, updated_at = ? WHERE run_id = ?',
      ).run(updatedAt, run.id as SQLInputValue)
      this.#database.prepare(
        'UPDATE projects SET graph_version = graph_version + 1, updated_at = ? WHERE id = ?',
      ).run(updatedAt, run.projectId as SQLInputValue)
      const result = {
        artifactReturn: this.getArtifactReturn(returnId)!,
        currentRevision: this.getArtifactRevision(String(draftRevision.id))!,
        previousRevision: this.getArtifactRevision(String(previousRevision.id))!,
        run: this.getRun(run.id)!,
      }
      this.#database.exec('COMMIT;')
      return result
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
  }

  rejectArtifactReturn(returnId: ArtifactReturnId, updatedAt: string): RejectArtifactReturnResult {
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      const artifactReturn = this.getArtifactReturn(returnId)
      if (artifactReturn === undefined) throw new RuntimeLifecycleConflictError('ArtifactReturn not found.')
      if (artifactReturn.status !== 'pending_review') throw new RuntimeLifecycleConflictError('ArtifactReturn is no longer pending review.')
      if (artifactReturn.draftRevisionId === undefined) throw new RuntimeLifecycleConflictError('ArtifactReturn has no Draft Revision.')
      const draftRevision = this.getArtifactRevision(String(artifactReturn.draftRevisionId))
      const run = this.getRun(artifactReturn.runId)
      if (draftRevision === undefined || run === undefined || draftRevision.status !== 'draft') {
        throw new RuntimeLifecycleConflictError('Reject lifecycle evidence is incomplete.')
      }
      this.#database.prepare('UPDATE artifact_returns SET status = ?, updated_at = ? WHERE id = ? AND status = ?')
        .run('rejected', updatedAt, returnId as SQLInputValue, 'pending_review')
      this.#database.prepare(
        'UPDATE runs SET status = ?, updated_at = ?, completed_at = ? WHERE id = ?',
      ).run('completed', updatedAt, updatedAt, run.id as SQLInputValue)
      this.#database.prepare(
        'UPDATE runtime_bindings SET finalize_pending = 1, updated_at = ? WHERE run_id = ?',
      ).run(updatedAt, run.id as SQLInputValue)
      const result = {
        artifactReturn: this.getArtifactReturn(returnId)!,
        draftRevision,
        run: this.getRun(run.id)!,
      }
      this.#database.exec('COMMIT;')
      return result
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
  }

  retryArtifactReturn(
    returnId: ArtifactReturnId,
    run: Run,
    dispatch: RuntimeDispatch,
    updatedAt: string,
  ): RetryRunResult {
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      const artifactReturn = this.getArtifactReturn(returnId)
      const previousRun = artifactReturn === undefined ? undefined : this.getRun(artifactReturn.runId)
      if (artifactReturn === undefined || previousRun === undefined) throw new RuntimeLifecycleConflictError('Retry lifecycle evidence is incomplete.')
      if (artifactReturn.status !== 'pending_review') throw new RuntimeLifecycleConflictError('ArtifactReturn is no longer pending review.')
      if (String(run.retryOfRunId) !== String(previousRun.id)
        || String(run.projectId) !== String(previousRun.projectId)
        || String(run.targetArtifactId) !== String(previousRun.targetArtifactId)
        || String(run.targetRevisionId) !== String(previousRun.targetRevisionId)
        || String(run.contextManifestId) !== String(previousRun.contextManifestId)
        || String(dispatch.runId) !== String(run.id)
        || dispatch.idempotencyKey !== String(run.id)) {
        throw new RuntimeLifecycleConflictError('Retry Run identity is invalid.')
      }
      this.#database.prepare('UPDATE artifact_returns SET status = ?, updated_at = ? WHERE id = ? AND status = ?')
        .run('rejected', updatedAt, returnId as SQLInputValue, 'pending_review')
      this.#database.prepare(
        'UPDATE runs SET status = ?, updated_at = ?, completed_at = ? WHERE id = ?',
      ).run('completed', updatedAt, updatedAt, previousRun.id as SQLInputValue)
      this.#database.prepare(
        'UPDATE runtime_bindings SET finalize_pending = 1, updated_at = ? WHERE run_id = ?',
      ).run(updatedAt, previousRun.id as SQLInputValue)
      this.#insertRun(run)
      this.#insertRuntimeDispatch(dispatch)
      const result = {
        previousRun: this.getRun(previousRun.id)!,
        previousReturn: this.getArtifactReturn(returnId)!,
        run: this.getRun(run.id)!,
        dispatch: this.getRuntimeDispatch(run.id)!,
      }
      this.#database.exec('COMMIT;')
      return result
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
  }

  get schemaVersion(): number { return 6 }

  // ==================== Private helpers ====================

  #upsertProject(value: Project): void {
    this.#database.prepare(`
      INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, root_path=excluded.root_path, graph_version=excluded.graph_version, updated_at=excluded.updated_at
    `).run(value.id as SQLInputValue, value.name, value.rootPath, value.graphVersion as unknown as number, value.createdAt, value.updatedAt)
  }

  #upsertScope(value: Scope, projectId: ProjectId): void {
    this.#database.prepare(`
      INSERT INTO scopes VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET parent_scope_id=excluded.parent_scope_id, name=excluded.name, updated_at=excluded.updated_at
    `).run(value.id as SQLInputValue, projectId as SQLInputValue, value.parentScopeId as SQLInputValue ?? null, value.containerViewId as SQLInputValue ?? null, value.kind, value.name, value.createdAt, value.updatedAt)
  }

  #upsertWorkspace(value: Workspace): void {
    this.#runStatement({
      operationType: 'upsert_workspace',
      entityId: String(value.id),
      table: 'workspaces',
      statement: 'INSERT INTO workspaces',
      foreignKeyColumn: 'project_id',
      referencedTable: 'projects',
      referencedId: String(value.projectId),
    }, `
      INSERT INTO workspaces VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, intent=excluded.intent, scope_id=excluded.scope_id, viewport=excluded.viewport, focused_node_ids=excluded.focused_node_ids, visible_layers=excluded.visible_layers, context_policy=excluded.context_policy, updated_at=excluded.updated_at
    `, [
      value.id as SQLInputValue, value.projectId as SQLInputValue, value.scopeId as SQLInputValue,
      value.name, value.intent, JSON.stringify(value.viewport),
      JSON.stringify(value.focusedViewIds), JSON.stringify(value.visibleLayers),
      value.contextPolicy, value.updatedAt,
    ])
  }

  #upsertArtifact(value: Artifact): void {
    this.#runStatement({
      operationType: 'upsert_artifact',
      entityId: String(value.id),
      table: 'artifacts',
      statement: 'INSERT INTO artifacts',
      foreignKeyColumn: 'project_id',
      referencedTable: 'projects',
      referencedId: String(value.projectId),
    }, `
      INSERT INTO artifacts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, kind=excluded.kind, local_path=excluded.local_path, availability=excluded.availability, current_revision_id=excluded.current_revision_id, updated_at=excluded.updated_at
    `, [value.id as SQLInputValue, value.projectId as SQLInputValue, value.title, value.kind, '', value.availability, value.currentRevisionId as SQLInputValue ?? null, value.createdAt, value.updatedAt])
  }

  #assertArtifactCurrentRevisionUnchanged(value: Artifact): void {
    const existing = this.getArtifact(String(value.id))
    if (existing !== undefined
      && String(existing.currentRevisionId ?? '') !== String(value.currentRevisionId ?? '')) {
      throw new RuntimeLifecycleConflictError('currentRevisionId may only change through an explicit Revision lifecycle.')
    }
  }

  #insertRun(run: Run): void {
    this.#database.prepare(`
      INSERT INTO runs (
        id, project_id, workspace_id, target_artifact_id, target_revision_id,
        context_manifest_id, retry_of_run_id, provider, status, instruction,
        result_summary, short_summary, error_code, error_message,
        created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      run.id as SQLInputValue, run.projectId as SQLInputValue, run.workspaceId as SQLInputValue ?? null,
      run.targetArtifactId as SQLInputValue, run.targetRevisionId as SQLInputValue,
      run.contextManifestId as SQLInputValue, run.retryOfRunId as SQLInputValue ?? null,
      run.provider, run.status, run.instruction, run.resultSummary ?? null, run.shortSummary ?? null,
      run.errorCode ?? null, run.errorMessage ?? null, run.createdAt, run.updatedAt, run.completedAt ?? null,
    )
  }

  #insertRuntimeDispatch(dispatch: RuntimeDispatch): void {
    this.#database.prepare(`
      INSERT INTO runtime_dispatches (
        id, run_id, provider, idempotency_key, status, attempt_count,
        last_error_code, last_error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      dispatch.id as SQLInputValue, dispatch.runId as SQLInputValue, dispatch.provider,
      dispatch.idempotencyKey, dispatch.status, dispatch.attemptCount,
      dispatch.lastErrorCode ?? null, dispatch.lastErrorMessage ?? null,
      dispatch.createdAt, dispatch.updatedAt,
    )
  }

  #upsertArtifactView(value: ArtifactView): void {
    this.#runStatement({
      operationType: 'upsert_artifact_view',
      entityId: String(value.id),
      table: 'artifact_views',
      statement: 'INSERT INTO artifact_views',
      foreignKeyColumn: 'artifact_id',
      referencedTable: 'artifacts',
      referencedId: String(value.artifactId),
    }, `
      INSERT INTO artifact_views VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET artifact_id=excluded.artifact_id, scope_id=excluded.scope_id, revision_id=excluded.revision_id, reference_kind=excluded.reference_kind, position=excluded.position, size=excluded.size, display_mode=excluded.display_mode, collapsed=excluded.collapsed
    `, [value.id as SQLInputValue, value.artifactId as SQLInputValue, value.scopeId as SQLInputValue, value.revisionId as SQLInputValue ?? null,
      value.referenceKind, JSON.stringify(value.position), JSON.stringify(value.size),
      value.displayMode, value.collapsed ? 1 : 0])
  }

  #upsertRelation(value: Relation): void {
    this.#database.prepare(`
      INSERT INTO relations VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET source_entity_type=excluded.source_entity_type, source_entity_id=excluded.source_entity_id, target_entity_type=excluded.target_entity_type, target_entity_id=excluded.target_entity_id, kind=excluded.kind, updated_at=excluded.updated_at
    `).run(value.id as SQLInputValue, value.projectId as SQLInputValue, value.sourceEntityType, value.sourceEntityId, value.targetEntityType, value.targetEntityId, value.kind, value.createdAt, value.updatedAt)
  }

  #upsertArtifactRevision(value: ArtifactRevision): void {
    const fileRecord = this.getFileRecord(String(value.fileRecordId))
    if (fileRecord === undefined) {
      throw new MetadataForeignKeyConstraintError({
        operationType: 'upsert_artifact_revision',
        entityId: String(value.id),
        table: 'artifact_revisions',
        statement: 'INSERT INTO artifact_revisions',
        foreignKeyColumn: 'file_record_id',
        referencedTable: 'file_records',
        referencedId: String(value.fileRecordId),
        foreignKeyCheck: this.foreignKeyCheck(),
      })
    }
    this.#runStatement({
      operationType: 'upsert_artifact_revision',
      entityId: String(value.id),
      table: 'artifact_revisions',
      statement: 'INSERT INTO artifact_revisions',
      foreignKeyColumn: 'artifact_id',
      referencedTable: 'artifacts',
      referencedId: String(value.artifactId),
    }, `
      INSERT INTO artifact_revisions (
        id, artifact_id, parent_revision_id, local_path, content_hash,
        source, run_id, status, created_at, file_record_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status
    `, [value.id as SQLInputValue, value.artifactId as SQLInputValue, value.parentRevisionId as SQLInputValue ?? null, fileRecord.observedPath, value.contentHash as SQLInputValue, value.source, value.runId as SQLInputValue ?? null, value.status, value.createdAt, value.fileRecordId as SQLInputValue])
  }

  #upsertFileRecord(value: FileRecord): void {
    this.#runStatement({
      operationType: 'upsert_file_record',
      entityId: String(value.id),
      table: 'file_records',
      statement: 'INSERT INTO file_records',
      foreignKeyColumn: 'project_id',
      referencedTable: 'projects',
      referencedId: String(value.projectId),
    }, `
      INSERT INTO file_records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        observed_path=excluded.observed_path,
        observed_hash=excluded.observed_hash,
        size=excluded.size,
        modified_at=excluded.modified_at,
        mime_type=excluded.mime_type,
        availability=excluded.availability,
        observed_at=excluded.observed_at
    `, [
      value.id as SQLInputValue,
      value.projectId as SQLInputValue,
      value.observedPath,
      value.observedHash as SQLInputValue,
      value.size,
      value.modifiedAt,
      value.mimeType,
      value.availability,
      value.observedAt,
    ])
  }

  #upsertPreviewRecord(value: PreviewRecord): void {
    this.#runStatement({
      operationType: 'upsert_preview_record',
      entityId: String(value.id),
      table: 'preview_records',
      statement: 'INSERT INTO preview_records',
      foreignKeyColumn: 'revision_id',
      referencedTable: 'artifact_revisions',
      referencedId: String(value.revisionId),
    }, `
      INSERT INTO preview_records VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source_content_hash=excluded.source_content_hash,
        renderer_id=excluded.renderer_id,
        renderer_version=excluded.renderer_version,
        preview_profile=excluded.preview_profile,
        cache_key=excluded.cache_key,
        cache_path=excluded.cache_path,
        mime_type=excluded.mime_type,
        size=excluded.size,
        status=excluded.status,
        error_message=excluded.error_message,
        updated_at=excluded.updated_at
    `, [
      value.id as SQLInputValue,
      value.projectId as SQLInputValue,
      value.revisionId as SQLInputValue,
      value.sourceContentHash as SQLInputValue,
      value.rendererId,
      value.rendererVersion,
      value.previewProfile,
      value.cacheKey,
      value.cachePath,
      value.mimeType,
      value.size,
      value.status,
      value.errorMessage ?? null,
      value.createdAt,
      value.updatedAt,
    ])
  }

  #upsertNote(value: Note): void {
    this.#database.prepare(`
      INSERT INTO notes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET anchor_scope=excluded.anchor_scope, artifact_id=excluded.artifact_id, artifact_view_id=excluded.artifact_view_id, page_index=excluded.page_index, body=excluded.body, updated_at=excluded.updated_at
    `).run(value.id as SQLInputValue, value.projectId as SQLInputValue, JSON.stringify(value.anchor),
      (value.anchor.type === 'artifact' ? value.anchor.artifactId : value.anchor.type === 'page' ? value.anchor.revisionId : null) ?? null,
      (value.anchor.type === 'artifact_view' ? value.anchor.viewId : null) ?? null,
      (value.anchor.type === 'page' ? value.anchor.pageIndex : null) ?? null,
      value.body, value.createdAt, value.updatedAt)
  }

  #upsertCheckpoint(value: Checkpoint): void {
    this.#database.prepare(`
      INSERT INTO checkpoints VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run(value.id as SQLInputValue, value.projectId as SQLInputValue, value.scopeId as SQLInputValue, value.label, JSON.stringify(value.snapshotJson), value.createdAt)
  }

  #runStatement(
    context: Omit<MetadataForeignKeyContext, 'foreignKeyCheck'>,
    sql: string,
    values: readonly SQLInputValue[],
  ): void {
    try {
      this.#database.prepare(sql).run(...values)
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('FOREIGN KEY constraint failed')) {
        throw new MetadataForeignKeyConstraintError({
          ...context,
          foreignKeyCheck: this.foreignKeyCheck(),
        }, error)
      }
      throw error
    }
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
    const focusedViewIds = json<Workspace['focusedViewIds']>((row.focused_node_ids ?? '[]') as SQLInputValue)
    const visibleLayers = json<string[]>((row.visible_layers ?? '["core","process"]') as SQLInputValue)
    const contextPolicy = (String(row.context_policy ?? 'selection-only')) as Workspace['contextPolicy']
    const updatedAt = String(row.updated_at)
    return { id, projectId, scopeId, name, intent, viewport, focusedViewIds, visibleLayers, contextPolicy, updatedAt }
  }

  #artifact(row: Row): Artifact {
    return { id: row.id as ArtifactId, projectId: row.project_id as ProjectId, title: String(row.title), kind: String(row.kind) as Artifact['kind'], availability: String(row.availability) as Artifact['availability'], ...(row.current_revision_id === null || row.current_revision_id === undefined ? {} : { currentRevisionId: row.current_revision_id as ArtifactRevisionId }), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
  }

  #artifactView(row: Row): ArtifactView {
    return { id: row.id as ArtifactViewId, artifactId: row.artifact_id as ArtifactId, scopeId: (row.scope_id ?? '') as unknown as ScopeId, ...(row.revision_id ? { revisionId: row.revision_id as ArtifactRevisionId } : {}), referenceKind: String(row.reference_kind) as ArtifactView['referenceKind'], position: json<ArtifactView['position']>(row.position as SQLInputValue), size: json<ArtifactView['size']>(row.size as SQLInputValue), displayMode: String(row.display_mode) as ArtifactView['displayMode'], collapsed: (row.collapsed as number) === 1 } as ArtifactView
  }

  #relation(row: Row): Relation {
    return { id: row.id as RelationId, projectId: row.project_id as ProjectId, sourceEntityType: String(row.source_entity_type) as Relation['sourceEntityType'], sourceEntityId: String(row.source_entity_id), targetEntityType: String(row.target_entity_type) as Relation['targetEntityType'], targetEntityId: String(row.target_entity_id), kind: String(row.kind), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
  }

  #artifactRevision(row: Row): ArtifactRevision {
    return { id: row.id as ArtifactRevisionId, artifactId: row.artifact_id as ArtifactId, fileRecordId: row.file_record_id as FileRecordId, contentHash: String(row.content_hash) as ArtifactRevision['contentHash'], source: String(row.source) as ArtifactRevision['source'], status: String(row.status) as ArtifactRevision['status'], createdAt: String(row.created_at), ...(row.parent_revision_id ? { parentRevisionId: row.parent_revision_id as ArtifactRevisionId } : {}), ...(row.run_id ? { runId: row.run_id as ArtifactRevision['runId'] } : {}) } as ArtifactRevision
  }

  #fileRecord(row: Row): FileRecord {
    return {
      id: row.id as FileRecordId,
      projectId: row.project_id as ProjectId,
      observedPath: String(row.observed_path),
      observedHash: String(row.observed_hash) as FileRecord['observedHash'],
      size: Number(row.size),
      modifiedAt: String(row.modified_at),
      mimeType: String(row.mime_type),
      availability: String(row.availability) as FileRecord['availability'],
      observedAt: String(row.observed_at),
    }
  }

  #previewRecord(row: Row): PreviewRecord {
    return {
      id: row.id as PreviewRecordId,
      projectId: row.project_id as ProjectId,
      revisionId: row.revision_id as ArtifactRevisionId,
      sourceContentHash: String(row.source_content_hash) as PreviewRecord['sourceContentHash'],
      rendererId: String(row.renderer_id),
      rendererVersion: String(row.renderer_version),
      previewProfile: String(row.preview_profile),
      cacheKey: String(row.cache_key),
      cachePath: String(row.cache_path),
      mimeType: String(row.mime_type),
      size: Number(row.size),
      status: String(row.status) as PreviewRecord['status'],
      ...(row.error_message ? { errorMessage: String(row.error_message) } : {}),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }
  }

  #note(row: Row): Note {
    const anchor = json<Note['anchor']>(row.anchor_scope as SQLInputValue)
    return { id: row.id as NoteId, projectId: row.project_id as ProjectId, anchor, body: String(row.body), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
  }

  #checkpoint(row: Row): Checkpoint {
    return { id: row.id as CheckpointId, projectId: row.project_id as ProjectId, scopeId: (row.scope_id ?? '') as unknown as ScopeId, label: String(row.label ?? ''), snapshotJson: json<Checkpoint['snapshotJson']>(row.snapshot_json as SQLInputValue), createdAt: String(row.created_at) }
  }
}

// ==================== Module helpers ====================

/** Presentation-only ops — do NOT advance graphVersion. */
const PRESENTATION_OPS = new Set([
  'move_artifact_view',
  'resize_artifact_view',
  'update_workspace_viewport',
  'update_workspace_presentation',
  'update_artifact_view_presentation',
  'delete_artifact_view',
])

function isSemanticOp(op: { type: string }): boolean {
  return !PRESENTATION_OPS.has(op.type) && op.type !== 'bootstrap'
}

function resolveProjectId(ops: readonly { type: string; [key: string]: unknown }[]): string | null {
  for (const op of ops) {
    if (op.type === 'bootstrap' && op.snapshot) return String((op.snapshot as { project?: { id?: string } })?.project?.id ?? '')
    // Direct projectId on operation-level payload
    if (op.projectId) return String(op.projectId)
    // Nested entity payloads
    for (const key of ['artifact', 'workspace', 'scope', 'view', 'relation', 'note'] as const) {
      const entity = (op as Record<string, Record<string, unknown> | undefined>)[key]
      if (entity?.projectId) return String(entity.projectId)
    }
  }
  return null
}

function entityIdForOperation(op: MutationBatch['ops'][number] | undefined): string {
  if (op === undefined) return 'unknown'
  if ('artifact' in op) return String(op.artifact.id)
  if ('view' in op) return String(op.view.id)
  if ('workspace' in op) return String(op.workspace.id)
  if ('scope' in op) return String(op.scope.id)
  if ('relation' in op) return String(op.relation.id)
  if ('note' in op) return String(op.note.id)
  if ('viewId' in op) return String(op.viewId)
  if ('workspaceId' in op) return String(op.workspaceId)
  if ('relationId' in op) return String(op.relationId)
  return op.type
}

function tableForOperation(op: MutationBatch['ops'][number] | undefined): string {
  if (op === undefined) return 'unknown'
  if (op.type.includes('workspace')) return 'workspaces'
  if (op.type.includes('scope')) return 'scopes'
  if (op.type.includes('artifact_view')) return 'artifact_views'
  if (op.type.includes('artifact')) return 'artifacts'
  if (op.type.includes('relation')) return 'relations'
  if (op.type.includes('note')) return 'notes'
  return 'unknown'
}

function statementForOperation(op: MutationBatch['ops'][number] | undefined): string {
  if (op === undefined) return 'mutation'
  if (op.type.startsWith('upsert_')) return `INSERT INTO ${tableForOperation(op)}`
  if (op.type.startsWith('delete_')) return `DELETE FROM ${tableForOperation(op)}`
  if (op.type.startsWith('update_') || op.type.startsWith('move_') || op.type.startsWith('resize_')) return `UPDATE ${tableForOperation(op)}`
  return op.type
}
