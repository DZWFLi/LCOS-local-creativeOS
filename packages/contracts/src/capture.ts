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

export type CaptureKindV0 =
  | 'web_page'
  | 'web_image'
  | 'web_selection'
  | 'web_link'
  | 'local_file'
  | 'screenshot'
  | 'clipboard_image'
  | 'clipboard_text'
  | 'conversation_snapshot'

export interface CaptureRequestV0 {
  readonly schemaVersion: 0
  readonly operationId: string
  readonly kind: CaptureKindV0
  readonly targetHint?: {
    readonly projectId?: string
    readonly scopeId?: string
    readonly presentationId?: string
  }
  readonly source: {
    readonly app?: string
    readonly url?: string
    readonly title?: string
    readonly referrer?: string
    readonly capturedAt: string
    readonly sessionId?: string
    readonly browserProfileId?: string
    readonly browserTabId?: number
  }
  readonly payload:
    | { readonly type: 'url'; readonly url: string }
    | { readonly type: 'text'; readonly text: string }
    | { readonly type: 'local_path'; readonly path: string }
    | { readonly type: 'staged_blob'; readonly blobRef: string }
  readonly hints?: {
    readonly title?: string
    readonly note?: string
  }
}

export interface CaptureReceiptV0 {
  readonly operationId: string
  readonly status: 'created' | 'reused' | 'staged' | 'failed'
  readonly projectId?: string
  readonly artifactId?: string
  readonly resourceId?: string
  readonly viewId?: string
  readonly stagingId?: string
  readonly duplicateOf?: string
}

export interface CaptureWatchRuleV0 {
  readonly id: string
  readonly path: string
  readonly patterns: readonly string[]
  readonly projectHint?: string
  readonly settleMs: number
  readonly enabled: boolean
}
