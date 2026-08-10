import { Bot, GripVertical, Link2, MessageSquareText, MousePointer2, RotateCcw, Route, Link2Off } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { CanvasEdge, CanvasNode } from '../../model'
import { applyContextStrandPositions, layoutContextStrands } from '../presentation/contextStrands'
import { SpatialCanvas } from '../spatial/SpatialCanvas'
import { SpatialEdgeLayer } from '../spatial/SpatialEdgeLayer'
import { SpatialNodeLayer } from '../spatial/SpatialNodeLayer'
import { spatialBoundsForPlacements } from '../spatial/spatialCamera'
import { advanceSpatialNodeDrag, beginSpatialNodeDrag, endSpatialPointer } from '../spatial/spatialInteractionMachine'
import { IDLE_SPATIAL_POINTER, type SpatialPointerSession } from '../spatial/spatialTypes'
import { usePresentationDraftEdges, usePresentationDraftHiddenIds, usePresentationDraftPositions } from '../../state/presentationDraftState'
import { useSpatialSessionCamera } from '../../state/spatialSessionState'
import type { ContextSurfaceRuntime } from './surfaceContracts'
import { SurfaceObject } from './SurfaceObject'

interface Props {
  projectId: string
  scopeId: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  selectedIds: string[]
  source: { kind: string; label: string }
  runtime?: ContextSurfaceRuntime
  onSelect: (id: string, additive?: boolean) => void
  onDoubleClick: (id: string) => void
  onStart?: (kind: 'conversation' | 'selection' | 'agent') => void
}

const SOURCE_WIDTH = 194
const SOURCE_HEIGHT = 62

/**
 * Context Strands are Presentation-only parallel chains over the current Context membership.
 * Cutting/splicing changes this renderer draft only; Canonical Relation never changes here.
 */
