import { ArrowDown, ArrowUp, ChevronRight, Crosshair, GripVertical, Plus, Scissors, Waves, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { CanvasNode } from '../../model'
import { layoutContextStrands } from '../presentation/contextStrands'
import { SpatialCanvas } from '../spatial/SpatialCanvas'
import { SpatialEdgeLayer } from '../spatial/SpatialEdgeLayer'
import { SpatialNodeLayer } from '../spatial/SpatialNodeLayer'
import { fitSpatialBounds, spatialBoundsForPlacements } from '../spatial/spatialCamera'
import { advanceSpatialNodeDrag, beginSpatialNodeDrag, endSpatialPointer } from '../spatial/spatialInteractionMachine'
import { IDLE_SPATIAL_POINTER, type SpatialPointerSession } from '../spatial/spatialTypes'
import { usePresentationDraftPositions } from '../../state/presentationDraftState'
import { useContextTrackState } from '../../state/presentationTrackState'
import { useSpatialSessionCamera } from '../../state/spatialSessionState'
import { useSpatialFocusRequest, type SpatialFocusRequest } from '../spatial/useSpatialFocusRequest'
import { addTrackSegmentMembers, createSegmentsFromStrands, ensureTrackSegmentsCoverMembers, insertTrackSegment, mergeTrackSegments, removeTrackSegmentMember, reorderTrackSegment, splitTrackSegment, toggleTrackSegmentCollapsed, trackSegmentDensity } from '../context/trackSegments'
import type { ContextSurfaceRuntime } from './surfaceContracts'
import { ContextLensSwitch } from './ContextLensSwitch'
import type { SurfaceId } from '../shell/SurfaceDock'
import { SurfaceObject } from './SurfaceObject'

interface Props {
  projectId: string
  scopeId: string
  nodes: CanvasNode[]
  edges: import('../../model').CanvasEdge[]
  selectedIds: string[]
  source: { kind: string; label: string }
  runtime?: ContextSurfaceRuntime
  onSelect: (id: string, additive?: boolean) => void
  onMarqueeSelect?: (ids: string[], additive: boolean) => void
  onDoubleClick: (id: string) => void
  onStart?: (kind: 'conversation' | 'selection' | 'agent') => void
  onImportProjectView?: (memberViewIds: readonly string[]) => string[]
  onRemoveMember?: (memberViewId: string) => void
  onDirectProjectViewDrop?: (targetViewId: string, sourceIds: readonly string[]) => void
  onSurfaceChange?: (surface: SurfaceId) => void
  focusRequest?: SpatialFocusRequest
}

interface SegmentPlacement {
  id: string
  x: number
  y: number
  width: number
  height: number
  memberIds: string[]
  collapsed: boolean
}

const WORLD_WIDTH = 1480
const SPINE_X = 188
const SEGMENT_X = 226
const SEGMENT_WIDTH = 232
const CHILD_X = 510
const CHILD_WIDTH = 190
const CHILD_HEIGHT = 68
const CHILD_GAP_X = 28
const CHILD_GAP_Y = 22
const TOP = 112
const SEGMENT_GAP = 34

function segmentHeight(memberCount: number, collapsed: boolean) {
  if (collapsed) return 84
  const columns = memberCount > 6 ? 3 : 2
  const rows = Math.max(1, Math.ceil(memberCount / columns))
  return Math.max(128, 58 + rows * (CHILD_HEIGHT + CHILD_GAP_Y))
}

function waveform(count: number) {
  const bars = Math.max(8, Math.min(14, count + 7))
  return Array.from({ length: bars }, (_, index) => 24 + ((index * 23 + count * 17) % 68))
}

function moveSegmentBefore<T extends { id: string; order: number }>(segments: readonly T[], sourceId: string, targetId: string): T[] {
  if (sourceId === targetId) return [...segments]
  const source = segments.find((segment) => segment.id === sourceId)
  const targetIndex = segments.findIndex((segment) => segment.id === targetId)
  if (!source || targetIndex < 0) return [...segments]
  const rest = segments.filter((segment) => segment.id !== sourceId)
  const nextIndex = Math.max(0, rest.findIndex((segment) => segment.id === targetId))
  rest.splice(nextIndex, 0, source)
  return rest.map((segment, order) => ({ ...segment, order }))
}

/**
 * Context Signal Track.
 *
 * The vertical spine expresses explicit context order, not time. Existing
 * trackSegments remain the durable Presentation state. Relation strands are
 * used only once as a mechanical seed; they are no longer the renderer model.
 */
export function ContextFlowSurface(props: Props) {
  const [camera, setCamera] = useSpatialSessionCamera(props.projectId, props.scopeId, 'context-flow', { x: 0, y: 0, zoom: 1 })
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const checkedInitialVisibility = useRef<string | null>(null)
  const [localPositions, setLocalPositions] = usePresentationDraftPositions(props.projectId, props.scopeId, 'context-flow-local')
  const childDrag = useRef<SpatialPointerSession>(IDLE_SPATIAL_POINTER)
  const [draggedSegmentId, setDraggedSegmentId] = useState<string | null>(null)
  const [receivingSegmentId, setReceivingSegmentId] = useState<string | null>(null)
  const [receivingInsertionIndex, setReceivingInsertionIndex] = useState<number | null>(null)

  const nodeById = useMemo(() => new Map(props.nodes.map((node) => [node.id, node])), [props.nodes])
  const mechanicalSeed = useMemo(() => createSegmentsFromStrands(layoutContextStrands(props.nodes, props.edges).strands), [props.edges, props.nodes])
  const [segments, setSegments] = useContextTrackState(props.projectId, props.scopeId, mechanicalSeed)
  const normalizedSegments = useMemo(() => ensureTrackSegmentsCoverMembers(segments, props.nodes.map((node) => node.id)), [props.nodes, segments])
  const assignedIds = useMemo(() => new Set(normalizedSegments.flatMap((segment) => segment.memberViewIds)), [normalizedSegments])
  const unassignedIds = useMemo(() => props.nodes.map((node) => node.id).filter((id) => !assignedIds.has(id)), [assignedIds, props.nodes])

  const placements = useMemo<SegmentPlacement[]>(() => {
    let y = TOP
    return normalizedSegments.map((segment) => {
      const height = segmentHeight(segment.memberViewIds.length, segment.collapsed)
      const placement = { id: segment.id, x: SEGMENT_X, y, width: SEGMENT_WIDTH, height, memberIds: [...segment.memberViewIds], collapsed: segment.collapsed }
      y += height + SEGMENT_GAP
      return placement
    })
  }, [normalizedSegments])

  const worldHeight = Math.max(720, (placements.at(-1)?.y ?? TOP) + (placements.at(-1)?.height ?? 120) + 180)
  const placementById = useMemo(() => new Map(placements.map((placement) => [placement.id, placement])), [placements])
  const segmentById = useMemo(() => new Map(normalizedSegments.map((segment) => [segment.id, segment])), [normalizedSegments])
  const contentBounds = useMemo(() => spatialBoundsForPlacements([
    ...placements.map((placement) => ({ x: SPINE_X - 18, y: placement.y, width: placement.x + placement.width - SPINE_X + 18, height: placement.height })),
    ...placements.flatMap((placement) => {
      if (placement.collapsed) return []
      const columns = placement.memberIds.length > 6 ? 3 : 2
      return placement.memberIds.map((memberId, index) => {
        const row = Math.floor(index / columns)
        const col = index % columns
        const fallback = { x: CHILD_X + col * (CHILD_WIDTH + CHILD_GAP_X), y: placement.y + 58 + row * (CHILD_HEIGHT + CHILD_GAP_Y) }
        const point = localPositions[memberId] ?? fallback
        return { x: point.x, y: point.y, width: CHILD_WIDTH, height: CHILD_HEIGHT }
      })
    }),
  ], 46), [localPositions, placements])
  const spatialMemberItems = useMemo(() => placements.flatMap((placement) => {
    if (placement.collapsed) return []
    const columns = placement.memberIds.length > 6 ? 3 : 2
    return placement.memberIds.map((memberId, index) => {
      const row = Math.floor(index / columns)
      const col = index % columns
      const fallback = { x: CHILD_X + col * (CHILD_WIDTH + CHILD_GAP_X), y: placement.y + 58 + row * (CHILD_HEIGHT + CHILD_GAP_Y) }
      const point = localPositions[memberId] ?? fallback
      return { id:memberId, x:point.x, y:point.y, width:CHILD_WIDTH, height:CHILD_HEIGHT }
    })
  }), [localPositions, placements])
  const minimapItems = useMemo(() => [
    ...placements.map((placement) => ({ id:`segment:${placement.id}`, x:placement.x, y:placement.y, width:placement.width, height:placement.height })),
    ...spatialMemberItems,
  ], [placements, spatialMemberItems])
  const selectedSpatialItems = useMemo(() => spatialMemberItems.filter((item) => props.selectedIds.includes(item.id)), [props.selectedIds, spatialMemberItems])
  const focusSelected = () => {
    if (!selectedSpatialItems.length) return
    const root = canvasRef.current
    if (!root) return
    setCamera(fitSpatialBounds(spatialBoundsForPlacements(selectedSpatialItems, 38), root.clientWidth || 1, root.clientHeight || 1, 84))
  }

  // A Context can keep its own camera while the user works, but stale HMR/session
  // camera state must never make a populated Signal Track look empty. On each
  // concrete Context entry, verify that at least part of the track is on screen;
  // only repair the camera when the content is completely outside the viewport.
  useSpatialFocusRequest({ request: props.focusRequest, items: spatialMemberItems, testId: 'context-flow-spatial', setCamera })

  useEffect(() => {
    if (!placements.length) return
    const visibilityKey = `${props.projectId}:${props.scopeId}`
    if (checkedInitialVisibility.current === visibilityKey) return
    const frame = requestAnimationFrame(() => {
      const root = canvasRef.current
      if (!root) return
      const width = root.clientWidth || 1
      const height = root.clientHeight || 1
      const left = camera.x + contentBounds.x * camera.zoom
      const top = camera.y + contentBounds.y * camera.zoom
      const right = camera.x + (contentBounds.x + contentBounds.width) * camera.zoom
      const bottom = camera.y + (contentBounds.y + contentBounds.height) * camera.zoom
      const visible = right > 36 && left < width - 36 && bottom > 36 && top < height - 36
      checkedInitialVisibility.current = visibilityKey
      if (!visible) setCamera(fitSpatialBounds(contentBounds, width, height, 72))
    })
    return () => cancelAnimationFrame(frame)
  }, [camera, contentBounds, placements.length, props.projectId, props.scopeId, setCamera])

  const beginChildDrag = (event: ReactPointerEvent<HTMLDivElement>, id: string, fallback: { x: number; y: number }) => {
    if (event.button !== 0) return
    event.stopPropagation()
    const origin = localPositions[id] ?? fallback
    childDrag.current = beginSpatialNodeDrag(event.pointerId, id, { x: event.clientX, y: event.clientY }, origin)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveChildDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = childDrag.current
    if (session.kind !== 'node-drag') return
    event.stopPropagation()
    const next = advanceSpatialNodeDrag(session, { x: event.clientX, y: event.clientY }, camera.zoom)
    if (next) setLocalPositions((current) => ({ ...current, [session.id]: next }))
  }
  const endChildDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = childDrag.current
    if (session.kind !== 'node-drag') return
    event.stopPropagation()
    if (event.defaultPrevented) setLocalPositions((current) => ({ ...current, [session.id]: session.origin }))
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    childDrag.current = endSpatialPointer()
  }

  const splitSelection = (segmentId: string) => {
    const segment = segmentById.get(segmentId)
    if (!segment) return
    const selected = props.selectedIds.filter((id) => segment.memberViewIds.includes(id))
    const next = splitTrackSegment(normalizedSegments, segmentId, selected, `segment:${Date.now()}`)
    if (next) setSegments(next)
  }

  const parseProjectViewDrop = (event: ReactDragEvent<HTMLElement>) => {
    const raw = event.dataTransfer.getData('application/x-lcos-project-view')
    if (!raw) return []
    try {
      const payload = JSON.parse(raw) as { memberViewIds?: unknown }
      return Array.isArray(payload.memberViewIds) ? payload.memberViewIds.filter((item): item is string => typeof item === 'string') : []
    } catch { return [] }
  }

  const importProjectViewMembers = (event: ReactDragEvent<HTMLElement>) => {
    const members = parseProjectViewDrop(event)
    if (!members.length || !props.onImportProjectView) return []
    return props.onImportProjectView(members)
  }

  const onSegmentDrop = (event: ReactDragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault()
    setReceivingSegmentId(null)
    const sourceId = event.dataTransfer.getData('application/x-lcos-context-segment') || draggedSegmentId
    if (sourceId) {
      setSegments(moveSegmentBefore(normalizedSegments, sourceId, targetId))
      setDraggedSegmentId(null)
      return
    }
    const imported = importProjectViewMembers(event)
    if (imported.length) {
      setSegments(addTrackSegmentMembers(normalizedSegments, targetId, imported))
      return
    }
    const viewId = event.dataTransfer.getData('text/plain')
    if (viewId && nodeById.has(viewId)) setSegments(addTrackSegmentMembers(normalizedSegments, targetId, [viewId]))
  }

  const onInsertionDrop = (event: ReactDragEvent<HTMLElement>, atIndex: number) => {
    event.preventDefault()
    setReceivingInsertionIndex(null)
    const imported = importProjectViewMembers(event)
    if (imported.length) {
      setSegments(insertTrackSegment(normalizedSegments, atIndex, imported, `segment:${Date.now()}`, '导入段'))
      return
    }
    const viewId = event.dataTransfer.getData('text/plain')
    if (viewId && nodeById.has(viewId)) setSegments(insertTrackSegment(normalizedSegments, atIndex, [viewId], `segment:${Date.now()}`))
  }

  const emptyOverlay = props.nodes.length === 0 ? <div className="lcos-context-free-empty"><Waves size={20}/><strong>把材料直接拖进这个 Context</strong><span>材料会沿理解顺序展开，也可以直接拖动调整演进位置。</span></div> : undefined

  return <section className="lcos-dedicated-surface lcos-context-signal" data-testid="surface-context-flow">
    <header className="lcos-surface-heading lcos-signal-heading">
      <div><strong>上下文</strong><span>演进</span></div>
      <div className="lcos-context-heading-actions"><div className="lcos-signal-summary"><small>{normalizedSegments.length} 段 · {props.nodes.length} 项 · 纵向顺序表达这份理解的演进</small>{unassignedIds.length > 0 && <span>{unassignedIds.length} 项未编排</span>}{selectedSpatialItems.length > 0 && <button type="button" className="lcos-signal-focus-selection" onClick={focusSelected} title="把当前选中对象定位到视区中央"><Crosshair size={11}/><span>定位选中 · {selectedSpatialItems.length}</span></button>}</div><ContextLensSwitch active="context-flow" onSelect={props.onSurfaceChange}/></div>
    </header>
    <div className={`lcos-context-origin-chip source-${props.source.kind}`} title="这只是来源记录，不是操作入口"><i/><span>{props.source.label}</span><small>来源</small></div>
    <SpatialCanvas ref={canvasRef} camera={camera} setCamera={setCamera} marqueeItems={spatialMemberItems} minimapItems={minimapItems} minimapLabel="Context Evolution" onMarqueeSelect={props.onMarqueeSelect} className="lcos-signal-stage lcos-presentation-spatial" worldClassName="lcos-presentation-world lcos-signal-world" worldStyle={{ width: WORLD_WIDTH, height: worldHeight }} testId="context-flow-spatial" overlays={emptyOverlay} onPointerUp={() => { childDrag.current = endSpatialPointer() }} onPointerCancel={() => { childDrag.current = endSpatialPointer() }}>
      <SpatialEdgeLayer bounds={{ x: 0, y: 0, width: WORLD_WIDTH, height: worldHeight }} className="lcos-signal-edges" ariaLabel="Context Signal Track">
        {placements.length > 0 && <path className="lcos-signal-spine" d={`M ${SPINE_X} ${placements[0]!.y + 24} L ${SPINE_X} ${placements.at(-1)!.y + placements.at(-1)!.height - 20}`}/>}
        {placements.map((placement) => {
          const segment = segmentById.get(placement.id)
          if (!segment) return null
          const cy = placement.y + 31
          return <g key={`signal:${placement.id}`}>
            <path className="lcos-signal-spur" d={`M ${SPINE_X} ${cy} C ${SPINE_X + 14} ${cy}, ${placement.x - 12} ${cy}, ${placement.x} ${cy}`}/>
            {!placement.collapsed && placement.memberIds.map((memberId, index) => {
              const columns = placement.memberIds.length > 6 ? 3 : 2
              const row = Math.floor(index / columns)
              const col = index % columns
              const fallback = { x: CHILD_X + col * (CHILD_WIDTH + CHILD_GAP_X), y: placement.y + 58 + row * (CHILD_HEIGHT + CHILD_GAP_Y) }
              const point = localPositions[memberId] ?? fallback
              const sx = placement.x + placement.width
              const sy = placement.y + 52
              const tx = point.x
              const ty = point.y + CHILD_HEIGHT / 2
              const mx = sx + Math.max(38, (tx - sx) * .45)
              return <path key={`${placement.id}:${memberId}`} className="lcos-signal-member-link" d={`M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`}/>
            })}
          </g>
        })}
      </SpatialEdgeLayer>
      <SpatialNodeLayer>
        {Array.from({ length: normalizedSegments.length + 1 }, (_, index) => {
          const before = placements[index - 1]
          const after = placements[index]
          const y = index === 0 ? TOP - 34 : index === placements.length ? (before?.y ?? TOP) + (before?.height ?? 0) + 8 : ((before?.y ?? TOP) + (before?.height ?? 0) + (after?.y ?? TOP)) / 2 - 9
          return <div key={`insert-gap:${index}`} className={`lcos-signal-insert-gap ${receivingInsertionIndex === index ? 'is-receiving' : ''}`} style={{ left: SPINE_X + 18, top: y, width: SEGMENT_X + SEGMENT_WIDTH - SPINE_X + 22 } as CSSProperties}
            onDragEnter={(event) => { if (event.dataTransfer.types.includes('application/x-lcos-project-view') || event.dataTransfer.types.includes('text/plain')) setReceivingInsertionIndex(index) }}
            onDragLeave={() => setReceivingInsertionIndex((current) => current === index ? null : current)}
            onDragOver={(event) => { if (event.dataTransfer.types.includes('application/x-lcos-project-view') || event.dataTransfer.types.includes('text/plain')) { event.preventDefault(); setReceivingInsertionIndex(index) } }}
            onDrop={(event) => onInsertionDrop(event, index)}><span>放到这里建立新段</span></div>
        })}
        {placements.map((placement) => {
          const segment = segmentById.get(placement.id)!
          const segmentIndex = normalizedSegments.findIndex((item) => item.id === segment.id)
          const selectedInSegment = props.selectedIds.filter((id) => segment.memberViewIds.includes(id))
          const previous = segmentIndex > 0 ? normalizedSegments[segmentIndex - 1] : undefined
          const bars = waveform(segment.memberViewIds.length)
          return <div key={segment.id} className={`lcos-signal-segment ${placement.collapsed ? 'is-collapsed' : ''} ${selectedInSegment.length ? 'has-selection' : ''} ${receivingSegmentId === segment.id ? 'is-receiving' : ''}`} style={{ left: placement.x, top: placement.y, width: placement.width, minHeight: placement.collapsed ? 70 : 104 } as CSSProperties}
            draggable
            onDragStart={(event) => { setDraggedSegmentId(segment.id); event.dataTransfer.setData('application/x-lcos-context-segment', segment.id); event.dataTransfer.effectAllowed = 'move' }}
            onDragEnter={(event) => { if (event.dataTransfer.types.includes('application/x-lcos-context-segment') || event.dataTransfer.types.includes('application/x-lcos-project-view') || event.dataTransfer.types.includes('text/plain')) setReceivingSegmentId(segment.id) }}
            onDragLeave={() => setReceivingSegmentId((current) => current === segment.id ? null : current)}
            onDragOver={(event) => { if (event.dataTransfer.types.includes('application/x-lcos-context-segment') || event.dataTransfer.types.includes('application/x-lcos-project-view') || event.dataTransfer.types.includes('text/plain')) { event.preventDefault(); setReceivingSegmentId(segment.id) } }}
            onDrop={(event) => onSegmentDrop(event, segment.id)}>
            <button type="button" className="lcos-signal-segment-grip" aria-label={`拖动第 ${segmentIndex + 1} 段`}><GripVertical size={12}/></button>
            <button type="button" className="lcos-signal-segment-main" onClick={() => setSegments(toggleTrackSegmentCollapsed(normalizedSegments, segment.id))}>
              <span className="lcos-signal-order">{String(segmentIndex + 1).padStart(2, '0')}</span>
              <span className="lcos-signal-copy"><strong>{segment.label || `第 ${segmentIndex + 1} 段`}</strong><small>{segment.memberViewIds.length} 项 · density {trackSegmentDensity(segment)}</small></span>
              <span className="lcos-signal-wave" aria-hidden="true">{bars.map((height, index) => <i key={index} style={{ height: `${height}%` }}/>)}</span>
              <ChevronRight size={13} className={placement.collapsed ? '' : 'expanded'}/>
            </button>
            <div className="lcos-signal-segment-tools">
              <button type="button" title="上移" disabled={segmentIndex === 0} onClick={() => setSegments(reorderTrackSegment(normalizedSegments, segment.id, -1))}><ArrowUp size={11}/></button>
              <button type="button" title="下移" disabled={segmentIndex === normalizedSegments.length - 1} onClick={() => setSegments(reorderTrackSegment(normalizedSegments, segment.id, 1))}><ArrowDown size={11}/></button>
              <button type="button" title="把当前选中拆成新段" disabled={selectedInSegment.length === 0 || selectedInSegment.length === segment.memberViewIds.length} onClick={() => splitSelection(segment.id)}><Scissors size={11}/></button>
              <button type="button" title="合并到上一段" disabled={!previous} onClick={() => { if (!previous) return; const next = mergeTrackSegments(normalizedSegments, segment.id, previous.id); if (next) setSegments(next) }}><Plus size={11}/><span>合并</span></button>
            </div>
          </div>
        })}
        {placements.flatMap((placement) => {
          if (placement.collapsed) return []
          const columns = placement.memberIds.length > 6 ? 3 : 2
          return placement.memberIds.flatMap((memberId, index) => {
            const node = nodeById.get(memberId)
            if (!node) return []
            const row = Math.floor(index / columns)
            const col = index % columns
            const fallback = { x: CHILD_X + col * (CHILD_WIDTH + CHILD_GAP_X), y: placement.y + 58 + row * (CHILD_HEIGHT + CHILD_GAP_Y) }
            const point = localPositions[memberId] ?? fallback
            return <div key={memberId} className="lcos-signal-member lcos-spatial-placement" style={{ left: point.x, top: point.y, width: CHILD_WIDTH } as CSSProperties} draggable onDragStart={(event) => { event.dataTransfer.setData('text/plain', memberId); event.dataTransfer.effectAllowed = 'copy' }} onPointerDown={(event) => beginChildDrag(event, memberId, fallback)} onPointerMove={moveChildDrag} onPointerUp={endChildDrag} onPointerCancel={endChildDrag}>
              <SurfaceObject node={node} compact usageHint="此处引用" selected={props.selectedIds.includes(memberId)} dropIds={props.selectedIds.includes(memberId)&&props.selectedIds.length?props.selectedIds:[memberId]} onDirectProjectViewDrop={props.onDirectProjectViewDrop} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/>
              <button type="button" className="lcos-signal-member-remove" aria-label={`从当前 Context 移除 ${node.title}`} title="只移出当前 Context，不删除原对象" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => {
                event.stopPropagation()
                if (props.onRemoveMember) props.onRemoveMember(memberId)
                else setSegments(removeTrackSegmentMember(normalizedSegments, placement.id, memberId))
              }}><X size={10}/></button>
            </div>
          })
        })}
      </SpatialNodeLayer>
    </SpatialCanvas>
  </section>
}
