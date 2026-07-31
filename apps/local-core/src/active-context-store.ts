import type { ProjectGraphSnapshot } from '@local-creative-os/contracts'

export interface ActiveContextInput {
  readonly workspaceId?: string
  readonly scopeId: string
  readonly selectedViewIds: readonly string[]
  readonly pinnedContextIds: readonly string[]
  readonly excludedContextIds: readonly string[]
}

export interface ActiveContextProjection extends ActiveContextInput {
  readonly projectId: string
  readonly version: number
  readonly updatedAt: string
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
    return {
      projectId: String(graph.project.id),
      ...(input.workspaceId === undefined ? {} : { workspaceId: input.workspaceId }),
      scopeId: input.scopeId,
      selectedViewIds: [...new Set(input.selectedViewIds)],
      pinnedContextIds: [...new Set(input.pinnedContextIds)],
      excludedContextIds: [...new Set(input.excludedContextIds)],
      selectedArtifacts,
      contextArtifacts,
      version,
      updatedAt: new Date().toISOString(),
    }
  }
}
