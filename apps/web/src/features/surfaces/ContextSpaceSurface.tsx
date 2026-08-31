import { Layers3 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { spatialBoundsForPlacements, fitSpatialBounds, spatialScreenToWorld } from '../spatial/spatialCamera'
import { advanceSpatialNodeDrag, beginSpatialNodeDrag, endSpatialPointer } from '../spatial/spatialInteractionMachine'
import { IDLE_SPATIAL_POINTER, type SpatialPointerSession } from '../spatial/spatialTypes'
import { usePresentationDraftPinnedIds, usePresentationDraftPositions, usePresentationSurfaceElements } from '../../state/presentationDraftState'
import { useSpatialSessionCamera } from '../../state/spatialSessionState'
import { useSpatialFocusRequest, type SpatialFocusRequest } from '../spatial/useSpatialFocusRequest'
import { miniMapVisualKindForNode } from '../spatial/minimapSemantics'
import { SurfaceObject } from './SurfaceObject'
import { ContextHistoryRail } from './ContextHistoryRail'
import { ContextLensSwitch, type ContextLensId } from './ContextLensSwitch'
import type { ContextSurfaceRuntime } from './surfaceContracts'
import type { SurfaceId } from '../shell/SurfaceDock'
import { SurfaceComponentLayer } from '../spatial/components/SurfaceComponentLayer'
import { boundRegionSemanticForView } from '../spatial/visual/spatialSignal'
import { spatialLodForCount, spatialOverviewProjection } from '../spatial/spatialLod'
import { SurfaceComponentProposalLayer } from '../spatial/components/SurfaceComponentProposalLayer'
import { SurfaceComponentShelf } from '../spatial/components/SurfaceComponentShelf'
import { boundsAroundSurfaceRects, surfaceViewportOrigin } from '../spatial/model/surfaceGeometry'
import { applySurfaceOps, applySurfaceOp, type SurfaceOp, validateSurfaceOps } from '../spatial/model/surfaceOps'
import { SURFACE_COMPONENT_CATALOG, surfaceComponentContract } from '../spatial/model/surfaceComponentCatalog'
import { resolveSurfaceIntent, type SurfaceIntent } from '../spatial/model/surfaceIntent'
import { AgentSurfaceComposer } from './AgentSurfaceComposer'
import type { SurfaceElement } from '../spatial/model/surfaceElementTypes'
import { LCOS_MINDMAP_BRANCH_EXTRACT_EVENT } from '../canvas/MindMapNoteVisual'

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
  onFocusObject?: (id: string) => void
  onImportProjectView?: (memberViewIds: readonly string[]) => string[]
  /** G-4 导图分支摘取/外部文本 → 在当前 Context scope 落一个新文本节点（复用主画布 pasteTextAsNode 链路）。 */
  onExternalTextDrop?: (text: string, x: number, y: number) => void
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

function seedContextComponents(projectId: string, nodes: readonly CanvasNode[], edgeCount: number, historyCount: number, sourceLabel?: string): SurfaceElement[] {
  if (!nodes.length) return []
  const sourceIds = [...nodes]
    .sort((a, b) => Number(Boolean(b.anchors?.length)) - Number(Boolean(a.anchors?.length)))
    .slice(0, Math.min(4, nodes.length))
    .map((node) => node.id)
  const elements: SurfaceElement[] = [{
    id: 'context-bootstrap:source-chain', projectId, surface: 'context', type: 'source-chain',
    bounds: { x: 96, y: 72, w: 680, h: 142 },
    binding: { projectViewIds: sourceIds }, presentation: { variant: sourceLabel || '本轮来源', zIndex: 4 },
  }, {
    id: 'context-bootstrap:structure', projectId, surface: 'context', type: 'structure-map',
    bounds: { x: 96, y: 266, w: 440, h: 320 },
    binding: { projectViewIds: nodes.slice(0, 12).map((node) => node.id) }, presentation: { zIndex: 3 },
  }]
  if (historyCount > 0) elements.push({
    id: 'context-bootstrap:evolution', projectId, surface: 'context', type: 'evolution',
    bounds: { x: 594, y: 266, w: 440, h: 254 },
    binding: { projectViewIds: nodes.slice(0, 8).map((node) => node.id) }, presentation: { zIndex: 3 },
  })
  if (edgeCount > 0) elements.push({
    id: 'context-bootstrap:relationship', projectId, surface: 'context', type: 'relationship-field',
    bounds: { x: 594, y: historyCount > 0 ? 568 : 266, w: 520, h: 300 },
    binding: { projectViewIds: nodes.slice(0, 14).map((node) => node.id) }, presentation: { zIndex: 3 },
  })
  return elements
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
  const stageRef = useRef<HTMLElement | null>(null)
  const [draftPositions, setDraftPositions] = usePresentationDraftPositions(props.projectId, props.scopeId, 'context-space')
  const [pinnedIds, setPinnedIds] = usePresentationDraftPinnedIds(props.projectId, props.scopeId, 'context-space')
  const [surfaceElements, setSurfaceElements, surfaceBootstrapped] = usePresentationSurfaceElements(props.projectId, props.scopeId, 'context-space')
  const [proposalOps, setProposalOps] = useState<readonly SurfaceOp[]>([])
  /** lens 聚焦反馈:短暂高亮被定位/创建的组件,超时自动清除。 */
  const [lensFocusId, setLensFocusId] = useState<string | null>(null)
  const lensFocusTimer = useRef<number | null>(null)
  useEffect(() => () => { if (lensFocusTimer.current !== null) window.clearTimeout(lensFocusTimer.current) }, [])
  // G-4 导图分支摘取（Context 通道）：Context 视图内的导图分支拖出到空白处松手 →
  // 换算本 surface 世界坐标 → onExternalTextDrop（App 建进当前 Context scope 并写入成员集）。
  useEffect(() => {
    if (!props.onExternalTextDrop) return
    const onBranchExtract = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: unknown; clientX?: unknown; clientY?: unknown }>).detail
      if (typeof detail?.text !== 'string' || !detail.text.trim()) return
      const canvas = stageRef.current?.querySelector('[data-spatial-canvas="true"]')
      const rect = canvas?.getBoundingClientRect()
      if (!rect || typeof detail.clientX !== 'number' || typeof detail.clientY !== 'number') return
      if (detail.clientX < rect.left || detail.clientX > rect.right || detail.clientY < rect.top || detail.clientY > rect.bottom) return
      const point = spatialScreenToWorld(detail.clientX, detail.clientY, rect, camera)
      // G-4 落点对齐 ghost：拖拽预览卡片在光标 +14/+16px 处（MindMapNoteVisual ghost transform），
      // 落点计入同一偏移（屏幕像素按 zoom 换世界坐标），否则新节点出现在 ghost 左上方——「位移」感来源。
      const GHOST_OFFSET_X = 14
      const GHOST_OFFSET_Y = 16
      props.onExternalTextDrop!(detail.text, point.x + GHOST_OFFSET_X / camera.zoom, point.y + GHOST_OFFSET_Y / camera.zoom)
    }
    window.addEventListener(LCOS_MINDMAP_BRANCH_EXTRACT_EVENT, onBranchExtract)
    return () => window.removeEventListener(LCOS_MINDMAP_BRANCH_EXTRACT_EVENT, onBranchExtract)
  }, [camera, props.onExternalTextDrop])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const drag = useRef<SpatialPointerSession>(IDLE_SPATIAL_POINTER)
  /** §4.13.2-G-2 整组拖动会话:锚点 + 组员原位(锚点格点收敛后组员按相对偏移一次落位,主画布同款语义)。 */
  const groupDrag = useRef<{ pointerId: number; anchorId: string; members: ReadonlyArray<{ id: string; x: number; y: number }> } | null>(null)
  /** §4.13.2-G-2 组件多选:与节点 Selection 平行的本 surface 组件选中集(框选/Shift·Ctrl 点选进组)。 */
  const [selectedComponentIds, setSelectedComponentIds] = useState<readonly string[]>([])
  const componentIds = useMemo(() => new Set(surfaceElements.map((element) => element.id)), [surfaceElements])
  // 组件被移除后清掉选中残留,避免悬空 id 留在组里。
  useEffect(() => { setSelectedComponentIds((current) => { const next = current.filter((id) => componentIds.has(id)); return next.length === current.length ? current : next }) }, [componentIds])
  const seed = useMemo(() => seedContextPlacement(props.nodes), [props.nodes])
  const items = useMemo(() => props.nodes.map((node) => {
    const fallback = seed.get(node.id) ?? { x: node.x, y: node.y, width: node.width, height: node.height }
    const point = draftPositions[node.id] ?? fallback
    return { node, x: point.x, y: point.y, width: fallback.width, height: fallback.height }
  }), [draftPositions, props.nodes, seed])
  const lod = spatialLodForCount(items.length)
  const byId = useMemo(() => new Map(items.map((item) => [item.node.id, item])), [items])
  const spatialItems = useMemo(() => items.map((item) => ({ id: item.node.id, x: item.x, y: item.y, width: item.width, height: item.height, label: item.node.title, visualKind: miniMapVisualKindForNode(item.node) })), [items])
  /** G-2:组件卡也进框选命中(bounds 与选框相交即选中);小地图仍只看节点,不掺组件。 */
  const componentMarqueeItems = useMemo(() => surfaceElements.map((element) => ({ id: element.id, x: element.bounds.x, y: element.bounds.y, width: element.bounds.w, height: element.bounds.h })), [surfaceElements])
  const marqueeItems = useMemo(() => [...spatialItems, ...componentMarqueeItems], [spatialItems, componentMarqueeItems])
  const renderItems = useMemo(() => {
    const placements = spatialOverviewProjection(items.map((item) => ({ ...item, id: item.node.id })), camera, new Set(props.selectedIds))
    return placements.map(({ id: _id, ...item }) => item)
  }, [camera, items, props.selectedIds])
  const renderIds = useMemo(() => new Set(renderItems.map((item) => item.node.id)), [renderItems])
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
  const spatialFocus = useSpatialFocusRequest({ request: props.focusRequest, items: spatialItems, testId: 'context-space-spatial', camera, setCamera })

  /**
   * §4.13 边缘气泡标点:只对「被标点」对象出气泡——手动固定(pinned)的节点 + 固定的桌上组件。
   * 过滤规则在调用方(此处),CanvasEdgePinLayer 只负责视口外投影与同边缘聚合;
   * 无标点对象移出视口不出气泡(不打扰原则)。
   */
  const edgePinItems = useMemo(() => [
    ...items.filter((item) => pinnedIds.includes(item.node.id)).map((item) => ({
      id: item.node.id,
      label: item.node.title || item.node.subtitle || '未命名对象',
      bounds: { x: item.x, y: item.y, width: item.width, height: item.height },
    })),
    ...surfaceElements.filter((element) => element.presentation?.pinned).map((element) => ({
      id: element.id,
      label: SURFACE_COMPONENT_CATALOG[element.type]?.label ?? element.type,
      bounds: { x: element.bounds.x, y: element.bounds.y, width: element.bounds.w, height: element.bounds.h },
    })),
  ], [items, pinnedIds, surfaceElements])

  /**
   * 边缘气泡点击 = 复用 focusLens 同款相机滑动(对象 bounds → fitSpatialBounds 一划滑过去),
   * 跳转逻辑不新写;对象回到视口内后气泡由几何层自动消失。
   */
  const locateEdgePin = (id: string) => {
    const root = stageRef.current
    if (!root) return
    const target = edgePinItems.find((entry) => entry.id === id)
    if (!target) return
    setCamera(fitSpatialBounds(target.bounds, root.clientWidth || 1, root.clientHeight || 1, 84))
  }

  useEffect(() => {
    if (surfaceBootstrapped || surfaceElements.length || !props.nodes.length) return
    setSurfaceElements(seedContextComponents(props.projectId, props.nodes, visibleEdges.length, props.runtime?.history.length ?? 0, props.source?.label))
  }, [props.nodes, props.projectId, props.runtime?.history.length, props.source?.label, setSurfaceElements, surfaceBootstrapped, surfaceElements.length, visibleEdges.length])

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (event.button !== 0) return
    const item = byId.get(id)
    if (!item) return
    // G-2 整组拖动:按住的是多选成员之一时全组跟手,否则维持单节点(主画布同款语义)。
    const group = props.selectedIds.includes(id) && props.selectedIds.length > 1
      ? props.selectedIds.flatMap((memberId) => { const member = byId.get(memberId); return member ? [{ id: member.node.id, x: member.x, y: member.y }] : [] })
      : [{ id, x: item.x, y: item.y }]
    drag.current = beginSpatialNodeDrag(event.pointerId, id, { x: event.clientX, y: event.clientY }, { x: item.x, y: item.y }, camera.zoom)
    groupDrag.current = { pointerId: event.pointerId, anchorId: id, members: group }
    setDraggingId(id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const next = advanceSpatialNodeDrag(drag.current, { x: event.clientX, y: event.clientY })
    if (!next || drag.current.kind !== 'node-drag') return
    const group = groupDrag.current
    const anchor = group?.members.find((member) => member.id === group.anchorId)
    if (group && anchor && group.members.length > 1) {
      const dx = next.x - anchor.x
      const dy = next.y - anchor.y
      setDraftPositions((current) => ({ ...current, ...Object.fromEntries(group.members.map((member) => [member.id, { x: member.x + dx, y: member.y + dy }])) }))
      return
    }
    setDraftPositions((current) => ({ ...current, [drag.current.kind === 'node-drag' ? drag.current.id : '']: next }))
  }
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = drag.current
    const group = groupDrag.current
    if (session.kind === 'node-drag' && group && group.members.length > 1) {
      // G-2 组拖动收尾:锚点格点收敛、组员保持相对偏移一次落位;被打断则整组回原位。
      const anchor = group.members.find((member) => member.id === group.anchorId)!
      if (event.defaultPrevented) {
        setDraftPositions((current) => ({ ...current, ...Object.fromEntries(group.members.map((member) => [member.id, { x: member.x, y: member.y }])) }))
      } else {
        const final = advanceSpatialNodeDrag(session, { x: event.clientX, y: event.clientY }) ?? session.origin
        const snap = (v: number) => Math.round(v / 24) * 24
        const dx = snap(final.x) - anchor.x
        const dy = snap(final.y) - anchor.y
        setPinnedIds((current) => Array.from(new Set([...current, ...group.members.map((member) => member.id)])))
        setDraftPositions((current) => ({ ...current, ...Object.fromEntries(group.members.map((member) => [member.id, { x: member.x + dx, y: member.y + dy }])) }))
      }
    } else if (session.kind === 'node-drag' && event.defaultPrevented) {
      setDraftPositions((current) => ({ ...current, [session.id]: session.origin }))
    } else if (session.kind === 'node-drag') {
      setPinnedIds((current) => current.includes(session.id) ? current : [...current, session.id])
      // 松手格点吸附(与主画布同一步长):拖动过程连续跟手,只在落点收敛。
      setDraftPositions((current) => {
        const pos = current[session.id]
        if (!pos) return current
        const snap = (v: number) => Math.round(v / 24) * 24
        return { ...current, [session.id]: { ...pos, x: snap(pos.x), y: snap(pos.y) } }
      })
    }
    groupDrag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    drag.current = endSpatialPointer()
    setDraggingId(null)
  }

  /** G-2 框选分流:命中组件 id 进本 surface 组件选中集,节点 id 走全局 Selection(additive 语义与主画布框选一致)。 */
  const handleMarqueeSelect = (ids: string[], additive: boolean) => {
    const componentHits = ids.filter((id) => componentIds.has(id))
    const nodeIds = ids.filter((id) => !componentIds.has(id))
    setSelectedComponentIds((current) => {
      if (componentHits.length) return additive ? Array.from(new Set([...current, ...componentHits])) : componentHits
      return additive ? current : []
    })
    props.onMarqueeSelect?.(nodeIds, additive)
  }
  /** G-2 组件点选(受控):Shift/Ctrl 切换、普通点击单选重置——与节点点选同语义。 */
  const handleComponentSelect = (id: string, additive: boolean) => {
    setSelectedComponentIds((current) => additive
      ? current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
      : current.length === 1 && current[0] === id ? current : [id])
  }

  const previewIntent = (intent: SurfaceIntent) => {
    const ops = resolveSurfaceIntent(intent, { projectId: props.projectId, surface: 'context', existing: surfaceElements, selectionBounds: selectedSurfaceBounds, viewportOrigin: componentViewportOrigin })
    setProposalOps(validateSurfaceOps(surfaceElements, ops).ok ? ops : [])
  }
  const keepProposal = () => { setSurfaceElements(applySurfaceOps(surfaceElements, proposalOps)); setProposalOps([]) }

  /**
   * 2R 收口:lens 三键 = 桌上组件聚焦,不再整页切换(平行旧入口的放大镜语义只保留在投影节点 launcher 上)。
   * 「现场」= 回到全部材料的视野;「结构/演进」= 画布上找对应组件并把相机对准它,画布上还没有就现场创建一个。
   */
  const focusLens = (lens: ContextLensId) => {
    const root = stageRef.current
    if (!root) return
    // SurfaceBounds 用 w/h,相机层的 SpatialBounds 用 width/height——此处做一次形状转换。
    const fit = (bounds: { x: number; y: number; w: number; h: number }) => setCamera(fitSpatialBounds({ x: bounds.x, y: bounds.y, width: bounds.w, height: bounds.h }, root.clientWidth || 1, root.clientHeight || 1, 84))
    if (lens === 'context-space') {
      if (spatialItems.length) setCamera(fitSpatialBounds(spatialBoundsForPlacements(spatialItems, 64), root.clientWidth || 1, root.clientHeight || 1, 84))
      return
    }
    const type = lens === 'context-tree' ? 'structure-map' : 'evolution'
    const flashFocus = (id: string) => {
      setLensFocusId(id)
      if (lensFocusTimer.current !== null) window.clearTimeout(lensFocusTimer.current)
      lensFocusTimer.current = window.setTimeout(() => setLensFocusId(null), 1400)
    }
    const existing = surfaceElements.find((element) => element.surface === 'context' && element.type === type)
    if (existing) { fit(existing.bounds); flashFocus(existing.id); return }
    // 画布上还没有该理解组件 → 以当前 Context 成员为绑定现场创建,再聚焦(与 Shelf 同一创建契约)。
    const contract = surfaceComponentContract(type)
    const component: SurfaceElement = {
      id: `context-lens:${type}:${Date.now().toString(36)}`,
      projectId: props.projectId,
      surface: 'context',
      type,
      bounds: { x: componentViewportOrigin.x + 120, y: componentViewportOrigin.y + 96, w: contract.minSize.w, h: contract.minSize.h },
      binding: { projectViewIds: items.slice(0, 12).map((item) => item.node.id) },
      presentation: { zIndex: 3 },
    }
    setSurfaceElements(applySurfaceOp(surfaceElements, { type: 'create-component', component }))
    fit(component.bounds)
    flashFocus(component.id)
  }

  const overlay = <>
    {!items.length && <div className="lcos-context-space-empty"><Layers3 size={19}/><strong>把需要一起理解的材料拖进来</strong><span>可以直接阅读、摘取、组织，放进来的材料就在这里一起被理解。</span></div>}
    <SurfaceComponentShelf projectId={props.projectId} surface="context" elements={surfaceElements} selectionIds={props.selectedIds} selectionBounds={selectedSurfaceBounds} viewportOrigin={componentViewportOrigin} onElementsChange={setSurfaceElements}/>
    <AgentSurfaceComposer surface="context" targetIds={props.selectedIds} previewing={proposalOps.length > 0} onPreview={previewIntent} onKeep={keepProposal} onRevert={() => setProposalOps([])}/>
  </>

  return <section className="lcos-dedicated-surface lcos-context-space" data-testid="surface-context-space" ref={stageRef}>
    <header className="lcos-surface-heading lcos-context-space-heading">
      <div><strong>上下文</strong><span>理解现场</span></div>
      <div className="lcos-context-heading-actions"><small>{items.length} 项 · 同一份 Context · 三键在桌上定位/创建组件</small><ContextLensSwitch active="context-space" onSelect={(surface) => { if (surface === 'context-space' || surface === 'context-tree' || surface === 'context-flow') focusLens(surface) }}/></div>
    </header>
    <SpatialCanvas surfaceRef={`scope:${props.scopeId}`} camera={camera} setCamera={setCamera} marqueeItems={marqueeItems} minimapItems={spatialItems} minimapLabel="Context" beacon={spatialFocus.beacon} onBeaconArrivalEnd={spatialFocus.clearBeacon} onMarqueeSelect={handleMarqueeSelect} className="lcos-context-space-stage lcos-presentation-spatial" worldClassName="lcos-presentation-world lcos-context-space-world" testId="context-space-spatial" overlays={overlay} edgePinItems={edgePinItems} onEdgePinLocate={locateEdgePin} onPointerCancel={() => { drag.current = endSpatialPointer(); groupDrag.current = null; setDraggingId(null) }} onExternalDrop={(kind, raw, _screen, point) => {
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
      <SurfaceComponentLayer surface="context" elements={surfaceElements} zoom={camera.zoom} lensFocusId={lensFocusId} selectionIds={selectedComponentIds} onSelectElement={handleComponentSelect} renderContext={{ nodes: props.nodes, edges: visibleEdges, hierarchy, history: props.runtime?.history, onSelectNode: props.onSelect, onOpenNode: props.onDoubleClick, onOpenHistorySource: props.runtime?.onOpenHistorySource }} onElementsChange={setSurfaceElements}/>
      <SurfaceComponentProposalLayer surface="context" elements={proposalElements} renderContext={{ nodes: props.nodes, edges: visibleEdges, hierarchy, history: props.runtime?.history }}/>
      <SpatialEdgeLayer bounds={edgeBounds} className="lcos-context-space-edges" ariaLabel="Context 关系">
        <defs><marker id="lcos-context-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z"/></marker></defs>
        {visibleEdges.filter((edge) => renderIds.has(edge.from) && renderIds.has(edge.to)).map((edge) => {
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
        {renderItems.map((item, index) => <div key={item.node.id} className={`lcos-context-space-node lcos-spatial-placement ${props.selectedIds.includes(item.node.id) ? 'selected' : ''} ${draggingId === item.node.id ? 'is-dragging' : ''} ${pinnedIds.includes(item.node.id) ? 'is-manual-anchor' : ''}`} data-attention-bucket={props.attentionBucketsByViewId?.[item.node.id]} style={{ left: item.x, top: item.y, width: item.width, '--i': index } as CSSProperties} onPointerDown={(event) => beginDrag(event, item.node.id)} onPointerMove={moveDrag} onPointerUp={endDrag}>
          <SurfaceObject node={item.node} zoom={camera.zoom} compact={lod !== 'full'} performanceProxy={(lod === 'aggregate' || lod === 'overview') && !props.selectedIds.includes(item.node.id)} selected={props.selectedIds.includes(item.node.id)} spatialSemantic={boundRegionSemanticForView(surfaceElements, item.node.id)} usageHint={item.node.anchors?.length ? '来源锚点' : undefined} attentionBucket={props.attentionBucketsByViewId?.[item.node.id] === 'pinned' ? 'pinned' : props.attentionBucketsByViewId?.[item.node.id] === 'related' ? 'related' : props.attentionBucketsByViewId?.[item.node.id] === 'retrieved' ? 'retrieved' : undefined} dropIds={props.selectedIds.includes(item.node.id) && props.selectedIds.length ? props.selectedIds : [item.node.id]} onDirectProjectViewDrop={props.onDirectProjectViewDrop} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick} onLocate={props.onFocusObject} orbitEligible={props.selectedIds.length <= 1}/>
          {pinnedIds.includes(item.node.id) && <i className="lcos-manual-anchor-mark" title="手工位置锚点"/>}
        </div>)}
      </SpatialNodeLayer>
    </SpatialCanvas>
    {props.runtime && <ContextHistoryRail history={props.runtime.history} handoffs={props.runtime.handoffs} onBranch={props.runtime.onBranchHistory} onCompare={props.runtime.onCompareHistory} onSource={props.runtime.onOpenHistorySource}/>}
  </section>
}
