import { Layers3 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { AttentionBucketV0 } from '@local-creative-os/contracts'
import type { CanvasEdge, CanvasNode } from '../../model'
import { nodeDimensions } from '../canvas/canvasGeometry'
import { buildHierarchySeed } from '../presentation/presentationHierarchy'
import { usePresentationHierarchyState } from '../../state/presentationHierarchyState'
import { contextUnderstandingRegions } from './contextUnderstandingRegions'
import { SpatialCanvas } from '../spatial/SpatialCanvas'
import { SpatialEdgeLayer } from '../spatial/SpatialEdgeLayer'
import { SpatialNodeLayer } from '../spatial/SpatialNodeLayer'
import { spatialBoundsForPlacements } from '../spatial/spatialCamera'
import { advanceSpatialNodeDrag, beginSpatialNodeDrag, endSpatialPointer } from '../spatial/spatialInteractionMachine'
import { IDLE_SPATIAL_POINTER, type SpatialPointerSession } from '../spatial/spatialTypes'
import { usePresentationDraftPinnedIds, usePresentationDraftPositions, usePresentationSurfaceElements } from '../../state/presentationDraftState'
import { useSpatialSessionCamera } from '../../state/spatialSessionState'
import { useSpatialFocusRequest, type SpatialFocusRequest } from '../spatial/useSpatialFocusRequest'
import { SurfaceObject } from './SurfaceObject'
import { ContextHistoryRail } from './ContextHistoryRail'
import { ContextLensSwitch } from './ContextLensSwitch'
import type { ContextSurfaceRuntime } from './surfaceContracts'
import type { SurfaceId } from '../shell/SurfaceDock'
import { SurfaceComponentLayer } from '../spatial/components/SurfaceComponentLayer'
import { SurfaceComponentProposalLayer } from '../spatial/components/SurfaceComponentProposalLayer'
import { SurfaceComponentShelf } from '../spatial/components/SurfaceComponentShelf'
import { boundsAroundSurfaceRects, surfaceViewportOrigin } from '../spatial/model/surfaceGeometry'
import { applySurfaceOps, type SurfaceOp, validateSurfaceOps } from '../spatial/model/surfaceOps'
import { resolveSurfaceIntent, type SurfaceIntent } from '../spatial/model/surfaceIntent'
import { AgentSurfaceComposer } from './AgentSurfaceComposer'

interface Props {
  projectId: string
  scopeId: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  selectedIds: string[]
  attentionBucketsByViewId?: Readonly<Record<string, AttentionBucketV0>>
  source?: { kind: string; label: string }
  runtime?: ContextSurfaceRuntime
  onSelect: (id: string, additive?: boolean) => void
  onMarqueeSelect?: (ids: string[], additive: boolean) => void
  onDoubleClick: (id: string) => void
  onImportProjectView?: (memberViewIds: readonly string[]) => string[]
  onDirectProjectViewDrop?: (targetViewId: string, sourceIds: readonly string[]) => void
  onSurfaceChange?: (surface: SurfaceId) => void
  focusRequest?: SpatialFocusRequest
}

function seedContextPlacement(nodes: readonly CanvasNode[]) {
  if (!nodes.length) return new Map<string, { x: number; y: number; width: number; height: number }>()
  const minX = Math.min(...nodes.map((node) => node.x))
  const minY = Math.min(...nodes.map((node) => node.y))
  const scale = .86
  return new Map(nodes.map((node) => {
    const mode = node.displayMode ?? (node.kind === 'note' ? 'standard' : 'standard')
    const dims = nodeDimensions(node.kind, mode)
    return [node.id, {
      x: 140 + (node.x - minX) * scale,
      y: 128 + (node.y - minY) * scale,
      width: dims.width,
      height: dims.height,
    }]
  }))
}

/**
 * Default saved-Context work scene.
 *
 * This is deliberately not a second Main canvas: membership is exact Saved
 * Context truth, relations are emphasized as reading aids, and the same objects
 * can be inspected through Structure / Evolution without cloning.
 */
export function ContextSpaceSurface(props: Props) {
  const [camera, setCamera] = useSpatialSessionCamera(props.projectId, props.scopeId, 'context-space', { x: 0, y: 0, zoom: 1 })
  const [draftPositions, setDraftPositions] = usePresentationDraftPositions(props.projectId, props.scopeId, 'context-space')
  const [pinnedIds, setPinnedIds] = usePresentationDraftPinnedIds(props.projectId, props.scopeId, 'context-space')
  const [surfaceElements, setSurfaceElements] = usePresentationSurfaceElements(props.projectId, props.scopeId, 'context-space')
  const [proposalOps, setProposalOps] = useState<readonly SurfaceOp[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const drag = useRef<SpatialPointerSession>(IDLE_SPATIAL_POINTER)
  const seed = useMemo(() => seedContextPlacement(props.nodes), [props.nodes])
  const items = useMemo(() => props.nodes.map((node) => {
    const fallback = seed.get(node.id) ?? { x: node.x, y: node.y, width: node.width, height: node.height }
    const point = draftPositions[node.id] ?? fallback
    return { node, x: point.x, y: point.y, width: fallback.width, height: fallback.height }
  }), [draftPositions, props.nodes, seed])
  const byId = useMemo(() => new Map(items.map((item) => [item.node.id, item])), [items])
  const spatialItems = useMemo(() => items.map((item) => ({ id: item.node.id, x: item.x, y: item.y, width: item.width, height: item.height })), [items])
  const selectedSurfaceBounds = useMemo(() => boundsAroundSurfaceRects(items
    .filter((item) => props.selectedIds.includes(item.node.id))
    .map((item) => ({ x: item.x, y: item.y, w: item.width, h: item.height })), 24), [items, props.selectedIds])
  const componentViewportOrigin = useMemo(() => surfaceViewportOrigin(camera), [camera])
  const proposalElements = useMemo(() => proposalOps.flatMap((op) => op.type === 'create-component' ? [op.component] : []), [proposalOps])
  const ids = useMemo(() => new Set(items.map((item) => item.node.id)), [items])
  const visibleEdges = useMemo(() => props.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)), [ids, props.edges])
  const hierarchySeed = useMemo(() => buildHierarchySeed(props.nodes, visibleEdges), [props.nodes, visibleEdges])
  const [hierarchy] = usePresentationHierarchyState(props.projectId, props.scopeId, 'context-space', hierarchySeed, props.nodes)
  const understandingRegions = useMemo(() => contextUnderstandingRegions(hierarchy, items), [hierarchy, items])
  const edgeBounds = useMemo(() => spatialBoundsForPlacements(spatialItems, 160), [spatialItems])
  useSpatialFocusRequest({ request: props.focusRequest, items: spatialItems, testId: 'context-space-spatial', setCamera })

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (event.button !== 0) return
    const item = byId.get(id)
    if (!item) return
    drag.current = beginSpatialNodeDrag(event.pointerId, id, { x: event.clientX, y: event.clientY }, { x: item.x, y: item.y })
    setDraggingId(id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const next = advanceSpatialNodeDrag(drag.current, { x: event.clientX, y: event.clientY }, camera.zoom)
    if (!next || drag.current.kind !== 'node-drag') return
    setDraftPositions((current) => ({ ...current, [drag.current.kind === 'node-drag' ? drag.current.id : '']: next }))
  }
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = drag.current
    if (session.kind === 'node-drag' && event.defaultPrevented) setDraftPositions((current) => ({ ...current, [session.id]: session.origin }))
    else if (session.kind === 'node-drag') setPinnedIds((current) => current.includes(session.id) ? current : [...current, session.id])
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    drag.current = endSpatialPointer()
    setDraggingId(null)
  }

  const previewIntent = (intent: SurfaceIntent) => {
    const ops = resolveSurfaceIntent(intent, { projectId: props.projectId, surface: 'context', existing: surfaceElements, selectionBounds: selectedSurfaceBounds, viewportOrigin: componentViewportOrigin })
    setProposalOps(validateSurfaceOps(surfaceElements, ops).ok ? ops : [])
  }
  const keepProposal = () => { setSurfaceElements(applySurfaceOps(surfaceElements, proposalOps)); setProposalOps([]) }

  const overlay = <>
    {!items.length && <div className="lcos-context-space-empty"><Layers3 size={19}/><strong>把需要一起理解的材料拖进来</strong><span>可以直接阅读、摘取、组织，放进来的材料就在这里一起被理解。</span></div>}
    <SurfaceComponentShelf projectId={props.projectId} surface="context" elements={surfaceElements} selectionIds={props.selectedIds} selectionBounds={selectedSurfaceBounds} viewportOrigin={componentViewportOrigin} onElementsChange={setSurfaceElements}/>
    <AgentSurfaceComposer surface="context" targetIds={props.selectedIds} previewing={proposalOps.length > 0} onPreview={previewIntent} onKeep={keepProposal} onRevert={() => setProposalOps([])}/>
  </>

  return <section className="lcos-dedicated-surface lcos-context-space" data-testid="surface-context-space">
    <header className="lcos-surface-heading lcos-context-space-heading">
      <div><strong>上下文</strong><span>理解现场</span></div>
      <div className="lcos-context-heading-actions"><small>{items.length} 项 · 同一份 Context</small><ContextLensSwitch active="context-space" onSelect={props.onSurfaceChange}/></div>
    </header>
    {props.source && <div className={`lcos-context-origin-chip source-${props.source.kind}`} title="这只是来源记录，不是操作入口"><i/><span>{props.source.label}</span><small>来源</small></div>}
    <SpatialCanvas camera={camera} setCamera={setCamera} marqueeItems={spatialItems} minimapItems={spatialItems} minimapLabel="Context" onMarqueeSelect={props.onMarqueeSelect} className="lcos-context-space-stage lcos-presentation-spatial" worldClassName="lcos-presentation-world lcos-context-space-world" testId="context-space-spatial" overlays={overlay} onPointerCancel={() => { drag.current = endSpatialPointer(); setDraggingId(null) }} onExternalDrop={(kind, raw, _screen, point) => {
      if (kind !== 'project-view' || !props.onImportProjectView) return
      try {
        const payload = JSON.parse(raw) as { memberViewIds?: unknown }
        const sourceIds = Array.isArray(payload.memberViewIds) ? payload.memberViewIds.filter((item): item is string => typeof item === 'string') : []
        const imported = props.onImportProjectView(sourceIds)
        if (imported.length) setDraftPositions((current) => ({ ...current, ...Object.fromEntries(imported.map((id, index) => [id, { x: point.x + (index % 3) * 236, y: point.y + Math.floor(index / 3) * 168 }])) }))
      } catch { /* malformed rail payload: ignore */ }
    }}>
      <div className="lcos-context-understanding-regions" aria-hidden="true">
        {understandingRegions.map((region) => <div key={region.id} className="lcos-context-understanding-region" style={{ left: region.x, top: region.y, width: region.width, height: region.height } as CSSProperties}><span>{region.label}</span><small>{region.memberIds.length} 项 · 结构区域</small></div>)}
      </div>
      <SurfaceComponentLayer surface="context" elements={surfaceElements} zoom={camera.zoom} renderContext={{ nodes: props.nodes, edges: visibleEdges, hierarchy, history: props.runtime?.history, onSelectNode: props.onSelect, onOpenNode: props.onDoubleClick, onOpenHistorySource: props.runtime?.onOpenHistorySource }} onElementsChange={setSurfaceElements}/>
      <SurfaceComponentProposalLayer surface="context" elements={proposalElements} renderContext={{ nodes: props.nodes, edges: visibleEdges, hierarchy, history: props.runtime?.history }}/>
      <SpatialEdgeLayer bounds={edgeBounds} className="lcos-context-space-edges" ariaLabel="Context 关系">
        <defs><marker id="lcos-context-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z"/></marker></defs>
        {visibleEdges.map((edge) => {
          const from = byId.get(edge.from), to = byId.get(edge.to)
          if (!from || !to) return null
          const x1 = from.x + from.width, y1 = from.y + from.height / 2, x2 = to.x, y2 = to.y + to.height / 2
          const m = x1 + (x2 - x1) * .5
          const directional = edge.kind !== 'reference'
          const relationText = edge.label?.trim() || (edge.kind === 'feedback' ? '反馈' : edge.kind === 'modify' ? '修改' : edge.kind === 'generate' ? '生成' : edge.kind === 'hierarchy' ? '结构' : '')
          const conflict = /conflict|contradict|block|冲突|否定|阻塞/i.test(`${edge.kind} ${edge.label ?? ''}`)
          return <g key={edge.id} className={`lcos-context-relation ${edge.active ? 'active' : ''} relation-${edge.kind} ${conflict ? 'is-conflict' : ''}`}>
            <path d={`M${x1} ${y1} C${m} ${y1},${m} ${y2},${x2} ${y2}`} markerEnd={directional ? 'url(#lcos-context-arrow)' : undefined}/>
            {relationText && <text x={m} y={(y1 + y2) / 2 - 7} textAnchor="middle">{relationText}</text>}
          </g>
        })}
      </SpatialEdgeLayer>
      <SpatialNodeLayer>
        {items.map((item, index) => <div key={item.node.id} className={`lcos-context-space-node lcos-spatial-placement ${props.selectedIds.includes(item.node.id) ? 'selected' : ''} ${draggingId === item.node.id ? 'is-dragging' : ''} ${pinnedIds.includes(item.node.id) ? 'is-manual-anchor' : ''}`} data-attention-bucket={props.attentionBucketsByViewId?.[item.node.id]} style={{ left: item.x, top: item.y, width: item.width, '--i': index } as CSSProperties} onPointerDown={(event) => beginDrag(event, item.node.id)} onPointerMove={moveDrag} onPointerUp={endDrag}>
          <SurfaceObject node={item.node} selected={props.selectedIds.includes(item.node.id)} usageHint={item.node.anchors?.length ? '来源锚点' : undefined} attentionBucket={props.attentionBucketsByViewId?.[item.node.id] === 'pinned' ? 'pinned' : props.attentionBucketsByViewId?.[item.node.id] === 'related' ? 'related' : props.attentionBucketsByViewId?.[item.node.id] === 'retrieved' ? 'retrieved' : undefined} dropIds={props.selectedIds.includes(item.node.id) && props.selectedIds.length ? props.selectedIds : [item.node.id]} onDirectProjectViewDrop={props.onDirectProjectViewDrop} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/>
          {pinnedIds.includes(item.node.id) && <i className="lcos-manual-anchor-mark" title="手工位置锚点"/>}
        </div>)}
      </SpatialNodeLayer>
    </SpatialCanvas>
    {props.runtime && <ContextHistoryRail history={props.runtime.history} handoffs={props.runtime.handoffs} onBranch={props.runtime.onBranchHistory} onCompare={props.runtime.onCompareHistory} onSource={props.runtime.onOpenHistorySource}/>}
  </section>
}
