import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { CanvasNode } from '../src/model'
import type { SurfaceElement } from '../src/features/spatial/model/surfaceElementTypes'
import { ContextPackComponent, RelationshipFieldComponent, StructureMapComponent } from '../src/features/spatial/components/ContextComponentRenderers'
import { SurfaceComponentProposalLayer } from '../src/features/spatial/components/SurfaceComponentProposalLayer'
import { PortalComponent } from '../src/features/spatial/components/PortalComponent'
import { CheckpointComponent, ReviewComponent, WorkbenchFrameComponent } from '../src/features/spatial/components/WorkflowComponentRenderers'
import { ActivePathComponent, CompareComponent, StackComponent } from '../src/features/spatial/components/MainComponentRenderers'
import { LcosGlyth } from '../src/features/spatial/visual/LcosGlyth'
import { LcosSignalGlyph } from '../src/features/design/DotGlyph'
import { SourceChainComponent } from '../src/features/spatial/components/SourceChainComponent'
import { boundRegionSemanticForView, resolveSpatialSignal, shouldShowSignal } from '../src/features/spatial/visual/spatialSignal'
import { surfaceComponentRegistry } from '../src/features/spatial/components/surfaceComponentRegistry'
import { surfaceComponentContract, surfaceComponentsFor } from '../src/features/spatial/model/surfaceComponentCatalog'
import { applySurfaceOp, applySurfaceOps, validateSurfaceOp, validateSurfaceOps } from '../src/features/spatial/model/surfaceOps'
import { placeSurfaceComponent } from '../src/features/spatial/model/surfaceGeometry'
import { resolveSurfaceIntent } from '../src/features/spatial/model/surfaceIntent'
import { SurfaceObject } from '../src/features/surfaces/SurfaceObject'
import { applySourceChainEdit } from '../src/features/spatial/model/sourceChainOps'

const element = (patch: Partial<SurfaceElement> = {}): SurfaceElement => ({
  id: 'surface:region:1',
  projectId: 'project-a',
  surface: 'context',
  type: 'region',
  bounds: { x: 100, y: 100, w: 320, h: 200 },
  ...patch,
})

