import { existsSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
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
  HandoffRecord,
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
  RunEvent,
  RunEventId,
  SessionSummary,
  Scope,
  ScopeId,
  Workspace,
  WorkspaceId,
  WorkspaceMembership,
  WorkspaceMembershipSource,
} from '@local-creative-os/domain'
import type {
  AcceptArtifactReturnResult,
  ActiveContextV2,
  CaptureReceiptV0,
  CaptureStagingItemV0,
  CaptureWatchRuleV0,
  ReorganizeProposalV0,
  CommandDraftV1,
  ContextChangeProposalV1,
  ProviderSessionBindingV1,
  RunInputRequestV1,
  AnswerRunInputRequestV1,
  MutationBatch,
  PersistedContextManifestV0,
  PresentationViewV0,
  ProjectGraphSnapshot,
  RejectArtifactReturnResult,
  ResourceDescriptorV0,
  RetryRunResult,
} from '@local-creative-os/contracts'

type Row = Record<string, SQLInputValue | undefined>

function resourceDescriptorHash(descriptor: ResourceDescriptorV0): string {
  return createHash('sha256').update(JSON.stringify(descriptor)).digest('hex')
}

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

/** Phase A：统一 TitlePolicy。名称 ≠ Identity；mode 决定谁可以改显示名。 */
export type TitleModeV0 = 'auto' | 'manual' | 'locked'

export interface EntityTitleInputV0 {
  readonly title: string
  readonly mode: TitleModeV0
  readonly generatedBy?: string
}

const TITLE_TABLE_COLUMN: Record<'project' | 'workspace' | 'artifact' | 'scope', { readonly table: string; readonly column: string }> = {
  project: { table: 'projects', column: 'name' },
  workspace: { table: 'workspaces', column: 'name' },
  artifact: { table: 'artifacts', column: 'title' },
  scope: { table: 'scopes', column: 'name' },
}

