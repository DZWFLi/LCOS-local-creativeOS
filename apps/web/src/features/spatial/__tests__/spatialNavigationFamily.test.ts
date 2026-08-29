import { describe, expect, it } from 'vitest'
import {
  agentProposalMarkerTargets,
  markerForNavigationTarget,
  semanticNavigationRegionOverviews,
  stableRailSurfaceRef,
} from '../spatialNavigationFamily'

const marker = {
  id: 'marker-1',
  projectId: 'project-1',
  targetRef: { projectId: 'project-1', kind: 'view' as const, id: 'view-1' },
  scope: 'cross-surface' as const,
  createdAt: '2026-08-29T00:00:00.000Z',
  updatedAt: '2026-08-29T00:00:00.000Z',
}

describe('R2-C spatial navigation family', () => {
  it('matches durable markers only by canonical target identity', () => {
    expect(markerForNavigationTarget([{ intent: marker }], marker.targetRef)?.id).toBe('marker-1')
    expect(markerForNavigationTarget([{ intent: marker }], { ...marker.targetRef, id: 'view-2' })).toBeNull()
  })

  it('maps only canonical workspace/scope rail entries to stable surface refs', () => {
    expect(stableRailSurfaceRef({ id: 'workspace:w1', workspaceId: 'w1' })).toBe('workspace:w1')
    expect(stableRailSurfaceRef({ id: 'scope:c1', scopeId: 'c1' })).toBe('scope:c1')
    expect(stableRailSurfaceRef({ id: 'workflow:root', scopeId: 'root' })).toBeNull()
  })

  it('turns an Agent suggestion into explicit deduped marker candidates without writing anything', () => {
    const targets = agentProposalMarkerTargets('project-1', { targetViewId: 'view-1', addViewIds: ['view-1', 'view-2'] })
    expect(targets.map((target) => target.id)).toEqual(['view-1', 'view-2'])
  })

  it('projects semantic regions only at far zoom and never calls a Core marker API', () => {
    const regions = [{ id: 'r1', label: '区域', memberViewIds: ['a', 'b'], bounds: { x: 0, y: 0, width: 200, height: 100 } }]
    expect(semanticNavigationRegionOverviews(regions, .8)).toHaveLength(0)
    expect(semanticNavigationRegionOverviews(regions, .4)[0]?.markerId).toBe('semantic-region:r1')
  })
})
