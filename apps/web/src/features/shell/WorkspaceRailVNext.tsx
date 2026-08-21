import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { Crosshair, GitBranch, Layers3, LayoutDashboard, LayoutPanelLeft, Network, Pencil, Plus, Waves } from 'lucide-react'
import type { RunStatus } from '../../model'
import { LightCurtain } from '../drop/LightCurtain'
import { NEW_SCENE_DROP_TARGET_ID, semanticDropTriggerFromPointer, type SemanticDropTrigger } from '../spatial/semanticDrop'

export type ProjectRailViewKind = 'scene' | 'collection' | 'context' | 'workflow'

export interface ProjectRailViewItem {
  id: string
  title: string
  kind: ProjectRailViewKind
  memberCount: number
  memberViewIds?: readonly string[]
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
  if (kind === 'scene') return <LayoutDashboard size={14}/>
  if (kind === 'context') return <Waves size={14}/>
  if (kind === 'workflow') return <Network size={14}/>
  return <Layers3 size={14}/>
}

function ScenePreview({ count, large = false }: { count: number; large?: boolean }) {
  return <span className={`lcos-rail-preview-scene ${large ? 'is-large' : ''}`} aria-hidden="true">
    <i/><i/><i/><b>{count || ''}</b>
  </span>
}

function CollectionPreview({ count, large = false }: { count: number; large?: boolean }) {
  const cards = Math.max(2, Math.min(4, count || 3))
  return <span className={`lcos-rail-preview-collection ${large ? 'is-large' : ''}`} aria-hidden="true">
    {Array.from({ length: cards }, (_, index) => <i key={index} style={{ '--i': index } as CSSProperties}/>) }
  </span>
}

function ContextPreview({ count, large = false }: { count: number; large?: boolean }) {
  const bars = Math.max(5, Math.min(9, count || 6))
  return <span className={`lcos-rail-preview-context ${large ? 'is-large' : ''}`} aria-hidden="true">
    {Array.from({ length: bars }, (_, index) => <i key={index} style={{ '--i': index, '--h': `${28 + ((index * 17 + count * 7) % 58)}%` } as CSSProperties}/>) }
  </span>
}

function WorkflowPreview({ count, large = false }: { count: number; large?: boolean }) {
  const nodes = Math.max(2, Math.min(4, count || 3))
  return <span className={`lcos-rail-preview-workflow ${large ? 'is-large' : ''}`} aria-hidden="true">
    <b/>
    {Array.from({ length: nodes }, (_, index) => <i key={index} style={{ '--i': index } as CSSProperties}/>) }
  </span>
}

