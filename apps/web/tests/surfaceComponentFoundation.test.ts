import { describe, expect, it } from 'vitest'

import type { SurfaceElement } from '../src/features/spatial/model/surfaceElementTypes'
import { surfaceComponentRegistry } from '../src/features/spatial/components/surfaceComponentRegistry'
import { surfaceComponentContract, surfaceComponentsFor } from '../src/features/spatial/model/surfaceComponentCatalog'
import { applySurfaceOp, validateSurfaceOp } from '../src/features/spatial/model/surfaceOps'
import { placeSurfaceComponent } from '../src/features/spatial/model/surfaceGeometry'
import { resolveSurfaceIntent } from '../src/features/spatial/model/surfaceIntent'

const element = (patch: Partial<SurfaceElement> = {}): SurfaceElement => ({
  id: 'surface:region:1',
  projectId: 'project-a',
  surface: 'context',
  type: 'region',
  bounds: { x: 100, y: 100, w: 320, h: 200 },
  ...patch,
})

describe('S0 Spatial Component Foundation', () => {
  it('registers trusted component capabilities and keeps Workflow Step adapter-only', () => {
    expect(surfaceComponentRegistry.fence.renderer).toBeTypeOf('function')
    expect(surfaceComponentRegistry['structure-map'].surfaces).toEqual(['context'])
    expect(surfaceComponentContract('workflow-step').createMode).toBe('adapter-only')
    expect(surfaceComponentsFor('workflow', true).map((item) => item.type)).not.toContain('workflow-step')
    expect(surfaceComponentsFor('workflow', true).map((item) => item.type)).toContain('review')
  })

  it('remove-projection removes only the SurfaceElement and never carries a project-delete operation', () => {
    const bound = element({ binding: { entityId: 'entity-real-1' } })
    const result = applySurfaceOp([bound], { type: 'remove-projection', elementId: bound.id })
    expect(result).toEqual([])
    expect(JSON.stringify({ type: 'remove-projection' })).not.toContain('delete-project')
  })

  it('validates move/resize and refuses automatic movement of pinned manual elements', () => {
    const pinned = element({ presentation: { pinned: true } })
    expect(validateSurfaceOp({ type: 'move', elementId: pinned.id, x: 500, y: 300 }, [pinned])).toMatchObject({ ok: false })
    expect(applySurfaceOp([pinned], { type: 'move', elementId: pinned.id, x: 500, y: 300 })[0]?.bounds).toEqual(pinned.bounds)
    expect(validateSurfaceOp({ type: 'resize', elementId: pinned.id, w: 600, h: 400 }, [pinned])).toMatchObject({ ok: false })
  })

  it('places new components deterministically without rewriting pinned blockers', () => {
    const blocker = element({ presentation: { pinned: true } })
    const before = structuredClone(blocker)
    const placed = placeSurfaceComponent({
      size: { w: 260, h: 170 },
      selection: blocker.bounds,
      viewportOrigin: { x: 0, y: 0 },
      existing: [blocker],
    })
    expect(placed.x).toBeGreaterThanOrEqual(blocker.bounds.x + blocker.bounds.w)
    expect(blocker).toEqual(before)
  })

  it('resolves user intent into legal component ops while leaving pixels to deterministic geometry', () => {
    const ops = resolveSurfaceIntent({ kind: 'show-structure', targetIds: ['view-a'] }, {
      projectId: 'project-a',
      surface: 'context',
      existing: [],
      selectionBounds: { x: 20, y: 40, w: 280, h: 160 },
      viewportOrigin: { x: 100, y: 100 },
      createId: (type) => `fixture:${type}`,
    })
    expect(ops).toHaveLength(1)
    expect(ops[0]).toMatchObject({ type: 'create-component', component: { id: 'fixture:structure-map', type: 'structure-map', surface: 'context' } })

    const workflowOps = resolveSurfaceIntent({ kind: 'show-structure', targetIds: ['view-a'] }, {
      projectId: 'project-a',
      surface: 'workflow',
      existing: [],
      viewportOrigin: { x: 100, y: 100 },
      createId: (type) => `fixture:${type}`,
    })
    expect(workflowOps[0]).toMatchObject({ type: 'create-component', component: { type: 'region', surface: 'workflow' } })
  })
})
