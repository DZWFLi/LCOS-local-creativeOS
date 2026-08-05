import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdtemp, mkdir, open, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { SqliteMetadataRepository } from '../apps/local-core/dist/metadata-repository.js'
import { ConversationImportService } from '../apps/local-core/dist/conversation-import-service.js'

const temp = await mkdtemp(join(tmpdir(), 'lcos-large-conversation-'))
const lineCount = Math.max(1_000, Number(process.env.LCOS_LARGE_CONVERSATION_LINES || 12_000))
const chunkBytes = 4 * 1024 * 1024
try {
  const projectRoot = join(temp, 'project')
  await mkdir(projectRoot, { recursive: true })
  const sourcePath = join(temp, 'large.jsonl')
  const output = createWriteStream(sourcePath, { encoding: 'utf8' })
  const paragraph = 'contextimportmarker 本地上下文导入只保存原始时间线，全文索引零 token，语义索引按需异步重建。'.repeat(18)
  for (let index = 0; index < lineCount; index += 1) {
    const line = JSON.stringify({
      timestamp: new Date(Date.UTC(2026, 7, 5, 0, 0, index % 60)).toISOString(),
      type: 'response_item',
      payload: { type: 'message', id: `large-${index}`, role: 'assistant', content: [{ type: 'output_text', text: `${index} ${paragraph}` }] },
    }) + '\n'
    if (!output.write(line)) await once(output, 'drain')
  }
  output.end()
  await once(output, 'close')
  const size = (await stat(sourcePath)).size

  const repository = new SqliteMetadataRepository(join(temp, 'metadata.sqlite3'))
  repository.createProject({ id: 'project-large-conversation', name: 'Large Conversation', rootPath: projectRoot })
  const service = new ConversationImportService(repository, { stagingRoot: join(temp, 'staging') })
  try {
    const upload = await service.createImportSession('project-large-conversation', {
      sourceKind: 'codex', sourceFileName: 'large.jsonl', expectedBytes: size,
      scopeId: 'scope-project-large-conversation-root', workspaceId: 'workspace-project-large-conversation-main',
    })
    const file = await open(sourcePath, 'r')
    const fullHash = createHash('sha256')
    let chunkIndex = 0
    try {
      for (let offset = 0; offset < size; offset += chunkBytes) {
        const length = Math.min(chunkBytes, size - offset)
        const buffer = Buffer.allocUnsafe(length)
        const { bytesRead } = await file.read(buffer, 0, length, offset)
        const bytes = buffer.subarray(0, bytesRead)
        fullHash.update(bytes)
        await service.appendChunk('project-large-conversation', upload.id, chunkIndex, bytes, createHash('sha256').update(bytes).digest('hex'))
        chunkIndex += 1
      }
    } finally { await file.close() }
    const completed = await service.completeImport('project-large-conversation', upload.id, {
      expectedChunks: chunkIndex, expectedContentHash: fullHash.digest('hex'),
    })
    const messages = service.getMessages(completed.session.id, { limit: lineCount + 10 })
    const hits = await service.search('project-large-conversation', 'contextimportmarker', { semantic: false, limit: 5 })
    if (messages.length !== lineCount) throw new Error(`Expected ${lineCount} messages, got ${messages.length}`)
    if (completed.sections.length < Math.ceil(lineCount / 200)) throw new Error(`Large conversation was not split into bounded zero-token sections: ${completed.sections.length}`)
    if (completed.sections[0]?.startSeq !== 0 || completed.sections.at(-1)?.endSeq !== lineCount - 1) throw new Error('Large conversation sections do not cover the full timeline.')
    for (let index = 0; index < completed.sections.length; index += 1) {
      const section = completed.sections[index]
      if (!section || section.endSeq < section.startSeq || section.endSeq - section.startSeq + 1 > 200) throw new Error(`Invalid bounded section at ${index}.`)
      if (index > 0 && completed.sections[index - 1].endSeq + 1 !== section.startSeq) throw new Error(`Section gap or overlap at ${index}.`)
    }
    if (hits.length < 1) throw new Error('Large conversation FTS search returned no hits.')
    process.stdout.write(`${JSON.stringify({ ok: true, bytes: size, chunks: chunkIndex, messages: messages.length, sections: completed.sections.length, ftsHits: hits.length }, null, 2)}\n`)
  } finally {
    service.close()
    repository.close()
  }
} finally {
  await rm(temp, { recursive: true, force: true })
}
