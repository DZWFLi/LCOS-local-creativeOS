import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Crosshair, GitBranch, MapPin, Pencil, Plus } from 'lucide-react'
import { CollectionGlyph, ContextGlyph, RootGlyph, WorkflowGlyph } from '../design/LcosGlyphs'
import type { RunStatus } from '../../model'
import { LightCurtain } from '../drop/LightCurtain'
import { NEW_SCENE_DROP_TARGET_ID, semanticDropTriggerFromPointer, type SemanticDropTrigger } from '../spatial/semanticDrop'
import { useProjectSpatialMarkersOrNull } from '../spatial/ProjectSpatialMarkerContext'
import { markerForNavigationTarget, stableRailSurfaceRef } from '../spatial/spatialNavigationFamily'

export type ProjectRailViewKind = 'scene' | 'collection' | 'context' | 'workflow'

/** Rail 预览用成员几何投影：来自真实 CanvasNode 的 x/y/width/height + 文件类型。 */
export interface RailMemberPreview {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  /** detectFileIdentity 结果（image/pdf/markdown…）；嵌套实体视图固定为 'entity'。 */
  readonly kind: string
}

export interface RailMemberPlacement {
  readonly id: string
  readonly kind: string
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface RailMiniLayout {
  readonly placed: readonly RailMemberPlacement[]
  readonly overflow: number
  readonly entityCount: number
}

export interface ProjectRailViewItem {
  id: string
  title: string
  kind: ProjectRailViewKind
  memberCount: number
  memberViewIds?: readonly string[]
  /** 成员真实节点投影（App 由 collectionMembersByNodeId 聚合），预览据此画真 mini 布局。 */
  memberNodes?: readonly RailMemberPreview[]
  /** Project View identities dragged when this aggregate rail item is used as a node. */
  dragViewIds?: readonly string[]
  /** Existing Workspace id when this rail item is backed by a Workspace. */
  workspaceId?: string
  /** Existing Scope id when this rail item opens a saved Collection/Context scope. */
  scopeId?: string
  active?: boolean
  attention?: boolean
}

interface Props {
  views: ProjectRailViewItem[]
  runStatus: RunStatus | null
  onOverview: () => void
  onActivateView: (view: ProjectRailViewItem) => void
  onLocateWorkspace?: (workspaceId: string) => void
  onAdd: () => void
  onDeleteWorkspace?: (workspaceId: string) => void
  /** 左键拖拽排序：把视图移动到目标索引（一次性原子提交）。 */
  onReorderRailView?: (viewId: string, targetIndex: number) => void
  /** 删除 scope-backed 视图（Context / Workflow / Collection），走确认后删除。 */
  onDeleteScope?: (scopeId: string, label: string) => void
  /** 悬浮卡片内联重命名（workspace-backed 视图）。 */
  onRenameWorkspace?: (workspaceId: string, label: string) => void
  /** 悬浮卡片内联重命名（scope-backed 视图）。 */
  onRenameScope?: (scopeId: string, label: string) => void
  /** Semantic cross-surface Drop shares one interaction contract across pointer triggers. */
  onDirectProjectViewDrop?: (targetId: string, sourceIds: readonly string[]) => void
}

interface RailSemanticDropSession {
  pointerId: number
  sourceViewId: string
  sourceIds: string[]
  startX: number
  startY: number
  moved: boolean
  target: HTMLElement | null
  trigger: SemanticDropTrigger
  buttonMask: number
}

interface RailDropGhost {
  x: number
  y: number
  count: number
  label: string
}

interface RailLeftDragSession {
  pointerId: number
  viewId: string
  identity: string
  title: string
  canDelete: boolean
  deleteKind: 'workspace' | 'scope' | null
  fromIndex: number
  startX: number
  startY: number
  moved: boolean
  mode: 'reorder' | 'delete' | null
  targetIndex: number
  liveTarget: number
  pointerX: number
  pointerY: number
}

function previewLabel(kind: ProjectRailViewKind) {
  if (kind === 'scene') return '工作现场'
  if (kind === 'context') return '上下文版本'
  if (kind === 'workflow') return '工作流'
  return '节点集合'
}

function RailGlyph({ kind }: { kind: ProjectRailViewKind }) {
  if (kind === 'scene') return <RootGlyph/>
  if (kind === 'context') return <ContextGlyph/>
  if (kind === 'workflow') return <WorkflowGlyph/>
  return <CollectionGlyph/>
}

/**
 * Rail micro objects are species marks, not miniature cards. The hover preview
 * below remains the truthful member-geometry projection. Small seeds instead
 * preserve LCOS visual identity so they stay readable while dragged.
 */
function RailMicroObject({ view }: { view: ProjectRailViewItem }) {
  const density = Math.min(5, Math.max(0, view.memberCount))
  return <span className={`lcos-rail-native-micro kind-${view.kind}`} data-density={density} aria-hidden="true">
    <RailGlyph kind={view.kind}/>
    {view.kind === 'collection' && <span className="lcos-rail-folder-members">{Array.from({ length: Math.min(3, density) }, (_, index) => <i key={index}/>)}</span>}
    {view.kind === 'context' && <span className="lcos-rail-context-matrix">{Array.from({ length: 6 }, (_, index) => <i key={index} data-on={index < density + 1 ? '' : undefined}/>)}</span>}
    {view.kind === 'workflow' && <span className="lcos-rail-workflow-segments"><i/><i/><i/></span>}
    {view.kind === 'scene' && <span className="lcos-rail-scene-dust"><i/><i/><i/></span>}
  </span>
}

const MEMBER_KIND_LABELS: Record<string, string> = {
  image: '图片', video: '视频', audio: '音频', pdf: 'PDF', ppt: 'PPT',
  markdown: '文本', link: '链接', archive: '压缩包', file: '文件', entity: '实体',
}

function memberKindLabel(kind: string): string {
  return MEMBER_KIND_LABELS[kind] ?? '对象'
}

/**
 * 真 mini 布局（纯函数）：成员按真实 x/y 归一化到百分比面板，与画布
 * WorkspaceProjectionObject 的 workspaceMiniLayout 同一几何语义；嵌套实体视图
 * （scope:/workspace: 前缀）不参与几何（与画布投影一致），计入 entityCount。
 */
export function railMemberLayout(members: readonly RailMemberPreview[], limit: number): RailMiniLayout {
  const geometric = members.filter((member) => !member.id.startsWith('scope:') && !member.id.startsWith('workspace:'))
  const entityCount = members.length - geometric.length
  const shown = geometric.slice(0, limit)
  if (!shown.length) return { placed: [], overflow: 0, entityCount }
  const left = Math.min(...shown.map((member) => member.x))
  const top = Math.min(...shown.map((member) => member.y))
  const right = Math.max(...shown.map((member) => member.x + Math.max(1, member.width)))
  const bottom = Math.max(...shown.map((member) => member.y + Math.max(1, member.height)))
  const spanX = Math.max(1, right - left)
  const spanY = Math.max(1, bottom - top)
  return {
    placed: shown.map((member) => ({
      id: member.id,
      kind: member.kind,
      left: 6 + ((member.x - left) / spanX) * 72,
      top: 7 + ((member.y - top) / spanY) * 64,
      width: Math.max(8, Math.min(24, (Math.max(1, member.width) / spanX) * 72)),
      height: Math.max(10, Math.min(28, (Math.max(1, member.height) / spanY) * 64)),
    })),
    overflow: geometric.length - shown.length,
    entityCount,
  }
}

/** 成员类型真实分布（纯函数）：按 kind 计数降序，用于统计行退路。 */
export function memberKindDistribution(members: readonly RailMemberPreview[]): readonly { readonly kind: string; readonly count: number }[] {
  const counts = new Map<string, number>()
  for (const member of members) counts.set(member.kind, (counts.get(member.kind) ?? 0) + 1)
  return [...counts.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind))
}

