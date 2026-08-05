import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteMetadataRepository } from '../apps/local-core/dist/metadata-repository.js'
import { ConversationImportService } from '../apps/local-core/dist/conversation-import-service.js'

const root = process.cwd()
const fixture = process.env.LCOS_CONVERSATION_FIXTURE || join(root, 'docs', 'testing', 'fixtures', 'conversation-import-sample', 'session-p0-slice.jsonl')
const extension = process.env.LCOS_SQLITE_VEC_EXTENSION || join(root, '.runtime', 'sqlite-vec', process.platform === 'win32' ? 'vec0.dll' : process.platform === 'darwin' ? 'vec0.dylib' : 'vec0.so')
const requireVec = process.env.LCOS_REQUIRE_SQLITE_VEC === '1'
if (requireVec && !existsSync(extension)) throw new Error(`sqlite-vec extension is missing: ${extension}`)

function deterministicVector(text) {
  const vector = new Array(12).fill(0)
  const normalized = String(text).toLocaleLowerCase('zh-CN')
  for (let index = 0; index < normalized.length; index += 1) {
    const code = normalized.codePointAt(index) ?? 0
    vector[(code + index) % vector.length] += 1
  }
  const length = Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0)) || 1
  return vector.map((item) => item / length)
}

async function createFakeOllama() {
  const server = createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/api/embed') {
      response.writeHead(404).end()
      return
    }
    let body = ''
    for await (const chunk of request) body += chunk.toString()
    const payload = JSON.parse(body)
    const input = Array.isArray(payload.input) ? payload.input : [payload.input]
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ embeddings: input.map(deterministicVector) }))
  })
  await new Promise((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Fake Ollama failed to bind.')
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolvePromise, rejectPromise) => server.close((error) => error ? rejectPromise(error) : resolvePromise())),
  }
}

const fakeOllama = process.env.LCOS_OLLAMA_URL ? undefined : await createFakeOllama()
const ollamaUrl = process.env.LCOS_OLLAMA_URL || fakeOllama.url
const temp = await mkdtemp(join(tmpdir(), 'lcos-semantic-smoke-'))
try {
  const projectRoot = join(temp, 'project')
  await mkdir(projectRoot, { recursive: true })
  const repository = new SqliteMetadataRepository(join(temp, 'metadata.sqlite3'))
  repository.createProject({ id: 'project-semantic-smoke', name: 'Semantic Smoke', rootPath: projectRoot })
  const service = new ConversationImportService(repository, {
    stagingRoot: join(temp, 'staging'),
    ollamaUrl,
    ...(existsSync(extension) ? { vectorExtensionPath: extension } : {}),
  })
  try {
    const bytes = await readFile(fixture)
    const upload = await service.createImportSession('project-semantic-smoke', {
      sourceKind: 'codex', sourceFileName: 'semantic-smoke.jsonl', expectedBytes: bytes.length,
      scopeId: 'scope-project-semantic-smoke-root', workspaceId: 'workspace-project-semantic-smoke-main',
    })
    await service.appendChunk('project-semantic-smoke', upload.id, 0, bytes, createHash('sha256').update(bytes).digest('hex'))
    const imported = await service.completeImport('project-semantic-smoke', upload.id, {
      expectedChunks: 1, expectedContentHash: createHash('sha256').update(bytes).digest('hex'),
    })
    const status = await service.buildSemanticIndex('project-semantic-smoke', {
      sessionId: imported.session.id,
      model: process.env.LCOS_OLLAMA_EMBED_MODEL || 'nomic-embed-text',
      force: true,
      batchSize: 16,
    })
    if (!['ready', 'partial'].includes(status.state) || status.indexedMessages < 1) {
      throw new Error(`Semantic index did not become usable: ${JSON.stringify(status)}`)
    }
    if (status.indexVersion !== 'message-v1') throw new Error(`Unexpected index version: ${status.indexVersion}`)
    if (requireVec && status.backend !== 'sqlite-vec') throw new Error(`Expected sqlite-vec, got ${status.backend}.`)
    const hits = await service.search('project-semantic-smoke', '上下文导入和语义检索', { semantic: true, limit: 10, model: status.model })
    if (!hits.some((hit) => hit.reasons.includes('vector'))) throw new Error('Hybrid search returned no vector-backed hit.')
    const second = await service.buildSemanticIndex('project-semantic-smoke', {
      sessionId: imported.session.id,
      model: status.model,
      force: false,
      batchSize: 16,
    })
    if (second.staleMessages !== 0) throw new Error(`Semantic rebuild left stale messages: ${second.staleMessages}`)
    process.stdout.write(`${JSON.stringify({
      ok: true,
      provider: fakeOllama ? 'deterministic-loopback-fixture' : 'real-ollama',
      status,
      incremental: second,
      hitCount: hits.length,
      topHits: hits.slice(0, 5).map((hit) => ({ seq: hit.message.seq, score: hit.hybridScore, reasons: hit.reasons, section: hit.sectionTitle })),
    }, null, 2)}\n`)
  } finally {
    service.close()
    repository.close()
  }
} finally {
  await rm(temp, { recursive: true, force: true })
  if (fakeOllama) await fakeOllama.close()
}
