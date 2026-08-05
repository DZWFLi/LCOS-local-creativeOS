import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { SqliteMetadataRepository } from '../apps/local-core/dist/metadata-repository.js'

const temp = await mkdtemp(join(tmpdir(), 'lcos-schema-v18-'))
const databasePath = join(temp, 'metadata.sqlite3')
try {
  const database = new DatabaseSync(databasePath)
  database.exec(`
    PRAGMA foreign_keys=OFF;
    CREATE TABLE projects (id TEXT PRIMARY KEY);
    CREATE TABLE artifacts (id TEXT PRIMARY KEY);
    CREATE TABLE relations (id TEXT PRIMARY KEY);
    CREATE TABLE conversation_sessions (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, provider TEXT NOT NULL,
      source_kind TEXT NOT NULL, title TEXT NOT NULL, message_count INTEGER NOT NULL DEFAULT 0,
      section_count INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL,
      source_content_hash TEXT, source_file_name TEXT, source_path TEXT,
      origin_meta_json TEXT NOT NULL DEFAULT '{}', conversation_artifact_id TEXT,
      conversation_view_id TEXT, imported_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE conversation_messages (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL, seq INTEGER NOT NULL, role TEXT NOT NULL,
      event_kind TEXT NOT NULL, source_event_id TEXT, content_text TEXT NOT NULL, created_at TEXT NOT NULL,
      tool_name TEXT, tool_call_json TEXT, file_refs_json TEXT NOT NULL DEFAULT '[]', parent_id TEXT,
      pinned_as_decision INTEGER NOT NULL DEFAULT 0, decision_artifact_id TEXT, content_hash TEXT NOT NULL
    );
    CREATE TABLE conversation_embedding_jobs (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, session_id TEXT, provider TEXT NOT NULL DEFAULT 'ollama',
      model TEXT NOT NULL, status TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0,
      indexed_messages INTEGER NOT NULL DEFAULT 0, stale_messages INTEGER NOT NULL DEFAULT 0,
      dimensions INTEGER, backend TEXT NOT NULL, last_error TEXT, lease_owner TEXT, lease_expires_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE conversation_embeddings (
      message_id TEXT NOT NULL, model TEXT NOT NULL, dimensions INTEGER NOT NULL,
      content_hash TEXT NOT NULL, embedding_blob BLOB NOT NULL, indexed_at TEXT NOT NULL,
      PRIMARY KEY(message_id, model)
    );
    INSERT INTO projects VALUES ('project-v17');
    INSERT INTO conversation_sessions VALUES (
      'conversation-v17','project-v17','codex','codex','Legacy',1,0,'ready','hash','legacy.jsonl',NULL,'{}',NULL,NULL,
      '2026-08-05T00:00:00.000Z','2026-08-05T00:00:00.000Z','2026-08-05T00:00:00.000Z'
    );
    INSERT INTO conversation_messages VALUES (
      'message-v17','conversation-v17',0,'user','message',NULL,'hello','2026-08-05T00:00:00.000Z',
      NULL,NULL,'[]',NULL,0,NULL,'content-hash'
    );
    INSERT INTO conversation_embedding_jobs VALUES (
      'job-v17','project-v17','conversation-v17','ollama','legacy-model','ready',1,1,0,3,'sqlite-blob-fallback',
      NULL,NULL,NULL,'2026-08-05T00:00:00.000Z','2026-08-05T00:00:00.000Z'
    );
    INSERT INTO conversation_embeddings VALUES (
      'message-v17','legacy-model',3,'content-hash',X'000000000000000000000000','2026-08-05T00:00:00.000Z'
    );
    PRAGMA user_version=17;
  `)
  database.close()

  const repository = new SqliteMetadataRepository(databasePath)
  try {
    if (repository.schemaVersion !== 18) throw new Error(`Expected schema 18, got ${repository.schemaVersion}`)
    if (repository.foreignKeyCheck().length !== 0) throw new Error('Migration produced foreign key errors.')
  } finally {
    repository.close()
  }

  const migrated = new DatabaseSync(databasePath)
  const session = migrated.prepare('SELECT * FROM conversation_sessions WHERE id=?').get('conversation-v17')
  const message = migrated.prepare('SELECT * FROM conversation_messages WHERE id=?').get('message-v17')
  const job = migrated.prepare('SELECT * FROM conversation_embedding_jobs WHERE id=?').get('job-v17')
  const embedding = migrated.prepare('SELECT * FROM conversation_embeddings WHERE message_id=?').get('message-v17')
  const refsTable = migrated.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='conversation_file_references'").get()
  migrated.close()
  if (!session || session.parsed_line_count !== 0) throw new Error('Session diagnostics migration failed.')
  if (!message || message.embedding_input_hash !== null) throw new Error('Message embedding columns migration failed.')
  if (!job || job.index_version !== 'message-v1' || job.batch_size !== 16) throw new Error('Embedding job migration failed.')
  if (!embedding || embedding.input_hash !== 'content-hash' || embedding.embedding_version !== 'legacy-v0') throw new Error('Embedding row migration failed.')
  if (!refsTable) throw new Error('conversation_file_references table missing.')
  if (!existsSync(`${databasePath}.v17.bak`)) throw new Error('v17 backup was not created.')
  process.stdout.write(`${JSON.stringify({ ok: true, schemaVersion: 18, backup: true, legacyRowsPreserved: true }, null, 2)}\n`)
} finally {
  await rm(temp, { recursive: true, force: true })
}
