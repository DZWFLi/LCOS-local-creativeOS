import { describe, expect, it } from 'vitest'
import {
  projectSpatialMarkers,
  resolveSpatialMarkerNavigation,
  spatialMarkerFanGroups,
  spatialMarkerMorphology,
  spatialMarkerSurfaceForCanvas,
  type SpatialMarkerCluster,
  type SpatialMarkerItem,
} from '../spatialMarkerSystem'

const camera = { x: 0, y: 0, zoom: 1 }
const viewport = { width: 400, height: 300 }

function marker(id: string, x: number, y: number, extra: Partial<SpatialMarkerItem> = {}): SpatialMarkerItem {
  return {
    id,
    label: id,
    bounds: { x, y, width: 20, height: 20 },
    surface: 'main',
    scope: 'local',
    sourceSurfaceRef: 'main',
    ...extra,
  }
}

describe('Spatial Marker System F6A2', () => {
  it('keeps one marker identity while viewport relation changes pin ↔ cursor', () => {
    const onscreen = projectSpatialMarkers({ items: [marker('m1', 40, 40)], camera, viewportSize: viewport, currentSurfaceRef: 'main' })
    const offscreen = projectSpatialMarkers({ items: [marker('m1', 1400, 40)], camera, viewportSize: viewport, currentSurfaceRef: 'main' })
    expect(onscreen[0]?.kind).toBe('marker')
    expect(offscreen[0]?.kind).toBe('marker')
    if (onscreen[0]?.kind !== 'marker' || offscreen[0]?.kind !== 'marker') return
    expect(onscreen[0].marker.item.id).toBe('m1')
    expect(offscreen[0].marker.item.id).toBe('m1')
    expect(onscreen[0].marker.kind).toBe('world-pin')
    expect(offscreen[0].marker.kind).toBe('edge-cursor')
  })

  it('clusters by screen density rather than a hard marker-count threshold', () => {
    const close = projectSpatialMarkers({
      items: [marker('a', 80, 80), marker('b', 95, 88)],
      camera,
      viewportSize: viewport,
      currentSurfaceRef: 'main',
    })
    expect(close).toHaveLength(1)
    expect(close[0]?.kind).toBe('cluster')

    const apart = projectSpatialMarkers({
      items: [marker('a', 40, 40), marker('b', 300, 220)],
      camera,
      viewportSize: viewport,
      currentSurfaceRef: 'main',
    })
    expect(apart).toHaveLength(2)
    expect(apart.every((item) => item.kind === 'marker')).toBe(true)
  })

  it('lets Beacon/Search/Focus/Selection break out of a nearby cluster', () => {
    const projected = projectSpatialMarkers({
      items: [
        marker('a', 80, 80),
        marker('b', 86, 84),
        marker('target', 90, 88, { attention: 'focus' }),
      ],
      camera,
      viewportSize: viewport,
      currentSurfaceRef: 'main',
    })
    expect(projected.some((item) => item.kind === 'marker' && item.marker.item.id === 'target')).toBe(true)
    expect(projected.some((item) => item.kind === 'cluster')).toBe(true)
  })

  it('keeps local markers surface-local while cross-surface markers pierce the layer', () => {
    const projected = projectSpatialMarkers({
      items: [
        marker('local-main', 40, 40, { sourceSurfaceRef: 'main' }),
        marker('local-context', 160, 40, { surface: 'context', sourceSurfaceRef: 'context:1' }),
        marker('cross-workflow', 280, 40, { surface: 'workflow', scope: 'cross-surface', sourceSurfaceRef: 'workflow:1' }),
      ],
      camera,
      viewportSize: viewport,
      currentSurfaceRef: 'main',
    })
    const ids = projected.flatMap((item) => item.kind === 'marker' ? [item.marker.item.id] : item.members.map((member) => member.item.id))
    expect(ids).toContain('local-main')
    expect(ids).not.toContain('local-context')
    expect(ids).toContain('cross-workflow')
  })


  it('maps shared canvas identities to the three marker morphologies without content heuristics', () => {
    expect(spatialMarkerSurfaceForCanvas('canvas')).toBe('main')
    expect(spatialMarkerSurfaceForCanvas('context-space-spatial')).toBe('context')
    expect(spatialMarkerSurfaceForCanvas('context-tree-spatial')).toBe('context')
    expect(spatialMarkerSurfaceForCanvas('workflow-spatial')).toBe('workflow')
    expect(spatialMarkerSurfaceForCanvas('workflow-graph-spatial')).toBe('workflow')
  })

  it('uses one family with distinct Main / Context / Workflow morphology', () => {
    expect(spatialMarkerMorphology('main')).toBe('main')
    expect(spatialMarkerMorphology('context')).toBe('context')
    expect(spatialMarkerMorphology('workflow')).toBe('workflow')
    expect(spatialMarkerMorphology('conversation')).toBe('neutral')
  })

  it('fans dense clusters into semantic directions instead of one flat list', () => {
    const projected = projectSpatialMarkers({
      items: [
        marker('a', 80, 80, { groupKey: 'brief', groupLabel: 'Brief' }),
        marker('b', 84, 82, { groupKey: 'brief', groupLabel: 'Brief' }),
        marker('c', 88, 84, { groupKey: 'refs', groupLabel: '参考' }),
      ],
      camera,
      viewportSize: viewport,
      currentSurfaceRef: 'main',
    })
    const cluster = projected.find((item): item is SpatialMarkerCluster => item.kind === 'cluster')
    expect(cluster).toBeDefined()
    if (!cluster) return
    const groups = spatialMarkerFanGroups(cluster)
    expect(groups.map((group) => group.label)).toEqual(expect.arrayContaining(['Brief', '参考']))
    expect(groups.length).toBeLessThanOrEqual(5)
  })

  it('fails closed on cross-project and keeps deleted targets unresolved', async () => {
    const intent = {
      id: 'marker:1',
      projectId: 'p1',
      targetRef: { projectId: 'p1', kind: 'entity' as const, id: 'n1' },
      scope: 'cross-surface' as const,
      createdAt: '2026-08-29T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
    }
    const missing = await resolveSpatialMarkerNavigation(intent, 'p1', { resolve: async () => ({ status: 'unresolved', reason: 'target-missing' }) })
    expect(missing).toEqual({ status: 'unresolved', reason: 'target-missing' })

    const blocked = await resolveSpatialMarkerNavigation({ ...intent, targetRef: { ...intent.targetRef, projectId: 'p2' } }, 'p1', { resolve: async () => ({ status: 'unresolved', reason: 'target-missing' }) })
    expect(blocked).toEqual({ status: 'unresolved', reason: 'cross-project' })
  })
})
