import type { SearchHitV0, SearchResultV0, SearchEntityTypeV0 } from '@local-creative-os/contracts'
import { open } from 'node:fs/promises'

import type { ConversationImportService } from './conversation-import-service.js'
import type { SqliteMetadataRepository } from './metadata-repository.js'
import type { SemanticIndexService } from './semantic-index-service.js'

const SNIPPET_CHARS = 160

function snippetFrom(text: string, query: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const index = normalized.toLocaleLowerCase('en-US').indexOf(query.toLocaleLowerCase('en-US'))
  if (index < 0) return normalized.slice(0, SNIPPET_CHARS)
  const start = Math.max(0, index - 40)
  return `${start > 0 ? '…' : ''}${normalized.slice(start, start + SNIPPET_CHARS)}${start + SNIPPET_CHARS < normalized.length ? '…' : ''}`
}

async function readTextPrefix(observedPath: string | undefined, maxChars: number): Promise<string> {
  if (observedPath === undefined) return ''
  try {
    const handle = await open(observedPath, 'r')
    try {
      const buffer = Buffer.alloc(maxChars * 4 + 4)
      const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, 0)
      return buffer.subarray(0, bytesRead).toString('utf8')
    } finally {
      await handle.close()
    }
  } catch {
    return ''
  }
}

/**
 * Phase D: federated search over existing sources — no new search DB.
 * Ranking V0 (simple, explicit): exact title/phrase > text artifact > note >
 * conversation FTS > resource title > descriptor summary.
 */
export class ProjectSearchService {
  constructor(
    private readonly repository: SqliteMetadataRepository,
    private readonly conversations: ConversationImportService | undefined,
    private readonly semantic: SemanticIndexService | undefined,
  ) {}

