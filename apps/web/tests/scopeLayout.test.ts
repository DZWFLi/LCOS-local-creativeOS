import { describe, expect, it } from 'vitest'
import { fixtureNodes } from './qa-fixtures/fixtures'
import { applyScopeLayout, proposeIslandRecoveryLayout, proposeScopeLayout } from '../src/features/canvas/scopeLayout'

describe('v0.6 Canvas Scope layout', () => {
  it('only proposes positions for nodes in the active scope', () => {
    const preview = proposeScopeLayout(fixtureNodes, 'scope-reference')
    expect(preview.map((item) => item.id)).toEqual(expect.arrayContaining(['ref-view-1', 'ref-view-2', 'ref-view-3', 'locked-elements']))
    expect(preview.some((item) => item.id === 'proposal')).toBe(false)
  })

  it('keeps source content left and confirmation records below', () => {
    const preview = proposeScopeLayout(fixtureNodes, 'scope-reference')
    const source = preview.find((item) => item.id === 'ref-view-1')!
    const decision = preview.find((item) => item.id === 'locked-elements')!
    expect(decision.y).toBeGreaterThan(source.y)
  })

  it('applies only previewed view coordinates', () => {
    const preview = proposeScopeLayout(fixtureNodes, 'scope-reference')
    const result = applyScopeLayout(fixtureNodes, preview)
    expect(result.find((node) => node.id === 'proposal')).toEqual(fixtureNodes.find((node) => node.id === 'proposal'))
    expect(result.find((node) => node.id === 'ref-view-1')?.x).toBe(preview.find((item) => item.id === 'ref-view-1')?.x)
  })
})

describe('fixed layout anchors', () => {
  it('does not include fixed nodes in the layout preview', () => {
    const locked = fixtureNodes.map((node) => node.id === 'locked-elements' ? { ...node, positionLocked: true } : node)
    const preview = proposeScopeLayout(locked, 'scope-reference')
    expect(preview.some((item) => item.id === 'locked-elements')).toBe(false)
    expect(preview.some((item) => item.id === 'ref-view-1')).toBe(true)
  })
})

describe('isolated node recovery preview', () => {
  const node = (id: string, x: number, y: number, positionLocked = false) => ({
    ...fixtureNodes[0]!, id, title: id, x, y, scopeId: 'scope-islands', positionLocked,
  })

  it('previews only outliers and leaves the primary content island untouched', () => {
    const nodes = [node('main-a', 100, 100), node('main-b', 430, 120), node('main-c', 230, 430), node('lost', 8_000, 6_000)]
    const preview = proposeIslandRecoveryLayout(nodes, 'scope-islands')
    expect(preview.map((item) => item.id)).toEqual(['lost'])
    expect(preview[0].x).toBeLessThan(1_500)
    expect(preview[0].y).toBeLessThan(1_500)
  })

  it('does not move a fixed outlier', () => {
    const nodes = [node('main-a', 100, 100), node('main-b', 430, 120), node('locked-lost', 8_000, 6_000, true)]
    expect(proposeIslandRecoveryLayout(nodes, 'scope-islands')).toEqual([])
  })
})
