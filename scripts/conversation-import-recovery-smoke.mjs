import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { SqliteMetadataRepository } from '../apps/local-core/dist/metadata-repository.js'
import { ConversationImportService } from '../apps/local-core/dist/conversation-import-service.js'

const fixture = join(process.cwd(), 'docs', 'testing', 'fixtures', 'conversation-import-sample', 'session-p0-slice.jsonl')
const root = await mkdtemp(join(tmpdir(), 'lcos-conversation-recovery-'))
try {
  const projectId = 'project-conversation-recovery'
  const projectRoot = join(root, 'project')
  const databasePath = join(root, 'metadata.sqlite3')
  await mkdir(projectRoot, { recursive: true })
  const repository = new SqliteMetadataRepository(databasePath)
  repository.createProject({ id: projectId, name: 'Conversation Recovery', rootPath: projectRoot })
  const bytes = await readFile(fixture)
  const sourceHash = createHash('sha256').update(bytes).digest('hex')
  const conversationId = `conversation-${createHash('sha256').update(`${projectId}:${sourceHash}`).digest('hex').slice(0, 24)}`
  const staleDir = join(projectRoot, '.creative-os', 'conversations', conversationId)
  const stalePath = join(staleDir, 'stale.jsonl')
  await mkdir(staleDir, { recursive: true })
  await writeFile(stalePath, 'partial stale import', 'utf8')
  const db = new DatabaseSync(databasePath)
  const timestamp = new Date().toISOString()
  db.prepare(`
    INSERT INTO conversation_sessions (
      id, project_id, provider, source_kind, title, message_count, section_count, status,
      source_content_hash, source_file_name, source_path, origin_meta_json,
      imported_at, created_at, updated_at
    ) VALUES (?, ?, 'codex', 'codex', 'Stale import', 0, 0, 'failed', ?, 'stale.jsonl', ?, '{}', ?, ?, ?)
  `).run(conversationId, projectId, sourceHash, stalePath, timestamp, timestamp, timestamp)
  db.close()

  const service = new ConversationImportService(repository, { stagingRoot: join(root, 'staging') })
  try {
    const upload = await service.createImportSession(projectId, {
      sourceKind: 'codex', sourceFileName: 'session.jsonl', expectedBytes: bytes.length,
      scopeId: `scope-${projectId}-root`, workspaceId: `workspace-${projectId}-main`,
    })
    await service.appendChunk(projectId, upload.id, 0, bytes, sourceHash)
    const completed = await service.completeImport(projectId, upload.id, { expectedChunks: 1, expectedContentHash: sourceHash })
    if (completed.session.id !== conversationId || completed.session.status !== 'ready') throw new Error('Failed import did not recover into the deterministic conversation identity.')
    const countDb = new DatabaseSync(databasePath)
    const count = Number(countDb.prepare('SELECT COUNT(*) AS count FROM conversation_sessions WHERE project_id=? AND source_content_hash=?').get(projectId, sourceHash).count)
    countDb.close()
    if (count !== 1) throw new Error(`Expected one recovered conversation, got ${count}.`)
    let staleExists = true
    try { await access(stalePath) } catch { staleExists = false }
    if (staleExists) throw new Error('Failed import source was not cleaned before retry.')
    if (repository.foreignKeyCheck().length > 0) throw new Error('Foreign key check failed after recovery.')
    console.log(JSON.stringify({ ok: true, conversationId, deterministicIdentity: true, staleCleanup: true, rows: count }, null, 2))
  } finally {
    service.close()
    repository.close()
  }
} finally {
  await rm(root, { recursive: true, force: true })
}