  async search(projectId: string, query: string, options: { readonly limit?: number; readonly types?: readonly SearchEntityTypeV0[]; readonly related?: boolean } = {}): Promise<SearchResultV0> {
    const limit = Math.max(1, Math.min(50, options.limit ?? 10))
    const types = new Set(options.types ?? ['artifact', 'note', 'conversation', 'resource'])
    const seen = new Set<string>()
    const needle = query.trim().toLocaleLowerCase('en-US')
    const hits: SearchHitV0[] = []
    const push = (hit: SearchHitV0): void => {
      // Derived-document hits may duplicate legacy sources for the same entity;
      // they are collected separately and deduped by entity at the end (best score wins).
      const key = hit.source === 'search-document-fts' || hit.source === 'vector'
        ? `${hit.source}:${hit.entityType}:${hit.entityId}`
        : `${hit.entityType}:${hit.entityId}`
      if (seen.has(key)) return
      seen.add(key)
      hits.push(hit)
    }
    if (needle === '') {
      return { schemaVersion: 0, query, hits: [], truncated: false, generatedAt: new Date().toISOString() }
    }

    const exactPhrase = (text: string): boolean => text.toLocaleLowerCase('en-US').includes(needle)

    // Artifact title + text content
    if (types.has('artifact')) {
      for (const artifact of this.repository.getArtifacts(projectId)) {
        const exactTitle = artifact.title.toLocaleLowerCase('en-US') === needle
        const titleMatch = exactPhrase(artifact.title)
        const viewId = this.repository.getArtifactViews(String(artifact.id))[0]?.id
        if (exactTitle) {
        push({ entityType: 'artifact', entityId: artifact.id, ...(viewId === undefined ? {} : { viewId }), title: artifact.title, snippet: artifact.title, source: 'artifact-title', score: 100 })
        } else if (titleMatch) {
          push({ entityType: 'artifact', entityId: artifact.id, ...(viewId === undefined ? {} : { viewId }), title: artifact.title, snippet: artifact.title, source: 'artifact-title', score: 80 })
        } else {
          const revisionId = artifact.currentRevisionId
          const revision = revisionId === undefined ? undefined : this.repository.getArtifactRevision(revisionId)
          const fileRecord = revision?.fileRecordId === undefined ? undefined : this.repository.getFileRecord(String(revision.fileRecordId))
          if (fileRecord?.mimeType === 'text/markdown' || fileRecord?.mimeType === 'text/plain') {
            const content = await readTextPrefix(fileRecord.observedPath, 8_000)
            if (exactPhrase(content)) {
              push({ entityType: 'artifact', entityId: artifact.id, ...(viewId === undefined ? {} : { viewId }), title: artifact.title, snippet: snippetFrom(content, query), source: 'artifact-text', score: 50 })
            }
          }
        }
      }
    }

    // Notes
    if (types.has('note')) {
      for (const note of this.repository.getNotes(projectId)) {
        if (!exactPhrase(note.body)) continue
        push({ entityType: 'note', entityId: note.id, title: note.body.slice(0, 60), snippet: snippetFrom(note.body, query), source: 'note', score: 50 })
      }
    }

    // Conversation FTS
    if (types.has('conversation') && this.conversations !== undefined) {
      const conversationHits = await this.conversations.search(projectId, query, { limit: 20 })
      for (const hit of conversationHits) {
        push({ entityType: 'conversation', entityId: hit.message.sessionId, title: hit.sessionTitle, snippet: snippetFrom(hit.message.contentText, query), source: 'conversation-fts', score: 40 })
      }
    }

    // Resource title + descriptor summary
    if (types.has('resource')) {
      for (const descriptor of this.repository.listResourceDescriptors(projectId)) {
        const title = descriptor.display.title
        const summary = descriptor.display.subtitle ?? ''
        if (exactPhrase(title)) {
          push({ entityType: 'resource', entityId: String(descriptor.resourceId), title, snippet: title, source: 'resource-title', score: 60 })
        } else if (exactPhrase(summary)) {
          push({ entityType: 'resource', entityId: String(descriptor.resourceId), title, snippet: snippetFrom(summary, query), source: 'descriptor-summary', score: 20 })
        }
      }
    }

    // Derived search_documents FTS (Phase G): artifacts/notes/resources indexed by SemanticIndexService.
    const docHits = this.repository.searchDocumentsFts(projectId, query, 20)
    for (const doc of docHits) {
      push({ entityType: 'artifact', entityId: doc.entityId, title: doc.title, snippet: snippetFrom(doc.body, query), source: 'search-document-fts', score: 35 })
    }

    // Vector candidates (available only when Ollama + embeddings exist).
    if (this.semantic !== undefined) {
      const vectorHits = await this.semantic.searchVectors(query, undefined, 10)
      for (const hit of vectorHits) {
        push({ entityType: 'artifact', entityId: hit.entityId, title: hit.entityId, snippet: `vector distance ${hit.distance.toFixed(3)}`, source: 'vector', score: 45 })
      }
    }

    // Related expansion (G8): seeds top 10 → 1-hop neighbors, ≤5 per seed.
    if (options.related === true) {
      const seeds = [...hits].sort((left, right) => right.score - left.score).slice(0, 10)
      for (const seed of seeds) {
        const neighbors = this.repository.getRelations(projectId)
          .filter((relation) => String(relation.sourceEntityId) === seed.entityId || String(relation.targetEntityId) === seed.entityId)
          .slice(0, 5)
        for (const relation of neighbors) {
          const otherId = String(relation.sourceEntityId) === seed.entityId ? String(relation.targetEntityId) : String(relation.sourceEntityId)
          push({ entityType: 'artifact', entityId: otherId, title: otherId, snippet: `related via ${relation.kind}`, source: 'related', score: 15 })
        }
      }
    }

    const ranked = hits.sort((left, right) => right.score - left.score).slice(0, limit * 3)
    const deduped: SearchHitV0[] = []
    const finalSeen = new Set<string>()
    for (const hit of ranked) {
      const key = `${hit.entityType}:${hit.entityId}`
      if (finalSeen.has(key)) continue
      finalSeen.add(key)
      deduped.push(hit)
      if (deduped.length >= limit) break
    }
    return {
      schemaVersion: 0,
      query,
      hits: deduped,
      truncated: hits.length > limit,
      generatedAt: new Date().toISOString(),
    }
  }
}
