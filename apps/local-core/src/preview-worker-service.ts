import { readFile } from 'node:fs/promises'

import type { ArtifactRevisionId, PreviewRecord, ProjectId } from '@local-creative-os/domain'

import type { SqliteMetadataRepository } from './metadata-repository.js'
import { PreviewCacheService } from './preview-cache-service.js'
import { RendererRegistry } from './renderer-registry.js'

export interface GeneratePreviewInput {
  readonly projectId: ProjectId
  readonly revisionId: ArtifactRevisionId
  readonly previewProfile: string
  readonly signal?: AbortSignal
}

export interface GeneratePreviewResult {
  readonly record: PreviewRecord
  readonly reused: boolean
}

export interface PreviewWorkerServiceOptions {
  readonly cacheService: PreviewCacheService
  readonly rendererRegistry?: RendererRegistry
  readonly maxSourceBytes?: number
}

const DEFAULT_MAX_SOURCE_BYTES = 512 * 1024

export class PreviewWorkerService {
  readonly #repository: SqliteMetadataRepository
  readonly #cacheService: PreviewCacheService
  readonly #rendererRegistry: RendererRegistry
  readonly #maxSourceBytes: number
  #queue: Promise<void> = Promise.resolve()

  constructor(repository: SqliteMetadataRepository, options: PreviewWorkerServiceOptions) {
    this.#repository = repository
    this.#cacheService = options.cacheService
    this.#rendererRegistry = options.rendererRegistry ?? new RendererRegistry()
    this.#maxSourceBytes = options.maxSourceBytes ?? DEFAULT_MAX_SOURCE_BYTES
  }

  async generate(input: GeneratePreviewInput): Promise<GeneratePreviewResult> {
    let run!: () => Promise<GeneratePreviewResult>
    const task = new Promise<GeneratePreviewResult>((resolve, reject) => {
      run = async () => {
        try {
          const result = await this.#generateNow(input)
          resolve(result)
          return result
        } catch (error) {
          reject(error)
          throw error
        }
      }
    })
    this.#queue = this.#queue.then(() => run()).then(() => undefined, () => undefined)
    return task
  }

  async #generateNow(input: GeneratePreviewInput): Promise<GeneratePreviewResult> {
    this.#throwIfAborted(input.signal)
    const revision = this.#repository.getArtifactRevision(String(input.revisionId))
    if (revision === undefined) throw new Error('ArtifactRevision not found.')
    const artifact = this.#repository.getArtifact(String(revision.artifactId))
    if (artifact === undefined || artifact.projectId !== input.projectId) throw new Error('ArtifactRevision does not belong to project.')
    const fileRecord = this.#repository.getFileRecord(String(revision.fileRecordId))
    if (fileRecord === undefined) throw new Error('FileRecord not found.')
    if (fileRecord.availability !== 'current') {
      return { record: this.#cacheService.recordFailed(input.revisionId, input.previewProfile, `File is ${fileRecord.availability}.`), reused: false }
    }
    const renderer = this.#rendererRegistry.select(fileRecord, input.previewProfile)
    if (renderer === undefined) {
      return { record: this.#cacheService.recordUnsupported(input.revisionId, input.previewProfile), reused: false }
    }
    const existing = this.#repository.getPreviewRecordByCacheKey(this.#cacheService.computeCacheKey({
      sourceContentHash: revision.contentHash,
      rendererId: renderer.id,
      rendererVersion: renderer.version,
      previewProfile: input.previewProfile,
    }))
    if (existing?.status === 'ready') return { record: existing, reused: true }

    try {
      const bytes = await this.#renderBytes(fileRecord.observedPath, fileRecord.mimeType, input.signal)
      this.#throwIfAborted(input.signal)
      return {
        record: await this.#cacheService.publishReadyPreview(input.revisionId, input.previewProfile, bytes),
        reused: false,
      }
    } catch (error) {
      if (input.signal?.aborted) throw error
      const message = error instanceof Error ? error.message : 'Preview generation failed.'
      return { record: this.#cacheService.recordFailed(input.revisionId, input.previewProfile, message), reused: false }
    }
  }

  async #renderBytes(path: string, mimeType: string, signal?: AbortSignal): Promise<Uint8Array> {
    this.#throwIfAborted(signal)
    const bytes = await readFile(path)
    this.#throwIfAborted(signal)
    if (bytes.byteLength > this.#maxSourceBytes) {
      return Buffer.from(bytes.subarray(0, this.#maxSourceBytes))
    }
    if (mimeType === 'text/plain' || mimeType === 'text/markdown' || mimeType === 'text/x-markdown' || mimeType.startsWith('image/')) {
      return bytes
    }
    throw new Error(`Unsupported mime type: ${mimeType}`)
  }

  #throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw new DOMException('Preview generation aborted.', 'AbortError')
  }
}
