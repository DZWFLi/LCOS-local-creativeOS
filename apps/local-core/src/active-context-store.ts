import type { ProjectGraphSnapshot } from '@local-creative-os/contracts'
import type { ActiveContextV2, AgentContextItem } from '@local-creative-os/contracts'

export interface ActiveContextInput {
  readonly workspaceId?: string
  readonly scopeId: string
  readonly selectedViewIds: readonly string[]
  readonly pinnedContextIds: readonly string[]
  readonly excludedContextIds: readonly string[]
  readonly targetArtifactId?: string
  readonly targetRevisionId?: string
  readonly expectedVersion?: number
  readonly updatedBy?: 'web' | 'codex' | 'core'
}

export interface ActiveContextProjection {
  readonly projectId: string
  readonly schemaVersion: 2
  readonly workspaceId?: string | null
  readonly scopeId: string | null
  readonly selectedViewIds: readonly string[]
  readonly targetArtifactId?: string | null
  readonly targetRevisionId?: string | null
  readonly pinnedContextIds: readonly string[]
  readonly excludedContextIds: readonly string[]
  readonly version: number
  readonly updatedAt: string
  readonly updatedBy: 'web' | 'codex' | 'core'
  readonly contextItems: readonly AgentContextItem[]
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

export class ActiveContextStore {
  readonly #values = new Map<string, ActiveContextProjection>()

  get(projectId: string, graph: ProjectGraphSnapshot): ActiveContextProjection {
    return this.#values.get(projectId) ?? this.#project(graph, {
      scopeId: String(graph.scopes[0]?.id ?? ''),
      selectedViewIds: [],
      pinnedContextIds: [],
      excludedContextIds: [],
    }, 0)
  }

  update(projectId: string, graph: ProjectGraphSnapshot, input: ActiveContextInput): ActiveContextProjection {
    const previous = this.#values.get(projectId)
    if (input.expectedVersion !== undefined
      && previous !== undefined
      && previous.version !== input.expectedVersion) {
      throw new ActiveContextConflictError(input.expectedVersion, previous.version)
    }
    const next = this.#project(graph, input, (previous?.version ?? 0) + 1)
    this.#values.set(projectId, next)
    return next
  }

  #project(graph: ProjectGraphSnapshot, input: ActiveContextInput, version: number): ActiveContextProjection {
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
        ...(artifact.currentRevisionId === undefined ? {} : { revisionId: String(artifact.currentRevisionId) }),
      }]
    })
    const selectedArtifacts = resolveArtifacts([...new Set(input.selectedViewIds)])
    const excluded = new Set(input.excludedContextIds)
    const contextArtifacts = resolveArtifacts(
      [...new Set([...input.selectedViewIds, ...input.pinnedContextIds])]
        .filter((viewId) => !excluded.has(viewId)),
    )
    const targetArtifact = input.targetArtifactId === undefined
      ? undefined
      : artifacts.get(input.targetArtifactId)
    const targetProjection = targetArtifact === undefined
      ? undefined
      : {
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
    }))
    return {
      projectId: String(graph.project.id),
      schemaVersion: 2,
      workspaceId: input.workspaceId ?? null,
      scopeId: input.scopeId,
      selectedViewIds: [...new Set(input.selectedViewIds)],
      targetArtifactId: input.targetArtifactId ?? null,
      targetRevisionId: input.targetRevisionId ?? null,
      pinnedContextIds: [...new Set(input.pinnedContextIds)],
      excludedContextIds: [...new Set(input.excludedContextIds)],
      contextItems,
      version,
      updatedAt: new Date().toISOString(),
      updatedBy: input.updatedBy ?? 'web',
      selectedArtifacts,
      contextArtifacts,
      ...(targetProjection === undefined ? {} : { targetArtifact: targetProjection }),
    }
  }
}
