import { Filter, Orbit, PinOff } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { CanvasEdge, CanvasNode } from '../../model'
import { layoutPreviewSync, layoutPreview } from '../layout/layoutService'
import type { LayoutPosition } from '../layout/layoutTypes'
import { loadPresentationLayoutEngines } from '../layout/layoutEngines'
import { buildLocalRelationNodes, relationCurvePath } from '../presentation/relationGraphModel'
import { SpatialCanvas } from '../spatial/SpatialCanvas'
import { SpatialEdgeLayer } from '../spatial/SpatialEdgeLayer'
import { SpatialNodeLayer } from '../spatial/SpatialNodeLayer'
import { advanceSpatialNodeDrag, beginSpatialNodeDrag, endSpatialPointer } from '../spatial/spatialInteractionMachine'
import { IDLE_SPATIAL_POINTER, type SpatialPointerSession } from '../spatial/spatialTypes'
import { usePresentationDraftPinnedIds, usePresentationDraftPositions } from '../../state/presentationDraftState'
import { useSpatialSessionCamera } from '../../state/spatialSessionState'
import { useProjectionLayoutState } from '../../state/projectionLayoutState'
import { ContextHistoryRail } from './ContextHistoryRail'
import type { ContextSurfaceRuntime } from './surfaceContracts'
import { SurfaceObject } from './SurfaceObject'

interface Props {
  projectId: string
  scopeId: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  selectedIds: string[]
  source?: { kind: string; label: string }
  runtime?: ContextSurfaceRuntime
  onSelect: (id: string, additive?: boolean) => void
  onDoubleClick: (id: string) => void
}

type Dot = { node: CanvasNode; x: number; y: number; px: number; py: number; ring: 0 | 1 | 2 }
const WORLD_WIDTH = 1200
const WORLD_HEIGHT = 760
const NODE_WIDTH = 126
const NODE_HEIGHT = 50

