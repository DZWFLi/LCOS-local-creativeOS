import { describe, expect, it } from 'vitest'
import { fixtureEdges, fixtureNodes, fixtureScopes, fixtureWorkspaces } from '../src/qa-fixtures/fixtures'

describe('Alpha fixture graph', () => {
  it('keeps one Canvas fixture with all six node families', () => {
    expect(new Set(fixtureNodes.map((node) => node.kind))).toEqual(new Set(['source', 'working', 'generated', 'context', 'process', 'decision']))
    expect(fixtureWorkspaces).toHaveLength(4)
    expect(fixtureScopes.some((scope) => scope.parentScopeId === 'scope-root')).toBe(true)
  })

  it('keeps the generated artifact connected to its Run', () => {
    expect(fixtureEdges.some((edge) => edge.from === 'run-042' && edge.to === 'generated' && edge.kind === 'generate')).toBe(true)
  })
})
