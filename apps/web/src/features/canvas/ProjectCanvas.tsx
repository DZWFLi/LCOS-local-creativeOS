import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { AttentionBucketV0, RuntimeProviderStatus } from '@local-creative-os/contracts'
import { Copy, CopyPlus, Crosshair, Ellipsis, Fence, FolderTree, GripVertical, LayoutGrid, Pencil, Trash2 } from 'lucide-react'
import type { Camera, CanvasEdge, CanvasNode, NodeDisplayMode, RunStatus, WorkspaceFrameVM } from '../../model'
import { getSelectionBounds, nodeDensity } from './canvasGeometry'
import { getVisualSelectionBounds, MAIN_CANVAS_GRID_STEP, nodeVisualBounds, nodeVisualInsets } from './canvasVisualGeometry'
import { getPendingZoneBounds } from './canvasLayout'
import type { LayoutPreviewItem } from './scopeLayout'
import type { SpatialRegionDraft } from '../../state/spatialRegion'
import { CanvasNodeVisual, detectFileIdentity, displayNodeTitle, nodeVisualFamily } from './CanvasNodeVisual'
import { SelectionComposer } from './SelectionComposer'
import type { ArtifactRevisionProvenance } from '../../runtime/projectionAdapters'
import { SpatialCanvas } from '../spatial/SpatialCanvas'
import { SpatialEdgeLayer } from '../spatial/SpatialEdgeLayer'
import { SpatialNodeLayer } from '../spatial/SpatialNodeLayer'
import { edgeScrollDelta, spatialBoundsForPlacements, spatialScreenToWorld, spatialViewportWorldBounds, spatialWorldToScreen } from '../spatial/spatialCamera'
import { spatialIdsIntersectingScreenRect } from '../spatial/spatialHitTest'
import { spatialLodForCount } from '../spatial/spatialLod'
import { advanceSpatialMarquee, beginSpatialMarquee, endSpatialPointer, spatialMarqueeRect } from '../spatial/spatialInteractionMachine'
import { IDLE_SPATIAL_POINTER, type SpatialPointerSession } from '../spatial/spatialTypes'
import { LightCurtain } from '../drop/LightCurtain'
import { semanticDropTriggerFromPointer, type SemanticDropTrigger } from '../spatial/semanticDrop'
import { LcosSignalGlyph, type LcosSignalState } from '../design/DotGlyph'
import type { SurfaceElement } from '../spatial/model/surfaceElementTypes'
import { resolveSurfaceComponent } from '../spatial/components/surfaceComponentRegistry'
import { SurfaceFrame } from '../spatial/components/SurfaceFrame'

interface Props {
  projectId?: string
  surfaceMode?: 'project' | 'capture'
  nodes: CanvasNode[]; setNodes: (nodes: CanvasNode[] | ((current: CanvasNode[]) => CanvasNode[])) => void
  edges: CanvasEdge[]; setEdges: (edges: CanvasEdge[] | ((current: CanvasEdge[]) => CanvasEdge[])) => void
  camera: Camera; setCamera: (camera: Camera | ((current: Camera) => Camera)) => void
  selectedId: string | null; selectedIds: string[]; selectedEdgeId: string | null; setSelectedEdgeId: (id: string | null) => void; pendingId: string | null; runId: string; runStatus: RunStatus | null; spaceHeld: boolean; locked?: boolean
  onSelect: (id: string, additive?: boolean) => void; onClearSelection: () => void; onMarqueeSelect: (ids: string[], additive: boolean) => void; onSelectEdge: (id: string | null) => void; onDoubleClick: (id: string) => void; onDetails: (id: string) => void; onFocusSelection?: () => void; onRenameSelection?: () => void
  layoutPreview?: LayoutPreviewItem[] | null
  workspaceFrames?: WorkspaceFrameVM[]
  workspaceMemberNodes?: CanvasNode[]
  activeWorkspaceId?: string | null
  onWorkspaceActivate?: (workspaceId: string) => void
  onWorkspaceProjectionMove?: (workspaceId: string, x: number, y: number) => void
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
    busy: boolean
    ambiguityQuestion?: string
    onPromptChange: (value: string) => void
    onProviderChange: (value: string) => void
    onCreateAsNewNodeChange: (value: boolean) => void
    onIntentChange?: (value: 'analyze' | 'create' | 'revise') => void
    onResultPolicyChange?: (value: 'reply_only' | 'create_artifact' | 'create_collection' | 'draft_revision_per_target') => void
    onToggleContext: (id: string) => void
    onSend: () => void
    onClose: () => void
  }
  onCreateNodeFromAnchor: (kind: 'note' | 'context', x: number, y: number, from: string) => void; onFilesDropped: (files: File[], x: number, y: number) => void; onExternalTextDrop?: (text: string, x: number, y: number) => void; onMaterialTransferDrop?: (raw: string, x: number, y: number) => void
  onArrangeSelection: () => void; gridSnapEnabled?: boolean; onSetSelectionDisplayMode?: (mode: NodeDisplayMode) => void; onCopySelection: () => void; onDuplicateSelection: () => void; onCreateScopeFromSelection: () => void; onDeleteSelection: () => void; onPointerWorldChange: (point: { x: number; y: number }) => void; onSpaceCreate: (point: { x: number; y: number }) => void
  onReorganize?: () => void
  onDirectProjectViewDrop?: (targetViewId: string, ids: readonly string[]) => void
  /** GUI-6：锚定备注定位（宿主把相机移到锚点目标并脉冲高亮）。 */
  onLocateNode?: (id: string) => void
  locatePulseId?: string | null
  pendingReviewIds?: readonly string[]
  attentionBucketsByViewId?: Readonly<Record<string, AttentionBucketV0>>
  collectionMembersByNodeId?: Readonly<Record<string, readonly CanvasNode[]>>
  expandedCollectionScopeIds?: readonly string[]
  openingCollectionScopeIds?: readonly string[]
  closingCollectionScopeIds?: readonly string[]
  onToggleCollection?: (collectionScopeId: string) => void
  onOpenContextLens?: (node: CanvasNode, lens: 'space' | 'structure' | 'evolution') => void
  spatialRegions?: readonly SpatialRegionDraft[]
  onCreateRegion?: () => void
  onClearRegion?: (regionId: string) => void
  onRegionBoundsChange?: (regionId: string, bounds: SpatialRegionDraft['bounds']) => void
  onRegionBoundsCommit?: (regionId: string, bounds: SpatialRegionDraft['bounds']) => void
  onPromoteRegionToCollection?: (regionId: string) => void
}

type DragCandidate = { id: string; startX: number; startY: number; offsetX: number; offsetY: number; group: Array<{ id: string; dx: number; dy: number }>; originals: Array<{ id: string; x: number; y: number }> }
type ResizeCandidate = { id: string; startX: number; startY: number; width: number; height: number; moved: boolean }
type WorkspaceDragCandidate = { workspaceId: string; startX: number; startY: number; members: Array<{ id: string; x: number; y: number }>; moved: boolean; frameBounds?: { x: number; y: number; width: number; height: number }; currentBounds?: { x: number; y: number; width: number; height: number } }
type FrameResizeCandidate = { workspaceId: string; startX: number; startY: number; originalBounds: { x: number; y: number; width: number; height: number }; bounds: { x: number; y: number; width: number; height: number }; moved: boolean }
type EdgeReconnectCandidate = { edgeId: string; endpoint: 'from' | 'to'; fixedId: string }
const EDGE_SCROLL_BAND = 96
const EDGE_SCROLL_MAX_PX_PER_FRAME = 18

