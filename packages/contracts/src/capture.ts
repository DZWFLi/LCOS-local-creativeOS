/**
 * Phase B：Capture Staging Buffer 契约。
 *
 * 它是临时 transport buffer，不是 Inbox domain。
 * 大文件走 ~/.lcos/capture-staging/blobs/<sha256>，SQLite 不存 binary。
 */
export interface CaptureStagingItemV0 {
  readonly id: string
  readonly operationId: string
  readonly kind: string
  readonly payloadRef: string
  readonly source: Readonly<Record<string, unknown>>
  readonly suggestedProjects: readonly {
    readonly projectId: string
    readonly score: number
    readonly reason: string
  }[]
  readonly semanticHint?: {
    readonly model: string
    readonly scores: readonly { readonly projectId: string; readonly score: number }[]
  }
  readonly capturedAt: string
  readonly resolvedProjectId?: string
  readonly resolvedAt?: string
}
