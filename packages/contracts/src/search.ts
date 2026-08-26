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
  /**
   * 块级锚点（chunking，第一梯队核心能力 B）：语义同 ContextManifestOrderedItemV0.sourceAnchor，
   * 形如 'pdf:p3-p5' / 'section:风险' / 'chunk:2-4'。省略 = 文档级命中（标题/整文档）；
   * 带值 = 块级命中（正文分块），让信息谱能引用到块级而不是整份文档。
   */
  readonly chunkAnchor?: string
  /** 块序号（0-based，标题块为 0），便于 UI 区分文档级/块级命中。 */
  readonly chunkIndex?: number
  /** 该实体的总分块数（含标题块）。 */
  readonly chunkCount?: number
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
