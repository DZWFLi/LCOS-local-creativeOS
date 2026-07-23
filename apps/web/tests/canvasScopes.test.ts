import { describe, expect, it } from 'vitest'
import { fixtureEdges, fixtureNodes } from '../src/fixtures'
import { createChildScopeFromSelection, removeScopeTree } from '../src/state/canvasScopes'

let counter = 0
const makeId = (prefix: string) => `${prefix}-${counter += 1}`

describe('v0.6 phase 3 Canvas Scope model', () => {
  it('creates one child scope with ArtifactViews and internal relationships', () => {
    const result = createChildScopeFromSelection(fixtureNodes, fixtureEdges, {
      parentScopeId: 'scope-root',
      label: '第二轮客户反馈',
      kind: 'collection',
      selectedIds: ['feedback', 'proposal', 'generated'],
      containerPosition: { x: 1200, y: 220 },
      createId: makeId,
    })
    expect(result.scope.parentScopeId).toBe('scope-root')
    expect(result.container.opensScopeId).toBe(result.scope.id)
    expect(result.views).toHaveLength(3)
    expect(result.views.every((node) => node.scopeId === result.scope.id)).toBe(true)
    expect(result.views.find((node) => node.title === 'Thinker_Concept_V3.pptx')?.artifactId).toBe('artifact-proposal')
    expect(result.edges.some((edge) => edge.kind === 'modify')).toBe(true)
    expect(fixtureNodes.find((node) => node.id === 'proposal')?.scopeId).toBe('scope-root')
  })

  it('removes a child scope tree without deleting parent-scope content', () => {
    const childNodes = [
      ...fixtureNodes,
      { ...fixtureNodes[0], id: 'child-view', scopeId: 'scope-child' },
      { ...fixtureNodes[1], id: 'grandchild-view', scopeId: 'scope-grandchild' },
    ]
    const scopes = [
      { id: 'scope-root', label: 'Root', kind: 'root' as const, parentScopeId: null, camera: { x: 0, y: 0, zoom: 1 } },
      { id: 'scope-child', label: 'Child', kind: 'collection' as const, parentScopeId: 'scope-root', camera: { x: 0, y: 0, zoom: 1 } },
      { id: 'scope-grandchild', label: 'Grandchild', kind: 'context' as const, parentScopeId: 'scope-child', camera: { x: 0, y: 0, zoom: 1 } },
    ]
    const result = removeScopeTree(scopes, childNodes, fixtureEdges, 'scope-child')
    expect(result.removedScopeIds).toEqual(expect.arrayContaining(['scope-child', 'scope-grandchild']))
    expect(result.nodes.some((node) => node.id === 'proposal')).toBe(true)
    expect(result.nodes.some((node) => node.id === 'child-view')).toBe(false)
  })
})