/** hover 卡片成员统计行（纯函数）：真实总数 + 类型分布（最多 3 类）。 */
export function memberSummaryLine(view: ProjectRailViewItem): string {
  if (!view.memberCount) return '空视图'
  const members = view.memberNodes
  if (!members?.length) return `${view.memberCount} 个对象`
  const distribution = memberKindDistribution(members).slice(0, 3)
  if (!distribution.length) return `${view.memberCount} 个对象`
  return `${view.memberCount} 个对象 · ${distribution.map(({ kind, count }) => `${memberKindLabel(kind)}×${count}`).join(' ')}`
}

/**
 * 真实成员预览：优先按成员真实 x/y 归一化排 mini 布局（与画布投影同一几何来源），
 * 无几何数据时退回真实统计（计数/类型分布）。绝不渲染装饰性假几何。
 */
function RealMemberPreview({ view, large = false, kindClass }: { view: ProjectRailViewItem; large?: boolean; kindClass: string }) {
  const members = view.memberNodes
  // 数据边界：该视图聚合拿不到成员节点投影，只显示真实计数（0 = 空视图）。
  if (!members || !members.length) {
    return <span className={`${kindClass} lcos-rail-member-empty ${large ? 'is-large' : ''}`} aria-hidden="true">
      {large ? <em>{view.memberCount ? `${view.memberCount} 个对象 · 暂无布局数据` : '空视图'}</em> : <b>{view.memberCount || 0}</b>}
    </span>
  }
  const layout = railMemberLayout(members, large ? 12 : 6)
  if (layout.placed.length) {
    return <span
      className={`${kindClass} lcos-rail-member-map ${large ? 'is-large' : ''}`}
      {...(large ? { role: 'img' as const, 'aria-label': `成员真实布局：共 ${members.length} 个成员` } : { 'aria-hidden': true })}>
      {layout.placed.map(({ id, kind, left, top, width, height }) => <span key={id} className="lcos-rail-member-cell" data-member-kind={kind} title={memberKindLabel(kind)} style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}/>)}
      {layout.overflow > 0 && <b className="lcos-rail-member-overflow" title={`另有 ${layout.overflow} 个成员未显示`}>+{layout.overflow}</b>}
    </span>
  }
  // 有成员但无几何坐标（如全部为实体引用）：真实类型分布退路，不画假图形。
  const distribution = memberKindDistribution(members)
  return <span className={`${kindClass} lcos-rail-member-stats ${large ? 'is-large' : ''}`} aria-hidden="true">
    {large
      ? distribution.map(({ kind, count }) => <em key={kind}>{memberKindLabel(kind)}×{count}</em>)
      : <b>{members.length}</b>}
  </span>
}

