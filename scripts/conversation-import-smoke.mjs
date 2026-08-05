import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteMetadataRepository } from '../apps/local-core/dist/metadata-repository.js'
import { ConversationImportService } from '../apps/local-core/dist/conversation-import-service.js'
import { ImportCopyService } from '../apps/local-core/dist/import-copy-service.js'
import { LcosprojService } from '../apps/local-core/dist/lcosproj-service.js'

const fixture = process.env.LCOS_CONVERSATION_FIXTURE || join(process.cwd(), 'docs', 'testing', 'fixtures', 'conversation-import-sample', 'session-p0-slice.jsonl')
const root = await mkdtemp(join(tmpdir(), 'lcos-conversation-smoke-'))
try {
  const projectRoot = join(root, 'project')
  await mkdir(projectRoot, { recursive: true })
  const repository = new SqliteMetadataRepository(join(root, 'lcos.sqlite3'))
  repository.createProject({ id: 'project-conversation-smoke', name: 'Conversation Smoke', rootPath: projectRoot })
  const importCopy = new ImportCopyService(repository)
  const referencedProjectFiles = [
    ['fixture-codex-env', 'CODEX_ENV_FINGERPRINT_20260805.txt', 'Codex environment fingerprint'],
    ['fixture-natural-language', 'natural-language-samples.md', '# Natural language samples'],
    ['fixture-result-envelope', 'result-envelope-v0.json', '{"schemaVersion":0}'],
  ]
  for (const [importRequestId, fileName, body] of referencedProjectFiles) {
    await importCopy.importCopy('project-conversation-smoke', {
      importRequestId, fileName, contentType: 'text/plain', bytes: Buffer.from(body, 'utf8'),
      scopeId: 'scope-project-conversation-smoke-root', position: { x: 40, y: 40 },
    })
  }
  const service = new ConversationImportService(repository, { stagingRoot: join(root, 'staging') })
  try {
    const bytes = await readFile(fixture)
    const upload = await service.createImportSession('project-conversation-smoke', {
      sourceKind: 'codex', title: 'Conversation Smoke', sourceFileName: 'session.jsonl', expectedBytes: bytes.length,
      scopeId: 'scope-project-conversation-smoke-root', workspaceId: 'workspace-project-conversation-smoke-main',
    })
    const chunkSize = 4 * 1024 * 1024
    let chunks = 0
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize))
      await service.appendChunk('project-conversation-smoke', upload.id, chunks, chunk, createHash('sha256').update(chunk).digest('hex'))
      chunks += 1
    }
    const sourceHash = createHash('sha256').update(bytes).digest('hex')
    const completed = await service.completeImport('project-conversation-smoke', upload.id, { expectedChunks: chunks, expectedContentHash: sourceHash })
    const replayUpload = await service.createImportSession('project-conversation-smoke', {
      sourceKind: 'codex', title: 'Conversation Smoke Replay', sourceFileName: 'session-replay.jsonl', expectedBytes: bytes.length,
      scopeId: 'scope-project-conversation-smoke-root', workspaceId: 'workspace-project-conversation-smoke-main',
    })
    let replayChunks = 0
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize))
      await service.appendChunk('project-conversation-smoke', replayUpload.id, replayChunks, chunk, createHash('sha256').update(chunk).digest('hex'))
      replayChunks += 1
    }
    const replay = await service.completeImport('project-conversation-smoke', replayUpload.id, { expectedChunks: replayChunks, expectedContentHash: sourceHash })
    if (replay.session.id !== completed.session.id) throw new Error('Same conversation content did not replay idempotently.')
    if (completed.sections.length !== 4) throw new Error(`Expected 4 zero-token sections, received ${completed.sections.length}.`)
    const lexical = await service.search('project-conversation-smoke', 'LCOS', { semantic: false, limit: 5 })
    let projection = service.getProjection('project-conversation-smoke', completed.session.id)
    if (!projection || completed.session.messageCount !== 139 || lexical.length < 1) throw new Error('Conversation smoke result is incomplete.')
    const allMessages = service.getMessages(completed.session.id, { limit: 1000 })
    const fileReferenceCount = allMessages.reduce((total, message) => total + message.fileRefs.length, 0)
    if (fileReferenceCount < 3) throw new Error(`Expected at least 3 source file references, received ${fileReferenceCount}.`)

    const firstSection = completed.sections[0]
    const source = service.getSectionSource(completed.session.id, firstSection.id)
    service.annotateSection('project-conversation-smoke', completed.session.id, firstSection.id, {
      sourceHash: source.sourceHash, title: '收口设计', decisions: ['原始时间线是唯一真相'], todos: ['完成真实闭环'], involvedFiles: ['LCOS_GATEF_REMAINING_GAPS_FOR_DEV_20260805.md'], annotatedBy: 'agent',
    })
    service.annotateSection('project-conversation-smoke', completed.session.id, firstSection.id, {
      sourceHash: source.sourceHash, title: '人工定稿', decisions: ['人工决策优先'], todos: [], involvedFiles: [], annotatedBy: 'user',
    })
    let protectedAnnotation = false
    try {
      service.annotateSection('project-conversation-smoke', completed.session.id, firstSection.id, {
        sourceHash: source.sourceHash, title: 'Agent 覆盖', decisions: [], todos: [], involvedFiles: [], annotatedBy: 'agent',
      })
    } catch (error) {
      protectedAnnotation = error instanceof Error && error.message === 'ANNOTATION_USER_LOCKED'
    }
    if (!protectedAnnotation) throw new Error('Agent overwrote a user-authored section annotation.')
    service.updateSection('project-conversation-smoke', completed.session.id, firstSection.id, { title: '用户锁定章节' })
    const refreshed = service.refreshSections('project-conversation-smoke', completed.session.id)
    const locked = refreshed.find((section) => section.id === firstSection.id)
    if (!locked?.lockedByUser || locked.title !== '用户锁定章节') throw new Error('Locked section was overwritten by refresh.')

    for (const message of allMessages.filter((item) => item.role === 'user' || item.role === 'assistant').slice(0, 2)) {
      await service.pinMessage('project-conversation-smoke', completed.session.id, message.id, { scopeId: 'scope-project-conversation-smoke-root', workspaceId: 'workspace-project-conversation-smoke-main' })
    }
    projection = service.getProjection('project-conversation-smoke', completed.session.id)
    if (!projection || projection.pinnedDecisions.length !== 2) throw new Error('Expected two pinned decisions.')
    const compactExport = service.exportConversation('project-conversation-smoke', completed.session.id, false)
    if (compactExport.messages !== undefined || compactExport.source.rawTimelineIncluded) throw new Error('Compact conversation export leaked the raw timeline.')
    const rawExport = service.exportConversation('project-conversation-smoke', completed.session.id, true)
    if (rawExport.messages?.length !== 139 || !rawExport.source.rawTimelineIncluded) throw new Error('Explicit raw conversation export is incomplete.')

    const projectFile = join(root, 'conversation-smoke.lcosproj')
    const projectPackage = new LcosprojService(repository, '0.9.0')
    const packageResult = await projectPackage.exportProject('project-conversation-smoke', projectFile)
    const importedRepository = new SqliteMetadataRepository(join(root, 'imported.sqlite3'))
    try {
      const importedPackage = new LcosprojService(importedRepository, '0.9.0')
      await importedPackage.open(projectFile)
      const importedConversations = new ConversationImportService(importedRepository, { stagingRoot: join(root, 'imported-staging') })
      try {
        const importedProjection = importedConversations.getProjection('project-conversation-smoke', completed.session.id)
        if (!importedProjection || importedProjection.sections.length !== 4 || importedProjection.pinnedDecisions.length !== 2) {
          throw new Error('.lcosproj did not preserve conversation metadata, sections and pinned decisions.')
        }
        if (importedProjection.session.messageCount !== 2) throw new Error('.lcosproj should include only pinned messages by default.')
      } finally { importedConversations.close() }
    } finally { importedRepository.close() }

    const fk = repository.foreignKeyCheck()
    if (fk.length > 0) throw new Error(`foreign_key_check failed: ${JSON.stringify(fk)}`)
    console.log(JSON.stringify({ ok: true, messages: completed.session.messageCount, sections: completed.sections.length, pinnedDecisions: 2, fileReferences: fileReferenceCount, lexicalHits: lexical.length, lcosprojSchema: packageResult.schemaVersion, userAnnotationProtected: true, duplicateImportIdempotent: true, semantic: projection.semanticIndex }, null, 2))
  } finally { service.close(); repository.close() }
} finally { await rm(root, { recursive: true, force: true }) }
