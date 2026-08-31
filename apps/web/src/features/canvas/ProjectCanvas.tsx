import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { AttentionBucketV0, ConnectedConversationV1, RuntimeProviderStatus } from '@local-creative-os/contracts'
import { CheckCircle2, Copy, CopyPlus, Crosshair, FolderTree, GitBranch, GripVertical, LayoutGrid, LassoSelect, MapPin, MessageSquare, Radio, RotateCcw, Trash2, X } from 'lucide-react'
import type { Camera, CanvasEdge, CanvasNode, NodeDisplayMode, RunStatus, WorkspaceFrameVM } from '../../model'
import { getSelectionBounds, nodeDensity } from './canvasGeometry'
import { getVisualSelectionBounds, MAIN_CANVAS_GRID_STEP, nodeVisualBounds, nodeVisualInsets } from './canvasVisualGeometry'
import { getPendingZoneBounds } from './canvasLayout'
import type { LayoutPreviewItem } from './scopeLayout'
import { colonyBounds, colonyPathData, pointInPolygon, type SpatialColonyDraft } from '../../state/spatialColony'
import { CanvasNodeVisual, detectFileIdentity, displayNodeTitle, nodeVisualFamily } from './CanvasNodeVisual'
import { UnifiedExecutionComposer } from '../execution/UnifiedExecutionComposer'
import type { ArtifactRevisionProvenance } from '../../runtime/projectionAdapters'
import { SpatialCanvas } from '../spatial/SpatialCanvas'
import { SpatialEdgeLayer } from '../spatial/SpatialEdgeLayer'
import { SpatialNodeLayer } from '../spatial/SpatialNodeLayer'
import { SpatialBeaconLayer } from '../spatial/SpatialBeaconLayer'
import { miniMapVisualKindForNode } from '../spatial/minimapSemantics'
import { useSpatialFocusRequest, type SpatialFocusRequest } from '../spatial/useSpatialFocusRequest'
import { edgeScrollDelta, spatialBoundsForPlacements, spatialScreenToWorld, spatialWorldToScreen } from '../spatial/spatialCamera'
import { spatialIdsIntersectingScreenRect } from '../spatial/spatialHitTest'
import { spatialLodForCount, spatialOverviewProjection } from '../spatial/spatialLod'
import { clusterExtremeFarGlyths, glythSemanticLodForZoom, isCriticalGlyth } from '../spatial/glythSemanticLod'
import { useProjectSpatialMarkersOrNull } from '../spatial/ProjectSpatialMarkerContext'
import { markerForNavigationTarget, semanticNavigationRegionOverviews } from '../spatial/spatialNavigationFamily'
import { additiveSelectionModifier, conversationGlythDropTarget, conversationSessionFromDropTarget, referencePickModifier } from '../spatial/pointerInteractionLanguage'
import type { SpatialMarkerItem } from '../spatial/spatialMarkerSystem'
import { advanceSpatialMarquee, beginSpatialMarquee, endSpatialPointer, spatialMarqueeRect } from '../spatial/spatialInteractionMachine'
import { IDLE_SPATIAL_POINTER, type SpatialPointerSession } from '../spatial/spatialTypes'
import { LightCurtain } from '../drop/LightCurtain'
import { semanticDropTriggerFromPointer, type SemanticDropTrigger } from '../spatial/semanticDrop'
import { LCOS_MINDMAP_BRANCH_EXTRACT_EVENT } from './MindMapNoteVisual'
import { LcosSignalGlyph } from '../design/DotGlyph'
import { resolveSpatialSignal, type SpatialRuntimeSignal } from '../spatial/visual/spatialSignal'
import type { SurfaceElement } from '../spatial/model/surfaceElementTypes'
import { SurfaceComponentLayer } from '../spatial/components/SurfaceComponentLayer'
import { SurfaceComponentShelf } from '../spatial/components/SurfaceComponentShelf'
import { surfaceViewportOrigin } from '../spatial/model/surfaceGeometry'
import { AgentSurfaceComposer } from '../surfaces/AgentSurfaceComposer'
import { SurfaceComponentProposalLayer } from '../spatial/components/SurfaceComponentProposalLayer'
import { applySurfaceOps, type SurfaceOp, validateSurfaceOps } from '../spatial/model/surfaceOps'
import { resolveSurfaceIntent, type SurfaceIntent } from '../spatial/model/surfaceIntent'
import { ObjectOrbit } from '../ui/ObjectOrbit'
import { ProjectObjectOrbit } from '../ui/ProjectObjectOrbit'
import { SelectionGroupActions, type SelectionGroupAction } from '../ui/SelectionGroupActions'
import { collectSpatialOverlayOccupiedRects } from '../ui/spatialOverlayEnvironment'
import { BirthProvenanceBadge } from '../provenance/BirthProvenanceBadge'
import { projectMaterialRelationTargetAt, relationTargetWithinScreenHaloAt } from '../spatial/projectMaterialRelationGesture'

interface Props {
  projectId?: string
  surfaceMode?: 'project' | 'capture'
  nodes: CanvasNode[]; setNodes: (nodes: CanvasNode[] | ((current: CanvasNode[]) => CanvasNode[])) => void
  edges: CanvasEdge[]; setEdges: (edges: CanvasEdge[] | ((current: CanvasEdge[]) => CanvasEdge[])) => void
  camera: Camera; setCamera: (camera: Camera | ((current: Camera) => Camera)) => void
  selectedId: string | null; selectedIds: string[]; selectedEdgeId: string | null; setSelectedEdgeId: (id: string | null) => void; pendingId: string | null; runId: string; runStatus: RunStatus | null; spaceHeld: boolean; locked?: boolean
  onSelect: (id: string, additive?: boolean) => void; onClearSelection: () => void; onMarqueeSelect: (ids: string[], additive: boolean) => void; onSelectEdge: (id: string | null) => void; onDoubleClick: (id: string) => void; onDetails: (id: string) => void; onFocusSelection?: () => void; onRenameSelection?: () => void
  /** A22: stable single-click on a content-like Project Object may reveal the local Compact Composer without stealing focus. */
  onRequestSelectionComposer?: (id: string) => void
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
    referenceIds: string[]
    receivers: readonly ConnectedConversationV1[]
    activeReceiverId: string | null
    receiverId: string | null
    reachCount?: number
    referencePickActive?: boolean
    executionBlockedReason?: string
    resultSlot?: { readonly id: string; readonly status: 'empty' | 'running' | 'review' | 'materialized'; readonly title: string }
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
    onReceiverChange: (connectedConversationId: string) => void
    onRemoveReference: (id: string) => void
    onMoveReference: (id: string, delta: -1 | 1) => void
    onStartReferencePick: () => void
    onFinishReferencePick: () => void
    onSend: () => void
    onClose: () => void
  }
  referencePick?: { readonly active: boolean; readonly ids: readonly string[]; readonly onToggle: (id: string) => void }
  onCreateNodeFromAnchor: (kind: 'note' | 'context', x: number, y: number, from: string) => void; onFilesDropped: (files: File[], x: number, y: number) => void; onExternalTextDrop?: (text: string, x: number, y: number) => void; onMaterialTransferDrop?: (raw: string, x: number, y: number) => void
  /** G-4 导图分支摘取：按住导图分支拖到空白处松手 → 以正常文本节点形态落画布（区别于外部文本拖入）。 */
  onMindmapBranchDrop?: (text: string, x: number, y: number) => void
  onArrangeSelection: () => void; gridSnapEnabled?: boolean; onSetSelectionDisplayMode?: (mode: NodeDisplayMode) => void; onCopySelection: () => void; onDuplicateSelection: () => void; onCreateScopeFromSelection: () => void; onDeleteSelection: () => void; onPointerWorldChange: (point: { x: number; y: number }) => void; onSpaceCreate: (point: { x: number; y: number }) => void
  onReorganize?: () => void
  /** 文本节点：切换 文本块 ⇄ 大纲思维导图 呈现（仅 Presentation）。 */
  onToggleNoteLayout?: (id: string, layout: 'text' | 'mindmap') => void
  onDirectProjectViewDrop?: (targetViewId: string, ids: readonly string[]) => void
  /** R2-D: explicit body-drop onto a Glyth creates canonical Conversation Context Mapping via host/Core. */
  onMapToConversation?: (conversationSessionId: string, ids: readonly string[]) => void
  /** GUI-6：锚定备注定位（宿主把相机移到锚点目标并脉冲高亮）。 */
  onLocateNode?: (id: string) => void
  /** Universal Object Orbit: project-level Focus/在哪 for an ordinary object. */
  onFocusNode?: (id: string) => void
  focusRequest?: SpatialFocusRequest
  onLocateConversationSource?: (conversationViewId: string) => void
  locatePulseId?: string | null
  /** Conversation navigation: both double-click and Orbit Enter converge on the same project subcanvas. */
  onOpenConversation?: (conversationId: string) => void
  onSetActiveConversation?: (conversationId: string) => void
  activeConversationId?: string | null
  pendingReviewIds?: readonly string[]
  attentionBucketsByViewId?: Readonly<Record<string, AttentionBucketV0>>
  collectionMembersByNodeId?: Readonly<Record<string, readonly CanvasNode[]>>
  expandedCollectionScopeIds?: readonly string[]
  openingCollectionScopeIds?: readonly string[]
  closingCollectionScopeIds?: readonly string[]
  onToggleCollection?: (collectionScopeId: string) => void
  onOpenContextLens?: (node: CanvasNode, lens: 'space' | 'structure' | 'evolution') => void
  colonies?: readonly SpatialColonyDraft[]
  surfaceElements?: readonly SurfaceElement[]
  onSurfaceElementsChange?: (elements: SurfaceElement[]) => void
  portalTargets?: readonly { readonly id: string; readonly label: string; readonly kind: string }[]
  onOpenPortalTarget?: (projectViewId: string) => void
  onCreateColonyFromSelection?: () => void
  onCreateColonyFromLasso?: (memberIds: readonly string[], points: readonly { x: number; y: number }[]) => void
  onAddToColony?: (colonyId: string, memberIds: readonly string[], placements?: Readonly<Record<string, { x: number; y: number }>>) => void
  onRescopeColony?: (colonyId: string, points: readonly { x: number; y: number }[]) => void
  onDissolveColony?: (colonyId: string) => void
  onColonyMemberMoveSettled?: (memberIds: readonly string[], placements: Readonly<Record<string, { x: number; y: number }>>) => void
}

