import { describe, expect, it } from 'vitest'
import { fixtureNodes, fixtureWorkspaces } from '../src/fixtures'
import { inferTargetContext, moveBetweenTargetAndContext, setPrimaryTarget } from '../src/state/workContext'

const workspace = fixtureWorkspaces[1]

describe('v0.6 target and context inference', () => {
  it('uses one editable file as target and the rest as context', () => {
    const result = inferTargetContext(fixtureNodes, ['proposal', 'feedback', 'reference'], workspace, 'scope-root')
    expect(result.targetIds).toEqual(['proposal'])
    expect(result.contextIds).toContain('feedback')
    expect(result.contextIds).toContain('reference')
    expect(result.ambiguousTargetIds).toEqual([])
  })

  it('uses selected references as context and current working file as target', () => {
    const result = inferTargetContext(fixtureNodes, ['feedback', 'reference'], workspace, 'scope-root')
    expect(result.targetIds).toEqual(['proposal'])
    expect(result.contextIds).toEqual(expect.arrayContaining(['feedback', 'reference']))
  })

  it('asks one lightweight question when multiple editable files are selected', () => {
    const result = inferTargetContext(fixtureNodes, ['proposal', 'generated'], workspace, 'scope-root')
    expect(result.targetIds).toEqual([])
    expect(result.ambiguousTargetIds).toEqual(['proposal', 'generated'])
    const resolved = setPrimaryTarget(result, 'proposal', ['proposal', 'generated'])
    expect(resolved.targetIds).toEqual(['proposal'])
    expect(resolved.contextIds).toContain('generated')
  })

  it('lets the user move an inferred object between target and context', () => {
    const result = inferTargetContext(fixtureNodes, ['proposal', 'feedback'], workspace, 'scope-root')
    const changed = moveBetweenTargetAndContext(result, 'generated', 'target', fixtureNodes)
    expect(changed.targetIds).toEqual(['generated'])
    expect(changed.contextIds).toContain('proposal')
  })
})
