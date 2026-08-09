import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { RuntimeProviderStatus } from '@local-creative-os/contracts'
import { ArrowDownToLine, Copy, CopyPlus, Ellipsis, FolderTree, LayoutGrid, Sparkles, Trash2 } from 'lucide-react'
import type { Camera, CanvasEdge, CanvasNode, NodeDisplayMode, RunStatus, Workspace, WorkspaceFrameVM } from '../../model'
import { applyWheelGesture, getSelectionBounds, nodeDensity } from './canvasGeometry'
import { getPendingZoneBounds } from './canvasLayout'
import type { LayoutPreviewItem } from './scopeLayout'
import { CanvasNodeVisual, nodeVisualFamily } from './CanvasNodeVisual'
import { SelectionComposer } from './SelectionComposer'
import type { ArtifactRevisionProvenance } from '../../runtime/projectionAdapters'

interface Props {
  nodes: CanvasNode[]; setNodes: (nodes: CanvasNode[] | ((current: CanvasNode[]) => CanvasNode[])) => void
  edges: CanvasEdge[]; setEdges: (edges: CanvasEdge[] | ((current: CanvasEdge[]) => CanvasEdge[])) => void
  camera: Camera; setCamera: (camera: Camera | ((current: Camera) => Camera)) => void
  selectedId: string | null; selectedIds: string[]; selectedEdgeId: string | null; setSelectedEdgeId: (id: string | null) => void; pendingId: string | null; runId: string; runStatus: RunStatus | null; spaceHeld: boolean; locked?: boolean
  onSelect: (id: string, additive?: boolean) => void; onClearSelection: () => void; onMarqueeSelect: (ids: string[], additive: boolean) => void; onSelectEdge: (id: string | null) => void; onDoubleClick: (id: string) => void; onDetails: (id: string) => void; onRequestAi: () => void
  layoutPreview?: LayoutPreviewItem[] | null
  workspaceFrames?: WorkspaceFrameVM[]
  workspaceMemberNodes?: CanvasNode[]
  activeWorkspaceId?: string | null
  onWorkspaceActivate?: (workspaceId: string) => void
  onPresentationInteractionChange?: (active: boolean) => void
  onPresentationCommit?: (kind: 'node-move' | 'node-resize' | 'workspace-group-move') => void
  onFrameBoundsChange?: (workspaceId: string, frameBounds: { x: number; y: number; width: number; height: number }) => void
  selectionComposer?: {
    prompt: string
    contextIds: string[]
    provider: string
    createAsNewNode: boolean
    intent?: 'analyze' | 'create' | 'revise'
    resultPolicy?: 'reply_only' | 'create_artifact' | 'create_collection' | 'draft_revision_per_target'
    baseRevision?: ArtifactRevisionProvenance
    providers: readonly RuntimeProviderStatus[]
    activeWorkspace: Workspace | null
    workspaces: readonly Workspace[]
    busy: boolean
    proposalSummary?: string
    ambiguityQuestion?: string
    onPromptChange: (value: string) => void
    onProviderChange: (value: string) => void
    onCreateAsNewNodeChange: (value: boolean) => void
    onIntentChange?: (value: 'analyze' | 'create' | 'revise') => void
    onResultPolicyChange?: (value: 'reply_only' | 'create_artifact' | 'create_collection' | 'draft_revision_per_target') => void
    onToggleContext: (id: string) => void
    onSend: () => void
    onAddToWorkspace: () => void
    onRemoveFromWorkspace: () => void
    onMoveToWorkspace: (workspaceId: string) => void
    onClose: () => void
  }
  onCreateNodeFromAnchor: (kind: 'note' | 'context', x: number, y: number, from: string) => void; onFilesDropped: (files: File[], x: number, y: number) => void
  onArrangeSelection: () => void; onCopySelection: () => void; onDuplicateSelection: () => void; onCreateScopeFromSelection: () => void; onDeleteSelection: () => void; onPointerWorldChange: (point: { x: number; y: number }) => void; onSpaceCreate: (point: { x: number; y: number }) => void
  onStageTransfer?: (ids: string[], anchor: 'left' | 'bottom') => void
}

type DragCandidate = { id: string; startX: number; startY: number; offsetX: number; offsetY: number; group: Array<{ id: string; dx: number; dy: number }>; originals: Array<{ id: string; x: number; y: number }> }
type ResizeCandidate = { id: string; startX: number; startY: number; width: number; height: number; moved: boolean }
type WorkspaceDragCandidate = { workspaceId: string; startX: number; startY: number; members: Array<{ id: string; x: number; y: number }>; moved: boolean; frameBounds?: { x: number; y: number; width: number; height: number }; currentBounds?: { x: number; y: number; width: number; height: number } }
type FrameResizeCandidate = { workspaceId: string; startX: number; startY: number; originalBounds: { x: number; y: number; width: number; height: number }; bounds: { x: number; y: number; width: number; height: number }; moved: boolean }
type EdgeReconnectCandidate = { edgeId: string; endpoint: 'from' | 'to'; fixedId: string }