export function ContextFlowSurface(props: Props) {
  const [camera, setCamera] = useSpatialSessionCamera(props.projectId, props.scopeId, 'context-flow', { x: 0, y: 0, zoom: 1 })
  const [sourcePositions, setSourcePositions] = usePresentationDraftPositions(props.projectId, props.scopeId, 'context-flow-sources')
  const [strandPositions, setStrandPositions] = usePresentationDraftPositions(props.projectId, props.scopeId, 'context-flow-strands')
  const [hiddenEdgeIds, setHiddenEdgeIds] = usePresentationDraftHiddenIds(props.projectId, props.scopeId, 'context-flow-edge-cuts')
  const [temporaryEdges, setTemporaryEdges] = usePresentationDraftEdges(props.projectId, props.scopeId, 'context-flow-temp-edges', [])
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const sourceDrag = useRef<SpatialPointerSession>(IDLE_SPATIAL_POINTER)
  const strandDrag = useRef<SpatialPointerSession>(IDLE_SPATIAL_POINTER)

  const nodeIds = useMemo(() => new Set(props.nodes.map((node) => node.id)), [props.nodes])
  const canonicalEdges = useMemo(() => props.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)), [nodeIds, props.edges])
  const presentationEdges = useMemo(() => temporaryEdges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)), [nodeIds, temporaryEdges])
  const effectiveEdges = useMemo(() => [...canonicalEdges.filter((edge) => !hiddenEdgeIds.includes(edge.id)), ...presentationEdges], [canonicalEdges, hiddenEdgeIds, presentationEdges])
  const rawLayout = useMemo(() => layoutContextStrands(props.nodes, effectiveEdges), [effectiveEdges, props.nodes])
  const layout = useMemo(() => applyContextStrandPositions(rawLayout, strandPositions), [rawLayout, strandPositions])
  const itemById = useMemo(() => new Map(layout.items.map((item) => [item.node.id, item])), [layout.items])
  const strandByObject = useMemo(() => {
    const map = new Map<string, number>()
    layout.strands.forEach((strand) => strand.objectIds.forEach((id) => map.set(id, strand.index)))
    return map
  }, [layout.strands])

  const sources = useMemo(() => {
    const base = props.runtime?.history.length
      ? props.runtime.history.map((entry) => ({ id: entry.id, label: entry.title || entry.label, summary: entry.summary || `${entry.objectIds.length} 个关联对象`, objectIds: entry.objectIds, createdAt: entry.createdAt }))
      : props.source.kind !== 'empty'
        ? [{ id: `temporary:${props.source.kind}`, label: props.source.label, summary: 'Temporary Context Presentation', objectIds: props.nodes.map((node) => node.id), createdAt: undefined }]
        : []
    return base.map((source, index) => {
      const strandIndexes = source.objectIds.map((id) => strandByObject.get(id)).filter((value): value is number => value !== undefined)
      const targetStrand = strandIndexes.length ? Math.min(...strandIndexes) : index % Math.max(1, layout.strands.length)
      const band = layout.strands[targetStrand]
      const fallbackY = band ? band.y + Math.min(28, band.height / 3) : 126 + index * 106
      return { ...source, x: 66, y: fallbackY }
    })
  }, [layout.strands, props.nodes, props.runtime?.history, props.source.kind, props.source.label, strandByObject])
  const placedSources = sources.map((source) => ({ ...source, ...(sourcePositions[source.id] ?? { x: source.x, y: source.y }) }))
  const sourceLinks = placedSources.flatMap((source) => source.objectIds.slice(0, 6).flatMap((id) => {
    const item = itemById.get(id)
    if (!item) return []
    const sx = source.x + SOURCE_WIDTH, sy = source.y + SOURCE_HEIGHT / 2, tx = item.x, ty = item.y + item.height / 2
    const m = Math.max(sx + 52, sx + (tx - sx) * .46)
    return [{ id: `${source.id}:${id}`, d: `M ${sx} ${sy} C ${m} ${sy}, ${m} ${ty}, ${tx} ${ty}` }]
  }))
  const edgeBounds = spatialBoundsForPlacements([
    ...layout.items.map((item) => ({ x: item.x, y: item.y, width: item.width, height: item.height })),
    ...placedSources.map((source) => ({ x: source.x, y: source.y, width: SOURCE_WIDTH, height: SOURCE_HEIGHT })),
  ], 200)

  const selectedPresentationEdge = effectiveEdges.find((edge) => edge.id === selectedEdgeId) ?? null
  const selectedContextIds = props.selectedIds.filter((id) => nodeIds.has(id))
  const canSplice = selectedContextIds.length === 2

  const spliceSelection = () => {
    if (!canSplice) return
    const [from, to] = selectedContextIds
    if (!from || !to || from === to) return
    const canonical = canonicalEdges.find((edge) => (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from))
    if (canonical && hiddenEdgeIds.includes(canonical.id)) {
      setHiddenEdgeIds((current) => current.filter((id) => id !== canonical.id))
      setSelectedEdgeId(canonical.id)
      return
    }
    const existing = effectiveEdges.find((edge) => (edge.from === from && edge.to === to) || (edge.from === to && edge.to === from))
    if (existing) { setSelectedEdgeId(existing.id); return }
    const edge: CanvasEdge = { id: `context-temp:${Date.now()}:${from}:${to}`, from, to, kind: 'reference' }
    setTemporaryEdges((current) => [...current, edge])
    setSelectedEdgeId(edge.id)
  }

  const cutSelectedEdge = () => {
    if (!selectedPresentationEdge) return
    if (selectedPresentationEdge.id.startsWith('context-temp:')) setTemporaryEdges((current) => current.filter((edge) => edge.id !== selectedPresentationEdge.id))
    else setHiddenEdgeIds((current) => current.includes(selectedPresentationEdge.id) ? current : [...current, selectedPresentationEdge.id])
    setSelectedEdgeId(null)
  }

  const resetStrandPresentation = () => {
    setHiddenEdgeIds([])
    setTemporaryEdges([])
    setStrandPositions({})
    setSelectedEdgeId(null)
  }

  const beginSourceDrag = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const origin = sourcePositions[id] ?? placedSources.find((source) => source.id === id) ?? { x: 0, y: 0 }
    sourceDrag.current = beginSpatialNodeDrag(event.pointerId, id, { x: event.clientX, y: event.clientY }, { x: origin.x, y: origin.y })
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveSourceDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = sourceDrag.current
    if (session.kind !== 'node-drag') return
    event.stopPropagation()
    const next = advanceSpatialNodeDrag(session, { x: event.clientX, y: event.clientY }, camera.zoom)
    if (next) setSourcePositions((current) => ({ ...current, [session.id]: next }))
  }
  const endSourceDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (sourceDrag.current.kind !== 'node-drag') return
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    sourceDrag.current = endSpatialPointer()
  }

  const beginStrandDrag = (event: ReactPointerEvent<HTMLButtonElement>, strandId: string) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const strand = layout.strands.find((item) => item.id === strandId)
    if (!strand) return
    strandDrag.current = beginSpatialNodeDrag(event.pointerId, strandId, { x: event.clientX, y: event.clientY }, { x: strand.x, y: strand.y })
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveStrandDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const session = strandDrag.current
    if (session.kind !== 'node-drag') return
    event.stopPropagation()
    const next = advanceSpatialNodeDrag(session, { x: event.clientX, y: event.clientY }, camera.zoom)
    if (next) setStrandPositions((current) => ({ ...current, [session.id]: next }))
  }
  const endStrandDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (strandDrag.current.kind !== 'node-drag') return
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    strandDrag.current = endSpatialPointer()
  }

  const emptyOverlay = !layout.items.length ? <div className="lcos-context-free-empty"><MessageSquareText size={18}/><strong>选择这次要找回的协作来源</strong><span>上下文不会自动把整个项目拼成历史。可以并列打开多条对话、使用当前 Selection，或让 Agent 临时组织。</span><div className="lcos-context-start-actions"><button type="button" onClick={() => props.onStart?.('conversation')}><MessageSquareText size={12}/>添加对话</button><button type="button" disabled={!props.selectedIds.length} onClick={() => props.onStart?.('selection')}><MousePointer2 size={12}/>当前 Selection</button><button type="button" onClick={() => props.onStart?.('agent')}><Bot size={12}/>让 Agent 组织</button></div></div> : undefined

  return <section className="lcos-dedicated-surface lcos-context-free" data-testid="surface-context-flow">
    <header className="lcos-surface-heading lcos-context-strands-heading">
      <div><strong>上下文</strong><span>Context Strands</span></div>
      <div className="lcos-strand-controls">
        <small>{layout.strands.length} 条关系链 · 可并行，不强制单时间线</small>
        <button type="button" disabled={!canSplice} title="用两个选中对象建立 Presentation-only 临时因果边" onClick={spliceSelection}><Link2 size={11}/>拼接 Selection</button>
        <button type="button" disabled={!selectedPresentationEdge} title="仅从当前 Context Presentation 剪开，不删除 Canonical Relation" onClick={cutSelectedEdge}><Link2Off size={11}/>剪开</button>
        {(hiddenEdgeIds.length > 0 || temporaryEdges.length > 0 || Object.keys(strandPositions).length > 0) && <button type="button" className="quiet" title="重置当前 Strand 的临时结构与位置" onClick={resetStrandPresentation}><RotateCcw size={11}/>重置</button>}
      </div>
    </header>
    <details className={`lcos-capability-source source-${props.source.kind}`}>
      <summary><i/><strong>{props.source.label}</strong><small>Presentation 来源</small></summary>
      <div><span>Context Source</span><small>切换来源只改当前视图，不会把 Selection 静默写成成员。</small><nav><button type="button" onClick={() => props.onStart?.('conversation')}><MessageSquareText size={11}/>对话</button><button type="button" disabled={!props.selectedIds.length} onClick={() => props.onStart?.('selection')}><MousePointer2 size={11}/>Selection</button><button type="button" onClick={() => props.onStart?.('agent')}><Bot size={11}/>Agent</button></nav></div>
    </details>
    <SpatialCanvas camera={camera} setCamera={setCamera} className="lcos-context-free-stage lcos-presentation-spatial" worldClassName="lcos-presentation-world lcos-context-strands-world" worldStyle={{ width: layout.width, height: layout.height }} testId="context-flow-spatial" overlays={emptyOverlay} onPointerUp={() => { sourceDrag.current = endSpatialPointer(); strandDrag.current = endSpatialPointer() }} onPointerCancel={() => { sourceDrag.current = endSpatialPointer(); strandDrag.current = endSpatialPointer() }}>
      <SpatialEdgeLayer bounds={edgeBounds} className="lcos-context-free-edges" ariaLabel="上下文关系">
        {layout.edges.map(({ edge, points }) => <path key={edge.id} d={points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')} className={`${edge.active ? 'active' : ''} ${edge.id.startsWith('context-temp:') ? 'presentation-edge' : ''} ${selectedEdgeId === edge.id ? 'selected' : ''}`} onClick={(event) => { event.stopPropagation(); setSelectedEdgeId(edge.id) }}/>) }
        <g className="lcos-context-source-links">{sourceLinks.map((link) => <path key={link.id} d={link.d}/>)}</g>
      </SpatialEdgeLayer>
      <SpatialNodeLayer>
        {layout.strands.map((strand) => <div key={strand.id} className={`lcos-context-strand-band ${strandPositions[strand.id] ? 'is-manual-anchor' : ''}`} style={{ left: strand.x, top: strand.y, width: strand.width, height: strand.height } as CSSProperties}><button type="button" className="lcos-context-strand-handle" aria-label={`移动 strand ${strand.index + 1}`} title="移动这条 Presentation Strand" onPointerDown={(event) => beginStrandDrag(event, strand.id)} onPointerMove={moveStrandDrag} onPointerUp={endStrandDrag} onPointerCancel={endStrandDrag}><GripVertical size={10}/><span>strand {String(strand.index + 1).padStart(2, '0')}</span></button></div>)}
        {placedSources.map((source, index) => {
          const history = props.runtime?.history.find((entry) => entry.id === source.id)
          return <div key={source.id} className="lcos-context-source-object lcos-spatial-placement" style={{ left: source.x, top: source.y, width: SOURCE_WIDTH, '--i': index } as CSSProperties} onPointerDown={(event) => beginSourceDrag(event, source.id)} onPointerMove={moveSourceDrag} onPointerUp={endSourceDrag} onPointerCancel={endSourceDrag} onDoubleClick={() => history && props.runtime?.onOpenHistorySource(history)}>
            <span className="lcos-context-source-icon"><MessageSquareText size={14}/></span><div><strong>{source.label}</strong><small>{source.summary}</small><p>{source.createdAt ? new Date(source.createdAt).toLocaleString() : '当前临时组织'} · {source.objectIds.length} objects</p></div><Route size={12}/>
          </div>
        })}
        {layout.items.map(({ node, x, y, width, strand }, index) => <div key={node.id} className="lcos-context-free-node lcos-spatial-placement" data-strand={strand} style={{ left: x, top: y, width, '--i': index } as CSSProperties}><SurfaceObject node={node} compact selected={props.selectedIds.includes(node.id)} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/></div>)}
      </SpatialNodeLayer>
    </SpatialCanvas>
  </section>
}
