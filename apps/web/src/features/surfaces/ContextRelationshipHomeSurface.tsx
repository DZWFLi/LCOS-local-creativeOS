import { GripVertical, Link2, Waves, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { AttentionBucketV0 } from '@local-creative-os/contracts'
import type { CanvasEdge, CanvasNode } from '../../model'
import { proposeContextMergeCandidate, type ContextMergeProposal, type ContextViewSummary } from '../context/contextMerge'
import { SpatialCanvas } from '../spatial/SpatialCanvas'
import { SpatialEdgeLayer } from '../spatial/SpatialEdgeLayer'
import { SpatialNodeLayer } from '../spatial/SpatialNodeLayer'
import { fitSpatialBounds, spatialBoundsForPlacements } from '../spatial/spatialCamera'
import { useSpatialSessionCamera } from '../../state/spatialSessionState'
import { useSpatialFocusRequest, type SpatialFocusRequest } from '../spatial/useSpatialFocusRequest'
import { beginSemanticDrop } from '../spatial/semanticDrop'
import { DropFeedbackLayer } from '../drop/dropFeedbackLayer'
import { useSemanticDropFeedback } from '../drop/useSemanticDropFeedback'
import { loadPresentationLayoutEngines } from '../layout/layoutEngines'

import { SurfaceIdentityGlyph } from './SurfaceObject'
import { ContextGlyph } from '../design/LcosGlyphs'

interface Props {
  projectId: string
  scopeId: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  selectedIds: string[]
  attentionBucketsByViewId?: Readonly<Record<string, AttentionBucketV0>>
  onMarqueeSelect?: (ids: string[], additive: boolean) => void
  onSelect: (id: string, additive?: boolean) => void
  onDoubleClick: (id: string) => void
  contextViews?: readonly ContextViewSummary[]
  onContextMergeAccept?: (sourceContextId: string, targetContextId: string, additions: readonly string[]) => void
  onOpenContextView?: (contextId: string) => void
  onAddMembersToContext?: (contextId: string, memberViewIds: readonly string[]) => void
  onAddMembersToGraph?: (memberViewIds: readonly string[]) => void
  onCreateContextFromMembers?: (memberViewIds: readonly string[]) => void
  onDirectProjectViewDrop?: (targetViewId: string, sourceIds: readonly string[]) => void
  focusRequest?: SpatialFocusRequest
}

interface ContextPlacement { view: ContextViewSummary; x: number; y: number; width: number; height: number }
interface GraphNodePlacement { node: CanvasNode; x: number; y: number; width: number; height: number }
interface OverlapEdge { id: string; from: ContextPlacement; to: ContextPlacement; shared: number; ratio: number }

const WORLD_WIDTH = 1500
const WORLD_HEIGHT = 940
const CENTER_X = WORLD_WIDTH / 2
const CENTER_Y = WORLD_HEIGHT / 2
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

function contentKeys(view: ContextViewSummary) { return [...(view.memberContentKeys ?? view.memberViewIds), ...(view.memberEntityNodeIds ?? [])] }
function sharedCount(a: ContextViewSummary, b: ContextViewSummary) {
  const bKeys = new Set(contentKeys(b))
  return contentKeys(a).filter((key) => bKeys.has(key)).length
}
function contextDimensions(view: ContextViewSummary) {
  const count = view.memberViewIds.length + (view.memberEntityNodeIds?.length ?? 0)
  return {
    width: Math.round(Math.max(154, Math.min(218, 148 + Math.sqrt(Math.max(1, count)) * 14))),
    height: Math.round(Math.max(66, Math.min(86, 62 + Math.sqrt(Math.max(1, count)) * 5))),
  }
}
function projectDimensions(node: CanvasNode) {
  const aggregate = Boolean(node.entityKind)
  const decision = node.kind === 'decision'
  return aggregate ? { width: 122, height: 48 } : decision ? { width: 110, height: 46 } : { width: 92, height: 40 }
}

/**
 * Obsidian-like associative constellation: no rows, no cards, no implied order.
 * 无 positionsById 时产出黄金角种子（首帧与 fcose 不可用时的兜底，确定性可测）；
 * 传入 fCoSE 结果时用真实关系位置覆盖——共享成员的 Context 靠拢，关系强度决定距离。
 */
function relationshipLayout(views: readonly ContextViewSummary[], positionsById?: ReadonlyMap<string, { x: number; y: number }>) {
  const placements: ContextPlacement[] = views.map((view, index) => {
    const size = contextDimensions(view)
    const override = positionsById?.get(`scope:${view.id}`)
    const radius = views.length <= 1 ? 0 : 140 + 82 * Math.sqrt(index + 1)
    const angle = index * GOLDEN_ANGLE - Math.PI / 2
    return {
      view,
      x: override?.x ?? CENTER_X + Math.cos(angle) * radius - size.width / 2,
      y: override?.y ?? CENTER_Y + Math.sin(angle) * radius - size.height / 2,
      width: size.width,
      height: size.height,
    }
  })
  const byId = new Map(placements.map((item) => [item.view.id, item]))
  const overlaps: OverlapEdge[] = []
  for (let a = 0; a < views.length; a += 1) {
    for (let b = a + 1; b < views.length; b += 1) {
      const left = views[a]!, right = views[b]!
      const shared = sharedCount(left, right)
      if (!shared) continue
      const leftCount = left.memberViewIds.length + (left.memberEntityNodeIds?.length ?? 0)
      const rightCount = right.memberViewIds.length + (right.memberEntityNodeIds?.length ?? 0)
      const denominator = Math.max(1, Math.min(leftCount, rightCount))
      overlaps.push({ id: `overlap:${left.id}:${right.id}`, from: byId.get(left.id)!, to: byId.get(right.id)!, shared, ratio: shared / denominator })
    }
  }
  return { placements, overlaps }
}

function centerOf(item: { x:number; y:number; width:number; height:number }) {
  return { x: item.x + item.width / 2, y: item.y + item.height / 2 }
}

export function ContextRelationshipHomeSurface(props: Props) {
  const [camera, setCamera] = useSpatialSessionCamera(props.projectId, props.scopeId, 'context-relationship-home', { x: 0, y: 0, zoom: 1 })
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const checkedInitialVisibility = useRef<string | null>(null)
  const [mergeProposal, setMergeProposal] = useState<ContextMergeProposal | null>(null)
  const [receivingContextId, setReceivingContextId] = useState<string | null>(null)
  const views = props.contextViews ?? []
  const contextContainerIds = useMemo(() => new Set(views.flatMap((view) => [view.containerViewId, `scope:${view.id}`]).filter((id): id is string => Boolean(id))), [views])
  const projectNodes = useMemo(() => props.nodes.filter((node) => !contextContainerIds.has(node.id)), [contextContainerIds, props.nodes])
  // 种子布局（黄金角/外环）：首帧立即渲染，且是 fCoSE 的初始位置输入（randomize:false 增量稳定）。
  const seedLayout = useMemo(() => relationshipLayout(views), [views])
  const seedProjectPlacements = useMemo<GraphNodePlacement[]>(() => projectNodes.map((node, index) => {
    const size = projectDimensions(node)
    const ring = 360 + 58 * Math.floor(index / 12)
    const angle = (index * GOLDEN_ANGLE + Math.PI * .2) % (Math.PI * 2)
    return { node, x: CENTER_X + Math.cos(angle) * ring - size.width / 2, y: CENTER_Y + Math.sin(angle) * ring - size.height / 2, width: size.width, height: size.height }
  }), [projectNodes])
  // fCoSE 关系位置（异步精化）：图 = Context（scope:id）+ 项目节点，边 = 共享成员 + 真实 CanvasEdge。
  const [relationalPositions, setRelationalPositions] = useState<ReadonlyMap<string, { x: number; y: number }> | null>(null)
  useEffect(() => {
    if (seedLayout.placements.length + seedProjectPlacements.length < 2) { setRelationalPositions(null); return }
    let cancelled = false
    void loadPresentationLayoutEngines().then((engines) => {
      if (engines.relational === undefined) throw new Error('fcose engine unavailable')
      const idByAnchor = new Map<string, string>()
      seedLayout.placements.forEach((placement) => { if (placement.view.containerViewId) idByAnchor.set(placement.view.containerViewId, `scope:${placement.view.id}`) })
      seedProjectPlacements.forEach((placement) => idByAnchor.set(placement.node.id, placement.node.id))
      const request = {
        nodes: [
          ...seedProjectPlacements.map((placement) => ({ id: placement.node.id, x: placement.x, y: placement.y, width: placement.width, height: placement.height })),
          ...seedLayout.placements.map((placement) => ({ id: `scope:${placement.view.id}`, x: placement.x, y: placement.y, width: placement.width, height: placement.height })),
        ],
        edges: [
          ...seedLayout.overlaps.map((edge) => ({ id: edge.id, from: `scope:${edge.from.view.id}`, to: `scope:${edge.to.view.id}` })),
          ...props.edges.flatMap((edge) => {
            const from = idByAnchor.get(edge.from), to = idByAnchor.get(edge.to)
            return from !== undefined && to !== undefined && from !== to ? [{ id: edge.id, from, to }] : []
          }),
        ],
        strategy: 'relational' as const,
        gap: 34,
      }
      return engines.relational.layout(request)
    }).then((result) => {
      if (cancelled) return
      setRelationalPositions(new Map(result.positions.map((position) => [position.id, { x: position.x, y: position.y }])))
    }).catch(() => { /* fCoSE 不可用（依赖加载失败等）：保持黄金角种子布局，不伪造关系位置 */ })
    return () => { cancelled = true }
  }, [seedLayout, seedProjectPlacements, props.edges])
  const layout = useMemo(() => relationshipLayout(views, relationalPositions ?? undefined), [views, relationalPositions])
  const projectPlacements = useMemo<GraphNodePlacement[]>(() => seedProjectPlacements.map((placement) => {
    const override = relationalPositions?.get(placement.node.id)
    return override ? { ...placement, x: override.x, y: override.y } : placement
  }), [seedProjectPlacements, relationalPositions])
  const graphPlacementByViewId = useMemo(() => {
    const map = new Map<string, { x:number; y:number; width:number; height:number }>()
    layout.placements.forEach((item) => { if (item.view.containerViewId) map.set(item.view.containerViewId, item) })
    projectPlacements.forEach((item) => map.set(item.node.id, item))
    return map
  }, [layout.placements, projectPlacements])
  const projectEdges = useMemo(() => props.edges.flatMap((edge) => {
    const from = graphPlacementByViewId.get(edge.from), to = graphPlacementByViewId.get(edge.to)
    return from && to ? [{ edge, from, to }] : []
  }), [graphPlacementByViewId, props.edges])
  const spatialItems = useMemo(() => [
    ...projectPlacements.map((item) => ({ id:item.node.id, x:item.x, y:item.y, width:item.width, height:item.height })),
    ...layout.placements.map((item) => ({ id:`scope:${item.view.id}`, x:item.x, y:item.y, width:item.width, height:item.height })),
  ], [layout.placements, projectPlacements])
  useSpatialFocusRequest({ request: props.focusRequest, items: spatialItems, testId: 'context-graph-spatial', setCamera })
  const contentBounds = useMemo(() => spatialBoundsForPlacements([
    ...layout.placements.map(({x,y,width,height}) => ({x,y,width,height})),
    ...projectPlacements.map(({x,y,width,height}) => ({x,y,width,height})),
  ], 80), [layout.placements, projectPlacements])

  useEffect(() => {
    if (!views.length && !projectPlacements.length) return
    // 末段 generation：种子→fCoSE 位置落地时各自适配一次（之后不再抢相机）。
    const visibilityKey = `${props.projectId}:${props.scopeId}:${relationalPositions === null ? 'seed' : 'relational'}`
    if (checkedInitialVisibility.current === visibilityKey) return
    const frame = requestAnimationFrame(() => {
      const root = canvasRef.current
      if (!root) return
      const width = root.clientWidth || 1, height = root.clientHeight || 1
      checkedInitialVisibility.current = visibilityKey
      setCamera(fitSpatialBounds(contentBounds, width, height, 96))
    })
    return () => cancelAnimationFrame(frame)
  }, [contentBounds, projectPlacements.length, props.projectId, props.scopeId, relationalPositions, setCamera, views.length])

  const importProjectViewMembers = (raw: string) => {
    if (!raw || !props.onAddMembersToGraph) return
    try {
      const payload = JSON.parse(raw) as { memberViewIds?: unknown }
      const members = Array.isArray(payload.memberViewIds) ? payload.memberViewIds.filter((item): item is string => typeof item === 'string') : []
      if (members.length) props.onAddMembersToGraph(members)
    } catch { /* ignore malformed external payload */ }
  }

  const empty = !views.length && !projectNodes.length
    ? <div className="lcos-context-home-empty lcos-context-home-empty-drop"><Waves size={22}/><strong>把项目节点拖到这里</strong><span>把相关 Context 或材料放到这里。双击 Context 进入。</span></div>
    : undefined

  const dropFeedback = useSemanticDropFeedback()

  return <>
  <section className="lcos-dedicated-surface lcos-context-relationship-home lcos-context-dot-graph" data-testid="surface-context-graph">
    <header className="lcos-surface-heading lcos-context-home-heading">
      <div><strong>上下文</strong><span>Context Graph</span></div>
      <small>{views.length} 个 Context · {projectNodes.length} 个项目节点 · 关系越重要，节点可以越大</small>
    </header>
    <SpatialCanvas ref={canvasRef} camera={camera} setCamera={setCamera} marqueeItems={spatialItems} minimapItems={spatialItems} minimapLabel="Context Graph" onMarqueeSelect={props.onMarqueeSelect} className="lcos-context-home-stage lcos-presentation-spatial" worldClassName="lcos-presentation-world lcos-context-dot-world" worldStyle={{ width: WORLD_WIDTH, height: WORLD_HEIGHT }} testId="context-graph-spatial" overlays={empty} onExternalDrop={(kind, raw) => { if (kind === 'project-view') importProjectViewMembers(raw) }}>
      <SpatialEdgeLayer bounds={{ x:0, y:0, width:WORLD_WIDTH, height:WORLD_HEIGHT }} className="lcos-context-home-edges lcos-context-dot-edges" ariaLabel="Context Graph 关系">
        {projectEdges.map(({ edge, from, to }) => {
          const a=centerOf(from), b=centerOf(to)
          return <g key={`project:${edge.id}`} className={`lcos-context-project-edge kind-${edge.kind}`}><path d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}/>{edge.label && <text x={(a.x+b.x)/2} y={(a.y+b.y)/2-7} textAnchor="middle">{edge.label}</text>}</g>
        })}
        {layout.overlaps.map((edge) => {
          const a=centerOf(edge.from), b=centerOf(edge.to)
          return <g key={edge.id} className="lcos-context-overlap-edge" style={{ '--overlap': edge.ratio } as CSSProperties}><path d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}/><text x={(a.x+b.x)/2} y={(a.y+b.y)/2-7} textAnchor="middle">{edge.shared}</text></g>
        })}
      </SpatialEdgeLayer>
      <SpatialNodeLayer>
        {projectPlacements.map((placement) => <button key={placement.node.id} type="button" className={`lcos-context-project-dot ${props.selectedIds.includes(placement.node.id)?'is-selected':''} ${props.attentionBucketsByViewId?.[placement.node.id] ? `attention-${props.attentionBucketsByViewId[placement.node.id]}` : ''}`} data-attention-bucket={props.attentionBucketsByViewId?.[placement.node.id]} style={{ left:placement.x, top:placement.y, width:placement.width, height:placement.height } as CSSProperties} title={placement.node.title} onPointerDown={(event)=>beginSemanticDrop(event,props.selectedIds.includes(placement.node.id)&&props.selectedIds.length?props.selectedIds:[placement.node.id],props.onDirectProjectViewDrop,dropFeedback.onPhase)} onClick={(event)=>props.onSelect(placement.node.id,event.metaKey||event.ctrlKey||event.shiftKey)} onDoubleClick={()=>props.onDoubleClick(placement.node.id)}>
          <span className="lcos-context-project-signal"><SurfaceIdentityGlyph node={placement.node}/></span>
          <span className="lcos-context-project-copy"><strong>{placement.node.title}</strong><small>{placement.node.entityKind ?? placement.node.fileType ?? placement.node.kind}</small></span>
        </button>)}
        {layout.placements.map((placement, index) => {
          const viewId = `scope:${placement.view.id}`
          const memberCount = placement.view.memberViewIds.length + (placement.view.memberEntityNodeIds?.length ?? 0)
          return <article key={placement.view.id} className={`lcos-context-dot-node ${props.selectedIds.includes(viewId)?'is-selected':''} ${receivingContextId===placement.view.id?'is-receiving':''} ${props.attentionBucketsByViewId?.[viewId] ? `attention-${props.attentionBucketsByViewId[viewId]}` : ''}`} data-attention-bucket={props.attentionBucketsByViewId?.[viewId]} data-context-view={placement.view.id} data-project-view-drop-target={viewId} data-project-view-drop-kind="context" data-project-view-drop-label={placement.view.title} style={{ left:placement.x, top:placement.y, width:placement.width, height:placement.height, '--i':index } as CSSProperties}
            draggable
            onDragStart={(event) => { event.dataTransfer.setData('application/x-lcos-context-view', placement.view.id); event.dataTransfer.effectAllowed='copy' }}
            onDragEnter={(event) => { if (event.dataTransfer.types.includes('application/x-lcos-context-view') || event.dataTransfer.types.includes('application/x-lcos-project-view')) setReceivingContextId(placement.view.id) }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setReceivingContextId((current)=>current===placement.view.id?null:current) }}
            onDragOver={(event) => { if (event.dataTransfer.types.includes('application/x-lcos-context-view') || event.dataTransfer.types.includes('application/x-lcos-project-view')) { event.preventDefault(); setReceivingContextId(placement.view.id) } }}
            onDrop={(event) => {
              event.preventDefault(); event.stopPropagation(); setReceivingContextId(null)
              const sourceId=event.dataTransfer.getData('application/x-lcos-context-view')
              if (sourceId) { const source=views.find((view)=>view.id===sourceId); if(source)setMergeProposal(proposeContextMergeCandidate(source,placement.view)); return }
              const raw=event.dataTransfer.getData('application/x-lcos-project-view')
              if(!raw||!props.onAddMembersToContext)return
              try { const payload=JSON.parse(raw) as {memberViewIds?:unknown}; const members=Array.isArray(payload.memberViewIds)?payload.memberViewIds.filter((item):item is string=>typeof item==='string'):[]; if(members.length)props.onAddMembersToContext(placement.view.id,members) } catch { /* ignore */ }
            }}>
            <button type="button" className="lcos-context-dot-core" onPointerDown={(event)=>beginSemanticDrop(event,[viewId],props.onDirectProjectViewDrop,dropFeedback.onPhase)} onClick={(event)=>props.onSelect(viewId,event.metaKey||event.ctrlKey||event.shiftKey)} onDoubleClick={(event)=>{event.stopPropagation();props.onOpenContextView?.(placement.view.id)}} aria-label={`选择 ${placement.view.title}`} title="单击选中 · 双击进入 Context">
              <span className="lcos-semantic-drop-handle" data-semantic-drop-handle aria-hidden="true" onClick={(event)=>event.stopPropagation()} title="Semantic Drop：拖到其它上下文或工作流（右键拖 / Alt+左拖）"><GripVertical size={11}/></span>
              <span className="lcos-context-core-signal"><ContextGlyph/></span>
              <span className="lcos-context-core-copy"><strong>{placement.view.title}</strong><small>{memberCount} 项 · 双击进入</small></span>
              <b>{memberCount}</b>
            </button>
          </article>
        })}
      </SpatialNodeLayer>
    </SpatialCanvas>
    {mergeProposal && <div className="lcos-merge-proposal" role="dialog" aria-label="上下文合并提案" data-testid="context-merge-proposal">
      <header><Link2 size={14}/><strong>组合 Context 提案</strong><button type="button" aria-label="关闭提案" onClick={()=>setMergeProposal(null)}><X size={13}/></button></header>
      <p>把「{views.find((view)=>view.id===mergeProposal.sourceContextId)?.title??mergeProposal.sourceContextId}」中尚未包含的 {mergeProposal.additions.length + mergeProposal.entityAdditions.length} 项加入「{views.find((view)=>view.id===mergeProposal.targetContextId)?.title??mergeProposal.targetContextId}」？原 Context 保持不变。</p>
      <footer><button type="button" className="pressable" onClick={()=>setMergeProposal(null)}>取消</button><button type="button" className="pressable primary-action" disabled={mergeProposal.additions.length + mergeProposal.entityAdditions.length === 0} onClick={()=>{props.onContextMergeAccept?.(mergeProposal.sourceContextId,mergeProposal.targetContextId,mergeProposal.additions);setMergeProposal(null)}}>接受</button></footer>
    </div>}
  </section>
    <DropFeedbackLayer phase={dropFeedback.phase} hitElement={dropFeedback.hitElement} />
  </>
}
