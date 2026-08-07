import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { RuntimeProviderStatus } from '@local-creative-os/contracts'
import { ArrowDownToLine, Copy, CopyPlus, FolderTree, Grip, LayoutGrid, Trash2 } from 'lucide-react'
import type { Camera, CanvasEdge, CanvasNode, NodeDisplayMode, RunStatus, Workspace, WorkspaceFrameVM } from '../../model'
import { applyWheelGesture, getSelectionBounds, nodeDensity } from './canvasGeometry'
import { getPendingZoneBounds } from './canvasLayout'
import type { LayoutPreviewItem } from './scopeLayout'
import { CanvasNodeVisual, nodeVisualFamily } from './CanvasNodeVisual'
import { NodeContextToolbar } from './NodeContextToolbar'
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
type FrameResizeCandidate = { workspaceId: string; startX: number; startY: number; bounds: { x: number; y: number; width: number; height: number }; moved: boolean }

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
  const link = useRef<{ from: string } | null>(null)
  const linkPointerId = useRef<number | null>(null)
  const linkTarget = useRef<string | null>(null)
  const linkStart = useRef<{ x: number; y: number } | null>(null)
  const linkMoved = useRef(false)
  const [linkPoint, setLinkPoint] = useState<{ x: number; y: number } | null>(null)
  const [linkModeId, setLinkModeId] = useState<string | null>(null)
  const [panning, setPanning] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const [draggingWorkspaceId, setDraggingWorkspaceId] = useState<string | null>(null)
  const [dropGutter, setDropGutter] = useState<'left' | 'bottom' | null>(null)
  const marquee = useRef<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const [marqueeRect, setMarqueeRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const [createMenu, setCreateMenu] = useState<{ from: string; x: number; y: number; screenX: number; screenY: number } | null>(null)
  const toWorld = (clientX: number, clientY: number, rect: DOMRect) => ({ x: (clientX - rect.left - camera.x) / camera.zoom, y: (clientY - rect.top - camera.y) / camera.zoom })
  const lod = nodes.length >= 300 ? 'overview' : nodes.length >= 150 ? 'simplified' : 'full'
  const renderNodes = lod === 'overview' ? nodes.filter((_, index) => index % 4 === 0) : nodes
  const renderIds = new Set(renderNodes.map((node) => node.id))
  const renderEdges = lod === 'overview' ? edges.filter((edge) => renderIds.has(edge.from) && renderIds.has(edge.to)) : edges
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const selectedBounds = useMemo(() => selectedIds.length ? getSelectionBounds(nodes, selectedIds) : null, [nodes, selectedIds])
  const selectionBounds = selectedIds.length > 1 ? selectedBounds : null
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
      setLinkModeId(null)
      link.current = null
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
    linkTarget.current = null
    linkStart.current = null
    linkMoved.current = false
    lastNodePress.current = null
    suppressClick.current = null
    setPanning(false)
    setDraggingId(null)
    setResizingId(null)
    setDraggingWorkspaceId(null)
    setMarqueeRect(null)
    setCreateMenu(null)
    setLinkModeId(null)
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
    return {
      left: Math.max(rect.left, dock ? dock.right + 10 : rect.left),
      right: Math.min(rect.right, rail ? rail.left - 10 : rect.right),
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
    const nextId = `edge-${Date.now()}`
    setSelectedEdgeId(selectedEdgeId ?? nextId)
    setEdges((current) => {
      const selected = selectedEdgeId ? current.find((edge) => edge.id === selectedEdgeId) : undefined
      if (selected && selected.from === from) return current.map((edge) => edge.id === selected.id ? { ...edge, to } : edge)
      if (current.some((edge) => edge.from === from && edge.to === to)) return current
      return [...current, { id: nextId, from, to, kind: 'reference' }]
    })
    setLinkModeId(null)
  }
  const finishPresentationInteraction = (kind: 'node-move' | 'node-resize' | 'workspace-group-move') => {
    onPresentationInteractionChange?.(false)
    onPresentationCommit?.(kind)
  }

  const dropAnchorAt = (clientX: number, clientY: number, rect: DOMRect): 'left' | 'bottom' | null => {
    const bottomDockTop = rect.bottom - 64
    const bottomCaptureTop = bottomDockTop - 92
    if (clientY >= bottomCaptureTop && clientY < bottomDockTop) return 'bottom'
    if (clientX <= rect.left + 92) return 'left'
    return null
  }

  const restoreDraggedOriginals = (candidate: DragCandidate | null) => {
    if (!candidate) return
    const originals = new Map(candidate.originals.map((item) => [item.id, item]))
    setNodes((current) => current.map((node) => { const original = originals.get(node.id); return original ? { ...node, x: original.x, y: original.y } : node }))
  }

  const finishPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (locked) {
      event.preventDefault()
      event.stopPropagation()
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      return
    }
    const wasDragging = dragging.current
    const activeDropGutter = dropGutter
    const draggedCandidate = dragCandidate.current
    const draggedId = dragCandidate.current?.id
    const resizedId = resizeCandidate.current?.moved ? resizeCandidate.current.id : undefined
    const draggedWorkspace = workspaceDrag.current?.moved ? workspaceDrag.current.workspaceId : undefined
    const resizedFrame = frameResize.current?.moved ? frameResize.current : undefined
    if (dragFrame.current !== null) {
      cancelAnimationFrame(dragFrame.current)
      dragFrame.current = null
      const point = dragPoint.current
      if (activeDropGutter && wasDragging && draggedCandidate) restoreDraggedOriginals(draggedCandidate)
      else if (draggedId && point) setNodes((current) => {
        const group = dragCandidate.current?.group ?? []
        return group.length > 1
          ? current.map((node) => { const member = group.find((item) => item.id === node.id); return member ? { ...node, x: point.x + member.dx, y: point.y + member.dy } : node })
          : current.map((node) => node.id === draggedId ? { ...node, x: point.x, y: point.y } : node)
      })
    } else if (activeDropGutter && wasDragging && draggedCandidate) {
      restoreDraggedOriginals(draggedCandidate)
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
    else if (wasDragging && draggedId && !activeDropGutter) finishPresentationInteraction('node-move')
    else if (resizeCandidate.current || workspaceDrag.current) onPresentationInteractionChange?.(false)
    if (activeDropGutter && wasDragging && draggedCandidate) {
      onPresentationInteractionChange?.(false)
      onStageTransfer?.(draggedCandidate.group.map((item) => item.id), activeDropGutter)
    }
    setDropGutter(null)
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
      const ids = nodes.filter((node) => {
        const x = rect.left + camera.x + node.x * camera.zoom
        const y = rect.top + camera.y + node.y * camera.zoom
        const w = node.width * camera.zoom
        const h = node.height * camera.zoom
        return x < right && x + w > left && y < bottom && y + h > top
      }).map((node) => node.id)
      onMarqueeSelect(ids, additiveSelection(event))
      marquee.current = null
      setMarqueeRect(null)
      return
    }
    if (link.current) {
      const source = link.current.from
      const target = linkTarget.current ?? document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId
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

  return <div ref={canvasRef} data-testid="canvas" data-node-count={nodes.length} data-edge-count={edges.length} data-locked={locked || undefined} data-camera-x={camera.x} data-camera-y={camera.y} data-camera-zoom={camera.zoom} aria-busy={locked || undefined} className={`canvas lod-${lod} zoom-band-${zoomBand} ${selectedId ? 'has-focus' : ''} ${panning ? 'panning' : ''} ${linkModeId ? 'relation-mode' : ''} ${locked ? 'is-locked' : ''}`} onPointerDown={(event) => {
    if (locked) { event.preventDefault(); event.stopPropagation(); return }
    if (event.button === 1) {
      event.preventDefault()
      pan.current = { x: event.clientX, y: event.clientY, camera }
      setPanning(true)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    const target = event.target as HTMLElement
    const blankCanvas = !target.closest('[data-node-id], button, .edge')
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
      setLinkModeId(null)
      if (!additiveSelection(event)) onClearSelection()
      marquee.current = { startX: event.clientX, startY: event.clientY, currentX: event.clientX, currentY: event.clientY }
      setMarqueeRect({ left: event.clientX, top: event.clientY, width: 0, height: 0 })
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
        x: item.bounds.x,
        y: item.bounds.y,
        width: Math.max(220, item.bounds.width + dx),
        height: Math.max(140, item.bounds.height + dy),
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
      setMarqueeRect({ left: Math.min(box.startX, box.currentX), top: Math.min(box.startY, box.currentY), width: Math.abs(box.currentX - box.startX), height: Math.abs(box.currentY - box.startY) })
    }
    const candidate = dragCandidate.current
    if (candidate) {
      const moved = Math.hypot(event.clientX - candidate.startX, event.clientY - candidate.startY)
      if (!dragging.current && moved > 4) {
        dragging.current = true
        onPresentationInteractionChange?.(true)
        setDraggingId(candidate.id)
        linkPointerId.current = event.pointerId
        try { canvasRef.current?.setPointerCapture(event.pointerId) } catch { /* synthetic or already released */ }
      }
      if (dragging.current) {
        const anchor = onStageTransfer ? dropAnchorAt(event.clientX, event.clientY, rect) : null
        setDropGutter((current) => current === anchor ? current : anchor)
        const point = toWorld(event.clientX, event.clientY, rect)
        dragPoint.current = { x: point.x - candidate.offsetX, y: point.y - candidate.offsetY }
        scheduleDraggedNode()
        if (anchor) stopAutoPan()
        else scheduleAutoPan({ x: event.clientX, y: event.clientY })
      }
    }
    if (link.current) {
      if (linkStart.current && Math.hypot(event.clientX - linkStart.current.x, event.clientY - linkStart.current.y) > 4) linkMoved.current = true
      setLinkPoint(toWorld(event.clientX, event.clientY, rect))
      linkTarget.current = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId ?? null
    }
  }} onPointerUp={finishPointer} onPointerCancel={finishPointer} onWheel={(event) => {
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
  }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
    event.preventDefault()
    const point = toWorld(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())
    onFilesDropped([...event.dataTransfer.files], point.x, point.y)
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
        <button data-testid={`workspace-frame-resize-${frame.workspaceId}`} className="workspace-frame-resize" type="button" aria-label={`调整 ${frame.label} 框体大小`} title="拖动调整框体范围（不影响成员位置）" onPointerDown={(event) => {
          if (locked || event.button !== 0) return
          event.preventDefault(); event.stopPropagation()
          frameResize.current = { workspaceId: frame.workspaceId, startX: event.clientX, startY: event.clientY, bounds: frame.bounds, moved: false }
          onPresentationInteractionChange?.(true)
          try { canvasRef.current?.setPointerCapture(event.pointerId) } catch { /* browser owns capture */ }
        }}><span /></button>
      </div>)}
      {returnGroups.map((group) => <div key={group.id} className="return-group-mat" data-return-group={group.id} style={{ left: group.x, top: group.y, width: group.width, height: group.height }}><span>{group.id} · {group.count} 个返回结果</span></div>)}
      {pendingZone && <div className="pending-return-zone" style={{ left: pendingZone.x, top: pendingZone.y, width: pendingZone.width, height: pendingZone.height }}><span>待确认结果区</span></div>}
      {onStageTransfer && draggingId && <><div className={`drop-gutter drop-gutter-left ${dropGutter === 'left' ? 'active' : ''}`} data-testid="drop-gutter-left"><span>投送</span></div><div className={`drop-gutter drop-gutter-bottom ${dropGutter === 'bottom' ? 'active' : ''}`} data-testid="drop-gutter-bottom"><span>投送</span></div></>}
      {layoutPreview?.map((item) => { const node = byId.get(item.id); return node ? <div key={item.id} className="layout-ghost" style={{ left: item.x, top: item.y, width: node.width, height: node.height }}><span>{node.title}</span></div> : null })}
      <svg className="edges" width="1800" height="1100" aria-label="可编辑关系">{renderEdges.map((edge) => <EdgePath key={edge.id} edge={edge} from={byId.get(edge.from)} to={byId.get(edge.to)} selected={selectedEdgeId === edge.id} focused={Boolean(selectedId && (edge.from === selectedId || edge.to === selectedId))} onSelect={onSelectEdge} />)}{link.current && linkPoint && byId.get(link.current.from) && <TemporaryEdge from={byId.get(link.current.from)!} to={linkPoint} />}</svg>
      {selectionBounds && <div data-testid="selection-bounds" className="selection-bounds" style={{ left: selectionBounds.x - 10, top: selectionBounds.y - 10, width: selectionBounds.width + 20, height: selectionBounds.height + 20 }}>
        <div className="selection-toolbar"><span>已选择 {selectedIds.length} 个对象</span>
          <button type="button" aria-label="复制所选" title="复制所选 · Ctrl/Cmd+C" onClick={(event) => { event.stopPropagation(); onCopySelection() }}><Copy size={13} />复制</button>
          <button type="button" aria-label="创建额外视图" title="创建额外视图 · Ctrl/Cmd+D" onClick={(event) => { event.stopPropagation(); onDuplicateSelection() }}><CopyPlus size={13} />额外视图</button>
          <button type="button" aria-label="整理所选" title="按语义整理所选 · Ctrl/Cmd+Shift+L" onClick={(event) => { event.stopPropagation(); onArrangeSelection() }}><LayoutGrid size={13} />整理</button>
          <button type="button" aria-label="创建子画布" title="把所选对象整理成子画布" onClick={(event) => { event.stopPropagation(); onCreateScopeFromSelection() }}><FolderTree size={13} />子画布</button>
          {onStageTransfer && <button type="button" aria-label="投送所选" title="投送到工作空间、子画布或当前现场" onClick={(event) => { event.stopPropagation(); onStageTransfer(selectedIds, 'bottom') }}><ArrowDownToLine size={13} />投送</button>}
          <button aria-label="拖动选中组" title="拖动整组" onPointerDown={(event) => {
            event.stopPropagation()
            const first = nodes.find((node) => selectedIds.includes(node.id))
            if (!first) return
            const nodeElement = canvasRef.current?.querySelector<HTMLElement>(`[data-node-id="${first.id}"]`)
            const rect = nodeElement?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect()
            dragCandidate.current = { id: first.id, startX: event.clientX, startY: event.clientY, offsetX: (event.clientX - rect.left) / camera.zoom, offsetY: (event.clientY - rect.top) / camera.zoom, group: selectedIds.map((id) => { const member = nodes.find((item) => item.id === id)!; return { id, dx: member.x - first.x, dy: member.y - first.y } }), originals: selectedIds.map((id) => { const member = nodes.find((item) => item.id === id)!; return { id, x: member.x, y: member.y } }) }
          }}><Grip size={13} />拖动</button>
          <button type="button" className="danger" aria-label="删除所选" title="删除所选" onClick={(event) => { event.stopPropagation(); onDeleteSelection() }}><Trash2 size={13} /></button>
        </div>
      </div>}
      {selectionComposer && selectedBounds && camera.zoom > .28 && <SelectionComposer
        nodes={nodes}
        selectedIds={selectedIds}
        zoom={camera.zoom}
        x={selectedBounds.x}
        y={selectedBounds.y + selectedBounds.height + 18 / Math.max(.24, camera.zoom)}
        {...selectionComposer}
      />}
      {renderNodes.map((node) => <CanvasCard key={node.id} node={node} density={nodeDensity(node, lod)} zoom={camera.zoom} showDetails={camera.zoom > .2 && lod !== 'overview'} runId={runId} runStatus={runStatus} selected={selectedIds.includes(node.id)} multiSelected={selectedIds.length > 1 && selectedIds.includes(node.id)} linkMode={linkModeId === node.id} pending={pendingId === node.id} dragging={draggingId === node.id} resizing={resizingId === node.id} workspaceMember={Boolean(activeWorkspaceId && workspaceFrames.find((frame) => frame.workspaceId === activeWorkspaceId)?.memberViewIds.includes(node.id))} onRequestAi={onRequestAi} onDuplicateSelection={onDuplicateSelection} onToggleLinkMode={() => setLinkModeId((current) => current === node.id ? null : node.id)} onDetails={onDetails} onPointerDown={(event) => {
        if (event.button !== 0) return
        event.stopPropagation()
        const now = performance.now()
        const previous = lastNodePress.current
        const isDoublePress = Boolean(previous && previous.id === node.id && now - previous.time <= 420 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= 12)
        lastNodePress.current = { id: node.id, time: now, x: event.clientX, y: event.clientY }
        if (isDoublePress) {
          suppressClick.current = node.id
          dragCandidate.current = null
          resizeCandidate.current = null
          workspaceDrag.current = null
          lastNodePress.current = null
          onDoubleClick(node.id)
          return
        }
        if (link.current && link.current.from !== node.id) {
          connect(link.current.from, node.id)
          link.current = null
          linkTarget.current = null
          linkStart.current = null
          linkMoved.current = false
          setLinkPoint(null)
          return
        }
        onSelect(node.id, additiveSelection(event))
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
      }} onLinkStart={(event) => {
        event.stopPropagation()
        link.current = { from: node.id }
        linkStart.current = { x: event.clientX, y: event.clientY }
        linkMoved.current = false
        setLinkPoint({ x: node.x + node.width, y: node.y + node.height / 2 })
        linkPointerId.current = event.pointerId
        try { canvasRef.current?.setPointerCapture(event.pointerId) } catch { /* synthetic or already released */ }
      }} />)}
      {lod !== 'full' && <div className="lod-badge">{nodes.length} 个节点 · {lod === 'overview' ? '总览聚合' : '简化显示'} · 演示数据</div>}
    </div>
    {createMenu && <div data-testid="anchor-create-menu" className="anchor-create-menu" style={{ left: createMenu.screenX, top: createMenu.screenY }} onPointerDown={(event) => event.stopPropagation()}><span>在此创建并连接</span><button data-testid="anchor-create-note" onClick={() => { onCreateNodeFromAnchor('note', createMenu.x, createMenu.y, createMenu.from); setCreateMenu(null) }}>文本</button><button data-testid="anchor-create-context" onClick={() => { onCreateNodeFromAnchor('context', createMenu.x, createMenu.y, createMenu.from); setCreateMenu(null) }}>内容集合</button><button className="cancel" onClick={() => setCreateMenu(null)}>取消</button></div>}
    {marqueeRect && (() => { const rect = canvasRef.current?.getBoundingClientRect(); return <div data-testid="selection-marquee" className="marquee" style={{ left: marqueeRect.left - (rect?.left ?? 0), top: marqueeRect.top - (rect?.top ?? 0), width: marqueeRect.width, height: marqueeRect.height }} /> })()}
  </div>
})

