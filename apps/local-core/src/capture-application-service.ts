import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import type { CaptureReceiptV0, CaptureRequestV0 } from '@local-creative-os/contracts'
import type { SqliteMetadataRepository } from './metadata-repository.js'
import type { CaptureStagingService } from './capture-staging-service.js'
import type { RuntimeRegistryService } from './runtime-registry-service.js'
import { resolveProjectAffinity } from './project-affinity-service.js'
import { createTextArtifact } from './text-artifact-service.js'
import type { UniversalResourceImportService } from './resources/universal-resource-import-service.js'

/**
 * Phase C：Capture Application Service。
 * 幂等（operationId → receipt）→ Affinity → 高置信直接进项目 / 不确定进 Staging。
 * 热路径不等 LLM、不等 Ollama；<2s 给 receipt。
 */
export interface CaptureApplicationOptions {
  readonly blobRoot: string
}

const SPAWN_ZONE = { x: 480, y: 240 }

export class CaptureApplicationService {
  readonly #metadata: SqliteMetadataRepository
  readonly #resources: UniversalResourceImportService
  readonly #staging: CaptureStagingService
  readonly #registry: RuntimeRegistryService
  readonly #blobRoot: string

  constructor(
    metadata: SqliteMetadataRepository,
    resources: UniversalResourceImportService,
    staging: CaptureStagingService,
    registry: RuntimeRegistryService,
    options: CaptureApplicationOptions,
  ) {
    this.#metadata = metadata
    this.#resources = resources
    this.#staging = staging
    this.#registry = registry
    this.#blobRoot = options.blobRoot
  }

  async capture(request: CaptureRequestV0): Promise<CaptureReceiptV0> {
    if (request.schemaVersion !== 0) throw new Error('CaptureRequest schemaVersion must be 0.')
    const existing = this.#metadata.getCaptureReceipt(request.operationId)
    if (existing !== undefined) return existing

    const projectRoots = this.#metadata.listProjects().map((project) => ({ projectId: String(project.id), rootPath: project.rootPath }))
    const affinity = resolveProjectAffinity(
      {
        ...(request.targetHint?.projectId === undefined ? {} : { explicitProjectId: request.targetHint.projectId }),
        ...(request.source.sessionId === undefined ? {} : { sessionId: request.source.sessionId }),
        ...(request.payload.type === 'local_path' ? { localPath: request.payload.path } : {}),
        ...(request.source.browserProfileId !== undefined && request.source.browserTabId !== undefined
          ? { browser: { profileId: request.source.browserProfileId, tabId: request.source.browserTabId } }
          : {}),
        capturedAt: request.source.capturedAt,
      },
      {
        projectRoots,
        registry: this.#registry.getRegistry(),
        now: request.source.capturedAt,
      },
    )

    if (affinity.projectId === undefined || affinity.confidence < 0.8) {
      const staged = await this.#staging.enqueue({
        operationId: request.operationId,
        kind: request.kind,
        ...(await this.#payloadRefFor(request)),
        source: request.source as unknown as Record<string, unknown>,
        suggestedProjects: (affinity.candidates ?? []).map((candidate) => ({ projectId: candidate.projectId, score: candidate.score, reason: candidate.reason })),
        capturedAt: request.source.capturedAt,
      })
      const receipt: CaptureReceiptV0 = { operationId: request.operationId, status: 'staged', stagingId: staged.id }
      this.#metadata.saveCaptureReceipt(receipt)
      return receipt
    }

    const imported = await this.#importIntoProject(request, affinity.projectId)
    const receipt: CaptureReceiptV0 = {
      operationId: request.operationId,
      status: imported.reused ? 'reused' : 'created',
      projectId: affinity.projectId,
      artifactId: imported.artifactId,
      ...(imported.resourceId === undefined ? {} : { resourceId: imported.resourceId }),
      viewId: imported.viewId,
      ...(imported.duplicateOf === undefined ? {} : { duplicateOf: imported.duplicateOf }),
    }
    this.#metadata.saveCaptureReceipt(receipt)
    return receipt
  }

  async #payloadRefFor(request: CaptureRequestV0): Promise<{ readonly payloadRef: string }> {
    if (request.payload.type === 'staged_blob') return { payloadRef: request.payload.blobRef }
    if (request.payload.type === 'url') return { payloadRef: request.payload.url }
    if (request.payload.type === 'local_path') return { payloadRef: request.payload.path }
    if (request.payload.type === 'text') {
      const bytes = new TextEncoder().encode(request.payload.text)
      const hash = createHash('sha256').update(bytes).digest('hex')
      const path = join(this.#blobRoot, hash)
      return { payloadRef: `blob:${hash}` }
    }
    return { payloadRef: `operation:${request.operationId}` }
  }

  async #importIntoProject(request: CaptureRequestV0, projectId: string): Promise<{
    readonly artifactId: string
    readonly resourceId?: string
    readonly viewId: string
    readonly reused: boolean
    readonly duplicateOf?: string
  }> {
    const scopes = this.#metadata.getScopes(projectId)
    const rootScope = scopes.find((scope) => scope.kind === 'root')
    if (rootScope === undefined) throw new Error('Project has no root scope.')
    const scopeId = request.targetHint?.scopeId ?? String(rootScope.id)
    const title = request.hints?.title ?? request.source.title

    if (request.payload.type === 'url') {
      const imported = await this.#resources.importUrl(projectId as never, {
        importRequestId: request.operationId,
        url: request.payload.url,
        ...(title === undefined ? {} : { title }),
        scopeId: scopeId as never,
        position: SPAWN_ZONE,
      })
      return {
        artifactId: String(imported.artifactId),
        resourceId: String(imported.resourceId),
        viewId: String(imported.viewId),
        reused: imported.reused,
      }
    }

    if (request.payload.type === 'text') {
      const created = await createTextArtifact(this.#metadata, projectId as never, {
        ...(title === undefined ? {} : { title }),
        body: request.payload.text,
        scopeId: scopeId as never,
        x: SPAWN_ZONE.x,
        y: SPAWN_ZONE.y,
      })
      return { artifactId: created.artifactId, viewId: created.viewId, reused: false }
    }

    if (request.payload.type === 'local_path') {
      const bytes = await readFile(request.payload.path)
      const imported = await this.#resources.importFile(projectId as never, {
        importRequestId: request.operationId,
        fileName: request.payload.path.split(/[\\/]/).at(-1) ?? 'capture.bin',
        contentType: 'application/octet-stream',
        bytes,
        scopeId: scopeId as never,
        position: SPAWN_ZONE,
      })
      return {
        artifactId: String(imported.artifactId),
        resourceId: String(imported.resourceId),
        viewId: String(imported.viewId),
        reused: imported.reused,
      }
    }

    if (request.payload.type === 'staged_blob') {
      const blobHash = request.payload.blobRef.replace(/^blob:/, '')
      const bytes = await readFile(join(this.#blobRoot, blobHash))
      const imported = await this.#resources.importFile(projectId as never, {
        importRequestId: request.operationId,
        fileName: `${request.kind}-${blobHash.slice(0, 8)}.png`,
        contentType: 'image/png',
        bytes,
        scopeId: scopeId as never,
        position: SPAWN_ZONE,
      })
      return {
        artifactId: String(imported.artifactId),
        resourceId: String(imported.resourceId),
        viewId: String(imported.viewId),
        reused: imported.reused,
      }
    }

    throw new Error(`Unsupported capture payload type: ${(request.payload as { type: string }).type}`)
  }
}