function ScenePreview({ view, large = false }: { view: ProjectRailViewItem; large?: boolean }) {
  return <RealMemberPreview view={view} large={large} kindClass="lcos-rail-preview-scene"/>
}

function CollectionPreview({ view, large = false }: { view: ProjectRailViewItem; large?: boolean }) {
  return <RealMemberPreview view={view} large={large} kindClass="lcos-rail-preview-collection"/>
}

function ContextPreview({ view, large = false }: { view: ProjectRailViewItem; large?: boolean }) {
  return <RealMemberPreview view={view} large={large} kindClass="lcos-rail-preview-context"/>
}

function WorkflowPreview({ view, large = false }: { view: ProjectRailViewItem; large?: boolean }) {
  return <RealMemberPreview view={view} large={large} kindClass="lcos-rail-preview-workflow"/>
}

function ViewPreview({ view, large = false }: { view: ProjectRailViewItem; large?: boolean }) {
  if (!large) return <RailMicroObject view={view}/>
  if (view.kind === 'scene') return <ScenePreview view={view} large/>
  if (view.kind === 'context') return <ContextPreview view={view} large/>
  if (view.kind === 'workflow') return <WorkflowPreview view={view} large/>
  return <CollectionPreview view={view} large/>
}

/**
 * Project Spatial Switcher.
 *
 * Scene / Collection / Context / Workflow are flat peers in the UI. This component is
 * deliberately a projection over existing Scope/Workspace/Presentation state;
 * it does not create a second project ontology.
 */