type DragCandidate = { id: string; startX: number; startY: number; offsetX: number; offsetY: number; group: Array<{ id: string; dx: number; dy: number }>; originals: Array<{ id: string; x: number; y: number }> }
type ResizeCandidate = { id: string; startX: number; startY: number; width: number; height: number; moved: boolean }
type WorkspaceDragCandidate = { workspaceId: string; startX: number; startY: number; members: Array<{ id: string; x: number; y: number }>; moved: boolean; frameBounds?: { x: number; y: number; width: number; height: number }; currentBounds?: { x: number; y: number; width: number; height: number } }
type FrameResizeCandidate = { workspaceId: string; startX: number; startY: number; originalBounds: { x: number; y: number; width: number; height: number }; bounds: { x: number; y: number; width: number; height: number }; moved: boolean }
type EdgeReconnectCandidate = { edgeId: string; endpoint: 'from' | 'to'; fixedId: string }
const EDGE_SCROLL_BAND = 96
const EDGE_SCROLL_MAX_PX_PER_FRAME = 18

function additiveSelection(event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): boolean {
  return additiveSelectionModifier(event)
}


export function projectNodeSupportsInlineComposer(node: CanvasNode): boolean {
  if (node.entityKind === 'conversation') return true
  if (node.entityKind === 'collection' || node.entityKind === 'context' || node.entityKind === 'workflow') return false
  if (node.id.startsWith('workspace:') || node.id.startsWith('scope:')) return false
  return Boolean(node.artifactId || node.kind === 'note' || node.fileType || node.previewText)
}

