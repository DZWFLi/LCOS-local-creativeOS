import type { ProjectGraphSnapshot } from '@local-creative-os/contracts'
import type { ActiveContextV2, AgentContextItem, CanvasContextNodeV1, CanvasContextRelationV1, CanvasContextViewportV1 } from '@local-creative-os/contracts'
import type { SqliteMetadataRepository } from './metadata-repository.js'

export interface ActiveContextInput {
  readonly workspaceId?: string
  readonly scopeId: string
  readonly selectedViewIds: readonly string[]
  readonly pinnedContextIds: readonly string[]
  readonly excludedContextIds: readonly string[]
  readonly targetArtifactId?: string
  readonly targetRevisionId?: string
  readonly viewport?: { readonly x: number; readonly y: number; readonly zoom: number }
  readonly visibleViewIds?: readonly string[]
  readonly expectedVersion?: number
  readonly updatedBy?: 'web' | 'codex' | 'core'
}

export interface ActiveContextProjection extends ActiveContextV2 {
  readonly workspaceId: string | null
  readonly scopeId: string | null
  readonly selectedArtifacts: readonly {
    readonly viewId: string
    readonly artifactId: string
    readonly title: string
    readonly kind: string
    readonly revisionId?: string
  }[]
  readonly contextArtifacts: readonly {
    readonly viewId: string
    readonly artifactId: string
    readonly title: string
    readonly kind: string
    readonly revisionId?: string
  }[]
  readonly targetArtifact?: {
    readonly artifactId: string
    readonly title: string
    readonly revisionId?: string
  }
}

export class ActiveContextConflictError extends Error {
  readonly code = 'ACTIVE_CONTEXT_CONFLICT'
  constructor(readonly expectedVersion: number, readonly currentVersion: number) {
    super(`ActiveContext version conflict: expected ${expectedVersion}, current ${currentVersion}.`)
  }
}

function contextKey(projectId: string, workspaceId: string | null | undefined): string {
  return `${projectId}::${workspaceId ?? '__project_overview__'}`
}

export class ActiveContextStore {
  readonly #values = new Map<string, ActiveContextProjection>()

  constructor(private readonly metadata?: SqliteMetadataRepository) {}