export function WorkspaceRailVNext({ views, runStatus, onOverview, onActivateView, onLocateWorkspace, onAdd, onDeleteWorkspace, onReorderRailView, onDeleteScope, onRenameWorkspace, onRenameScope, onDirectProjectViewDrop }: Props) {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [dropGhost, setDropGhost] = useState<RailDropGhost | null>(null)
  const [dropHot, setDropHot] = useState(false)
  const [leftDrag, setLeftDrag] = useState<RailLeftDragSession | null>(null)
  const [renameFor, setRenameFor] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [autoTwoColumn, setAutoTwoColumn] = useState(false)
  const [columnOverride, setColumnOverride] = useState<'one' | 'two' | null>(null)
  const [columnDrag, setColumnDrag] = useState<{ pointerId: number; startX: number; startOverride: 'one' | 'two' | null; preview: 'one' | 'two' } | null>(null)
  const railRef = useRef<HTMLElement | null>(null)
  const stackRef = useRef<HTMLDivElement | null>(null)
  const semanticDrop = useRef<RailSemanticDropSession | null>(null)
  const suppressClickRef = useRef(false)
  const previewCloseTimer = useRef<number | null>(null)
  const markerRuntime = useProjectSpatialMarkersOrNull()
  const markerRecordsForSurface = (surfaceRef: string) => markerRuntime?.records.filter((record) => record.resolution?.status === 'resolved' && record.resolution.target.surfaceRef === surfaceRef) ?? []
  const railMarkerForView = (view: ProjectRailViewItem) => {
    if (!markerRuntime) return null
    const surfaceRef = stableRailSurfaceRef(view)
    if (!surfaceRef) return null
    return markerForNavigationTarget(markerRuntime.records, { projectId: markerRuntime.projectId, kind: 'surface', id: surfaceRef })
  }
  const railMarkerCount = (view: ProjectRailViewItem) => {
    const surfaceRef = stableRailSurfaceRef(view)
    return surfaceRef ? markerRecordsForSurface(surfaceRef).length : 0
  }
  const mainMarkerCount = markerRecordsForSurface('main').length
  const toggleRailLandmark = (view: ProjectRailViewItem) => {
    if (!markerRuntime) return
    const surfaceRef = stableRailSurfaceRef(view)
    if (!surfaceRef) return
    const targetRef = { projectId: markerRuntime.projectId, kind: 'surface' as const, id: surfaceRef }
    const marker = markerForNavigationTarget(markerRuntime.records, targetRef)
    if (marker) void markerRuntime.deleteMarker(marker.id)
    else void markerRuntime.createMarker({ targetRef, scope: 'cross-surface' })
  }

  const twoColumn = columnOverride === 'two' || (columnOverride === null && autoTwoColumn)
  const effectiveTwoColumn = columnDrag ? columnDrag.preview === 'two' : twoColumn

  // 视图多到单列放不下时默认自适应双列；用户仍可拖拽 rail 右缘强制单/双列。
  useEffect(() => {
    const el = stackRef.current
    if (!el) return
    const measure = () => {
      const pitch = 42 + 7
      const capacity = Math.max(3, Math.floor(el.clientHeight / pitch))
      setAutoTwoColumn(views.length > capacity)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [views.length])

  useEffect(() => {
    if (effectiveTwoColumn) document.documentElement.style.setProperty('--lcos-rail-w', '104px')
    else document.documentElement.style.removeProperty('--lcos-rail-w')
    return () => { document.documentElement.style.removeProperty('--lcos-rail-w') }
  }, [effectiveTwoColumn])

  const keepPreviewOpen = () => {
    if (previewCloseTimer.current !== null) {
      window.clearTimeout(previewCloseTimer.current)
      previewCloseTimer.current = null
    }
  }

  const schedulePreviewClose = (viewId: string) => {
    if (previewCloseTimer.current !== null) window.clearTimeout(previewCloseTimer.current)
    previewCloseTimer.current = window.setTimeout(() => {
      previewCloseTimer.current = null
      setPreviewId((current) => current === viewId ? null : current)
    }, 220)
  }

  useEffect(() => {
    return () => { if (previewCloseTimer.current !== null) window.clearTimeout(previewCloseTimer.current) }
  }, [])

  // 拖拽 rail 右缘：右拉超过阈值 = 双列，左拉 = 单列；拖回原宽度则恢复自动。
  const beginColumnDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    setColumnDrag({ pointerId: event.pointerId, startX: event.clientX, startOverride: columnOverride, preview: twoColumn ? 'two' : 'one' })
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* synthetic */ }
  }

  const moveColumnDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const session = columnDrag
    if (!session || session.pointerId !== event.pointerId) return
    event.preventDefault()
    const dx = event.clientX - session.startX
    const preview: 'one' | 'two' = dx > 22 ? 'two' : dx < -22 ? 'one' : (session.startOverride ?? (autoTwoColumn ? 'two' : 'one'))
    if (preview !== session.preview) setColumnDrag({ ...session, preview })
  }

  const finishColumnDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const session = columnDrag
    if (!session || session.pointerId !== event.pointerId) return
    event.preventDefault()
    try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* already released */ }
    const dx = event.clientX - session.startX
    setColumnOverride(dx > 22 ? 'two' : dx < -22 ? 'one' : session.startOverride)
    setColumnDrag(null)
  }

  const clearDropTarget = () => {
    semanticDrop.current?.target?.classList.remove('is-direct-drop-target')
    if (semanticDrop.current) semanticDrop.current.target = null
  }

  const directTargetAt = (clientX: number, clientY: number, sourceViewId: string) => {
    const candidate = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-project-view-drop-target]') ?? null
    if (!candidate) return null
    const targetId = candidate.dataset.projectViewDropTarget
    if (!targetId || targetId === sourceViewId) return null
    return candidate
  }

  const beginRailSemanticDrop = (event: ReactPointerEvent<HTMLDivElement>, view: ProjectRailViewItem) => {
    const trigger = semanticDropTriggerFromPointer(event)
    if (!trigger || !onDirectProjectViewDrop) return false
    const sourceIds = [...(view.dragViewIds ?? view.memberViewIds ?? [])]
    if (!sourceIds.length) return false
    event.preventDefault()
    event.stopPropagation()
    setPreviewId(null)
    clearDropTarget()
    semanticDrop.current = {
      pointerId: event.pointerId,
      sourceViewId: view.id,
      sourceIds,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      target: null,
      trigger,
      buttonMask: trigger === 'secondary-pointer' ? 2 : 1,
    }
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* browser may own capture */ }
    setDropGhost({ x: event.clientX, y: event.clientY, count: sourceIds.length, label: 'Semantic Drop' })
    setDropHot(false)
    return true
  }

  const moveRailSemanticDrop = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = semanticDrop.current
    if (!session || session.pointerId !== event.pointerId) return
    if (event.pointerType === 'mouse' && ((event.buttons ?? session.buttonMask) & session.buttonMask) === 0) {
      cancelRailSemanticDrop(event)
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY)
    if (distance > 4) session.moved = true
    const target = directTargetAt(event.clientX, event.clientY, session.sourceViewId)
    if (target !== session.target) {
      session.target?.classList.remove('is-direct-drop-target')
      target?.classList.add('is-direct-drop-target')
      session.target = target
    }
    const label = target?.dataset.projectViewDropLabel ? `→ ${target.dataset.projectViewDropLabel}` : '投送'
    setDropGhost({ x: event.clientX, y: event.clientY, count: session.sourceIds.length, label })
    setDropHot(Boolean(target))
  }

  const finishRailSemanticDrop = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = semanticDrop.current
    if (!session || session.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    const target = session.target
    const targetId = target?.dataset.projectViewDropTarget
    target?.classList.remove('is-direct-drop-target')
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    semanticDrop.current = null
    setDropGhost(null)
    setDropHot(false)
    if (session.moved && targetId) onDirectProjectViewDrop?.(targetId, session.sourceIds)
  }

  const cancelRailSemanticDrop = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = semanticDrop.current
    if (!session || session.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    session.target?.classList.remove('is-direct-drop-target')
    try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* already released */ }
    semanticDrop.current = null
    setDropGhost(null)
    setDropHot(false)
  }

  const computeTargetIndex = (clientX: number, clientY: number) => {
    const stack = stackRef.current
    if (!stack) return 0
    const items = Array.from(stack.querySelectorAll<HTMLElement>('.lcos-workspace-rail-item'))
    if (!items.length) return 0
    let nearest = 0
    let best = Infinity
    items.forEach((item, index) => {
      const rect = item.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const distance = (clientX - cx) ** 2 + (clientY - cy) ** 2
      if (distance < best) { best = distance; nearest = index }
    })
    const rect = items[nearest].getBoundingClientRect()
    return clientY > rect.top + rect.height / 2 ? nearest + 1 : nearest
  }

  const beginLeftDrag = (event: ReactPointerEvent<HTMLDivElement>, view: ProjectRailViewItem, index: number) => {
    if (event.button !== 0) return
    const canReorder = Boolean(onReorderRailView)
    const canDelete = Boolean((view.workspaceId && onDeleteWorkspace) || (view.scopeId && onDeleteScope))
    if (!canReorder && !canDelete) return
    suppressClickRef.current = false
    setPreviewId(null)
    setLeftDrag({
      pointerId: event.pointerId,
      viewId: view.id,
      identity: view.workspaceId ?? view.scopeId ?? view.id,
      title: view.title,
      canDelete,
      deleteKind: view.workspaceId ? 'workspace' : view.scopeId ? 'scope' : null,
      fromIndex: index,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      mode: null,
      targetIndex: index,
      liveTarget: index,
      pointerX: event.clientX,
      pointerY: event.clientY,
    })
    // 不在此处抢占 pointer capture：立即捕获会把随后的 click 也重定向到容器，
    // 导致单击视图失效。只有真正拖起来（moveLeftDrag 超过阈值）才捕获。
    event.preventDefault()
  }

  const moveLeftDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = leftDrag
    if (!session || session.pointerId !== event.pointerId) return
    event.preventDefault()
    const moved = session.moved || Math.hypot(event.clientX - session.startX, event.clientY - session.startY) > 4
    if (!moved) return
    if (!session.moved) {
      try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* synthetic or already released */ }
    }
    const railRect = railRef.current?.getBoundingClientRect()
    const dx = event.clientX - session.startX
    // 删除区：明显向左甩（dx<-24）且指针进入 rail 左沿 20px 带（rail 贴屏幕左缘，
    // 用 x 绝对位置判定；松手后有确认弹窗兜底，防误触）。
    const inDeleteZone = session.canDelete && Boolean(railRect) && dx < -24 && event.clientX < (railRect?.left ?? 0) + 20
    if (inDeleteZone) {
      setLeftDrag({ ...session, moved: true, mode: 'delete', pointerX: event.clientX, pointerY: event.clientY })
      return
    }
    if (!onReorderRailView) {
      setLeftDrag({ ...session, moved: true, mode: null, pointerX: event.clientX, pointerY: event.clientY })
      return
    }
    const target = computeTargetIndex(event.clientX, event.clientY)
    setLeftDrag({ ...session, moved: true, mode: 'reorder', targetIndex: target, liveTarget: target, pointerX: event.clientX, pointerY: event.clientY })
  }

  const finishLeftDrag = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const session = leftDrag
    if (!session || session.pointerId !== event.pointerId) return
    try { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* already released */ }
    if (session.moved) suppressClickRef.current = true
    if (!cancelled && session.moved && session.mode === 'delete' && session.canDelete) {
      if (session.deleteKind === 'workspace') onDeleteWorkspace?.(session.identity)
      else onDeleteScope?.(session.identity, session.title)
    } else if (!cancelled && session.moved && session.mode === 'reorder' && onReorderRailView) {
      const adjusted = session.targetIndex > session.fromIndex ? session.targetIndex - 1 : session.targetIndex
      if (adjusted !== session.fromIndex) onReorderRailView(session.identity, adjusted)
    }
    setLeftDrag(null)
  }

  const slotPos = (index: number) => {
    if (twoColumn) return { x: (index % 2) * 48, y: Math.floor(index / 2) * 48 }
    return { x: 0, y: index * 49 }
  }

  /** 安卓桌面式让位：拖拽时相邻项实时向空位平移一格。 */
  const shiftFor = (index: number): string | undefined => {
    const session = leftDrag
    if (!session || session.mode !== 'reorder') return undefined
    const from = session.fromIndex
    const target = session.liveTarget
    let to = index
    if (from < target && index > from && index <= target) to = index - 1
    else if (from > target && index >= target && index < from) to = index + 1
    else return undefined
    const a = slotPos(index)
    const b = slotPos(to)
    return `translate(${b.x - a.x}px, ${b.y - a.y}px)`
  }

  const commitRename = (view: ProjectRailViewItem) => {
    if (renameFor !== view.id) return
    const value = renameValue.trim()
    setRenameFor(null)
    if (!value || value === view.title) return
    if (view.workspaceId && onRenameWorkspace) onRenameWorkspace(view.workspaceId, value)
    else if (view.scopeId && onRenameScope) onRenameScope(view.scopeId, value)
  }

  const canRename = (view: ProjectRailViewItem) => Boolean((view.workspaceId && onRenameWorkspace) || (view.scopeId && onRenameScope))

  const beginRename = (view: ProjectRailViewItem) => {
    if (!canRename(view)) return
    setRenameValue(view.title)
    setRenameFor(view.id)
  }

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (railRef.current && !railRef.current.contains(event.target as Node)) { setPreviewId(null) }
    }
    const esc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      clearDropTarget()
      semanticDrop.current = null
      setDropGhost(null)
      setDropHot(false)
      setPreviewId(null)
      setLeftDrag(null)
      setRenameFor(null)
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', esc) }
  }, [])

  const preview = useMemo(() => previewId ? views.find((view) => view.id === previewId) ?? null : null, [previewId, views])

  return <aside ref={railRef} className={`vnext-workspace-rail lcos-workspace-rail lcos-project-view-rail ${effectiveTwoColumn ? 'is-two-column' : ''} ${columnDrag ? 'is-resizing' : ''}`} data-testid="workspace-dock" data-spatial-viewport-occupant="left" aria-label="项目视图" onContextMenu={(event) => event.preventDefault()}>
    <div className="lcos-rail-primary">
      <button type="button" data-rail-kind="main" className={views.every((view) => !view.active) ? 'vnext-rail-button active' : 'vnext-rail-button'} title={mainMarkerCount ? `主画布 · ${mainMarkerCount} 个导航重点` : '主画布（固定入口）'} aria-label={mainMarkerCount ? `主画布，${mainMarkerCount} 个导航重点` : '主画布'} onClick={() => { setPreviewId(null); onOverview() }}><RootGlyph/>{mainMarkerCount > 0 && <span className="lcos-rail-landmark is-count" aria-hidden="true"><MapPin size={9}/><b>{mainMarkerCount}</b></span>}</button>
      <div className="vnext-rail-divider"/>
      <div ref={stackRef} className={`vnext-workspace-stack lcos-project-view-stack ${leftDrag?.mode === 'delete' ? 'is-deleting' : ''} ${leftDrag ? 'is-dragging' : ''}`} role="list">
        {views.map((view, index) => {
          const attention = Boolean(view.attention || (view.active && runStatus && ['waiting_input', 'review', 'failed'].includes(runStatus)))
          const shift = shiftFor(index)
          const isSource = leftDrag?.viewId === view.id
          return <div className={`lcos-workspace-rail-item lcos-project-view-item kind-${view.kind} ${isSource ? 'is-drag-source' : ''}`} key={view.id} data-rail-kind={view.kind}
            style={shift ? { transform: shift } : undefined}
            data-project-view-drop-target={view.id}
            data-project-view-drop-kind={view.kind}
            data-project-view-drop-label={view.title}
            draggable={false}
            onDragStart={(event) => {
              // Legacy HTML5 payload stays for migration/fixture compatibility,
              // but native HTML5 drag is disabled above. Semantic Drop uses its own pointer session.
              const members = view.dragViewIds ?? view.memberViewIds ?? []
              if (!members.length) { event.preventDefault(); return }
              event.dataTransfer.setData('application/x-lcos-project-view', JSON.stringify({ id: view.id, kind: view.kind, memberViewIds: members }))
              if (view.workspaceId) event.dataTransfer.setData('application/x-lcos-workspace', view.workspaceId)
              event.dataTransfer.effectAllowed = 'copy'
            }}
            onPointerDown={(event) => { suppressClickRef.current = false; if (beginRailSemanticDrop(event, view)) return; if (event.button === 0) beginLeftDrag(event, view, index) }}
            onPointerMove={(event) => { if (semanticDrop.current?.pointerId === event.pointerId) moveRailSemanticDrop(event); else moveLeftDrag(event) }}
            onPointerUp={(event) => { if (semanticDrop.current?.pointerId === event.pointerId) finishRailSemanticDrop(event); else finishLeftDrag(event) }}
            onPointerCancel={(event) => { if (semanticDrop.current?.pointerId === event.pointerId) cancelRailSemanticDrop(event); else finishLeftDrag(event, true) }}
            onContextMenu={(event) => { if (onDirectProjectViewDrop) event.preventDefault() }}
            onPointerEnter={() => { if (leftDrag) return; keepPreviewOpen(); setPreviewId(view.id) }}
            onPointerLeave={() => { if (leftDrag) return; schedulePreviewClose(view.id) }}>
            <button type="button" role="listitem" className={view.active ? 'vnext-workspace-mini lcos-project-view-button active' : 'vnext-workspace-mini lcos-project-view-button'} aria-label={`${view.active ? '当前' : '进入'}${previewLabel(view.kind)}：${view.title}`} onFocus={() => setPreviewId(view.id)} onClick={(event) => { if (suppressClickRef.current) { event.preventDefault(); event.stopPropagation(); return } onActivateView(view); setPreviewId(null) }}>
              <ViewPreview view={view}/>
              {railMarkerCount(view) > 0 && <span className="lcos-rail-landmark is-count" title={`${railMarkerCount(view)} 个导航重点`} aria-hidden="true"><MapPin size={9}/><b>{railMarkerCount(view)}</b></span>}
              {attention && <span className={`vnext-workspace-attention status-${runStatus}`}/>}
            </button>
          </div>
        })}
      </div>
      {/* 债3：新 Scene 从 aria-hidden 假 div 升级为真按钮——点击接现有创建入口
          （onAdd = App 的 createEmptyWorkspaceScene），语义投送目标属性保留。 */}
      <button
        type="button"
        className="lcos-new-scene-drop-target"
        data-testid="new-scene-drop-target"
        data-project-view-drop-target={NEW_SCENE_DROP_TARGET_ID}
        data-project-view-drop-label="+ 新 Scene"
        aria-label="新建空白 Scene"
        title="新建空白 Scene；也可把视图拖到这里生成含内容的 Scene"
        onClick={() => { setPreviewId(null); onAdd() }}
      ><Plus size={14}/><span>新 Scene</span></button>
    </div>
    {leftDrag?.moved && (() => { const dragged = views.find((view) => view.id === leftDrag.viewId); return dragged ? <div className="lcos-rail-drag-float" style={{ left: leftDrag.pointerX, top: leftDrag.pointerY }} aria-hidden="true">
      <ViewPreview view={dragged}/>
    </div> : null })()}
    {dropGhost && <div className="lcos-drop-ghost lcos-rail-drop-ghost" style={{ left: dropGhost.x, top: dropGhost.y }} aria-hidden="true">
      <span className="lcos-drop-ghost-stack"><i/><i/><i/></span><strong>{dropGhost.count}</strong><small>{dropGhost.label}</small>
    </div>}
    {dropGhost && <LightCurtain tone="drop" anchors={['left', 'bottom']} hot={dropHot} label={dropGhost.label} count={dropGhost.count}/>}
    {leftDrag?.mode === 'delete' && <LightCurtain tone="delete" anchors={['left']} hot label={`松手删除「${leftDrag.title}」`}/>}
    {/* 债3：resize handle 补齐 slider ARIA（valuenow/min/max）与键盘——左右方向键切换单/双列，
        与拖拽走同一 columnOverride 通道。 */}
    <span className="lcos-rail-resize-handle" role="slider" aria-label="拖拽或按左右方向键调整侧栏列数"
      aria-valuenow={effectiveTwoColumn ? 2 : 1} aria-valuemin={1} aria-valuemax={2}
      aria-valuetext={effectiveTwoColumn ? '双列' : '单列'} tabIndex={0}
      onPointerDown={beginColumnDrag} onPointerMove={moveColumnDrag} onPointerUp={finishColumnDrag} onPointerCancel={finishColumnDrag}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') { event.preventDefault(); setColumnOverride('one') }
        else if (event.key === 'ArrowRight') { event.preventDefault(); setColumnOverride('two') }
      }}/>
    <div className="lcos-rail-footer"><button type="button" className="vnext-rail-button vnext-rail-add" title="新建保存视图" aria-label="新建保存视图" onClick={onAdd}><Plus size={15}/></button></div>

    {preview && <div className={`vnext-workspace-preview lcos-workspace-preview lcos-project-view-preview kind-${preview.kind}`} data-project-view-drop-target={preview.id} data-project-view-drop-kind={preview.kind} data-project-view-drop-label={preview.title} role="dialog" aria-label={`${preview.title} ${previewLabel(preview.kind)}`} onPointerEnter={() => { keepPreviewOpen(); setPreviewId(preview.id) }} onPointerLeave={() => schedulePreviewClose(preview.id)}>
      <div className="vnext-workspace-preview-map lcos-project-view-preview-map"><ViewPreview view={preview} large/></div>
      <div className="lcos-workspace-preview-copy"><span className="lcos-project-view-preview-kind"><RailGlyph kind={preview.kind}/>{previewLabel(preview.kind)}</span>
        {renameFor === preview.id
          ? <input className="lcos-rail-rename-input" value={renameValue} aria-label="重命名视图" autoFocus onChange={(event) => setRenameValue(event.target.value)} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === 'Enter') commitRename(preview); else if (event.key === 'Escape') setRenameFor(null) }} onBlur={() => commitRename(preview)}/>
          : <strong data-renameable={canRename(preview) ? '' : undefined} title={canRename(preview) ? '点击重命名' : undefined} onClick={(event) => { if (!canRename(preview)) return; event.stopPropagation(); beginRename(preview) }}>{preview.title}</strong>}
        <span>{memberSummaryLine(preview)}</span></div>
      {preview.workspaceId && onLocateWorkspace && <button type="button" aria-label={`仅定位 ${preview.title}`} title="定位到这个现场" onClick={(event) => { event.stopPropagation(); onLocateWorkspace(preview.workspaceId!); setPreviewId(null) }}><Crosshair size={13}/></button>}
      {markerRuntime && stableRailSurfaceRef(preview) && <button type="button" className={railMarkerForView(preview) ? 'is-landmark' : undefined} aria-label={railMarkerForView(preview) ? `取消导航地标 ${preview.title}` : `固定到导航 ${preview.title}`} title={railMarkerForView(preview) ? '取消导航地标' : '固定到导航'} onClick={(event) => { event.stopPropagation(); toggleRailLandmark(preview) }}><MapPin size={13}/></button>}
      {canRename(preview) && <button type="button" aria-label={`重命名 ${preview.title}`} title="重命名" onClick={(event) => { event.stopPropagation(); beginRename(preview) }}><Pencil size={13}/></button>}
      <span className="lcos-project-view-preview-footer"><GitBranch size={11}/>{preview.kind === 'scene' ? '保存的工作现场 · 激活后回到这里' : preview.kind === 'context' ? '进入理解现场 · 可切换结构 / 演进' : preview.kind === 'workflow' ? '进入自由工作流画布' : '同一项目的另一个空间视图'}</span>
    </div>}
  </aside>
}