function EdgePath({ edge, from, to, selected, focused, onSelect }: { edge: CanvasEdge; from?: CanvasNode; to?: CanvasNode; selected: boolean; focused: boolean; onSelect: (id: string) => void }) {
  if (!from || !to) return null
  const x1 = from.x + from.width, y1 = from.y + from.height / 2, x2 = to.x, y2 = to.y + to.height / 2
  const d = `M ${x1} ${y1} C ${x1 + 80} ${y1}, ${x2 - 80} ${y2}, ${x2} ${y2}`
  const select = (event: React.PointerEvent<SVGPathElement>) => { event.stopPropagation(); onSelect(edge.id) }
  return <><path className="edge-hit" data-edge-id={edge.id} d={d} onPointerDown={select} /><path className={`edge ${edge.kind} ${edge.active ? 'active' : ''} ${focused ? 'focused' : ''} ${selected ? 'selected' : ''}`} data-edge-id={edge.id} data-edge-from={edge.from} data-edge-to={edge.to} d={d} onPointerDown={select} />{edge.active && <circle className="edge-runner" r="2.4"><animateMotion dur="2.4s" repeatCount="indefinite" path={d} /></circle>}</>
}

function TemporaryEdge({ from, to }: { from: CanvasNode; to: { x: number; y: number } }) {
  const x1 = from.x + from.width, y1 = from.y + from.height / 2
  return <path className="edge temporary" d={`M ${x1} ${y1} C ${x1 + 80} ${y1}, ${to.x - 80} ${to.y}, ${to.x} ${to.y}`} />
}