  get(projectId: string, graph: ProjectGraphSnapshot, workspaceId: string | null = null): ActiveContextProjection {
    const key = contextKey(projectId, workspaceId)
    const memory = this.#values.get(key)
    if (memory !== undefined) return this.#refreshGraphProjection(graph, memory)
    const persisted = this.metadata?.getActiveContext(projectId, workspaceId)
    if (persisted !== undefined) {
      const projected = this.#refreshGraphProjection(graph, persisted)
      this.#values.set(key, projected)
      return projected
    }
    return this.#project(graph, {
      ...(workspaceId === null ? {} : { workspaceId }),
      scopeId: String(graph.scopes[0]?.id ?? ''),
      selectedViewIds: [],
      pinnedContextIds: [],
      excludedContextIds: [],
    }, 0)
  }

  update(projectId: string, graph: ProjectGraphSnapshot, input: ActiveContextInput): ActiveContextProjection {
    const workspaceId = input.workspaceId ?? null
    const previous = this.get(projectId, graph, workspaceId)
    if (input.expectedVersion !== undefined && previous.version !== input.expectedVersion) {
      throw new ActiveContextConflictError(input.expectedVersion, previous.version)
    }
    const next = this.#project(graph, input, previous.version + 1)
    this.metadata?.saveActiveContext(next)
    this.#values.set(contextKey(projectId, workspaceId), next)
    return next
  }

  #refreshGraphProjection(graph: ProjectGraphSnapshot, value: ActiveContextV2): ActiveContextProjection {
    return this.#project(graph, {
      ...(value.workspaceId === null ? {} : { workspaceId: value.workspaceId }),
      scopeId: value.scopeId ?? '',
      selectedViewIds: value.selectedViewIds,
      pinnedContextIds: value.pinnedContextIds,
      excludedContextIds: value.excludedContextIds,
      ...(value.targetArtifactId === null ? {} : { targetArtifactId: value.targetArtifactId }),
      ...(value.targetRevisionId === null ? {} : { targetRevisionId: value.targetRevisionId }),
      ...(value.viewport === undefined ? {} : {
        viewport: { x: value.viewport.x, y: value.viewport.y, zoom: value.viewport.zoom },
        visibleViewIds: value.viewport.visibleViewIds,
      }),
      updatedBy: value.updatedBy,
    }, value.version, value.updatedAt)
  }

  #project(graph: ProjectGraphSnapshot, input: ActiveContextInput, version: number, updatedAt = new Date().toISOString()): ActiveContextProjection {
    const views = new Map(graph.artifactViews.map((view) => [String(view.id), view]))
    const artifacts = new Map(graph.artifacts.map((artifact) => [String(artifact.id), artifact]))
    const resolveArtifacts = (viewIds: readonly string[]) => viewIds.flatMap((viewId) => {
      const view = views.get(viewId)
      const artifact = view === undefined ? undefined : artifacts.get(String(view.artifactId))
      if (view === undefined || artifact === undefined) return []
      return [{
        viewId,
        artifactId: String(artifact.id),
        title: artifact.title,
        kind: artifact.kind,
        ...(view.revisionId === undefined && artifact.currentRevisionId === undefined ? {} : { revisionId: String(view.revisionId ?? artifact.currentRevisionId) }),
      }]
    })
    const selectedViewIds = [...new Set(input.selectedViewIds)]
    const selectedArtifacts = resolveArtifacts(selectedViewIds)
    const excluded = new Set(input.excludedContextIds)
    const contextViewIds = [...new Set([...selectedViewIds, ...input.pinnedContextIds])].filter((viewId) => !excluded.has(viewId))
    const contextArtifacts = resolveArtifacts(contextViewIds)
    const targetArtifact = input.targetArtifactId === undefined ? undefined : artifacts.get(input.targetArtifactId)
    const targetProjection = targetArtifact === undefined ? undefined : {
      artifactId: String(targetArtifact.id),
      title: targetArtifact.title,
      ...(input.targetRevisionId === undefined ? {} : { revisionId: input.targetRevisionId }),
    }
    const contextItems: readonly AgentContextItem[] = contextArtifacts.map((item) => ({
      viewId: item.viewId,
      artifactId: item.artifactId,
      ...(item.revisionId === undefined ? {} : { revisionId: item.revisionId }),
      title: item.title,
      kind: item.kind,
      managed: artifacts.get(item.artifactId)?.managed ?? true,
    }))

    const visibleViewIds = [...new Set(input.visibleViewIds ?? contextViewIds)]
    const nodeViewIds = [...new Set([...visibleViewIds, ...contextViewIds])]
    const nodes: readonly CanvasContextNodeV1[] = nodeViewIds.flatMap((viewId) => {
      const view = views.get(viewId)
      const artifact = view === undefined ? undefined : artifacts.get(String(view.artifactId))
      if (view === undefined || artifact === undefined) return []
      return [{
        viewId,
        artifactId: String(artifact.id),
        ...(view.revisionId === undefined && artifact.currentRevisionId === undefined ? {} : { revisionId: String(view.revisionId ?? artifact.currentRevisionId) }),
        title: artifact.title,
        kind: artifact.kind,
        managed: artifact.managed ?? true,
        x: view.position.x,
        y: view.position.y,
        width: view.size.width,
        height: view.size.height,
        status: artifact.availability,
        summary: `${artifact.kind} · ${artifact.availability}`,
      }]
    })
    const visibleArtifactIds = new Set(nodes.map((node) => node.artifactId))
    const relations: readonly CanvasContextRelationV1[] = graph.relations.flatMap((relation) => {
      if (relation.sourceEntityType !== 'artifact' || relation.targetEntityType !== 'artifact') return []
      if (!visibleArtifactIds.has(relation.sourceEntityId) && !visibleArtifactIds.has(relation.targetEntityId)) return []
      return [{
        id: String(relation.id),
        sourceArtifactId: relation.sourceEntityId,
        targetArtifactId: relation.targetEntityId,
        kind: relation.kind,
      }]
    })
    const viewport: CanvasContextViewportV1 | undefined = input.viewport === undefined
      ? undefined
      : { ...input.viewport, visibleViewIds }

    return {
      projectId: String(graph.project.id),
      schemaVersion: 2,
      workspaceId: input.workspaceId ?? null,
      scopeId: input.scopeId,
      selectedViewIds,
      selectionOrder: selectedViewIds,
      ...(viewport === undefined ? {} : { viewport }),
      nodes,
      relations,
      targetArtifactId: input.targetArtifactId ?? null,
      targetRevisionId: input.targetRevisionId ?? null,
      pinnedContextIds: [...new Set(input.pinnedContextIds)],
      excludedContextIds: [...new Set(input.excludedContextIds)],
      contextItems,
      version,
      updatedAt,
      updatedBy: input.updatedBy ?? 'web',
      selectedArtifacts,
      contextArtifacts,
      ...(targetProjection === undefined ? {} : { targetArtifact: targetProjection }),
    }
  }
}