function additiveSelection(event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean {
  return event.shiftKey || event.ctrlKey || event.metaKey
}

export const ProjectCanvas = memo(function ProjectCanvas({ projectId = 'capture-space', surfaceMode = 'project', nodes, setNodes, edges, setEdges, camera, setCamera, selectedId, selectedIds, selectedEdgeId, setSelectedEdgeId, pendingId, runId, runStatus, spaceHeld, locked = false, layoutPreview, workspaceFrames = [], workspaceMemberNodes = nodes, activeWorkspaceId = null, onWorkspaceActivate, onWorkspaceProjectionMove, onPresentationInteractionChange, onPresentationCommit, onFrameBoundsChange, selectionComposer, onSelect, onClearSelection, onMarqueeSelect, onSelectEdge, onDoubleClick, onDetails, onFocusSelection, onRenameSelection, onCreateNodeFromAnchor, onFilesDropped, onExternalTextDrop, onMaterialTransferDrop, onArrangeSelection, gridSnapEnabled = true, onSetSelectionDisplayMode, onCopySelection, onDuplicateSelection, onCreateScopeFromSelection, onDeleteSelection, onReorganize, onDirectProjectViewDrop, onPointerWorldChange, onSpaceCreate, onLocateNode, locatePulseId, pendingReviewIds = [], attentionBucketsByViewId = {}, collectionMembersByNodeId = {}, expandedCollectionScopeIds = [], openingCollectionScopeIds = [], closingCollectionScopeIds = [], onToggleCollection, onOpenContextLens, spatialRegions = [], onCreateRegion, onClearRegion, onRegionBoundsChange, onRegionBoundsCommit, onPromoteRegionToCollection }: Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const dragCandidate = useRef<DragCandidate | null>(null)
  const resizeCandidate = useRef<ResizeCandidate | null>(null)
  const workspaceDrag = useRef<WorkspaceDragCandidate | null>(null)
  const frameResize = useRef<FrameResizeCandidate | null>(null)
  // Semantic Drop is the interaction. Right-drag is the fastest trigger;
  // Alt/Option + primary drag and the explicit grab handle feed the same session.
  const semanticDropSession = useRef<{ ids: string[]; pointerId: number; startX: number; startY: number; trigger: SemanticDropTrigger; buttonMask: number } | null>(null)
  const semanticDropMoved = useRef(false)
  const contextMenuGuard = useRef<((event: Event) => void) | null>(null)
  const dragging = useRef(false)
  const dragPoint = useRef<{ x: number; y: number } | null>(null)
  const dragFrame = useRef<number | null>(null)
  const autoPanFrame = useRef<number | null>(null)
  const autoPanPointer = useRef<{ x: number; y: number } | null>(null)
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
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [alignmentGuide, setAlignmentGuide] = useState<{ readonly x?: number; readonly y?: number } | null>(null)
  const [dragSignal, setDragSignal] = useState({ x: 0, y: 0 })
  const collectionMotionByNodeId = useMemo(() => {
    const result = new Map<string, { phase: 'opening' | 'closing'; dx: number; dy: number }>()
    const opening = new Set(openingCollectionScopeIds)
    const closing = new Set(closingCollectionScopeIds)
    if (!opening.size && !closing.size) return result
    for (const container of nodes) {
      if (container.entityKind !== 'collection') continue
      const scopeId = container.opensScopeId ?? (container.id.startsWith('scope:') ? container.id.slice('scope:'.length) : null)
      if (!scopeId) continue
      const phase = opening.has(scopeId) ? 'opening' : closing.has(scopeId) ? 'closing' : null
      if (!phase) continue
      const members = collectionMembersByNodeId[container.id] ?? collectionMembersByNodeId[`scope:${scopeId}`] ?? []
      const targetX = container.x + container.width * .56
      const targetY = container.y + container.height * .52
      for (const member of members) {
        result.set(member.id, {
          phase,
          dx: targetX - (member.x + member.width * .5),
          dy: targetY - (member.y + member.height * .5),
        })
      }
    }
    return result
  }, [closingCollectionScopeIds, collectionMembersByNodeId, nodes, openingCollectionScopeIds])
  const lastDragPointer = useRef<{ x: number; y: number } | null>(null)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const [draggingWorkspaceId, setDraggingWorkspaceId] = useState<string | null>(null)
  // PERF-150: drag preview is local to ProjectCanvas. Project Presentation commits once on pointerup.
  const [dragPreviewPositions, setDragPreviewPositions] = useState<Record<string, { x: number; y: number }> | null>(null)
  const directProjectViewTarget = useRef<{ id: string; label: string } | null>(null)
  const directProjectViewElement = useRef<HTMLElement | null>(null)
  const [dropGhost, setDropGhost] = useState<{ x: number; y: number; count: number; label?: string } | null>(null)
  const [dropLight, setDropLight] = useState<{ hot: boolean; label?: string } | null>(null)
  const marquee = useRef<SpatialPointerSession>(IDLE_SPATIAL_POINTER)
  const [marqueeRect, setMarqueeRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null)
  const [createMenu, setCreateMenu] = useState<{ from: string; x: number; y: number; screenX: number; screenY: number } | null>(null)
  const toWorld = (clientX: number, clientY: number, rect: DOMRect) => spatialScreenToWorld(clientX, clientY, rect, camera)
  // P0 2026-08-17: there is no persistent client-owned arrange mode.
  // Spatial positions in `nodes` are always the user's current presentation.
  const spatialNodes = useMemo(() => dragPreviewPositions
    ? nodes.map((node) => dragPreviewPositions[node.id] ? { ...node, ...dragPreviewPositions[node.id] } : node)
    : nodes, [dragPreviewPositions, nodes])
  const effectiveWorkspaceFrames = workspaceFrames
  const lod = spatialLodForCount(spatialNodes.length)
  const renderNodes = useMemo(() => {
    if (spatialNodes.length < 48) return spatialNodes
    const viewport = spatialViewportWorldBounds(camera, { width: canvasRef.current?.clientWidth ?? 1440, height: canvasRef.current?.clientHeight ?? 900 }, 320)
    const left = viewport.x
    const top = viewport.y
    const right = viewport.x + viewport.width
    const bottom = viewport.y + viewport.height
    const keep = new Set([...selectedIds, ...(pendingId ? [pendingId] : [])])
    const candidates = spatialNodes.filter((node) => keep.has(node.id) || (node.x < right && node.x + node.width > left && node.y < bottom && node.y + node.height > top))
    if (lod !== 'overview' || candidates.length <= 180) return candidates
    const selected = candidates.filter((node) => keep.has(node.id))
    const rest = candidates.filter((node) => !keep.has(node.id))
    const stride = Math.max(1, Math.ceil(rest.length / Math.max(1, 180 - selected.length)))
    return [...selected, ...rest.filter((_, index) => index % stride === 0)].slice(0, 180)
  }, [spatialNodes, selectedIds, pendingId, camera.x, camera.y, camera.zoom, lod])
  const renderIds = useMemo(() => new Set(renderNodes.map((node) => node.id)), [renderNodes])
  const zoomBandForEdges = camera.zoom < 0.35 ? 'far' as const : camera.zoom < 0.65 ? 'mid' as const : 'near' as const
  const focusEdgeIds = useMemo(() => {
    if (selectedIds.length === 0) return new Set<string>()
    return new Set(edges.filter((edge) => selectedIds.includes(edge.from) || selectedIds.includes(edge.to)).map((edge) => edge.id))
  }, [edges, selectedIds])
  const renderEdges = useMemo(() => {
    const visible = (id: string) => renderIds.has(id) || id.startsWith('workspace:')
    const base = lod === 'full' ? edges : edges.filter((edge) => visible(edge.from) && visible(edge.to))
    // GUI-4 §4 Edge LOD：远视且无选择 → 只保留 active/runtime 边，避免蜘蛛网。
    if (zoomBandForEdges === 'far' && selectedIds.length === 0) {
      return base.filter((edge) => edge.active || edge.scope === 'runtime')
    }
    return base
  }, [edges, lod, renderIds, selectedIds.length, zoomBandForEdges])
  const byId = new Map(spatialNodes.map((node) => [node.id, node]))
  const relationById = new Map(byId)
  workspaceFrames.forEach((frame) => relationById.set(`workspace:${frame.workspaceId}`, {
    id: `workspace:${frame.workspaceId}`, title: frame.label, kind: 'context', x: frame.bounds.x, y: frame.bounds.y, width: frame.bounds.width, height: frame.bounds.height,
  } as CanvasNode))
  const selectedBounds = useMemo(() => selectedIds.length ? getSelectionBounds(spatialNodes, selectedIds) : null, [selectedIds, spatialNodes])
  const selectedVisualBounds = useMemo(() => selectedIds.length ? getVisualSelectionBounds(spatialNodes, selectedIds) : null, [selectedIds, spatialNodes])
  const selectedNodesForTools = useMemo(() => selectedIds.map((id) => byId.get(id)).filter((node): node is CanvasNode => Boolean(node)), [byId, selectedIds])
  const textSelection = selectedNodesForTools.length > 0 && selectedNodesForTools.every((node) => node.kind === 'note' || detectFileIdentity(node) === 'markdown')
  const textSelectionExpanded = textSelection && selectedNodesForTools.some((node) => node.displayMode !== 'compact')
  const selectionBounds = selectedIds.length > 1 ? selectedVisualBounds : null
  const overlayWidth = canvasRef.current?.clientWidth ?? 1440
  const overlayHeight = canvasRef.current?.clientHeight ?? 900
  const selectionToolbarAnchor = selectionBounds ? spatialWorldToScreen({ x: selectionBounds.x, y: selectionBounds.y }, camera) : null
  const selectionComposerAnchor = selectedBounds ? spatialWorldToScreen({ x: selectedBounds.x, y: selectedBounds.y + selectedBounds.height }, camera) : null
  const selectionToolbarPosition = selectionToolbarAnchor ? {
    left: Math.max(12, Math.min(Math.max(12, overlayWidth - 286), selectionToolbarAnchor.x)),
    top: Math.max(12, Math.min(Math.max(12, overlayHeight - 46), selectionToolbarAnchor.y - 40)),
  } : null
  const selectionComposerPosition = selectionComposerAnchor ? {
    left: Math.max(12, Math.min(Math.max(12, overlayWidth - Math.min(430, overlayWidth - 24)), selectionComposerAnchor.x)),
    top: Math.max(12, Math.min(Math.max(12, overlayHeight - 128), selectionComposerAnchor.y + 12)),
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

  const alignSelection = (mode: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom') => {
    if (!selectedVisualBounds || selectedNodesForTools.length < 2) return
    setNodes((current) => current.map((node) => {
      if (!selectedIds.includes(node.id) || node.positionLocked) return node
      const body = nodeVisualBounds(node)
      const inset = nodeVisualInsets(node)
      if (mode === 'left') return { ...node, x: selectedVisualBounds.x + inset.left }
      if (mode === 'center-x') return { ...node, x: selectedVisualBounds.x + (selectedVisualBounds.width - body.width) / 2 + inset.left }
      if (mode === 'right') return { ...node, x: selectedVisualBounds.x + selectedVisualBounds.width - body.width + inset.left }
      if (mode === 'top') return { ...node, y: selectedVisualBounds.y + inset.top }
      if (mode === 'center-y') return { ...node, y: selectedVisualBounds.y + (selectedVisualBounds.height - body.height) / 2 + inset.top }
      return { ...node, y: selectedVisualBounds.y + selectedVisualBounds.height - body.height + inset.top }
    }))
    onPresentationCommit?.('node-move')
  }

  const distributeSelection = (axis: 'x' | 'y') => {
    if (selectedNodesForTools.length < 3) return
    const visual = selectedNodesForTools.map((node) => ({ node, bounds: nodeVisualBounds(node), inset: nodeVisualInsets(node) }))
      .sort((a, b) => axis === 'x' ? a.bounds.x - b.bounds.x : a.bounds.y - b.bounds.y)
    const first = visual[0]
    const last = visual[visual.length - 1]
    if (!first || !last) return
    const inner = visual.slice(1, -1)
    const available = axis === 'x'
      ? (last.bounds.x - (first.bounds.x + first.bounds.width)) - inner.reduce((sum, item) => sum + item.bounds.width, 0)
      : (last.bounds.y - (first.bounds.y + first.bounds.height)) - inner.reduce((sum, item) => sum + item.bounds.height, 0)
    const naturalGap = available / Math.max(1, visual.length - 1)
    const gap = Math.max(18, naturalGap)
    let cursor = axis === 'x' ? first.bounds.x + first.bounds.width + gap : first.bounds.y + first.bounds.height + gap
    const target = new Map<string, number>()
    inner.forEach((item) => {
      target.set(item.node.id, axis === 'x' ? cursor + item.inset.left : cursor + item.inset.top)
      cursor += (axis === 'x' ? item.bounds.width : item.bounds.height) + gap
    })
    // If the original span was too tight, move the last node too. Distribution
    // may expand the selection, but it must never manufacture negative gaps.
    if (naturalGap < 18 && !last.node.positionLocked) target.set(last.node.id, axis === 'x' ? cursor + last.inset.left : cursor + last.inset.top)
    setNodes((current) => current.map((node) => {
      const value = target.get(node.id)
      if (value === undefined || node.positionLocked) return node
      return axis === 'x' ? { ...node, x: value } : { ...node, y: value }
    }))
    onPresentationCommit?.('node-move')
  }

  useEffect(() => () => {
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current)
    if (autoPanFrame.current !== null) cancelAnimationFrame(autoPanFrame.current)
  }, [])
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setCreateMenu(null)
      cancelSemanticDrop()
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
    if (linkPointerId.current !== null && canvasRef.current?.hasPointerCapture(linkPointerId.current)) {
      canvasRef.current.releasePointerCapture(linkPointerId.current)
    }
    linkPointerId.current = null
    dragCandidate.current = null
    resizeCandidate.current = null
    workspaceDrag.current = null
    frameResize.current = null
    dragPoint.current = null
    autoPanPointer.current = null
    dragging.current = false
    marquee.current = endSpatialPointer()
    link.current = null
    edgeReconnect.current = null
    linkTarget.current = null
    linkStart.current = null
    linkMoved.current = false
    lastNodePress.current = null
    doublePressCandidate.current = null
    selectionCollapseCandidate.current = null
    suppressClick.current = null
    setDraggingId(null)
    setDragSignal({ x: 0, y: 0 })
    lastDragPointer.current = null
    setResizingId(null)
    setDraggingWorkspaceId(null)
    setDropGhost(null)
    setDropLight(null)
    clearDirectProjectViewTarget()
    cancelSemanticDrop()
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
      const preview = Object.fromEntries((candidate.group.length > 1 ? candidate.group : [{ id: candidate.id, dx: 0, dy: 0 }])
        .map((member) => [member.id, { x: point.x + member.dx, y: point.y + member.dy }]))
      setDragPreviewPositions(preview)
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
      const cameraDelta = edgeScrollDelta(currentPointer, bounds, EDGE_SCROLL_BAND, EDGE_SCROLL_MAX_PX_PER_FRAME)
      const cameraDeltaX = cameraDelta.x
      const cameraDeltaY = cameraDelta.y
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
  const alignmentGuideFor = (node: CanvasNode, x: number, y: number, excludedIds: readonly string[]) => {
    if (!gridSnapEnabled) return null
    const threshold = 6 / Math.max(.05, camera.zoom)
    const excluded = new Set(excludedIds)
    const ownX = [x, x + node.width / 2, x + node.width]
    const ownY = [y, y + node.height / 2, y + node.height]
    let bestX: { value: number; distance: number } | null = null
    let bestY: { value: number; distance: number } | null = null
    for (const other of nodes) {
      if (excluded.has(other.id)) continue
      for (const value of [other.x, other.x + other.width / 2, other.x + other.width]) {
        const distance = Math.min(...ownX.map((candidate) => Math.abs(candidate - value)))
        if (distance <= threshold && (!bestX || distance < bestX.distance)) bestX = { value, distance }
      }
      for (const value of [other.y, other.y + other.height / 2, other.y + other.height]) {
        const distance = Math.min(...ownY.map((candidate) => Math.abs(candidate - value)))
        if (distance <= threshold && (!bestY || distance < bestY.distance)) bestY = { value, distance }
      }
    }
    return bestX || bestY ? { ...(bestX ? { x: bestX.value } : {}), ...(bestY ? { y: bestY.value } : {}) } : null
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

  const restoreDraggedOriginals = (candidate: DragCandidate | null) => {
    if (!candidate) return
    const originals = new Map(candidate.originals.map((item) => [item.id, item]))
    setNodes((current) => current.map((node) => { const original = originals.get(node.id); return original ? { ...node, x: original.x, y: original.y } : node }))
  }

  const clearDirectProjectViewTarget = () => {
    directProjectViewElement.current?.classList.remove('is-direct-drop-target')
    directProjectViewElement.current = null
    directProjectViewTarget.current = null
  }

  const cancelSemanticDrop = () => {
    semanticDropSession.current = null
    semanticDropMoved.current = false
    setDropGhost(null)
    setDropLight(null)
    clearDirectProjectViewTarget()
    if (contextMenuGuard.current) {
      const guard = contextMenuGuard.current
      contextMenuGuard.current = null
      // Chrome 在 pointerup 后才派发 contextmenu：拖拽期间安装的守卫要活到那次事件，
      // 由守卫自己压制并移除；这里只做兜底延迟移除，避免提前摘除导致菜单复现。
      window.setTimeout(() => window.removeEventListener('contextmenu', guard, true), 300)
    }
  }

  const beginCanvasSemanticDrop = (ids: readonly string[], event: React.PointerEvent<HTMLElement>) => {
    const trigger = semanticDropTriggerFromPointer(event)
    if (!trigger || !onDirectProjectViewDrop || !ids.length) return false
    semanticDropSession.current = { ids: [...ids], pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, trigger, buttonMask: trigger === 'secondary-pointer' ? 2 : 1 }
    semanticDropMoved.current = false
    try { canvasRef.current?.setPointerCapture(event.pointerId) } catch { /* synthetic or browser already owns capture */ }
    event.preventDefault()
    event.stopPropagation()
    if (trigger === 'secondary-pointer' && !contextMenuGuard.current) {
      contextMenuGuard.current = (menuEvent: Event) => menuEvent.preventDefault()
      window.addEventListener('contextmenu', contextMenuGuard.current, true)
    }
    return true
  }

  const projectViewTargetAt = (clientX: number, clientY: number) => {
    const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-project-view-drop-target]') ?? null
    if (!element) return null
    const id = element.dataset.projectViewDropTarget
    if (!id) return null
    return { element, target: { id, label: element.dataset.projectViewDropLabel ?? '目标空间' } }
  }

  const externalProjectViewTargetAt = (clientX: number, clientY: number) => {
    const hit = projectViewTargetAt(clientX, clientY)
    if (!hit || hit.element === canvasRef.current) return null
    return hit
  }

  const setDirectProjectViewHover = (hit: ReturnType<typeof projectViewTargetAt>) => {
    if (!hit) {
      clearDirectProjectViewTarget()
      return
    }
    if (directProjectViewElement.current !== hit.element) {
      directProjectViewElement.current?.classList.remove('is-direct-drop-target')
      hit.element.classList.add('is-direct-drop-target')
      directProjectViewElement.current = hit.element
    }
    directProjectViewTarget.current = hit.target
  }

  const finishPointer = (event: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    if (locked) {
      event.preventDefault()
      event.stopPropagation()
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      return
    }
    if (semanticDropSession.current && event.pointerId === semanticDropSession.current.pointerId) {
      const item = semanticDropSession.current
      const hit = !cancelled && onDirectProjectViewDrop && semanticDropMoved.current ? projectViewTargetAt(event.clientX, event.clientY) : null
      setDirectProjectViewHover(hit ?? null)
      if (hit && onDirectProjectViewDrop) onDirectProjectViewDrop(hit.target.id, item.ids)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      cancelSemanticDrop()
      return
    }
    const directMoveHit = !cancelled && dragging.current && dragCandidate.current && onDirectProjectViewDrop
      ? externalProjectViewTargetAt(event.clientX, event.clientY)
      : null
    if (directMoveHit && dragCandidate.current && onDirectProjectViewDrop) {
      if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current)
      dragFrame.current = null
      const candidate = dragCandidate.current
      restoreDraggedOriginals(candidate)
      setDragPreviewPositions(null)
      onPresentationInteractionChange?.(false)
      onDirectProjectViewDrop(directMoveHit.target.id, candidate.group.map((item) => item.id))
      suppressClick.current = candidate.id
      dragCandidate.current = null
      dragPoint.current = null
      dragging.current = false
      stopAutoPan()
      setDraggingId(null)
      setDragSignal({ x: 0, y: 0 })
      setDropGhost(null)
      setDropLight(null)
      setAlignmentGuide(null)
      clearDirectProjectViewTarget()
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      return
    }
    const wasDragging = dragging.current
    const draggedCandidate = dragCandidate.current
    const draggedId = dragCandidate.current?.id
    const resizedId = resizeCandidate.current?.moved ? resizeCandidate.current.id : undefined
    const draggedWorkspace = workspaceDrag.current?.moved ? workspaceDrag.current.workspaceId : undefined
    const resizedFrame = frameResize.current?.moved ? frameResize.current : undefined
    if (cancelled) {
      if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current)
      dragFrame.current = null
      setDragPreviewPositions(null)
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
        dragCandidate.current = null
      resizeCandidate.current = null
      workspaceDrag.current = null
      frameResize.current = null
      dragPoint.current = null
      dragging.current = false
      marquee.current = endSpatialPointer()
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
      setDraggingId(null)
      setDragSignal({ x: 0, y: 0 })
      lastDragPointer.current = null
      setResizingId(null)
      setDraggingWorkspaceId(null)
      setDropGhost(null)
      setDropLight(null)
      setAlignmentGuide(null)
      clearDirectProjectViewTarget()
      setMarqueeRect(null)
      setLinkPoint(null)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      return
    }
    if (dragFrame.current !== null) {
      cancelAnimationFrame(dragFrame.current)
      dragFrame.current = null
      const point = dragPoint.current
      if (draggedId && point) {
        const group = dragCandidate.current?.group ?? []
        const placements = new Map((group.length > 1 ? group : [{ id: draggedId, dx: 0, dy: 0 }])
          .map((member) => [member.id, { x: point.x + member.dx, y: point.y + member.dy }]))
        setNodes((current) => current.map((node) => {
          const placement = placements.get(node.id)
          return placement ? { ...node, ...placement, positionLocked: true } : node
        }))
        for (const [id, placement] of placements) {
          if (id.startsWith('workspace:')) onWorkspaceProjectionMove?.(id.slice('workspace:'.length), placement.x, placement.y)
        }
      }
      setDragPreviewPositions(null)
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
    else if (wasDragging && draggedId) finishPresentationInteraction('node-move')
    else if (resizeCandidate.current || workspaceDrag.current) onPresentationInteractionChange?.(false)
    setDropGhost(null)
    setDropLight(null)
    setAlignmentGuide(null)
    dragCandidate.current = null
    resizeCandidate.current = null
    workspaceDrag.current = null
    frameResize.current = null
    dragPoint.current = null
    stopAutoPan()
    dragging.current = false
    setDraggingId(null)
    setResizingId(null)
    setDraggingWorkspaceId(null)
    clearDirectProjectViewTarget()
    if (marquee.current.kind === 'marquee') {
      const box = marquee.current
      const rect = event.currentTarget.getBoundingClientRect()
      const left = Math.min(box.start.x, box.current.x), right = Math.max(box.start.x, box.current.x), top = Math.min(box.start.y, box.current.y), bottom = Math.max(box.start.y, box.current.y)
      if (box.moved) {
        const ids = spatialIdsIntersectingScreenRect(nodes, { x: left, y: top, width: right - left, height: bottom - top }, camera, { x: rect.left, y: rect.top })
        onMarqueeSelect(ids, additiveSelection(event))
      }
      marquee.current = endSpatialPointer()
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


  const edgeLayerBounds = useMemo(() => spatialBoundsForPlacements([
    ...spatialNodes.map((node) => ({ x: node.x, y: node.y, width: node.width, height: node.height })),
    ...effectiveWorkspaceFrames.map((frame) => frame.bounds),
    ...(linkPoint ? [{ x: linkPoint.x, y: linkPoint.y, width: 1, height: 1 }] : []),
  ], 520), [linkPoint, spatialNodes, effectiveWorkspaceFrames])

  const spatialOverlays = <>
      {lod !== 'full' && <div className="lod-badge">{nodes.length} 个节点 · {lod === 'overview' ? '总览聚合' : '视区降密度'}</div>}
    {dropGhost && <div className="lcos-drop-ghost" style={{ left: dropGhost.x, top: dropGhost.y }} aria-hidden="true">
      <span className="lcos-drop-ghost-stack"><i /><i /><i /></span>
      <strong>{dropGhost.count}</strong>
      <small>{dropGhost.label ?? '移动'}</small>
    </div>}
    {dropLight && <LightCurtain tone="drop" anchors={['left', 'bottom']} hot={dropLight.hot} label={dropLight.label} count={dropGhost?.count}/>}
    {selectionToolbarPosition && <div data-testid="selection-toolbar" className="selection-toolbar lcos-selection-strip" style={selectionToolbarPosition} onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation() }}>
      {onFocusSelection && <button type="button" className="selection-primary" aria-label="定位其它视图" title="查看这个对象还出现在哪些 Context / Workflow / Collection / Workspace" onClick={(event) => { event.stopPropagation(); onFocusSelection() }}><Crosshair size={15} /><span>在哪</span></button>}
      {onRenameSelection && <button type="button" className="selection-primary" aria-label="重命名 Collection" title="重命名这个 Collection" onClick={(event) => { event.stopPropagation(); onRenameSelection() }}><Pencil size={15}/><span>重命名</span></button>}
      {selectedIds.length > 1 && onCreateRegion && <button type="button" className="selection-primary" aria-label="建立围栏" title="建立 Scene-local Region，不创建长期 Collection" onClick={(event) => { event.stopPropagation(); onCreateRegion() }}><Fence size={15}/><span>围栏</span></button>}
      {selectedIds.length > 1 && <details className="lcos-selection-align" onPointerDown={(event) => event.stopPropagation()}>
        <summary aria-label="对齐与分布" title="客户端几何操作，不调用智能体"><LayoutGrid size={14}/><span>对齐</span></summary>
        <div>
          <button type="button" onClick={() => alignSelection('left')}>左对齐</button><button type="button" onClick={() => alignSelection('center-x')}>水平居中</button><button type="button" onClick={() => alignSelection('right')}>右对齐</button>
          <button type="button" onClick={() => alignSelection('top')}>上对齐</button><button type="button" onClick={() => alignSelection('center-y')}>垂直居中</button><button type="button" onClick={() => alignSelection('bottom')}>下对齐</button>
          {selectedIds.length > 2 && <><button type="button" onClick={() => distributeSelection('x')}>横向均匀</button><button type="button" onClick={() => distributeSelection('y')}>纵向均匀</button></>}
        </div>
      </details>}
      {textSelection && onSetSelectionDisplayMode && <button type="button" className="selection-primary" aria-label={textSelectionExpanded ? '收起文字材料' : '直接阅读文字材料'} title="同一个文字对象只改变呈现，不创建新对象" onClick={(event) => { event.stopPropagation(); onSetSelectionDisplayMode(textSelectionExpanded ? 'compact' : 'standard') }}><span>{textSelectionExpanded ? '收起' : '直接阅读'}</span></button>}
      <button type="button" className="selection-primary lcos-agent-arrange-entry" aria-label="让智能体整理这些" title="按内容关系整理；智能体变化需要审查" onClick={(event) => { event.stopPropagation(); if (onReorganize) onReorganize(); else onArrangeSelection() }}><LayoutGrid size={15} /><span>整理这些</span></button>
      {surfaceMode === 'project' && <details className="lcos-selection-more" onPointerDown={(event) => event.stopPropagation()}>
        <summary aria-label="更多操作" title="更多操作"><Ellipsis size={15}/></summary>
        <div>
          <button type="button" onClick={(event) => { event.stopPropagation(); onCreateScopeFromSelection() }}><FolderTree size={12}/>创建 Collection</button>
          <button type="button" onClick={() => onCopySelection()}><Copy size={12}/>复制</button>
          <button type="button" onClick={() => onDuplicateSelection()}><CopyPlus size={12}/>额外 View</button>
          <button type="button" className="danger" onClick={() => onDeleteSelection()}><Trash2 size={12}/>删除 View</button>
        </div>
      </details>}
    </div>}
    {selectionComposer && selectionComposerPosition && <SelectionComposer
      nodes={nodes}
      selectedIds={selectedIds}
      x={selectionComposerPosition.left}
      y={selectionComposerPosition.top}
      {...selectionComposer}
    />}
    {createMenu && <div data-testid="anchor-create-menu" className="anchor-create-menu" style={{ left: createMenu.screenX, top: createMenu.screenY }} onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation() }}><span>在此创建并连接</span><button data-testid="anchor-create-note" onClick={() => { onCreateNodeFromAnchor('note', createMenu.x, createMenu.y, createMenu.from); setCreateMenu(null) }}>文本</button><button data-testid="anchor-create-context" onClick={() => { onCreateNodeFromAnchor('context', createMenu.x, createMenu.y, createMenu.from); setCreateMenu(null) }}>内容集合</button><button className="cancel" onClick={() => setCreateMenu(null)}>取消</button></div>}
    {marqueeRect && (() => { const rect = canvasRef.current?.getBoundingClientRect(); return <div data-testid="selection-marquee" className="marquee" style={{ left: marqueeRect.left - (rect?.left ?? 0), top: marqueeRect.top - (rect?.top ?? 0), width: marqueeRect.width, height: marqueeRect.height }} /> })()}
  </>

  return <SpatialCanvas ref={canvasRef} testId="canvas" tabIndex={-1} camera={camera} setCamera={setCamera} disabled={locked} ariaBusy={locked} locked={locked} nodeCount={nodes.length} edgeCount={edges.length} className={`canvas lod-${lod} zoom-band-${zoomBand} layout-mode-freeform ${gridSnapEnabled ? 'grid-snap-enabled' : ''} ${selectedId ? 'has-focus' : ''} ${locked ? 'is-locked' : ''}`} worldClassName="canvas-world" worldTestId="canvas-world" style={{ '--canvas-zoom': String(camera.zoom), '--lcos-main-grid-size': `${MAIN_CANVAS_GRID_STEP * camera.zoom}px`, '--lcos-main-grid-x': `${camera.x % (MAIN_CANVAS_GRID_STEP * camera.zoom)}px`, '--lcos-main-grid-y': `${camera.y % (MAIN_CANVAS_GRID_STEP * camera.zoom)}px` } as React.CSSProperties} onPointerDown={({ event }) => {
    const target = event.target as HTMLElement
    // Workspace-level Semantic Drop fallback. Node-level Semantic Drop starts in
    // CanvasCard before ordinary node movement so a primary grab-handle drag cannot
    // accidentally move the source object.
    if (semanticDropTriggerFromPointer(event)) {
      const workspaceTarget = target.closest<HTMLElement>('[data-workspace-frame]')
      if (workspaceTarget?.dataset.workspaceFrame && beginCanvasSemanticDrop([`workspace:${workspaceTarget.dataset.workspaceFrame}`], event)) return
    }
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
      marquee.current = beginSpatialMarquee(event.pointerId, { x: event.clientX, y: event.clientY })
    }
  }} onPointerMove={({ event, rect }) => {
    // 丢失 pointerup 后的安全阀：没有按住主键时不允许任何进行中的拖拽/缩放继续
    // 移动节点（否则一次未完成的按下 + 之后随意移动鼠标会静默拖动节点并写进 graph）。
    if ((dragCandidate.current || resizeCandidate.current || workspaceDrag.current || frameResize.current)
      && ((event.buttons ?? 1) & 1) === 0) {
      finishPointer(event, true)
      return
    }
    if (semanticDropSession.current && event.pointerId === semanticDropSession.current.pointerId) {
      const item = semanticDropSession.current
      if (event.pointerType === 'mouse' && ((event.buttons ?? item.buttonMask) & item.buttonMask) === 0) {
        finishPointer(event, true)
        return
      }
      if (!semanticDropMoved.current && Math.hypot(event.clientX - item.startX, event.clientY - item.startY) > 4) semanticDropMoved.current = true
      if (semanticDropMoved.current) {
        const hit = onDirectProjectViewDrop ? projectViewTargetAt(event.clientX, event.clientY) : null
        setDirectProjectViewHover(hit)
        if (hit) setDropGhost({ x: event.clientX, y: event.clientY, count: item.ids.length, label: `加入 ${hit.target.label}` })
        else setDropGhost({ x: event.clientX, y: event.clientY, count: item.ids.length })
        setDropLight({ hot: Boolean(hit), label: hit ? `加入 ${hit.target.label}` : undefined })
      }
      return
    }
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
    if (marquee.current.kind === 'marquee') {
      const session = marquee.current
      const wasMoved = session.moved
      const next = advanceSpatialMarquee(session, { x: event.clientX, y: event.clientY }, 4)
      marquee.current = next
      if (next.kind === 'marquee' && !wasMoved && next.moved) {
        try { event.currentTarget.setPointerCapture(next.pointerId) } catch { /* pointer may already be released */ }
      }
      const visual = spatialMarqueeRect(next)
      if (visual) setMarqueeRect(visual)
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
        lastDragPointer.current = { x: event.clientX, y: event.clientY }
        setDragSignal({ x: 0, y: 0 })
        linkPointerId.current = event.pointerId
        try { canvasRef.current?.setPointerCapture(event.pointerId) } catch { /* synthetic or already released */ }
      }
      if (dragging.current) {
        const pointer = { x: event.clientX, y: event.clientY }
        autoPanPointer.current = pointer
        const directHit = onDirectProjectViewDrop ? externalProjectViewTargetAt(event.clientX, event.clientY) : null
        setDirectProjectViewHover(directHit)
        if (directHit) {
          stopAutoPan()
          setDropGhost({ x: event.clientX, y: event.clientY, count: candidate.group.length, label: `加入 ${directHit.target.label}` })
          setDropLight({ hot: true, label: `加入 ${directHit.target.label}` })
          setAlignmentGuide(null)
          return
        }
        setDropGhost(null)
        setDropLight(null)
        // Primary drag is free-position movement until it enters an explicit external Surface target.
        scheduleAutoPan(pointer)
        const previousPointer = lastDragPointer.current
        if (previousPointer) {
          const dx = event.clientX - previousPointer.x
          const dy = event.clientY - previousPointer.y
          const length = Math.max(1, Math.hypot(dx, dy))
          setDragSignal({ x: Math.max(-1, Math.min(1, dx / length)), y: Math.max(-1, Math.min(1, dy / length)) })
        }
        lastDragPointer.current = { x: event.clientX, y: event.clientY }
        const point = toWorld(event.clientX, event.clientY, rect)
        const rawPoint = { x: point.x - candidate.offsetX, y: point.y - candidate.offsetY }
        const anchorNode = nodes.find((node) => node.id === candidate.id)
        dragPoint.current = rawPoint
        const nextGuide = anchorNode ? alignmentGuideFor(anchorNode, rawPoint.x, rawPoint.y, candidate.group.map((item) => item.id)) : null
        setAlignmentGuide((current) => current?.x === nextGuide?.x && current?.y === nextGuide?.y ? current : nextGuide)
        scheduleDraggedNode()
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
  }} onPointerUp={({ event }) => finishPointer(event)} onPointerCancel={({ event }) => finishPointer(event, true)} onPointerWorldChange={onPointerWorldChange} onFilesDropped={(files, point) => onFilesDropped(files, point.x, point.y)} onExternalDrop={(kind, id, screen) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    const point = rect ? toWorld(screen.x, screen.y, rect) : { x: 180, y: 160 }
    if (kind === 'material-transfer' && onMaterialTransferDrop) {
      onMaterialTransferDrop(id, point.x, point.y)
      return
    }
    if ((kind === 'uri' || kind === 'text') && onExternalTextDrop) onExternalTextDrop(id, point.x, point.y)
  }} overlays={spatialOverlays}>
    <SpatialNodeLayer className="lcos-arrange-structure-layer">
      {alignmentGuide?.x !== undefined && <i className="lcos-alignment-guide axis-x" style={{ left: alignmentGuide.x }}/>} {/* x guide */}
      {alignmentGuide?.y !== undefined && <i className="lcos-alignment-guide axis-y" style={{ top: alignmentGuide.y }}/>} {/* y guide */}
      {spatialRegions.map((region) => {
        const definition = resolveSurfaceComponent('fence')
        const Renderer = definition.renderer
        const element: SurfaceElement = {
          id: `main-fence:${region.id}`,
          projectId,
          surface: 'main',
          type: 'fence',
          bounds: { x: region.bounds.x, y: region.bounds.y, w: region.bounds.width, h: region.bounds.height },
          presentation: { zIndex: 1 },
        }
        return <SurfaceFrame
          key={region.id}
          element={element}
          definition={definition}
          zoom={camera.zoom}
          selected={selectedRegionId === region.id}
          onSelect={() => setSelectedRegionId(region.id)}
          onBoundsCommit={(bounds) => {
            const next = { x: bounds.x, y: bounds.y, width: bounds.w, height: bounds.h }
            onRegionBoundsChange?.(region.id, next)
            onRegionBoundsCommit?.(region.id, next)
          }}
          onPresentationChange={() => undefined}
          onRemove={() => onClearRegion?.(region.id)}
          showPin={false}
        >
          <Renderer element={element} selected={selectedRegionId === region.id} meta={`${region.memberViewIds.length} 项 · Presentation-only`}/>
          <button type="button" className="lcos-main-fence-promote" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onPromoteRegionToCollection?.(region.id) }}>转 Collection</button>
        </SurfaceFrame>
      })}
      {effectiveWorkspaceFrames.map((frame) => <div key={frame.workspaceId} data-testid={`workspace-frame-${frame.workspaceId}`} data-workspace-frame={frame.workspaceId} data-member-count={frame.memberViewIds.length} className={`workspace-frame ${frame.active ? 'active' : ''} ${draggingWorkspaceId === frame.workspaceId ? 'dragging' : ''}`} style={{ left: frame.bounds.x, top: frame.bounds.y, width: frame.bounds.width, height: frame.bounds.height }}>
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
        {surfaceMode === 'project' && <><button data-testid={`workspace-relation-in-${frame.workspaceId}`} data-relation-target={`workspace:${frame.workspaceId}`} className="workspace-relation-handle workspace-relation-in" type="button" aria-label={`连接到 Workspace ${frame.label}`} onPointerDown={(event) => event.stopPropagation()} />
        <button data-testid={`workspace-relation-out-${frame.workspaceId}`} data-relation-target={`workspace:${frame.workspaceId}`} className="workspace-relation-handle workspace-relation-out" type="button" aria-label={`从 Workspace ${frame.label} 建立关系`} onPointerDown={(event) => beginRelation(`workspace:${frame.workspaceId}`, event, { x: frame.bounds.x + frame.bounds.width, y: frame.bounds.y + frame.bounds.height / 2 })} /></>}
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
      {layoutPreview?.map((item) => { const node = byId.get(item.id); return node ? <div key={item.id} className="layout-ghost" style={{ left: item.x, top: item.y, width: node.width, height: node.height }}><span>{node.title}</span></div> : null })}
    </SpatialNodeLayer>
    <SpatialEdgeLayer bounds={edgeLayerBounds} className="edges" ariaLabel="可编辑关系">
        {renderEdges.map((edge) => <EdgePath key={edge.id} edge={edge} from={relationById.get(edge.from)} to={relationById.get(edge.to)} selected={selectedEdgeId === edge.id} focused={Boolean(selectedId && (edge.from === selectedId || edge.to === selectedId))} dimmed={selectedIds.length > 0 && !focusEdgeIds.has(edge.id) && !edge.active} onSelect={onSelectEdge} onCut={(edgeId) => { setEdges((current) => current.filter((item) => item.id !== edgeId)); onSelectEdge(null) }} onReconnectStart={(endpoint, event) => beginEdgeReconnect(edge, endpoint, event)} />)}
        {link.current && linkPoint && relationById.get(link.current.from) && <TemporaryEdge from={relationById.get(link.current.from)!} to={linkPoint} />}
        {edgeReconnect.current && linkPoint && relationById.get(edgeReconnect.current.fixedId) && <ReconnectTemporaryEdge fixed={relationById.get(edgeReconnect.current.fixedId)!} moving={linkPoint} endpoint={edgeReconnect.current.endpoint} />}
    </SpatialEdgeLayer>
    <SpatialNodeLayer className="lcos-arrange-node-layer">
      {selectionBounds && <div data-testid="selection-bounds" className="selection-bounds" style={{ left: selectionBounds.x - 10, top: selectionBounds.y - 10, width: selectionBounds.width + 20, height: selectionBounds.height + 20 }} />}
      {renderNodes.map((node) => {
        const collectionScopeId = node.entityKind === 'collection' ? (node.opensScopeId ?? (node.id.startsWith('scope:') ? node.id.slice('scope:'.length) : null)) : null
        return <CanvasCard key={node.id} node={node} density={nodeDensity(node, lod)} zoom={camera.zoom} showDetails={camera.zoom > .2 && lod !== 'overview'} performanceProxy={lod === 'overview' && !selectedIds.includes(node.id) && pendingId !== node.id} runId={runId} runStatus={runStatus} selected={selectedIds.includes(node.id)} multiSelected={selectedIds.length > 1 && selectedIds.includes(node.id)} pending={pendingId === node.id} reviewPending={pendingReviewIds.includes(node.id)} dragging={draggingId === node.id} dragSignal={draggingId === node.id ? dragSignal : undefined} resizing={resizingId === node.id} workspaceMember={Boolean(activeWorkspaceId && workspaceFrames.find((frame) => frame.workspaceId === activeWorkspaceId)?.memberViewIds.includes(node.id))} locatePulse={locatePulseId === node.id} attentionBucket={attentionBucketsByViewId[node.id]} collectionExpanded={Boolean(collectionScopeId && expandedCollectionScopeIds.includes(collectionScopeId))} collectionMembers={collectionMembersByNodeId[node.id] ?? (collectionScopeId ? collectionMembersByNodeId[`scope:${collectionScopeId}`] ?? [] : [])} collectionMotion={collectionMotionByNodeId.get(node.id)} onOpenContextLens={onOpenContextLens} onCollectionMemberSelect={onSelect} onLocate={onLocateNode} onDetails={onDetails} onPointerDown={(event) => {
        const semanticIds = selectedIds.includes(node.id) && selectedIds.length > 1 ? selectedIds : [node.id]
        if (beginCanvasSemanticDrop(semanticIds, event)) return
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
        dragCandidate.current = { id: node.id, startX: event.clientX, startY: event.clientY, offsetX: (event.clientX - event.currentTarget.getBoundingClientRect().left) / camera.zoom, offsetY: (event.clientY - event.currentTarget.getBoundingClientRect().top) / camera.zoom, group: groupIds.flatMap((id) => { const member = byId.get(id); return member ? [{ id, dx: member.x - node.x, dy: member.y - node.y }] : [] }), originals: groupIds.flatMap((id) => { const member = byId.get(id); return member ? [{ id, x: member.x, y: member.y }] : [] }) }
      }} onClick={() => {
        if (suppressClick.current === node.id) { suppressClick.current = null; return }
        if (collectionScopeId) onToggleCollection?.(collectionScopeId)
      }} onResizeStart={(event) => {
        if (locked || selectedIds.length !== 1) return
        event.preventDefault(); event.stopPropagation()
        resizeCandidate.current = { id: node.id, startX: event.clientX, startY: event.clientY, width: node.width, height: node.height, moved: false }
        onPresentationInteractionChange?.(true)
        setResizingId(node.id)
        try { canvasRef.current?.setPointerCapture(event.pointerId) } catch { /* browser owns capture */ }
      }} relationsEnabled={surfaceMode === 'project'} onLinkStart={(event) => beginRelation(node.id, event, { x: node.x + node.width, y: node.y + node.height / 2 })} />
      })}
    </SpatialNodeLayer>
  </SpatialCanvas>
})