describe('Spatial Component Foundation integrity', () => {
  it('exposes only capability components with honest render adapters', () => {
    expect(surfaceComponentRegistry.fence.renderer).toBeTypeOf('function')
    expect(surfaceComponentRegistry['structure-map'].surfaces).toEqual(['context'])
    expect(surfaceComponentContract('workflow-step').createMode).toBe('adapter-only')
    expect(surfaceComponentContract('structure-map').createMode).toBe('presentation')
    expect(surfaceComponentContract('context-pack').requiresSelection).toBe(true)
    expect(surfaceComponentContract('review').createMode).toBe('adapter-only')
    expect(surfaceComponentContract('checkpoint').createMode).toBe('adapter-only')
    expect(surfaceComponentContract('portal').createMode).toBe('adapter-only')
    // R3-A（20260829）：Fence 退役为隐藏兼容适配器，空间组织由 Colony 表达。
    expect(surfaceComponentContract('fence').showInShelf).toBe(false)
    expect(surfaceComponentContract('stack').createMode).toBe('presentation')
    expect(surfaceComponentContract('stack').surfaces).toEqual(['main', 'context'])
    expect(surfaceComponentContract('compare').createMode).toBe('adapter-only') // R3-A：Compare 退役为临时动作
    expect(surfaceComponentContract('active-path').createMode).toBe('presentation')
    expect(surfaceComponentsFor('main', true).map((item) => item.type)).toContain('stack')
    expect(surfaceComponentsFor('main', true).map((item) => item.type)).not.toContain('compare') // R3-A：不再可创建
    expect(surfaceComponentsFor('main', true).map((item) => item.type)).not.toContain('fence') // R3-A：不再可创建
    expect(surfaceComponentsFor('workflow', true).map((item) => item.type)).toContain('active-path')
    expect(surfaceComponentContract('context-pack').surfaces).toEqual(['context'])
    expect(surfaceComponentsFor('workflow', true).map((item) => item.type)).not.toContain('workflow-step')
    expect(surfaceComponentsFor('workflow', true).map((item) => item.type)).not.toContain('context-pack')
    expect(surfaceComponentsFor('workflow', true).map((item) => item.type)).not.toContain('workbench') // R3-A：不再允许创建万能工作台
    expect(surfaceComponentsFor('workflow', true).map((item) => item.type)).not.toEqual(expect.arrayContaining(['review', 'checkpoint']))
    expect(surfaceComponentsFor('context', true).map((item) => item.type)).toEqual(expect.arrayContaining(['structure-map', 'evolution', 'relationship-field', 'stack'])) // R3-A：context-pack/compare 退役
  })

  it('renders movable source chains from stable Project View identities', () => {
    const nodes: CanvasNode[] = [{ id: 'source-a', title: '客户飞书 Brief', subtitle: '已引用 8 处', kind: 'source', x: 0, y: 0, width: 180, height: 100 }]
    const html = renderToStaticMarkup(createElement(SourceChainComponent, {
      element: element({ type: 'source-chain', binding: { projectViewIds: ['source-a'] } }), context: { nodes },
    }))
    expect(html).toContain('客户飞书 Brief')
    expect(html).toContain('双击阅读')
    expect(html).not.toContain('pointer-events: none')
  })

  it('cuts, branches and splices source chains without touching Project Truth', () => {
    const a = element({ id: 'chain-a', type: 'source-chain', binding: { projectViewIds: ['view-a', 'view-b'] } })
    const b = element({ id: 'chain-b', type: 'source-chain', binding: { projectViewIds: ['view-c'] } })
    const moved = applySourceChainEdit([a, b], 'chain-b', { kind: 'move', sourceElementId: 'chain-a', viewId: 'view-b', targetIndex: 0 })
    expect(moved.find((item) => item.id === 'chain-a')?.binding?.projectViewIds).toEqual(['view-a'])
    expect(moved.find((item) => item.id === 'chain-b')?.binding?.projectViewIds).toEqual(['view-b', 'view-c'])
    const split = applySourceChainEdit(moved, 'chain-b', { kind: 'split', viewId: 'view-c' }, () => 'chain-c')
    expect(split.find((item) => item.id === 'chain-c')).toMatchObject({ type: 'source-chain', binding: { projectViewIds: ['view-c'] } })
    const removed = applySourceChainEdit(split, 'chain-c', { kind: 'remove', viewId: 'view-c' })
    expect(removed.find((item) => item.id === 'chain-c')?.binding).toEqual({})
    expect(JSON.stringify(removed)).not.toContain('deleteProject')
  })

  it('renders Workbench from bound Project Views instead of hard-coded routines', () => {
    const nodes: CanvasNode[] = [
      { id: 'view-page', title: '客户飞书文档', subtitle: 'Linked page', kind: 'source', x: 0, y: 0, width: 180, height: 100 },
      { id: 'view-other', title: '范围外页面', subtitle: '', kind: 'source', x: 0, y: 0, width: 180, height: 100 },
    ]
    const html = renderToStaticMarkup(createElement(WorkbenchFrameComponent, {
      element: element({ type: 'workbench', surface: 'workflow', binding: { projectViewIds: ['view-page'] } }),
      context: { nodes },
    }))
    expect(html).toContain('客户飞书文档')
    expect(html).not.toContain('范围外页面')
    expect(html).not.toContain('今日工作页')
    // Real tool slots replaced the dead "等待真实 Agent Tool Runtime" placeholder (2026-08-24).
    expect(html).toContain('页面总结')
    expect(html).not.toContain('等待真实 Agent Tool Runtime')
  })

  it('renders Stack, Compare and Active Path from bound Project View identities', () => {
    const nodes: CanvasNode[] = [
      { id: 'view-a', title: '方案 A', subtitle: '初稿', kind: 'note', x: 0, y: 0, width: 180, height: 100 },
      { id: 'view-b', title: '方案 B', subtitle: '终稿', kind: 'note', x: 200, y: 0, width: 180, height: 100 },
    ]
    const stack = renderToStaticMarkup(createElement(StackComponent, {
      element: element({ type: 'stack', surface: 'main', binding: { projectViewIds: ['view-a', 'view-b'] } }),
      context: { nodes },
    }))
    expect(stack).toContain('方案 A')
    expect(stack).toContain('方案 B')
    expect(stack).toContain('mode-progress')
    const compare = renderToStaticMarkup(createElement(CompareComponent, {
      element: element({ type: 'compare', surface: 'main', binding: { projectViewIds: ['view-a', 'view-b'] } }),
      context: { nodes },
    }))
    expect(compare).toContain('方案 A')
    expect(compare).toContain('方案 B')
    expect(compare).toContain('lcos-compare-divider')
    const path = renderToStaticMarkup(createElement(ActivePathComponent, {
      element: element({ type: 'active-path', surface: 'workflow', binding: { projectViewIds: ['view-a', 'view-b'] } }),
      context: { nodes },
    }))
    expect(path).toContain('方案 A')
    expect(path).toContain('mode-flow')
  })

  it('renders Review and Checkpoint only from real bound identities', () => {
    const review = renderToStaticMarkup(createElement(ReviewComponent, {
      element: element({ type: 'review', surface: 'workflow', binding: { runId: 'run-real' } }),
      context: { reviews: [{ runId: 'run-real', label: '客户反馈修改', phase: 'review' }] },
    }))
    expect(review).toContain('客户反馈修改')
    const checkpoint = renderToStaticMarkup(createElement(CheckpointComponent, {
      element: element({ type: 'checkpoint', surface: 'workflow', binding: { checkpointId: 'checkpoint-real' } }),
      context: { checkpoints: [{ checkpointId: 'checkpoint-real', label: '交付前冻结', createdAt: '2026-08-23T00:00:00.000Z' }] },
    }))
    expect(checkpoint).toContain('交付前冻结')
    expect(checkpoint).toContain('2026-08-23')
  })

  it('renders a Portal from one stable Project View identity without copying members', () => {
    const html = renderToStaticMarkup(createElement(PortalComponent, {
      element: element({ type: 'portal', surface: 'main', binding: { projectViewId: 'context-real' }, presentation: { variant: '客户反馈上下文' } }),
    }))
    expect(html).toContain('客户反馈上下文')
    expect(html).toContain('context-real')
    expect(html).not.toContain('projectViewIds')
  })

  it('keeps selected objects readable while allowing cross-surface semantic proxies', () => {
    const node: CanvasNode = { id: 'view-heavy', title: '大型预览', subtitle: '', kind: 'source', fileType: 'pdf', x: 0, y: 0, width: 240, height: 180 }
    const proxy = renderToStaticMarkup(createElement(SurfaceObject, { node, selected: false, performanceProxy: true, onSelect: () => {}, onDoubleClick: () => {} }))
    const selected = renderToStaticMarkup(createElement(SurfaceObject, { node, selected: true, performanceProxy: false, onSelect: () => {}, onDoubleClick: () => {} }))
    expect(proxy).toContain('lcos-overview-node-proxy')
    expect(selected).not.toContain('lcos-overview-node-proxy')
  })

  it('renders Context components from bound Project objects instead of decorative placeholder copy', () => {
    const node = (id: string, title: string): CanvasNode => ({ id, title, subtitle: `${title} 摘要`, kind: 'context', x: 0, y: 0, width: 180, height: 100 })
    const nodes = [node('view-a', '真实 Brief'), node('view-b', '客户反馈'), node('view-c', '范围外对象')]
    const bound = element({ type: 'structure-map', binding: { projectViewIds: ['view-a', 'view-b'] } })
    const structure = renderToStaticMarkup(createElement(StructureMapComponent, { element: bound, context: { nodes } }))
    expect(structure).toContain('真实 Brief')
    expect(structure).toContain('客户反馈')
    expect(structure).not.toContain('范围外对象')
    expect(structure).not.toContain('主线材料')

    const relationship = renderToStaticMarkup(createElement(RelationshipFieldComponent, {
      element: { ...bound, type: 'relationship-field' },
      context: { nodes, edges: [{ id: 'edge-a', from: 'view-a', to: 'view-b', kind: 'feedback', label: '要求修改' }] },
    }))
    expect(relationship).toContain('要求修改')
    expect(relationship).toContain('真实 Brief')

    const pack = renderToStaticMarkup(createElement(ContextPackComponent, { element: { ...bound, type: 'context-pack' }, context: { nodes } }))
    expect(pack).toContain('2 个视图引用')
    expect(pack).not.toContain('范围外对象')
  })

  it('renders Agent proposals as non-durable ghost components before Keep', () => {
    const proposed = element({ id: 'proposal:region:1', type: 'region', binding: { projectViewIds: ['view-a'] } })
    const html = renderToStaticMarkup(createElement(SurfaceComponentProposalLayer, { surface: 'context', elements: [proposed] }))
    expect(html).toContain('Agent 建议')
    expect(html).toContain('lcos-surface-component-proposal')
    expect(html).not.toContain('lcos-surface-component-chrome')
  })

  it('keeps one recognizable Glyth bloub body while semantic states change its pose', () => {
    for (const state of ['stable', 'working', 'waiting', 'error', 'confirm', 'absorb', 'output'] as const) {
      const html = renderToStaticMarkup(createElement(LcosGlyth, { state }))
      expect(html).toContain(`data-glyth-state="${state}"`)
      expect(html).toContain('lcos-glyth-arcs-front')
      expect(html).toContain('data-glyth-notif')
      expect(html).toContain('lcos-glyth-core')
      expect(html).toContain('lcos-glyth-eyes')
      expect(html).toContain('data-glyth-body')
      expect(html).toContain('lcos-glyth-dots')
    }
  })

  it('uses the 16×16 system signal for ordinary object state instead of a Glyth avatar', () => {
    const html = renderToStaticMarkup(createElement(LcosSignalGlyph, { state: 'focus' }))
    expect(html).toContain('lcos-signal-glyph')
    expect(html).toContain('data-signal-state="focus"')
    expect(html).not.toContain('lcos-glyth')
  })

  it('resolves one Presentation signal across Glyph, Segment and Matrix without inventing truth', () => {
    // Selection is a transient input: it lights the skeleton, never a persistent pose.
    expect(resolveSpatialSignal({ selected: true })).toMatchObject({ state: 'stable', matrixActive: false, segmentActive: true })
    expect(resolveSpatialSignal({ semantic: '待客户确认' })).toMatchObject({ state: 'pending', matrixActive: false })
    expect(resolveSpatialSignal({ semantic: '已冻结 不要动' })).toMatchObject({ state: 'stable', matrixActive: false })
    expect(resolveSpatialSignal({ runtime: 'processing' })).toMatchObject({ state: 'working', matrixActive: true })
    expect(resolveSpatialSignal({ selected: true, semantic: '冲突', runtime: 'processing' })).toMatchObject({ state: 'failed', matrixActive: false })
    expect(resolveSpatialSignal({ semantic: '正在接收材料' })).toMatchObject({ state: 'receiving', matrixActive: true })
    expect(resolveSpatialSignal({ semantic: '输出结果' })).toMatchObject({ state: 'sending', matrixActive: true })
    expect(resolveSpatialSignal({ runtime: 'complete' })).toMatchObject({ state: 'kept', matrixActive: false })
    expect(shouldShowSignal(resolveSpatialSignal({ selected: true }))).toBe(false)
    expect(shouldShowSignal(resolveSpatialSignal({ semantic: '冲突' }))).toBe(true)
  })

  it('inherits Region semantics only through explicit Project View bindings', () => {
    const elements = [
      element({ id: 'region:protected', type: 'region', binding: { projectViewIds: ['view:a'] }, presentation: { variant: 'protected' } }),
      element({ id: 'region:working', type: 'region', binding: { projectViewId: 'view:a' }, presentation: { variant: 'working' } }),
      element({ id: 'region:nearby', type: 'region', bounds: { x: 0, y: 0, w: 999, h: 999 }, presentation: { variant: 'blocked' } }),
    ]
    expect(boundRegionSemanticForView(elements, 'view:a')).toBe('protected · working')
    expect(boundRegionSemanticForView(elements, 'view:b')).toBeUndefined()
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

  it('resolves approved Context lenses and preserves legal region identity', () => {
    const structure = resolveSurfaceIntent({ kind: 'show-structure', targetIds: ['view-a'] }, {
      projectId: 'project-a',
      surface: 'context',
      existing: [],
      selectionBounds: { x: 20, y: 40, w: 280, h: 160 },
      viewportOrigin: { x: 100, y: 100 },
      createId: (type) => `fixture:${type}`,
    })
    expect(structure).toHaveLength(1)
    expect(structure[0]).toMatchObject({ type: 'create-component', component: { type: 'structure-map', binding: { projectViewIds: ['view-a'] } } })

    const ops = resolveSurfaceIntent({ kind: 'focus-region', targetIds: ['view-a', 'view-b', 'view-a'] }, {
      projectId: 'project-a', surface: 'context', existing: [],
      selectionBounds: { x: 20, y: 40, w: 280, h: 160 },
      viewportOrigin: { x: 100, y: 100 },
      createId: (type) => `fixture:${type}`,
    })
    // R3-A（20260829）：focus-region 意图 fail-closed；空间范围由用户手动圈选 Colony 表达。
    expect(ops).toEqual([])
  })

  it('retired Workbench creation intents stay fail-closed alongside unsupported runtime intents (R3-A)', () => {
    const ops = resolveSurfaceIntent({ kind: 'place-quick-note-near-page', targetIds: ['page-a'] }, {
      projectId: 'project-a', surface: 'workflow', existing: [],
      viewportOrigin: { x: 0, y: 0 }, createId: (type) => `fixture:${type}`,
    })
    expect(ops).toEqual([]) // R3-A：workbench 仅兼容既有，不再新建
    expect(resolveSurfaceIntent({ kind: 'restore-routine', targetIds: ['page-a'] }, {
      projectId: 'project-a', surface: 'workflow', existing: [], viewportOrigin: { x: 0, y: 0 },
    })).toEqual([])
  })

  it('prepare-workbench fails closed on Main without mutating selected objects (R3-A)', () => {
    const ops = resolveSurfaceIntent({ kind: 'prepare-workbench', targetIds: ['view-a', 'view-b'] }, {
      projectId: 'project-a', surface: 'main', existing: [],
      selectionBounds: { x: 80, y: 90, w: 420, h: 220 }, viewportOrigin: { x: 0, y: 0 },
      createId: (type) => `fixture:${type}`,
    })
    expect(ops).toEqual([]) // R3-A：workbench 仅兼容既有独立工作空间
  })
})
