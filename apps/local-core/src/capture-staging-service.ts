import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { CaptureStagingItemV0 } from '@local-creative-os/contracts'
import type { SqliteMetadataRepository } from './metadata-repository.js'

/**
 * Phase B：Capture Staging Buffer。
 * transport buffer（不是 Inbox domain）：Capture 永远立即成功，
 * 大文件落 ~/.lcos/capture-staging/blobs/<sha256>（hash 去重），SQLite 不存 binary。
 */
export interface EnqueueCaptureInputV0 {
  readonly operationId: string
  readonly kind: string
  readonly payloadRef?: string
  readonly payloadBytes?: Uint8Array
  readonly source: Readonly<Record<string, unknown>>
  readonly suggestedProjects: CaptureStagingItemV0['suggestedProjects']
  readonly semanticHint?: CaptureStagingItemV0['semanticHint']
  readonly capturedAt?: string
}

function defaultBlobRoot(): string {
  return join(homedir(), '.lcos', 'capture-staging', 'blobs')
}

export class CaptureStagingService {
  readonly #metadata: SqliteMetadataRepository
  readonly #blobRoot: string

  constructor(metadata: SqliteMetadataRepository, blobRoot: string = process.env.LCOS_CAPTURE_STAGING_ROOT ?? defaultBlobRoot()) {
    this.#metadata = metadata
    this.#blobRoot = blobRoot
  }

  async enqueue(input: EnqueueCaptureInputV0): Promise<CaptureStagingItemV0> {
    const capturedAt = input.capturedAt ?? new Date().toISOString()
    const id = `capture-${createHash('sha256').update(`${input.operationId}:${capturedAt}`).digest('hex').slice(0, 16)}`
    let payloadRef = input.payloadRef
    if (payloadRef === undefined && input.payloadBytes !== undefined && input.payloadBytes.byteLength > 0) {
      payloadRef = this.#storeBlob(input.payloadBytes)
    }
    if (payloadRef === undefined || payloadRef.length === 0) {
      throw new Error('Capture staging requires payloadRef or payloadBytes.')
    }
    const item: CaptureStagingItemV0 = {
      id,
      operationId: input.operationId,
      kind: input.kind,
      payloadRef,
      source: input.source,
      suggestedProjects: input.suggestedProjects,
      ...(input.semanticHint === undefined ? {} : { semanticHint: input.semanticHint }),
      capturedAt,
    }
    this.#metadata.createCaptureStagingItem(item)
    return item
  }

  listRecent(recentMs = 30 * 60_000, limit = 50): CaptureStagingItemV0[] {
    const since = new Date(Date.now() - recentMs).toISOString()
    return this.#metadata.listCaptureStagingItems(since, limit)
  }

  countPending(): number {
    return this.#metadata.countPendingCaptureStagingItems()
  }

  resolve(id: string, projectId: string): boolean {
    return this.#metadata.resolveCaptureStagingItem(id, projectId, new Date().toISOString())
  }

  #storeBlob(bytes: Uint8Array): string {
    const hash = createHash('sha256').update(bytes).digest('hex')
    const path = join(this.#blobRoot, hash)
    if (!existsSync(path)) {
      mkdirSync(this.#blobRoot, { recursive: true })
      writeFileSync(path, bytes)
    }
    return `blob:${hash}`
  }
}
