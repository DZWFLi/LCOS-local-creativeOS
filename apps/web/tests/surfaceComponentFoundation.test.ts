import { describe, expect, it } from 'vitest'

import type { SurfaceElement } from '../src/features/spatial/model/surfaceElementTypes'
import { surfaceComponentRegistry } from '../src/features/spatial/components/surfaceComponentRegistry'
import { surfaceComponentContract, surfaceComponentsFor } from '../src/features/spatial/model/surfaceComponentCatalog'
import { applySurfaceOp, applySurfaceOps, validateSurfaceOp, validateSurfaceOps } from '../src/features/spatial/model/surfaceOps'
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
  it('keeps planned capability shells out of the Human Shelf', () => {
    expect(surfaceComponentRegistry.fence.renderer).toBeTypeOf('function')
    expect(surfaceComponentRegistry['structure-map'].surfaces).toEqual(['context'])
    expect(surfaceComponentContract('workflow-step').createMode).toBe('adapter-only')
    expect(surfaceComponentContract('structure-map').createMode).toBe('planned')
    expect(surfaceComponentContract('review').createMode).toBe('planned')
    expect(surfaceComponentsFor('workflow', true).map((item) => item.type)).not.toContain('workflow-step')
    expect(surfaceComponentsFor('workflow', true).map((item) => item.type)).not.toContain('review')
    expect(surfaceComponentsFor('context', true).map((item) => item.type)).toEqual(expect.arrayContaining(['fence', 'region']))
    expect(surfaceComponentsFor('context', true).map((item) => item.type)).not.toContain('structure-map')
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

  it('moves only the explicitly addressed component and leaves neighbors untouched', () => {
    const a = element({ id: 'surface:region:a' })
    const b = element({ id: 'surface:region:b', bounds: { x: 460, y: 100, w: 320, h: 200 } })
    const c = element({ id: 'surface:region:c', bounds: { x: 100, y: 360, w: 320, h: 200 } })
    const result = applySurfaceOp([a, b, c], { type: 'move', elementId: a.id, x: 170, y: 190 })
    expect(result.find((item) => item.id === a.id)?.bounds).toMatchObject({ x: 170, y: 190 })
    expect(result.find((item) => item.id === b.id)).toEqual(b)
    expect(result.find((item) => item.id === c.id)).toEqual(c)
  })

  it('applies proposal batches atomically', () => {
    const original = element()
    const ops = [
      { type: 'move', elementId: original.id, x: 500, y: 300 },
      { type: 'resize', elementId: original.id, w: 1, h: 1 },
    ] as const
    expect(validateSurfaceOps([original], ops)).toMatchObject({ ok: false, opIndex: 1 })
    expect(applySurfaceOps([original], ops)).toEqual([original])
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

  it('keeps planned intents silent and preserves target identity for legal create intents', () => {
    const planned = resolveSurfaceIntent({ kind: 'show-structure', targetIds: ['view-a'] }, {
      projectId: 'project-a',
      surface: 'context',
      existing: [],
      selectionBounds: { x: 20, y: 40, w: 280, h: 160 },
      viewportOrigin: { x: 100, y: 100 },
      createId: (type) => `fixture:${type}`,
    })
    expect(planned).toEqual([])

    const ops = resolveSurfaceIntent({ kind: 'focus-region', targetIds: ['view-a', 'view-b', 'view-a'] }, {
      projectId: 'project-a', surface: 'context', existing: [],
      selectionBounds: { x: 20, y: 40, w: 280, h: 160 },
      viewportOrigin: { x: 100, y: 100 },
      createId: (type) => `fixture:${type}`,
    })
    expect(ops).toHaveLength(1)
    expect(ops[0]).toMatchObject({ type: 'create-component', component: {
      id: 'fixture:region', type: 'region', surface: 'context',
      binding: { projectViewIds: ['view-a', 'view-b'] },
    } })
  })
})