function additiveSelection(event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean {
  return event.shiftKey || event.ctrlKey || event.metaKey
}

export const ProjectCanvas = memo(function ProjectCanvas({ nodes, setNodes, edges, setEdges, camera, setCamera, selectedId, selectedIds, selectedEdgeId, setSelectedEdgeId, pendingId, runId, runStatus, spaceHeld, locked = false, layoutPreview, workspaceFrames = [], workspaceMemberNodes = nodes, activeWorkspaceId = null, onWorkspaceActivate, onPresentationInteractionChange, onPresentationCommit, onFrameBoundsChange, selectionComposer, onSelect, onClearSelection, onMarqueeSelect, onSelectEdge, onDoubleClick, onDetails, onRequestAi, onCreateNodeFromAnchor, onFilesDropped, onArrangeSelection, onCopySelection, onDuplicateSelection, onCreateScopeFromSelection, onDeleteSelection, onPointerWorldChange, onSpaceCreate, onStageTransfer }: Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const pan = useRef<{ x: number; y: number; camera: Camera } | null>(null)
  const dragCandidate = useRef<DragCandidate | null>(null)
  const resizeCandidate = useRef<ResizeCandidate | null>(null)
  const workspaceDrag = useRef<WorkspaceDragCandidate | null>(null)
  const frameResize = useRef<FrameResizeCandidate | null>(null)
  const dragging = useRef(false)
  const dragPoint = useRef<{ x: number; y: number } | null>(null)
  const dragFrame = useRef<number | null>(null)
  const autoPanFrame = useRef<number | null>(null)
  const autoPanPointer = useRef<{ x: number; y: number } | null>(null)
  const wheelFrame = useRef<number | null>(null)
  const wheelPan = useRef({ x: 0, y: 0 })
  const wheelZoom = useRef<{ deltaY: number; anchorX: number; anchorY: number; precision: boolean } | null>(null)
  const suppressClick = useRef<string | null>(null)
  const lastNodePress = useRef<{ id: string; time: number; x: number; y: number } | null>(null)
  const doublePressCandidate = useRef<string | null>(null)
  const selectionCollapseCandidate = useRef<string | null>(null)
  const link = useRef<{ from: string } | null>(null)
  const linkPointerId = useRef<number | null>(null)
  const linkTarget = useRef<string | null>(null)
  const linkStart = useRef<{ x: number; y: number } | null>(null)
  const linkMoved = useRef(false)
  const edgeReconnect = useRef<EdgeReconnectCandidate | null>(null)
  const [linkPoint, setLinkPoint] = useState<{ x: number; y: number } | null>(null)
  const [panning, setPanning] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const [draggingWorkspaceId, setDraggingWorkspaceId] = useState<string | null>(null)
  const [dropGutter, setDropGutter] = useState<'left' | 'bottom' | null>(null)
  const dropStageAnchor = useRef<'left' | 'bottom' | null>(null)
  const [dropGhost, setDropGhost] = useState<{ x: number; y: number; count: number } | null>(null)
  const dropHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const marquee = useRef<{ startX: number; startY: number; currentX: number; currentY: number; pointerId: number; moved: boolean } | null>(null)
  const [marqueeRect, setMarqueeRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const [createMenu, setCreateMenu] = useState<{ from: string; x: number; y: number; screenX: number; screenY: number } | null>(null)
  const toWorld = (clientX: number, clientY: number, rect: DOMRect) => ({ x: (clientX - rect.left - camera.x) / camera.zoom, y: (clientY - rect.top - camera.y) / camera.zoom })
  const lod = nodes.length >= 300 ? 'overview' : nodes.length >= 150 ? 'simplified' : 'full'
  const renderNodes = useMemo(() => {
    if (nodes.length < 150) return nodes
    const width = canvasRef.current?.clientWidth ?? 1440
    const height = canvasRef.current?.clientHeight ?? 900
    const overscan = 460 / Math.max(.2, camera.zoom)
    const left = -camera.x / camera.zoom - overscan
    const top = -camera.y / camera.zoom - overscan
    const right = left + width / camera.zoom + overscan * 2
    const bottom = top + height / camera.zoom + overscan * 2
    const keep = new Set([...selectedIds, ...(pendingId ? [pendingId] : [])])
    const candidates = nodes.filter((node) => keep.has(node.id) || (node.x < right && node.x + node.width > left && node.y < bottom && node.y + node.height > top))
    if (lod !== 'overview' || candidates.length <= 220) return candidates
    const selected = candidates.filter((node) => keep.has(node.id))
    const rest = candidates.filter((node) => !keep.has(node.id))
    const stride = Math.max(1, Math.ceil(rest.length / Math.max(1, 220 - selected.length)))
    return [...selected, ...rest.filter((_, index) => index % stride === 0)].slice(0, 220)
  }, [nodes, selectedIds, pendingId, camera.x, camera.y, camera.zoom, lod])
  const renderIds = useMemo(() => new Set(renderNodes.map((node) => node.id)), [renderNodes])
  const renderEdges = useMemo(() => {
    if (lod === 'full') return edges
    const visible = (id: string) => renderIds.has(id) || id.startsWith('workspace:')
    return edges.filter((edge) => visible(edge.from) && visible(edge.to))
  }, [edges, lod, renderIds])
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const relationById = new Map(byId)
  workspaceFrames.forEach((frame) => relationById.set(`workspace:${frame.workspaceId}`, {
    id: `workspace:${frame.workspaceId}`, title: frame.label, kind: 'context', x: frame.bounds.x, y: frame.bounds.y, width: frame.bounds.width, height: frame.bounds.height,
  } as CanvasNode))
  const selectedBounds = useMemo(() => selectedIds.length ? getSelectionBounds(nodes, selectedIds) : null, [nodes, selectedIds])
  const selectionBounds = selectedIds.length > 1 ? selectedBounds : null
  const overlayWidth = canvasRef.current?.clientWidth ?? 1440
  const overlayHeight = canvasRef.current?.clientHeight ?? 900
  const selectionToolbarPosition = selectionBounds ? {
    left: Math.max(12, Math.min(Math.max(12, overlayWidth - 190), camera.x + selectionBounds.x * camera.zoom)),
    top: Math.max(12, Math.min(Math.max(12, overlayHeight - 46), camera.y + selectionBounds.y * camera.zoom - 40)),
  } : null
  const selectionComposerPosition = selectedBounds ? {
    left: Math.max(12, Math.min(Math.max(12, overlayWidth - Math.min(430, overlayWidth - 24)), camera.x + selectedBounds.x * camera.zoom)),
    top: Math.max(12, Math.min(Math.max(12, overlayHeight - 128), camera.y + (selectedBounds.y + selectedBounds.height) * camera.zoom + 12)),
  } : null
  const pendingZone = useMemo(() => getPendingZoneBounds(nodes), [nodes])
  const zoomBand = camera.zoom < .35 ? '20' : camera.zoom < .6 ? '35' : camera.zoom < .9 ? '60' : '90'
  const returnGroups = useMemo(() => {
    const grouped = new Map<string, CanvasNode[]>()
    nodes.forEach((node) => {
      if (!node.resultGroupId || node.kind !== 'generated') return
      grouped.set(node.resultGroupId, [...(grouped.get(node.resultGroupId) ?? []), node])
    })
    return [...grouped.entries()].map(([id, members]) => {
      const left = Math.min(...members.map((node) => node.x)) - 18
      const top = Math.min(...members.map((node) => node.y)) - 36
      const right = Math.max(...members.map((node) => node.x + node.width)) + 18
      const bottom = Math.max(...members.map((node) => node.y + node.height)) + 18
      return { id, count: members.length, x: left, y: top, width: right - left, height: bottom - top }
    })
  }, [nodes])

  useEffect(() => () => {
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current)
    if (autoPanFrame.current !== null) cancelAnimationFrame(autoPanFrame.current)
    if (wheelFrame.current !== null) cancelAnimationFrame(wheelFrame.current)
  }, [])
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setCreateMenu(null)
      link.current = null
      edgeReconnect.current = null
      setLinkPoint(null)
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [])
  useEffect(() => {
    if (!locked) return
    if (dragFrame.current !== null) {
      cancelAnimationFrame(dragFrame.current)
      dragFrame.current = null
    }
    if (autoPanFrame.current !== null) {
      cancelAnimationFrame(autoPanFrame.current)
      autoPanFrame.current = null
    }
    if (wheelFrame.current !== null) {
      cancelAnimationFrame(wheelFrame.current)
      wheelFrame.current = null
    }
    wheelPan.current = { x: 0, y: 0 }
    wheelZoom.current = null
    if (linkPointerId.current !== null && canvasRef.current?.hasPointerCapture(linkPointerId.current)) {
      canvasRef.current.releasePointerCapture(linkPointerId.current)
    }
    linkPointerId.current = null
    pan.current = null
    dragCandidate.current = null
    resizeCandidate.current = null
    workspaceDrag.current = null
    frameResize.current = null
    dragPoint.current = null
    autoPanPointer.current = null
    dragging.current = false
    marquee.current = null
    link.current = null
    edgeReconnect.current = null
    linkTarget.current = null
    linkStart.current = null
    linkMoved.current = false
    lastNodePress.current = null
    doublePressCandidate.current = null
    selectionCollapseCandidate.current = null
    suppressClick.current = null
    setPanning(false)
    setDraggingId(null)
    setResizingId(null)
    setDraggingWorkspaceId(null)
    setDropGutter(null)
    setDropGhost(null)
    dropStageAnchor.current = null
    setMarqueeRect(null)
    setCreateMenu(null)
    setLinkPoint(null)
    onPresentationInteractionChange?.(false)
  }, [locked, onPresentationInteractionChange])

  const scheduleDraggedNode = () => {
    if (dragFrame.current !== null) return
    dragFrame.current = requestAnimationFrame(() => {
      dragFrame.current = null
      const candidate = dragCandidate.current
      const point = dragPoint.current
      if (!candidate || !point) return
      setNodes((current) => candidate.group.length > 1
        ? current.map((node) => { const member = candidate.group.find((item) => item.id === node.id); return member ? { ...node, x: point.x + member.dx, y: point.y + member.dy } : node })
        : current.map((node) => node.id === candidate.id ? { ...node, x: point.x, y: point.y } : node))
    })
  }
  const autoPanBounds = (rect: DOMRect) => {
    const dock = document.querySelector<HTMLElement>('[data-testid="workspace-dock"]')?.getBoundingClientRect()
    const rail = document.querySelector<HTMLElement>('[data-testid="work-rail"]')?.getBoundingClientRect()
    const dockOccludesLeft = Boolean(dock && dock.left <= rect.left + 1 && dock.right > rect.left)
    const railOccludesRight = Boolean(rail && rail.right >= rect.right - 1 && rail.left < rect.right)
    return {
      left: dockOccludesLeft && dock ? Math.min(rect.right, dock.right + 10) : rect.left,
      right: railOccludesRight && rail ? Math.max(rect.left, rail.left - 10) : rect.right,
      top: rect.top,
      bottom: rect.bottom,
    }
  }
  const stopAutoPan = () => {
    autoPanPointer.current = null
    if (autoPanFrame.current !== null) {
      cancelAnimationFrame(autoPanFrame.current)
      autoPanFrame.current = null
    }
  }
  const updateWorkspaceDragMembers = (item: WorkspaceDragCandidate, cameraDeltaX = 0, cameraDeltaY = 0) => {
    const dx = (autoPanPointer.current ? autoPanPointer.current.x - item.startX : 0) / camera.zoom - cameraDeltaX / camera.zoom
    const dy = (autoPanPointer.current ? autoPanPointer.current.y - item.startY : 0) / camera.zoom - cameraDeltaY / camera.zoom
    const starts = new Map(item.members.map((member) => [member.id, member]))
    setNodes((current) => current.map((node) => { const start = starts.get(node.id); return start ? { ...node, x: start.x + dx, y: start.y + dy } : node }))
    if (item.frameBounds) {
      item.currentBounds = { ...item.frameBounds, x: item.frameBounds.x + dx, y: item.frameBounds.y + dy }
    }
  }
  const scheduleAutoPan = (pointer: { x: number; y: number }) => {
    autoPanPointer.current = pointer
    if (autoPanFrame.current !== null) return
    const tick = () => {
      autoPanFrame.current = null
      const currentPointer = autoPanPointer.current
      const rect = canvasRef.current?.getBoundingClientRect()
      const active = Boolean(currentPointer && (dragging.current || workspaceDrag.current))
      if (!currentPointer || !rect || !active) {
        stopAutoPan()
        return
      }
      const bounds = autoPanBounds(rect)
      const edge = 96
      const maxStep = 18
      const strength = (distance: number) => Math.min(1, Math.max(0, (edge - distance) / edge))
      const left = strength(currentPointer.x - bounds.left)
      const right = strength(bounds.right - currentPointer.x)
      const top = strength(currentPointer.y - bounds.top)
      const bottom = strength(bounds.bottom - currentPointer.y)
      const cameraDeltaX = (left - right) * maxStep
      const cameraDeltaY = (top - bottom) * maxStep
      if (cameraDeltaX || cameraDeltaY) {
        setCamera((current) => ({ ...current, x: current.x + cameraDeltaX, y: current.y + cameraDeltaY }))
        if (dragCandidate.current && dragPoint.current) {
          dragPoint.current = { x: dragPoint.current.x - cameraDeltaX / camera.zoom, y: dragPoint.current.y - cameraDeltaY / camera.zoom }
          scheduleDraggedNode()
        }
        if (workspaceDrag.current) updateWorkspaceDragMembers(workspaceDrag.current, cameraDeltaX, cameraDeltaY)
      }
      autoPanFrame.current = requestAnimationFrame(tick)
    }
    autoPanFrame.current = requestAnimationFrame(tick)
  }
  const scheduleWheel = () => {
    if (wheelFrame.current !== null) return
    wheelFrame.current = requestAnimationFrame(() => {
      wheelFrame.current = null
      const panDelta = wheelPan.current
      const zoomGesture = wheelZoom.current
      wheelPan.current = { x: 0, y: 0 }
      wheelZoom.current = null
      setCamera((current) => {
        let next = applyWheelGesture(current, { deltaX: panDelta.x, deltaY: panDelta.y, zoom: false, anchorX: 0, anchorY: 0 })
        if (zoomGesture) next = applyWheelGesture(next, { deltaX: 0, deltaY: zoomGesture.deltaY, zoom: true, anchorX: zoomGesture.anchorX, anchorY: zoomGesture.anchorY, precision: zoomGesture.precision })
        return next
      })
    })
  }
  const connect = (from: string, to: string) => {
    if (from === to) return
    const existing = edges.find((edge) => edge.from === from && edge.to === to)
    if (existing) {
      setSelectedEdgeId(existing.id)
      return
    }
    const nextId = `edge-${Date.now()}`
    setSelectedEdgeId(nextId)
    setEdges((current) => [...current, { id: nextId, from, to, kind: 'reference' }])
  }
  const relationTargetAt = (clientX: number, clientY: number) => {
    const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-relation-target], [data-node-id]')
    return element?.dataset.relationTarget ?? element?.dataset.nodeId ?? null
  }
  const beginRelation = (from: string, event: React.PointerEvent<HTMLElement>, point: { x: number; y: number }) => {
    event.preventDefault(); event.stopPropagation()
    edgeReconnect.current = null
    link.current = { from }
    linkStart.current = { x: event.clientX, y: event.clientY }
    linkMoved.current = false
    setLinkPoint(point)
    linkPointerId.current = event.pointerId
  }
  const beginEdgeReconnect = (edge: CanvasEdge, endpoint: 'from' | 'to', event: React.PointerEvent<SVGCircleElement>) => {
    event.preventDefault(); event.stopPropagation()
    const fixedId = endpoint === 'from' ? edge.to : edge.from
    const currentEndpoint = relationById.get(endpoint === 'from' ? edge.from : edge.to)
    edgeReconnect.current = { edgeId: edge.id, endpoint, fixedId }
    link.current = null
    linkTarget.current = null
    linkStart.current = { x: event.clientX, y: event.clientY }
    linkMoved.current = false
    setSelectedEdgeId(edge.id)
    setLinkPoint(currentEndpoint ? { x: endpoint === 'from' ? currentEndpoint.x + currentEndpoint.width : currentEndpoint.x, y: currentEndpoint.y + currentEndpoint.height / 2 } : null)
    linkPointerId.current = event.pointerId
  }
  const finishPresentationInteraction = (kind: 'node-move' | 'node-resize' | 'workspace-group-move') => {
    onPresentationInteractionChange?.(false)
    onPresentationCommit?.(kind)
  }

  const dropAnchorAt = (clientX: number, clientY: number, rect: DOMRect): 'left' | 'bottom' | null => {
    // 投送热区必须 >= 自动平移触发区（96px），否则拖到边缘先触发平移，
    // 节点从指针下溜走，投送永远抢不到。
    const bottomCaptureTop = rect.bottom - 96
    if (clientY >= bottomCaptureTop && clientY < rect.bottom) return 'bottom'
    if (clientX <= rect.left + 96) return 'left'
    return null
  }

  const restoreDraggedOriginals = (candidate: DragCandidate | null) => {
    if (!candidate) return
    const originals = new Map(candidate.originals.map((item) => [item.id, item]))
    setNodes((current) => current.map((node) => { const original = originals.get(node.id); return original ? { ...node, x: original.x, y: original.y } : node }))
  }

  const finishPointer = (event: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    if (locked) {
      event.preventDefault()
      event.stopPropagation()
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      return
    }
    const wasDragging = dragging.current
    const stagedDropAnchor = dropStageAnchor.current
    const draggedCandidate = dragCandidate.current
    const draggedId = dragCandidate.current?.id
    const resizedId = resizeCandidate.current?.moved ? resizeCandidate.current.id : undefined
    const draggedWorkspace = workspaceDrag.current?.moved ? workspaceDrag.current.workspaceId : undefined
    const resizedFrame = frameResize.current?.moved ? frameResize.current : undefined
    if (cancelled) {
      if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current)
      dragFrame.current = null
      restoreDraggedOriginals(draggedCandidate)
      if (resizeCandidate.current) {
        const original = resizeCandidate.current
        setNodes((current) => current.map((node) => node.id === original.id ? { ...node, width: original.width, height: original.height } : node))
      }
      if (workspaceDrag.current) {
        const originals = new Map(workspaceDrag.current.members.map((member) => [member.id, member]))
        setNodes((current) => current.map((node) => { const original = originals.get(node.id); return original ? { ...node, x: original.x, y: original.y } : node }))
      }
      if (frameResize.current) onFrameBoundsChange?.(frameResize.current.workspaceId, frameResize.current.originalBounds)
      if (dragCandidate.current || resizeCandidate.current || workspaceDrag.current || frameResize.current) onPresentationInteractionChange?.(false)
      if (dropHoverTimer.current !== null) clearTimeout(dropHoverTimer.current)
      dropHoverTimer.current = null
      pan.current = null
      dragCandidate.current = null
      resizeCandidate.current = null
      workspaceDrag.current = null
      frameResize.current = null
      dragPoint.current = null
      dragging.current = false
      marquee.current = null
      link.current = null
      edgeReconnect.current = null
      linkTarget.current = null
      linkStart.current = null
      linkMoved.current = false
      linkPointerId.current = null
      lastNodePress.current = null
      doublePressCandidate.current = null
      selectionCollapseCandidate.current = null
      stopAutoPan()
      setPanning(false)
      setDraggingId(null)
      setResizingId(null)
      setDraggingWorkspaceId(null)
      setDropGutter(null)
      setDropGhost(null)
      dropStageAnchor.current = null
      setMarqueeRect(null)
      setLinkPoint(null)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      return
    }
    if (dragFrame.current !== null) {
      cancelAnimationFrame(dragFrame.current)
      dragFrame.current = null
      const point = dragPoint.current
      if (stagedDropAnchor && wasDragging && draggedCandidate) restoreDraggedOriginals(draggedCandidate)
      else if (draggedId && point) setNodes((current) => {
        const group = dragCandidate.current?.group ?? []
        return group.length > 1
          ? current.map((node) => { const member = group.find((item) => item.id === node.id); return member ? { ...node, x: point.x + member.dx, y: point.y + member.dy } : node })
          : current.map((node) => node.id === draggedId ? { ...node, x: point.x, y: point.y } : node)
      })
    } else if (stagedDropAnchor && wasDragging && draggedCandidate) {
      restoreDraggedOriginals(draggedCandidate)
    }
    if (!wasDragging && draggedId && doublePressCandidate.current === draggedId) {
      suppressClick.current = draggedId
      doublePressCandidate.current = null
      selectionCollapseCandidate.current = null
      lastNodePress.current = null
      onDoubleClick(draggedId)
    } else if (!wasDragging && draggedId && selectionCollapseCandidate.current === draggedId) {
      onSelect(draggedId, false)
      selectionCollapseCandidate.current = null
    }
    if (wasDragging && draggedId) suppressClick.current = draggedId
    if (resizedId) finishPresentationInteraction('node-resize')
    else if (resizedFrame) {
      finishPresentationInteraction('node-resize')
      onFrameBoundsChange?.(resizedFrame.workspaceId, {
        x: resizedFrame.bounds.x,
        y: resizedFrame.bounds.y,
        width: Math.max(220, resizedFrame.bounds.width),
        height: Math.max(140, resizedFrame.bounds.height),
      })
    }
    else if (draggedWorkspace) {
      finishPresentationInteraction('workspace-group-move')
      if (workspaceDrag.current?.currentBounds) onFrameBoundsChange?.(workspaceDrag.current.workspaceId, workspaceDrag.current.currentBounds)
    }
    else if (wasDragging && draggedId && !stagedDropAnchor) finishPresentationInteraction('node-move')
    else if (resizeCandidate.current || workspaceDrag.current) onPresentationInteractionChange?.(false)
    if (stagedDropAnchor && wasDragging && draggedCandidate) {
      onPresentationInteractionChange?.(false)
      // 松手三态：
      // 1) 命中目的地按钮 → 就地投送；
      // 2) 仍在投送区或面板上 → 打开/保持 Destination Sheet；
      // 3) 虚影被拖到别处 → 取消投送，节点已回原位。
      const rect = event.currentTarget.getBoundingClientRect()
      const at = document.elementFromPoint(event.clientX, event.clientY)
      const hit = at
        ?.closest<HTMLButtonElement>('.vnext-destination-main, .vnext-destination-follow')
      if (hit) {
        // pointerup 时指针捕获仍在 canvas 上，同步 click 会被事件系统吞掉；
        // 等捕获释放后再触发目的地投送。
        window.setTimeout(() => hit.click(), 0)
      } else if (at?.closest('.vnext-drop-shelf') || dropAnchorAt(event.clientX, event.clientY, rect)) {
        onStageTransfer?.(draggedCandidate.group.map((item) => item.id), stagedDropAnchor)
      }
    }
    setDropGutter(null)
    setDropGhost(null)
    dropStageAnchor.current = null
    if (dropHoverTimer.current !== null) {
      clearTimeout(dropHoverTimer.current)
      dropHoverTimer.current = null
    }
    pan.current = null
    dragCandidate.current = null
    resizeCandidate.current = null
    workspaceDrag.current = null
    frameResize.current = null
    dragPoint.current = null
    stopAutoPan()
    dragging.current = false
    setPanning(false)
    setDraggingId(null)
    setResizingId(null)
    setDraggingWorkspaceId(null)
    if (marquee.current) {
      const box = marquee.current
      const rect = event.currentTarget.getBoundingClientRect()
      const left = Math.min(box.startX, box.currentX), right = Math.max(box.startX, box.currentX), top = Math.min(box.startY, box.currentY), bottom = Math.max(box.startY, box.currentY)
      if (box.moved) {
        const ids = nodes.filter((node) => {
          const x = rect.left + camera.x + node.x * camera.zoom
          const y = rect.top + camera.y + node.y * camera.zoom
          const w = node.width * camera.zoom
          const h = node.height * camera.zoom
          return x < right && x + w > left && y < bottom && y + h > top
        }).map((node) => node.id)
        onMarqueeSelect(ids, additiveSelection(event))
      }
      marquee.current = null
      setMarqueeRect(null)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      return
    }
    if (edgeReconnect.current) {
      const reconnect = edgeReconnect.current
      const target = linkTarget.current ?? relationTargetAt(event.clientX, event.clientY)
      if (target && target !== reconnect.fixedId) {
        setEdges((current) => current.map((edge) => edge.id !== reconnect.edgeId ? edge : reconnect.endpoint === 'from' ? { ...edge, from: target } : { ...edge, to: target }))
      }
      edgeReconnect.current = null
      linkTarget.current = null
      linkStart.current = null
      linkMoved.current = false
      setLinkPoint(null)
    } else if (link.current) {
      const source = link.current.from
      const target = linkTarget.current ?? relationTargetAt(event.clientX, event.clientY)
      if (target && target !== source) {
        connect(source, target)
        link.current = null
        linkTarget.current = null
        linkStart.current = null
        linkMoved.current = false
        setLinkPoint(null)
      } else if (linkMoved.current) {
        const point = toWorld(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())
        setCreateMenu({ from: source, x: point.x, y: point.y, screenX: event.clientX, screenY: event.clientY })
        link.current = null
        linkTarget.current = null
        linkStart.current = null
        linkMoved.current = false
        setLinkPoint(null)
      }
    }
    if (linkPointerId.current !== null && canvasRef.current?.hasPointerCapture(linkPointerId.current)) canvasRef.current.releasePointerCapture(linkPointerId.current)
    linkPointerId.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return <div ref={canvasRef} data-testid="canvas" tabIndex={-1} data-node-count={nodes.length} data-edge-count={edges.length} data-locked={locked || undefined} data-camera-x={camera.x} data-camera-y={camera.y} data-camera-zoom={camera.zoom} aria-busy={locked || undefined} className={`canvas lod-${lod} zoom-band-${zoomBand} ${selectedId ? 'has-focus' : ''} ${panning ? 'panning' : ''} ${locked ? 'is-locked' : ''}`} style={{ '--canvas-zoom': String(camera.zoom) } as React.CSSProperties} onPointerDown={(event) => {
    if (locked) { event.preventDefault(); event.stopPropagation(); return }
    if (event.button === 1) {
      event.preventDefault()
      pan.current = { x: event.clientX, y: event.clientY, camera }
      setPanning(true)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    const target = event.target as HTMLElement
    const blankCanvas = !target.closest('[data-node-id], [data-workspace-frame], button, .edge, .edge-control')
    if (blankCanvas) event.currentTarget.focus({ preventScroll: true })
    if (createMenu && !target.closest('.anchor-create-menu')) setCreateMenu(null)
    if (event.button === 0 && blankCanvas && spaceHeld) {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      const point = toWorld(event.clientX, event.clientY, rect)
      onPointerWorldChange(point)
      onSpaceCreate(point)
      return
    }
    if (event.button === 0 && blankCanvas) {
      onSelectEdge(null)
      if (!additiveSelection(event)) onClearSelection()
      marquee.current = { startX: event.clientX, startY: event.clientY, currentX: event.clientX, currentY: event.clientY, pointerId: event.pointerId, moved: false }
    }
  }} onPointerMove={(event) => {
    if (locked) { event.preventDefault(); event.stopPropagation(); return }
    const rect = event.currentTarget.getBoundingClientRect()
    onPointerWorldChange(toWorld(event.clientX, event.clientY, rect))
    if (resizeCandidate.current) {
      const item = resizeCandidate.current
      item.moved = item.moved || Math.hypot(event.clientX - item.startX, event.clientY - item.startY) > 2
      const width = Math.max(170, Math.min(760, item.width + (event.clientX - item.startX) / camera.zoom))
      const height = Math.max(96, Math.min(620, item.height + (event.clientY - item.startY) / camera.zoom))
      setNodes((current) => current.map((node) => node.id === item.id ? { ...node, width, height } : node))
      return
    }
    if (workspaceDrag.current) {
      const item = workspaceDrag.current
      item.moved = item.moved || Math.hypot(event.clientX - item.startX, event.clientY - item.startY) > 2
      autoPanPointer.current = { x: event.clientX, y: event.clientY }
      updateWorkspaceDragMembers(item)
      scheduleAutoPan({ x: event.clientX, y: event.clientY })
      return
    }
    if (frameResize.current) {
      const item = frameResize.current
      item.moved = item.moved || Math.hypot(event.clientX - item.startX, event.clientY - item.startY) > 2
      const dx = (event.clientX - item.startX) / camera.zoom
      const dy = (event.clientY - item.startY) / camera.zoom
      item.bounds = {
        x: item.originalBounds.x,
        y: item.originalBounds.y,
        width: Math.max(220, item.originalBounds.width + dx),
        height: Math.max(140, item.originalBounds.height + dy),
      }
      onFrameBoundsChange?.(item.workspaceId, { ...item.bounds })
      return
    }
    if (pan.current) {
      const panState = pan.current
      setCamera((current) => ({ ...current, x: panState.camera.x + event.clientX - panState.x, y: panState.camera.y + event.clientY - panState.y }))
    }
    if (marquee.current) {
      marquee.current.currentX = event.clientX
      marquee.current.currentY = event.clientY
      const box = marquee.current
      const moved = Math.hypot(box.currentX - box.startX, box.currentY - box.startY)
      if (!box.moved && moved > 4) {
        box.moved = true
        try { event.currentTarget.setPointerCapture(box.pointerId) } catch { /* pointer may already be released */ }
      }
      if (box.moved) setMarqueeRect({ left: Math.min(box.startX, box.currentX), top: Math.min(box.startY, box.currentY), width: Math.abs(box.currentX - box.startX), height: Math.abs(box.currentY - box.startY) })
    }
    const candidate = dragCandidate.current
    if (candidate) {
      const moved = Math.hypot(event.clientX - candidate.startX, event.clientY - candidate.startY)
      if (!dragging.current && moved > 4) {
        dragging.current = true
        // 一旦越过拖拽阈值，本次按下就不能继续参与双击识别。
        // 否则“拖一下 → 松手 → 立刻单击”会被误判为第二次按下并打开 Workbench。
        lastNodePress.current = null
        doublePressCandidate.current = null
        selectionCollapseCandidate.current = null
        onPresentationInteractionChange?.(true)
        setDraggingId(candidate.id)
        linkPointerId.current = event.pointerId
        try { canvasRef.current?.setPointerCapture(event.pointerId) } catch { /* synthetic or already released */ }
      }
      if (dragging.current) {
        const anchor = onStageTransfer ? dropAnchorAt(event.clientX, event.clientY, rect) : null
        if (anchor) {
          // 投送优先：投送区与自动平移区同为 96px，指针进入即激活投送并停平移。
          // stageAnchor 记录投送意图；dropGutter 只负责“当前仍在边缘”的视觉反馈。
          dropStageAnchor.current = anchor
          setDropGutter(anchor)
          stopAutoPan()
          const candidate = dragCandidate.current
          if (!dropGhost && candidate) {
            // 进入投送区：真实节点弹回拖拽前的原位，指针下换成虚影，
            // 投送/取消都不再移动原画布节点。
            if (candidate.originals.length > 0) {
              setNodes((current) => current.map((node) => {
                const original = candidate.originals.find((item) => item.id === node.id)
                return original ? { ...node, x: original.x, y: original.y } : node
              }))
            }
            setDropGhost({ x: event.clientX, y: event.clientY, count: candidate.group.length })
          } else if (dropGhost) {
            setDropGhost((current) => current ? { ...current, x: event.clientX, y: event.clientY } : current)
          }
          if (dropHoverTimer.current === null) {
            // 顿一下（350ms）即视为用户主动进入投送：弹出投送面板，相机保持锁死。
            dropHoverTimer.current = setTimeout(() => {
              dropHoverTimer.current = null
              const candidate = dragCandidate.current
              if (candidate) onStageTransfer?.(candidate.group.map((item) => item.id), anchor)
            }, 350)
          }
        } else if (dropGhost) {
          // 离开边缘后 gutter 必须立即熄灭。stageAnchor + 虚影仍保留，
          // 这样可以继续把虚影拖到已经展开的 DropShelf；若在画布中央松手则取消。
          setDropGutter(null)
          if (dropHoverTimer.current !== null) {
            clearTimeout(dropHoverTimer.current)
            dropHoverTimer.current = null
          }
          setDropGhost((current) => current ? { ...current, x: event.clientX, y: event.clientY } : current)
        } else {
          // 无投送意图：gutter 熄灭（松手不误触发），恢复自动平移。
          // 96px 外 auto-pan 强度为 0，不会因边界抖动而晃画布。
          if (dropHoverTimer.current !== null) {
            clearTimeout(dropHoverTimer.current)
            dropHoverTimer.current = null
          }
          setDropGutter(null)
          scheduleAutoPan({ x: event.clientX, y: event.clientY })
        }
        if (!dropGhost) {
          const point = toWorld(event.clientX, event.clientY, rect)
          dragPoint.current = { x: point.x - candidate.offsetX, y: point.y - candidate.offsetY }
          scheduleDraggedNode()
        }
      }
    }
    if (link.current || edgeReconnect.current) {
      if (linkStart.current && Math.hypot(event.clientX - linkStart.current.x, event.clientY - linkStart.current.y) > 4) {
        if (!linkMoved.current && linkPointerId.current !== null) {
          try { event.currentTarget.setPointerCapture(linkPointerId.current) } catch { /* pointer may already be released */ }
        }
        linkMoved.current = true
      }
      setLinkPoint(toWorld(event.clientX, event.clientY, rect))
      linkTarget.current = relationTargetAt(event.clientX, event.clientY)
    }
  }} onPointerUp={finishPointer} onPointerCancel={(event) => finishPointer(event, true)} onWheel={(event) => {
    event.preventDefault()
    if (locked) { event.stopPropagation(); return }
    const rect = event.currentTarget.getBoundingClientRect()
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1
    if (event.ctrlKey || event.metaKey) {
      const current = wheelZoom.current
      wheelZoom.current = { deltaY: (current?.deltaY ?? 0) + event.deltaY * unit, anchorX: event.clientX - rect.left, anchorY: event.clientY - rect.top, precision: event.shiftKey }
    } else {
      wheelPan.current = { x: wheelPan.current.x + event.deltaX * unit, y: wheelPan.current.y + event.deltaY * unit }
    }
    scheduleWheel()
  }} onDragOver={(event) => {
    if (event.dataTransfer.types.includes('Files')) event.preventDefault()
  }} onDrop={(event) => {
    const files = [...event.dataTransfer.files]
    if (files.length === 0) return
    event.preventDefault()
    const point = toWorld(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())
    onFilesDropped(files, point.x, point.y)
  }}>
    <div data-testid="canvas-world" className="canvas-world" style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})` }}>
      {workspaceFrames.map((frame) => <div key={frame.workspaceId} data-testid={`workspace-frame-${frame.workspaceId}`} data-workspace-frame={frame.workspaceId} data-member-count={frame.memberViewIds.length} className={`workspace-frame ${frame.active ? 'active' : ''} ${draggingWorkspaceId === frame.workspaceId ? 'dragging' : ''}`} style={{ left: frame.bounds.x, top: frame.bounds.y, width: frame.bounds.width, height: frame.bounds.height }}>
        <button data-testid={`workspace-frame-header-${frame.workspaceId}`} className="workspace-frame-header" type="button" onClick={(event) => { event.stopPropagation(); onWorkspaceActivate?.(frame.workspaceId) }} onPointerDown={(event) => {
          if (locked || event.button !== 0) return
          event.preventDefault(); event.stopPropagation()
          const members = frame.memberViewIds.map((id) => workspaceMemberNodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node)).map((node) => ({ id: node.id, x: node.x, y: node.y }))
          if (!members.length) return
          workspaceDrag.current = { workspaceId: frame.workspaceId, startX: event.clientX, startY: event.clientY, members, moved: false, frameBounds: frame.bounds, currentBounds: frame.bounds }
          onPresentationInteractionChange?.(true)
          setDraggingWorkspaceId(frame.workspaceId)
          onWorkspaceActivate?.(frame.workspaceId)
          try { canvasRef.current?.setPointerCapture(event.pointerId) } catch { /* browser owns capture */ }
        }}>
          <span>{frame.label}</span><b>{frame.active ? '当前 · ' : ''}{frame.memberViewIds.length} 项</b>
        </button>
        <button data-testid={`workspace-relation-in-${frame.workspaceId}`} data-relation-target={`workspace:${frame.workspaceId}`} className="workspace-relation-handle workspace-relation-in" type="button" aria-label={`连接到 Workspace ${frame.label}`} onPointerDown={(event) => event.stopPropagation()} />
        <button data-testid={`workspace-relation-out-${frame.workspaceId}`} data-relation-target={`workspace:${frame.workspaceId}`} className="workspace-relation-handle workspace-relation-out" type="button" aria-label={`从 Workspace ${frame.label} 建立关系`} onPointerDown={(event) => beginRelation(`workspace:${frame.workspaceId}`, event, { x: frame.bounds.x + frame.bounds.width, y: frame.bounds.y + frame.bounds.height / 2 })} />
        <button data-testid={`workspace-frame-resize-${frame.workspaceId}`} className="workspace-frame-resize" type="button" aria-label={`调整 ${frame.label} 框体大小`} title="拖动调整框体范围（不影响成员位置）" onPointerDown={(event) => {
          if (locked || event.button !== 0) return
          event.preventDefault(); event.stopPropagation()
          frameResize.current = { workspaceId: frame.workspaceId, startX: event.clientX, startY: event.clientY, originalBounds: { ...frame.bounds }, bounds: { ...frame.bounds }, moved: false }
          onPresentationInteractionChange?.(true)
          try { canvasRef.current?.setPointerCapture(event.pointerId) } catch { /* browser owns capture */ }
        }}><span /></button>
      </div>)}
      {returnGroups.map((group) => <div key={group.id} className="return-group-mat" data-return-group={group.id} style={{ left: group.x, top: group.y, width: group.width, height: group.height }}><span>{group.id} · {group.count} 个返回结果</span></div>)}
      {pendingZone && <div className="pending-return-zone" style={{ left: pendingZone.x, top: pendingZone.y, width: pendingZone.width, height: pendingZone.height }}><span>待确认结果区</span></div>}
      {onStageTransfer && draggingId && <><div className={`drop-gutter drop-gutter-left ${dropGutter === 'left' ? 'active' : ''}`} data-testid="drop-gutter-left"><span>投送</span></div><div className={`drop-gutter drop-gutter-bottom ${dropGutter === 'bottom' ? 'active' : ''}`} data-testid="drop-gutter-bottom"><span>投送</span></div></>}
      {dropGhost && <div className="lcos-drop-ghost" style={{ left: dropGhost.x, top: dropGhost.y }} aria-hidden="true">
        <span className="lcos-drop-ghost-stack"><i /><i /><i /></span>
        <strong>{dropGhost.count}</strong>
        <small>投送</small>
      </div>}
      {layoutPreview?.map((item) => { const node = byId.get(item.id); return node ? <div key={item.id} className="layout-ghost" style={{ left: item.x, top: item.y, width: node.width, height: node.height }}><span>{node.title}</span></div> : null })}
      <svg className="edges" width="1800" height="1100" aria-label="可编辑关系">
        {renderEdges.map((edge) => <EdgePath key={edge.id} edge={edge} from={relationById.get(edge.from)} to={relationById.get(edge.to)} selected={selectedEdgeId === edge.id} focused={Boolean(selectedId && (edge.from === selectedId || edge.to === selectedId))} onSelect={onSelectEdge} onCut={(edgeId) => { setEdges((current) => current.filter((item) => item.id !== edgeId)); onSelectEdge(null) }} onReconnectStart={(endpoint, event) => beginEdgeReconnect(edge, endpoint, event)} />)}
        {link.current && linkPoint && relationById.get(link.current.from) && <TemporaryEdge from={relationById.get(link.current.from)!} to={linkPoint} />}
        {edgeReconnect.current && linkPoint && relationById.get(edgeReconnect.current.fixedId) && <ReconnectTemporaryEdge fixed={relationById.get(edgeReconnect.current.fixedId)!} moving={linkPoint} endpoint={edgeReconnect.current.endpoint} />}
      </svg>
      {selectionBounds && <div data-testid="selection-bounds" className="selection-bounds" style={{ left: selectionBounds.x - 10, top: selectionBounds.y - 10, width: selectionBounds.width + 20, height: selectionBounds.height + 20 }} />}
      {renderNodes.map((node) => <CanvasCard key={node.id} node={node} density={nodeDensity(node, lod)} zoom={camera.zoom} showDetails={camera.zoom > .2 && lod !== 'overview'} runId={runId} runStatus={runStatus} selected={selectedIds.includes(node.id)} multiSelected={selectedIds.length > 1 && selectedIds.includes(node.id)} pending={pendingId === node.id} dragging={draggingId === node.id} resizing={resizingId === node.id} workspaceMember={Boolean(activeWorkspaceId && workspaceFrames.find((frame) => frame.workspaceId === activeWorkspaceId)?.memberViewIds.includes(node.id))} onDetails={onDetails} onPointerDown={(event) => {
        if (event.button !== 0) return
        event.stopPropagation()
        const now = performance.now()
        const previous = lastNodePress.current
        const isDoublePress = Boolean(previous && previous.id === node.id && now - previous.time <= 420 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= 12)
        lastNodePress.current = { id: node.id, time: now, x: event.clientX, y: event.clientY }
        if (link.current && link.current.from !== node.id) {
          connect(link.current.from, node.id)
          link.current = null
          linkTarget.current = null
          linkStart.current = null
          linkMoved.current = false
          setLinkPoint(null)
          return
        }
        doublePressCandidate.current = isDoublePress ? node.id : null
        const additive = additiveSelection(event)
        const preserveMultiSelection = !additive && selectedIds.length > 1 && selectedIds.includes(node.id)
        selectionCollapseCandidate.current = preserveMultiSelection ? node.id : null
        if (!preserveMultiSelection) onSelect(node.id, additive)
        const groupIds = selectedIds.includes(node.id) && selectedIds.length > 1 ? selectedIds : [node.id]
        dragCandidate.current = { id: node.id, startX: event.clientX, startY: event.clientY, offsetX: (event.clientX - event.currentTarget.getBoundingClientRect().left) / camera.zoom, offsetY: (event.clientY - event.currentTarget.getBoundingClientRect().top) / camera.zoom, group: groupIds.map((id) => { const member = nodes.find((item) => item.id === id)!; return { id, dx: member.x - node.x, dy: member.y - node.y } }), originals: groupIds.map((id) => { const member = nodes.find((item) => item.id === id)!; return { id, x: member.x, y: member.y } }) }
      }} onClick={() => {
        if (suppressClick.current === node.id) suppressClick.current = null
      }} onResizeStart={(event) => {
        if (locked || selectedIds.length !== 1) return
        event.preventDefault(); event.stopPropagation()
        resizeCandidate.current = { id: node.id, startX: event.clientX, startY: event.clientY, width: node.width, height: node.height, moved: false }
        onPresentationInteractionChange?.(true)
        setResizingId(node.id)
        try { canvasRef.current?.setPointerCapture(event.pointerId) } catch { /* browser owns capture */ }
      }} onLinkStart={(event) => beginRelation(node.id, event, { x: node.x + node.width, y: node.y + node.height / 2 })} />)}
      {lod !== 'full' && <div className="lod-badge">{nodes.length} 个节点 · {lod === 'overview' ? '总览聚合' : '视区降密度'}</div>}
    </div>
    {selectionToolbarPosition && <div data-testid="selection-toolbar" className="selection-toolbar lcos-selection-strip" style={selectionToolbarPosition} onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" aria-label="交给 Agent" title="交给 Agent" onClick={(event) => { event.stopPropagation(); onRequestAi() }}><Sparkles size={15} /><span>Agent</span></button>
      <button type="button" aria-label="创建 Collection" title="创建 Collection" onClick={(event) => { event.stopPropagation(); onCreateScopeFromSelection() }}><FolderTree size={15} /><span>Collection</span></button>
      {onStageTransfer && <button type="button" aria-label="投送所选" title="投送到其他空间" onClick={(event) => { event.stopPropagation(); onStageTransfer(selectedIds, 'bottom') }}><ArrowDownToLine size={15} /><span>投送</span></button>}
      <button type="button" aria-label="整理所选" title="整理所选 · Ctrl/Cmd+Shift+L" onClick={(event) => { event.stopPropagation(); onArrangeSelection() }}><LayoutGrid size={15} /><span>整理</span></button>
      <details className="lcos-selection-more" onPointerDown={(event) => event.stopPropagation()}>
        <summary aria-label="更多操作" title="更多操作"><Ellipsis size={15}/></summary>
        <div>
          <button type="button" onClick={() => onCopySelection()}><Copy size={12}/>复制</button>
          <button type="button" onClick={() => onDuplicateSelection()}><CopyPlus size={12}/>额外 View</button>
          <button type="button" className="danger" onClick={() => onDeleteSelection()}><Trash2 size={12}/>删除 View</button>
        </div>
      </details>
    </div>}
    {selectionComposer && selectionComposerPosition && <SelectionComposer
      nodes={nodes}
      selectedIds={selectedIds}
      zoom={camera.zoom}
      x={selectionComposerPosition.left}
      y={selectionComposerPosition.top}
      {...selectionComposer}
    />}
    {createMenu && <div data-testid="anchor-create-menu" className="anchor-create-menu" style={{ left: createMenu.screenX, top: createMenu.screenY }} onPointerDown={(event) => event.stopPropagation()}><span>在此创建并连接</span><button data-testid="anchor-create-note" onClick={() => { onCreateNodeFromAnchor('note', createMenu.x, createMenu.y, createMenu.from); setCreateMenu(null) }}>文本</button><button data-testid="anchor-create-context" onClick={() => { onCreateNodeFromAnchor('context', createMenu.x, createMenu.y, createMenu.from); setCreateMenu(null) }}>内容集合</button><button className="cancel" onClick={() => setCreateMenu(null)}>取消</button></div>}
    {marqueeRect && (() => { const rect = canvasRef.current?.getBoundingClientRect(); return <div data-testid="selection-marquee" className="marquee" style={{ left: marqueeRect.left - (rect?.left ?? 0), top: marqueeRect.top - (rect?.top ?? 0), width: marqueeRect.width, height: marqueeRect.height }} /> })()}
  </div>
})

function EdgePath({ edge, from, to, selected, focused, onSelect, onCut, onReconnectStart }: { edge: CanvasEdge; from?: CanvasNode; to?: CanvasNode; selected: boolean; focused: boolean; onSelect: (id: string) => void; onCut: (id: string) => void; onReconnectStart: (endpoint: 'from' | 'to', event: React.PointerEvent<SVGCircleElement>) => void }) {
  if (!from || !to) return null
  const x1 = from.x + from.width, y1 = from.y + from.height / 2, x2 = to.x, y2 = to.y + to.height / 2
  const d = `M ${x1} ${y1} C ${x1 + 80} ${y1}, ${x2 - 80} ${y2}, ${x2} ${y2}`
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const select = (event: React.PointerEvent<SVGPathElement>) => { event.stopPropagation(); onSelect(edge.id) }
  return <>
    <path className="edge-hit" data-edge-id={edge.id} d={d} onPointerDown={select} />
    <path className={`edge ${edge.kind} ${edge.active ? 'active' : ''} ${focused ? 'focused' : ''} ${selected ? 'selected' : ''}`} data-edge-id={edge.id} data-edge-from={edge.from} data-edge-to={edge.to} d={d} onPointerDown={select} />
    {edge.active && <circle className="edge-runner" r="2.4"><animateMotion dur="2.4s" repeatCount="indefinite" path={d} /></circle>}
    {selected && <g className="edge-controls" data-testid={`edge-controls-${edge.id}`}>
      <circle className="edge-control edge-terminal" data-testid={`edge-reconnect-from-${edge.id}`} cx={x1} cy={y1} r="7" onPointerDown={(event) => onReconnectStart('from', event)} />
      <circle className="edge-control edge-terminal" data-testid={`edge-reconnect-to-${edge.id}`} cx={x2} cy={y2} r="7" onPointerDown={(event) => onReconnectStart('to', event)} />
      <circle className="edge-control edge-cut-hit" data-testid={`edge-cut-${edge.id}`} cx={mx} cy={my} r="10" onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onCut(edge.id) }} />
      <path className="edge-cut-mark" d={`M ${mx - 3} ${my - 3} L ${mx + 3} ${my + 3} M ${mx + 3} ${my - 3} L ${mx - 3} ${my + 3}`} />
    </g>}
  </>
}

function TemporaryEdge({ from, to }: { from: CanvasNode; to: { x: number; y: number } }) {
  const x1 = from.x + from.width, y1 = from.y + from.height / 2
  return <path className="edge temporary" d={`M ${x1} ${y1} C ${x1 + 80} ${y1}, ${to.x - 80} ${to.y}, ${to.x} ${to.y}`} />
}

function ReconnectTemporaryEdge({ fixed, moving, endpoint }: { fixed: CanvasNode; moving: { x: number; y: number }; endpoint: 'from' | 'to' }) {
  const fixedX = endpoint === 'from' ? fixed.x : fixed.x + fixed.width
  const fixedY = fixed.y + fixed.height / 2
  const from = endpoint === 'from' ? moving : { x: fixedX, y: fixedY }
  const to = endpoint === 'from' ? { x: fixedX, y: fixedY } : moving
  return <path className="edge temporary reconnecting" d={`M ${from.x} ${from.y} C ${from.x + 72} ${from.y}, ${to.x - 72} ${to.y}, ${to.x} ${to.y}`} />
}

function CanvasCard({ node, density, zoom, showDetails, runId, runStatus, selected, multiSelected, pending, dragging, resizing, workspaceMember, onDetails, onPointerDown, onClick, onResizeStart, onLinkStart }: {
  node: CanvasNode; density: NodeDisplayMode; zoom: number; showDetails: boolean; runId: string; runStatus: RunStatus | null; selected: boolean; multiSelected: boolean; pending: boolean; dragging: boolean; resizing: boolean; workspaceMember: boolean
  onDetails: (id: string) => void; onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void; onClick: (additive?: boolean) => void; onResizeStart: (event: React.PointerEvent<HTMLButtonElement>) => void; onLinkStart: (event: React.PointerEvent<HTMLButtonElement>) => void
}) {
  const visualFamily = nodeVisualFamily(node)
  const revisionStack = (node.revisionCount ?? 0) > 1
  return <div data-node-id={node.id} data-node-kind={node.kind} data-node-visual-family={visualFamily} data-node-current={node.current || undefined} data-node-draft={node.draft || undefined} data-node-historical={node.historical || undefined} data-revision-count={node.revisionCount} data-result-group={node.resultGroupId} data-node-runtime={node.runtimeState} data-run-status={node.runStatus} data-artifact-id={node.artifactId} data-revision-id={node.revisionId} data-file-record-id={node.fileRecordId} data-current-revision={node.followsCurrentRevision || undefined} data-preview-status={node.previewStatus} data-view-of={node.viewOf} data-scope-id={node.scopeId} data-position-locked={node.positionLocked || undefined} data-context-only={node.contextOnly || undefined} data-testid={`canvas-node-${node.id}`} role="button" tabIndex={0} aria-disabled={node.disabled || undefined} className={`canvas-node node-family-${node.kind} visual-family-${visualFamily} density-${density} ${node.kind} ${revisionStack ? 'revision-stack' : ''} ${selected ? 'selected' : ''} ${multiSelected ? 'multi-selected' : ''} ${pending ? 'pending' : ''} ${dragging ? 'dragging' : ''} ${resizing ? 'resizing' : ''} ${workspaceMember ? 'workspace-active-member' : ''} ${node.error ? 'error' : ''} ${node.disabled ? 'disabled' : ''} ${node.positionLocked ? 'position-locked' : ''}`} style={{ left: node.x, top: node.y, width: node.width, height: node.height, '--node-ui-scale': String(1 / Math.max(.2, zoom)), '--canvas-zoom': String(zoom) } as React.CSSProperties} onDragStart={(event) => event.preventDefault()} onPointerDown={(event) => { if (!node.disabled) onPointerDown(event) }} onClick={(event) => { event.stopPropagation(); if (!node.disabled) onClick(additiveSelection(event)) }}>
    <button data-testid={`anchor-in-${node.id}`} className="anchor anchor-in" aria-label={`连接到 ${node.title}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} />
    <button data-testid={`anchor-out-${node.id}`} className="anchor anchor-out" aria-label={`从 ${node.title} 建立连接`} onPointerDown={onLinkStart} onClick={(event) => event.stopPropagation()} />
    {selected && !multiSelected && <button data-testid={`resize-${node.id}`} className="resize-handle" aria-label={`调整 ${node.title} 大小`} title="拖动调整卡片大小" onPointerDown={onResizeStart} onClick={(event) => event.stopPropagation()} />}
    <CanvasNodeVisual node={node} density={density} runId={runId} runStatus={runStatus} pending={pending} showDetails={showDetails} onDetails={() => onDetails(node.id)} />
  </div>
}