function ViewPreview({ view, large = false }: { view: ProjectRailViewItem; large?: boolean }) {
  if (view.kind === 'scene') return <ScenePreview count={view.memberCount} large={large}/>
  if (view.kind === 'context') return <ContextPreview count={view.memberCount} large={large}/>
  if (view.kind === 'workflow') return <WorkflowPreview count={view.memberCount} large={large}/>
  return <CollectionPreview count={view.memberCount} large={large}/>
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

  return <aside ref={railRef} className={`vnext-workspace-rail lcos-workspace-rail lcos-project-view-rail ${effectiveTwoColumn ? 'is-two-column' : ''} ${columnDrag ? 'is-resizing' : ''}`} data-testid="workspace-dock" aria-label="项目视图" onContextMenu={(event) => event.preventDefault()}>
    <div className="lcos-rail-primary">
      <button type="button" data-rail-kind="main" className={views.every((view) => !view.active) ? 'vnext-rail-button active' : 'vnext-rail-button'} title="主画布（固定入口）" aria-label="主画布" onClick={() => { setPreviewId(null); onOverview() }}><LayoutPanelLeft size={15}/></button>
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
              <span className="lcos-project-view-kind-glyph"><RailGlyph kind={view.kind}/></span>
              {attention && <span className={`vnext-workspace-attention status-${runStatus}`}/>}
            </button>
          </div>
        })}
      </div>
      <div
        className="lcos-new-scene-drop-target"
        data-testid="new-scene-drop-target"
        data-project-view-drop-target={NEW_SCENE_DROP_TARGET_ID}
        data-project-view-drop-label="+ 新 Scene"
        aria-hidden="true"
      ><Plus size={14}/><span>新 Scene</span></div>
    </div>
    {leftDrag?.moved && (() => { const dragged = views.find((view) => view.id === leftDrag.viewId); return dragged ? <div className="lcos-rail-drag-float" style={{ left: leftDrag.pointerX, top: leftDrag.pointerY }} aria-hidden="true">
      <ViewPreview view={dragged}/><span className="lcos-project-view-kind-glyph"><RailGlyph kind={dragged.kind}/></span>
    </div> : null })()}
    {dropGhost && <div className="lcos-drop-ghost lcos-rail-drop-ghost" style={{ left: dropGhost.x, top: dropGhost.y }} aria-hidden="true">
      <span className="lcos-drop-ghost-stack"><i/><i/><i/></span><strong>{dropGhost.count}</strong><small>{dropGhost.label}</small>
    </div>}
    {dropGhost && <LightCurtain tone="drop" anchors={['left', 'bottom']} hot={dropHot} label={dropGhost.label} count={dropGhost.count}/>}
    {leftDrag?.mode === 'delete' && <LightCurtain tone="delete" anchors={['left']} hot label={`松手删除「${leftDrag.title}」`}/>}
    <span className="lcos-rail-resize-handle" role="slider" aria-label="拖拽调整侧栏列数" aria-valuetext={effectiveTwoColumn ? '双列' : '单列'} onPointerDown={beginColumnDrag} onPointerMove={moveColumnDrag} onPointerUp={finishColumnDrag} onPointerCancel={finishColumnDrag}/>
    <div className="lcos-rail-footer"><button type="button" className="vnext-rail-button vnext-rail-add" title="新建保存视图" aria-label="新建保存视图" onClick={onAdd}><Plus size={15}/></button></div>

    {preview && <div className={`vnext-workspace-preview lcos-workspace-preview lcos-project-view-preview kind-${preview.kind}`} data-project-view-drop-target={preview.id} data-project-view-drop-kind={preview.kind} data-project-view-drop-label={preview.title} role="dialog" aria-label={`${preview.title} ${previewLabel(preview.kind)}`} onPointerEnter={() => { keepPreviewOpen(); setPreviewId(preview.id) }} onPointerLeave={() => schedulePreviewClose(preview.id)}>
      <div className="vnext-workspace-preview-map lcos-project-view-preview-map"><ViewPreview view={preview} large/></div>
      <div className="lcos-workspace-preview-copy"><span className="lcos-project-view-preview-kind"><RailGlyph kind={preview.kind}/>{previewLabel(preview.kind)}</span>
        {renameFor === preview.id
          ? <input className="lcos-rail-rename-input" value={renameValue} aria-label="重命名视图" autoFocus onChange={(event) => setRenameValue(event.target.value)} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === 'Enter') commitRename(preview); else if (event.key === 'Escape') setRenameFor(null) }} onBlur={() => commitRename(preview)}/>
          : <strong data-renameable={canRename(preview) ? '' : undefined} title={canRename(preview) ? '点击重命名' : undefined} onClick={(event) => { if (!canRename(preview)) return; event.stopPropagation(); beginRename(preview) }}>{preview.title}</strong>}
        <span>{preview.memberCount ? `${preview.memberCount} 个对象` : '空视图'}</span></div>
      {preview.workspaceId && onLocateWorkspace && <button type="button" aria-label={`仅定位 ${preview.title}`} title="定位 Camera" onClick={(event) => { event.stopPropagation(); onLocateWorkspace(preview.workspaceId!); setPreviewId(null) }}><Crosshair size={13}/></button>}
      {canRename(preview) && <button type="button" aria-label={`重命名 ${preview.title}`} title="重命名" onClick={(event) => { event.stopPropagation(); beginRename(preview) }}><Pencil size={13}/></button>}
      <span className="lcos-project-view-preview-footer"><GitBranch size={11}/>{preview.kind === 'scene' ? '保存的工作现场 · 激活后成为 Current Scene' : preview.kind === 'context' ? '进入理解现场 · 可切换结构 / 演进' : preview.kind === 'workflow' ? '进入自由工作流画布' : '同一 Project Truth 的空间投影'}</span>
    </div>}
  </aside>
}