export function ContextGraphSurface(props: Props) {
  const [camera, setCamera] = useSpatialSessionCamera(props.projectId, props.scopeId, 'context-graph', { x: 0, y: 0, zoom: 1 })
  const availableRelationKinds = useMemo<CanvasEdge['kind'][]>(() => Array.from(new Set(props.edges.map((edge) => edge.kind))), [props.edges])
  const [state, setState] = useProjectionLayoutState(props.projectId, props.scopeId, 'context-graph', { hops: 1, relationKinds: availableRelationKinds })
  const [draftPositions, setDraftPositions] = usePresentationDraftPositions(props.projectId, props.scopeId, 'context-graph')
  const [pinnedIds, setPinnedIds] = usePresentationDraftPinnedIds(props.projectId, props.scopeId, 'context-graph')
  const drag = useRef<SpatialPointerSession>(IDLE_SPATIAL_POINTER)
  const activeRelationKinds = useMemo(() => {
    const saved = state.relationKinds.filter((kind): kind is CanvasEdge['kind'] => availableRelationKinds.includes(kind as CanvasEdge['kind']))
    return saved.length || !availableRelationKinds.length ? saved : availableRelationKinds
  }, [availableRelationKinds, state.relationKinds])
  const filteredEdges = useMemo(() => props.edges.filter((edge) => activeRelationKinds.includes(edge.kind)), [activeRelationKinds, props.edges])
  const localNodes = useMemo(() => buildLocalRelationNodes(props.nodes, filteredEdges, props.selectedIds, state.hops), [filteredEdges, props.nodes, props.selectedIds, state.hops])
  const focusIds = useMemo(() => new Set(localNodes.filter((item) => item.ring === 0).map((item) => item.node.id)), [localNodes])

  const seeds = useMemo(() => {
    if (!localNodes.length) return []
    const ringCounts = new Map<number, number>()
    localNodes.forEach((item) => ringCounts.set(item.ring, (ringCounts.get(item.ring) ?? 0) + 1))
    const ringIndex = new Map<number, number>()
    return localNodes.map((item) => {
      const index = ringIndex.get(item.ring) ?? 0
      ringIndex.set(item.ring, index + 1)
      const count = ringCounts.get(item.ring) ?? 1
      const radiusX = item.ring === 0 ? Math.min(120, Math.max(0, (count - 1) * 58)) : item.ring === 1 ? 280 : 455
      const radiusY = item.ring === 0 ? 0 : item.ring === 1 ? 220 : 320
      const angle = item.ring === 0 ? 0 : (index / Math.max(1, count)) * Math.PI * 2 - .5
      const centerX = item.ring === 0 ? WORLD_WIDTH / 2 + (index - (count - 1) / 2) * 142 : WORLD_WIDTH / 2 + Math.cos(angle) * radiusX
      const centerY = item.ring === 0 ? WORLD_HEIGHT / 2 : WORLD_HEIGHT / 2 + Math.sin(angle) * radiusY
      const manual = draftPositions[item.node.id]
      return {
        item,
        x: manual?.x ?? centerX - NODE_WIDTH / 2,
        y: manual?.y ?? centerY - NODE_HEIGHT / 2,
        pinned: focusIds.has(item.node.id) || pinnedIds.includes(item.node.id),
      }
    })
  }, [draftPositions, focusIds, localNodes, pinnedIds])

  const builtinDots = useMemo<Dot[]>(() => {
    if (!seeds.length) return []
    const ids = new Set(seeds.map((seed) => seed.item.node.id))
    const result = layoutPreviewSync({
      strategy: 'relational',
      nodes: seeds.map((seed) => ({ id: seed.item.node.id, x: seed.x, y: seed.y, width: NODE_WIDTH, height: NODE_HEIGHT, pinned: seed.pinned })),
      edges: filteredEdges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)),
      gap: 28,
      componentGap: 96,
      origin: { x: WORLD_WIDTH * .14, y: WORLD_HEIGHT * .12 },
      preserveManualAnchors: true,
    })
    const positions = new Map(result.positions.map((position) => [position.id, position]))
    return seeds.map((seed) => {
      const point = positions.get(seed.item.node.id) ?? seed
      return { node: seed.item.node, ring: seed.item.ring, px: point.x, py: point.y, x: point.x + NODE_WIDTH / 2, y: point.y + NODE_HEIGHT / 2 }
    })
  }, [filteredEdges, seeds])

  const [enginePositions, setEnginePositions] = useState<ReadonlyMap<string, LayoutPosition> | null>(null)
  useEffect(() => {
    if (!seeds.length) return
    let cancelled = false
    setEnginePositions(null)
    const ids = new Set(seeds.map((seed) => seed.item.node.id))
    const request = {
      strategy: 'relational' as const,
      nodes: seeds.map((seed) => ({ id: seed.item.node.id, x: seed.x, y: seed.y, width: NODE_WIDTH, height: NODE_HEIGHT, pinned: seed.pinned })),
      edges: filteredEdges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)),
      gap: 28,
      componentGap: 96,
      origin: { x: WORLD_WIDTH * .14, y: WORLD_HEIGHT * .12 },
      preserveManualAnchors: true,
    }
    void loadPresentationLayoutEngines()
      .then((engines) => (engines.relational === undefined ? null : layoutPreview(request, { relational: engines.relational })))
      .then((result) => {
        if (cancelled || result === null) return
        setEnginePositions(new Map(result.positions.map((position) => [position.id, position])))
      })
      .catch(() => { /* builtin dots remain the stable fallback */ })
    return () => { cancelled = true }
  }, [filteredEdges, seeds])

  const dots = useMemo<Dot[]>(() => {
    if (!seeds.length) return []
    const positions = enginePositions ?? new Map(builtinDots.map((dot) => [dot.node.id, { x: dot.px, y: dot.py }]))
    return seeds.map((seed) => {
      const point = positions.get(seed.item.node.id) ?? seed
      return { node: seed.item.node, ring: seed.item.ring, px: point.x, py: point.y, x: point.x + NODE_WIDTH / 2, y: point.y + NODE_HEIGHT / 2 }
    })
  }, [builtinDots, enginePositions, seeds])

  const ids = useMemo(() => new Set(dots.map((dot) => dot.node.id)), [dots])
  const pos = useMemo(() => new Map(dots.map((dot) => [dot.node.id, dot])), [dots])
  const visibleEdges = useMemo(() => filteredEdges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)), [filteredEdges, ids])
  const edgeGroups = useMemo(() => {
    const groups = new Map<string, CanvasEdge[]>()
    visibleEdges.forEach((edge) => {
      const key = [edge.from, edge.to].sort().join('::')
      groups.set(key, [...(groups.get(key) ?? []), edge])
    })
    return groups
  }, [visibleEdges])

  const toggleKind = (kind: CanvasEdge['kind']) => setState((current) => {
    const source = current.relationKinds.filter((item): item is CanvasEdge['kind'] => availableRelationKinds.includes(item as CanvasEdge['kind']))
    const base = source.length ? source : availableRelationKinds
    return { ...current, relationKinds: base.includes(kind) ? base.filter((item) => item !== kind) : [...base, kind] }
  })
  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>, dot: Dot) => {
    if (event.button !== 0) return
    event.stopPropagation()
    drag.current = beginSpatialNodeDrag(event.pointerId, dot.node.id, { x: event.clientX, y: event.clientY }, { x: dot.px, y: dot.py })
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = drag.current
    if (session.kind !== 'node-drag') return
    event.stopPropagation()
    const next = advanceSpatialNodeDrag(session, { x: event.clientX, y: event.clientY }, camera.zoom)
    if (next) setDraftPositions((current) => ({ ...current, [session.id]: next }))
  }
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = drag.current
    if (session.kind !== 'node-drag') return
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setPinnedIds((current) => current.includes(session.id) ? current : [...current, session.id])
    drag.current = endSpatialPointer()
  }

  const orbit = <div className="lcos-graph-orbit" aria-hidden="true"><Orbit size={15}/><span>{dots.length} local objects · {focusIds.size} center</span></div>
  return <section className="lcos-dedicated-surface lcos-context-graph" data-testid="surface-context-graph">
    <header className="lcos-surface-heading">
      <div><strong>上下文</strong><span>局部关系</span></div>
      <div className="lcos-graph-controls">
        <button type="button" className={state.hops === 1 ? 'active' : ''} onClick={() => setState((current) => ({ ...current, hops: 1 }))}>1 hop</button>
        <button type="button" className={state.hops === 2 ? 'active' : ''} onClick={() => setState((current) => ({ ...current, hops: 2 }))}>2 hops</button>
        {pinnedIds.length > 0 && <button type="button" title="解除手工关系图锚点" onClick={() => { setPinnedIds([]); setDraftPositions({}) }}><PinOff size={11}/>{pinnedIds.length}</button>}
        <details><summary title="关系筛选"><Filter size={12}/></summary><div>{availableRelationKinds.map((kind) => <label key={kind}><input type="checkbox" checked={activeRelationKinds.includes(kind)} onChange={() => toggleKind(kind)}/><span>{kind}</span></label>)}</div></details>
      </div>
    </header>
    {props.source && <div className={`lcos-renderer-source source-${props.source.kind}`}><i/><span>{props.source.label}</span><small>Selection 只决定 Local Graph center</small></div>}
    <SpatialCanvas camera={camera} setCamera={setCamera} className="lcos-graph-stage lcos-presentation-spatial" worldClassName="lcos-presentation-world" testId="context-graph-spatial" overlays={orbit} onPointerUp={() => { drag.current = endSpatialPointer() }} onPointerCancel={() => { drag.current = endSpatialPointer() }}>
      <SpatialEdgeLayer bounds={{ x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT }} className="lcos-graph-edges" ariaLabel="局部关系">
        {visibleEdges.map((edge) => {
          const a = pos.get(edge.from), b = pos.get(edge.to)
          if (!a || !b) return null
          const group = edgeGroups.get([edge.from, edge.to].sort().join('::')) ?? [edge]
          return <path key={edge.id} d={relationCurvePath({ x: a.x, y: a.y }, { x: b.x, y: b.y }, group.indexOf(edge), group.length)} className={`${edge.active ? 'active' : ''} ${focusIds.has(edge.from) || focusIds.has(edge.to) ? 'focus-edge' : 'secondary-edge'}`}/>
        })}
      </SpatialEdgeLayer>
      <SpatialNodeLayer>
        <div className="lcos-graph-ring ring-1" aria-hidden="true"/><div className="lcos-graph-ring ring-2" aria-hidden="true"/>
        {dots.map((dot, index) => <div key={dot.node.id} className={`lcos-graph-dot ring-${dot.ring} ${pinnedIds.includes(dot.node.id) ? 'is-manual-anchor' : ''}`} style={{ left: dot.x, top: dot.y, '--i': index } as CSSProperties} onPointerDown={(event) => beginDrag(event, dot)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
          <SurfaceObject node={dot.node} glyph dim={dot.ring === 2} selected={props.selectedIds.includes(dot.node.id)} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/>
          {pinnedIds.includes(dot.node.id) && <i className="lcos-manual-anchor-mark" title="Relation Graph 手工锚点"/>}
        </div>)}
      </SpatialNodeLayer>
    </SpatialCanvas>
    {props.runtime && <ContextHistoryRail history={props.runtime.history} handoffs={props.runtime.handoffs} onBranch={props.runtime.onBranchHistory} onCompare={props.runtime.onCompareHistory} onSource={props.runtime.onOpenHistorySource}/>} 
  </section>
}
