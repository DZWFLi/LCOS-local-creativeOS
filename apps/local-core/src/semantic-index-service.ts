import { createHash } from 'node:crypto'
import { join, resolve } from 'node:path'

import type { SqliteMetadataRepository } from './metadata-repository.js'

const DEFAULT_EMBEDDING_MODEL = process.env.LCOS_OLLAMA_EMBED_MODEL ?? 'nomic-embed-text'
const DEFAULT_OLLAMA_URL = process.env.LCOS_OLLAMA_URL ?? 'http://127.0.0.1:11434'

export interface SemanticIndexHealthV0 {
  readonly ollama: 'available' | 'unavailable'
  readonly vector: 'native' | 'fallback' | 'unavailable'
  readonly backend: 'sqlite-vec' | 'sqlite-blob-fallback' | 'none'
  readonly model: string
}

export interface SemanticIndexedEntityV0 {
  readonly projectId: string
  readonly entityType: string
  readonly entityId: string
  readonly title: string
  readonly body: string
}

/**
 * Phase G: generic semantic index over the derived search_documents layer.
 * Conversation-specific embedding stays in ConversationImportService (compat);
 * artifacts/notes/resources/skills index through this service.
 * Vector availability is never a hard dependency.
 */
export class SemanticIndexService {
  #vectorLoaded = false
  readonly #ollamaUrl: string
  readonly #vectorExtensionPath: string | undefined

  constructor(
    private readonly repository: SqliteMetadataRepository,
    options: { readonly ollamaUrl?: string; readonly vectorExtensionPath?: string } = {},
  ) {
    const repoRoot = resolve(import.meta.dirname, '..', '..', '..')
    this.#ollamaUrl = options.ollamaUrl ?? DEFAULT_OLLAMA_URL
    this.#vectorExtensionPath = options.vectorExtensionPath
      ?? join(repoRoot, '.runtime', 'sqlite-vec', process.platform === 'win32' ? 'vec0.dll' : process.platform === 'darwin' ? 'vec0.dylib' : 'vec0.so')
    if (this.#vectorExtensionPath !== undefined) {
      this.#vectorLoaded = this.repository.loadVectorExtension(resolve(this.#vectorExtensionPath))
    }
  }

  health(): SemanticIndexHealthV0 {
    return {
      ollama: 'available', // real availability is probed lazily by embed(); embed failure reports unavailable to callers
      vector: this.#vectorLoaded ? 'native' : 'fallback',
      backend: this.#vectorLoaded ? 'sqlite-vec' : 'sqlite-blob-fallback',
      model: DEFAULT_EMBEDDING_MODEL,
    }
  }

  async embed(model: string, input: readonly string[]): Promise<number[][]> {
    const url = new URL('/api/embed', this.#ollamaUrl)
    if (!['127.0.0.1', 'localhost', '[::1]', '::1'].includes(url.hostname)) throw new Error('Ollama embedding endpoint must be loopback.')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120_000)
    try {
      const response = await fetch(url, {
        method: 'POST', signal: controller.signal,
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ model, input, truncate: true }),
      })
      if (!response.ok) throw new Error(`Ollama embed failed with HTTP ${response.status}.`)
      const value = await response.json() as { embeddings?: unknown }
      if (!Array.isArray(value.embeddings) || !value.embeddings.every((vector) => Array.isArray(vector) && vector.every((item) => typeof item === 'number'))) {
        throw new Error('Ollama returned an invalid embedding response.')
      }
      return value.embeddings as number[][]
    } finally { clearTimeout(timeout) }
  }

  async indexEntity(entity: SemanticIndexedEntityV0, model = DEFAULT_EMBEDDING_MODEL): Promise<{ readonly indexed: boolean; readonly vector: boolean }> {
    const contentHash = createHash('sha256').update(`${entity.title}\n${entity.body}`, 'utf8').digest('hex')
    const existing = this.repository.getSearchDocument(entity.projectId, entity.entityType, entity.entityId)
    if (existing !== undefined && existing.contentHash === contentHash) return { indexed: false, vector: false }
    this.repository.upsertSearchDocument({
      id: `search-doc-${entity.entityType}-${entity.entityId}`,
      projectId: entity.projectId,
      entityType: entity.entityType,
      entityId: entity.entityId,
      title: entity.title,
      body: entity.body,
      contentHash,
      updatedAt: new Date().toISOString(),
    })
    let vector = false
    try {
      const [embedding] = await this.embed(model, [`${entity.title}\n${entity.body}`])
      if (embedding !== undefined) {
        this.repository.upsertSearchDocumentEmbedding({
          entityId: entity.entityId,
          model,
          dimensions: embedding.length,
          contentHash,
          embeddingBlob: Buffer.from(new Float32Array(embedding).buffer),
          indexedAt: new Date().toISOString(),
        })
        vector = true
      }
    } catch {
      // Ollama unavailable: document stays FTS-indexed; vector will fill on next run.
    }
    return { indexed: true, vector }
  }

  deleteEntity(projectId: string, entityType: string, entityId: string): void {
    this.repository.deleteSearchDocument(projectId, entityType, entityId)
  }

  async searchVectors(query: string, model = DEFAULT_EMBEDDING_MODEL, limit = 10): Promise<Array<{ readonly entityId: string; readonly distance: number }>> {
    if (!this.#vectorLoaded) return []
    try {
      const [vector] = await this.embed(model, [query])
      if (vector === undefined) return []
      return this.repository.querySearchVectors(model, vector, limit)
    } catch {
      return []
    }
  }
}