function EdgePath({ edge, from, to, selected, focused, dimmed, onSelect, onCut, onReconnectStart }: { edge: CanvasEdge; from?: CanvasNode; to?: CanvasNode; selected: boolean; focused: boolean; dimmed: boolean; onSelect: (id: string) => void; onCut: (id: string) => void; onReconnectStart: (endpoint: 'from' | 'to', event: React.PointerEvent<SVGCircleElement>) => void }) {
  if (!from || !to) return null
  const x1 = from.x + from.width, y1 = from.y + from.height / 2, x2 = to.x, y2 = to.y + to.height / 2
  const d = `M ${x1} ${y1} C ${x1 + 80} ${y1}, ${x2 - 80} ${y2}, ${x2} ${y2}`
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const select = (event: React.PointerEvent<SVGPathElement>) => { event.stopPropagation(); onSelect(edge.id) }
  return <>
    <path className="edge-hit" data-edge-id={edge.id} d={d} onPointerDown={select} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation() }} />
    <path className={`edge ${edge.kind} ${edge.active ? 'active' : ''} ${edge.scope ? `edge-scope-${edge.scope}` : ''} ${focused ? 'focused' : ''} ${selected ? 'selected' : ''} ${dimmed ? 'dimmed' : ''}`} data-edge-id={edge.id} data-edge-from={edge.from} data-edge-to={edge.to} d={d} onPointerDown={select} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation() }} />
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