export const ProjectCanvas = memo(function ProjectCanvas({ projectId = 'capture-space', surfaceMode = 'project', nodes, setNodes, edges, setEdges, camera, setCamera, selectedId, selectedIds, selectedEdgeId, setSelectedEdgeId, pendingId, runId, runStatus, spaceHeld, locked = false, layoutPreview, workspaceFrames = [], workspaceMemberNodes = nodes, activeWorkspaceId = null, onWorkspaceActivate, onWorkspaceProjectionMove, onPresentationInteractionChange, onPresentationCommit, onFrameBoundsChange, selectionComposer, referencePick, onSelect, onClearSelection, onMarqueeSelect, onSelectEdge, onDoubleClick, onDetails, onFocusSelection, onRequestSelectionComposer, onFocusNode, onCreateNodeFromAnchor, onFilesDropped, onExternalTextDrop, onMaterialTransferDrop, onMindmapBranchDrop, onArrangeSelection, gridSnapEnabled = true, onSetSelectionDisplayMode, onCopySelection, onDuplicateSelection, onCreateScopeFromSelection, onDeleteSelection, onReorganize, onDirectProjectViewDrop, onMapToConversation, onPointerWorldChange, onSpaceCreate, onLocateNode, focusRequest, onLocateConversationSource, locatePulseId, onOpenConversation, onSetActiveConversation, activeConversationId = null, pendingReviewIds = [], attentionBucketsByViewId = {}, collectionMembersByNodeId = {}, expandedCollectionScopeIds = [], openingCollectionScopeIds = [], closingCollectionScopeIds = [], onToggleCollection, onOpenContextLens, colonies = [], surfaceElements = [], onSurfaceElementsChange, portalTargets = [], onOpenPortalTarget, onCreateColonyFromSelection, onCreateColonyFromLasso, onAddToColony, onRescopeColony, onDissolveColony, onColonyMemberMoveSettled }: Props) {
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
  const [relationTargetId, setRelationTargetId] = useState<string | null>(null)
  // A12: Relation intent is explicit. Ordinary objects no longer expose a permanent/hover-only
  // launch notch; Orbit -> Relation owns the source, then this state reveals the source port.
  const [relationSourceId, setRelationSourceId] = useState<string | null>(null)
  const [referenceModifierHeld, setReferenceModifierHeld] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [alignmentGuide, setAlignmentGuide] = useState<{ readonly x?: number; readonly y?: number } | null>(null)
  const [dragSignal, setDragSignal] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const syncReferenceModifier = (event: KeyboardEvent) => setReferenceModifierHeld(referencePickModifier(event))
    const clearReferenceModifier = () => setReferenceModifierHeld(false)
    window.addEventListener('keydown', syncReferenceModifier, true)
    window.addEventListener('keyup', syncReferenceModifier, true)
    window.addEventListener('blur', clearReferenceModifier)
    return () => {
      window.removeEventListener('keydown', syncReferenceModifier, true)
      window.removeEventListener('keyup', syncReferenceModifier, true)
      window.removeEventListener('blur', clearReferenceModifier)
    }
  }, [])

  const referencePickIntent = Boolean(referencePick && (referencePick.active || referenceModifierHeld))

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
  const [selectedColonyId, setSelectedColonyId] = useState<string | null>(null)
  const [colonyLassoMode, setColonyLassoMode] = useState<{ readonly kind: 'create' | 'rescope'; readonly colonyId?: string } | null>(null)
  const colonyLassoSession = useRef<{ pointerId: number; points: Array<{ x: number; y: number }> } | null>(null)
  const [colonyLassoPoints, setColonyLassoPoints] = useState<readonly { x: number; y: number }[]>([])
  const [colonyCandidateIds, setColonyCandidateIds] = useState<readonly string[]>([])
  const [componentProposalOps, setComponentProposalOps] = useState<readonly SurfaceOp[]>([])
  const [createMenu, setCreateMenu] = useState<{ from: string; x: number; y: number; screenX: number; screenY: number } | null>(null)
  // C-3 Glyth Orbit（Grammar §11 单击 = Select + Orbit 并存）：只对 single active 的
  // conversation 实体出现。anchor 存被点对象 DOM；conversationId 是 canonical ConversationSession id。
  // 物理对象 id 始终是 Core conversationViewId，不再派生第二套会话节点。
  const [conversationOrbit, setConversationOrbit] = useState<{ anchor: Element; nodeId: string; conversationId: string; title: string } | null>(null)
  // A09: ordinary Project objects now share the same ObjectOrbit behavior shell.
  // This state is Presentation-only; the Project object remains canonical truth.
  const [projectObjectOrbit, setProjectObjectOrbit] = useState<{ anchor: Element; nodeId: string } | null>(null)
  // A14: Workspace is a recoverable working-set projection, not an ordinary CanvasCard,
  // but its explicit Relation source still follows the same local Orbit intent grammar.
  // This is Presentation-only and does not invent a second Workspace selection truth.
  const [workspaceOrbit, setWorkspaceOrbit] = useState<{ anchor: Element; workspaceId: string; label: string } | null>(null)
  const suppressWorkspaceOrbitClick = useRef<string | null>(null)
  const conversationOrbitAnchor = conversationOrbit?.anchor ?? null
  const projectObjectOrbitAnchor = projectObjectOrbit?.anchor ?? null
  const workspaceOrbitAnchor = workspaceOrbit?.anchor ?? null
  // Orbit owns a stable anchor ref object. Recreating `{ current: anchor }` inline on every
  // ProjectCanvas render reattaches ObjectOrbit's outside-pointer listener even when the
  // actual anchor element has not changed.
  const conversationOrbitAnchorRef = useMemo(() => ({ current: conversationOrbitAnchor }), [conversationOrbitAnchor])
  const projectObjectOrbitAnchorRef = useMemo(() => ({ current: projectObjectOrbitAnchor }), [projectObjectOrbitAnchor])
  const workspaceOrbitAnchorRef = useMemo(() => ({ current: workspaceOrbitAnchor }), [workspaceOrbitAnchor])
  const projectObjectOrbitNode = useMemo(() => projectObjectOrbit === null ? null : nodes.find((node) => node.id === projectObjectOrbit.nodeId) ?? null, [nodes, projectObjectOrbit])
  const markerRuntime = useProjectSpatialMarkersOrNull()
  const clearColonyLasso = () => {
    const active = colonyLassoSession.current
    if (active && canvasRef.current?.hasPointerCapture(active.pointerId)) {
      try { canvasRef.current.releasePointerCapture(active.pointerId) } catch { /* pointer already released */ }
    }
    colonyLassoSession.current = null
    setColonyLassoPoints([])
    setColonyCandidateIds([])
    setColonyLassoMode(null)
  }
  useEffect(() => {
    if (!colonyLassoMode) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') clearColonyLasso() }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [colonyLassoMode])
  const localNavigationNonce = useRef(1_000_000)
  const [localNavigationRequest, setLocalNavigationRequest] = useState<SpatialFocusRequest | undefined>()
  // §13「只对 single active object 出现」：换选/清选/框选后当前对象不再是唯一 Selection 即收起。
  // （空白点击与 Esc / outside click 由 ObjectOrbit 行为层统一收口，不在此重复）。
  useEffect(() => {
    if (conversationOrbit !== null && (selectedIds.length !== 1 || selectedIds[0] !== conversationOrbit.nodeId)) setConversationOrbit(null)
    if (projectObjectOrbit !== null && (selectedIds.length !== 1 || selectedIds[0] !== projectObjectOrbit.nodeId)) setProjectObjectOrbit(null)
  }, [conversationOrbit, projectObjectOrbit, selectedIds])
  // A22: Compact Composer and the selected object's Action Arc may coexist.
  // Selection changes still retire stale object-local actions through the effect above;
  // Composer is no longer allowed to erase the direct-action layer merely by opening.
  const toWorld = (clientX: number, clientY: number, rect: DOMRect) => spatialScreenToWorld(clientX, clientY, rect, camera)
  const colonyCandidatesForPoints = (points: readonly { x: number; y: number }[]) => points.length < 3 ? [] : nodes
    .filter((node) => pointInPolygon({ x: node.x + node.width / 2, y: node.y + node.height / 2 }, points))
    .map((node) => node.id)
  // P0 2026-08-17: there is no persistent client-owned arrange mode.
  // Spatial positions in `nodes` are always the user's current presentation.
  const spatialNodes = useMemo(() => dragPreviewPositions
    ? nodes.map((node) => dragPreviewPositions[node.id] ? { ...node, ...dragPreviewPositions[node.id] } : node)
    : nodes, [dragPreviewPositions, nodes])
  const spatialCanvasItems = useMemo(() => spatialNodes.map((node) => ({ id: node.id, x: node.x, y: node.y, width: node.width, height: node.height, label: node.title, visualKind: miniMapVisualKindForNode(node) })), [spatialNodes])
  useEffect(() => { if (focusRequest) setLocalNavigationRequest(undefined) }, [focusRequest?.nonce, focusRequest?.targetTestId])
  const navigateSpatialIds = (ids: readonly string[]) => {
    if (!ids.length) return
    localNavigationNonce.current += 1
    setLocalNavigationRequest({ nonce: localNavigationNonce.current, ids: [...new Set(ids)], targetTestId: 'canvas' })
  }
  const effectiveFocusRequest = localNavigationRequest ?? focusRequest
  const mainFocus = useSpatialFocusRequest({
    request: effectiveFocusRequest,
    items: spatialCanvasItems,
    testId: 'canvas',
    camera,
    setCamera,
    padding: 92,
  })
  const effectiveWorkspaceFrames = workspaceFrames
  const workspaceOrbitFrame = workspaceOrbit === null ? null : effectiveWorkspaceFrames.find((frame) => frame.workspaceId === workspaceOrbit.workspaceId) ?? null
  useEffect(() => { if (workspaceOrbit !== null && workspaceOrbitFrame === null) setWorkspaceOrbit(null) }, [workspaceOrbit, workspaceOrbitFrame])
  const lod = spatialLodForCount(spatialNodes.length)
  const renderNodes = useMemo(() => {
    const keep = new Set([...selectedIds, ...(pendingId ? [pendingId] : [])])
    return spatialOverviewProjection(spatialNodes, camera, keep, {
      width: canvasRef.current?.clientWidth ?? 1440,
      height: canvasRef.current?.clientHeight ?? 900,
    })
  }, [spatialNodes, selectedIds, pendingId, camera])
  const renderIds = useMemo(() => new Set(renderNodes.map((node) => node.id)), [renderNodes])
  const glythLod = glythSemanticLodForZoom(camera.zoom)
  const focusGlythIds = useMemo(() => new Set(
    !effectiveFocusRequest || (effectiveFocusRequest.targetTestId && effectiveFocusRequest.targetTestId !== 'canvas') ? [] : effectiveFocusRequest.ids,
  ), [effectiveFocusRequest])
  const selectedGlythIds = useMemo(() => new Set(selectedIds), [selectedIds])
  const criticalGlythIds = useMemo(() => new Set(renderNodes.filter((node) => isCriticalGlyth(node, { selectedIds: selectedGlythIds, activeConversationId, focusIds: focusGlythIds })).map((node) => node.id)), [activeConversationId, focusGlythIds, renderNodes, selectedGlythIds])
  const extremeFarGlythClusters = useMemo(() => glythLod === 'extreme-far' ? clusterExtremeFarGlyths(renderNodes, camera, criticalGlythIds) : [], [camera, criticalGlythIds, glythLod, renderNodes])
  const clusteredGlythIds = useMemo(() => new Set(extremeFarGlythClusters.flatMap((cluster) => cluster.memberIds)), [extremeFarGlythClusters])
  const semanticRegionSources = useMemo(() => [
    ...colonies.filter((colony) => colony.surface === 'main').map((colony) => ({
      id: `colony:${colony.id}`,
      label: colony.label ?? 'Colony',
      memberViewIds: colony.memberIds,
      bounds: colonyBounds(colony),
    })),
    ...surfaceElements.filter((element) => (element.type === 'fence' || element.type === 'region') && (element.binding?.projectViewIds?.length ?? 0) >= 2).map((element) => ({
      id: `legacy-region:${element.id}`,
      label: '旧空间范围',
      memberViewIds: element.binding!.projectViewIds!,
      bounds: { x: element.bounds.x, y: element.bounds.y, width: element.bounds.w, height: element.bounds.h },
    })),
  ], [colonies, surfaceElements])
  const semanticRegionOverviews = useMemo(() => semanticNavigationRegionOverviews(semanticRegionSources, camera.zoom), [camera.zoom, semanticRegionSources])
  const semanticRegionMarkerItems = useMemo<readonly SpatialMarkerItem[]>(() => semanticRegionOverviews.map((region) => ({
    id: region.markerId,
    label: region.label?.trim() || `${region.memberViewIds.length} 项区域`,
    bounds: region.bounds,
    surface: 'main',
    scope: 'local',
    sourceSurfaceRef: 'main',
    targetSurfaceRef: 'main',
    attention: 'focus',
    groupKey: 'semantic-region-overview',
    groupLabel: '区域',
  })), [semanticRegionOverviews])
  const semanticRegionMembersByMarker = useMemo(() => new Map(semanticRegionOverviews.map((region) => [region.markerId, region.memberViewIds] as const)), [semanticRegionOverviews])
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
  // Multi-selection owns a transient Selection Field action notch. Single-object
  // actions belong to ObjectOrbit/More and must not resurrect the retired strip.
  const selectionBounds = selectedIds.length > 1 ? selectedVisualBounds : null
  const componentSelectionBounds = selectedVisualBounds ? { x: selectedVisualBounds.x, y: selectedVisualBounds.y, w: selectedVisualBounds.width, h: selectedVisualBounds.height } : null
  const componentProposalElements = useMemo(() => componentProposalOps.flatMap((op) => op.type === 'create-component' ? [op.component] : []), [componentProposalOps])
  const previewComponentIntent = (intent: SurfaceIntent) => {
    const ops = resolveSurfaceIntent(intent, { projectId, surface: 'main', existing: surfaceElements, selectionBounds: componentSelectionBounds, viewportOrigin: surfaceViewportOrigin(camera) })
    setComponentProposalOps(validateSurfaceOps(surfaceElements, ops).ok ? ops : [])
  }
  const keepComponentProposal = () => {
    if (!onSurfaceElementsChange || !componentProposalOps.length) return
    onSurfaceElementsChange(applySurfaceOps(surfaceElements, componentProposalOps))
    setComponentProposalOps([])
  }
  const overlayWidth = canvasRef.current?.clientWidth ?? 1440
  const overlayHeight = canvasRef.current?.clientHeight ?? 900
  const canvasScreenRect = canvasRef.current?.getBoundingClientRect() ?? null
  const selectionGroupActionAnchor = selectionBounds ? spatialWorldToScreen({ x: selectionBounds.x, y: selectionBounds.y }, camera) : null
  const selectionComposerAnchor = selectedBounds ? spatialWorldToScreen({ x: selectedBounds.x, y: selectedBounds.y + selectedBounds.height }, camera) : null
  const selectionComposerTargetBounds = selectedVisualBounds && canvasScreenRect ? {
    left: canvasScreenRect.left + camera.x + selectedVisualBounds.x * camera.zoom,
    top: canvasScreenRect.top + camera.y + selectedVisualBounds.y * camera.zoom,
    width: selectedVisualBounds.width * camera.zoom,
    height: selectedVisualBounds.height * camera.zoom,
  } : null
  const selectionComposerSpatialPlacement = selectionComposerTargetBounds && canvasScreenRect ? {
    targetBounds: selectionComposerTargetBounds,
    viewport: { left: canvasScreenRect.left, top: canvasScreenRect.top, width: canvasScreenRect.width, height: canvasScreenRect.height },
    occupiedRects: collectSpatialOverlayOccupiedRects({ left: canvasScreenRect.left, top: canvasScreenRect.top, width: canvasScreenRect.width, height: canvasScreenRect.height }),
    preferredSide: 'below' as const,
    gap: 12,
    margin: 12,
  } : undefined
  const selectionGroupActionPosition = selectionGroupActionAnchor ? {
    left: Math.max(12, Math.min(Math.max(12, overlayWidth - 40), selectionGroupActionAnchor.x)),
    top: Math.max(12, Math.min(Math.max(12, overlayHeight - 40), selectionGroupActionAnchor.y - 38)),
  } : null
  const selectionComposerPosition = selectionComposerAnchor ? {
    left: selectionComposerAnchor.x,
    top: selectionComposerAnchor.y + 12,
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

  const selectionGroupActions: SelectionGroupAction[] = selectedIds.length > 1 ? [
    ...(onFocusSelection ? [{
      id: 'selection-focus',
      label: '在哪',
      hint: '定位这些对象在项目中的其它出现位置',
      icon: Crosshair,
      onClick: onFocusSelection,
    } satisfies SelectionGroupAction] : []),
    {
      id: 'selection-reorganize',
      label: '整理这些',
      hint: '按内容关系整理；智能体变化仍需审查',
      icon: LayoutGrid,
      onClick: () => { if (onReorganize) onReorganize(); else onArrangeSelection() },
    },
    ...(onCreateColonyFromSelection ? [{
      id: 'selection-colony',
      label: '圈成 Colony',
      hint: '把当前 Selection 固定成空间成员关系',
      icon: LassoSelect,
      onClick: onCreateColonyFromSelection,
    } satisfies SelectionGroupAction] : []),
    { id: 'selection-align-left', label: '左对齐', onClick: () => alignSelection('left'), dividerBefore: true },
    { id: 'selection-align-center-x', label: '水平居中', onClick: () => alignSelection('center-x') },
    { id: 'selection-align-right', label: '右对齐', onClick: () => alignSelection('right') },
    { id: 'selection-align-top', label: '上对齐', onClick: () => alignSelection('top') },
    { id: 'selection-align-center-y', label: '垂直居中', onClick: () => alignSelection('center-y') },
    { id: 'selection-align-bottom', label: '下对齐', onClick: () => alignSelection('bottom') },
    ...(selectedIds.length > 2 ? [
      { id: 'selection-distribute-x', label: '横向均匀', onClick: () => distributeSelection('x') } satisfies SelectionGroupAction,
      { id: 'selection-distribute-y', label: '纵向均匀', onClick: () => distributeSelection('y') } satisfies SelectionGroupAction,
    ] : []),
    ...(textSelection && onSetSelectionDisplayMode ? [{
      id: 'selection-reading-mode',
      label: textSelectionExpanded ? '收起文字材料' : '直接阅读文字材料',
      onClick: () => onSetSelectionDisplayMode(textSelectionExpanded ? 'compact' : 'standard'),
      dividerBefore: true,
    } satisfies SelectionGroupAction] : []),
    ...(surfaceMode === 'project' ? [
      { id: 'selection-create-collection', label: '创建 Collection', icon: FolderTree, onClick: onCreateScopeFromSelection, dividerBefore: !textSelection } satisfies SelectionGroupAction,
      { id: 'selection-copy', label: '复制', icon: Copy, onClick: onCopySelection } satisfies SelectionGroupAction,
      { id: 'selection-duplicate-view', label: '额外 View', icon: CopyPlus, onClick: onDuplicateSelection } satisfies SelectionGroupAction,
      { id: 'selection-remove-view', label: '删除 View', icon: Trash2, onClick: onDeleteSelection, danger: true, dividerBefore: true } satisfies SelectionGroupAction,
    ] : []),
  ] : []

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
      linkTarget.current = null
      setRelationTargetId(null)
      setRelationSourceId(null)
      linkStart.current = null
      linkMoved.current = false
      linkPointerId.current = null
      setLinkPoint(null)
    }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [])
  // G-4 导图分支摘取：导图分支拖出到画布空白处松手 → 换算世界坐标 →
  // onMindmapBranchDrop（App 的 createNoteFromBranchText，落成正常文本节点）。
  useEffect(() => {
    const drop = onMindmapBranchDrop ?? onExternalTextDrop
    if (!drop) return
    const onBranchExtract = (event: Event) => {
      const detail = (event as CustomEvent<{ text?: unknown; clientX?: unknown; clientY?: unknown }>).detail
      if (typeof detail?.text !== 'string' || !detail.text.trim()) return
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      if (typeof detail.clientX !== 'number' || typeof detail.clientY !== 'number') return
      // 落点必须在本画布内（防止落在侧栏/头部的松手误建节点）
      if (detail.clientX < rect.left || detail.clientX > rect.right || detail.clientY < rect.top || detail.clientY > rect.bottom) return
      const point = spatialScreenToWorld(detail.clientX, detail.clientY, rect, camera)
      // G-4 落点对齐 ghost：拖拽预览卡片画在光标 +14/+16px 处（MindMapNoteVisual 的
      // ghost transform），落点换算必须计入同一偏移，否则新节点出现在 ghost 左上方
      // 14×16px——用户手测感知的「拖拽有位移」即来源于此。屏幕像素偏移按当前 zoom 换世界坐标。
      const GHOST_OFFSET_X = 14
      const GHOST_OFFSET_Y = 16
      drop(detail.text, point.x + GHOST_OFFSET_X / camera.zoom, point.y + GHOST_OFFSET_Y / camera.zoom)
    }
    window.addEventListener(LCOS_MINDMAP_BRANCH_EXTRACT_EVENT, onBranchExtract)
    return () => window.removeEventListener(LCOS_MINDMAP_BRANCH_EXTRACT_EVENT, onBranchExtract)
  }, [camera, onExternalTextDrop, onMindmapBranchDrop])
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
    setRelationTargetId(null)
    setRelationSourceId(null)
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
    const projectMaterial = projectMaterialRelationTargetAt(clientX, clientY, link.current?.from)
    if (projectMaterial) return projectMaterial
    // Glyth keeps a dedicated Main receptor because its physical id is the
    // Conversation ArtifactView while semantic persistence resolves to artifactId.
    // Require that canonical artifact identity before admitting the receptor.
    const conversation = relationTargetWithinScreenHaloAt(
      clientX, clientY,
      '[data-node-id][data-entity-kind="conversation"][data-conversation-artifact-id]',
      'data-node-id',
      link.current?.from,
    )
    if (conversation) return conversation
    // Workspace keeps its explicit aggregate endpoint semantics after A14.
    return relationTargetWithinScreenHaloAt(clientX, clientY, '[data-relation-target]', 'data-relation-target', link.current?.from)
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
    linkTarget.current = null
    linkStart.current = { x: event.clientX, y: event.clientY }
    linkMoved.current = false
    setLinkPoint(point)
    setRelationTargetId(null)
    setRelationSourceId(from)
    linkPointerId.current = event.pointerId
  }
  const beginRelationIntent = (from: string, point: { x: number; y: number }) => {
    // Latest L0 interaction truth: Select -> Orbit -> Relation -> Orbit yields -> source port wakes.
    // This is a click-owned intent, not a hidden hover affordance. The line immediately follows
    // pointer movement; a target click commits, blank click keeps the create-and-connect path.
    edgeReconnect.current = null
    link.current = { from }
    linkTarget.current = null
    linkStart.current = null
    linkMoved.current = true
    linkPointerId.current = null
    setRelationTargetId(null)
    setRelationSourceId(from)
    setLinkPoint(point)
    setCreateMenu(null)
  }
  const beginEdgeReconnect = (edge: CanvasEdge, endpoint: 'from' | 'to', event: React.PointerEvent<SVGCircleElement>) => {
    event.preventDefault(); event.stopPropagation()
    const fixedId = endpoint === 'from' ? edge.to : edge.from
    const currentEndpoint = relationById.get(endpoint === 'from' ? edge.from : edge.to)
    edgeReconnect.current = { edgeId: edge.id, endpoint, fixedId }
    link.current = null
    linkTarget.current = null
    setRelationTargetId(null)
    setRelationSourceId(null)
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
    if (trigger !== 'secondary-pointer') {
      try { canvasRef.current?.setPointerCapture(event.pointerId) } catch { /* synthetic or browser already owns capture */ }
    }
    // Secondary press is only a Semantic Drop candidate until movement crosses the drag threshold.
    // Keep the browser contextmenu event alive so an ordinary right-click can reach the shared menu owner.
    if (trigger !== 'secondary-pointer') event.preventDefault()
    event.stopPropagation()
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

  const colonyTargetAt = (clientX: number, clientY: number) => {
    const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-colony-id]') ?? null
    const colonyId = element?.dataset.colonyId
    return element && colonyId ? { element, colonyId } : null
  }

  const commitProjectViewTarget = (targetId: string, ids: readonly string[]) => {
    const conversationSessionId = conversationSessionFromDropTarget(targetId)
    if (conversationSessionId) {
      onMapToConversation?.(conversationSessionId, ids)
      return
    }
    onDirectProjectViewDrop?.(targetId, ids)
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
    if (colonyLassoSession.current && colonyLassoSession.current.pointerId === event.pointerId) {
      const points = colonyLassoSession.current.points
      const candidates = colonyCandidatesForPoints(points)
      if (!cancelled && points.length >= 3 && candidates.length >= 2) {
        if (colonyLassoMode?.kind === 'rescope' && colonyLassoMode.colonyId) onRescopeColony?.(colonyLassoMode.colonyId, points)
        else onCreateColonyFromLasso?.(candidates, points)
      }
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      clearColonyLasso()
      return
    }
    if (semanticDropSession.current && event.pointerId === semanticDropSession.current.pointerId) {
      const item = semanticDropSession.current
      const colonyHit = !cancelled && semanticDropMoved.current ? colonyTargetAt(event.clientX, event.clientY) : null
      const hit = !colonyHit && !cancelled && onDirectProjectViewDrop && semanticDropMoved.current ? projectViewTargetAt(event.clientX, event.clientY) : null
      setDirectProjectViewHover(hit ?? null)
      if (colonyHit) onAddToColony?.(colonyHit.colonyId, item.ids)
      else if (hit) commitProjectViewTarget(hit.target.id, item.ids)
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      cancelSemanticDrop()
      return
    }
    const colonyMoveHit = !cancelled && dragging.current && dragCandidate.current ? colonyTargetAt(event.clientX, event.clientY) : null
    const directMoveHit = !colonyMoveHit && !cancelled && dragging.current && dragCandidate.current && onDirectProjectViewDrop
      ? externalProjectViewTargetAt(event.clientX, event.clientY)
      : null
    if (directMoveHit && dragCandidate.current && onDirectProjectViewDrop) {
      if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current)
      dragFrame.current = null
      const candidate = dragCandidate.current
      restoreDraggedOriginals(candidate)
      setDragPreviewPositions(null)
      onPresentationInteractionChange?.(false)
      commitProjectViewTarget(directMoveHit.target.id, candidate.group.map((item) => item.id))
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
      setRelationTargetId(null)
      setRelationSourceId(null)
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
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current)
    dragFrame.current = null
    const finalDragPoint = dragPoint.current
    // RAF owns only the transient preview. A completed drag must always commit
    // its final world position, even when the last preview frame already ran.
    if (wasDragging && draggedId && finalDragPoint) {
      const group = dragCandidate.current?.group ?? []
      // User Move > Grid Proposal: manual pointer release always owns the exact world position.
      // Grid may propose/preview layout elsewhere; it never rewrites a completed human drag.
      const settledPoint = finalDragPoint
      const placements = new Map((group.length > 1 ? group : [{ id: draggedId, dx: 0, dy: 0 }])
        .map((member) => [member.id, { x: settledPoint.x + member.dx, y: settledPoint.y + member.dy }]))
      setNodes((current) => current.map((node) => {
        const placement = placements.get(node.id)
        return placement ? { ...node, ...placement, positionLocked: true } : node
      }))
      const placementRecord = Object.fromEntries(placements)
      if (colonyMoveHit) onAddToColony?.(colonyMoveHit.colonyId, [...placements.keys()], placementRecord)
      onColonyMemberMoveSettled?.([...placements.keys()], placementRecord)
      for (const [id, placement] of placements) {
        if (id.startsWith('workspace:')) onWorkspaceProjectionMove?.(id.slice('workspace:'.length), placement.x, placement.y)
      }
    }
    setDragPreviewPositions(null)
    if (!wasDragging && draggedId && doublePressCandidate.current === draggedId) {
      suppressClick.current = draggedId
      doublePressCandidate.current = null
      selectionCollapseCandidate.current = null
      lastNodePress.current = null
      // 双击进入（如对话阅读）时收掉同节点 Orbit——进入材料是更深的层，Orbit 不该留在背后。
      if (nodes.find((node) => node.id === draggedId)?.entityKind === 'conversation') setConversationOrbit(null)
      setProjectObjectOrbit(null)
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
      setRelationTargetId(null)
      setRelationSourceId(null)
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
        setRelationTargetId(null)
        setRelationSourceId(null)
        linkStart.current = null
        linkMoved.current = false
        setLinkPoint(null)
      } else if (linkMoved.current) {
        const point = toWorld(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())
        setCreateMenu({ from: source, x: point.x, y: point.y, screenX: event.clientX, screenY: event.clientY })
        link.current = null
        linkTarget.current = null
        setRelationTargetId(null)
        setRelationSourceId(null)
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
      {lod !== 'full' && <div className="lod-badge">{nodes.length} 个节点 · {lod === 'overview' ? '总览' : lod === 'aggregate' ? '聚合显示' : '简化显示'}</div>}
    {surfaceMode === 'project' && onSurfaceElementsChange && <SurfaceComponentShelf projectId={projectId} surface="main" elements={surfaceElements} selectionIds={selectedIds} selectionBounds={componentSelectionBounds} viewportOrigin={surfaceViewportOrigin(camera)} portalTargets={portalTargets} onElementsChange={onSurfaceElementsChange}/>}
    {surfaceMode === 'project' && onSurfaceElementsChange && <AgentSurfaceComposer surface="main" targetIds={selectedIds} previewing={componentProposalOps.length > 0} onPreview={previewComponentIntent} onKeep={keepComponentProposal} onRevert={() => setComponentProposalOps([])}/>}
    {dropGhost && <div className="lcos-drop-ghost" style={{ left: dropGhost.x, top: dropGhost.y }} aria-hidden="true">
      <span className="lcos-drop-ghost-stack"><i /><i /><i /></span>
      <strong>{dropGhost.count}</strong>
      <small>{dropGhost.label ?? '移动'}</small>
    </div>}
    {dropLight && <LightCurtain tone="drop" anchors={['left', 'bottom']} hot={dropLight.hot} label={dropLight.label} count={dropGhost?.count}/>}
    {surfaceMode === 'project' && onCreateColonyFromLasso && <div className={`lcos-colony-lasso-entry ${colonyLassoMode ? 'is-active' : ''}`} onPointerDown={(event) => event.stopPropagation()}>
      <button type="button" aria-pressed={Boolean(colonyLassoMode)} title="手画一圈建立 Colony" onClick={() => {
        if (colonyLassoMode) clearColonyLasso()
        else { setSelectedColonyId(null); setColonyLassoMode({ kind: 'create' }); setColonyLassoPoints([]); setColonyCandidateIds([]) }
      }}><LassoSelect size={13}/>{colonyLassoMode?.kind === 'rescope' ? '重新圈定中' : colonyLassoMode ? '圈定中 · Esc 取消' : '圈一片'}</button>
    </div>}
    {!selectionComposer && selectedIds.length > 1 && selectionGroupActionPosition && <SelectionGroupActions
      x={selectionGroupActionPosition.left}
      y={selectionGroupActionPosition.top}
      count={selectedIds.length}
      selectionKey={selectedIds.join('\u001f')}
      actions={selectionGroupActions}
    />}
    {selectionComposer && selectionComposerPosition && <UnifiedExecutionComposer
      nodes={nodes}
      selectedIds={selectedIds}
      x={selectionComposerPosition.left}
      y={selectionComposerPosition.top}
      spatialPlacement={selectionComposerSpatialPlacement}
      spatialPlacementOrigin={canvasScreenRect ? { x: canvasScreenRect.left, y: canvasScreenRect.top } : undefined}
      {...selectionComposer}
    />}
    {createMenu && <div data-testid="anchor-create-menu" className="anchor-create-menu" style={{ left: createMenu.screenX, top: createMenu.screenY }} onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation() }}><span>在此创建并连接</span><button data-testid="anchor-create-note" onClick={() => { onCreateNodeFromAnchor('note', createMenu.x, createMenu.y, createMenu.from); setCreateMenu(null) }}>文本</button><button data-testid="anchor-create-context" onClick={() => { onCreateNodeFromAnchor('context', createMenu.x, createMenu.y, createMenu.from); setCreateMenu(null) }}>内容集合</button><button className="cancel" onClick={() => setCreateMenu(null)}>取消</button></div>}
    {marqueeRect && (() => { const rect = canvasRef.current?.getBoundingClientRect(); return <div data-testid="selection-marquee" className="marquee" style={{ left: marqueeRect.left - (rect?.left ?? 0), top: marqueeRect.top - (rect?.top ?? 0), width: marqueeRect.width, height: marqueeRect.height }} /> })()}
  </>

  return <><SpatialCanvas ref={canvasRef} testId="canvas" surfaceRef={surfaceMode === 'project' ? 'main' : undefined} markerAnchorItems={surfaceMode === 'project' ? spatialCanvasItems : undefined} navigationMarkerItems={surfaceMode === 'project' ? semanticRegionMarkerItems : undefined} onNavigationMarkerLocate={(markerId) => navigateSpatialIds(semanticRegionMembersByMarker.get(markerId) ?? [])} tabIndex={-1} camera={camera} setCamera={setCamera} disabled={locked} ariaBusy={locked} locked={locked} nodeCount={nodes.length} edgeCount={edges.length} className={`canvas ${referencePickIntent ? 'is-reference-pick' : ''} ${link.current ? 'is-relation-dragging' : ''} ${relationSourceId ? 'is-relation-intent' : ''} lod-${lod} zoom-band-${zoomBand} layout-mode-freeform ${gridSnapEnabled ? 'grid-snap-enabled' : ''} ${selectedId ? 'has-focus' : ''} ${locked ? 'is-locked' : ''}`} worldClassName="canvas-world" worldTestId="canvas-world" style={{ '--canvas-zoom': String(camera.zoom), '--lcos-main-grid-size': `${MAIN_CANVAS_GRID_STEP * camera.zoom}px`, '--lcos-main-grid-x': `${camera.x % (MAIN_CANVAS_GRID_STEP * camera.zoom)}px`, '--lcos-main-grid-y': `${camera.y % (MAIN_CANVAS_GRID_STEP * camera.zoom)}px` } as React.CSSProperties} onPointerDown={({ event }) => {
    const target = event.target as HTMLElement
    // Workspace-level Semantic Drop fallback. Node-level Semantic Drop starts in
    // CanvasCard before ordinary node movement so a primary grab-handle drag cannot
    // accidentally move the source object.
    if (semanticDropTriggerFromPointer(event)) {
      const workspaceTarget = target.closest<HTMLElement>('[data-workspace-frame]')
      if (workspaceTarget?.dataset.workspaceFrame && beginCanvasSemanticDrop([`workspace:${workspaceTarget.dataset.workspaceFrame}`], event)) return
    }
    const blankCanvas = !target.closest('[data-node-id], [data-workspace-frame], [data-colony-id], button, .edge, .edge-control')
    if (blankCanvas) event.currentTarget.focus({ preventScroll: true })
    if (createMenu && !target.closest('.anchor-create-menu')) setCreateMenu(null)
    if (event.button === 0 && blankCanvas && colonyLassoMode) {
      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      const point = toWorld(event.clientX, event.clientY, rect)
      colonyLassoSession.current = { pointerId: event.pointerId, points: [point] }
      setColonyLassoPoints([point])
      setColonyCandidateIds([])
      try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* browser owns capture */ }
      return
    }
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
      if (relationSourceId !== null && link.current) {
        // Explicit Relation owns this click. Preserve the source Selection so pointerup can
        // materialize the existing create-and-connect menu at this empty location.
        event.preventDefault()
        return
      }
      if (!additiveSelection(event)) onClearSelection()
      marquee.current = beginSpatialMarquee(event.pointerId, { x: event.clientX, y: event.clientY })
    }
  }} onPointerMove={({ event, rect }) => {
    if (colonyLassoSession.current && colonyLassoSession.current.pointerId === event.pointerId) {
      if (event.pointerType === 'mouse' && ((event.buttons ?? 1) & 1) === 0) { finishPointer(event, true); return }
      const point = toWorld(event.clientX, event.clientY, rect)
      const points = colonyLassoSession.current.points
      const previous = points[points.length - 1]
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) >= 6 / Math.max(.2, camera.zoom)) {
        points.push(point)
        const snapshot = [...points]
        setColonyLassoPoints(snapshot)
        setColonyCandidateIds(colonyCandidatesForPoints(snapshot))
      }
      return
    }
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
      if (!semanticDropMoved.current && Math.hypot(event.clientX - item.startX, event.clientY - item.startY) > 4) {
        semanticDropMoved.current = true
        if (item.trigger === 'secondary-pointer' && !contextMenuGuard.current) {
          try { canvasRef.current?.setPointerCapture(event.pointerId) } catch { /* browser may own capture */ }
          const guard = (menuEvent: Event) => {
            menuEvent.preventDefault()
            window.removeEventListener('contextmenu', guard, true)
            if (contextMenuGuard.current === guard) contextMenuGuard.current = null
          }
          contextMenuGuard.current = guard
          window.addEventListener('contextmenu', guard, true)
        }
      }
      if (semanticDropMoved.current) {
        event.preventDefault()
        const colonyHit = colonyTargetAt(event.clientX, event.clientY)
        const hit = !colonyHit && onDirectProjectViewDrop ? projectViewTargetAt(event.clientX, event.clientY) : null
        setDirectProjectViewHover(hit)
        const label = colonyHit ? '加入 Colony' : hit ? `加入 ${hit.target.label}` : undefined
        if (label) setDropGhost({ x: event.clientX, y: event.clientY, count: item.ids.length, label })
        else setDropGhost({ x: event.clientX, y: event.clientY, count: item.ids.length })
        setDropLight({ hot: Boolean(colonyHit || hit), label })
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
      if (item.moved) suppressWorkspaceOrbitClick.current = item.workspaceId
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
        // 否则“拖一下 → 松手 → 立刻单击”会被误判为第二次按下并进入更深阅读层。
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
        const colonyHit = colonyTargetAt(event.clientX, event.clientY)
        const directHit = !colonyHit && onDirectProjectViewDrop ? externalProjectViewTargetAt(event.clientX, event.clientY) : null
        setDirectProjectViewHover(directHit)
        if (colonyHit || directHit) {
          stopAutoPan()
          const label = colonyHit ? '加入 Colony' : `加入 ${directHit!.target.label}`
          setDropGhost({ x: event.clientX, y: event.clientY, count: candidate.group.length, label })
          setDropLight({ hot: true, label })
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
        // 拖动过程连续跟手（Figma/mubu 惯例）：网格吸附只作用于松手落点，
        // 避免拖动中“先卡住、靠近网格线再跳变”的迟滞观感。
        dragPoint.current = rawPoint
        const anchorNode = nodes.find((node) => node.id === candidate.id)
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
      const nextRelationTarget = relationTargetAt(event.clientX, event.clientY)
      linkTarget.current = nextRelationTarget
      setRelationTargetId(nextRelationTarget)
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
    {surfaceMode === 'project' && onSurfaceElementsChange && <SurfaceComponentLayer surface="main" elements={surfaceElements} zoom={camera.zoom} renderContext={{ nodes, edges, onSelectNode: onSelect, onOpenNode: onDoubleClick, onOpenPortal: onOpenPortalTarget }} onElementsChange={onSurfaceElementsChange}/>}
    {surfaceMode === 'project' && <SurfaceComponentProposalLayer surface="main" elements={componentProposalElements} renderContext={{ nodes, edges }}/>}
    <SpatialNodeLayer className="lcos-arrange-structure-layer">
      {alignmentGuide?.x !== undefined && <i className="lcos-alignment-guide axis-x" style={{ left: alignmentGuide.x }}/>} {/* x guide */}
      {alignmentGuide?.y !== undefined && <i className="lcos-alignment-guide axis-y" style={{ top: alignmentGuide.y }}/>} {/* y guide */}
      {colonies.filter((colony) => colony.surface === 'main').map((colony) => {
        const bounds = colonyBounds(colony)
        const selected = selectedColonyId === colony.id
        return <div key={colony.id} className={`lcos-colony-overlay ${selected ? 'is-selected' : ''}`} data-colony-overlay={colony.id}>
          <svg className="lcos-colony-contour-svg" width="1" height="1" aria-hidden="true">
            <path data-colony-id={colony.id} className="lcos-colony-contour" d={colonyPathData(colony)} onPointerDown={(event) => {
              if (event.button !== 0 || colonyLassoMode) return
              event.preventDefault(); event.stopPropagation()
              setSelectedColonyId(colony.id)
              onMarqueeSelect([...colony.memberIds], false)
            }}/>
          </svg>
          <div className="lcos-colony-label" style={{ left: bounds.x + 12, top: bounds.y + 8 }} data-colony-id={colony.id} onPointerDown={(event) => event.stopPropagation()}>
            <strong>{colony.label?.trim() || 'Colony'}</strong><small>{colony.memberIds.length} 项</small>
            {selected && <span className="lcos-colony-actions">
              <button type="button" title="重新画一圈定义成员" onClick={() => { setColonyLassoMode({ kind: 'rescope', colonyId: colony.id }); setColonyLassoPoints([]); setColonyCandidateIds([]) }}><RotateCcw size={11}/>重新圈定</button>
              <button type="button" title="解散 Colony；对象保留原位" onClick={() => { setSelectedColonyId(null); onDissolveColony?.(colony.id) }}><X size={11}/>解散</button>
            </span>}
          </div>
        </div>
      })}
      {colonyLassoPoints.length > 1 && <svg className="lcos-colony-lasso-svg" width="1" height="1" aria-hidden="true"><path d={`M ${colonyLassoPoints.map((point) => `${point.x} ${point.y}`).join(' L ')}${colonyLassoPoints.length > 2 ? ' Z' : ''}`}/></svg>}
      {effectiveWorkspaceFrames.map((frame) => <div key={frame.workspaceId} data-testid={`workspace-frame-${frame.workspaceId}`} data-workspace-frame={frame.workspaceId} data-relation-target={`workspace:${frame.workspaceId}`} data-member-count={frame.memberViewIds.length} className={`workspace-frame ${frame.active ? 'active' : ''} ${draggingWorkspaceId === frame.workspaceId ? 'dragging' : ''} ${relationTargetId === `workspace:${frame.workspaceId}` ? 'is-relation-target' : ''}`} style={{ left: frame.bounds.x, top: frame.bounds.y, width: frame.bounds.width, height: frame.bounds.height }}>
        <button data-testid={`workspace-frame-header-${frame.workspaceId}`} className="workspace-frame-header" type="button" onClick={(event) => {
          event.stopPropagation()
          onWorkspaceActivate?.(frame.workspaceId)
          if (surfaceMode !== 'project') return
          if (suppressWorkspaceOrbitClick.current === frame.workspaceId) { suppressWorkspaceOrbitClick.current = null; return }
          setConversationOrbit(null)
          setProjectObjectOrbit(null)
          setWorkspaceOrbit({ anchor: event.currentTarget, workspaceId: frame.workspaceId, label: frame.label })
        }} onPointerDown={(event) => {
          if (locked || event.button !== 0) return
          if (link.current) {
            event.preventDefault(); event.stopPropagation(); suppressWorkspaceOrbitClick.current = frame.workspaceId
            const target = `workspace:${frame.workspaceId}`
            if (link.current.from !== target) connect(link.current.from, target)
            link.current = null
            linkTarget.current = null
            setRelationTargetId(null)
            setRelationSourceId(null)
            linkStart.current = null
            linkMoved.current = false
            setLinkPoint(null)
            return
          }
          event.preventDefault(); event.stopPropagation()
          suppressWorkspaceOrbitClick.current = null
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
        {surfaceMode === 'project' && relationSourceId === `workspace:${frame.workspaceId}` && <button data-testid={`workspace-relation-source-port-${frame.workspaceId}`} className="lcos-relation-port workspace-relation-port" type="button" aria-label={`从 Workspace ${frame.label} 建立关系`} title="关系已激活 · 拖动可精确连接，Esc 取消" onPointerDown={(event) => beginRelation(`workspace:${frame.workspaceId}`, event, { x: frame.bounds.x + frame.bounds.width, y: frame.bounds.y + frame.bounds.height / 2 })} onClick={(event) => event.stopPropagation()}><span aria-hidden="true" /></button>}
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
      {extremeFarGlythClusters.map((cluster) => <button type="button" key={cluster.id} className="lcos-glyth-semantic-cluster" data-glyth-cluster={cluster.count} data-glyth-cluster-members={cluster.memberIds.join(',')} style={{ left: cluster.x, top: cluster.y, '--glyth-ui-scale': String(1 / Math.max(.02, camera.zoom)) } as React.CSSProperties} aria-label={`靠近 ${cluster.count} 段对话`} title="靠近这片对话" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); navigateSpatialIds(cluster.memberIds) }}><span aria-hidden="true">{cluster.count}</span><small>对话</small></button>)}
      {renderNodes.map((node) => {
        if (clusteredGlythIds.has(node.id)) return null
        const collectionScopeId = node.entityKind === 'collection' ? (node.opensScopeId ?? (node.id.startsWith('scope:') ? node.id.slice('scope:'.length) : null)) : null
        return <CanvasCard key={node.id} projectId={projectId} node={node} density={nodeDensity(node, lod)} zoom={camera.zoom} showDetails={camera.zoom > .2 && lod !== 'overview'} performanceProxy={node.entityKind !== 'conversation' && (lod === 'aggregate' || lod === 'overview') && !selectedIds.includes(node.id) && pendingId !== node.id} glythCritical={criticalGlythIds.has(node.id)} runId={runId} runStatus={runStatus} selected={selectedIds.includes(node.id)} multiSelected={selectedIds.length > 1 && selectedIds.includes(node.id)} pending={pendingId === node.id} reviewPending={pendingReviewIds.includes(node.id)} referenceOrder={referencePick ? referencePick.ids.indexOf(node.id) + 1 : 0} dragging={draggingId === node.id} dragSignal={draggingId === node.id ? dragSignal : undefined} resizing={resizingId === node.id} workspaceMember={Boolean(activeWorkspaceId && workspaceFrames.find((frame) => frame.workspaceId === activeWorkspaceId)?.memberViewIds.includes(node.id))} locatePulse={locatePulseId === node.id} attentionBucket={attentionBucketsByViewId[node.id]} collectionExpanded={Boolean(collectionScopeId && expandedCollectionScopeIds.includes(collectionScopeId))} collectionMembers={collectionMembersByNodeId[node.id] ?? (collectionScopeId ? collectionMembersByNodeId[`scope:${collectionScopeId}`] ?? [] : [])} collectionMotion={collectionMotionByNodeId.get(node.id)} onOpenContextLens={onOpenContextLens} onCollectionMemberSelect={onSelect} onLocate={onLocateNode} onLocateConversationSource={onLocateConversationSource} onDetails={onDetails} referenceReceptive={referencePickIntent && node.entityKind !== 'conversation'} colonyCandidate={colonyCandidateIds.includes(node.id)} onPointerDown={(event) => {
        if (event.button === 0 && referencePick && (referencePick.active || referencePickModifier(event))) {
          event.preventDefault(); event.stopPropagation(); suppressClick.current = node.id
          if (node.entityKind === 'conversation' && node.conversation) {
            onSetActiveConversation?.(node.conversation.id)
          } else {
            referencePick.onToggle(node.id)
          }
          return
        }
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
          setRelationTargetId(null)
          setRelationSourceId(null)
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
      }} onClick={(additive, anchor) => {
        if (suppressClick.current === node.id) { suppressClick.current = null; return }
        // C-3 Grammar §11：单击 conversation = Select + Orbit 并存（Select 已在 pointerdown 落位）；
        // 追加选/多选不出 Orbit（§13 只对 single active object 出现）。
        const preservingExistingMultiSelection = selectedIds.length > 1 && selectedIds.includes(node.id)
        if (!additive && !preservingExistingMultiSelection) setWorkspaceOrbit(null)
        if (node.entityKind === 'conversation' && node.conversation !== undefined && !additive && !preservingExistingMultiSelection) {
          setProjectObjectOrbit(null)
          setConversationOrbit({ anchor: anchor.querySelector('.lcos-conversation-glyth') ?? anchor, nodeId: node.id, conversationId: node.conversation.id, title: node.conversation.title })
        } else if (node.entityKind !== 'conversation' && !additive && !preservingExistingMultiSelection) {
          setConversationOrbit(null)
          setProjectObjectOrbit({ anchor, nodeId: node.id })
        } else if (additive || preservingExistingMultiSelection) {
          setConversationOrbit(null)
          setProjectObjectOrbit(null)
        }
        if (!additive && !preservingExistingMultiSelection && projectNodeSupportsInlineComposer(node)) onRequestSelectionComposer?.(node.id)
        if (collectionScopeId) onToggleCollection?.(collectionScopeId)
      }} onResizeStart={(event) => {
        if (locked || selectedIds.length !== 1) return
        event.preventDefault(); event.stopPropagation()
        resizeCandidate.current = { id: node.id, startX: event.clientX, startY: event.clientY, width: node.width, height: node.height, moved: false }
        onPresentationInteractionChange?.(true)
        setResizingId(node.id)
        try { canvasRef.current?.setPointerCapture(event.pointerId) } catch { /* browser owns capture */ }
      }} relationTarget={relationTargetId === node.id} relationSource={relationSourceId === node.id} onLinkStart={(event) => beginRelation(node.id, event, { x: node.x + node.width, y: node.y + node.height / 2 })} />
      })}
    </SpatialNodeLayer>
  </SpatialCanvas>
  <SpatialBeaconLayer beacon={mainFocus.beacon} camera={camera} onArrivalEnd={mainFocus.clearBeacon} />
  {projectObjectOrbit !== null && projectObjectOrbitNode !== null && projectObjectOrbitNode.entityKind !== 'conversation' && (
    <ProjectObjectOrbit
      open
      node={projectObjectOrbitNode}
      anchorRef={projectObjectOrbitAnchorRef}
      onClose={() => setProjectObjectOrbit(null)}
      onOpen={() => { setProjectObjectOrbit(null); onDoubleClick(projectObjectOrbitNode.id) }}
      onRelation={() => beginRelationIntent(projectObjectOrbitNode.id, { x: projectObjectOrbitNode.x + projectObjectOrbitNode.width, y: projectObjectOrbitNode.y + projectObjectOrbitNode.height / 2 })}
      {...(onFocusNode ? { onLocate: () => onFocusNode(projectObjectOrbitNode.id) } : {})}
    />
  )}
  {workspaceOrbit !== null && workspaceOrbitFrame !== null && surfaceMode === 'project' && (
    <ObjectOrbit
      open
      onClose={() => setWorkspaceOrbit(null)}
      anchorRef={workspaceOrbitAnchorRef}
      ariaLabel={`工作现场「${workspaceOrbit.label}」的动作`}
      actions={[
        { id: 'workspace-relation', label: '关系', icon: GitBranch, primary: true, onClick: () => beginRelationIntent(`workspace:${workspaceOrbit.workspaceId}`, { x: workspaceOrbitFrame.bounds.x + workspaceOrbitFrame.bounds.width, y: workspaceOrbitFrame.bounds.y + workspaceOrbitFrame.bounds.height / 2 }) },
      ]}
    />
  )}
  {conversationOrbit !== null && (
    <ObjectOrbit
      open
      onClose={() => setConversationOrbit(null)}
      anchorRef={conversationOrbitAnchorRef}
      ariaLabel={`会话「${conversationOrbit.title}」的动作`}
      actions={[
        { id: 'conversation-open', label: '进入现场', icon: MessageSquare, primary: true, onClick: () => onOpenConversation?.(conversationOrbit.conversationId) },
        ...(byId.get(conversationOrbit.nodeId)?.conversation?.conversationArtifactId ? [{
          id: 'conversation-relation', label: '关系', icon: GitBranch, onClick: () => {
            const source = byId.get(conversationOrbit.nodeId)
            if (!source?.conversation?.conversationArtifactId) return
            beginRelationIntent(source.id, { x: source.x + source.width, y: source.y + source.height / 2 })
          },
        }] : []),
        markerRuntime ? (() => {
          const targetRef = { projectId: markerRuntime.projectId, kind: 'view' as const, id: conversationOrbit.nodeId }
          const marker = markerForNavigationTarget(markerRuntime.records, targetRef)
          return marker
            ? { id: 'conversation-marker', label: '取消导航地标', icon: MapPin, onClick: () => { void markerRuntime.deleteMarker(marker.id) } }
            : { id: 'conversation-marker', label: '固定到导航', icon: MapPin, onClick: () => { void markerRuntime.createMarker({ targetRef, scope: 'cross-surface' }) } }
        })() : { id: 'conversation-marker', label: '固定到导航', icon: MapPin, readOnly: true },
        activeConversationId === conversationOrbit.conversationId
          ? { id: 'conversation-active', label: '当前承接', icon: CheckCircle2, readOnly: true }
          : { id: 'conversation-activate', label: '设为当前', icon: Radio, onClick: () => onSetActiveConversation?.(conversationOrbit.conversationId) },
      ]}
    />
  )}
  </>
})

function EdgePath({ edge, from, to, selected, focused, dimmed, onSelect, onCut, onReconnectStart }: { edge: CanvasEdge; from?: CanvasNode; to?: CanvasNode; selected: boolean; focused: boolean; dimmed: boolean; onSelect: (id: string) => void; onCut: (id: string) => void; onReconnectStart: (endpoint: 'from' | 'to', event: React.PointerEvent<SVGCircleElement>) => void }) {
  if (!from || !to) return null
  const x1 = from.x + from.width, y1 = from.y + from.height / 2, x2 = to.x, y2 = to.y + to.height / 2
  const d = `M ${x1} ${y1} C ${x1 + 80} ${y1}, ${x2 - 80} ${y2}, ${x2} ${y2}`
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  const select = (event: React.PointerEvent<SVGElement>) => { event.stopPropagation(); onSelect(edge.id) }
  const relationLabel = edge.label?.trim()
  const visibleLabel = relationLabel && relationLabel.length > 18 ? `${relationLabel.slice(0, 18)}…` : relationLabel
  const labelWidth = visibleLabel ? Math.max(36, Math.min(128, visibleLabel.length * 7 + 18)) : 0
  return <>
    <path className="edge-hit" data-edge-id={edge.id} d={d} onPointerDown={select} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation() }} />
    <path className={`edge ${edge.kind} ${edge.active ? 'active' : ''} ${edge.scope ? `edge-scope-${edge.scope}` : ''} ${focused ? 'focused' : ''} ${selected ? 'selected' : ''} ${dimmed ? 'dimmed' : ''}`} data-edge-id={edge.id} data-edge-from={edge.from} data-edge-to={edge.to} d={d} onPointerDown={select} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation() }} />
    {visibleLabel && !dimmed && (selected || focused) && <g className={`lcos-edge-label ${selected ? 'is-selected' : ''}`} transform={`translate(${mx} ${my})`} onPointerDown={select}>
      <rect x={-labelWidth / 2} y={-10} width={labelWidth} height={20} rx={8}/>
      <text textAnchor="middle" dominantBaseline="central">{visibleLabel}</text>
    </g>}
    {selected && <g className="edge-controls" data-testid={`edge-controls-${edge.id}`}>
      <circle className="edge-control edge-terminal-hit" data-testid={`edge-reconnect-from-${edge.id}`} cx={x1} cy={y1} r="9" onPointerDown={(event) => onReconnectStart('from', event)} />
      <circle className="edge-control edge-terminal-hit" data-testid={`edge-reconnect-to-${edge.id}`} cx={x2} cy={y2} r="9" onPointerDown={(event) => onReconnectStart('to', event)} />
      <path className="edge-terminal-mark" d={`M ${x1} ${y1 - 5} L ${x1} ${y1 + 5} M ${x2} ${y2 - 5} L ${x2} ${y2 + 5}`} />
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

function CanvasCard({ projectId, node, density, zoom, showDetails, performanceProxy = false, glythCritical = false, runId, runStatus, selected, multiSelected, pending, reviewPending, referenceOrder, dragging, dragSignal, resizing, workspaceMember, locatePulse, attentionBucket, collectionExpanded, collectionMembers, collectionMotion, onCollectionMemberSelect, onLocate, onLocateConversationSource, onOpenContextLens, onDetails, onPointerDown, onClick, onResizeStart, relationTarget, relationSource, referenceReceptive, colonyCandidate, onLinkStart }: {
  projectId: string; node: CanvasNode; density: NodeDisplayMode; zoom: number; showDetails: boolean; performanceProxy?: boolean; glythCritical?: boolean; runId: string; runStatus: RunStatus | null; selected: boolean; multiSelected: boolean; pending: boolean; reviewPending: boolean; referenceOrder: number; dragging: boolean; dragSignal?: { x: number; y: number }; resizing: boolean; workspaceMember: boolean; locatePulse: boolean; attentionBucket?: AttentionBucketV0; collectionExpanded: boolean; collectionMembers: readonly CanvasNode[]
  collectionMotion?: { phase: 'opening' | 'closing'; dx: number; dy: number }
  onCollectionMemberSelect: (id: string, additive?: boolean) => void; onLocate?: (id: string) => void; onLocateConversationSource?: (id: string) => void; onOpenContextLens?: (node: CanvasNode, lens: 'space' | 'structure' | 'evolution') => void; onDetails: (id: string) => void; onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void; onClick: (additive: boolean, anchor: HTMLElement) => void; onResizeStart: (event: React.PointerEvent<HTMLButtonElement>) => void; relationTarget: boolean; relationSource: boolean; referenceReceptive: boolean; colonyCandidate: boolean; onLinkStart: (event: React.PointerEvent<HTMLButtonElement>) => void
}) {
  const visualFamily = nodeVisualFamily(node)
  const revisionStack = (node.revisionCount ?? 0) > 1
  const runtimeSignal: SpatialRuntimeSignal = node.error || node.runtimeState === 'failed'
    ? 'failed'
    : node.runStatus === 'running' || (node.sourceRunId && runStatus === 'running')
      ? 'processing'
      : 'idle'
  const signal = resolveSpatialSignal({
    selected: locatePulse,
    runtime: runtimeSignal,
    semantic: reviewPending ? 'waiting review' : pending || node.draft ? 'candidate draft' : undefined,
  })
  return <div data-node-id={node.id} data-project-relation-target={node.entityKind !== 'conversation' ? node.id : undefined} data-project-view-drop-target={node.entityKind === 'conversation' && node.conversation ? conversationGlythDropTarget(node.conversation.id) : undefined} data-project-view-drop-label={node.entityKind === 'conversation' ? '给这段对话' : undefined} data-node-kind={node.kind} data-entity-kind={node.entityKind} data-node-visual-family={visualFamily} data-node-current={node.current || undefined} data-node-draft={node.draft || undefined} data-node-historical={node.historical || undefined} data-revision-count={node.revisionCount} data-result-group={node.resultGroupId} data-node-runtime={node.runtimeState} data-run-status={node.runStatus} data-artifact-id={node.artifactId} data-conversation-artifact-id={node.entityKind === 'conversation' ? node.conversation?.conversationArtifactId : undefined} data-revision-id={node.revisionId} data-file-record-id={node.fileRecordId} data-current-revision={node.followsCurrentRevision || undefined} data-preview-status={node.previewStatus} data-view-of={node.viewOf} data-scope-id={node.scopeId} data-position-locked={node.positionLocked || undefined} data-context-only={node.contextOnly || undefined} data-attention-bucket={attentionBucket} data-reference-order={referenceOrder || undefined} data-collection-motion={collectionMotion?.phase} data-testid={`canvas-node-${node.id}`} role="button" tabIndex={0} aria-disabled={node.disabled || undefined} className={`canvas-node node-family-${node.kind} visual-family-${visualFamily} density-${density} ${node.kind} ${revisionStack ? 'revision-stack' : ''} ${selected ? 'selected' : ''} ${multiSelected ? 'multi-selected' : ''} ${pending ? 'pending' : ''} ${reviewPending ? 'review-pending' : ''} ${referenceOrder > 0 ? 'reference-picked' : ''} ${referenceReceptive ? 'is-reference-receptive' : ''} ${colonyCandidate ? 'is-colony-candidate' : ''} ${dragging ? 'dragging' : ''} ${resizing ? 'resizing' : ''} ${relationTarget ? 'is-relation-target' : ''} ${workspaceMember ? 'workspace-active-member' : ''} ${locatePulse ? 'locate-pulse' : ''} ${attentionBucket ? `attention-${attentionBucket}` : ''} ${collectionMotion ? `collection-${collectionMotion.phase}` : ''} ${node.error ? 'error' : ''} ${node.disabled ? 'disabled' : ''} ${node.positionLocked ? 'position-locked' : ''}`} style={{ left: node.x, top: node.y, width: node.width, height: node.height, '--node-ui-scale': String(1 / Math.max(.2, zoom)), '--glyth-ui-scale': String(1 / Math.max(.02, zoom)), '--canvas-zoom': String(zoom), '--lcos-drag-x': String(dragSignal?.x ?? 0), '--lcos-drag-y': String(dragSignal?.y ?? 0), '--lcos-collection-fold-x': `${collectionMotion?.dx ?? 0}px`, '--lcos-collection-fold-y': `${collectionMotion?.dy ?? 0}px` } as React.CSSProperties} onDragStart={(event) => event.preventDefault()} onContextMenu={(event) => event.preventDefault()} onPointerDown={(event) => { if (!node.disabled) onPointerDown(event) }} onClick={(event) => { event.stopPropagation(); if (!node.disabled) onClick(additiveSelection(event), event.currentTarget) }}>
    {referenceOrder > 0 && <span className="lcos-reference-pick-badge" aria-label={`引用顺序 ${referenceOrder}`}>{referenceOrder}</span>}
    <span className="lcos-semantic-drop-handle" data-semantic-drop-handle aria-hidden="true" onClick={(event)=>event.stopPropagation()} title="Semantic Drop：拖到上下文或工作流（右键拖 / Alt+左拖）"><GripVertical size={11}/></span>
    {relationSource && <button data-testid={`relation-source-port-${node.id}`} className="lcos-relation-port" aria-label={`从 ${node.title} 建立关系`} title="关系已激活 · 拖动可精确连接，Esc 取消" onPointerDown={onLinkStart} onClick={(event) => event.stopPropagation()}><span aria-hidden="true" /></button>}
    {selected && !multiSelected && <button data-testid={`resize-${node.id}`} className="resize-handle" aria-label={`调整 ${node.title} 大小`} title="拖动调整卡片大小" onPointerDown={onResizeStart} onClick={(event) => event.stopPropagation()} />}
    {performanceProxy
      ? <div className={`lcos-overview-node-proxy proxy-${detectFileIdentity(node)}`} aria-label={displayNodeTitle(node)}><span>{detectFileIdentity(node).toUpperCase()}</span><strong>{displayNodeTitle(node)}</strong></div>
      : <CanvasNodeVisual node={node} density={density} zoom={zoom} glythCritical={glythCritical} runId={runId} runStatus={runStatus} pending={pending} showDetails={showDetails} onDetails={() => onDetails(node.id)} onLocate={onLocate ? (target) => onLocate(target.id) : undefined} collectionExpanded={collectionExpanded} collectionMembers={collectionMembers} onCollectionMemberSelect={onCollectionMemberSelect} selected={selected} onOpenContextLens={onOpenContextLens} />}
    {node.entityKind !== 'conversation' && node.artifactId ? <BirthProvenanceBadge projectId={projectId} artifactId={String(node.artifactId)} onLocateConversationView={onLocateConversationSource} /> : null}
    {(selected || signal.state !== 'stable') && node.width >= 56 && <span className="lcos-node-system-signal" data-spatial-signal={selected && signal.state === 'stable' ? 'focus' : signal.state} aria-hidden="true"><LcosSignalGlyph state={selected && signal.state === 'stable' ? 'focus' : signal.state}/></span>}
  </div>
}
