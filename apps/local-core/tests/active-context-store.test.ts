import { describe, expect, it } from 'vitest'

import { ActiveContextStore } from '../src/active-context-store.js'
import { createMvpSampleSnapshot } from '../src/mvp-sample-project.js'

describe('ActiveContextStore', () => {
  it('projects stable View selection to canonical Artifact identity', () => {
    const graph = createMvpSampleSnapshot('C:\\LCOS\\sample', '2026-07-30T00:00:00.000Z')
    const view = graph.artifactViews[0]!
    const pinnedView = graph.artifactViews[1]!
    const artifact = graph.artifacts.find((item) => item.id === view.artifactId)!
    const store = new ActiveContextStore()

    const first = store.update(String(graph.project.id), graph, {
      scopeId: String(view.scopeId),
      selectedViewIds: [String(view.id), String(view.id)],
      pinnedContextIds: [String(pinnedView.id)],
      excludedContextIds: [],
    })
    const second = store.get(String(graph.project.id), graph)

    expect(first.version).toBe(1)
    expect(second).toEqual(first)
    expect(first.selectedViewIds).toEqual([String(view.id)])
    expect(first.selectedArtifacts).toContainEqual(expect.objectContaining({
      viewId: String(view.id),
      artifactId: String(artifact.id),
      title: artifact.title,
    }))
    expect(first.contextArtifacts.map((item) => item.viewId)).toEqual([
      String(view.id),
      String(pinnedView.id),
    ])
  })
})
