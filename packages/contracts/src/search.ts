/**
 * Federated search contract — Phase D (Agent CLI Read + Search V0).
 * Unified hits over Artifact text/title, Notes, Conversation FTS and Resource
 * descriptors. No new search DB; no vector claims.
 */

export type SearchEntityTypeV0 = 'artifact' | 'note' | 'conversation' | 'resource' | 'file'

export interface SearchHitV0 {
  readonly entityType: SearchEntityTypeV0
  readonly entityId: string
  readonly viewId?: string
  readonly title: string
  readonly snippet: string
  readonly source: string
  readonly score: number
}

export interface SearchQueryV0 {
  readonly query: string
  readonly limit?: number
  readonly types?: readonly SearchEntityTypeV0[]
}

export interface SearchResultV0 {
  readonly schemaVersion: 0
  readonly query: string
  readonly hits: readonly SearchHitV0[]
  readonly truncated: boolean
  readonly generatedAt: string
}