export type TitleEntityKind = keyof typeof TITLE_TABLE_COLUMN

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
  #vectorLoaded = false
  #vectorLoadError: string | undefined

  constructor(databasePath: string, options: MetadataRepositoryOptions = {}) {
    this.databasePath = resolve(databasePath)
    this.#disposableOnly = options.disposableOnly ?? false
    mkdirSync(dirname(this.databasePath), { recursive: true })
    this.#database = new DatabaseSync(this.databasePath, { allowExtension: true })
    try {
      this.#database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')
      this.#migrate()
      this.#tryLoadVectorExtension()
    } catch (error: unknown) {
      this.#database.close()
      throw error
    }
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
    let current = Number((this.#database.prepare('PRAGMA user_version').get() as { user_version: number }).user_version)
    if (current === 0) { this.#migrate_001(); current = 6 }
    if (current === 1) { this.#migrate_002_from_v1(); current = 3 }
    if (current === 2) { this.#migrate_003_from_v2(); current = 3 }
    if (current === 3) { this.#migrate_004_from_v3(); current = 4 }
    if (current === 4) { this.#migrate_005_from_v4(); current = 5 }
    if (current === 5) { this.#migrate_006_from_v5(); current = 6 }
    if (current === 6) { this.#migrate_007_from_v6(); current = 7 }
    if (current === 7) { this.#migrate_008_from_v7(); current = 8 }
    if (current === 8) { this.#migrate_009_from_v8(); current = 9 }
    if (current === 9) { this.#migrate_010_from_v9(); current = 10 }
    if (current === 10) { this.#migrate_011_from_v10(); current = 11 }
    if (current === 11) { this.#migrate_012_from_v11(); current = 12 }
    if (current === 12) { this.#migrate_013_from_v12(); current = 13 }
    if (current === 13) { this.#migrate_014_from_v13(); current = 14 }
    if (current === 14) { this.#migrate_015_from_v14(); current = 15 }
    if (current === 15) { this.#migrate_016_from_v15(); current = 16 }
    if (current === 16) { this.#migrate_017_from_v16(); current = 17 }
    if (current === 17) { this.#migrate_018_from_v17(); current = 18 }
    if (current === 18) { this.#migrate_019_from_v18(); current = 19 }
    if (current === 19) { this.#migrate_020_from_v19(); current = 20 }
    if (current === 20) { this.#migrate_021_from_v20(); current = 21 }
    if (current === 21) { this.#migrate_022_from_v21(); current = 22 }
    if (current === 22) { this.#migrate_023_from_v22(); current = 23 }
    if (current === 23) { this.#migrate_024_from_v23(); current = 24 }
    if (current === 24) { this.#migrate_025_from_v24(); current = 25 }
    if (current === 25) { this.#migrate_026_from_v25(); current = 26 }
    if (current === 26) { this.#migrate_027_from_v26(); current = 27 }
    if (current === 27) { this.#migrate_028_from_v27(); current = 28 }
    if (current !== 28) throw new Error(`Unsupported metadata schema version ${current}.`)
  }

  #migrate_028_from_v27(): void {
    // Phase D: Reorganize proposals（Agent 画布整理，含回滚快照）。
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS reorganize_proposals (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        proposal_json TEXT NOT NULL,
        snapshot_json TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_reorganize_proposals_project
      ON reorganize_proposals(project_id);
      PRAGMA user_version = 28;
    `)
  }

  #migrate_027_from_v26(): void {
    // Phase C: Capture Watch 规则（截图/文件夹监控）。
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS capture_watch_rules (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        patterns_json TEXT NOT NULL,
        project_hint TEXT,
        settle_ms INTEGER NOT NULL DEFAULT 750,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      PRAGMA user_version = 27;
    `)
  }

  #migrate_026_from_v25(): void {
    // Phase C: Capture receipts —— operationId 幂等，<2s 返回收据。
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS capture_receipts (
        operation_id TEXT PRIMARY KEY,
        receipt_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      PRAGMA user_version = 26;
    `)
  }

  #migrate_025_from_v24(): void {
    // Phase B: Capture Staging Buffer —— transport buffer，不是 Inbox domain。
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS capture_staging_items (
        id TEXT PRIMARY KEY,
        operation_id TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL,
        payload_ref TEXT NOT NULL,
        source_json TEXT NOT NULL,
        suggested_projects_json TEXT NOT NULL,
        semantic_hint_json TEXT,
        captured_at TEXT NOT NULL,
        resolved_project_id TEXT,
        resolved_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_capture_staging_captured
      ON capture_staging_items(captured_at);
      PRAGMA user_version = 25;
    `)
  }

  #migrate_024_from_v23(): void {
    // Phase A: Zero Naming —— display title 与 identity 解耦。
    // title_mode: 'auto'（默认，Agent 可改）| 'manual'（用户改过，Agent 不覆盖）| 'locked'
    // 兼容策略：name/title 仍 NOT NULL（第一阶段存内部 fallback），只加 mode 标记。
    try { this.#database.exec(`ALTER TABLE projects ADD COLUMN title_mode TEXT NOT NULL DEFAULT 'auto'`) } catch {}
    try { this.#database.exec(`ALTER TABLE scopes ADD COLUMN title_mode TEXT NOT NULL DEFAULT 'auto'`) } catch {}
    try { this.#database.exec(`ALTER TABLE workspaces ADD COLUMN title_mode TEXT NOT NULL DEFAULT 'auto'`) } catch {}
    try { this.#database.exec(`ALTER TABLE artifacts ADD COLUMN title_mode TEXT NOT NULL DEFAULT 'auto'`) } catch {}
    this.#database.exec(`PRAGMA user_version = 24`)
  }

  #migrate_023_from_v22(): void {
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS search_documents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        title TEXT,
        body TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(project_id, entity_type, entity_id)
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS search_documents_fts USING fts5(
        entity_id UNINDEXED,
        project_id UNINDEXED,
        title,
        body
      );
      CREATE TABLE IF NOT EXISTS search_document_embeddings (
        entity_id TEXT NOT NULL,
        model TEXT NOT NULL,
        dimensions INTEGER,
        content_hash TEXT NOT NULL,
        embedding_blob BLOB,
        indexed_at TEXT NOT NULL,
        PRIMARY KEY(entity_id, model)
      );
      CREATE INDEX IF NOT EXISTS idx_search_documents_project
      ON search_documents(project_id);
      PRAGMA user_version = 23;
    `)
  }

  #migrate_022_from_v21(): void {
    try { this.#database.exec(`ALTER TABLE relations ADD COLUMN origin TEXT`) } catch {}
    try { this.#database.exec(`ALTER TABLE relations ADD COLUMN created_by TEXT`) } catch {}
    try { this.#database.exec(`ALTER TABLE relations ADD COLUMN evidence_json TEXT`) } catch {}
    try { this.#database.exec(`ALTER TABLE relations ADD COLUMN confidence REAL`) } catch {}
    this.#database.exec(`PRAGMA user_version = 22`)
  }

  #migrate_021_from_v20(): void {
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS presentation_views (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        scope_id TEXT NOT NULL REFERENCES scopes(id) ON DELETE CASCADE,
        capability TEXT NOT NULL,
        renderer TEXT NOT NULL,
        state_json TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_presentation_views_project
      ON presentation_views(project_id);
      CREATE INDEX IF NOT EXISTS idx_presentation_views_scope
      ON presentation_views(project_id, scope_id);
      PRAGMA user_version = 21;
    `)
  }


  #migrate_020_from_v19(): void {
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS handoffs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        resume_mode TEXT NOT NULL DEFAULT 'standard-handoff',
        from_provider TEXT,
        to_provider TEXT,
        session_summary_id TEXT,
        context_snapshot_id TEXT,
        decisions TEXT NOT NULL DEFAULT '[]',
        open_questions TEXT NOT NULL DEFAULT '[]',
        next_actions TEXT NOT NULL DEFAULT '[]',
        artifact_refs TEXT NOT NULL DEFAULT '[]',
        message_refs TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      PRAGMA user_version = 20;
    `)
  }

  #migrate_019_from_v18(): void {
    try { this.#database.exec(`ALTER TABLE workspaces ADD COLUMN frame_bounds TEXT`) } catch {}
    try { this.#database.exec(`ALTER TABLE workspaces ADD COLUMN preferred_surface TEXT`) } catch {}
    try { this.#database.exec(`ALTER TABLE workspaces ADD COLUMN version INTEGER NOT NULL DEFAULT 0`) } catch {}
    this.#database.exec(`PRAGMA user_version = 19`)
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
        updated_at TEXT NOT NULL,
        frame_bounds TEXT,
        preferred_surface TEXT,
        version INTEGER NOT NULL DEFAULT 0
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
        updated_at TEXT NOT NULL,
        frame_bounds TEXT,
        preferred_surface TEXT,
        version INTEGER NOT NULL DEFAULT 0
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
    try { this.#database.exec(`ALTER TABLE workspaces ADD COLUMN frame_bounds TEXT`) } catch {}
    try { this.#database.exec(`ALTER TABLE workspaces ADD COLUMN preferred_surface TEXT`) } catch {}
    try { this.#database.exec(`ALTER TABLE workspaces ADD COLUMN version INTEGER NOT NULL DEFAULT 0`) } catch {}
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
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        scope_id TEXT NOT NULL, name TEXT NOT NULL, intent TEXT,
        viewport TEXT NOT NULL, focused_node_ids TEXT NOT NULL DEFAULT '[]',
        visible_layers TEXT NOT NULL DEFAULT '["core","process"]',
        context_policy TEXT NOT NULL DEFAULT 'selection-only',
        updated_at TEXT NOT NULL,
        frame_bounds TEXT,
        preferred_surface TEXT,
        version INTEGER NOT NULL DEFAULT 0
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
      COMMIT;
    `)
  }

  #migrate_007_from_v6(): void {
    this.#database.exec(`
      BEGIN;
      CREATE TABLE resource_descriptors (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        artifact_id TEXT NOT NULL,
        source_revision_id TEXT NOT NULL,
        descriptor_version TEXT NOT NULL,
        analyzer_version TEXT NOT NULL,
        status TEXT NOT NULL
          CHECK(status IN ('pending','ready','partial','failed')),
        source_content_hash TEXT,
        descriptor_hash TEXT NOT NULL,
        descriptor_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(project_id) REFERENCES projects(id),
        FOREIGN KEY(artifact_id) REFERENCES artifacts(id),
        FOREIGN KEY(source_revision_id) REFERENCES artifact_revisions(id),
        UNIQUE(artifact_id, source_revision_id, analyzer_version)
      );
      CREATE INDEX idx_resource_descriptors_project ON resource_descriptors(project_id);
      CREATE INDEX idx_resource_descriptors_status ON resource_descriptors(status);
      PRAGMA user_version = 7;
      COMMIT;
    `)
  }

  #migrate_008_from_v7(): void {
    this.#database.exec(`
      BEGIN;
      CREATE TABLE resource_analysis_jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        resource_id TEXT NOT NULL,
        source_revision_id TEXT NOT NULL REFERENCES artifact_revisions(id) ON DELETE CASCADE,
        analyzer_version TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending','running','retryable','failed','completed')),
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        next_attempt_at TEXT,
        lease_owner TEXT,
        lease_expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(resource_id, source_revision_id, analyzer_version)
      );
      CREATE INDEX idx_resource_analysis_jobs_ready
        ON resource_analysis_jobs(status, next_attempt_at, created_at);
      CREATE TABLE resource_policies (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        resource_id TEXT NOT NULL,
        trust_level TEXT NOT NULL DEFAULT 'untrusted' CHECK(trust_level IN ('untrusted','reviewed','trusted')),
        approved_context INTEGER NOT NULL DEFAULT 0 CHECK(approved_context IN (0,1)),
        executable INTEGER NOT NULL DEFAULT 0 CHECK(executable IN (0,1)),
        annotation_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL,
        PRIMARY KEY(project_id, resource_id)
      );
      PRAGMA user_version = 8;
      COMMIT;
    `)
  }

  #migrate_009_from_v8(): void {
    this.#database.exec(`
      PRAGMA legacy_alter_table = ON;
      ALTER TABLE artifact_returns RENAME TO artifact_returns_v8;
      ALTER TABLE runtime_bindings RENAME TO runtime_bindings_v8;
      ALTER TABLE runtime_dispatches RENAME TO runtime_dispatches_v8;
      ALTER TABLE runs RENAME TO runs_v8;
      CREATE TABLE runs (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
        target_artifact_id TEXT REFERENCES artifacts(id) ON DELETE RESTRICT,
        target_revision_id TEXT REFERENCES artifact_revisions(id) ON DELETE RESTRICT,
        context_manifest_id TEXT NOT NULL REFERENCES context_manifests(id) ON DELETE RESTRICT,
        retry_of_run_id TEXT REFERENCES runs(id) ON DELETE RESTRICT,
        provider TEXT NOT NULL CHECK(provider IN ('workbuddy','codex')),
        requested_provider TEXT NOT NULL CHECK(requested_provider IN ('workbuddy','codex')),
        output_intent TEXT NOT NULL CHECK(output_intent IN ('create','revise','analyze')),
        return_group_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('created','queued','running','waiting_input','completed','failed','cancelled')),
        instruction TEXT NOT NULL, result_summary TEXT, short_summary TEXT, error_code TEXT, error_message TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, completed_at TEXT
      );
      INSERT INTO runs SELECT id, project_id, workspace_id, target_artifact_id, target_revision_id,
        context_manifest_id, retry_of_run_id, provider, provider, 'revise', 'return-group-' || id,
        status, instruction, result_summary, short_summary, error_code, error_message, created_at, updated_at, completed_at FROM runs_v8;
      CREATE TABLE runtime_dispatches (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL UNIQUE REFERENCES runs(id) ON DELETE CASCADE,
        provider TEXT NOT NULL CHECK(provider IN ('workbuddy','codex')), idempotency_key TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK(status IN ('planned','dispatching','bound','failed','recovery_required')),
        attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count >= 0), last_error_code TEXT, last_error_message TEXT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO runtime_dispatches SELECT * FROM runtime_dispatches_v8;
      CREATE TABLE runtime_bindings (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL UNIQUE REFERENCES runs(id) ON DELETE CASCADE,
        provider TEXT NOT NULL CHECK(provider IN ('workbuddy','codex')), external_task_id TEXT, external_session_id TEXT,
        provider_status TEXT, last_synced_at TEXT, finalize_pending INTEGER NOT NULL DEFAULT 0 CHECK(finalize_pending IN (0,1)),
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(provider, external_task_id)
      );
      INSERT INTO runtime_bindings SELECT * FROM runtime_bindings_v8;
      CREATE TABLE artifact_returns (
        id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        target_artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE RESTRICT,
        base_revision_id TEXT NOT NULL REFERENCES artifact_revisions(id) ON DELETE RESTRICT,
        returned_file_id TEXT NOT NULL REFERENCES file_records(id) ON DELETE RESTRICT,
        content_hash TEXT NOT NULL, canonical_path TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action = 'created'),
        status TEXT NOT NULL CHECK(status IN ('pending_review','adopted','rejected')),
        draft_revision_id TEXT REFERENCES artifact_revisions(id) ON DELETE RESTRICT,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        UNIQUE(run_id, canonical_path, content_hash, action)
      );
      INSERT INTO artifact_returns SELECT * FROM artifact_returns_v8;
      DROP TABLE artifact_returns_v8;
      DROP TABLE runtime_bindings_v8;
      DROP TABLE runtime_dispatches_v8;
      DROP TABLE runs_v8;
      CREATE INDEX idx_runs_project_status ON runs(project_id, status);
      CREATE INDEX idx_runtime_dispatches_status ON runtime_dispatches(status);
      CREATE INDEX idx_runtime_bindings_provider_status ON runtime_bindings(provider, provider_status);
      PRAGMA legacy_alter_table = OFF;
      PRAGMA user_version = 9;
    `)
  }

  #migrate_010_from_v9(): void {
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS run_events (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        occurred_at TEXT NOT NULL,
        UNIQUE(run_id, sequence)
      );
      CREATE INDEX IF NOT EXISTS idx_run_events_run_sequence ON run_events(run_id, sequence);
      PRAGMA user_version = 10;
    `)
  }

  #migrate_011_from_v10(): void {
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS workspace_memberships (
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        artifact_view_id TEXT NOT NULL REFERENCES artifact_views(id) ON DELETE CASCADE,
        added_at TEXT NOT NULL,
        added_by TEXT NOT NULL CHECK(added_by IN ('user','agent','run','import')),
        sort_order INTEGER,
        PRIMARY KEY(workspace_id, artifact_view_id)
      );
      CREATE INDEX IF NOT EXISTS idx_workspace_memberships_view ON workspace_memberships(artifact_view_id);
      ALTER TABLE runs ADD COLUMN result_policy TEXT;
      PRAGMA user_version = 11;
    `)
  }

  #migrate_012_from_v11(): void {
    this.#database.exec(`
      ALTER TABLE artifacts ADD COLUMN managed INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE checkpoints ADD COLUMN workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL;
      CREATE TABLE IF NOT EXISTS session_summaries (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        run_ids TEXT NOT NULL DEFAULT '[]',
        handoff_ref TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      PRAGMA user_version = 12;
    `)
  }

  #migrate_013_from_v12(): void {
    this.#database.exec(`
      ALTER TABLE projects ADD COLUMN last_opened_at TEXT;
      PRAGMA user_version = 13;
    `)
  }

  #migrate_014_from_v13(): void {
    this.#database.exec(`
      BEGIN;
      CREATE TABLE IF NOT EXISTS active_contexts (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        workspace_key TEXT NOT NULL,
        version INTEGER NOT NULL CHECK(version >= 0),
        projection_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(project_id, workspace_key)
      );
      CREATE TABLE IF NOT EXISTS context_proposals (
        proposal_id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        workspace_key TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending','accepted','rejected','stale')),
        proposal_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_context_proposals_project_status
        ON context_proposals(project_id, workspace_key, status, created_at);
      CREATE TABLE IF NOT EXISTS command_drafts (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        workspace_key TEXT NOT NULL,
        composer_anchor TEXT NOT NULL,
        prompt TEXT NOT NULL,
        context_view_ids_json TEXT NOT NULL DEFAULT '[]',
        provider TEXT NOT NULL DEFAULT 'auto',
        create_as_new_node INTEGER NOT NULL DEFAULT 0 CHECK(create_as_new_node IN (0,1)),
        updated_at TEXT NOT NULL,
        PRIMARY KEY(project_id, workspace_key, composer_anchor)
      );
      CREATE TABLE IF NOT EXISTS provider_session_bindings (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        provider TEXT NOT NULL CHECK(provider IN ('codex','workbuddy')),
        external_session_id TEXT NOT NULL,
        origin TEXT NOT NULL CHECK(origin IN ('manual','watchdog')),
        status TEXT NOT NULL CHECK(status IN ('active','stale','closed')),
        last_seen_at TEXT NOT NULL,
        last_run_id TEXT,
        lease_owner TEXT,
        lease_expires_at TEXT,
        failure_count INTEGER NOT NULL DEFAULT 0 CHECK(failure_count >= 0),
        updated_at TEXT NOT NULL,
        PRIMARY KEY(project_id, provider)
      );
      PRAGMA user_version = 14;
      COMMIT;
    `)
  }

  #migrate_015_from_v14(): void {
    this.#database.exec(`
      BEGIN;
      CREATE TABLE IF NOT EXISTS run_input_requests (
        request_id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        options_json TEXT NOT NULL DEFAULT '[]',
        allow_free_text INTEGER NOT NULL DEFAULT 1 CHECK(allow_free_text IN (0,1)),
        context_version INTEGER,
        status TEXT NOT NULL CHECK(status IN ('pending','answered','cancelled')),
        answer_text TEXT,
        selected_options_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        answered_at TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_run_input_requests_run_status
        ON run_input_requests(run_id, status, created_at);
      PRAGMA user_version = 15;
      COMMIT;
    `)
  }

  #migrate_016_from_v15(): void {
    this.#database.exec(`
      BEGIN;
      CREATE TABLE IF NOT EXISTS conversation_import_sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        source_kind TEXT NOT NULL CHECK(source_kind IN ('codex','chatgpt','claude','manual')),
        title TEXT NOT NULL,
        source_file_name TEXT NOT NULL,
        expected_bytes INTEGER,
        received_bytes INTEGER NOT NULL DEFAULT 0,
        received_chunks INTEGER NOT NULL DEFAULT 0,
        workspace_id TEXT,
        scope_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('receiving','parsing','ready','failed')),
        staging_path TEXT NOT NULL,
        conversation_id TEXT REFERENCES conversation_sessions(id) ON DELETE SET NULL,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS conversation_import_chunks (
        import_session_id TEXT NOT NULL REFERENCES conversation_import_sessions(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL CHECK(chunk_index >= 0),
        size INTEGER NOT NULL CHECK(size >= 0),
        content_hash TEXT NOT NULL,
        chunk_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(import_session_id, chunk_index)
      );
      CREATE TABLE IF NOT EXISTS conversation_sessions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        source_kind TEXT NOT NULL CHECK(source_kind IN ('codex','chatgpt','claude','manual')),
        title TEXT NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0,
        section_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL CHECK(status IN ('receiving','parsing','ready','failed')),
        source_content_hash TEXT,
        source_file_name TEXT,
        source_path TEXT,
        origin_meta_json TEXT NOT NULL DEFAULT '{}',
        conversation_artifact_id TEXT REFERENCES artifacts(id) ON DELETE SET NULL,
        conversation_view_id TEXT REFERENCES artifact_views(id) ON DELETE SET NULL,
        imported_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_conversation_sessions_project
        ON conversation_sessions(project_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS conversation_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL CHECK(seq >= 0),
        role TEXT NOT NULL CHECK(role IN ('user','assistant','tool','system','event')),
        event_kind TEXT NOT NULL,
        source_event_id TEXT,
        content_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        tool_name TEXT,
        tool_call_json TEXT,
        file_refs_json TEXT NOT NULL DEFAULT '[]',
        parent_id TEXT,
        pinned_as_decision INTEGER NOT NULL DEFAULT 0 CHECK(pinned_as_decision IN (0,1)),
        decision_artifact_id TEXT REFERENCES artifacts(id) ON DELETE SET NULL,
        content_hash TEXT NOT NULL,
        UNIQUE(session_id, seq),
        UNIQUE(session_id, content_hash, created_at, role)
      );
      CREATE INDEX IF NOT EXISTS idx_conversation_messages_session_seq
        ON conversation_messages(session_id, seq);
      CREATE TABLE IF NOT EXISTS conversation_sections (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
        seq INTEGER NOT NULL CHECK(seq >= 0),
        kind TEXT NOT NULL CHECK(kind IN ('turn','instruction','tool_cluster','long_message')),
        title TEXT NOT NULL,
        start_seq INTEGER NOT NULL,
        end_seq INTEGER NOT NULL,
        locked_by_user INTEGER NOT NULL DEFAULT 0 CHECK(locked_by_user IN (0,1)),
        derived_at TEXT NOT NULL,
        UNIQUE(session_id, seq)
      );
      CREATE INDEX IF NOT EXISTS idx_conversation_sections_session_range
        ON conversation_sections(session_id, start_seq, end_seq);
      CREATE TABLE IF NOT EXISTS conversation_section_annotations (
        section_id TEXT PRIMARY KEY REFERENCES conversation_sections(id) ON DELETE CASCADE,
        source_hash TEXT NOT NULL,
        title TEXT NOT NULL,
        decisions_json TEXT NOT NULL DEFAULT '[]',
        todos_json TEXT NOT NULL DEFAULT '[]',
        involved_files_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL CHECK(status IN ('none','ready','failed')),
        annotated_by TEXT NOT NULL CHECK(annotated_by IN ('agent','user')),
        annotated_at TEXT NOT NULL
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS conversation_messages_fts USING fts5(
        message_id UNINDEXED,
        session_id UNINDEXED,
        project_id UNINDEXED,
        role,
        content_text,
        tokenize='unicode61 remove_diacritics 2'
      );
      CREATE TABLE IF NOT EXISTS conversation_embedding_jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        session_id TEXT REFERENCES conversation_sessions(id) ON DELETE CASCADE,
        provider TEXT NOT NULL DEFAULT 'ollama',
        model TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending','running','ready','partial','failed')),
        attempt_count INTEGER NOT NULL DEFAULT 0,
        indexed_messages INTEGER NOT NULL DEFAULT 0,
        stale_messages INTEGER NOT NULL DEFAULT 0,
        dimensions INTEGER,
        backend TEXT NOT NULL CHECK(backend IN ('sqlite-vec','sqlite-blob-fallback')),
        last_error TEXT,
        lease_owner TEXT,
        lease_expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_conversation_embedding_jobs_project
        ON conversation_embedding_jobs(project_id, status, updated_at);
      CREATE TABLE IF NOT EXISTS conversation_embeddings (
        message_id TEXT NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
        model TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        embedding_blob BLOB NOT NULL,
        indexed_at TEXT NOT NULL,
        PRIMARY KEY(message_id, model)
      );
      PRAGMA user_version = 16;
      COMMIT;
    `)
  }

  #migrate_017_from_v16(): void {
    this.#database.exec(`
      BEGIN;
      DELETE FROM conversation_messages_fts;
      INSERT INTO conversation_messages_fts(message_id, session_id, project_id, role, content_text)
      SELECT m.id, m.session_id, s.project_id, m.role, m.content_text
      FROM conversation_messages m JOIN conversation_sessions s ON s.id = m.session_id;
      CREATE TRIGGER IF NOT EXISTS conversation_messages_fts_insert AFTER INSERT ON conversation_messages BEGIN
        INSERT INTO conversation_messages_fts(message_id, session_id, project_id, role, content_text)
        SELECT NEW.id, NEW.session_id, s.project_id, NEW.role, NEW.content_text
        FROM conversation_sessions s WHERE s.id = NEW.session_id;
      END;
      CREATE TRIGGER IF NOT EXISTS conversation_messages_fts_update AFTER UPDATE OF role, content_text, session_id ON conversation_messages BEGIN
        DELETE FROM conversation_messages_fts WHERE message_id = OLD.id;
        INSERT INTO conversation_messages_fts(message_id, session_id, project_id, role, content_text)
        SELECT NEW.id, NEW.session_id, s.project_id, NEW.role, NEW.content_text
        FROM conversation_sessions s WHERE s.id = NEW.session_id;
      END;
      CREATE TRIGGER IF NOT EXISTS conversation_messages_fts_delete AFTER DELETE ON conversation_messages BEGIN
        DELETE FROM conversation_messages_fts WHERE message_id = OLD.id;
      END;
      PRAGMA user_version = 17;
      COMMIT;
    `)
  }


  #migrate_018_from_v17(): void {
    const backupPath = `${this.databasePath}.v17.bak`
    if (!existsSync(backupPath)) {
      this.#database.exec(`VACUUM INTO '${backupPath.replaceAll("'", "''")}'`)
    }
    this.#database.exec(`
      BEGIN;
      ALTER TABLE conversation_sessions ADD COLUMN parsed_line_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE conversation_sessions ADD COLUMN invalid_line_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE conversation_sessions ADD COLUMN ignored_event_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE conversation_sessions ADD COLUMN duplicate_event_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE conversation_sessions ADD COLUMN matched_file_reference_count INTEGER NOT NULL DEFAULT 0;

      ALTER TABLE conversation_messages ADD COLUMN embedding_input_hash TEXT;
      ALTER TABLE conversation_messages ADD COLUMN embedding_version TEXT;

      ALTER TABLE conversation_embedding_jobs ADD COLUMN index_version TEXT NOT NULL DEFAULT 'message-v1';
      ALTER TABLE conversation_embedding_jobs ADD COLUMN force_rebuild INTEGER NOT NULL DEFAULT 0 CHECK(force_rebuild IN (0,1));
      ALTER TABLE conversation_embedding_jobs ADD COLUMN batch_size INTEGER NOT NULL DEFAULT 16 CHECK(batch_size BETWEEN 1 AND 64);
      ALTER TABLE conversation_embedding_jobs ADD COLUMN next_attempt_at TEXT;

      ALTER TABLE conversation_embeddings ADD COLUMN input_hash TEXT;
      ALTER TABLE conversation_embeddings ADD COLUMN embedding_version TEXT NOT NULL DEFAULT 'legacy-v0';
      UPDATE conversation_embeddings SET input_hash=content_hash WHERE input_hash IS NULL;

      CREATE TABLE conversation_file_references (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL REFERENCES conversation_messages(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL CHECK(ordinal >= 0),
        raw TEXT NOT NULL,
        normalized TEXT,
        artifact_id TEXT REFERENCES artifacts(id) ON DELETE SET NULL,
        relation_id TEXT REFERENCES relations(id) ON DELETE SET NULL,
        in_project INTEGER NOT NULL DEFAULT 0 CHECK(in_project IN (0,1)),
        created_at TEXT NOT NULL,
        UNIQUE(message_id, ordinal)
      );
      CREATE INDEX idx_conversation_file_refs_message
        ON conversation_file_references(message_id, ordinal);
      CREATE INDEX idx_conversation_file_refs_artifact
        ON conversation_file_references(artifact_id, message_id);

      PRAGMA user_version = 18;
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
      schemaVersion: 7,
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
          case 'update_workspace_frame': {
            const current = this.#database.prepare('SELECT version FROM workspaces WHERE id = ?').get(op.workspaceId as SQLInputValue) as Row | undefined
            if (current === undefined) throw new Error(`WORKSPACE_NOT_FOUND: ${String(op.workspaceId)}`)
            const currentVersion = (current.version as number) ?? 0
            if (op.expectedVersion !== undefined && currentVersion !== op.expectedVersion) {
              const err = new Error(`Workspace frame version conflict: expected ${op.expectedVersion}, current ${currentVersion}.`) as unknown as Record<string, unknown>
              err.code = 'STALE_WORKSPACE_VERSION'
              err.currentVersion = currentVersion
              throw err
            }
            const nextVersion = currentVersion + 1
            this.#database.prepare('UPDATE workspaces SET frame_bounds = ?, preferred_surface = ?, version = ?, updated_at = ? WHERE id = ?')
              .run(
                op.frameBounds === undefined ? null : JSON.stringify(op.frameBounds),
                op.preferredSurface ?? null,
                nextVersion,
                new Date().toISOString(),
                op.workspaceId as SQLInputValue,
              )
            break
          }
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

  getScopes(projectId: string): Scope[] {
    return (this.#database.prepare('SELECT * FROM scopes WHERE project_id = ?').all(projectId as SQLInputValue) as Row[]).map((row) => this.#scope(row as Row))
  }

  /**
   * Phase A：更新任意可展示实体的显示标题。
   * mode='manual'（用户改过）→ Agent 不得自动覆盖；mode='locked' → 任何 Agent 不能改。
   * 表/列来自内部白名单，不接受外部拼接。
   */
  updateEntityTitle(entity: TitleEntityKind, id: string, input: EntityTitleInputV0): void {
    const { table, column } = TITLE_TABLE_COLUMN[entity]
    const title = input.title.trim()
    if (title.length === 0 || title.length > 500) throw new Error('Title must be 1..500 characters.')
    const now = new Date().toISOString()
    const result = this.#database.prepare(
      `UPDATE ${table} SET ${column} = ?, title_mode = ?, updated_at = ? WHERE id = ?`,
    ).run(title, input.mode, now, id as SQLInputValue)
    if (result.changes !== 1) throw new Error(`${entity} not found.`)
  }

  getEntityTitleMode(entity: TitleEntityKind, id: string): TitleModeV0 | undefined {
    const { table } = TITLE_TABLE_COLUMN[entity]
    const row = this.#database.prepare(`SELECT title_mode FROM ${table} WHERE id = ?`).get(id as SQLInputValue) as Row | undefined
    if (row === undefined || row.title_mode === undefined || row.title_mode === null) return undefined
    return String(row.title_mode) as TitleModeV0
  }

  listProjects(): Project[] {
    return (this.#database.prepare('SELECT * FROM projects ORDER BY COALESCE(last_opened_at, created_at) DESC, id').all() as Row[]).map((r) => this.#project(r as Row))
  }

  touchProjectOpened(projectId: ProjectId, openedAt: string): Project {
    const result = this.#database.prepare(
      'UPDATE projects SET last_opened_at = ?, updated_at = ? WHERE id = ?',
    ).run(openedAt, openedAt, projectId as SQLInputValue)
    if (result.changes !== 1) throw new Error('Project not found.')
    const project = this.getProject(String(projectId))
    if (project === undefined) throw new Error('Project not found after touch.')
    return project
  }

  createProject(input: {
    readonly id: ProjectId
    readonly name: string
    readonly rootPath: string
  }): void {
    if (this.getProject(String(input.id)) !== undefined) {
      throw new Error(`Project already exists: ${String(input.id)}`)
    }
    const createdAt = new Date().toISOString()
    const rootScopeId = `scope-${String(input.id)}-root` as ScopeId
    const defaultWorkspaceId = `workspace-${String(input.id)}-main` as WorkspaceId
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      this.#upsertProject({
        id: input.id,
        name: input.name,
        rootPath: input.rootPath,
        graphVersion: 1 as GraphVersion,
        createdAt,
        updatedAt: createdAt,
      })
      this.#upsertScope({
        id: rootScopeId,
        projectId: input.id,
        parentScopeId: null,
        containerViewId: null,
        kind: 'root',
        name: 'Root',
        createdAt,
        updatedAt: createdAt,
      }, input.id)
      this.#upsertWorkspace({
        id: defaultWorkspaceId,
        projectId: input.id,
        scopeId: rootScopeId,
        name: 'Main',
        intent: null,
        viewport: { x: 0, y: 0, zoom: 1 },
        focusedViewIds: [],
        visibleLayers: ['core', 'process'],
        contextPolicy: 'selection-only',
        updatedAt: createdAt,
      })
      this.#database.exec('COMMIT;')
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
  }

  deleteProject(projectId: string): void {
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      for (const sql of PROJECT_TRUTH_DELETE_SQL) {
        try {
          this.#database.prepare(sql).run(projectId as SQLInputValue)
        } catch (error: unknown) {
          console.error(`[LocalCore] deleteProject failed at: ${sql.slice(0, 110)}`, error)
          throw error
        }
      }
      this.#database.exec('COMMIT;')
    } catch (error: unknown) {
      try { this.#database.exec('ROLLBACK;') } catch { /* already rolled back */ }
      throw error
    }
  }

  /**
   * .lcosproj P1：把单个 Project 的完整真相（Canvas + Content + Work History + Memberships）
   * 原样拷贝到目标 SQLite 文件。目标文件必须已由同一 Schema（v12）初始化。
   */
  exportProjectTruth(projectId: ProjectId, targetDbPath: string): Record<string, number> {
    const counts: Record<string, number> = {}
    this.#database.prepare('ATTACH DATABASE ? AS dst').run(targetDbPath)
    try {
      for (const table of PROJECT_TRUTH_TABLES) {
        const sql = `INSERT INTO dst.${table.table} SELECT * FROM main.${table.table} WHERE ${table.where}`
        const result = this.#database.prepare(sql).run(projectId as SQLInputValue)
        counts[table.table] = Number(result.changes)
      }
      this.#database.exec('DETACH DATABASE dst')
    } catch (error: unknown) {
      try { this.#database.exec('DETACH DATABASE dst') } catch { /* 忽略二次 DETACH */ }
      throw error
    }
    return counts
  }

  /**
   * .lcosproj P1：从工程文件导入同一 Project（先按反向 FK 顺序清空本库该项目的旧行，再整表插入）。
   */
  importProjectTruth(sourceDbPath: string, projectId: ProjectId): Record<string, number> {
    const counts: Record<string, number> = {}
    this.#database.prepare('ATTACH DATABASE ? AS src').run(sourceDbPath)
    const foreignKeys = (this.#database.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }).foreign_keys
    this.#database.exec('PRAGMA foreign_keys = OFF')
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      for (const sql of PROJECT_TRUTH_DELETE_SQL) {
        this.#database.prepare(sql).run(projectId as SQLInputValue)
      }
      for (const table of PROJECT_TRUTH_TABLES) {
        const sql = `INSERT INTO main.${table.table} SELECT * FROM src.${table.table} WHERE ${table.where}`
        const result = this.#database.prepare(sql).run(projectId as SQLInputValue)
        counts[table.table] = Number(result.changes)
      }
      this.#database.exec('COMMIT;')
      this.#database.exec('PRAGMA foreign_keys = ON')
      this.#database.exec('DETACH DATABASE src')
    } catch (error: unknown) {
      try { this.#database.exec('ROLLBACK;') } catch { /* 事务可能未开启 */ }
      if (foreignKeys === 1) { try { this.#database.exec('PRAGMA foreign_keys = ON') } catch { /* 忽略 */ } }
      try { this.#database.exec('DETACH DATABASE src') } catch { /* 忽略 */ }
      throw error
    }
    return counts
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

  /**
   * Phase E: Curation edit of a managed Text Artifact becomes the new Current
   * Revision directly (no Draft Review). Managed Run results keep the
   * draft → review → accept path in runtime services.
   */
  commitManagedTextRevision(input: {
    readonly artifact: Artifact
    readonly previousRevision: ArtifactRevision
    readonly newFileRecord: FileRecord
    readonly newRevision: ArtifactRevision
  }): ArtifactRevision {
    const current = this.getArtifact(String(input.artifact.id))?.currentRevisionId
    if (current === undefined || String(current) !== String(input.previousRevision.id)) {
      throw new Error('Managed text commit requires the current revision as base.')
    }
    if (input.newRevision.status !== 'current' || input.newRevision.source !== 'external') {
      throw new Error('Managed text revision must be external source with current status.')
    }
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      this.#upsertFileRecord(input.newFileRecord)
      this.#database.prepare('UPDATE artifact_revisions SET status = ? WHERE id = ?').run('superseded', input.previousRevision.id as SQLInputValue)
      this.#upsertArtifactRevision(input.newRevision)
      this.#database.prepare('UPDATE artifacts SET current_revision_id = ?, updated_at = ? WHERE id = ?')
        .run(input.newRevision.id as SQLInputValue, input.newRevision.createdAt, input.artifact.id as SQLInputValue)
      this.#database.exec('COMMIT;')
      return input.newRevision
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
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

  /** Phase D：删除 Artifact（级联 views/revisions）。file_records 保留（可能被其他 artifact 引用）。 */
  deleteArtifact(artifactId: string): boolean {
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      this.#database.prepare('DELETE FROM artifact_views WHERE artifact_id = ?').run(artifactId as SQLInputValue)
      this.#database.prepare('DELETE FROM artifact_revisions WHERE artifact_id = ?').run(artifactId as SQLInputValue)
      const result = this.#database.prepare('DELETE FROM artifacts WHERE id = ?').run(artifactId as SQLInputValue)
      this.#database.exec('COMMIT;')
      return Number(result.changes) > 0
    } catch (error) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
  }

  getRelations(projectId: string): Relation[] {
    return (this.#database.prepare('SELECT * FROM relations WHERE project_id = ?').all(projectId as SQLInputValue) as Row[]).map((r) => this.#relation(r))
  }

  getRelation(relationId: string): Relation | undefined {
    const rows = this.#database.prepare('SELECT * FROM relations WHERE id = ?').all(relationId as SQLInputValue) as Row[]
    return rows.length ? this.#relation(rows[0] as Row) : undefined
  }

  upsertRelation(value: Relation): void { this.#upsertRelation(value) }
  deleteRelation(relationId: string): void { this.#database.prepare('DELETE FROM relations WHERE id = ?').run(relationId as SQLInputValue) }

  // ==================== Presentation Views (schema v21) ====================

  getPresentationView(projectId: string, id: string): PresentationViewV0 | undefined {
    const rows = this.#database.prepare('SELECT * FROM presentation_views WHERE id = ? AND project_id = ?').all(id as SQLInputValue, projectId as SQLInputValue) as Row[]
    return rows.length ? this.#presentationView(rows[0] as Row) : undefined
  }

  listPresentationViews(projectId: string): PresentationViewV0[] {
    return (this.#database.prepare('SELECT * FROM presentation_views WHERE project_id = ? ORDER BY id').all(projectId as SQLInputValue) as Row[])
      .map((row) => this.#presentationView(row))
  }

  insertPresentationView(value: PresentationViewV0): void {
    this.#database.prepare(`
      INSERT INTO presentation_views (id, project_id, scope_id, capability, renderer, state_json, version, created_at, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      value.id as SQLInputValue, value.projectId as SQLInputValue, value.scopeId as SQLInputValue,
      value.capability, value.renderer, JSON.stringify(value.state), value.version,
      value.createdAt, value.updatedAt, value.updatedBy,
    )
  }

  compareAndSwapPresentationView(value: PresentationViewV0, expectedVersion: number): { readonly updated: boolean; readonly currentVersion: number } {
    const existing = this.#database.prepare('SELECT version FROM presentation_views WHERE id = ? AND project_id = ?').get(value.id as SQLInputValue, value.projectId as SQLInputValue) as Row | undefined
    if (existing === undefined) return { updated: false, currentVersion: 0 }
    const currentVersion = Number(existing.version ?? 0)
    if (currentVersion !== expectedVersion) return { updated: false, currentVersion }
    const result = this.#database.prepare(`
      UPDATE presentation_views
      SET scope_id = ?, capability = ?, renderer = ?, state_json = ?, version = version + 1, updated_at = ?, updated_by = ?
      WHERE id = ? AND project_id = ? AND version = ?
    `).run(
      value.scopeId as SQLInputValue, value.capability, value.renderer, JSON.stringify(value.state),
      value.updatedAt, value.updatedBy, value.id as SQLInputValue, value.projectId as SQLInputValue, expectedVersion,
    )
    return { updated: result.changes === 1, currentVersion: expectedVersion + 1 }
  }

  deletePresentationView(projectId: string, id: string): void {
    this.#database.prepare('DELETE FROM presentation_views WHERE id = ? AND project_id = ?').run(id as SQLInputValue, projectId as SQLInputValue)
  }

  // ==================== Search Documents (schema v23, derived index) ====================

  getSearchDocument(projectId: string, entityType: string, entityId: string): { readonly contentHash: string } | undefined {
    const row = this.#database.prepare('SELECT content_hash FROM search_documents WHERE project_id = ? AND entity_type = ? AND entity_id = ?')
      .get(projectId as SQLInputValue, entityType, entityId) as Row | undefined
    return row === undefined ? undefined : { contentHash: String(row.content_hash) }
  }

  upsertSearchDocument(doc: { readonly id: string; readonly projectId: string; readonly entityType: string; readonly entityId: string; readonly title: string; readonly body: string; readonly contentHash: string; readonly updatedAt: string }): void {
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      this.#database.prepare('DELETE FROM search_documents_fts WHERE entity_id = ? AND project_id = ?').run(doc.entityId, doc.projectId)
      this.#database.prepare(`
        INSERT INTO search_documents (id, project_id, entity_type, entity_id, title, body, content_hash, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id, entity_type, entity_id) DO UPDATE SET
          id=excluded.id, title=excluded.title, body=excluded.body, content_hash=excluded.content_hash, updated_at=excluded.updated_at
      `).run(doc.id, doc.projectId, doc.entityType, doc.entityId, doc.title, doc.body, doc.contentHash, doc.updatedAt)
      this.#database.prepare('INSERT INTO search_documents_fts (entity_id, project_id, title, body) VALUES (?, ?, ?, ?)')
        .run(doc.entityId, doc.projectId, doc.title, doc.body)
      this.#database.exec('COMMIT;')
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
  }

  deleteSearchDocument(projectId: string, entityType: string, entityId: string): void {
    this.#database.prepare('DELETE FROM search_documents_fts WHERE entity_id = ? AND project_id = ?').run(entityId, projectId)
    this.#database.prepare('DELETE FROM search_documents WHERE project_id = ? AND entity_type = ? AND entity_id = ?').run(projectId, entityType, entityId)
    const modelRows = this.#database.prepare('SELECT model, dimensions FROM search_document_embeddings WHERE entity_id = ?').all(entityId as SQLInputValue) as Row[]
    for (const row of modelRows) {
      const table = this.#ensureSearchVecTable(String(row.model), Number(row.dimensions))
      if (table !== undefined) {
        try { this.#database.prepare(`DELETE FROM ${table} WHERE entity_id = ?`).run(entityId) } catch { /* best effort */ }
      }
    }
    this.#database.prepare('DELETE FROM search_document_embeddings WHERE entity_id = ?').run(entityId)
  }

  upsertSearchDocumentEmbedding(embedding: { readonly entityId: string; readonly model: string; readonly dimensions: number; readonly contentHash: string; readonly embeddingBlob: Buffer; readonly indexedAt: string }): void {
    this.#database.prepare(`
      INSERT INTO search_document_embeddings (entity_id, model, dimensions, content_hash, embedding_blob, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(entity_id, model) DO UPDATE SET
        dimensions=excluded.dimensions, content_hash=excluded.content_hash, embedding_blob=excluded.embedding_blob, indexed_at=excluded.indexed_at
    `).run(embedding.entityId, embedding.model, embedding.dimensions, embedding.contentHash, embedding.embeddingBlob, embedding.indexedAt)
    const table = this.#ensureSearchVecTable(embedding.model, embedding.dimensions)
    if (table !== undefined) {
      try {
        const floats = new Float32Array(embedding.embeddingBlob.buffer, embedding.embeddingBlob.byteOffset, embedding.embeddingBlob.byteLength / 4)
        const vector = [...floats]
        this.#database.prepare(`DELETE FROM ${table} WHERE entity_id = ?`).run(embedding.entityId)
        this.#database.prepare(`INSERT INTO ${table}(entity_id, project_id, embedding) VALUES (?, ?, ?)`)
          .run(embedding.entityId, this.#projectIdForSearchDocument(embedding.entityId), JSON.stringify(vector))
      } catch { /* vec0 写入失败不影响 blob 主索引 */ }
    }
  }

  #projectIdForSearchDocument(entityId: string): string {
    const row = this.#database.prepare('SELECT project_id FROM search_documents WHERE entity_id = ?').get(entityId as SQLInputValue) as { project_id?: string } | undefined
    return row?.project_id !== undefined ? String(row.project_id) : ''
  }

  searchDocumentsFts(projectId: string, query: string, limit: number): Array<{ readonly entityId: string; readonly title: string; readonly body: string }> {
    const sanitized = query.replace(/["*^~():|&!-]/g, ' ').trim()
    if (sanitized === '') return []
    const rows = this.#database.prepare(`
      SELECT f.entity_id, f.title, f.body FROM search_documents_fts f
      WHERE f.project_id = ? AND search_documents_fts MATCH ?
      LIMIT ?
    `).all(projectId as SQLInputValue, sanitized, limit) as Row[]
    return rows.map((row) => ({ entityId: String(row.entity_id), title: String(row.title ?? ''), body: String(row.body) }))
  }

  loadVectorExtension(path: string): boolean {
    try {
      this.#database.loadExtension(path)
      this.#database.prepare('SELECT vec_version()').get()
      this.#vectorLoaded = true
      return true
    } catch {
      return false
    }
  }

  /** 启动时自动尝试加载 vec0（失败静默，query 走 fallback）。 */
  #tryLoadVectorExtension(): void {
    if (this.#vectorLoaded) return
    const repoRoot = process.env.LCOS_REPO_ROOT
    const candidate = process.env.LCOS_SQLITE_VEC_EXTENSION
      ?? (repoRoot === undefined ? undefined : join(resolve(repoRoot), '.runtime', 'sqlite-vec', process.platform === 'win32' ? 'vec0.dll' : process.platform === 'darwin' ? 'vec0.dylib' : 'vec0.so'))
    if (candidate === undefined) return
    if (!this.loadVectorExtension(candidate)) {
      this.#vectorLoadError = `sqlite-vec unavailable: ${candidate}`
    }
  }

  vectorStatus(): { readonly loaded: boolean; readonly error?: string } {
    return { loaded: this.#vectorLoaded, ...(this.#vectorLoadError === undefined ? {} : { error: this.#vectorLoadError }) }
  }

  #ensureSearchVecTable(model: string, dimensions: number): string | undefined {
    if (!this.#vectorLoaded || !Number.isInteger(dimensions) || dimensions <= 0 || dimensions > 4096) return undefined
    const key = createHash('sha256').update(`${model}:${dimensions}`).digest('hex').slice(0, 16)
    const table = `search_document_vec_${key}`
    try {
      this.#database.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS ${table} USING vec0(entity_id TEXT, project_id TEXT, embedding float[${dimensions}])`)
      return table
    } catch {
      this.#vectorLoadError = 'Failed to create search_document_vec table.'
      return undefined
    }
  }

  querySearchVectors(model: string, vector: readonly number[], limit: number): Array<{ readonly entityId: string; readonly distance: number }> {
    const table = this.#ensureSearchVecTable(model, vector.length)
    if (table !== undefined) {
      try {
        const rows = this.#database.prepare(`
          SELECT entity_id, distance FROM ${table}
          WHERE embedding MATCH ? AND k=?
          ORDER BY distance
        `).all(JSON.stringify(vector), Math.max(limit * 5, 50)) as Row[]
        return rows.slice(0, limit).map((row) => ({ entityId: String(row.entity_id), distance: Number(row.distance) }))
      } catch {
        // vec0 查询失败 → fallback 线性扫描
      }
    }
    try {
      const rows = this.#database.prepare(`
        SELECT e.entity_id, e.embedding_blob FROM search_document_embeddings e
        WHERE e.model = ?
      `).all(model) as Row[]
      const scores = rows.map((row) => {
        const raw = Buffer.isBuffer(row.embedding_blob) ? row.embedding_blob : Buffer.from(String(row.embedding_blob ?? ''), 'base64')
        const otherF = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4)
        let dot = 0
        const length = Math.min(otherF.length, vector.length)
        for (let index = 0; index < length; index += 1) dot += otherF[index]! * vector[index]!
        return { entityId: String(row.entity_id), distance: -dot }
      })
      return scores.sort((left, right) => left.distance - right.distance).slice(0, limit)
    } catch {
      return []
    }
  }

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

  listWorkspaceStates(workspaceId: WorkspaceId): readonly Checkpoint[] {
    return (this.#database.prepare(
      'SELECT * FROM checkpoints WHERE workspace_id = ? ORDER BY created_at, id',
    ).all(workspaceId as SQLInputValue) as Row[]).map((row) => this.#checkpoint(row))
  }

  createSessionSummary(value: SessionSummary): SessionSummary {
    this.#database.prepare(`
      INSERT INTO session_summaries (id, project_id, title, summary, run_ids, handoff_ref, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      value.id,
      value.projectId as SQLInputValue,
      value.title,
      value.summary,
      JSON.stringify(value.runIds),
      value.handoffRef ?? null,
      value.createdAt,
      value.updatedAt,
    )
    return value
  }

  getSessionSummary(summaryId: string): SessionSummary | undefined {
    const row = this.#database.prepare('SELECT * FROM session_summaries WHERE id = ?').get(summaryId) as Row | undefined
    return row === undefined ? undefined : this.#sessionSummary(row)
  }

  listSessionSummaries(projectId: ProjectId): readonly SessionSummary[] {
    return (this.#database.prepare(
      'SELECT * FROM session_summaries WHERE project_id = ? ORDER BY created_at DESC, id DESC',
    ).all(projectId as SQLInputValue) as Row[]).map((row) => this.#sessionSummary(row))
  }

  createHandoff(value: HandoffRecord): HandoffRecord {
    this.#database.prepare(`
      INSERT INTO handoffs (id, project_id, title, resume_mode, from_provider, to_provider, session_summary_id, context_snapshot_id, decisions, open_questions, next_actions, artifact_refs, message_refs, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      value.id,
      value.projectId as SQLInputValue,
      value.title,
      value.resumeMode,
      value.fromProvider ?? null,
      value.toProvider ?? null,
      value.sessionSummaryId ?? null,
      value.contextSnapshotId ?? null,
      JSON.stringify(value.decisions),
      JSON.stringify(value.openQuestions),
      JSON.stringify(value.nextActions),
      JSON.stringify(value.artifactRefs),
      JSON.stringify(value.messageRefs),
      value.createdAt,
      value.updatedAt,
    )
    return value
  }

  getHandoff(handoffId: string): HandoffRecord | undefined {
    const row = this.#database.prepare('SELECT * FROM handoffs WHERE id = ?').get(handoffId) as Row | undefined
    return row === undefined ? undefined : this.#handoff(row)
  }

  listHandoffs(projectId: ProjectId): readonly HandoffRecord[] {
    return (this.#database.prepare(
      'SELECT * FROM handoffs WHERE project_id = ? ORDER BY created_at DESC, id DESC',
    ).all(projectId as SQLInputValue) as Row[]).map((row) => this.#handoff(row))
  }

  deleteHandoff(handoffId: string): boolean {
    const result = this.#database.prepare('DELETE FROM handoffs WHERE id = ?').run(handoffId)
    return Number(result.changes) > 0
  }

  // ==================== Capture Staging Buffer (Phase B) ====================

  createCaptureStagingItem(item: CaptureStagingItemV0): void {
    this.#database.prepare(`
      INSERT INTO capture_staging_items (
        id, operation_id, kind, payload_ref, source_json, suggested_projects_json,
        semantic_hint_json, captured_at, resolved_project_id, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      item.id as SQLInputValue,
      item.operationId,
      item.kind,
      item.payloadRef,
      JSON.stringify(item.source),
      JSON.stringify(item.suggestedProjects),
      item.semanticHint === undefined ? null : JSON.stringify(item.semanticHint),
      item.capturedAt,
      item.resolvedProjectId ?? null,
      item.resolvedAt ?? null,
    )
  }

  listCaptureStagingItems(sinceIso: string, limit = 50): CaptureStagingItemV0[] {
    const rows = this.#database.prepare(
      'SELECT * FROM capture_staging_items WHERE captured_at >= ? ORDER BY captured_at DESC LIMIT ?',
    ).all(sinceIso as SQLInputValue, limit) as Row[]
    return rows.map((row) => this.#captureStagingItem(row as Row))
  }

  countPendingCaptureStagingItems(): number {
    const row = this.#database.prepare(
      'SELECT COUNT(*) AS count FROM capture_staging_items WHERE resolved_project_id IS NULL',
    ).get() as { count: number }
    return Number(row.count)
  }

  resolveCaptureStagingItem(id: string, projectId: string, resolvedAt: string): boolean {
    const result = this.#database.prepare(
      'UPDATE capture_staging_items SET resolved_project_id = ?, resolved_at = ? WHERE id = ? AND resolved_project_id IS NULL',
    ).run(projectId, resolvedAt, id as SQLInputValue)
    return result.changes === 1
  }

  getCaptureReceipt(operationId: string): CaptureReceiptV0 | undefined {
    const row = this.#database.prepare('SELECT receipt_json FROM capture_receipts WHERE operation_id = ?').get(operationId as SQLInputValue) as { receipt_json?: string } | undefined
    if (row === undefined || row.receipt_json === undefined) return undefined
    return JSON.parse(row.receipt_json) as CaptureReceiptV0
  }

  saveCaptureReceipt(receipt: CaptureReceiptV0): void {
    this.#database.prepare(`
      INSERT INTO capture_receipts (operation_id, receipt_json, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT(operation_id) DO UPDATE SET receipt_json = excluded.receipt_json
    `).run(receipt.operationId, JSON.stringify(receipt), new Date().toISOString())
  }

  listCaptureWatchRules(): CaptureWatchRuleV0[] {
    const rows = this.#database.prepare('SELECT * FROM capture_watch_rules ORDER BY created_at, id').all() as Row[]
    return rows.map((row) => ({
      id: String(row.id),
      path: String(row.path),
      patterns: JSON.parse(String(row.patterns_json)) as string[],
      ...(row.project_hint ? { projectHint: String(row.project_hint) } : {}),
      settleMs: Number(row.settle_ms ?? 750),
      enabled: Number(row.enabled) === 1,
    }))
  }

  upsertCaptureWatchRule(rule: CaptureWatchRuleV0): void {
    this.#database.prepare(`
      INSERT INTO capture_watch_rules (id, path, patterns_json, project_hint, settle_ms, enabled, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        path = excluded.path,
        patterns_json = excluded.patterns_json,
        project_hint = excluded.project_hint,
        settle_ms = excluded.settle_ms,
        enabled = excluded.enabled
    `).run(
      rule.id,
      rule.path,
      JSON.stringify(rule.patterns),
      rule.projectHint ?? null,
      rule.settleMs,
      rule.enabled ? 1 : 0,
      new Date().toISOString(),
    )
  }

  deleteCaptureWatchRule(id: string): boolean {
    const result = this.#database.prepare('DELETE FROM capture_watch_rules WHERE id = ?').run(id)
    return Number(result.changes) > 0
  }

  createReorganizeProposal(proposal: ReorganizeProposalV0, snapshotJson: string): void {
    this.#database.prepare(`
      INSERT INTO reorganize_proposals (id, project_id, proposal_json, snapshot_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      proposal.id,
      proposal.projectId,
      JSON.stringify(proposal),
      snapshotJson,
      proposal.status,
      proposal.createdAt,
      proposal.createdAt,
    )
  }

  getReorganizeProposal(id: string): { readonly proposal: ReorganizeProposalV0; readonly snapshotJson: string | undefined } | undefined {
    const row = this.#database.prepare('SELECT proposal_json, snapshot_json, status FROM reorganize_proposals WHERE id = ?').get(id as SQLInputValue) as { proposal_json?: string; snapshot_json?: string; status?: string } | undefined
    if (row === undefined || row.proposal_json === undefined) return undefined
    const parsed = JSON.parse(row.proposal_json) as ReorganizeProposalV0
    const proposal = row.status !== undefined && row.status !== parsed.status
      ? { ...parsed, status: row.status as ReorganizeProposalV0['status'] }
      : parsed
    return {
      proposal,
      snapshotJson: row.snapshot_json ?? undefined,
    }
  }

  updateReorganizeProposalStatus(id: string, status: ReorganizeProposalV0['status']): void {
    this.#database.prepare(
      'UPDATE reorganize_proposals SET status = ?, updated_at = ? WHERE id = ?',
    ).run(status, new Date().toISOString(), id as SQLInputValue)
  }

  listReorganizeProposals(projectId: string): ReorganizeProposalV0[] {
    const rows = this.#database.prepare(
      'SELECT proposal_json FROM reorganize_proposals WHERE project_id = ? ORDER BY created_at DESC LIMIT 20',
    ).all(projectId as SQLInputValue) as Row[]
    return rows.map((row) => JSON.parse(String(row.proposal_json)) as ReorganizeProposalV0)
  }

  #captureStagingItem(row: Row): CaptureStagingItemV0 {
    return {
      id: String(row.id),
      operationId: String(row.operation_id),
      kind: String(row.kind),
      payloadRef: String(row.payload_ref),
      source: JSON.parse(String(row.source_json)) as Record<string, unknown>,
      suggestedProjects: JSON.parse(String(row.suggested_projects_json)) as CaptureStagingItemV0['suggestedProjects'],
      ...(row.semantic_hint_json === null || row.semantic_hint_json === undefined ? {} : { semanticHint: JSON.parse(String(row.semantic_hint_json)) as NonNullable<CaptureStagingItemV0['semanticHint']> }),
      capturedAt: String(row.captured_at),
      ...(row.resolved_project_id ? { resolvedProjectId: String(row.resolved_project_id) } : {}),
      ...(row.resolved_at ? { resolvedAt: String(row.resolved_at) } : {}),
    }
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

  getArtifactViewsByProject(projectId: string): ArtifactView[] {
    return (this.#database.prepare(`
      SELECT artifact_views.*
      FROM artifact_views
      JOIN artifacts ON artifacts.id = artifact_views.artifact_id
      WHERE artifacts.project_id = ?
      ORDER BY artifact_views.id
    `).all(projectId as SQLInputValue) as Row[]).map((r) => this.#artifactView(r))
  }

  getPreviewRecord(previewRecordId: string): PreviewRecord | undefined {
    const row = this.#database.prepare('SELECT * FROM preview_records WHERE id = ?').get(previewRecordId as SQLInputValue) as Row | undefined
    return row === undefined ? undefined : this.#previewRecord(row)
  }

  upsertPreviewRecord(value: PreviewRecord): void { this.#upsertPreviewRecord(value) }

  deletePreviewRecords(projectId: string): void {
    this.#database.prepare('DELETE FROM preview_records WHERE project_id = ?').run(projectId as SQLInputValue)
  }

  // ==================== Resource Descriptors (Universal Resource Import, v7) ====================

  createResourceDescriptorPending(descriptor: ResourceDescriptorV0): void {
    this.#insertResourceDescriptor(descriptor)
  }

  replaceResourceDescriptor(descriptor: ResourceDescriptorV0): void {
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      this.#database.prepare(
        'DELETE FROM resource_descriptors WHERE artifact_id = ? AND source_revision_id = ?',
      ).run(
        String(descriptor.artifactId) as SQLInputValue,
        String(descriptor.sourceRevisionId) as SQLInputValue,
      )
      this.#insertResourceDescriptor(descriptor)
      this.#database.exec('COMMIT;')
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
  }

  getResourceDescriptorForRevision(
    artifactId: string,
    sourceRevisionId: string,
    analyzerVersion?: string,
  ): ResourceDescriptorV0 | undefined {
    const rows = analyzerVersion === undefined
      ? this.#database.prepare(
        'SELECT * FROM resource_descriptors WHERE artifact_id = ? AND source_revision_id = ? ORDER BY updated_at DESC LIMIT 1',
      ).all(artifactId as SQLInputValue, sourceRevisionId as SQLInputValue) as Row[]
      : this.#database.prepare(
        'SELECT * FROM resource_descriptors WHERE artifact_id = ? AND source_revision_id = ? AND analyzer_version = ?',
      ).all(artifactId as SQLInputValue, sourceRevisionId as SQLInputValue, analyzerVersion as SQLInputValue) as Row[]
    return rows.length === 0 ? undefined : this.#resourceDescriptorRow(rows[0] as Row)
  }

  getResourceDescriptorByResourceId(projectId: string, resourceId: string): ResourceDescriptorV0 | undefined {
    const rows = this.#database.prepare(
      'SELECT * FROM resource_descriptors WHERE project_id = ? AND resource_id = ? ORDER BY updated_at DESC LIMIT 1',
    ).all(projectId as SQLInputValue, resourceId as SQLInputValue) as Row[]
    return rows.length === 0 ? undefined : this.#resourceDescriptorRow(rows[0] as Row)
  }

  listResourceDescriptors(projectId: string): ResourceDescriptorV0[] {
    return (this.#database.prepare(
      'SELECT * FROM resource_descriptors WHERE project_id = ? ORDER BY updated_at DESC',
    ).all(projectId as SQLInputValue) as Row[]).map((row) => this.#resourceDescriptorRow(row))
  }

  markResourceDescriptorFailed(id: string, warnings: readonly string[], analyzerVersion: string): void {
    const row = this.#database.prepare('SELECT * FROM resource_descriptors WHERE id = ?').get(id as SQLInputValue) as Row | undefined
    if (row === undefined) return
    const parsed = this.#resourceDescriptorRow(row)
    this.#database.prepare(
      'UPDATE resource_descriptors SET status = ?, analyzer_version = ?, descriptor_json = ?, updated_at = ? WHERE id = ?',
    ).run(
      'failed' as SQLInputValue,
      analyzerVersion as SQLInputValue,
      JSON.stringify({ ...parsed, understanding: { ...parsed.understanding, status: 'failed', warnings: [...warnings] } }) as SQLInputValue,
      new Date().toISOString() as SQLInputValue,
      id as SQLInputValue,
    )
  }

  enqueueResourceAnalysis(input: {
    readonly id: string
    readonly projectId: string
    readonly resourceId: string
    readonly sourceRevisionId: string
    readonly analyzerVersion: string
  }): void {
    const now = new Date().toISOString()
    this.#database.prepare(`
      INSERT INTO resource_analysis_jobs (
        id, project_id, resource_id, source_revision_id, analyzer_version,
        status, attempt_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)
      ON CONFLICT(resource_id, source_revision_id, analyzer_version) DO UPDATE SET
        status = CASE WHEN status = 'completed' THEN status ELSE 'pending' END,
        updated_at = excluded.updated_at
    `).run(input.id, input.projectId, input.resourceId, input.sourceRevisionId, input.analyzerVersion, now, now)
  }

  claimResourceAnalysis(workerId: string, leaseMs = 60_000): { readonly id: string; readonly projectId: string; readonly resourceId: string; readonly sourceRevisionId: string } | undefined {
    const now = new Date()
    const nowIso = now.toISOString()
    const row = this.#database.prepare(`
      SELECT id, project_id, resource_id, source_revision_id FROM resource_analysis_jobs
      WHERE (status IN ('pending','retryable') AND (next_attempt_at IS NULL OR next_attempt_at <= ?))
         OR (status = 'running' AND lease_expires_at < ?)
      ORDER BY created_at, id LIMIT 1
    `).get(nowIso, nowIso) as Row | undefined
    if (row === undefined) return undefined
    const expiresAt = new Date(now.getTime() + leaseMs).toISOString()
    this.#database.prepare(`
      UPDATE resource_analysis_jobs SET status = 'running', attempt_count = attempt_count + 1,
        lease_owner = ?, lease_expires_at = ?, updated_at = ? WHERE id = ?
    `).run(workerId, expiresAt, nowIso, row.id as SQLInputValue)
    return { id: String(row.id), projectId: String(row.project_id), resourceId: String(row.resource_id), sourceRevisionId: String(row.source_revision_id) }
  }

  completeResourceAnalysis(id: string): void {
    const now = new Date().toISOString()
    this.#database.prepare(`UPDATE resource_analysis_jobs SET status = 'completed', lease_owner = NULL,
      lease_expires_at = NULL, last_error = NULL, updated_at = ? WHERE id = ?`).run(now, id)
  }

  failResourceAnalysis(id: string, message: string, retryable = true): void {
    const now = new Date()
    this.#database.prepare(`UPDATE resource_analysis_jobs SET status = ?, last_error = ?,
      next_attempt_at = ?, lease_owner = NULL, lease_expires_at = NULL, updated_at = ? WHERE id = ?`)
      .run(retryable ? 'retryable' : 'failed', message, retryable ? new Date(now.getTime() + 5_000).toISOString() : null, now.toISOString(), id)
  }

  upsertResourcePolicy(input: {
    readonly projectId: string
    readonly resourceId: string
    readonly trustLevel: 'untrusted' | 'reviewed' | 'trusted'
    readonly approvedContext: boolean
    readonly executable: boolean
    readonly annotation?: Readonly<Record<string, unknown>>
  }): void {
    this.#database.prepare(`INSERT INTO resource_policies VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, resource_id) DO UPDATE SET trust_level=excluded.trust_level,
      approved_context=excluded.approved_context, executable=excluded.executable,
      annotation_json=excluded.annotation_json, updated_at=excluded.updated_at`)
      .run(input.projectId, input.resourceId, input.trustLevel, input.approvedContext ? 1 : 0,
        input.executable ? 1 : 0, JSON.stringify(input.annotation ?? {}), new Date().toISOString())
  }

  getResourcePolicy(projectId: string, resourceId: string): {
    readonly trustLevel: 'untrusted' | 'reviewed' | 'trusted'
    readonly approvedContext: boolean
    readonly executable: boolean
    readonly annotation: Readonly<Record<string, unknown>>
  } | undefined {
    const row = this.#database.prepare('SELECT * FROM resource_policies WHERE project_id = ? AND resource_id = ?')
      .get(projectId, resourceId) as Row | undefined
    return row === undefined ? undefined : {
      trustLevel: String(row.trust_level) as 'untrusted' | 'reviewed' | 'trusted',
      approvedContext: Number(row.approved_context) === 1,
      executable: Number(row.executable) === 1,
      annotation: json<Readonly<Record<string, unknown>>>(row.annotation_json as SQLInputValue),
    }
  }

  #insertResourceDescriptor(descriptor: ResourceDescriptorV0): void {
    const now = new Date().toISOString()
    this.#database.prepare(
      'INSERT INTO resource_descriptors VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      descriptor.id as SQLInputValue,
      descriptor.projectId as SQLInputValue,
      descriptor.resourceId as SQLInputValue,
      descriptor.artifactId as SQLInputValue,
      descriptor.sourceRevisionId as SQLInputValue,
      descriptor.schemaVersion as SQLInputValue,
      descriptor.understanding.analyzerVersion as SQLInputValue,
      descriptor.understanding.status as SQLInputValue,
      descriptor.source.contentHash ?? null,
      resourceDescriptorHash(descriptor) as SQLInputValue,
      JSON.stringify(descriptor) as SQLInputValue,
      now as SQLInputValue,
      now as SQLInputValue,
    )
  }

  #resourceDescriptorRow(row: Row): ResourceDescriptorV0 {
    return JSON.parse(String(row.descriptor_json)) as ResourceDescriptorV0
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
          context_manifest_id, retry_of_run_id, provider, requested_provider, output_intent, return_group_id, status, instruction,
          result_policy, result_summary, short_summary, error_code, error_message,
          created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        run.id as SQLInputValue,
        run.projectId as SQLInputValue,
        run.workspaceId as SQLInputValue ?? null,
        run.targetArtifactId as SQLInputValue ?? null,
        run.targetRevisionId as SQLInputValue ?? null,
        run.contextManifestId as SQLInputValue,
        run.retryOfRunId as SQLInputValue ?? null,
        run.provider,
        run.requestedProvider ?? run.provider,
        run.outputIntent ?? 'revise',
        run.returnGroupId ?? `return-group-${String(run.id)}`,
        run.status,
        run.instruction,
        run.resultPolicy === undefined ? null : JSON.stringify(run.resultPolicy),
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

  listRunsNeedingSync(): readonly Run[] {
    return (this.#database.prepare(`
      SELECT r.* FROM runs r
      JOIN runtime_bindings b ON b.run_id = r.id
      WHERE r.status IN ('created','queued','running','waiting_input')
      ORDER BY r.created_at
    `).all() as Row[]).map((row) => this.#runFromRow(row))
  }

  #runFromRow(row: Row): Run {
    return {
      id: String(row.id) as Run['id'],
      projectId: String(row.project_id) as Run['projectId'],
      ...(row.workspace_id ? { workspaceId: String(row.workspace_id) as WorkspaceId } : {}),
      ...(row.target_artifact_id ? { targetArtifactId: String(row.target_artifact_id) as NonNullable<Run['targetArtifactId']> } : {}),
      ...(row.target_revision_id ? { targetRevisionId: String(row.target_revision_id) as NonNullable<Run['targetRevisionId']> } : {}),
      contextManifestId: String(row.context_manifest_id) as Run['contextManifestId'],
      ...(row.retry_of_run_id ? { retryOfRunId: String(row.retry_of_run_id) as RunId } : {}),
      provider: String(row.provider) as Run['provider'],
      requestedProvider: String(row.requested_provider) as Run['requestedProvider'],
      outputIntent: String(row.output_intent) as Run['outputIntent'],
      returnGroupId: String(row.return_group_id),
      ...(row.result_policy ? { resultPolicy: JSON.parse(String(row.result_policy)) as NonNullable<Run['resultPolicy']> } : {}),
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

  // ==================== Workspace Memberships (Phase 0/1 canonical truth) ====================

  addWorkspaceMembers(
    workspaceId: WorkspaceId,
    viewIds: readonly ArtifactViewId[],
    addedBy: WorkspaceMembershipSource,
    addedAt: string,
  ): readonly WorkspaceMembership[] {
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      for (const viewId of viewIds) {
        const row = this.#database.prepare(
          'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM workspace_memberships WHERE workspace_id = ?',
        ).get(workspaceId as SQLInputValue) as Row
        this.#database.prepare(`
          INSERT OR IGNORE INTO workspace_memberships (workspace_id, artifact_view_id, added_at, added_by, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `).run(workspaceId as SQLInputValue, viewId as SQLInputValue, addedAt, addedBy, Number(row.next_order))
      }
      this.#database.exec('COMMIT;')
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
    return this.listWorkspaceMembers(workspaceId)
  }

  removeWorkspaceMembers(
    workspaceId: WorkspaceId,
    viewIds: readonly ArtifactViewId[],
  ): readonly WorkspaceMembership[] {
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      for (const viewId of viewIds) {
        this.#database.prepare(
          'DELETE FROM workspace_memberships WHERE workspace_id = ? AND artifact_view_id = ?',
        ).run(workspaceId as SQLInputValue, viewId as SQLInputValue)
      }
      this.#database.exec('COMMIT;')
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
    return this.listWorkspaceMembers(workspaceId)
  }

  moveWorkspaceMembers(
    fromWorkspaceId: WorkspaceId,
    toWorkspaceId: WorkspaceId,
    viewIds: readonly ArtifactViewId[],
    addedBy: WorkspaceMembershipSource,
    addedAt: string,
  ): readonly WorkspaceMembership[] {
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      const fromExists = this.#database.prepare('SELECT id FROM workspaces WHERE id = ?').get(fromWorkspaceId as SQLInputValue)
      const toExists = this.#database.prepare('SELECT id FROM workspaces WHERE id = ?').get(toWorkspaceId as SQLInputValue)
      if (fromExists === undefined || toExists === undefined) {
        throw new Error('Workspace not found for membership move.')
      }
      for (const viewId of viewIds) {
        this.#database.prepare(
          'DELETE FROM workspace_memberships WHERE workspace_id = ? AND artifact_view_id = ?',
        ).run(fromWorkspaceId as SQLInputValue, viewId as SQLInputValue)
        const row = this.#database.prepare(
          'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM workspace_memberships WHERE workspace_id = ?',
        ).get(toWorkspaceId as SQLInputValue) as Row
        this.#database.prepare(`
          INSERT OR IGNORE INTO workspace_memberships (workspace_id, artifact_view_id, added_at, added_by, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `).run(toWorkspaceId as SQLInputValue, viewId as SQLInputValue, addedAt, addedBy, Number(row.next_order))
      }
      this.#database.exec('COMMIT;')
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      throw error
    }
    return this.listWorkspaceMembers(toWorkspaceId)
  }

  listWorkspaceMembers(workspaceId: WorkspaceId): readonly WorkspaceMembership[] {
    return (this.#database.prepare(
      'SELECT * FROM workspace_memberships WHERE workspace_id = ? ORDER BY sort_order, added_at, artifact_view_id',
    ).all(workspaceId as SQLInputValue) as Row[]).map((row) => this.#membershipFromRow(row))
  }

  listProjectWorkspaceMemberships(projectId: ProjectId): readonly WorkspaceMembership[] {
    return (this.#database.prepare(`
      SELECT m.* FROM workspace_memberships m
      JOIN workspaces w ON w.id = m.workspace_id
      WHERE w.project_id = ?
      ORDER BY w.id, m.sort_order, m.artifact_view_id
    `).all(projectId as SQLInputValue) as Row[]).map((row) => this.#membershipFromRow(row))
  }

  #membershipFromRow(row: Row): WorkspaceMembership {
    return {
      workspaceId: String(row.workspace_id) as WorkspaceId,
      artifactViewId: String(row.artifact_view_id) as ArtifactViewId,
      addedAt: String(row.added_at),
      addedBy: String(row.added_by) as WorkspaceMembershipSource,
      ...(row.sort_order === null || row.sort_order === undefined ? {} : { sortOrder: Number(row.sort_order) }),
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

  updateRunOutcome(
    runId: RunId,
    input: {
      readonly status: Run['status']
      readonly resultSummary?: string
      readonly shortSummary?: string
      readonly errorCode?: string
      readonly errorMessage?: string
      readonly completedAt?: string
    },
    updatedAt: string,
  ): Run {
    const result = this.#database.prepare(`
      UPDATE runs SET
        status = ?, result_summary = ?, short_summary = ?, error_code = ?, error_message = ?,
        completed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(
      input.status,
      input.resultSummary ?? null,
      input.shortSummary ?? null,
      input.errorCode ?? null,
      input.errorMessage ?? null,
      input.completedAt ?? null,
      updatedAt,
      runId as SQLInputValue,
    )
    if (result.changes !== 1) throw new Error('Run not found.')
    const run = this.getRun(runId)
    if (run === undefined) throw new Error('Run not found after outcome update.')
    return run
  }

  createRunEvent(
    input: Pick<RunEvent, 'id' | 'runId' | 'type' | 'payload' | 'occurredAt'>,
  ): RunEvent {
    const existing = this.#database.prepare(
      'SELECT * FROM run_events WHERE id = ?',
    ).get(input.id as SQLInputValue) as Row | undefined
    if (existing !== undefined) {
      return this.#mapRunEvent(existing)
    }
    this.#database.exec('BEGIN IMMEDIATE;')
    try {
      const row = this.#database.prepare(
        'SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence FROM run_events WHERE run_id = ?',
      ).get(input.runId as SQLInputValue) as Row
      const sequence = Number(row.next_sequence)
      this.#database.prepare(`
        INSERT INTO run_events (id, run_id, sequence, type, payload_json, occurred_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        input.id as SQLInputValue,
        input.runId as SQLInputValue,
        sequence,
        input.type,
        JSON.stringify(input.payload),
        input.occurredAt,
      )
      this.#database.exec('COMMIT;')
      const created = this.#database.prepare(
        'SELECT * FROM run_events WHERE id = ?',
      ).get(input.id as SQLInputValue) as Row
      const event = this.#mapRunEvent(created)
      this.#runEventSink?.(event)
      return event
    } catch (error: unknown) {
      this.#database.exec('ROLLBACK;')
      const replay = this.#database.prepare(
        'SELECT * FROM run_events WHERE id = ?',
      ).get(input.id as SQLInputValue) as Row | undefined
      if (replay !== undefined) return this.#mapRunEvent(replay)
      throw error
    }
  }

  #runEventSink?: (event: RunEvent) => void

  /** 注册 Run 事件落库通知（SSE 推送等实时面使用；同一时刻只保留一个订阅者）。 */
  setRunEventSink(sink: (event: RunEvent) => void): void {
    this.#runEventSink = sink
  }

  getRunEvents(runId: RunId, afterSequence?: number): readonly RunEvent[] {
    if (afterSequence === undefined) {
      return (this.#database.prepare(
        'SELECT * FROM run_events WHERE run_id = ? ORDER BY sequence',
      ).all(runId as SQLInputValue) as Row[]).map((row) => this.#mapRunEvent(row))
    }
    return (this.#database.prepare(
      'SELECT * FROM run_events WHERE run_id = ? AND sequence > ? ORDER BY sequence',
    ).all(runId as SQLInputValue, afterSequence) as Row[]).map((row) => this.#mapRunEvent(row))
  }

  #mapRunEvent(row: Row): RunEvent {
    return {
      id: String(row.id) as RunEventId,
      runId: String(row.run_id) as RunId,
      sequence: Number(row.sequence),
      type: String(row.type) as RunEvent['type'],
      payload: JSON.parse(String(row.payload_json)) as RunEvent['payload'],
      occurredAt: String(row.occurred_at),
    }
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

  createRuntimeCreatedArtifact(
    fileRecord: FileRecord,
    artifact: Artifact,
    revision: ArtifactRevision,
    artifactReturn: ArtifactReturn,
  ): ArtifactReturn {
    if (
      String(fileRecord.id) !== String(artifactReturn.returnedFileId)
      || String(revision.id) !== String(artifactReturn.draftRevisionId)
      || String(revision.fileRecordId) !== String(fileRecord.id)
      || String(revision.artifactId) !== String(artifactReturn.targetArtifactId)
      || String(revision.artifactId) !== String(artifact.id)
      || revision.parentRevisionId !== undefined
      || artifact.currentRevisionId !== undefined
      || String(revision.runId) !== String(artifactReturn.runId)
      || String(revision.contentHash) !== String(artifactReturn.contentHash)
      || String(fileRecord.observedHash) !== String(artifactReturn.contentHash)
      || String(artifactReturn.baseRevisionId) !== String(revision.id)
      || revision.source !== 'run'
      || revision.status !== 'draft'
      || artifactReturn.status !== 'pending_review'
      || artifactReturn.action !== 'created'
    ) {
      throw new Error('Runtime Created Artifact invariants are invalid.')
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
      this.#upsertArtifact(artifact)
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
      const artifact = this.getArtifact(String(artifactReturn.targetArtifactId))
      const draftRevision = artifactReturn.draftRevisionId === undefined
        ? undefined
        : this.getArtifactRevision(String(artifactReturn.draftRevisionId))
      if (
        artifact !== undefined
        && draftRevision !== undefined
        && artifact.currentRevisionId === undefined
        && String(artifactReturn.baseRevisionId) === String(artifactReturn.draftRevisionId)
        && draftRevision.parentRevisionId === undefined
      ) {
        if (String(artifactReturn.baseRevisionId) !== String(expectedBaseRevisionId)) {
          throw new RuntimeLifecycleConflictError('Accept base revision does not match the Return base revision.')
        }
        const run = this.getRun(artifactReturn.runId)
        if (run === undefined || draftRevision.status !== 'draft') {
          throw new RuntimeLifecycleConflictError('Accept lifecycle evidence is incomplete.')
        }
        this.#database.prepare('UPDATE artifact_revisions SET status = ? WHERE id = ? AND status = ?')
          .run('current', draftRevision.id as SQLInputValue, 'draft')
        this.#database.prepare(
          'UPDATE artifacts SET current_revision_id = ?, updated_at = ? WHERE id = ? AND current_revision_id IS NULL',
        ).run(draftRevision.id as SQLInputValue, updatedAt, artifact.id as SQLInputValue)
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
          run: this.getRun(run.id)!,
        }
        this.#database.exec('COMMIT;')
        return result
      }
      if (String(artifactReturn.baseRevisionId) !== String(expectedBaseRevisionId)) {
        throw new RuntimeLifecycleConflictError('Accept base revision does not match the Return base revision.')
      }
      if (artifactReturn.draftRevisionId === undefined) throw new RuntimeLifecycleConflictError('ArtifactReturn has no Draft Revision.')
      const previousRevision = this.getArtifactRevision(String(artifactReturn.baseRevisionId))
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

  get schemaVersion(): number { return 28 }

  // ==================== Private helpers ====================

  #upsertProject(value: Project): void {
    this.#database.prepare(`
      INSERT INTO projects (id, name, root_path, graph_version, created_at, updated_at, last_opened_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, root_path=excluded.root_path, graph_version=excluded.graph_version, last_opened_at=excluded.last_opened_at, updated_at=excluded.updated_at
    `).run(value.id as SQLInputValue, value.name, value.rootPath, value.graphVersion as unknown as number, value.createdAt, value.updatedAt, value.lastOpenedAt ?? null)
  }

  #upsertScope(value: Scope, projectId: ProjectId): void {
    this.#database.prepare(`
      INSERT INTO scopes (id, project_id, parent_scope_id, container_view_id, kind, name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
      INSERT INTO workspaces (id, project_id, scope_id, name, intent, viewport, focused_node_ids, visible_layers, context_policy, frame_bounds, preferred_surface, version, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, intent=excluded.intent, scope_id=excluded.scope_id, viewport=excluded.viewport, focused_node_ids=excluded.focused_node_ids, visible_layers=excluded.visible_layers, context_policy=excluded.context_policy, frame_bounds=excluded.frame_bounds, preferred_surface=excluded.preferred_surface, version=excluded.version, updated_at=excluded.updated_at
    `, [
      value.id as SQLInputValue, value.projectId as SQLInputValue, value.scopeId as SQLInputValue,
      value.name, value.intent, JSON.stringify(value.viewport),
      JSON.stringify(value.focusedViewIds), JSON.stringify(value.visibleLayers),
      value.contextPolicy,
      value.frameBounds === undefined ? null : JSON.stringify(value.frameBounds),
      value.preferredSurface ?? null,
      value.version ?? 0,
      value.updatedAt,
    ])
  }

  #upsertArtifact(value: Artifact): void {
    const managed = value.managed === false || value.title.toLocaleLowerCase('en-US').endsWith('.link.md') ? 0 : 1
    this.#runStatement({
      operationType: 'upsert_artifact',
      entityId: String(value.id),
      table: 'artifacts',
      statement: 'INSERT INTO artifacts',
      foreignKeyColumn: 'project_id',
      referencedTable: 'projects',
      referencedId: String(value.projectId),
    }, `
      INSERT INTO artifacts (id, project_id, title, kind, local_path, availability, current_revision_id, created_at, updated_at, managed)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, kind=excluded.kind, local_path=excluded.local_path, availability=excluded.availability, current_revision_id=excluded.current_revision_id, managed=excluded.managed, updated_at=excluded.updated_at
    `, [value.id as SQLInputValue, value.projectId as SQLInputValue, value.title, value.kind, '', value.availability, value.currentRevisionId as SQLInputValue ?? null, value.createdAt, value.updatedAt, managed])
  }

  #presentationView(row: Row): PresentationViewV0 {
    const parsed = JSON.parse(String(row.state_json ?? '{}')) as unknown
    const state = (parsed !== null && typeof parsed === 'object' ? parsed : {}) as PresentationViewV0['state']
    return {
      schemaVersion: 0,
      id: String(row.id),
      projectId: String(row.project_id),
      scopeId: String(row.scope_id),
      capability: String(row.capability) as PresentationViewV0['capability'],
      renderer: String(row.renderer),
      state,
      version: Number(row.version ?? 0),
      updatedBy: String(row.updated_by) as PresentationViewV0['updatedBy'],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }
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
        context_manifest_id, retry_of_run_id, provider, requested_provider, output_intent, return_group_id, status, instruction,
        result_policy, result_summary, short_summary, error_code, error_message,
        created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      run.id as SQLInputValue, run.projectId as SQLInputValue, run.workspaceId as SQLInputValue ?? null,
      run.targetArtifactId as SQLInputValue, run.targetRevisionId as SQLInputValue,
      run.contextManifestId as SQLInputValue, run.retryOfRunId as SQLInputValue ?? null,
      run.provider, run.requestedProvider ?? run.provider, run.outputIntent ?? 'revise', run.returnGroupId ?? `return-group-${String(run.id)}`,
      run.status, run.instruction, run.resultPolicy === undefined ? null : JSON.stringify(run.resultPolicy),
      run.resultSummary ?? null, run.shortSummary ?? null,
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
      INSERT INTO relations (id, project_id, source_entity_type, source_entity_id, target_entity_type, target_entity_id, kind, created_at, updated_at, origin, created_by, evidence_json, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET source_entity_type=excluded.source_entity_type, source_entity_id=excluded.source_entity_id, target_entity_type=excluded.target_entity_type, target_entity_id=excluded.target_entity_id, kind=excluded.kind, updated_at=excluded.updated_at, origin=excluded.origin, created_by=excluded.created_by, evidence_json=excluded.evidence_json, confidence=excluded.confidence
    `).run(
      value.id as SQLInputValue, value.projectId as SQLInputValue, value.sourceEntityType, value.sourceEntityId,
      value.targetEntityType, value.targetEntityId, value.kind, value.createdAt, value.updatedAt,
      value.origin ?? null, value.createdBy ?? null,
      value.evidenceRefs === undefined ? null : JSON.stringify(value.evidenceRefs),
      value.confidence ?? null,
    )
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
      INSERT INTO checkpoints VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `).run(value.id as SQLInputValue, value.projectId as SQLInputValue, value.scopeId as SQLInputValue, value.label, JSON.stringify(value.snapshotJson), value.createdAt, value.workspaceId as SQLInputValue ?? null)
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
    return { id: row.id as ProjectId, name: String(row.name), rootPath: String(row.root_path), graphVersion: (row.graph_version as number) as GraphVersion, ...(row.last_opened_at ? { lastOpenedAt: String(row.last_opened_at) } : {}), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
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
    const frameBounds = row.frame_bounds === null || row.frame_bounds === undefined ? undefined : json<Workspace['frameBounds']>(row.frame_bounds as SQLInputValue)
    const preferredSurface = row.preferred_surface === null || row.preferred_surface === undefined ? undefined : String(row.preferred_surface)
    const version = row.version as number | undefined
    return {
      id, projectId, scopeId, name, intent, viewport, focusedViewIds, visibleLayers, contextPolicy,
      ...(frameBounds === undefined ? {} : { frameBounds }),
      ...(preferredSurface === undefined ? {} : { preferredSurface }),
      ...(version === undefined ? {} : { version }),
      updatedAt,
    }
  }

  #artifact(row: Row): Artifact {
    return { id: row.id as ArtifactId, projectId: row.project_id as ProjectId, title: String(row.title), kind: String(row.kind) as Artifact['kind'], managed: row.managed === 0 ? false : true, availability: String(row.availability) as Artifact['availability'], ...(row.current_revision_id === null || row.current_revision_id === undefined ? {} : { currentRevisionId: row.current_revision_id as ArtifactRevisionId }), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }
  }

  #artifactView(row: Row): ArtifactView {
    return { id: row.id as ArtifactViewId, artifactId: row.artifact_id as ArtifactId, scopeId: (row.scope_id ?? '') as unknown as ScopeId, ...(row.revision_id ? { revisionId: row.revision_id as ArtifactRevisionId } : {}), referenceKind: String(row.reference_kind) as ArtifactView['referenceKind'], position: json<ArtifactView['position']>(row.position as SQLInputValue), size: json<ArtifactView['size']>(row.size as SQLInputValue), displayMode: String(row.display_mode) as ArtifactView['displayMode'], collapsed: (row.collapsed as number) === 1 } as ArtifactView
  }

  #relation(row: Row): Relation {
    return {
      id: row.id as RelationId,
      projectId: row.project_id as ProjectId,
      sourceEntityType: String(row.source_entity_type) as Relation['sourceEntityType'],
      sourceEntityId: String(row.source_entity_id),
      targetEntityType: String(row.target_entity_type) as Relation['targetEntityType'],
      targetEntityId: String(row.target_entity_id),
      kind: String(row.kind),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      ...(row.origin ? { origin: String(row.origin) as Relation['origin'] } : {}),
      ...(row.created_by ? { createdBy: String(row.created_by) } : {}),
      ...(row.evidence_json ? { evidenceRefs: JSON.parse(String(row.evidence_json)) as Relation['evidenceRefs'] } : {}),
      ...(row.confidence !== undefined && row.confidence !== null ? { confidence: Number(row.confidence) } : {}),
    } as Relation
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
    return { id: row.id as CheckpointId, projectId: row.project_id as ProjectId, scopeId: (row.scope_id ?? '') as unknown as ScopeId, ...(row.workspace_id ? { workspaceId: row.workspace_id as WorkspaceId } : {}), label: String(row.label ?? ''), snapshotJson: json<Checkpoint['snapshotJson']>(row.snapshot_json as SQLInputValue), createdAt: String(row.created_at) }
  }

  #sessionSummary(row: Row): SessionSummary {
    return {
      id: String(row.id),
      projectId: String(row.project_id) as ProjectId,
      title: String(row.title),
      summary: String(row.summary),
      runIds: JSON.parse(String(row.run_ids)) as readonly RunId[],
      ...(row.handoff_ref ? { handoffRef: String(row.handoff_ref) } : {}),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }
  }

  #handoff(row: Row): HandoffRecord {
    const decisions = json<string[]>((row.decisions ?? '[]') as SQLInputValue)
    const openQuestions = json<string[]>((row.open_questions ?? '[]') as SQLInputValue)
    const nextActions = json<string[]>((row.next_actions ?? '[]') as SQLInputValue)
    const artifactRefs = json<HandoffRecord['artifactRefs']>((row.artifact_refs ?? '[]') as SQLInputValue)
    const messageRefs = json<string[]>((row.message_refs ?? '[]') as SQLInputValue)
    return {
      id: String(row.id),
      projectId: String(row.project_id) as ProjectId,
      title: String(row.title),
      resumeMode: (String(row.resume_mode ?? 'standard-handoff')) as HandoffRecord['resumeMode'],
      ...(row.from_provider ? { fromProvider: String(row.from_provider) } : {}),
      ...(row.to_provider ? { toProvider: String(row.to_provider) } : {}),
      ...(row.session_summary_id ? { sessionSummaryId: String(row.session_summary_id) } : {}),
      ...(row.context_snapshot_id ? { contextSnapshotId: String(row.context_snapshot_id) } : {}),
      decisions,
      openQuestions,
      nextActions,
      artifactRefs,
      messageRefs,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }
  }

  getActiveContext(projectId: string, workspaceId: string | null): ActiveContextV2 | undefined {
    const row = this.#database.prepare(`SELECT projection_json FROM active_contexts WHERE project_id = ? AND workspace_key = ?`).get(projectId, metadataWorkspaceKey(workspaceId)) as Row | undefined
    return row === undefined ? undefined : json<ActiveContextV2>(row.projection_json as SQLInputValue)
  }

  saveActiveContext(value: ActiveContextV2): void {
    this.#database.prepare(`
      INSERT INTO active_contexts(project_id, workspace_key, version, projection_json, updated_at)
      VALUES(?, ?, ?, ?, ?)
      ON CONFLICT(project_id, workspace_key) DO UPDATE SET
        version = excluded.version,
        projection_json = excluded.projection_json,
        updated_at = excluded.updated_at
    `).run(value.projectId, metadataWorkspaceKey(value.workspaceId), value.version, JSON.stringify(value), value.updatedAt)
  }

  getCommandDraft(projectId: string, workspaceId: string | null, composerAnchor: string): CommandDraftV1 | undefined {
    const row = this.#database.prepare(`SELECT * FROM command_drafts WHERE project_id = ? AND workspace_key = ? AND composer_anchor = ?`).get(projectId, metadataWorkspaceKey(workspaceId), composerAnchor) as Row | undefined
    if (row === undefined) return undefined
    return {
      schemaVersion: 1,
      projectId,
      workspaceId,
      composerAnchor,
      prompt: String(row.prompt),
      contextViewIds: json<readonly string[]>(row.context_view_ids_json as SQLInputValue),
      provider: String(row.provider),
      createAsNewNode: Number(row.create_as_new_node) === 1,
      updatedAt: String(row.updated_at),
    }
  }

  saveCommandDraft(value: CommandDraftV1): void {
    this.#database.prepare(`
      INSERT INTO command_drafts(project_id, workspace_key, composer_anchor, prompt, context_view_ids_json, provider, create_as_new_node, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, workspace_key, composer_anchor) DO UPDATE SET
        prompt = excluded.prompt,
        context_view_ids_json = excluded.context_view_ids_json,
        provider = excluded.provider,
        create_as_new_node = excluded.create_as_new_node,
        updated_at = excluded.updated_at
    `).run(value.projectId, metadataWorkspaceKey(value.workspaceId), value.composerAnchor, value.prompt, JSON.stringify(value.contextViewIds), value.provider, value.createAsNewNode ? 1 : 0, value.updatedAt)
  }

  deleteCommandDraft(projectId: string, workspaceId: string | null, composerAnchor: string): void {
    this.#database.prepare(`DELETE FROM command_drafts WHERE project_id = ? AND workspace_key = ? AND composer_anchor = ?`).run(projectId, metadataWorkspaceKey(workspaceId), composerAnchor)
  }

  saveContextProposal(value: ContextChangeProposalV1): void {
    const now = new Date().toISOString()
    this.#database.prepare(`
      INSERT INTO context_proposals(proposal_id, project_id, workspace_key, status, proposal_json, created_at, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(proposal_id) DO UPDATE SET status = excluded.status, proposal_json = excluded.proposal_json, updated_at = excluded.updated_at
    `).run(value.proposalId, value.projectId, metadataWorkspaceKey(value.workspaceId), value.status, JSON.stringify(value), now, now)
  }

  getContextProposal(projectId: string, proposalId: string): ContextChangeProposalV1 | undefined {
    const row = this.#database.prepare(`SELECT proposal_json FROM context_proposals WHERE project_id = ? AND proposal_id = ?`).get(projectId, proposalId) as Row | undefined
    return row === undefined ? undefined : json<ContextChangeProposalV1>(row.proposal_json as SQLInputValue)
  }

  listContextProposals(projectId: string, workspaceId?: string | null): readonly ContextChangeProposalV1[] {
    const rows = workspaceId === undefined
      ? this.#database.prepare(`SELECT proposal_json FROM context_proposals WHERE project_id = ? ORDER BY created_at DESC`).all(projectId) as Row[]
      : this.#database.prepare(`SELECT proposal_json FROM context_proposals WHERE project_id = ? AND workspace_key = ? ORDER BY created_at DESC`).all(projectId, metadataWorkspaceKey(workspaceId)) as Row[]
    return rows.map((row) => json<ContextChangeProposalV1>(row.proposal_json as SQLInputValue))
  }

  saveRunInputRequest(value: RunInputRequestV1): void {
    const existing = this.getRunInputRequest(value.requestId)
    if (existing !== undefined) {
      const sameIdentity = existing.runId === value.runId
        && existing.question === value.question
        && JSON.stringify(existing.options) === JSON.stringify(value.options)
        && existing.allowFreeText === value.allowFreeText
        && existing.contextVersion === value.contextVersion
      if (!sameIdentity) throw new Error('INPUT_REQUEST_IDEMPOTENCY_CONFLICT')
      // A delayed provider sync must never reopen a question the user already answered or cancelled.
      if (existing.status !== 'pending' && value.status === 'pending') return
    }
    this.#database.prepare(`
      INSERT INTO run_input_requests(
        request_id, run_id, question, options_json, allow_free_text, context_version, status,
        answer_text, selected_options_json, created_at, answered_at, updated_at
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(request_id) DO UPDATE SET
        status = excluded.status,
        answer_text = excluded.answer_text,
        selected_options_json = excluded.selected_options_json,
        answered_at = excluded.answered_at,
        updated_at = excluded.updated_at
    `).run(
      value.requestId, value.runId, value.question, JSON.stringify(value.options), value.allowFreeText ? 1 : 0,
      value.contextVersion ?? null, value.status, value.answerText ?? null, JSON.stringify(value.selectedOptions),
      value.createdAt, value.answeredAt ?? null, value.answeredAt ?? value.createdAt,
    )
  }

  getRunInputRequest(requestId: string): RunInputRequestV1 | undefined {
    const row = this.#database.prepare(`SELECT * FROM run_input_requests WHERE request_id = ?`).get(requestId) as Row | undefined
    return row === undefined ? undefined : this.#runInputRequest(row)
  }

  getPendingRunInputRequest(runId: string): RunInputRequestV1 | undefined {
    const row = this.#database.prepare(`
      SELECT * FROM run_input_requests WHERE run_id = ? AND status = 'pending'
      ORDER BY created_at DESC LIMIT 1
    `).get(runId) as Row | undefined
    return row === undefined ? undefined : this.#runInputRequest(row)
  }

  listRunInputRequests(runId: string): readonly RunInputRequestV1[] {
    return (this.#database.prepare(`SELECT * FROM run_input_requests WHERE run_id = ? ORDER BY created_at`).all(runId) as Row[])
      .map((row) => this.#runInputRequest(row))
  }

  answerRunInputRequest(runId: string, input: AnswerRunInputRequestV1, answeredAt: string): RunInputRequestV1 {
    const current = this.getRunInputRequest(input.requestId)
    if (current === undefined || current.runId !== runId) throw new Error('INPUT_REQUEST_NOT_FOUND')
    if (current.status === 'answered') return current
    if (current.status !== 'pending') throw new Error('INPUT_REQUEST_NOT_PENDING')
    const selectedOptions = [...new Set(input.selectedOptions ?? [])]
    if (selectedOptions.some((option) => !current.options.includes(option))) throw new Error('INPUT_OPTION_INVALID')
    const answerText = input.text?.trim()
    if (answerText && !current.allowFreeText) throw new Error('FREE_TEXT_NOT_ALLOWED')
    if (!answerText && selectedOptions.length === 0) throw new Error('INPUT_RESPONSE_EMPTY')
    const answered: RunInputRequestV1 = {
      ...current,
      status: 'answered',
      ...(answerText ? { answerText } : {}),
      selectedOptions,
      answeredAt,
    }
    this.saveRunInputRequest(answered)
    return answered
  }

  #runInputRequest(row: Row): RunInputRequestV1 {
    return {
      schemaVersion: 1,
      requestId: String(row.request_id),
      runId: String(row.run_id),
      question: String(row.question),
      options: json<readonly string[]>(row.options_json as SQLInputValue),
      allowFreeText: Number(row.allow_free_text) === 1,
      ...(row.context_version === null || row.context_version === undefined ? {} : { contextVersion: Number(row.context_version) }),
      status: String(row.status) as RunInputRequestV1['status'],
      ...(row.answer_text ? { answerText: String(row.answer_text) } : {}),
      selectedOptions: json<readonly string[]>(row.selected_options_json as SQLInputValue),
      createdAt: String(row.created_at),
      ...(row.answered_at ? { answeredAt: String(row.answered_at) } : {}),
    }
  }

  getProviderSessionBinding(projectId: string, provider: 'codex' | 'workbuddy'): ProviderSessionBindingV1 | undefined {
    const row = this.#database.prepare(`SELECT * FROM provider_session_bindings WHERE project_id = ? AND provider = ?`).get(projectId, provider) as Row | undefined
    if (row === undefined) return undefined
    return {
      projectId,
      provider,
      externalSessionId: String(row.external_session_id),
      origin: String(row.origin) as ProviderSessionBindingV1['origin'],
      status: String(row.status) as ProviderSessionBindingV1['status'],
      lastSeenAt: String(row.last_seen_at),
      ...(row.last_run_id ? { lastRunId: String(row.last_run_id) } : {}),
      ...(row.lease_owner ? { leaseOwner: String(row.lease_owner) } : {}),
      ...(row.lease_expires_at ? { leaseExpiresAt: String(row.lease_expires_at) } : {}),
      failureCount: Number(row.failure_count),
      updatedAt: String(row.updated_at),
    }
  }

  saveProviderSessionBinding(value: ProviderSessionBindingV1): void {
    this.#database.prepare(`
      INSERT INTO provider_session_bindings(project_id, provider, external_session_id, origin, status, last_seen_at, last_run_id, lease_owner, lease_expires_at, failure_count, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id, provider) DO UPDATE SET
        external_session_id = excluded.external_session_id,
        origin = excluded.origin,
        status = excluded.status,
        last_seen_at = excluded.last_seen_at,
        last_run_id = excluded.last_run_id,
        lease_owner = excluded.lease_owner,
        lease_expires_at = excluded.lease_expires_at,
        failure_count = excluded.failure_count,
        updated_at = excluded.updated_at
    `).run(value.projectId, value.provider, value.externalSessionId, value.origin, value.status, value.lastSeenAt, value.lastRunId ?? null, value.leaseOwner ?? null, value.leaseExpiresAt ?? null, value.failureCount, value.updatedAt)
  }

  deleteProviderSessionBinding(projectId: string, provider: 'codex' | 'workbuddy'): void {
    this.#database.prepare(`DELETE FROM provider_session_bindings WHERE project_id = ? AND provider = ?`).run(projectId, provider)
  }
}

// ==================== Module helpers ====================


function metadataWorkspaceKey(workspaceId: string | null | undefined): string {
  return workspaceId ?? '__project_overview__'
}


/** Presentation-only ops — do NOT advance graphVersion. */
const PRESENTATION_OPS = new Set([
  'move_artifact_view',
  'resize_artifact_view',
  'update_workspace_viewport',
  'update_workspace_presentation',
  'update_workspace_frame',
  'update_artifact_view_presentation',
  'delete_artifact_view',
])

/**
 * .lcosproj 工程文件拷贝清单（父表在前；WHERE 统一接受 projectId 参数）。
 */
const PROJECT_TRUTH_TABLES: readonly { readonly table: string; readonly where: string }[] = [
  { table: 'projects', where: 'id = ?' },
  { table: 'active_contexts', where: 'project_id = ?' },
  { table: 'context_proposals', where: 'project_id = ?' },
  { table: 'command_drafts', where: 'project_id = ?' },
  { table: 'provider_session_bindings', where: 'project_id = ?' },
  { table: 'scopes', where: 'project_id = ?' },
  { table: 'workspaces', where: 'project_id = ?' },
  { table: 'artifacts', where: 'project_id = ?' },
  { table: 'file_records', where: 'project_id = ?' },
  { table: 'artifact_revisions', where: 'artifact_id IN (SELECT id FROM artifacts WHERE project_id = ?)' },
  { table: 'artifact_views', where: 'artifact_id IN (SELECT id FROM artifacts WHERE project_id = ?)' },
  { table: 'relations', where: 'project_id = ?' },
  { table: 'conversation_sessions', where: 'project_id = ?' },
  { table: 'conversation_messages', where: 'session_id IN (SELECT id FROM conversation_sessions WHERE project_id = ?) AND pinned_as_decision = 1' },
  { table: 'conversation_file_references', where: 'message_id IN (SELECT m.id FROM conversation_messages m JOIN conversation_sessions s ON s.id = m.session_id WHERE s.project_id = ? AND m.pinned_as_decision = 1)' },
  { table: 'conversation_sections', where: 'session_id IN (SELECT id FROM conversation_sessions WHERE project_id = ?)' },
  { table: 'conversation_section_annotations', where: 'section_id IN (SELECT cs.id FROM conversation_sections cs JOIN conversation_sessions s ON s.id = cs.session_id WHERE s.project_id = ?)' },
  { table: 'conversation_messages_fts', where: 'message_id IN (SELECT m.id FROM conversation_messages m JOIN conversation_sessions s ON s.id = m.session_id WHERE s.project_id = ? AND m.pinned_as_decision = 1)' },
  { table: 'notes', where: 'project_id = ?' },
  { table: 'checkpoints', where: 'project_id = ?' },
  { table: 'handoffs', where: 'project_id = ?' },
  { table: 'context_manifests', where: 'project_id = ?' },
  { table: 'runs', where: 'project_id = ?' },
  { table: 'session_summaries', where: 'project_id = ?' },
  { table: 'preview_records', where: 'project_id = ?' },
  { table: 'runtime_dispatches', where: 'run_id IN (SELECT id FROM runs WHERE project_id = ?)' },
  { table: 'runtime_bindings', where: 'run_id IN (SELECT id FROM runs WHERE project_id = ?)' },
  { table: 'artifact_returns', where: 'run_id IN (SELECT id FROM runs WHERE project_id = ?)' },
  { table: 'run_events', where: 'run_id IN (SELECT id FROM runs WHERE project_id = ?)' },
  { table: 'run_input_requests', where: 'run_id IN (SELECT id FROM runs WHERE project_id = ?)' },
  { table: 'workspace_memberships', where: 'workspace_id IN (SELECT id FROM workspaces WHERE project_id = ?)' },
]

/**
 * 导入前按反向 FK 顺序清空目标库中该项目的旧行。
 */
const PROJECT_TRUTH_DELETE_SQL: readonly string[] = [
  'DELETE FROM conversation_file_references WHERE message_id IN (SELECT m.id FROM conversation_messages m JOIN conversation_sessions s ON s.id = m.session_id WHERE s.project_id = ?)',
  'DELETE FROM conversation_messages_fts WHERE message_id IN (SELECT m.id FROM conversation_messages m JOIN conversation_sessions s ON s.id = m.session_id WHERE s.project_id = ?)',
  'DELETE FROM conversation_section_annotations WHERE section_id IN (SELECT cs.id FROM conversation_sections cs JOIN conversation_sessions s ON s.id = cs.session_id WHERE s.project_id = ?)',
  'DELETE FROM conversation_sections WHERE session_id IN (SELECT id FROM conversation_sessions WHERE project_id = ?)',
  'DELETE FROM conversation_messages WHERE session_id IN (SELECT id FROM conversation_sessions WHERE project_id = ?)',
  'DELETE FROM conversation_sessions WHERE project_id = ?',
  'DELETE FROM workspace_memberships WHERE workspace_id IN (SELECT id FROM workspaces WHERE project_id = ?)',
  'DELETE FROM run_input_requests WHERE run_id IN (SELECT id FROM runs WHERE project_id = ?)',
  'DELETE FROM run_events WHERE run_id IN (SELECT id FROM runs WHERE project_id = ?)',
  'DELETE FROM artifact_returns WHERE run_id IN (SELECT id FROM runs WHERE project_id = ?)',
  'DELETE FROM runtime_bindings WHERE run_id IN (SELECT id FROM runs WHERE project_id = ?)',
  'DELETE FROM runtime_dispatches WHERE run_id IN (SELECT id FROM runs WHERE project_id = ?)',
  'DELETE FROM preview_records WHERE project_id = ?',
  'DELETE FROM session_summaries WHERE project_id = ?',
  'DELETE FROM checkpoints WHERE project_id = ?',
  'DELETE FROM handoffs WHERE project_id = ?',
  'DELETE FROM notes WHERE project_id = ?',
  'DELETE FROM relations WHERE project_id = ?',
  'DELETE FROM artifact_views WHERE artifact_id IN (SELECT id FROM artifacts WHERE project_id = ?)',
  'DELETE FROM artifact_revisions WHERE artifact_id IN (SELECT id FROM artifacts WHERE project_id = ?)',
  'DELETE FROM runs WHERE project_id = ?',
  'DELETE FROM context_manifests WHERE project_id = ?',
  'DELETE FROM file_records WHERE project_id = ?',
  'DELETE FROM artifacts WHERE project_id = ?',
  'DELETE FROM workspaces WHERE project_id = ?',
  'DELETE FROM scopes WHERE project_id = ?',
  'DELETE FROM provider_session_bindings WHERE project_id = ?',
  'DELETE FROM command_drafts WHERE project_id = ?',
  'DELETE FROM context_proposals WHERE project_id = ?',
  'DELETE FROM active_contexts WHERE project_id = ?',
  'DELETE FROM projects WHERE id = ?',
]

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