function CanvasCard({ node, density, zoom, showDetails, performanceProxy = false, runId, runStatus, selected, multiSelected, pending, reviewPending, dragging, dragSignal, resizing, workspaceMember, locatePulse, attentionBucket, collectionExpanded, collectionMembers, collectionMotion, onCollectionMemberSelect, onLocate, onOpenContextLens, onDetails, onPointerDown, onClick, onResizeStart, relationsEnabled, onLinkStart }: {
  node: CanvasNode; density: NodeDisplayMode; zoom: number; showDetails: boolean; performanceProxy?: boolean; runId: string; runStatus: RunStatus | null; selected: boolean; multiSelected: boolean; pending: boolean; reviewPending: boolean; dragging: boolean; dragSignal?: { x: number; y: number }; resizing: boolean; workspaceMember: boolean; locatePulse: boolean; attentionBucket?: AttentionBucketV0; collectionExpanded: boolean; collectionMembers: readonly CanvasNode[]
  collectionMotion?: { phase: 'opening' | 'closing'; dx: number; dy: number }
  onCollectionMemberSelect: (id: string, additive?: boolean) => void; onLocate?: (id: string) => void; onOpenContextLens?: (node: CanvasNode, lens: 'space' | 'structure' | 'evolution') => void; onDetails: (id: string) => void; onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void; onClick: (additive?: boolean) => void; onResizeStart: (event: React.PointerEvent<HTMLButtonElement>) => void; relationsEnabled: boolean; onLinkStart: (event: React.PointerEvent<HTMLButtonElement>) => void
}) {
  const visualFamily = nodeVisualFamily(node)
  const revisionStack = (node.revisionCount ?? 0) > 1
  const signalState: LcosSignalState = node.error || node.runtimeState === 'failed'
    ? 'failed'
    : reviewPending || pending || node.draft
      ? 'pending'
      : locatePulse
        ? 'focus'
        : node.runStatus === 'running' || (node.sourceRunId && runStatus === 'running')
          ? 'working'
          : 'stable'
  return <div data-node-id={node.id} data-node-kind={node.kind} data-entity-kind={node.entityKind} data-node-visual-family={visualFamily} data-node-current={node.current || undefined} data-node-draft={node.draft || undefined} data-node-historical={node.historical || undefined} data-revision-count={node.revisionCount} data-result-group={node.resultGroupId} data-node-runtime={node.runtimeState} data-run-status={node.runStatus} data-artifact-id={node.artifactId} data-revision-id={node.revisionId} data-file-record-id={node.fileRecordId} data-current-revision={node.followsCurrentRevision || undefined} data-preview-status={node.previewStatus} data-view-of={node.viewOf} data-scope-id={node.scopeId} data-position-locked={node.positionLocked || undefined} data-context-only={node.contextOnly || undefined} data-attention-bucket={attentionBucket} data-collection-motion={collectionMotion?.phase} data-testid={`canvas-node-${node.id}`} role="button" tabIndex={0} aria-disabled={node.disabled || undefined} className={`canvas-node node-family-${node.kind} visual-family-${visualFamily} density-${density} ${node.kind} ${revisionStack ? 'revision-stack' : ''} ${selected ? 'selected' : ''} ${multiSelected ? 'multi-selected' : ''} ${pending ? 'pending' : ''} ${reviewPending ? 'review-pending' : ''} ${dragging ? 'dragging' : ''} ${resizing ? 'resizing' : ''} ${workspaceMember ? 'workspace-active-member' : ''} ${locatePulse ? 'locate-pulse' : ''} ${attentionBucket ? `attention-${attentionBucket}` : ''} ${collectionMotion ? `collection-${collectionMotion.phase}` : ''} ${node.error ? 'error' : ''} ${node.disabled ? 'disabled' : ''} ${node.positionLocked ? 'position-locked' : ''}`} style={{ left: node.x, top: node.y, width: node.width, height: node.height, '--node-ui-scale': String(1 / Math.max(.2, zoom)), '--canvas-zoom': String(zoom), '--lcos-drag-x': String(dragSignal?.x ?? 0), '--lcos-drag-y': String(dragSignal?.y ?? 0), '--lcos-collection-fold-x': `${collectionMotion?.dx ?? 0}px`, '--lcos-collection-fold-y': `${collectionMotion?.dy ?? 0}px` } as React.CSSProperties} onDragStart={(event) => event.preventDefault()} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation() }} onPointerDown={(event) => { if (!node.disabled) onPointerDown(event) }} onClick={(event) => { event.stopPropagation(); if (!node.disabled) onClick(additiveSelection(event)) }}>
    <span className="lcos-semantic-drop-handle" data-semantic-drop-handle aria-hidden="true" onClick={(event)=>event.stopPropagation()} title="Semantic Drop：拖到上下文或工作流（右键拖 / Alt+左拖）"><GripVertical size={11}/></span>
    {relationsEnabled && <><button data-testid={`anchor-in-${node.id}`} className="anchor anchor-in" aria-label={`连接到 ${node.title}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} />
    <button data-testid={`anchor-out-${node.id}`} className="anchor anchor-out" aria-label={`从 ${node.title} 建立连接`} onPointerDown={onLinkStart} onClick={(event) => event.stopPropagation()} /></>}
    {selected && !multiSelected && <button data-testid={`resize-${node.id}`} className="resize-handle" aria-label={`调整 ${node.title} 大小`} title="拖动调整卡片大小" onPointerDown={onResizeStart} onClick={(event) => event.stopPropagation()} />}
    {performanceProxy
      ? <div className={`lcos-overview-node-proxy proxy-${detectFileIdentity(node)}`} aria-label={displayNodeTitle(node)}><span>{detectFileIdentity(node).toUpperCase()}</span><strong>{displayNodeTitle(node)}</strong></div>
      : <CanvasNodeVisual node={node} density={density} runId={runId} runStatus={runStatus} pending={pending} showDetails={showDetails} onDetails={() => onDetails(node.id)} onLocate={onLocate ? (target) => onLocate(target.id) : undefined} collectionExpanded={collectionExpanded} collectionMembers={collectionMembers} onCollectionMemberSelect={onCollectionMemberSelect} selected={selected} onOpenContextLens={onOpenContextLens} />}
    <span className="lcos-node-system-signal" aria-hidden="true"><LcosSignalGlyph state={signalState}/></span>
  </div>
}