function CanvasCard({ node, density, zoom, showDetails, runId, runStatus, selected, multiSelected, linkMode, pending, dragging, resizing, workspaceMember, onRequestAi, onDuplicateSelection, onToggleLinkMode, onDetails, onPointerDown, onClick, onResizeStart, onLinkStart }: {
  node: CanvasNode; density: NodeDisplayMode; zoom: number; showDetails: boolean; runId: string; runStatus: RunStatus | null; selected: boolean; multiSelected: boolean; linkMode: boolean; pending: boolean; dragging: boolean; resizing: boolean; workspaceMember: boolean
  onRequestAi: () => void; onDuplicateSelection: () => void; onToggleLinkMode: () => void; onDetails: (id: string) => void; onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void; onClick: (additive?: boolean) => void; onResizeStart: (event: React.PointerEvent<HTMLButtonElement>) => void; onLinkStart: (event: React.PointerEvent<HTMLButtonElement>) => void
}) {
  const visualFamily = nodeVisualFamily(node)
  const revisionStack = (node.revisionCount ?? 0) > 1
  return <div data-node-id={node.id} data-node-kind={node.kind} data-node-visual-family={visualFamily} data-node-current={node.current || undefined} data-node-draft={node.draft || undefined} data-node-historical={node.historical || undefined} data-revision-count={node.revisionCount} data-result-group={node.resultGroupId} data-node-runtime={node.runtimeState} data-run-status={node.runStatus} data-artifact-id={node.artifactId} data-revision-id={node.revisionId} data-file-record-id={node.fileRecordId} data-current-revision={node.followsCurrentRevision || undefined} data-preview-status={node.previewStatus} data-view-of={node.viewOf} data-scope-id={node.scopeId} data-position-locked={node.positionLocked || undefined} data-context-only={node.contextOnly || undefined} data-testid={`canvas-node-${node.id}`} role="button" tabIndex={0} aria-disabled={node.disabled || undefined} className={`canvas-node node-family-${node.kind} visual-family-${visualFamily} density-${density} ${node.kind} ${revisionStack ? 'revision-stack' : ''} ${selected ? 'selected' : ''} ${multiSelected ? 'multi-selected' : ''} ${linkMode ? 'link-mode' : ''} ${pending ? 'pending' : ''} ${dragging ? 'dragging' : ''} ${resizing ? 'resizing' : ''} ${workspaceMember ? 'workspace-active-member' : ''} ${node.error ? 'error' : ''} ${node.disabled ? 'disabled' : ''} ${node.positionLocked ? 'position-locked' : ''}`} style={{ left: node.x, top: node.y, width: node.width, height: node.height, '--node-ui-scale': String(1 / Math.max(.2, zoom)), '--canvas-zoom': String(zoom) } as React.CSSProperties} onPointerDown={(event) => { if (!node.disabled) onPointerDown(event) }} onClick={(event) => { event.stopPropagation(); if (!node.disabled) onClick(additiveSelection(event)) }}>
    {selected && !multiSelected && <NodeContextToolbar zoom={zoom} onAi={onRequestAi} onRelation={onToggleLinkMode} onDuplicate={onDuplicateSelection} />}
    <button data-testid={`anchor-in-${node.id}`} className="anchor anchor-in" aria-label={`连接到 ${node.title}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} />
    <button data-testid={`anchor-out-${node.id}`} className="anchor anchor-out" aria-label={`从 ${node.title} 建立连接`} onPointerDown={onLinkStart} onClick={(event) => event.stopPropagation()} />
    {selected && !multiSelected && <button data-testid={`resize-${node.id}`} className="resize-handle" aria-label={`调整 ${node.title} 大小`} title="拖动调整卡片大小" onPointerDown={onResizeStart} onClick={(event) => event.stopPropagation()} />}
    <CanvasNodeVisual node={node} density={density} runId={runId} runStatus={runStatus} pending={pending} showDetails={showDetails} onDetails={() => onDetails(node.id)} />
  </div>
}
