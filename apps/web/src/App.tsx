import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Command, Play } from 'lucide-react'
import type { AssemblySourceRefV1 } from '@local-creative-os/contracts'
import type { ActiveReceiverIdentityV1, Checkpoint, ConnectedConversationV1, ContextChangeProposalV1, ContextManifestV0, ContinuityResumeSnapshotV1, ConversationSessionV1, ExecutionItemAction, ExecutionItemV1, ObsidianVaultScanV1, OrderedRunReferenceV2, PresentationEntityRefV0, ResultSlotV0, RunEvent, RunProposalResult, RunReceiverRefV1, RunReview, RuntimeProviderStatus, WarehouseItemV1, WorkspaceMembership } from '@local-creative-os/contracts'
import { MAX_STRUCTURAL_CONTAINER_DEPTH, type HandoffRecord, type ProjectId, type RelationId } from '@local-creative-os/domain'
import type { ActiveRun, Camera, CanvasNode, CanvasScope, NodeDisplayMode, NodeLayer, PersistedPrototypeState, ProjectPackage, ScopeKind, TargetContextInference, WorkRailPreferences, Workspace } from './model'
import { nodeMeta, runStatusLabel } from './model'
import { ProjectCanvas } from './features/canvas/ProjectCanvas'
import type { ComposerResultPolicy } from './features/canvas/SelectionComposer'
import { mergeExecutionReferenceIds, orderedReferenceForNode, proposalCompatibilityBlockReason, referenceCandidates, resolveComposerReceiver } from './features/execution/commandDraft'
import { reconcileResultSlotProjections } from './features/execution/resultSlotProjection'
import { CanvasMiniMap } from './features/canvas/CanvasMiniMap'
import { WorkRail } from './features/workrail/WorkRail'
import { RevisionUpgradeDialog, type RevisionUpgradeInput } from './features/workrail/RevisionUpgradeDialog'
import { ProjectDrive } from './features/project/ProjectDrive'
import { ReorganizePanel } from './features/reorganize/ReorganizePanel'
import { ProjectToolsDialog } from './features/project/ProjectToolsDialog'
import { WorkspaceDock } from './features/workspace/WorkspaceDock'
import { WorkspaceDialog } from './features/workspace/WorkspaceDialog'
import { ConfirmDialog } from './features/ui/ConfirmDialog'
import { InlineNodeRename } from './features/ui/InlineNodeRename'
import { CreateContentDialog } from './features/create/CreateContentDialog'
import { ScopeCreateDialog } from './features/create/ScopeCreateDialog'
import { ProjectCreateDialog } from './features/create/ProjectCreateDialog'
import { HandoffDialog } from './features/handoff/HandoffDialog'
import { CapabilityPopover } from './features/shell/CapabilityPopover'
import { NodeInfoPopover } from './features/canvas/NodeInfoPopover'
import { LinkReferenceDialog } from './features/create/LinkReferenceDialog'
import { UniversalImportPanel, type DirectoryEntryInput } from './features/resources/UniversalImportPanel'
import { ResourceDetailDialog } from './features/resources/ResourceDetailDialog'
import { ObsidianImportDialog } from './features/resources/ObsidianImportDialog'
import { ConversationContextDialog } from './features/conversations/ConversationContextDialog'
import { ConversationControllerDialog } from './features/conversations/ConversationControllerDialog'
import { capabilitiesFor, type LinkReferenceInput, type RunOutputIntent } from './runtime/v07UiContracts'
import { loadProjectCatalog, loadPrototypeState, saveProjectCatalog, savePrototypeState } from './state/prototypeStorage'
import { clearProjectNavigationState, loadProjectNavigationState, saveProjectNavigationState } from './state/projectNavigation'
import { isRuntimeProjectMode } from './runtime/projectMode'
import { emptyPresentationState, usePresentationMembership, usePresentationViewBridge } from './state/presentationViewState'
import { usePresentationSurfaceElements } from './state/presentationDraftState'
import { rememberNotePresentation } from './state/notePresentationMemory'
import { addMembersToColony, colonyFromSelection, migrateLegacySpatialRegion, reconcileColonyAfterMove, rescopeColony, type SpatialColonyDraft } from './state/spatialColony'
import { appendProjectPresentationEntityRefs, appendProjectPresentationMembers, loadProjectPresentationMembers, removeProjectPresentationEntityRefs, removeProjectPresentationMembers } from './state/projectPresentationMembership'
import { loadPresentationLayoutEngines } from './features/layout/layoutEngines'
import { buildWorkspaceFrames } from './state/workspaceFrames'
import { RuntimeBridge, type DataSource, type SaveStatus } from './runtime/runtimeBridge'
import { selectRuntimeProject } from './runtime/runtimeProjectSelection'
import { createWorkspaceRecord, duplicateWorkspaceRecord, moveWorkspaceRecord, removeWorkspaceRecord, toggleWorkspaceLayer, updateWorkspaceRecord } from './state/workspaceState'
import { fitBounds, fitBoundsForReading, getSelectionBounds, MIN_CANVAS_ZOOM, nodeDimensions, placeNewNodesIncrementally, restorationFocusBounds, restoredCameraIsMeaningful, revealNode } from './features/canvas/canvasGeometry'
import { detectFileIdentity, displayNodeTitle } from './features/canvas/CanvasNodeVisual'
import { mindmapNodeSize } from './features/canvas/MindMapNoteVisual'
import { getVisualSelectionBounds, layoutVisualGrid, nodeVisualBounds, repairVisualLayoutPositions } from './features/canvas/canvasVisualGeometry'
import { findPendingReturnPosition } from './features/canvas/canvasLayout'
import { layoutExpandedCollectionMembers } from './features/canvas/collectionExpandLayout'
import { applyScopeLayout, proposeIslandRecoveryLayout, type LayoutPreviewItem } from './features/canvas/scopeLayout'
import { chooseLayoutStrategy, layoutPreviewSync } from './features/layout/layoutService'
import { ArtifactWorkbench, type WorkbenchFocus } from './features/workbench/ArtifactWorkbench'
import { canPreviewArtifact } from './features/viewer/artifactViewerRegistry'
import { copyCanvasSelection, pasteCanvasNodes, pasteRelationTemplate, type CanvasClipboardPayload } from './state/canvasClipboard'
import { inferFragmentLabel, LCOS_FRAGMENT_CLIPBOARD_MIME, parseFragmentClipboard } from './state/fragmentClipboard'
import { dataUrlToFile, LCOS_MATERIAL_CAPTURE_EVENT, LCOS_MATERIAL_CAPTURE_MESSAGE, LCOS_MATERIAL_TRANSFER_MIME, materialLocatorToSourceAnchor, materialTransferArtifactTitle, materialTransferFromLegacyFragment, materialTransferLabel, parseMaterialTransfer, svgToFile, type MaterialTransferPayloadV1 } from './state/materialTransfer'
import { useCanvasHistory } from './state/useCanvasHistory'
import { inferTargetContext, moveBetweenTargetAndContext, setPrimaryTarget } from './state/workContext'
import { createBlankProjectState } from './state/projectState'
import { createAggregateScopeEntity, removeScopeTree } from './state/canvasScopes'
import type { ActiveContextProjection } from './runtime/localCoreClient'
import type { AttentionBucketV0, AttentionRuntimeSnapshotV0, ProjectViewRailOrderV0, Relation } from '@local-creative-os/contracts'
import { humanizeRuntimeMessage } from './runtime/messages'
import { AgentContextSurface } from './features/shell/AgentContextSurface'
import { buildScopePath, createId, decodeTextBuffer, fileNameFromPath, inferFileType, isTextPreviewFile, runtimePresentationStatus } from './features/shell/appShell'
import { AppShellView } from './features/shell/AppShellView'
import { LocalCoreClientProvider } from './runtime/LocalCoreClientContext'
import { ProjectSpatialMarkerProvider } from './features/spatial/ProjectSpatialMarkerContext'
import type { SurfaceContextMenuAction, SurfaceContextMenuItem } from './features/shell/SurfaceContextMenu'
import type { SharedComposerCommandState, SurfaceExecutionSubmission, SurfaceExecutionSubmissionResult } from './features/execution/surfaceExecution'
import type { DepositHintItem } from './features/shell/BoundaryHints'
import { parseArtifactRevisions, parseProcessProjection, parseWorkspaceStates, type ArtifactRevisionProvenance, type WorkspaceStateSummary } from './runtime/projectionAdapters'
import { WorkspaceStatesDialog } from './features/workspace/WorkspaceStatesDialog'
import { ProjectStripVNext } from './features/shell/ProjectStripVNext'
import { ReceiverChip } from './features/shell/ReceiverChip'
import { applyHandoffPrefixToInstruction, handoffSurfaceKindFromSurfaceId, resolveHandoffPrefix, type ReceiverHandoffContext } from './features/shell/receiverHandoff'
import { CommandPalette } from './features/shell/CommandPalette'
import { createCommandPaletteProviders } from './features/shell/commandPaletteProviders'
import { PALETTE_KEYS } from './features/shell/keymap'
import { WorkspaceRailVNext, type ProjectRailViewItem, type RailMemberPreview } from './features/shell/WorkspaceRailVNext'
import { SurfaceDock, normalizeSurfaceId, type SurfaceId } from './features/shell/SurfaceDock'
import { ProjectionSurface } from './features/surfaces/ProjectionSurfaces'
import { buildReplayInstruction, collectSkillMaterialViewIds, deriveSkillRunSteps, parseWorkflowSkillSteps, projectSkillRunStats, serializeWorkflowSkill, type SkillStepInput, type WorkflowSkillSummary } from './features/workflow/skillLibrary'
import { evaluateRunPermission } from './features/workflow/permissionGate'
import { PermissionConfirmCard } from './features/workflow/PermissionConfirmCard'
import type { ContextHistoryEntry, ContextSurfaceRuntime, DeliverSurfaceRuntime, WorkSurfaceRuntime } from './features/surfaces/surfaceContracts'
import { handoffToProjection } from './features/surfaces/handoffProjection'
import { ImmersiveViewer } from './features/viewer/ImmersiveViewer'
import { resolveArtifactViewerKind } from './features/viewer/artifactViewerRegistry'
import { setOcrClient } from './features/ocr/ocrRuntime'
import { orderProjectRailViews } from './features/shell/workspaceRailOrder'
import { deriveContextGraphAutoNodeIds, mergeContextGraphNodeIds } from './features/context/contextGraphPopulation'
import { materializeProjectEntityNodes, projectEntityNodeIds, semanticRefsForSourceIds } from './features/entities/projectEntityProjection'
import { ARRANGE_SURFACE_DROP_TARGET_ID, CONTEXT_GRAPH_SURFACE_DROP_TARGET_ID, CONTEXT_SURFACE_DROP_TARGET_ID, NEW_SCENE_DROP_TARGET_ID, WORKFLOW_GRAPH_SURFACE_DROP_TARGET_ID, WORKFLOW_SURFACE_DROP_TARGET_ID } from './features/spatial/semanticDrop'
import { ProjectFocusNavigator } from './features/focus/ProjectFocusNavigator'
import { ArtifactLocationOrbit } from './features/focus/ArtifactLocationOrbit'
import { resolveProjectFocusLocations, type ProjectFocusLocation, type ProjectFocusLocationCandidate, type ProjectFocusSearchEntry } from './state/projectFocus'
import type { SpatialFocusRequest } from './features/spatial/useSpatialFocusRequest'
import { subscribeProjectRealtime } from './runtime/projectRealtime'
import { getDesktopPort } from './runtime/desktopPort'
import { esc as escapeTopOverlay } from './features/ui/overlayStack'

const DEFAULT_PROJECT_ID = 'disposable-mvp-sample'

function defaultRailWidth(viewport = typeof window === 'undefined' ? 1440 : window.innerWidth): number {
  if (viewport >= 1600) return 390
  if (viewport >= 1440) return 350
  return 312
}

type ShellLayoutDensity = 'comfortable' | 'compact' | 'constrained'
type ShellLayoutMode = 'desktop' | 'sidecar'

function shellLayoutDensity(viewport: number): ShellLayoutDensity {
  if (viewport >= 1180) return 'comfortable'
  if (viewport >= 760) return 'compact'
  return 'constrained'
}

function shellLayoutMode(width: number, height: number): ShellLayoutMode {
  return width <= 960 && width / Math.max(height, 1) < 1.35 ? 'sidecar' : 'desktop'
}

function shellWorkingCenter(width: number, height: number, mode: ShellLayoutMode, railOpen: boolean, railWidth: number) {
  if (mode === 'sidecar') {
    const sceneHeight = Math.max(320, height - 44)
    const top = 42
    const bottom = 54
    return { x: width / 2, y: top + Math.max(80, sceneHeight - top - bottom) / 2 }
  }
  const left = 56
  const right = railOpen ? railWidth + 20 : 0
  const top = 48
  const bottom = 72
  return { x: left + Math.max(160, width - left - right) / 2, y: top + Math.max(160, height - top - bottom) / 2 }
}

function responsiveRailWidth(viewport: number, compareExpanded: boolean): number {
  if (viewport < 760) return Math.min(320, Math.max(300, viewport - 420))
  if (viewport < 960) return Math.min(344, Math.max(320, viewport * .39))
  if (viewport < 1180) return compareExpanded ? 390 : 360
  if (compareExpanded) return Math.min(520, Math.max(460, viewport * .34))
  if (viewport >= 1600) return 390
  return 370
}


function normalizeRailPreferences(value: WorkRailPreferences): WorkRailPreferences {
  return { ...value, collapsed: true, width: 312 }
}

/** 路径里的项目 ID 可能是百分号编码（中文 ID），安全解码；坏编码原样返回。 */
function safeDecodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function initialPrototype(projectId: string): PersistedPrototypeState {
  const persisted = loadPrototypeState(projectId)
  if (persisted) return persisted
  return createBlankProjectState({ id: projectId, label: projectId, localPath: '', updatedAt: '', pendingCount: 0 }, defaultRailWidth())
}


interface RunExecutionEnvelope {
  readonly receiverRef?: RunReceiverRefV1
  readonly orderedReferences?: readonly OrderedRunReferenceV2[]
  readonly resultSlotId?: string
}

/** 权限门（第一梯队 ⑥）待确认的 Run 请求：card=确认卡内容；args=冻结发起时刻的全部发送入参；resolve=把确认后的 runId（取消时 undefined）还给 await 的调用方。 */
interface PendingPermissionRun {
  readonly card: { readonly title: string; readonly items: readonly string[] }
  readonly args: {
    readonly command: string
    readonly targetIds: string[]
    readonly contextIds: string[]
    readonly intent: RunOutputIntent
    readonly requestedProvider: string
    readonly resultPolicy: ComposerResultPolicy
    readonly proposalSummary?: string
    readonly targetRevisionIdOverride?: string
    readonly sessionIdOverride?: string
    readonly contextArtifactIdsOverride?: readonly string[]
    readonly execution?: RunExecutionEnvelope
  }
  readonly resolve: (runId: string | undefined) => void
}

export function App() {
  const launchSearchParams = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search)
  const agentMode = launchSearchParams?.get('agent') === '1' || launchSearchParams?.get('agent') === 'codex'
  const launchSurface = launchSearchParams?.get('surface') === 'companion' ? 'companion' : launchSearchParams?.get('surface') === 'tap' ? 'tap' : null
  const launchPath = typeof window === 'undefined' ? '' : window.location.pathname
  const pathProjectMatch = /^\/projects\/([^/]+)\/?$/.exec(launchPath)
  const pathIsDrive = launchPath === '/projects' || launchPath === '/projects/'
  const pathIsCapture = launchPath === '/capture' || launchPath === '/capture/'
  // GUI-1：/projects 是 launcher 路由，/projects/:id 直达项目；?project= 保持兼容。
  // 注意：window.location.pathname 对中文 ID 返回百分号编码串（浏览器规范），
  // catalog 里的 ID 是原始中文，必须 decode 一次才能比对；URLSearchParams.get 已自动解码。
  const requestedProjectId = launchSearchParams?.get('project') ?? (pathProjectMatch?.[1] === undefined ? null : safeDecodePathSegment(pathProjectMatch[1])) ?? null
  const initialProjectId = requestedProjectId || DEFAULT_PROJECT_ID
  const initial = useMemo(() => initialPrototype(initialProjectId), [initialProjectId])
  const { nodes, edges, setNodes, setEdges, setGraph, undo, redo, resetGraph } = useCanvasHistory({ nodes: initial.nodes, edges: initial.edges })

  const [projects, setProjects] = useState<ProjectPackage[]>(() => loadProjectCatalog([]))
  const [activeProjectId, setActiveProjectId] = useState(initialProjectId)
  const [capturePendingCount, setCapturePendingCount] = useState(0)
  const [openProjectIds, setOpenProjectIds] = useState<string[]>([initialProjectId])
  const [projectOpen, setProjectOpen] = useState(() => !pathIsDrive && !pathIsCapture)
  const [captureSpaceOpen, setCaptureSpaceOpen] = useState(() => pathIsCapture)
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initial.workspaces)
  const [scopes, setScopes] = useState<CanvasScope[]>(initial.scopes)
  const rootScope = useMemo<CanvasScope>(() => scopes.find((scope) => scope.kind === 'root') ?? scopes[0] ?? {
    id: 'scope-root',
    label: '主画布',
    kind: 'root',
    parentScopeId: null,
    camera: { x: 0, y: 0, zoom: 1 },
    layoutMode: 'manual',
    updatedAt: new Date().toISOString(),
  }, [scopes])
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [scopeId, setScopeId] = useState(initial.scopes.find((scope) => scope.kind === 'root')?.id ?? initial.activeScopeId)
  const [camera, setCamera] = useState<Camera>(() => loadProjectNavigationState(initialProjectId)?.camera ?? initial.scopes.find((scope) => scope.kind === 'root')?.camera ?? { x: 120, y: 72, zoom: 1 })
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [nodeInfoId, setNodeInfoId] = useState<string | null>(null)
  const [shortcutResolution, setShortcutResolution] = useState<{ nodeId: string; resolution: { shortcutPath: string; resolvedTarget: string | null; targetKind: string; targetExists: boolean } } | null>(null)
  const [locatePulseId, setLocatePulseId] = useState<string | null>(null)
  const locatePulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [workbench, setWorkbench] = useState<{ nodeId: string; focus: WorkbenchFocus } | null>(null)
  const [pinnedContextIds, setPinnedContextIds] = useState<string[]>(['brief', 'feedback', 'reference'])
  const [excludedContextIds, setExcludedContextIds] = useState<string[]>([])
  const [manualInference, setManualInference] = useState<TargetContextInference | null>(null)
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null)
  const [resultSlots, setResultSlots] = useState<readonly ResultSlotV0[]>([])
  const [revisionUpgradeOpen, setRevisionUpgradeOpen] = useState(false)
  const [revisionUpgradeBusy, setRevisionUpgradeBusy] = useState(false)
  const [runReviews, setRunReviews] = useState<readonly RunReview[]>([])
  const [executionItems, setExecutionItems] = useState<readonly ExecutionItemV1[]>([])
  const [workflowCheckpoints, setWorkflowCheckpoints] = useState<readonly Checkpoint[]>([])
  const [coreHandoffs, setCoreHandoffs] = useState<readonly HandoffRecord[]>([])
  const [agentSurfaceDetailsOpen, setAgentSurfaceDetailsOpen] = useState(false)
  const pendingReviews = useMemo(() => runReviews.filter((review) =>
    review.presentationPhase === 'review'
    || review.returns.some((item) => item.status === 'pending_review'),
  ), [runReviews])
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [notice, setNotice] = useState('已恢复上次工作现场')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [dataSource, setDataSource] = useState<DataSource>('none')
  const [bootMode, setBootMode] = useState<'loading' | 'runtime' | 'offline'>('loading')
  const [workRail, setWorkRail] = useState<WorkRailPreferences>(() => normalizeRailPreferences(initial.workRail))
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === 'undefined' ? 1440 : window.innerWidth)
  const [viewportHeight, setViewportHeight] = useState(() => typeof window === 'undefined' ? 900 : window.innerHeight)
  const [miniMapCollapsed, setMiniMapCollapsed] = useState(false)
  const [gridSnapEnabled, setGridSnapEnabled] = useState(() => typeof window === 'undefined' ? true : window.localStorage.getItem('lcos.main.grid-snap') !== 'off')
  const [colonies, setColonies] = useState<SpatialColonyDraft[]>(() => initial.colonies ?? (initial.spatialRegions ?? []).flatMap((region) => { const colony = migrateLegacySpatialRegion(region, initial.nodes); return colony ? [colony] : [] }))
  const [globalComposerText, setGlobalComposerText] = useState('')
  const [globalComposerVisible, setGlobalComposerVisible] = useState(false)
  const [globalProvider, setGlobalProvider] = useState('auto')
  const [globalCreateAsNewNode, setGlobalCreateAsNewNode] = useState(false)
  const [globalContextScope, setGlobalContextScope] = useState<'workspace' | 'scope' | 'project'>('workspace')
  const [selectionComposerText, setSelectionComposerText] = useState('')
  const [selectionComposerOpen, setSelectionComposerOpen] = useState(false)
  const [selectionProvider, setSelectionProvider] = useState('auto')
  const [selectionCreateAsNewNode, setSelectionCreateAsNewNode] = useState(false)
  const [selectionBaseRevision, setSelectionBaseRevision] = useState<ArtifactRevisionProvenance | null>(null)
  const [selectionIntent, setSelectionIntent] = useState<RunOutputIntent>('analyze')
  const [selectionResultPolicy, setSelectionResultPolicy] = useState<ComposerResultPolicy>('reply_only')
  const [selectionReferenceIds, setSelectionReferenceIds] = useState<string[]>([])
  const [selectionReceiverId, setSelectionReceiverId] = useState<string | null>(null)
  const [selectionReceiverChoices, setSelectionReceiverChoices] = useState<readonly ConnectedConversationV1[]>([])
  const [selectionReachCount, setSelectionReachCount] = useState(0)
  const [referencePickActive, setReferencePickActive] = useState(false)
  const [activeSurface, setActiveSurface] = useState<SurfaceId>('arrange')
  // Project-level Presentation membership. Context detail and Workflow reference
  // the same Project View identities; physical Scope location never gates use.
  const [activeContextId, setActiveContextId] = useState<string | null>(null)
  // Level 1 Context Graph is its own project-level Presentation. Level 2
  // concrete Contexts each have an exact member set shared by Signal/Mind Map.
  const [contextGraphPresentationIds, setContextGraphPresentationIds] = useState<string[]>([])
  const [contextGraphEntityRefs, setContextGraphEntityRefs] = useState<PresentationEntityRefV0[]>([])
  const [contextPresentationIds, setContextPresentationIds] = useState<string[]>([])
  const [contextPresentationEntityRefs, setContextPresentationEntityRefs] = useState<PresentationEntityRefV0[]>([])
  const [contextMembersById, setContextMembersById] = useState<Record<string, string[]>>({})
  const [contextEntityRefsById, setContextEntityRefsById] = useState<Record<string, PresentationEntityRefV0[]>>({})
  const [collectionMembersById, setCollectionMembersById] = useState<Record<string, string[]>>({})
  const [collectionEntityRefsById, setCollectionEntityRefsById] = useState<Record<string, PresentationEntityRefV0[]>>({})
  const [expandedCollectionScopeIds, setExpandedCollectionScopeIds] = useState<string[]>([])
  const [openingCollectionScopeIds, setOpeningCollectionScopeIds] = useState<string[]>([])
  const [closingCollectionScopeIds, setClosingCollectionScopeIds] = useState<string[]>([])
  const openCollectionWithMotion = useCallback((collectionScopeId: string) => {
    setClosingCollectionScopeIds((current) => current.filter((id) => id !== collectionScopeId))
    setOpeningCollectionScopeIds((current) => current.includes(collectionScopeId) ? current : [...current, collectionScopeId])
    setExpandedCollectionScopeIds((current) => current.includes(collectionScopeId) ? current : [...current, collectionScopeId])
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      setOpeningCollectionScopeIds((current) => current.filter((id) => id !== collectionScopeId))
    }))
  }, [])
  const [workspaceEntityRefsById, setWorkspaceEntityRefsById] = useState<Record<string, PresentationEntityRefV0[]>>({})
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null)
  const [workflowPresentationIds, setWorkflowPresentationIds] = useState<string[]>([])
  const [workflowPresentationEntityRefs, setWorkflowPresentationEntityRefs] = useState<PresentationEntityRefV0[]>([])
  const [workflowMembersById, setWorkflowMembersById] = useState<Record<string, string[]>>({})
  const [workflowEntityRefsById, setWorkflowEntityRefsById] = useState<Record<string, PresentationEntityRefV0[]>>({})
  const [immersiveNodeId, setImmersiveNodeId] = useState<string | null>(null)
  const [immersiveSourceAnchor, setImmersiveSourceAnchor] = useState<string | null>(null)
  const [immersiveRevisionId, setImmersiveRevisionId] = useState<string | null>(null)
  const closeImmersive = useCallback(() => { setImmersiveNodeId(null); setImmersiveSourceAnchor(null); setImmersiveRevisionId(null) }, [])
  const openImmersive = useCallback((nodeId: string, sourceAnchor?: string, revisionId?: string) => { setImmersiveSourceAnchor(sourceAnchor ?? null); setImmersiveRevisionId(revisionId ?? null); setImmersiveNodeId(nodeId) }, [])
  const [runtimeProviders, setRuntimeProviders] = useState<readonly RuntimeProviderStatus[]>([])
  const runtimeProvidersRef = useRef(runtimeProviders)
  runtimeProvidersRef.current = runtimeProviders
  const [runProposal, setRunProposal] = useState<RunProposalResult | null>(null)
  const [workspaceMemberships, setWorkspaceMemberships] = useState<readonly WorkspaceMembership[]>([])
  const [confirmWorkspaceId, setConfirmWorkspaceId] = useState<string | null>(null)
  const [confirmScopeDelete, setConfirmScopeDelete] = useState<{ scopeId: string; label: string } | null>(null)
  const [confirmProjectDelete, setConfirmProjectDelete] = useState<ProjectPackage | null>(null)
  const [workspaceEditor, setWorkspaceEditor] = useState<{ id: string } | null>(null)
  const [renameNodeId, setRenameNodeId] = useState<string | null>(null)
  const [noteEditorId, setNoteEditorId] = useState<string | null>(null)
  /** 投影/本体冲突提示：待确认「复制引用副本」的实体投影节点 id。 */
  const [forkPromptId, setForkPromptId] = useState<string | null>(null)
  /** 本会话内由用户创建的文本实体 origin 视图（双击直接编辑，不触发投影冲突提示）。 */
  const originTextIdsRef = useRef<Set<string>>(new Set())
  const [layoutPreview, setLayoutPreview] = useState<LayoutPreviewItem[] | null>(null)
  const [reorganizeOpen, setReorganizeOpen] = useState(false)
  const [reorganizePendingIds, setReorganizePendingIds] = useState<string[]>([])
  const [layoutPreviewFocusIds, setLayoutPreviewFocusIds] = useState<string[] | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [scopeCreateOpen, setScopeCreateOpen] = useState(false)
  const [projectCreateOpen, setProjectCreateOpen] = useState(false)
  const [projectCreateIntent, setProjectCreateIntent] = useState<'create' | 'open'>('create')
  const [firstArtifactGuideOpen, setFirstArtifactGuideOpen] = useState(false)
  const firstArtifactGuideArmedRef = useRef(false)
  const [composerFocusRequest, setComposerFocusRequest] = useState(0)
  // B6 Continuity：每个项目一个跨 reload 稳定的 LCOS 会话 id。
  // id 本身可丢失（会重新起会话）；Session Truth（绑定/Summary/Handoff）只存在于 Local Core。
  const continuitySessionId = useMemo(() => {
    if (!activeProjectId) return undefined
    try {
      const key = `lcos:continuity-session:${activeProjectId}`
      const existing = window.localStorage.getItem(key)
      if (existing) return existing
      const next = `session-${crypto.randomUUID()}`
      window.localStorage.setItem(key, next)
      return next
    } catch {
      return undefined
    }
  }, [activeProjectId])
  const [presentationCommit, setPresentationCommit] = useState(0)
  const [overviewLayers, setOverviewLayers] = useState<NodeLayer[]>(['core', 'process'])
  // UI 层独立缩放（Ctrl/Cmd+滚轮，0.7–1.6）在 0.1 收口裁定禁用：组件级 zoom 与
  // getBoundingClientRect 坐标系分裂，造成 dock/顶条命中错位与窄视口溢出（P0-C 根因）。
  // 特性留给 0.2 重做（根容器统一缩放或物理坐标布局）。这里钉死 1 并清掉遗留持久值。
  useEffect(() => {
    try {
      window.localStorage.removeItem('lcos:ui-scale')
      document.documentElement.style.setProperty('--lcos-ui-scale', '1')
    } catch { /* 清理失败不影响主流程 */ }
  }, [])
  const [handoffOpen, setHandoffOpen] = useState(false)
  const [handoffLoading, setHandoffLoading] = useState(false)
  const [handoffManifest, setHandoffManifest] = useState<ContextManifestV0 | null>(null)
  const [handoffError, setHandoffError] = useState<string | undefined>()
  const [capabilityOpen, setCapabilityOpen] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [importPanelOpen, setImportPanelOpen] = useState(false)
  const [conversationDialogOpen, setConversationDialogOpen] = useState(false)
  const [conversationSpaceId, setConversationSpaceId] = useState<string | null>(null)
  const [activeReceiverIdentity, setActiveReceiverIdentity] = useState<ActiveReceiverIdentityV1 | null>(null)
  const [controllerTargetSessionId, setControllerTargetSessionId] = useState<string | null>(null)
  const [controllerChoices, setControllerChoices] = useState<readonly ConnectedConversationV1[]>([])
  const [controllerBusy, setControllerBusy] = useState(false)
  const [controllerError, setControllerError] = useState<string | null>(null)
  const [projectToolsMode, setProjectToolsMode] = useState<'search' | 'full' | null>(null)
  const [projectSearchInitialQuery, setProjectSearchInitialQuery] = useState('')
  const [projectFocusOpen, setProjectFocusOpen] = useState(false)
  const [projectFocusSourceIds, setProjectFocusSourceIds] = useState<string[]>([])
  const [projectFocusSourceLabel, setProjectFocusSourceLabel] = useState('')
  const [projectFocusAnchor, setProjectFocusAnchor] = useState<Element | null>(null)
  const [projectFocusListMode, setProjectFocusListMode] = useState(false)
  const [projectFocusRequest, setProjectFocusRequest] = useState<SpatialFocusRequest | undefined>(undefined)
  const [resourceDetailArtifactId, setResourceDetailArtifactId] = useState<string | null>(null)
  const [obsidianScan, setObsidianScan] = useState<ObsidianVaultScanV1 | null>(null)
  const [obsidianBusy, setObsidianBusy] = useState(false)
  const [obsidianError, setObsidianError] = useState<string | null>(null)
  const [activeContextProjection, setActiveContextProjection] = useState<ActiveContextProjection | null>(null)
  const [attentionRuntimeSnapshot, setAttentionRuntimeSnapshot] = useState<AttentionRuntimeSnapshotV0 | null>(null)
  const [, setAttentionRuntimeError] = useState<string | null>(null)
  const [attentionRefreshNonce, setAttentionRefreshNonce] = useState(0)
  const [resumeBoundary, setResumeBoundary] = useState<ContinuityResumeSnapshotV1 | null>(null)
  const [resumeHintDismissed, setResumeHintDismissed] = useState(false)
  const [conversationSessions, setConversationSessions] = useState<readonly ConversationSessionV1[]>([])
  const [activeContextError, setActiveContextError] = useState<string | null>(null)
  const [contextSync, setContextSync] = useState<'syncing' | 'synced' | 'recovering' | 'uncertain' | 'conflict' | 'offline'>('synced')
  const [contextProposals, setContextProposals] = useState<ContextChangeProposalV1[]>([])
  const [pendingCodexCount, setPendingCodexCount] = useState(0)
  const [workspaceStatesOpen, setWorkspaceStatesOpen] = useState(false)
  const [workspaceStatesWorkspaceId, setWorkspaceStatesWorkspaceId] = useState<string | null>(null)
  const [workspaceStates, setWorkspaceStates] = useState<WorkspaceStateSummary[]>([])
  const [workspaceStatesLoading, setWorkspaceStatesLoading] = useState(false)
  const [workspaceStateSaving, setWorkspaceStateSaving] = useState(false)
  const [workspaceStateRestoringId, setWorkspaceStateRestoringId] = useState<string | null>(null)
  const [workspaceStatesError, setWorkspaceStatesError] = useState<string | undefined>()
  const [runEvents, setRunEvents] = useState<readonly RunEvent[]>([])
  const [runEventsError, setRunEventsError] = useState<string | null>(null)
  const [runtimeRecovering, setRuntimeRecovering] = useState(false)

  useEffect(() => {
    setActiveContextId(null)
    setActiveWorkflowId(null)
    setContextGraphPresentationIds([])
    setContextGraphEntityRefs([])
    setContextPresentationIds([])
    setContextPresentationEntityRefs([])
    setContextMembersById({})
    setContextEntityRefsById({})
    setCollectionMembersById({})
    setCollectionEntityRefsById({})
    setExpandedCollectionScopeIds([])
    setOpeningCollectionScopeIds([])
    setClosingCollectionScopeIds([])
    setWorkspaceEntityRefsById({})
    setWorkflowPresentationIds([])
    setWorkflowPresentationEntityRefs([])
    setWorkflowMembersById({})
    setWorkflowEntityRefsById({})
  }, [activeProjectId])

  const objectUrls = useRef<Set<string>>(new Set())
  const clipboardRef = useRef<CanvasClipboardPayload | null>(null)
  const lastCanvasPointRef = useRef<{ x: number; y: number } | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const runCounterRef = useRef(43)
  const projectStateCacheRef = useRef<Map<string, PersistedPrototypeState>>(new Map([[initialProjectId, initial]]))
  const bridgeRef = useRef(new RuntimeBridge(initialProjectId))
  const mainCanvasPresentation = usePresentationViewBridge({
    client: isRuntimeProjectMode(bootMode) ? bridgeRef.current.client : null,
    projectId: activeProjectId,
    scopeId: rootScope.id,
    capability: 'arrange',
    renderer: 'main-canvas',
    seedState: () => ({
      ...emptyPresentationState(),
      colonies,
    }),
  })
  const persistedMainCanvasColonies = mainCanvasPresentation.state?.colonies ?? null
  const persistedLegacySpatialRegions = mainCanvasPresentation.state?.spatialRegions ?? null
  const [mainSurfaceElements, setMainSurfaceElements] = usePresentationSurfaceElements(activeProjectId, rootScope.id, 'arrange')
  useEffect(() => {
    if (!mainCanvasPresentation.ready) return
    if (persistedMainCanvasColonies !== null) { setColonies(persistedMainCanvasColonies); return }
    const legacy = persistedLegacySpatialRegions ?? []
    const migrated = legacy.flatMap((region) => { const colony = migrateLegacySpatialRegion(region, nodes); return colony ? [colony] : [] })
    if (!legacy.length) return
    setColonies(migrated)
    mainCanvasPresentation.patch((state) => ({ ...state, colonies: migrated, spatialRegions: [] }))
    mainCanvasPresentation.flushSoon()
  }, [activeProjectId, mainCanvasPresentation.ready, nodes, persistedLegacySpatialRegions, persistedMainCanvasColonies])
  useEffect(() => {
    setOcrClient(isRuntimeProjectMode(bootMode) ? bridgeRef.current.client : null)
  }, [bootMode])
  const presentationInteractionRef = useRef(false)
  const cameraRef = useRef(camera)
  const activeProjectIdRef = useRef(activeProjectId)
  const restoredRunProjectRef = useRef<string | null>(null)
  const runtimeSyncBusyRef = useRef(false)
  const draftHydratedKeyRef = useRef<string | null>(null)
  const activeContextHydratedKeyRef = useRef<string | null>(null)
  const activeContextVersionRef = useRef(0)
  const activeContextVersionsRef = useRef(new Map<string, number>())
  // ActiveContext 写入串行队列：多次快速变化时后一次写永远基于前一次已确认的版本，
  // 消除 debounce 并发导致的 ACTIVE_CONTEXT_CONFLICT 409 风暴。
  const activeContextWriteQueuesRef = useRef(new Map<string, Promise<void>>())
  const selectionIntentVersionRef = useRef(0)
  const selectionContextIntentRef = useRef({ key: '', touched: false })
  const restoredDraftContextIdsRef = useRef<string[]>([])
  const runEventSequenceRef = useRef<number | undefined>(undefined)
  const workbenchEntryFitRef = useRef<{ scopeId: string; enteredAt: number; nodeKey: string }>({ scopeId: '', enteredAt: 0, nodeKey: '' })

  const selectionContextKey = `${activeProjectId}::${workspaceId ?? '__project_overview__'}`
  if (selectionContextIntentRef.current.key !== selectionContextKey) {
    selectionContextIntentRef.current = { key: selectionContextKey, touched: false }
  }

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? { id: activeProjectId, label: activeProjectId, localPath: '', updatedAt: '', pendingCount: 0 }
  const activeWorkspace = workspaceId ? workspaces.find((workspace) => workspace.id === workspaceId) ?? null : null
  const activeScope = scopes.find((scope) => scope.id === scopeId) ?? scopes[0]
  const overviewWorkspace = useMemo<Workspace>(() => ({
    id: 'project-overview',
    label: '项目总览',
    intent: null,
    scopeId: activeScope.id,
    camera: { x: 0, y: 0, zoom: 1 },
    visibleLayers: overviewLayers,
    focusedViewIds: [],
    contextPolicy: 'workspace-related',
    createdAt: 'local-ui',
    updatedAt: 'local-ui',
  }), [activeScope.id, overviewLayers])
  const effectiveWorkspace = activeWorkspace ?? overviewWorkspace
  // Position changes are high-frequency. Context membership identity depends on
  // stable Project View identity fields, not x/y, so do not re-read every saved
  // Context from Core while the user merely drags nodes around.
  const projectNodeIdentityKey = useMemo(() => nodes
    .map((node) => `${node.id}:${node.scopeId ?? rootScope.id}:${node.artifactId ?? ''}:${node.viewOf ?? ''}`)
    .sort()
    .join('|'), [nodes, rootScope.id])
  const canonicalizeContextMemberIds = useCallback((contextId: string, ids: readonly string[]) => {
    const keyFor = (node: CanvasNode) => node.artifactId ?? node.viewOf ?? node.id
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const representatives = new Map<string, CanvasNode>()
    nodes.forEach((node) => {
      if ((node.scopeId ?? rootScope.id) === contextId) return
      const key = keyFor(node)
      const current = representatives.get(key)
      if (!current || (node.scopeId ?? rootScope.id) === rootScope.id) representatives.set(key, node)
    })
    return Array.from(new Set(ids.map((id) => {
      const node = byId.get(id)
      if (!node || (node.scopeId ?? rootScope.id) !== contextId) return id
      return representatives.get(keyFor(node))?.id ?? id
    })))
  }, [projectNodeIdentityKey, rootScope.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const contextPresentationOwnerId = activeContextId ?? rootScope.id
  const normalizeActiveContextMembers = useCallback((ids: readonly string[]) => activeContextId
    ? canonicalizeContextMemberIds(activeContextId, ids)
    : [...ids], [activeContextId, canonicalizeContextMemberIds])
  // Level 1: Context Graph is a project-level Presentation over Project Views.
  // Dropping onto the bottom Context capability adds here; it does not guess a
  // concrete Context and does not create a physical child copy.
  usePresentationMembership({
    projectId: activeProjectId,
    scopeId: rootScope.id,
    capability: 'context',
    renderer: 'context-graph',
    client: isRuntimeProjectMode(bootMode) ? bridgeRef.current.client : null,
    members: contextGraphPresentationIds,
    setMembers: setContextGraphPresentationIds,
    entityRefs: contextGraphEntityRefs,
    setEntityRefs: setContextGraphEntityRefs,
    seedMembers: () => scopes
      .filter((scope) => scope.kind === 'context')
      .map((scope) => scope.containerNodeId ?? nodes.find((node) => node.opensScopeId === scope.id)?.id)
      .filter((id): id is string => Boolean(id)),
  })
  // One concrete Context: Understanding Space / Structure / Evolution consume the same
  // exact set. The physical compatibility Scope is identity only, never a gate.
  usePresentationMembership({
    projectId: activeProjectId,
    scopeId: contextPresentationOwnerId,
    capability: 'context',
    renderer: 'context',
    client: activeContextId && isRuntimeProjectMode(bootMode) ? bridgeRef.current.client : null,
    members: contextPresentationIds,
    setMembers: (ids) => {
      setContextPresentationIds(ids)
      if (activeContextId) setContextMembersById((current) => ({ ...current, [activeContextId]: ids }))
    },
    entityRefs: contextPresentationEntityRefs,
    setEntityRefs: (refs) => {
      setContextPresentationEntityRefs(refs)
      if (activeContextId) setContextEntityRefsById((current) => ({ ...current, [activeContextId]: refs }))
    },
    // Legacy Context scopes may contain cloned Views. They seed the exact
    // Presentation once, then stop being membership truth.
    seedMembers: () => activeContextId
      ? canonicalizeContextMemberIds(activeContextId, nodes.filter((node) => (node.scopeId ?? rootScope.id) === activeContextId).map((node) => node.id))
      : [],
    normalizeMembers: normalizeActiveContextMembers,
  })
  const workflowPresentationOwnerId = activeWorkflowId ?? rootScope.id
  usePresentationMembership({
    projectId: activeProjectId,
    scopeId: workflowPresentationOwnerId,
    capability: 'workflow',
    renderer: 'workflow',
    client: isRuntimeProjectMode(bootMode) ? bridgeRef.current.client : null,
    members: workflowPresentationIds,
    setMembers: (ids) => {
      setWorkflowPresentationIds(ids)
      if (activeWorkflowId) setWorkflowMembersById((current) => ({ ...current, [activeWorkflowId]: ids }))
    },
    entityRefs: workflowPresentationEntityRefs,
    setEntityRefs: (refs) => {
      setWorkflowPresentationEntityRefs(refs)
      if (activeWorkflowId) setWorkflowEntityRefsById((current) => ({ ...current, [activeWorkflowId]: refs }))
    },
    // Root Workflow is legacy compatibility only. New Workflow entities own
    // their own exact project-wide Presentation membership.
    seedMembers: () => activeWorkflowId
      ? []
      : Array.from(new Set(workspaces
        .filter((workspace) => normalizeSurfaceId(workspace.preferredSurface) === 'workflow')
        .flatMap((workspace) => workspace.focusedViewIds)))
        .filter((id) => nodes.some((node) => node.id === id)),
  })
  // Phase C: preload layout engines in the background so the first 整理 click
  // does not pay for the ELK/fCoSE bundle import.
  useEffect(() => {
    if (!isRuntimeProjectMode(bootMode)) return
    void loadPresentationLayoutEngines().catch(() => { /* builtin fallback stays available */ })
  }, [bootMode])
  const selectedNodes = selectedIds.map((id) => nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
  const selectedId = selectedIds.at(-1) ?? null
  const singleSelectedNode = selectedIds.length === 1 ? selectedNodes[0] ?? null : null
  const nodeInfoNode = nodeInfoId ? nodes.find((node) => node.id === nodeInfoId) ?? null : null
  const workbenchNode = workbench ? nodes.find((node) => node.id === workbench.nodeId) ?? null : null
  const workbenchRelationCount = useMemo(() => workbenchNode ? edges.filter((edge) => edge.from === workbenchNode.id || edge.to === workbenchNode.id).length : 0, [edges, workbenchNode])
  const visibleLayers: NodeLayer[] = activeWorkspace ? (activeWorkspace.visibleLayers.length ? activeWorkspace.visibleLayers : ['core', 'process']) : overviewLayers
  const scopeNodes = useMemo(() => nodes.filter((node) => (node.scopeId ?? 'scope-root') === scopeId), [nodes, scopeId])
  const scopeWorkspaces = useMemo(() => workspaces.filter((workspace) => workspace.scopeId === scopeId), [scopeId, workspaces])
  const collapsedCollectionMemberIds = useMemo(() => {
    const hidden = new Set<string>()
    const expanded = new Set(expandedCollectionScopeIds)
    for (const collection of scopes.filter((item) => item.kind === 'collection')) {
      const container = collection.containerNodeId ? nodes.find((node) => node.id === collection.containerNodeId) : nodes.find((node) => node.opensScopeId === collection.id)
      const presentationScopeId = container?.scopeId ?? collection.parentScopeId ?? rootScope.id
      if (presentationScopeId !== scopeId || expanded.has(collection.id)) continue
      for (const memberId of collectionMembersById[collection.id] ?? []) hidden.add(memberId)
    }
    return hidden
  }, [collectionMembersById, expandedCollectionScopeIds, nodes, rootScope.id, scopeId, scopes])
  const visibleNodes = useMemo(() => scopeNodes.filter((node) => visibleLayers.includes(nodeMeta[node.kind].layer) && !collapsedCollectionMemberIds.has(node.id)), [collapsedCollectionMemberIds, scopeNodes, visibleLayers])
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes])
  const visibleEdges = useMemo(() => edges.filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)), [edges, visibleNodeIds])
  const [coreContextSnapshots, setCoreContextSnapshots] = useState<readonly Checkpoint[]>([])
  useEffect(() => {
    let cancelled = false
    const projectId = activeProjectId
    if (!projectId) return
    bridgeRef.current.client.listContextSnapshots(projectId, workspaceId)
      .then((call) => { if (!cancelled) setCoreContextSnapshots(call.result.ok ? call.result.value : []) })
      .catch(() => { if (!cancelled) setCoreContextSnapshots([]) })
    return () => { cancelled = true }
  }, [activeProjectId, workspaceId])
  const workspaceFrames = useMemo(() => buildWorkspaceFrames(workspaces, scopeNodes, workspaceId, scopeId), [scopeId, scopeNodes, workspaceId, workspaces])
  // Workspace frames are overview affordances. Showing the active Workspace's own
  // bounding box inside its Scene creates a giant "virtual child canvas" and was
  // the source of the 0-items/17-items confusion in A closeout QA.
  // Round-1 human QA: Scene is a child-canvas entity, not a giant frame on its parent canvas.
  // Parent Main renders a compact Workspace projection; Region/Fence owns visible spatial grouping.
  const visibleWorkspaceFrames = useMemo(() => [], [])
  const workspaceMemberViewIdsById = useMemo<Record<string, string[]>>(() => {
    const result: Record<string, Set<string>> = Object.fromEntries(workspaces.map((workspace) => [workspace.id, new Set(workspace.focusedViewIds)]))
    for (const membership of workspaceMemberships) {
      const id = String(membership.workspaceId)
      if (!result[id]) result[id] = new Set<string>()
      result[id]!.add(String(membership.artifactViewId))
    }
    for (const node of nodes) for (const id of node.workspaceIds ?? []) {
      if (!result[id]) result[id] = new Set<string>()
      result[id]!.add(node.id)
    }
    return Object.fromEntries(Object.entries(result).map(([id, members]) => [id, [...members]]))
  }, [nodes, workspaceMemberships, workspaces])
  const relationNodes = useMemo(() => selectedId ? edges.filter((edge) => edge.from === selectedId || edge.to === selectedId).map((edge) => nodes.find((node) => node.id === (edge.from === selectedId ? edge.to : edge.from))).filter((node): node is CanvasNode => Boolean(node)) : [], [edges, nodes, selectedId])
  const nodeInfoRelationCount = useMemo(() => nodeInfoId ? edges.filter((edge) => edge.from === nodeInfoId || edge.to === nodeInfoId).length : 0, [edges, nodeInfoId])
  useEffect(() => {
    if (!nodeInfoNode || bootMode !== 'runtime') return
    const looksLikeShortcut = nodeInfoNode.title.toLocaleLowerCase('en-US').endsWith('.lnk')
      || Boolean(nodeInfoNode.observedPath?.toLocaleLowerCase('en-US').endsWith('.lnk'))
    if (!looksLikeShortcut || !nodeInfoNode.artifactId) {
      setShortcutResolution(null)
      return
    }
    let cancelled = false
    void bridgeRef.current.client.resolveArtifactShortcut(nodeInfoNode.artifactId).then((call) => {
      if (!cancelled) setShortcutResolution(call.result.ok ? { nodeId: nodeInfoNode.id, resolution: call.result.value } : null)
    })
    return () => { cancelled = true }
  }, [bootMode, nodeInfoNode])
  const defaultSelectionContextIds = useMemo(() => selectedIds.length !== 1
    ? [...selectedIds]
    : Array.from(new Set([selectedIds[0], ...relationNodes.map((node) => node.id)])), [relationNodes, selectedIds])
  const selectionContextIds = useMemo(() => (selectedIds.length > 1
    ? [...defaultSelectionContextIds]
    : Array.from(new Set([...defaultSelectionContextIds, ...pinnedContextIds])))
    .filter((id) => !excludedContextIds.includes(id)), [defaultSelectionContextIds, excludedContextIds, pinnedContextIds, selectedIds.length])
  const globalContextIds = useMemo(() => {
    if (globalContextScope === 'project') return nodes.map((node) => node.id)
    if (globalContextScope === 'scope') return scopeNodes.map((node) => node.id)
    if (activeWorkspace) return nodes.filter((node) => node.workspaceIds?.includes(activeWorkspace.id)).map((node) => node.id)
    return scopeNodes.map((node) => node.id)
  }, [activeWorkspace, globalContextScope, nodes, scopeNodes])
  const globalContextLabel = globalContextScope === 'project'
    ? '整个项目'
    : globalContextScope === 'scope'
      ? `Scope「${activeScope.label}」`
      : activeWorkspace ? `Workspace「${activeWorkspace.label}」` : `Scope「${activeScope.label}」`
  useEffect(() => {
    if (bootMode !== 'runtime' || !activeProjectId) { setSelectionReceiverChoices([]); return }
    const controller = new AbortController()
    void bridgeRef.current.client.listConnectedConversations(activeProjectId, controller.signal).then((call) => {
      if (!controller.signal.aborted) setSelectionReceiverChoices(call.result.ok ? call.result.value : [])
    }).catch(() => { if (!controller.signal.aborted) setSelectionReceiverChoices([]) })
    return () => controller.abort()
  }, [activeProjectId, bootMode])

  const selectionEditableNodes = useMemo(() => selectedNodes.filter((node) => node.managed === true && node.artifactId && node.revisionId), [selectedNodes])
  const selectionResultSlotNodes = useMemo(() => selectedNodes.filter((node) => node.resultSlotId && node.resultSlotStatus !== 'materialized'), [selectedNodes])
  const selectionResultSlotNode = selectionResultSlotNodes.length === 1 ? selectionResultSlotNodes[0] ?? null : null
  const selectionTargetNode = !selectionCreateAsNewNode && selectionResultSlotNode === null && selectionEditableNodes.length === 1 ? selectionEditableNodes[0] ?? null : null
  const defaultSelectionReceiver = useMemo(() => resolveComposerReceiver(selectedNodes, selectionReceiverChoices, activeReceiverIdentity?.activeReceiverId ?? null), [activeReceiverIdentity?.activeReceiverId, selectedNodes, selectionReceiverChoices])
  const effectiveSelectionReceiverId = selectionReceiverId ?? defaultSelectionReceiver.receiver?.connectedConversationId ?? null
  const sharedCommandSurfaceKind: 'main' | 'context' | 'workflow' | 'conversation' = conversationSpaceId
    ? 'conversation'
    : activeSurface === 'context-space' || activeSurface === 'context-flow' || activeSurface === 'context-tree' || activeSurface === 'context-graph'
      ? 'context'
      : activeSurface === 'workflow'
        ? 'workflow'
        : 'main'
  const sharedCommandSurfaceId = conversationSpaceId
    ?? (sharedCommandSurfaceKind === 'context' ? activeContextId : null)
    ?? (sharedCommandSurfaceKind === 'workflow' ? activeWorkflowId : null)
    ?? workspaceId
    ?? scopeId
  const selectionExecutionReferenceIds = useMemo(
    () => mergeExecutionReferenceIds(selectedIds, selectionReferenceIds, selectionTargetNode?.id),
    [selectedIds, selectionReferenceIds, selectionTargetNode?.id],
  )
  const selectionReferenceCandidates = useMemo(() => referenceCandidates(selectionExecutionReferenceIds, nodes, effectiveSelectionReceiverId, selectionReceiverChoices), [effectiveSelectionReceiverId, nodes, selectionExecutionReferenceIds, selectionReceiverChoices])
  const selectionOrderedReferences = useMemo(() => selectionReferenceCandidates.flatMap((candidate) => candidate.orderedReference ? [candidate.orderedReference] : []), [selectionReferenceCandidates])
  const selectionExecutionBlockedReason = useMemo(() => {
    if (bootMode !== 'runtime') return undefined
    if (selectionResultSlotNodes.length > 1) return '一次处理只能写入一个空白结果，请只保留一个结果位。'
    const proposalGap = proposalCompatibilityBlockReason({
      receiverId: effectiveSelectionReceiverId,
      activeReceiverId: activeReceiverIdentity?.activeReceiverId ?? null,
      receivers: selectionReceiverChoices,
      references: selectionReferenceCandidates,
    })
    if (proposalGap) return proposalGap
    return undefined
  }, [activeReceiverIdentity?.activeReceiverId, bootMode, effectiveSelectionReceiverId, selectionReceiverChoices, selectionReferenceCandidates, selectionResultSlotNodes.length])
  const runBusy = Boolean(activeRun && ['queued', 'running'].includes(activeRun.status))
  useEffect(() => {
    if (!selectionComposerOpen || bootMode !== 'runtime' || !effectiveSelectionReceiverId) { setSelectionReachCount(0); return }
    const controller = new AbortController()
    void bridgeRef.current.client.conversationReach(activeProjectId, effectiveSelectionReceiverId, controller.signal).then((call) => {
      if (!controller.signal.aborted) setSelectionReachCount(call.result.ok ? call.result.value.items.length : 0)
    }).catch(() => { if (!controller.signal.aborted) setSelectionReachCount(0) })
    return () => controller.abort()
  }, [activeProjectId, bootMode, effectiveSelectionReceiverId, selectionComposerOpen])

  const capabilities = useMemo(() => capabilitiesFor(dataSource), [dataSource])
  const attentionBucketsByViewId = useMemo<Readonly<Record<string, AttentionBucketV0>>>(() => {
    const snapshot = attentionRuntimeSnapshot
    if (!snapshot) return {}
    const rank: Record<AttentionBucketV0, number> = { selected: 4, pinned: 3, related: 2, retrieved: 1 }
    const result: Record<string, AttentionBucketV0> = {}
    for (const bucket of ['retrieved', 'related', 'pinned', 'selected'] as const) {
      for (const item of snapshot.attention[bucket]) {
        const previous = result[item.viewId]
        if (!previous || rank[bucket] > rank[previous]) result[item.viewId] = bucket
      }
    }
    return result
  }, [attentionRuntimeSnapshot])


  // B-stage convergence: hints summarize evidence that already exists. They are
  // presentation-only and never create Context / Workflow by themselves.
  const contextDepositCandidates = useMemo<readonly DepositHintItem[]>(() => {
    const items: DepositHintItem[] = []
    const seen = new Set<string>()
    const add = (item: DepositHintItem) => {
      if (!item.label.trim() || seen.has(item.id)) return
      seen.add(item.id)
      items.push(item)
    }
    for (const change of [...(activeContextProjection?.recentChanges ?? [])].filter((item) => item.kind !== 'viewport').slice(-5).reverse()) {
      add({ id: `change:${change.version}:${change.kind}`, label: change.summary, source: '最近项目变化' })
    }
    for (const review of pendingReviews.slice(0, 3)) {
      add({ id: `review:${String(review.run.id)}`, label: review.run.instruction || 'Agent 返回结果', source: 'Agent 返回' })
    }
    for (const session of [...conversationSessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3)) {
      add({ id: `evidence-conversation-session:${session.id}:${session.updatedAt}`, label: session.title, source: `${session.provider || 'Chat'} 对话` })
    }
    for (const handoff of [...coreHandoffs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3)) {
      add({ id: `handoff:${handoff.id}`, label: handoff.title, source: 'Agent 交接' })
    }
    for (const evidence of [...(attentionRuntimeSnapshot?.attention.retrieved ?? []), ...(attentionRuntimeSnapshot?.attention.related ?? [])].slice(0, 4)) {
      add({ id: `attention:${evidence.key}`, label: evidence.title, source: evidence.source === 'semantic_retrieval' ? 'AI 补充关联' : '项目关联' })
    }
    return items.slice(0, 8)
  }, [activeContextProjection?.recentChanges, attentionRuntimeSnapshot, conversationSessions, coreHandoffs, pendingReviews])

  const workflowDepositCandidates = useMemo<readonly DepositHintItem[]>(() => {
    const items: DepositHintItem[] = []
    const seen = new Set<string>()
    const add = (item: DepositHintItem) => {
      if (!item.label.trim() || seen.has(item.id)) return
      seen.add(item.id)
      items.push(item)
    }
    for (const review of runReviews.slice(0, 5)) {
      add({ id: `run:${String(review.run.id)}`, label: review.run.instruction || '一次 Agent 执行', source: `执行 · ${review.presentationPhase}` })
    }
    for (const session of [...conversationSessions].filter((item) => item.messageCount >= 4).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3)) {
      add({ id: `method-evidence-conversation-session:${session.id}:${session.updatedAt}`, label: session.title, source: `${session.messageCount} 条对话记录` })
    }
    for (const change of [...(activeContextProjection?.recentChanges ?? [])].filter((item) => ['intent', 'harness', 'target'].includes(item.kind)).slice(-4).reverse()) {
      add({ id: `method-change:${change.version}:${change.kind}`, label: change.summary, source: '方法线索' })
    }
    // A workflow hint needs repeated/method-like evidence. One isolated event is
    // not enough to justify teaching the user a process.
    return items.length >= 2 ? items.slice(0, 8) : []
  }, [activeContextProjection?.recentChanges, conversationSessions, runReviews])

  const contextDepositEvidenceKey = useMemo(() => contextDepositCandidates.map((item) => item.id).join('|'), [contextDepositCandidates])
  const workflowDepositEvidenceKey = useMemo(() => workflowDepositCandidates.map((item) => item.id).join('|'), [workflowDepositCandidates])
  const contextDepositReflection = attentionRuntimeSnapshot?.intent.goal
    ? `最近材料正在围绕「${attentionRuntimeSnapshot.intent.goal}」收敛。`
    : contextDepositCandidates.length > 2 ? '最近已经积累了一批新的项目证据，可以看看哪些值得长期保留。' : undefined
  const workflowDepositReflection = workflowDepositCandidates.length >= 2
    ? `最近已有 ${workflowDepositCandidates.length} 段执行 / 对话线索，可以看看有没有重复方法。`
    : undefined

  const baseInference = useMemo(() => inferTargetContext(nodes, selectedIds, effectiveWorkspace, scopeId, pinnedContextIds), [effectiveWorkspace, nodes, pinnedContextIds, scopeId, selectedIds])
  const inference = useMemo(() => {
    const current = manualInference ?? baseInference
    return { ...current, contextIds: current.contextIds.filter((id) => !excludedContextIds.includes(id)) }
  }, [baseInference, excludedContextIds, manualInference])
  const pendingNode = activeRun?.pendingArtifactId ? nodes.find((node) => node.id === activeRun.pendingArtifactId) ?? null : null
  const revisionUpgradeTargetNode = activeRun?.resultNodeId
    ? nodes.find((node) => node.id === activeRun.resultNodeId) ?? null
    : activeRun?.resultArtifactId
      ? nodes.find((node) => node.artifactId === activeRun.resultArtifactId && (!activeRun.resultRevisionId || node.revisionId === activeRun.resultRevisionId)) ?? null
      : pendingNode
  const compareExpanded = activeRun?.status === 'review' && Boolean(pendingNode)
  const layoutDensity = shellLayoutDensity(viewportWidth)
  const responsiveLayoutMode = shellLayoutMode(viewportWidth, viewportHeight)
  const layoutMode: ShellLayoutMode = launchSurface === 'companion' ? 'sidecar' : launchSurface === 'tap' ? 'desktop' : responsiveLayoutMode
  const effectiveRailWidth = workRail.collapsed ? 48 : responsiveRailWidth(viewportWidth, compareExpanded)
  const sceneStyle = useMemo(() => ({
    '--work-rail-width': `${effectiveRailWidth}px`,
  } as CSSProperties), [effectiveRailWidth])
  const safeInsets = useMemo(() => ({
    left: layoutMode === 'sidecar' ? 18 : 76,
    right: layoutMode === 'sidecar' ? 18 : 28,
    top: layoutMode === 'sidecar' ? 46 : 24,
    bottom: layoutMode === 'sidecar' ? 60 : 72,
  }), [layoutMode])
  useEffect(() => {
    const preventBrowserZoom = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      const target = event.target as HTMLElement | null
      if (!target?.closest?.('[data-testid="creative-os-app"]')) return
      event.preventDefault()
    }
    window.addEventListener('wheel', preventBrowserZoom, { capture: true, passive: false })
    return () => window.removeEventListener('wheel', preventBrowserZoom, { capture: true })
  }, [])

  useEffect(() => { try { window.localStorage.setItem('lcos.main.grid-snap', gridSnapEnabled ? 'on' : 'off') } catch { /* local preference only */ } }, [gridSnapEnabled])
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 2600); return () => window.clearTimeout(timer) }, [notice])
  useEffect(() => {
    const onPresentationPersistence = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message
      if (message) setNotice(message)
    }
    window.addEventListener('lcos:presentation-persistence', onPresentationPersistence)
    return () => window.removeEventListener('lcos:presentation-persistence', onPresentationPersistence)
  }, [])
  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrls.current.clear()
  }, [])
  useEffect(() => {
    setManualInference(null)
  }, [scopeId, selectedIds.join(',')])
  useEffect(() => {
    setRunProposal(null)
    setSelectionBaseRevision(null)
  }, [selectedIds.join(','), scopeId, selectionCreateAsNewNode])
  useEffect(() => {
    if (!singleSelectedNode?.revisionId) return
    const fallback: ArtifactRevisionProvenance | null = (singleSelectedNode.sourceRunId || singleSelectedNode.sourcePrompt || singleSelectedNode.sourceProvider)
      ? {
          id: singleSelectedNode.revisionId,
          label: singleSelectedNode.revisionLabel ?? (singleSelectedNode.current ? 'Current' : 'Revision'),
          createdAt: singleSelectedNode.createdAt,
          runId: singleSelectedNode.sourceRunId,
          prompt: singleSelectedNode.sourcePrompt,
          provider: singleSelectedNode.sourceProvider,
          current: Boolean(singleSelectedNode.current),
          draft: Boolean(singleSelectedNode.draft),
        }
      : null
    if (fallback) {
      setSelectionBaseRevision(fallback)
      if (fallback.prompt) setSelectionComposerText((current) => current || fallback.prompt || '')
    }
    if (bootMode !== 'runtime' || !singleSelectedNode.artifactId) return
    const controller = new AbortController()
    void Promise.all([
      bridgeRef.current.client.artifactDetail(singleSelectedNode.artifactId, controller.signal),
      bridgeRef.current.client.revisionList(singleSelectedNode.artifactId, controller.signal),
    ]).then(([detailCall, listCall]) => {
      if (controller.signal.aborted || (!detailCall.result.ok && !listCall.result.ok)) return
      const revisions = parseArtifactRevisions(
        detailCall.result.ok ? detailCall.result.value : undefined,
        listCall.result.ok ? listCall.result.value : undefined,
        singleSelectedNode.revisionId,
      )
      const revision = revisions.find((item) => item.id === singleSelectedNode.revisionId)
      if (!revision) return
      setSelectionBaseRevision(revision)
      if (revision.prompt) setSelectionComposerText((current) => current || revision.prompt || '')
      if (revision.provider && runtimeProvidersRef.current.some((provider) => provider.provider === revision.provider && provider.availability !== 'offline')) setSelectionProvider(revision.provider)
    })
    return () => controller.abort()
  }, [bootMode, singleSelectedNode?.artifactId, singleSelectedNode?.id, singleSelectedNode?.revisionId])
  useEffect(() => { setRunProposal(null) }, [selectionBaseRevision?.id, selectionComposerText, selectionProvider, selectionCreateAsNewNode])

  useEffect(() => {
    if (bootMode !== 'runtime') return
    const key = `${activeProjectId}::${workspaceId ?? '__project_overview__'}`
    activeContextHydratedKeyRef.current = null
    activeContextVersionRef.current = 0
    activeContextVersionsRef.current.set(key, 0)
    restoredDraftContextIdsRef.current = []
    const controller = new AbortController()
    const selectionVersionAtRequest = selectionIntentVersionRef.current
    void bridgeRef.current.client.activeContext(activeProjectId, workspaceId, undefined, controller.signal).then((call) => {
      if (controller.signal.aborted) return
      if (!call.result.ok) {
        setActiveContextError(call.result.error.message)
        activeContextHydratedKeyRef.current = key
        return
      }
      const value = call.result.value
      setActiveContextProjection(value)
      activeContextVersionRef.current = value.version
      activeContextVersionsRef.current.set(key, value.version)
      setPinnedContextIds(Array.from(new Set([...value.pinnedContextIds, ...restoredDraftContextIdsRef.current])))
      setExcludedContextIds([...value.excludedContextIds])
      if (value.scopeId === scopeId
        && selectionIntentVersionRef.current === selectionVersionAtRequest
        && !selectionContextIntentRef.current.touched) {
        setSelectedIds([...value.selectedViewIds])
      }
      // ActiveContext 的相机属于返回值声明的 Scope。进入 Workbench / Collection
      // 时仍会查询 Project overview，但绝不能让 root viewport 覆盖新 Scope 相机。
      if (value.viewport && value.scopeId === scopeId) {
        const candidate = { x: value.viewport.x, y: value.viewport.y, zoom: value.viewport.zoom }
        const contentNodes = (value.nodes ?? []).filter((node) => node.kind !== 'process')
        if (restoredCameraIsMeaningful(candidate, contentNodes, window.innerWidth, window.innerHeight)) {
          // 恢复的相机虽然内容占比达标，但顶部可能被 header 遮挡：
          // 内容顶边屏幕位置 < safeInsets.top 时下移相机进入安全区。
          const top = contentNodes.reduce((acc, node) => Math.min(acc, node.y), Number.POSITIVE_INFINITY)
          const screenTop = candidate.y + top * candidate.zoom
          if (Number.isFinite(screenTop) && screenTop < safeInsets.top) {
            setCamera({ ...candidate, y: candidate.y + (safeInsets.top - screenTop) })
          } else {
            setCamera(candidate)
          }
        } else if (contentNodes.length > 0) {
          // 恢复的相机已失效（节点全在视口外）：按节点包围盒重新适配，避免打开项目看到空画布。
          const bounds = restorationFocusBounds(contentNodes)
          if (!bounds) return
          setCamera(fitBoundsForReading(
            bounds,
            window.innerWidth,
            window.innerHeight,
            74,
            safeInsets,
          ))
        }
      }
      setActiveContextError(null)
      setContextSync('synced')
      activeContextHydratedKeyRef.current = key
    })
    return () => controller.abort()
  }, [activeProjectId, bootMode, safeInsets, scopeId, workspaceId])

  useEffect(() => {
    if (bootMode !== 'runtime') return
    const key = `${activeProjectId}::${workspaceId ?? '__project_overview__'}`
    draftHydratedKeyRef.current = null
    const controller = new AbortController()
    void Promise.all([
      bridgeRef.current.client.getCommandDraft(activeProjectId, workspaceId, 'selection', controller.signal),
      bridgeRef.current.client.getCommandDraft(activeProjectId, workspaceId, 'global', controller.signal),
    ]).then(([selectionCall, globalCall]) => {
      if (controller.signal.aborted) return
      if (selectionCall.result.ok && selectionCall.result.value) {
        const draft = selectionCall.result.value
        setSelectionComposerText(draft.prompt)
        setSelectionProvider(draft.provider)
        setSelectionCreateAsNewNode(draft.createAsNewNode)
        setSelectionReceiverId(draft.receiverId)
        setSelectionIntent(draft.intent)
        setSelectionResultPolicy(draft.resultPolicy)
        restoredDraftContextIdsRef.current = [...draft.contextViewIds]
        setSelectionReferenceIds([...draft.contextViewIds])
      }
      if (globalCall.result.ok && globalCall.result.value) {
        setGlobalComposerText(globalCall.result.value.prompt)
        setGlobalProvider(globalCall.result.value.provider)
        setGlobalCreateAsNewNode(globalCall.result.value.createAsNewNode)
      }
      draftHydratedKeyRef.current = key
    })
    return () => controller.abort()
  }, [activeProjectId, bootMode, workspaceId])

  useEffect(() => {
    if (bootMode !== 'runtime') return
    const key = `${activeProjectId}::${workspaceId ?? '__project_overview__'}`
    if (draftHydratedKeyRef.current !== key) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      const hasSharedCommandState = Boolean(selectionComposerText.trim() || selectionReferenceIds.length || selectedIds.length || selectionReceiverId)
      if (!hasSharedCommandState) {
        void bridgeRef.current.client.deleteCommandDraft(activeProjectId, workspaceId, 'selection', controller.signal)
        return
      }
      void bridgeRef.current.client.saveCommandDraft(activeProjectId, workspaceId, 'selection', {
        surfaceKind: sharedCommandSurfaceKind,
        surfaceId: sharedCommandSurfaceId,
        prompt: selectionComposerText,
        contextViewIds: selectionReferenceIds,
        selectionViewIds: selectedIds,
        receiverId: effectiveSelectionReceiverId,
        provider: selectionProvider,
        createAsNewNode: selectionCreateAsNewNode,
        intent: selectionIntent,
        resultPolicy: selectionResultPolicy,
      }, controller.signal)
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [activeProjectId, bootMode, effectiveSelectionReceiverId, selectedIds, selectionComposerText, selectionCreateAsNewNode, selectionIntent, selectionProvider, selectionReceiverId, selectionReferenceIds, selectionResultPolicy, sharedCommandSurfaceId, sharedCommandSurfaceKind, workspaceId])

  useEffect(() => {
    if (bootMode !== 'runtime') return
    const key = `${activeProjectId}::${workspaceId ?? '__project_overview__'}`
    if (draftHydratedKeyRef.current !== key) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      if (!globalComposerText.trim()) {
        void bridgeRef.current.client.deleteCommandDraft(activeProjectId, workspaceId, 'global', controller.signal)
        return
      }
      void bridgeRef.current.client.saveCommandDraft(activeProjectId, workspaceId, 'global', {
        surfaceKind: 'main',
        surfaceId: workspaceId ?? scopeId,
        prompt: globalComposerText,
        contextViewIds: globalContextIds,
        selectionViewIds: [],
        receiverId: null,
        provider: globalProvider,
        createAsNewNode: globalCreateAsNewNode,
        intent: globalCreateAsNewNode ? 'create' : 'analyze',
        resultPolicy: globalCreateAsNewNode ? 'create_artifact' : 'reply_only',
      }, controller.signal)
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [activeProjectId, bootMode, globalComposerText, globalContextIds, globalCreateAsNewNode, globalProvider, scopeId, workspaceId])

  useEffect(() => {
    if (bootMode !== 'runtime') return
    const key = `${activeProjectId}::${workspaceId ?? '__project_overview__'}`
    if (activeContextHydratedKeyRef.current !== key) return
    let cancelledBeforeDispatch = false
    const contextKey = key
    const timeout = window.setTimeout(() => {
      setContextSync('syncing')
      const payload = {
        ...(workspaceId === null ? {} : { workspaceId }),
        scopeId,
        selectedViewIds: selectedIds,
        pinnedContextIds,
        excludedContextIds,
        currentSurface: activeSurface,
        ...(agentMode ? { currentHarness: launchSearchParams?.get('agent') || 'codex' } : {}),
        viewport: { x: camera.x, y: camera.y, zoom: camera.zoom },
        visibleViewIds: visibleNodes.map((node) => node.id),
        ...(selectionTargetNode?.artifactId ? { targetArtifactId: selectionTargetNode.artifactId } : {}),
        ...((selectionBaseRevision?.id ?? selectionTargetNode?.revisionId) ? { targetRevisionId: selectionBaseRevision?.id ?? selectionTargetNode?.revisionId } : {}),
      }
      // 串行写入：同一时刻最多一个在途写；409 时先拉最新版本再重放一次。
      const previousTask = activeContextWriteQueuesRef.current.get(contextKey) ?? Promise.resolve()
      const task = previousTask.then(async () => {
        if (cancelledBeforeDispatch) return
        const isCurrentContext = () => activeContextHydratedKeyRef.current === contextKey
        const write = async (): Promise<void> => {
          const expectedVersion = activeContextVersionsRef.current.get(contextKey)
          const call = await bridgeRef.current.client.updateActiveContext(activeProjectId, {
            ...payload,
            ...(expectedVersion === undefined ? {} : { expectedVersion }),
          })
          if (call.result.ok) {
            activeContextVersionRef.current = call.result.value.version
            activeContextVersionsRef.current.set(contextKey, call.result.value.version)
            if (isCurrentContext()) {
              setActiveContextProjection(call.result.value)
              setActiveContextError(null)
              setContextSync('synced')
            }
            return
          }
          if (isCurrentContext()) setActiveContextError(call.result.error.message)
          if (call.result.error.code !== 'ACTIVE_CONTEXT_CONFLICT') {
            if (isCurrentContext()) setContextSync('conflict')
            return
          }
          const refresh = await bridgeRef.current.client.activeContext(activeProjectId, workspaceId)
          if (!refresh.result.ok) return
          activeContextVersionRef.current = refresh.result.value.version
          activeContextVersionsRef.current.set(contextKey, refresh.result.value.version)
          if (isCurrentContext()) setActiveContextProjection(refresh.result.value)
          // 冲突重放一次：基于最新版本重写本次 intent
          const retry = await bridgeRef.current.client.updateActiveContext(activeProjectId, {
            ...payload,
            expectedVersion: activeContextVersionsRef.current.get(contextKey),
          })
          if (retry.result.ok) {
            activeContextVersionRef.current = retry.result.value.version
            activeContextVersionsRef.current.set(contextKey, retry.result.value.version)
            if (isCurrentContext()) {
              setActiveContextProjection(retry.result.value)
              setActiveContextError(null)
              setContextSync('synced')
            }
          }
        }
        await write()
      })
      const settled = task.catch(() => { /* 此 context 队列异常不影响后续写入 */ })
      activeContextWriteQueuesRef.current.set(contextKey, settled)
      void settled.finally(() => {
        if (activeContextWriteQueuesRef.current.get(contextKey) === settled) activeContextWriteQueuesRef.current.delete(contextKey)
      })
    }, 250)
    return () => {
      window.clearTimeout(timeout)
      cancelledBeforeDispatch = true
    }
  }, [activeProjectId, activeSurface, agentMode, bootMode, camera.x, camera.y, camera.zoom, excludedContextIds, launchSearchParams, pinnedContextIds, scopeId, selectedIds, selectionBaseRevision?.id, selectionTargetNode?.artifactId, selectionTargetNode?.revisionId, visibleNodes, workspaceId])

  // B4 Attention + Intent Runtime: read-only projection over existing Project Truth.
  // Deliberately key refreshes to semantic inputs, not camera movement, so panning
  // the canvas never turns into a model-call metronome.
  const attentionSemanticKey = useMemo(() => JSON.stringify({
    projectId: activeProjectId,
    workspaceId,
    surface: activeSurface,
    selectedIds: [...selectedIds].sort(),
    pinned: [...pinnedContextIds].sort(),
    excluded: [...excludedContextIds].sort(),
    intent: activeContextProjection?.explicitIntent ?? null,
    recent: (activeContextProjection?.recentChanges ?? [])
      .filter((change) => change.kind !== 'viewport')
      .slice(-6)
      .map((change) => [change.version, change.kind, change.summary]),
  }), [activeContextProjection?.explicitIntent, activeContextProjection?.recentChanges, activeProjectId, activeSurface, excludedContextIds, pinnedContextIds, selectedIds, workspaceId])

  useEffect(() => {
    if (bootMode !== 'runtime' || !activeProjectId) {
      setAttentionRuntimeSnapshot(null)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void bridgeRef.current.client.attentionRuntime(activeProjectId, { workspaceId, tokenBudget: 3200, intentPolicy: 'rules_only' }, controller.signal).then((attentionCall) => {
        if (controller.signal.aborted) return
        if (attentionCall.result.ok) {
          setAttentionRuntimeSnapshot(attentionCall.result.value)
          setAttentionRuntimeError(null)
        } else {
          setAttentionRuntimeError(attentionCall.result.error.message)
        }
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) setAttentionRuntimeError(error instanceof Error ? error.message : '暂时无法读取智能整理状态。')
      })
    }, 180)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [activeProjectId, attentionRefreshNonce, attentionSemanticKey, bootMode, workspaceId])

  // B-convergence: Resume is a project-entry boundary, not a permanent Agent panel.
  // Compute it once when a real project opens; normal canvas interaction stays silent.
  useEffect(() => {
    setResumeBoundary(null)
    setResumeHintDismissed(false)
    if (bootMode !== 'runtime' || !activeProjectId || agentMode) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void bridgeRef.current.client.continuityResume(activeProjectId, { tokenBudget: 1800, ...(continuitySessionId === undefined ? {} : { sessionId: continuitySessionId }) }, controller.signal).then((call) => {
        if (!controller.signal.aborted && call.result.ok) setResumeBoundary(call.result.value)
      }).catch(() => { /* Resume hint is best-effort and must never block opening a project. */ })
    }, 320)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [activeProjectId, agentMode, bootMode, continuitySessionId])

  // Session 2：Handoff / Session Summary 是 Core truth；这里只做一次投影加载，
  // runReviews 变化（执行 / accept / retry）时刷新，前端不保存第二份副本。
  useEffect(() => {
    if (bootMode !== 'runtime' || !activeProjectId) {
      setCoreHandoffs([])
      return
    }
    const controller = new AbortController()
    void bridgeRef.current.client.listHandoffs(activeProjectId, controller.signal).then((call) => {
      if (!controller.signal.aborted && call.result.ok) setCoreHandoffs(call.result.value)
    }).catch(() => { /* History is best-effort and must never block opening a project. */ })
    return () => controller.abort()
  }, [activeProjectId, bootMode, dataSource, runReviews.length])


  const refreshConversationIdentity = useCallback(async (): Promise<void> => {
    if (bootMode !== 'runtime' || !activeProjectId) { setActiveReceiverIdentity(null); return }
    const call = await bridgeRef.current.client.activeReceiverIdentity(activeProjectId).catch(() => null)
    if (!call?.result.ok) { setActiveReceiverIdentity(null); return }
    const identity = call.result.value
    setActiveReceiverIdentity(identity)
    const activeViewId = identity.chain?.conversationViewId
    const phase = identity.chain?.lifecycle?.phase
    setNodes((current) => current.map((node) => {
      if (node.entityKind !== 'conversation' || !node.conversation) return node
      const nextPhase = activeViewId === node.id ? phase : undefined
      return node.conversation.lifecyclePhase === nextPhase ? node : { ...node, conversation: { ...node.conversation, lifecyclePhase: nextPhase } }
    }))
  }, [activeProjectId, bootMode, setNodes])

  useEffect(() => {
    setConversationSessions([])
    setActiveReceiverIdentity(null)
    if (bootMode !== 'runtime' || !activeProjectId) return
    const controller = new AbortController()
    void Promise.all([
      bridgeRef.current.client.conversations(activeProjectId, controller.signal),
      bridgeRef.current.client.activeReceiverIdentity(activeProjectId, controller.signal),
    ]).then(([conversationsCall, identityCall]) => {
      if (controller.signal.aborted) return
      if (conversationsCall.result.ok) setConversationSessions(conversationsCall.result.value)
      if (identityCall.result.ok) {
        const identity = identityCall.result.value
        setActiveReceiverIdentity(identity)
        const activeViewId = identity.chain?.conversationViewId
        const phase = identity.chain?.lifecycle?.phase
        setNodes((current) => current.map((node) => node.entityKind === 'conversation' && node.conversation
          ? { ...node, conversation: { ...node.conversation, lifecyclePhase: activeViewId === node.id ? phase : undefined } }
          : node))
      }
    }).catch(() => { /* Conversation evidence must not block project opening. */ })
    return () => controller.abort()
  }, [activeProjectId, bootMode, setNodes])

  useEffect(() => {
    setWorkflowCheckpoints([])
    if (bootMode !== 'runtime' || !activeProjectId) return
    const controller = new AbortController()
    void bridgeRef.current.client.checkpoints(activeProjectId, controller.signal).then((call) => {
      if (!controller.signal.aborted && call.result.ok) setWorkflowCheckpoints(call.result.value)
    }).catch(() => { /* Checkpoint projections are optional and never block the Surface. */ })
    return () => controller.abort()
  }, [activeProjectId, bootMode, dataSource])

  const refreshResultSlots = useCallback(async (): Promise<void> => {
    if (bootMode !== 'runtime' || !activeProjectId) return
    const call = await bridgeRef.current.client.resultSlots(activeProjectId).catch(() => null)
    if (!call?.result.ok) return
    const slots = call.result.value
    setResultSlots(slots)
    setNodes((current) => reconcileResultSlotProjections(current, slots))
  }, [activeProjectId, bootMode, setNodes])

  useEffect(() => {
    setResultSlots([])
    if (bootMode !== 'runtime' || !activeProjectId) return
    let cancelled = false
    let timer: number | undefined
    const refresh = async () => {
      if (cancelled || document.visibilityState === 'hidden') return
      await refreshResultSlots()
    }
    void refresh()
    timer = window.setInterval(() => { void refresh() }, 4_000)
    return () => { cancelled = true; if (timer !== undefined) window.clearInterval(timer) }
  }, [activeProjectId, bootMode, refreshResultSlots])

  useEffect(() => {
    if (bootMode !== 'runtime' || (workRail.collapsed && activeSurface !== 'workflow') || !activeProjectId || agentMode) return
    let cancelled = false
    let timer: number | undefined
    const pollRunList = async () => {
      if (document.visibilityState === 'hidden') return
      const call = await bridgeRef.current.client.projectRunReviews(activeProjectId, 40).catch(() => null)
      if (!cancelled && call?.result.ok) setRunReviews(call.result.value)
    }
    void pollRunList()
    timer = window.setInterval(() => { void pollRunList() }, 4_000)
    return () => { cancelled = true; if (timer !== undefined) window.clearInterval(timer) }
  }, [activeProjectId, activeSurface, agentMode, bootMode, workRail.collapsed])

  useEffect(() => {
    if (!agentMode || !activeProjectId || bootMode !== 'runtime') return
    let stopped = false
    let version = activeContextVersionRef.current
    const apply = (next: ActiveContextProjection) => {
      if (next.version <= version) return
      version = next.version
      activeContextVersionRef.current = next.version
      setActiveContextProjection(next)
      setActiveContextError(null)
      setContextSync('synced')
    }
    const applyProposals = (value: readonly ContextChangeProposalV1[]) => {
      setContextProposals([...value])
    }
    const applyRuns = (value: readonly RunReview[]) => {
      setRunReviews(value)
      const pending = (value as readonly {
        run: { provider?: string; status: string }
        dispatch: { status: string }
        binding?: { providerStatus?: string }
      }[]).filter((review) =>
        review.run.provider === 'codex'
        && ['created', 'queued', 'running'].includes(review.run.status)
        && review.dispatch.status === 'bound'
        && !['claimed', 'running', 'review', 'completed', 'failed', 'cancelled', 'timeout'].includes(String(review.binding?.providerStatus ?? '')))
      setPendingCodexCount(pending.length)
    }
    const refreshCards = async () => {
      if (stopped) return
      const [proposals, reviews] = await Promise.all([
        bridgeRef.current.client.listContextProposals(activeProjectId, workspaceId).catch(() => null),
        bridgeRef.current.client.projectRunReviews(activeProjectId, 100).catch(() => null),
      ])
      if (stopped) return
      if (proposals?.result.ok) applyProposals(proposals.result.value)
      if (reviews?.result.ok) applyRuns(reviews.result.value)
    }
    const refreshContext = async () => {
      const call = await bridgeRef.current.client.activeContext(activeProjectId, workspaceId).catch(() => null)
      if (!stopped && call?.result.ok) apply(call.result.value)
    }
    const unsubscribe = subscribeProjectRealtime(bridgeRef.current.client, activeProjectId, (message) => {
      if (message.kind === 'snapshot') {
        void Promise.all([refreshContext(), refreshCards()])
        return
      }
      const channel = message.event?.channel
      if (channel === 'work_state') void refreshContext()
      else if (channel === 'proposal' || channel === 'run') void refreshCards()
    }, (state) => {
      if (stopped) return
      setContextSync(state === 'synced' ? 'synced' : state === 'offline' ? 'offline' : 'recovering')
    })
    return () => {
      stopped = true
      unsubscribe()
    }
  }, [activeProjectId, agentMode, bootMode, workspaceId])

  const refreshActiveContext = useCallback(() => {
    if (!activeProjectId) return
    void bridgeRef.current.client.activeContext(activeProjectId, workspaceId).then((call) => {
      if (call.result.ok) {
        setActiveContextProjection(call.result.value)
        activeContextVersionRef.current = call.result.value.version
        setContextSync('synced')
        setActiveContextError(null)
      } else {
        setActiveContextError(call.result.error.message)
      }
    })
  }, [activeProjectId, workspaceId])

  const resolveContextProposal = useCallback((proposalId: string, decision: 'accept' | 'reject') => {
    if (!activeProjectId) return
    const call = decision === 'accept'
      ? bridgeRef.current.client.acceptContextProposal(activeProjectId, proposalId)
      : bridgeRef.current.client.rejectContextProposal(activeProjectId, proposalId)
    void call.then((result) => {
      if (result.result.ok) {
        setNotice(decision === 'accept' ? '已接受 Codex 提案，Context 已更新' : '已拒绝 Codex 提案')
        void bridgeRef.current.client.listContextProposals(activeProjectId, workspaceId).then((list) => {
          if (list.result.ok) setContextProposals(list.result.value as ContextChangeProposalV1[])
        })
        refreshActiveContext()
      } else {
        setNotice(`提案处理失败：${result.result.error.message}`)
      }
    })
  }, [activeProjectId, refreshActiveContext, workspaceId])
  useEffect(() => {
    const bridge = bridgeRef.current
    let cancelled = false
    let retryTimer: number | undefined
    let retryAttempt = 0
    const scheduleRetry = () => {
      if (cancelled || retryTimer !== undefined) return
      const delay = Math.min(5_000, 500 * (2 ** retryAttempt++))
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined
        void openRuntime()
      }, delay)
    }
    const openRuntime = async (): Promise<void> => {
      const available = await bridge.isAvailable().catch(() => false)
      if (cancelled) return
      if (!available) {
        setNotice('本地项目服务暂时不可用，正在重连。你的项目文件没有被修改')
        setBootMode('offline')
        scheduleRetry()
        return
      }
      try {
        const catalog = await bridge.loadCatalog()
        if (cancelled) return
        // 目录读取失败（source:'none' + 空 projects）不代表「项目不存在」：网络竞态、
        // 服务启动时序都会出现。只有 runtime 真源返回的目录才能做 missing/empty 判定，
        // 否则按暂时不可用重连——绝不把空列表当真相把用户踢回列表页（20260826 演示
        // 项目打开约 6 秒后自动跳回 /projects 的根因）。
        if (catalog.source !== 'runtime') {
          setNotice('项目列表暂时无法读取，正在重连。你的项目文件没有被修改')
          setBootMode('offline')
          scheduleRetry()
          return
        }
        const runtimeProjects = catalog.projects
        const selection = selectRuntimeProject(runtimeProjects, requestedProjectId ?? null)
        if (selection.kind === 'missing-requested') {
          setProjects(runtimeProjects)
          setProjectOpen(false)
          setBootMode('offline')
          setNotice(`没有找到这个项目，已回到项目列表。项目 ID：${selection.requestedProjectId}`)
          return
        }
        if (selection.kind === 'empty-catalog') {
          setProjects([])
          setProjectOpen(false)
          setBootMode('offline')
          setNotice('还没有本地项目，请创建新项目或打开已有文件夹')
          return
        }
        const runtimeProjectId = selection.projectId
        setProjects(runtimeProjects)
        setOpenProjectIds([runtimeProjectId])
        setActiveProjectId(runtimeProjectId)
        bridgeRef.current = new RuntimeBridge(runtimeProjectId)
        const result = await bridgeRef.current.loadProject()
        if (cancelled) return
        if (result?.source === 'runtime' && result.state) {
          resetGraph({ nodes: result.state.nodes, edges: result.state.edges })
          setWorkspaces(result.state.workspaces)
          setScopes(result.state.scopes)
          setWorkspaceId(null)
          const rootScope = result.state.scopes.find((scope) => scope.kind === 'root') ?? result.state.scopes[0]
          setScopeId(rootScope?.id ?? result.state.activeScopeId)
          setCamera(loadProjectNavigationState(activeProjectId)?.camera ?? rootScope?.camera ?? camera)
          setWorkRail(normalizeRailPreferences(result.state.workRail))
          setDataSource('runtime')
          setBootMode('runtime')
          setNotice('项目已打开')
          retryAttempt = 0
        } else if (result !== undefined) {
          setBootMode('offline')
          setNotice('项目暂时无法打开，正在重连。你的项目文件没有被修改')
          scheduleRetry()
        }
      } catch {
        if (cancelled) return
        setBootMode('offline')
        setNotice('本地项目服务连接中断，正在重连。你的内容仍保留在本地')
        scheduleRetry()
      }
    }
    void openRuntime()
    return () => {
      cancelled = true
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const applyMembershipProjection = useCallback((memberships: readonly WorkspaceMembership[]) => {
    setWorkspaceMemberships(memberships)
    const byView = new Map<string, string[]>()
    memberships.forEach((membership) => {
      const viewId = String(membership.artifactViewId)
      byView.set(viewId, [...(byView.get(viewId) ?? []), String(membership.workspaceId)])
    })
    setNodes((current) => current.map((node) => ({ ...node, workspaceIds: byView.get(node.id) ?? [] })))
  }, [setNodes])

  const syncProcessProjection = useCallback(async () => {
    if (bootMode !== 'runtime') return
    const processCall = await bridgeRef.current.client.processProjection(activeProjectId)
    if (!processCall.result.ok) return
    const projection = parseProcessProjection(processCall.result.ok ? processCall.result.value : [])
    setGraph((current) => {
      const baseNodes = current.nodes.filter((node) => !node.id.startsWith('projection-') && !node.id.startsWith('session-summary-'))
      const baseEdges = current.edges.filter((edge) => !edge.id.startsWith('projection-edge-') && !edge.id.startsWith('session-summary-edge-'))
      if (!projection.length) return { nodes: baseNodes, edges: baseEdges }
      const contentNodes = baseNodes.filter((node) => node.kind !== 'process' && (node.scopeId ?? scopeId) === scopeId)
      const left = contentNodes.length ? Math.min(...contentNodes.map((node) => node.x)) : 160
      const bottom = contentNodes.length ? Math.max(...contentNodes.map((node) => node.y + node.height)) : 360
      const processDimensions = nodeDimensions('process', 'standard')
      const projectedNodes: CanvasNode[] = projection.map((item, index) => ({
        id: item.id,
        kind: 'process',
        title: item.title,
        subtitle: [item.provider, item.status, item.createdAt ? new Date(item.createdAt).toLocaleString() : null].filter(Boolean).join(' · '),
        commandText: item.summary,
        x: left + (index % 4) * (processDimensions.width + 38),
        y: bottom + 128 + Math.floor(index / 4) * (processDimensions.height + 48),
        ...processDimensions,
        displayMode: 'standard',
        scopeId,
        runStatus: item.status,
        parentRunId: item.runId,
        sourceRunId: item.runId,
        sourcePrompt: item.summary,
        sourceProvider: item.provider,
        contextCount: item.contextViewIds.length,
        targetCount: item.targetViewIds.length,
        outputCount: item.outputViewIds.length,
        createdAt: item.createdAt,
        managed: false,
        runtimeTransient: true,
      }))
      const availableIds = new Set([...baseNodes, ...projectedNodes].map((node) => node.id))
      const projectedEdges = projection.flatMap((item) => {
        const edgesToRun = [...new Set([...item.contextViewIds, ...item.targetViewIds])]
          .filter((viewId) => availableIds.has(viewId))
          .map((viewId, edgeIndex) => ({
            id: `projection-edge-${item.id}-in-${edgeIndex}`,
            from: viewId,
            to: item.id,
            kind: item.targetViewIds.includes(viewId) ? 'modify' as const : 'reference' as const,
          }))
        const edgesFromRun = item.outputViewIds
          .filter((viewId) => availableIds.has(viewId))
          .map((viewId, edgeIndex) => ({
            id: `projection-edge-${item.id}-out-${edgeIndex}`,
            from: item.id,
            to: viewId,
            kind: 'generate' as const,
          }))
        return [...edgesToRun, ...edgesFromRun]
      })
      return { nodes: [...baseNodes, ...projectedNodes], edges: [...baseEdges, ...projectedEdges] }
    })
  }, [activeProjectId, bootMode, scopeId, setGraph])


  useEffect(() => {
    if (bootMode !== 'runtime') {
      setRuntimeProviders([
        { provider: 'auto', availability: 'manual' },
        { provider: 'workbuddy', availability: 'manual' },
        { provider: 'codex', availability: 'manual' },
      ])
      return
    }
    let cancelled = false
    void Promise.all([
      bridgeRef.current.client.runtimeProviders(),
      bridgeRef.current.client.workspaceMemberships(activeProjectId),
    ]).then(([providerCall, membershipCall]) => {
      if (cancelled) return
      if (providerCall.result.ok) setRuntimeProviders(providerCall.result.value)
      if (membershipCall.result.ok) applyMembershipProjection(membershipCall.result.value)
      void syncProcessProjection()
    })
    return () => { cancelled = true }
  }, [activeProjectId, applyMembershipProjection, bootMode, syncProcessProjection])

  // S1 alignment: pull Core-derived execution items so control rendering can fail-close on availableActions.
  useEffect(() => {
    if (bootMode !== 'runtime' || activeProjectId === null) { setExecutionItems([]); return }
    let cancelled = false
    void bridgeRef.current.client.executionItems(activeProjectId).then((call) => {
      if (cancelled) return
      setExecutionItems(call.result.ok ? call.result.value : [])
    })
    return () => { cancelled = true }
  }, [activeProjectId, bootMode, activeRun?.id])

  useEffect(() => {
    let frame = 0
    const resize = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const nextWidth = window.innerWidth
        const nextHeight = window.innerHeight
        setViewportWidth((current) => current === nextWidth ? current : nextWidth)
        setViewportHeight((current) => current === nextHeight ? current : nextHeight)
      })
    }
    window.addEventListener('resize', resize, { passive: true })
    resize()
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const shellCenterRef = useRef<ReturnType<typeof shellWorkingCenter> | null>(null)
  const sidecarContentBoundsRef = useRef(restorationFocusBounds(scopeNodes.filter((node) => node.kind !== 'process')))
  sidecarContentBoundsRef.current = restorationFocusBounds(scopeNodes.filter((node) => node.kind !== 'process'))
  const previousLayoutModeRef = useRef<ShellLayoutMode | null>(null)
  useLayoutEffect(() => {
    const next = shellWorkingCenter(viewportWidth, viewportHeight, layoutMode, layoutMode === 'desktop' && !workRail.collapsed, effectiveRailWidth)
    const previous = shellCenterRef.current
    shellCenterRef.current = next
    if (!previous) return
    const deltaX = next.x - previous.x
    const deltaY = next.y - previous.y
    if (Math.abs(deltaX) < .5 && Math.abs(deltaY) < .5) return
    // Resize only moves the camera projection so the current world focus stays
    // inside the newly available Sidecar/Desktop working region. Node anchors
    // and Project Truth never change.
    setCamera((current) => ({ ...current, x: current.x + deltaX, y: current.y + deltaY }))
  }, [effectiveRailWidth, layoutMode, viewportHeight, viewportWidth, workRail.collapsed])

  useLayoutEffect(() => {
    const previousMode = previousLayoutModeRef.current
    previousLayoutModeRef.current = layoutMode
    const bounds = sidecarContentBoundsRef.current
    if (layoutMode !== 'sidecar' || previousMode === 'sidecar' || !bounds) return
    setCamera(fitBoundsForReading(
      bounds,
      viewportWidth,
      Math.max(120, viewportHeight - 84 - 56 - 96),
      24,
      { left: 18, right: 18, top: 12, bottom: 12 },
    ))
  }, [layoutMode, viewportHeight, viewportWidth])

  useEffect(() => {
    if (presentationInteractionRef.current) return
    if (bootMode === 'loading') return
    setSaveStatus('saving')
    const timer = window.setTimeout(() => {
      const rootScopeId = scopes.find((scope) => scope.kind === 'root')?.id ?? scopes[0]?.id ?? 'scope-root'
      const snapshot: PersistedPrototypeState = { version: 10, projectId: activeProjectId, nodes, edges, workspaces, scopes, activeWorkspaceId: null, activeScopeId: rootScopeId, workRail, colonies }
      projectStateCacheRef.current.set(activeProjectId, snapshot)
      if (isRuntimeProjectMode(bootMode)) {
        const bridge = bridgeRef.current
        bridge.saveMutations(snapshot).then((result) => {
          if (result.status === 'saved') {
            setSaveStatus('saved')
            setDataSource('runtime')
            setNotice('已保存')
          } else {
            setSaveStatus('unsaved')
            setNotice(`保存失败：${humanizeRuntimeMessage(result.error)}`)
            console.warn('[RuntimeBridge] Save failed:', result.error)
          }
          saveProjectCatalog(projects)
        }).catch(() => {
          setSaveStatus('unsaved')
          setNotice('保存失败：本地项目服务暂时无法连接，请稍后重试')
        })
        return
      }
      savePrototypeState(activeProjectId, snapshot)
      saveProjectCatalog(projects)
      setSaveStatus('saved')
    }, 280)
    return () => window.clearTimeout(timer)
  }, [activeProjectId, bootMode, edges, nodes, presentationCommit, projects, scopes, colonies, workRail, workspaces])

  useEffect(() => { cameraRef.current = camera }, [camera])
  useEffect(() => { activeProjectIdRef.current = activeProjectId }, [activeProjectId])

  // 相机“总闸”：项目打开后的短窗口内，无论相机来自 ActiveContext、localStorage 还是
  // Workspace，只要当前作用域有节点且相机下没有任何节点可见，就按节点包围盒重新适配，
  // 避免持久化的陈旧相机让用户打开项目看到空画布（点不到节点）。
  // 窗口（8s）过后不再自动移动相机，避免和用户手动平移/缩放打架。
  const cameraValidityKey = `${activeProjectId}::${scopeId ?? '__overview__'}`
  const cameraHealWindowRef = useRef<Record<string, number>>({})
  useEffect(() => {
    if (bootMode !== 'runtime' || scopeNodes.length === 0) return
    const now = Date.now()
    if (cameraHealWindowRef.current[cameraValidityKey] === undefined) {
      cameraHealWindowRef.current[cameraValidityKey] = now
    }
    const contentNodes = scopeNodes.filter((node) => node.kind !== 'process')
    const visibleCandidates = contentNodes.length > 0 ? contentNodes : scopeNodes
    if (restoredCameraIsMeaningful(cameraRef.current, visibleCandidates, window.innerWidth, window.innerHeight)) return
    if (now - cameraHealWindowRef.current[cameraValidityKey] > 8_000) return
    const bounds = restorationFocusBounds(visibleCandidates)
    if (!bounds) return
    setCamera(fitBoundsForReading(
      bounds,
      window.innerWidth,
      window.innerHeight,
      74,
      safeInsets,
    ))
  }, [bootMode, cameraValidityKey, safeInsets, scopeNodes, setCamera])

  useEffect(() => {
    const timer = window.setTimeout(() => saveProjectNavigationState(activeProjectId, camera), 3000)
    return () => window.clearTimeout(timer)
  }, [activeProjectId, camera])

  useEffect(() => {
    const flush = () => saveProjectNavigationState(activeProjectIdRef.current, cameraRef.current)
    const hidden = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [])

  useEffect(() => {
    if (!activeRun) return
    setNodes((current) => current.map((node) => {
      if (node.id !== activeRun.processNodeId) return node
      const displayMode: NodeDisplayMode = activeRun.status === 'completed' ? 'compact' : 'standard'
      return {
        ...node,
        runStatus: activeRun.status,
        subtitle: `${runStatusLabel[activeRun.status]} · ${activeRun.targetIds.length} 个目标`,
        title: `${activeRun.id} · ${activeRun.command.slice(0, 22)}`,
        displayMode,
        ...nodeDimensions('process', displayMode),
      }
    }))
    if (activeRun.runtime) return
    if (activeRun.status === 'queued') {
      const timer = window.setTimeout(() => setActiveRun((run) => run?.id === activeRun.id ? { ...run, status: 'running' } : run), 650)
      return () => window.clearTimeout(timer)
    }
    if (activeRun.status === 'running' && !activeRun.inputResolved) {
      const timer = window.setTimeout(() => setActiveRun((run) => run?.id === activeRun.id ? { ...run, status: 'waiting_input' } : run), 950)
      return () => window.clearTimeout(timer)
    }
    if (activeRun.status === 'running' && activeRun.inputResolved && !activeRun.pendingArtifactId) {
      const timer = window.setTimeout(() => returnArtifact(activeRun), 900)
      return () => window.clearTimeout(timer)
    }
  }, [activeRun?.id, activeRun?.inputResolved, activeRun?.pendingArtifactId, activeRun?.status])

  const clearSelection = useCallback(() => {
    selectionContextIntentRef.current.touched = true
    selectionIntentVersionRef.current += 1
    setSelectedIds([])
    setSelectedEdgeId(null)
    setNodeInfoId(null)
    setSelectionComposerOpen(false)
  }, [])

  const captureProjectState = useCallback((): PersistedPrototypeState => ({
    version: 10,
    projectId: activeProjectId,
    nodes,
    edges,
    workspaces,
    scopes,
    activeWorkspaceId: null,
    activeScopeId: scopes.find((scope) => scope.kind === 'root')?.id ?? scopes[0]?.id ?? scopeId,
    workRail,
    colonies,
  }), [activeProjectId, edges, nodes, scopeId, scopes, colonies, workRail, workspaces])

  const applyProjectState = useCallback((projectId: string, state: PersistedPrototypeState) => {
    resetGraph({ nodes: state.nodes, edges: state.edges })
    setWorkspaces(state.workspaces)
    setScopes(state.scopes)
    setWorkspaceId(null)
    const rootScope = state.scopes.find((scope) => scope.kind === 'root') ?? state.scopes[0]
    setScopeId(rootScope.id)
    setCamera(loadProjectNavigationState(projectId)?.camera ?? rootScope.camera)
    setWorkRail(normalizeRailPreferences(state.workRail))
    setColonies(state.colonies ?? (state.spatialRegions ?? []).flatMap((region) => { const colony = migrateLegacySpatialRegion(region, state.nodes); return colony ? [colony] : [] }))
    setActiveProjectId(projectId)
    setSelectedIds([])
    setSelectedEdgeId(null)
    setNodeInfoId(null)
    setPinnedContextIds([])
    setExcludedContextIds([])
    setManualInference(null)
    setActiveRun(null)
    setSelectionComposerText('')
    setGlobalComposerText('')
    setLayoutPreview(null)
    setProjectOpen(true)
  }, [resetGraph])

  const openProject = useCallback((projectId: string) => {
    if (projectId === activeProjectId && projectOpen) return
    if (projectOpen) { saveProjectNavigationState(activeProjectId, camera); projectStateCacheRef.current.set(activeProjectId, captureProjectState()) }
    if (bootMode === 'runtime') {
      bridgeRef.current = new RuntimeBridge(projectId)
      void bridgeRef.current.loadProject().then((loaded) => {
        if (loaded.source !== 'runtime' || loaded.state === null) { setNotice(`项目打开失败：${humanizeRuntimeMessage(loaded.error ?? '项目数据暂时无法读取')}`); return }
        projectStateCacheRef.current.set(projectId, loaded.state)
        setOpenProjectIds((current) => current.includes(projectId) ? current : [...current, projectId])
        applyProjectState(projectId, loaded.state)
        setDataSource('runtime')
        setNotice(`已打开 ${projects.find((project) => project.id === projectId)?.label ?? '项目'}`)
      }).catch(() => setNotice('项目打开失败：本地项目服务暂时无法连接'))
      return
    }
    const next = projectStateCacheRef.current.get(projectId) ?? loadPrototypeState(projectId) ?? createBlankProjectState(
      projects.find((project) => project.id === projectId) ?? { id: projectId, label: projectId, localPath: '', updatedAt: '', pendingCount: 0 },
      defaultRailWidth(),
    )
    projectStateCacheRef.current.set(projectId, next)
    setOpenProjectIds((current) => current.includes(projectId) ? current : [...current, projectId])
    applyProjectState(projectId, next)
    setNotice(`已打开 ${projects.find((project) => project.id === projectId)?.label ?? '项目'}`)
  }, [activeProjectId, applyProjectState, bootMode, camera, captureProjectState, projectOpen, projects])

  // GUI-1：/projects 与 /projects/:id 是真实路由；drive 关闭/画布打开时同步 URL。
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const desiredPath = captureSpaceOpen
      ? '/capture'
      : projectOpen
        ? `/projects/${encodeURIComponent(activeProjectId)}`
        : '/projects'
    const preserved = new URLSearchParams()
    const agent = params.get('agent')
    const surface = params.get('surface')
    if (agent) preserved.set('agent', agent)
    if (surface === 'tap' || surface === 'companion') preserved.set('surface', surface)
    const query = preserved.toString()
    const desiredUrl = `${desiredPath}${query ? `?${query}` : ''}`
    if (`${window.location.pathname}${window.location.search}` === desiredUrl) return
    window.history.replaceState(null, '', desiredUrl)
  }, [activeProjectId, captureSpaceOpen, projectOpen])

  // Phase A: Project Home 是 Launcher —— 卡片点击在新标签页打开项目，实例互不干扰。
  const openProjectInNewTab = useCallback((projectId: string) => {
    const params = new URLSearchParams()
    if (agentMode) params.set('agent', 'codex')
    if (launchSurface) params.set('surface', launchSurface)
    const query = params.toString()
    const url = `${window.location.origin}/projects/${encodeURIComponent(projectId)}${query ? `?${query}` : ''}`
    window.open(url, '_blank', 'noopener')
    setProjectOpen(false)
  }, [agentMode, launchSurface])

  const revealProjectFolder = useCallback((projectId: string) => {
    if (bootMode !== 'runtime') {
      setNotice('原型模式没有可打开的本地项目目录')
      return
    }
    void bridgeRef.current.client.revealProject(projectId).then((call) => {
      if (call.result.ok) setNotice('已在资源管理器中打开项目目录')
      else setNotice(`打开失败：${call.result.error.message}`)
    })
  }, [bootMode])

  // Phase A: Project Focus Signal —— 项目 Tab 获得焦点时上报 Runtime Registry（Capture 亲和性基础）。
  useEffect(() => {
    if (bootMode !== 'runtime' || !activeProjectId) return
    // 页面重载/卸载时中止在途上报请求，避免浏览器报 net::ERR_ABORTED 噪音
    const controller = new AbortController()
    const report = () => {
      void bridgeRef.current.client.runtimeFocusProject(activeProjectId, controller.signal).catch(() => { /* 上报失败不影响界面 */ })
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') report()
    }
    report()
    window.addEventListener('focus', report)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      controller.abort()
      window.removeEventListener('focus', report)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [activeProjectId, bootMode])

  useEffect(() => {
    const desktop = getDesktopPort()
    return desktop?.onOpenCaptureSpace?.(() => {
      setCaptureSpaceOpen(true)
      setProjectOpen(false)
    })
  }, [])

  // Phase B: Project Home 显示"未归项目"轻量计数（不是 Inbox 页面）。
  useEffect(() => {
    if (projectOpen || bootMode !== 'runtime') return
    void bridgeRef.current.client.captureStaging(7 * 24 * 60 * 60_000).then((call) => {
      if (call.result.ok) setCapturePendingCount(call.result.value.pendingCount)
    }).catch(() => { /* 计数失败不影响列表 */ })
  }, [bootMode, projectOpen])

  const closeProjectTab = useCallback((projectId: string) => {
    if (projectId === activeProjectId) { saveProjectNavigationState(projectId, camera); projectStateCacheRef.current.set(projectId, captureProjectState()) }
    const remaining = openProjectIds.filter((id) => id !== projectId)
    setOpenProjectIds(remaining)
    if (projectId !== activeProjectId) return
    const nextId = remaining.at(-1)
    if (nextId) {
      const next = projectStateCacheRef.current.get(nextId) ?? loadPrototypeState(nextId) ?? createBlankProjectState(
        projects.find((project) => project.id === nextId) ?? { id: nextId, label: nextId, localPath: '', updatedAt: '', pendingCount: 0 },
        defaultRailWidth(),
      )
      applyProjectState(nextId, next)
    } else setProjectOpen(false)
  }, [activeProjectId, applyProjectState, camera, captureProjectState, openProjectIds, projects])

  const createProject = useCallback(async (input: { label: string; intent: 'create'; parentPath: string; directoryName: string } | { label: string; intent: 'open'; rootPath: string; importExisting?: boolean }) => {
    setProjectCreateOpen(false)
    const { label, ...request } = input
    const call = await bridgeRef.current.client.createProject({ name: label, ...request })
    if (!call.result.ok) {
      setNotice(`项目创建失败：${call.result.error.message}`)
      return
    }
    const entry = call.result.value
    bridgeRef.current = new RuntimeBridge(entry.id)
    const loaded = await bridgeRef.current.loadProject()
    if (loaded.source !== 'runtime' || !loaded.state) {
      setNotice(`项目已创建（${entry.name}），但项目内容暂时无法读取`)
      return
    }
    const rootScope = loaded.state.scopes.find((scope) => scope.kind === 'root')
    const project: ProjectPackage = {
      id: entry.id,
      label,
      localPath: entry.rootPath,
      updatedAt: '刚刚',
      pendingCount: 0,
      rootScopeId: rootScope?.id,
    }
    setProjects((current) => current.some((item) => item.id === entry.id) ? current : [...current, project])
    setOpenProjectIds((current) => [...current, entry.id])
    setActiveProjectId(entry.id)
    resetGraph({ nodes: loaded.state.nodes, edges: loaded.state.edges })
    setWorkspaces(loaded.state.workspaces)
    setScopes(loaded.state.scopes)
    setWorkspaceId(null)
    setScopeId(rootScope?.id ?? loaded.state.activeScopeId)
    setCamera(rootScope?.camera ?? camera)
    setWorkRail(normalizeRailPreferences(loaded.state.workRail))
    setDataSource('runtime')
    setBootMode('runtime')
    setActiveSurface('arrange')
    setProjectOpen(true)
    const importedNodes = loaded.state.nodes.filter((node) => node.artifactId !== undefined).length
    setNotice(importedNodes > 0
      ? `${label} 已打开，已从目录建立 ${importedNodes} 个 Canvas 节点`
      : `${label} 已创建并保存，可以直接拖入本地文件`)
  }, [camera, resetGraph, setCamera, setDataSource, setProjectOpen, setScopes, setWorkRail, setWorkspaces])
  const browseProjectDirectory = useCallback(async (title: string): Promise<string | undefined> => {
    const call = await bridgeRef.current.client.selectDirectory(title)
    if (!call.result.ok) throw new Error(call.result.error.message)
    return call.result.value.cancelled ? undefined : call.result.value.path
  }, [])
  const inspectProjectDirectory = useCallback(async (rootPath: string) => {
    const call = await bridgeRef.current.client.inspectProjectRoot(rootPath)
    if (!call.result.ok) throw new Error(call.result.error.message)
    return call.result.value
  }, [])
  useEffect(() => {
    if (bootMode !== 'runtime') {
      firstArtifactGuideArmedRef.current = false
      setFirstArtifactGuideOpen(false)
      return
    }
    if (nodes.length === 0) {
      firstArtifactGuideArmedRef.current = true
      setFirstArtifactGuideOpen(false)
      return
    }
    if (firstArtifactGuideArmedRef.current) {
      firstArtifactGuideArmedRef.current = false
      setFirstArtifactGuideOpen(true)
    }
  }, [bootMode, nodes.length])
  const selectNode = useCallback((id: string, additive = false) => {
    selectionContextIntentRef.current.touched = true
    selectionIntentVersionRef.current += 1
    setSelectedEdgeId(null)
    // Full workspace may summon a transient composer on deliberate second click.
    // Sidecar is a collaboration/status surface and never owns another LCOS prompt box.
    setSelectionComposerOpen(layoutMode === 'desktop' && !additive && selectedIds.includes(id))
    setSelectedIds((current) => additive ? current.includes(id) ? current.filter((item) => item !== id) : [...current, id] : [id])
    if (!additive) setNodeInfoId(null)
  }, [layoutMode, selectedIds])
  const selectMarquee = useCallback((ids: string[], additive: boolean) => {
    selectionContextIntentRef.current.touched = true
    selectionIntentVersionRef.current += 1
    setSelectedEdgeId(null)
    setSelectedIds((current) => additive ? Array.from(new Set([...current, ...ids])) : ids)
    setNodeInfoId(null)
  }, [])
  const selectEdge = useCallback((id: string | null) => {
    setSelectedEdgeId(id)
    if (id) { setSelectedIds([]); setNodeInfoId(null); setSelectionComposerOpen(false) }
  }, [])

  const activateOverview = useCallback(() => {
    setActiveContextId(null)
    setActiveWorkflowId(null)
    setWorkspaceId(null)
    setLayoutPreview(null)
    // "主画布" is a real root destination, not merely the Arrange lens for the
    // currently entered legacy Scope. A-closeout QA exposed that keeping Scope
    // trapped users in obsolete child canvases until refresh.
    setScopeId(rootScope.id)
    setCamera(rootScope.camera ?? { x: 120, y: 72, zoom: 1 })
    setActiveSurface('arrange')
    clearSelection()
    setNotice('已回到主画布')
  }, [clearSelection, rootScope.camera, rootScope.id])

  const changeWorkspace = useCallback((id: string) => {
    const next = workspaces.find((workspace) => workspace.id === id && workspace.scopeId === scopeId)
    if (!next) { setNotice('这个工作空间不属于当前画布'); return }
    setWorkspaceId(id)
    setLayoutPreview(null)
    // Activation itself must not silently jump to Context/Workflow because an
    // old preferredSurface survived on the Workspace. The caller may choose a
    // capability lens explicitly after activation (Workflow Pages do this).
    setActiveSurface('arrange')
    setNotice(`已激活工作空间「${next.label}」`)
  }, [scopeId, workspaces])

  const openWorkspaceScene = useCallback((id: string) => {
    const next = workspaces.find((workspace) => workspace.id === id)
    if (!next) { setNotice('这个工作现场已不存在'); return }
    setActiveContextId(null)
    setActiveWorkflowId(null)
    setScopeId(next.scopeId)
    setWorkspaceId(next.id)
    setLayoutPreview(null)
    setSelectedIds([])
    setSelectedEdgeId(null)
    setCamera(next.camera)
    setActiveSurface('arrange')
    setNotice(`已进入工作现场「${next.label}」`)
  }, [workspaces])

  const buildWorkspaceScene = useCallback((focusedViewIds: readonly string[]) => {
    const now = new Date().toISOString()
    const usedLabels = new Set(workspaces.map((workspace) => workspace.label))
    let sceneNumber = workspaces.length + 1
    while (usedLabels.has(`Scene ${sceneNumber}`)) sceneNumber += 1
    const label = `Scene ${sceneNumber}`
    return {
      ...createWorkspaceRecord({
        id: createId('workspace'),
        label,
        intent: null,
        camera,
        visibleLayers,
        now,
        scopeId,
        focusedViewIds: [...new Set(focusedViewIds)],
      }),
      contextPolicy: 'workspace-related',
      preferredSurface: 'arrange',
      frameBounds: (() => {
        const members = nodes.filter((node) => focusedViewIds.includes(node.id))
        const bounds = members.length ? getVisualSelectionBounds(members, members.map((node) => node.id)) : null
        return { x: bounds?.x ?? 160, y: bounds?.y ?? 140, width: 260, height: 140 }
      })(),
    } satisfies Workspace
  }, [camera, nodes, scopeId, visibleLayers, workspaces])

  const createEmptyWorkspaceScene = useCallback(() => {
    const scene = buildWorkspaceScene([])
    setWorkspaces((current) => [...current, scene])
    setWorkspaceEntityRefsById((current) => ({ ...current, [scene.id]: [] }))
    setActiveContextId(null)
    setActiveWorkflowId(null)
    setScopeId(scene.scopeId)
    setWorkspaceId(null)
    setLayoutPreview(null)
    setSelectedEdgeId(null)
    setActiveSurface('arrange')
    clearSelection()
    setNotice(`已创建现场实体「${scene.label}」；双击 Scene 实体进入`)
  }, [buildWorkspaceScene, clearSelection])

  const openCurrentScene = useCallback(() => {
    const target = (workspaceId ? workspaces.find((workspace) => workspace.id === workspaceId) : null)
      ?? workspaces.find((workspace) => workspace.scopeId === scopeId)
      ?? workspaces[0]
    if (!target) { createEmptyWorkspaceScene(); return }
    openWorkspaceScene(target.id)
  }, [createEmptyWorkspaceScene, openWorkspaceScene, scopeId, workspaceId, workspaces])

  const selectSurface = useCallback((surface: SurfaceId) => {
    let normalized = normalizeSurfaceId(surface)
    // Context/Workflow buttons open their free worksite. Graph renderers remain
    // explicit lenses/compatibility surfaces and never become a forced homepage.
    if (normalized === 'context-graph') { setActiveContextId(null); setActiveWorkflowId(null) }
    if (normalized === 'workflow') { setActiveContextId(null); setActiveWorkflowId(null) }
    setActiveSurface(normalized)
    if (!workspaceId) return
    const now = new Date().toISOString()
    setWorkspaces((current) => updateWorkspaceRecord(current, workspaceId, { preferredSurface: normalized }, now))
  }, [activeContextId, workspaceId])

  const locateWorkspace = useCallback((id: string) => {
    const next = workspaces.find((workspace) => workspace.id === id && workspace.scopeId === scopeId)
    if (!next) { setNotice('只能定位当前画布中的工作空间'); return }
    const frames = buildWorkspaceFrames(workspaces, scopeNodes, workspaceId, scopeId)
    const frame = frames.find((item) => item.workspaceId === id)
    if (!frame) { setNotice('这个工作空间暂时没有可定位的成员'); return }
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    setCamera(fitBounds(frame.bounds, viewport?.width ?? 1000, viewport?.height ?? 820, 70, safeInsets))
    setNotice(`已定位 ${next.label} · 仅改变 Camera`)
  }, [safeInsets, scopeId, scopeNodes, workspaceId, workspaces])

  const locateNote = useCallback((noteId: string) => {
    const note = nodes.find((node) => node.id === noteId)
    if (!note) { setNotice('备注不存在或已被移除'); return }
    const anchor = note.anchors?.[0]
    if (!anchor) { setNotice('这条备注没有可定位的锚点'); return }
    let targetId: string | undefined
    if (anchor.type === 'artifact_view') targetId = anchor.viewId
    else if (anchor.type === 'artifact') targetId = nodes.find((node) => node.artifactId === anchor.artifactId)?.id
    else if (anchor.type === 'page') targetId = nodes.find((node) => node.revisionId === anchor.revisionId)?.id
    else if (anchor.type === 'scope') targetId = scopes.find((scope) => scope.id === anchor.scopeId)?.containerNodeId
    const target = targetId === undefined ? undefined : nodes.find((node) => node.id === targetId)
    if (target === undefined) { setNotice('锚定对象不在当前项目中'); return }
    if ((target.scopeId ?? 'scope-root') !== scopeId) { setNotice('锚定对象在其它画布中，请先切换到对应画布'); return }
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    const bounds = getSelectionBounds([target], [target.id])
    if (bounds) setCamera(fitBoundsForReading(bounds, viewport?.width ?? 1000, viewport?.height ?? 820, 72, safeInsets))
    setSelectedIds([target.id])
    setSelectedEdgeId(null)
    setLocatePulseId(target.id)
    if (locatePulseTimer.current) clearTimeout(locatePulseTimer.current)
    locatePulseTimer.current = setTimeout(() => setLocatePulseId(null), 1800)
    setNotice(`已定位到「${target.title}」`)
  }, [nodes, safeInsets, scopeId, scopes, setCamera, setSelectedEdgeId, setSelectedIds])

  const enterScope = useCallback((nextScopeId: string) => {
    setActiveContextId(null)
    setActiveWorkflowId(null)
    if (nextScopeId === scopeId) {
      // 底栏「主画布」等回到当前 Scope 的路径：必须同时退出 Workspace 场景，
      // 否则会停留在空工作空间里（scopeId 相同提前返回，workspaceId 未清）。
      setWorkspaceId(null)
      setActiveSurface('arrange')
      setLayoutPreview(null)
      return
    }
    const next = scopes.find((scope) => scope.id === nextScopeId)
    if (!next) { setNotice('目标画布不存在或已被删除'); return }
    // Historical Collection scopes remain readable, but new navigation must
    // expand them in-place instead of reviving a child-canvas product model.
    if (next.kind === 'collection') {
      setWorkspaceId(null)
      setScopeId(next.parentScopeId ?? rootScope.id)
      openCollectionWithMotion(next.id)
      setActiveSurface('arrange')
      clearSelection()
      setLayoutPreview(null)
      setNotice(`已在当前画布展开「${next.label}」`)
      return
    }
    setWorkspaceId(null)
    setScopeId(nextScopeId)
    setActiveSurface('arrange')
    const nextNodes = nodes.filter((node) => (node.scopeId ?? 'scope-root') === nextScopeId)
    const bounds = getSelectionBounds(nextNodes, nextNodes.map((node) => node.id))
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    if (bounds) setCamera(fitBounds(bounds, viewport?.width ?? 1000, viewport?.height ?? 820, 82, safeInsets))
    clearSelection()
    setLayoutPreview(null)
    setNotice(`已进入 ${next.label}`)
  }, [clearSelection, nodes, openCollectionWithMotion, rootScope.id, safeInsets, scopeId, scopes, workspaces])

  const leaveScope = useCallback(() => {
    if (!activeScope.parentScopeId) return
    enterScope(activeScope.parentScopeId)
  }, [activeScope.parentScopeId, enterScope])

  const workbenchScopeId = `workbench-${activeProjectId}`
  // Workbench 的 Run projection 会在切换 Scope 后补入。入口的第一次 fit 可能只
  // 看见 Artifact；在短暂 hydration 窗口内按稳定 ID 集合再 fit 一次，之后不再
  // 抢用户相机。
  useEffect(() => {
    const entry = workbenchEntryFitRef.current
    if (scopeId !== workbenchScopeId || entry.scopeId !== scopeId) return
    if (Date.now() - entry.enteredAt > 1_800 || scopeNodes.length === 0) return
    const nodeKey = scopeNodes.map((node) => node.id).sort().join('|')
    if (nodeKey === entry.nodeKey) return
    entry.nodeKey = nodeKey
    const bounds = getSelectionBounds(scopeNodes, scopeNodes.map((node) => node.id))
    if (!bounds) return
    setCamera(fitBoundsForReading(bounds, window.innerWidth, window.innerHeight, 64, safeInsets))
  }, [safeInsets, scopeId, scopeNodes, setCamera, workbenchScopeId])
  const workbenchScope = scopes.find((scope) => scope.id === workbenchScopeId) ?? null

  const ensureWorkbenchScope = useCallback(() => {
    const existing = scopes.find((scope) => scope.id === workbenchScopeId)
    if (existing) return existing.id
    const next: CanvasScope = {
      id: workbenchScopeId,
      label: '当前现场',
      kind: 'temporary-workbench',
      parentScopeId: rootScope.id,
      camera: { x: 150, y: 88, zoom: 1 },
      layoutMode: 'manual',
      updatedAt: new Date().toISOString(),
    }
    setScopes((current) => current.some((scope) => scope.id === next.id) ? current : [...current, next])
    return next.id
  }, [rootScope.id, scopes, workbenchScopeId])

  const projectViewsIntoScope = useCallback((sourceIds: readonly string[], targetScopeId: string) => {
    const selected = nodes.filter((node) => sourceIds.includes(node.id))
    const targetNodes = nodes.filter((node) => (node.scopeId ?? rootScope.id) === targetScopeId)
    const canonicalKey = (node: CanvasNode) => node.artifactId ?? node.viewOf ?? node.id
    const existing = new Map(targetNodes.map((node) => [canonicalKey(node), node]))
    const sourceToTarget = new Map<string, string>()
    const newViews: CanvasNode[] = []
    selected.forEach((node, index) => {
      const key = canonicalKey(node)
      const already = existing.get(key)
      if (already) {
        sourceToTarget.set(node.id, already.id)
        return
      }
      const id = createId('view')
      sourceToTarget.set(node.id, id)
      const column = index % 3
      const row = Math.floor(index / 3)
      newViews.push({
        ...node,
        id,
        artifactId: node.artifactId,
        viewOf: key,
        scopeId: targetScopeId,
        workspaceIds: undefined,
        x: 120 + column * 300,
        y: 120 + row * 210,
        opensScopeId: undefined,
        positionLocked: false,
      })
    })
    const newEdges = edges
      .filter((edge) => sourceToTarget.has(edge.from) && sourceToTarget.has(edge.to))
      .flatMap((edge) => {
        const from = sourceToTarget.get(edge.from)!
        const to = sourceToTarget.get(edge.to)!
        const duplicate = edges.some((current) => current.from === from && current.to === to && current.kind === edge.kind)
        return duplicate ? [] : [{ ...edge, id: createId('edge'), from, to, active: false }]
      })
    if (newViews.length || newEdges.length) setGraph({ nodes: [...nodes, ...newViews], edges: [...edges, ...newEdges] })
    return sourceIds.map((id) => sourceToTarget.get(id)).filter((id): id is string => Boolean(id))
  }, [edges, nodes, rootScope.id, setGraph])

  // Context is a Project-level semantic node. Existing physical Context scopes
  // remain as durable identities/migration shells, but their child Views are no
  // longer ongoing membership truth.
  useEffect(() => {
    const contexts = scopes.filter((scope) => scope.kind === 'context')
    if (!contexts.length) { setContextMembersById({}); return }
    const legacy = Object.fromEntries(contexts.map((scope) => [
      scope.id,
      canonicalizeContextMemberIds(scope.id, nodes.filter((node) => (node.scopeId ?? rootScope.id) === scope.id).map((node) => node.id)),
    ])) as Record<string, string[]>
    if (!isRuntimeProjectMode(bootMode)) {
      setContextMembersById((current) => ({ ...legacy, ...current }))
      return
    }
    let cancelled = false
    void Promise.all(contexts.map(async (scope) => {
      const loaded = await loadProjectPresentationMembers({
        client: bridgeRef.current.client,
        projectId: activeProjectId,
        ownerId: scope.id,
        capability: 'context',
        renderer: 'context',
        normalizeMembers: (ids) => canonicalizeContextMemberIds(scope.id, ids),
      })
      const members = loaded.ok && loaded.found ? canonicalizeContextMemberIds(scope.id, loaded.memberViewIds) : legacy[scope.id] ?? []
      return { id: scope.id, members, entityRefs: loaded.ok && loaded.found ? loaded.memberEntityRefs : [] }
    })).then((entries) => {
      if (cancelled) return
      setContextMembersById(Object.fromEntries(entries.map((entry) => [entry.id, entry.members])))
      setContextEntityRefsById(Object.fromEntries(entries.map((entry) => [entry.id, entry.entityRefs])))
    })
    return () => { cancelled = true }
  }, [activeProjectId, bootMode, projectNodeIdentityKey, rootScope.id, scopes]) // eslint-disable-line react-hooks/exhaustive-deps

  const savedContextViews = useMemo(() => scopes
    .filter((scope) => scope.kind === 'context')
    .map((scope) => {
      const memberViewIds = contextMembersById[scope.id]
        ?? canonicalizeContextMemberIds(scope.id, nodes.filter((node) => (node.scopeId ?? rootScope.id) === scope.id).map((node) => node.id))
      const members = memberViewIds.map((id) => nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
      return {
        id: scope.id,
        title: scope.label,
        containerViewId: scope.containerNodeId ?? nodes.find((node) => node.opensScopeId === scope.id)?.id,
        memberViewIds,
        memberEntityNodeIds: projectEntityNodeIds(contextEntityRefsById[scope.id] ?? [], nodes),
        memberContentKeys: members.map((node) => node.artifactId ?? node.viewOf ?? node.id),
      }
    }), [canonicalizeContextMemberIds, contextEntityRefsById, contextMembersById, nodes, rootScope.id, scopes])

  // Collection is a persistent grouping entity, not a child-canvas ownership boundary.
  // New writes persist exact member refs in a custom Presentation; legacy physical
  // collection scopes seed once for migration and remain readable.
  useEffect(() => {
    const collections = scopes.filter((scope) => scope.kind === 'collection')
    if (!collections.length) { setCollectionMembersById({}); return }
    const legacy = Object.fromEntries(collections.map((scope) => [scope.id, nodes.filter((node) => (node.scopeId ?? rootScope.id) === scope.id).map((node) => node.id)])) as Record<string, string[]>
    if (!isRuntimeProjectMode(bootMode)) {
      setCollectionMembersById((current) => ({ ...legacy, ...current }))
      setCollectionEntityRefsById((current) => ({ ...Object.fromEntries(collections.map((scope) => [scope.id, current[scope.id] ?? []])), ...current }))
      return
    }
    let cancelled = false
    void Promise.all(collections.map(async (scope) => {
      const loaded = await loadProjectPresentationMembers({
        client: bridgeRef.current.client,
        projectId: activeProjectId,
        ownerId: scope.id,
        capability: 'custom',
        renderer: 'collection',
      })
      return {
        id: scope.id,
        members: loaded.ok && loaded.found ? loaded.memberViewIds.filter((id) => nodes.some((node) => node.id === id)) : legacy[scope.id] ?? [],
        entityRefs: loaded.ok && loaded.found ? loaded.memberEntityRefs : [],
      }
    })).then((entries) => {
      if (cancelled) return
      setCollectionMembersById(Object.fromEntries(entries.map((entry) => [entry.id, entry.members])))
      setCollectionEntityRefsById(Object.fromEntries(entries.map((entry) => [entry.id, entry.entityRefs])))
    })
    return () => { cancelled = true }
  }, [activeProjectId, bootMode, projectNodeIdentityKey, rootScope.id, scopes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Workspace / Current Scene is a first-class working surface. Its legacy
  // focusedViewIds keep existing ArtifactView membership, while aggregate
  // Project entities (Context / Collection / Workflow / Workspace) are stored
  // as Presentation entity refs under a stable workspace:<id> owner. This lets
  // a saved scene contain the same entities as Main Canvas without fake Views.
  useEffect(() => {
    if (!workspaces.length) { setWorkspaceEntityRefsById({}); return }
    if (!isRuntimeProjectMode(bootMode)) {
      setWorkspaceEntityRefsById((current) => Object.fromEntries(workspaces.map((workspace) => [workspace.id, current[workspace.id] ?? []])))
      return
    }
    let cancelled = false
    void Promise.all(workspaces.map(async (workspace) => {
      const loaded = await loadProjectPresentationMembers({
        client: bridgeRef.current.client,
        projectId: activeProjectId,
        ownerId: `workspace:${workspace.id}`,
        persistenceScopeId: workspace.scopeId,
        capability: 'custom',
        renderer: 'workspace-scene',
      })
      return { id: workspace.id, entityRefs: loaded.ok && loaded.found ? loaded.memberEntityRefs : [] }
    })).then((entries) => {
      if (!cancelled) setWorkspaceEntityRefsById(Object.fromEntries(entries.map((entry) => [entry.id, entry.entityRefs])))
    })
    return () => { cancelled = true }
  }, [activeProjectId, bootMode, workspaces])

  // Workflow entities mirror Context identity: the Scope shell is only a
  // durable owner/container identity, while exact membership references any
  // Project View regardless of physical Scope.
  useEffect(() => {
    const workflows = scopes.filter((scope) => scope.kind === 'workflow')
    if (!workflows.length) { setWorkflowMembersById({}); return }
    if (!isRuntimeProjectMode(bootMode)) {
      setWorkflowMembersById((current) => ({ ...Object.fromEntries(workflows.map((scope) => [scope.id, current[scope.id] ?? []])), ...current }))
      return
    }
    let cancelled = false
    void Promise.all(workflows.map(async (scope) => {
      const loaded = await loadProjectPresentationMembers({
        client: bridgeRef.current.client,
        projectId: activeProjectId,
        ownerId: scope.id,
        capability: 'workflow',
        renderer: 'workflow',
      })
      return { id: scope.id, members: loaded.ok && loaded.found ? loaded.memberViewIds.filter((id) => nodes.some((node) => node.id === id)) : [], entityRefs: loaded.ok && loaded.found ? loaded.memberEntityRefs : [] }
    })).then((entries) => {
      if (cancelled) return
      setWorkflowMembersById(Object.fromEntries(entries.map((entry) => [entry.id, entry.members])))
      setWorkflowEntityRefsById(Object.fromEntries(entries.map((entry) => [entry.id, entry.entityRefs])))
    })
    return () => { cancelled = true }
  }, [activeProjectId, bootMode, projectNodeIdentityKey, scopes]) // eslint-disable-line react-hooks/exhaustive-deps

  const savedWorkflowViews = useMemo(() => scopes
    .filter((scope) => scope.kind === 'workflow')
    .map((scope) => ({
      id: scope.id,
      title: scope.label,
      containerViewId: scope.containerNodeId ?? nodes.find((node) => node.opensScopeId === scope.id)?.id,
      memberViewIds: workflowMembersById[scope.id] ?? [],
      memberEntityNodeIds: projectEntityNodeIds(workflowEntityRefsById[scope.id] ?? [], nodes),
    })), [nodes, scopes, workflowEntityRefsById, workflowMembersById])

  const relationEntityRefs = useMemo<PresentationEntityRefV0[]>(() => edges.flatMap((edge) => {
    const refs: PresentationEntityRefV0[] = []
    for (const id of [edge.from, edge.to]) {
      if (id.startsWith('workspace:')) refs.push({ type: 'workspace', id: id.slice('workspace:'.length) })
      else if (id.startsWith('scope:')) refs.push({ type: 'scope', id: id.slice('scope:'.length) })
      else {
        const node = nodes.find((item) => item.id === id)
        if (node?.opensScopeId && node.entityKind && node.entityKind !== 'workspace') refs.push({ type: 'scope', id: node.opensScopeId })
      }
    }
    return refs
  }), [edges, nodes])

  const allPresentationEntityRefs = useMemo(() => {
    const refs = [
      ...relationEntityRefs,
      ...contextGraphEntityRefs,
      ...contextPresentationEntityRefs,
      ...workflowPresentationEntityRefs,
      ...Object.values(contextEntityRefsById).flat(),
      ...Object.values(collectionEntityRefsById).flat(),
      ...Object.values(workspaceEntityRefsById).flat(),
      ...Object.values(workflowEntityRefsById).flat(),
    ]
    return [...new Map(refs.map((ref) => [`${ref.type}:${ref.id}`, ref])).values()]
  }, [collectionEntityRefsById, contextEntityRefsById, contextGraphEntityRefs, contextPresentationEntityRefs, relationEntityRefs, workflowEntityRefsById, workflowPresentationEntityRefs, workspaceEntityRefsById])
  const presentationEntityNodes = useMemo(() => materializeProjectEntityNodes(allPresentationEntityRefs, nodes, scopes, workspaces), [allPresentationEntityRefs, nodes, scopes, workspaces])
  const projectPresentationNodes = useMemo(() => {
    const existing = new Set(nodes.map((node) => node.id))
    return [...nodes, ...presentationEntityNodes.filter((node) => !existing.has(node.id))]
  }, [nodes, presentationEntityNodes])
  // Main projection objects need the real referenced members to render their
  // Spatial-style physical anatomy. This remains a derived visual lookup: exact
  // membership still belongs to each Presentation owner, never to the node face.
  const collectionMembersByNodeId = useMemo<Record<string, readonly CanvasNode[]>>(() => {
    const result: Record<string, readonly CanvasNode[]> = {}
    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    const bindScopeMembers = (owner: CanvasScope, viewIds: readonly string[], entityRefs: readonly PresentationEntityRefV0[]) => {
      const memberViews = viewIds.flatMap((id) => {
        const member = nodeById.get(id)
        return member ? [member] : []
      })
      const memberEntities = materializeProjectEntityNodes(entityRefs, nodes, scopes, workspaces)
      const members = [...new Map([...memberViews, ...memberEntities].map((member) => [member.id, member])).values()]
      result[`scope:${owner.id}`] = members
      if (owner.containerNodeId) result[owner.containerNodeId] = members
      const compatibilityContainer = nodes.find((node) => node.opensScopeId === owner.id)
      if (compatibilityContainer) result[compatibilityContainer.id] = members
    }
    for (const collection of scopes.filter((scope) => scope.kind === 'collection')) {
      bindScopeMembers(collection, collectionMembersById[collection.id] ?? [], collectionEntityRefsById[collection.id] ?? [])
    }
    for (const context of scopes.filter((scope) => scope.kind === 'context')) {
      bindScopeMembers(context, contextMembersById[context.id] ?? [], contextEntityRefsById[context.id] ?? [])
    }
    for (const workflow of scopes.filter((scope) => scope.kind === 'workflow')) {
      bindScopeMembers(workflow, workflowMembersById[workflow.id] ?? [], workflowEntityRefsById[workflow.id] ?? [])
    }
    for (const workspace of workspaces) {
      const viewIds = workspaceMemberViewIdsById[workspace.id] ?? workspace.focusedViewIds
      const memberViews = viewIds.flatMap((id) => {
        const member = nodeById.get(id)
        return member ? [member] : []
      })
      const memberEntities = materializeProjectEntityNodes(workspaceEntityRefsById[workspace.id] ?? [], nodes, scopes, workspaces)
      result[`workspace:${workspace.id}`] = [...new Map([...memberViews, ...memberEntities].map((member) => [member.id, member])).values()]
    }
    return result
  }, [collectionEntityRefsById, collectionMembersById, contextEntityRefsById, contextMembersById, nodes, scopes, workflowEntityRefsById, workflowMembersById, workspaceEntityRefsById, workspaceMemberViewIdsById, workspaces])
  const toggleCollectionScope = useCallback((collectionScopeId: string) => {
    const opening = !expandedCollectionScopeIds.includes(collectionScopeId)
    if (opening) {
      const collection = scopes.find((item) => item.id === collectionScopeId && item.kind === 'collection')
      const container = collection?.containerNodeId
        ? nodes.find((node) => node.id === collection.containerNodeId)
        : nodes.find((node) => node.opensScopeId === collectionScopeId)
      const memberIds = new Set(collectionMembersById[collectionScopeId] ?? [])
      const members = nodes.filter((node) => memberIds.has(node.id))
      if (container && members.length > 1) {
        const obstacles = nodes.filter((node) => node.id !== container.id && !memberIds.has(node.id) && (node.scopeId ?? rootScope.id) === (container.scopeId ?? rootScope.id))
        const layout = layoutExpandedCollectionMembers(container, members, obstacles)
        setNodes((current) => current.map((node) => {
          const next = layout.get(node.id)
          return next ? { ...node, ...next } : node
        }))
      }
      // The member Views are already at their committed expanded positions.
      // The visual fold transform is transient, so fake launch coordinates never
      // enter Presentation state.
      openCollectionWithMotion(collectionScopeId)
      return
    }
    setOpeningCollectionScopeIds((current) => current.filter((id) => id !== collectionScopeId))
    setClosingCollectionScopeIds((current) => current.includes(collectionScopeId) ? current : [...current, collectionScopeId])
    // Keep members mounted for the fold animation, then hide the projection.
    // Their committed expanded coordinates stay intact, so reopening is stable
    // and the transition never rewrites Project Truth or membership.
    window.setTimeout(() => {
      setExpandedCollectionScopeIds((current) => current.filter((id) => id !== collectionScopeId))
      setClosingCollectionScopeIds((current) => current.filter((id) => id !== collectionScopeId))
    }, 240)
  }, [collectionMembersById, expandedCollectionScopeIds, nodes, openCollectionWithMotion, rootScope.id, scopes, setNodes])
  const sceneWorkspaceIds = useMemo(() => new Set(workspaces
    .filter((workspace) => normalizeSurfaceId(workspace.preferredSurface) !== 'workflow')
    .map((workspace) => workspace.id)), [workspaces])
  const mainSceneMemberIds = useMemo(() => {
    const result = new Set<string>()
    for (const workspace of workspaces) {
      if (!sceneWorkspaceIds.has(workspace.id)) continue
      for (const id of workspaceMemberViewIdsById[workspace.id] ?? workspace.focusedViewIds) result.add(id)
    }
    return result
  }, [sceneWorkspaceIds, workspaceMemberViewIdsById, workspaces])
  const mainWorkspaceProjectionNodes = useMemo(() => materializeProjectEntityNodes(
    workspaces
      .filter((workspace) => sceneWorkspaceIds.has(workspace.id))
      .map((workspace) => ({ type: 'workspace' as const, id: workspace.id })),
    nodes, scopes, workspaces,
  ), [nodes, sceneWorkspaceIds, scopes, workspaces])
  const activeWorkspaceEntityRefs = activeWorkspace ? (workspaceEntityRefsById[activeWorkspace.id] ?? []) : []
  const activeWorkspaceEntityNodes = useMemo(() => activeWorkspace
    ? materializeProjectEntityNodes(activeWorkspaceEntityRefs, nodes, scopes, workspaces)
    : [], [activeWorkspace, activeWorkspaceEntityRefs, nodes, scopes, workspaces])
  const sceneCanvasNodes = useMemo(() => {
    // 阅读态文本节点的最小可读尺寸：正文行数决定高度，避免旧数据里
    // 135×70 的 note 卡把白色文本层压成 2-3 行的“白条”。
    const withReadableSize = (list: CanvasNode[]) => list.map((input) => {
      // 导图节点：剥掉旧数据里混入 outline 的标题行，并按内容自然尺寸校正卡片大小。
      if (input.kind === 'note' && input.noteLayout === 'mindmap') {
        const raw = input.noteOutline || input.noteBody || ''
        const outline = raw.startsWith(input.title) ? raw.slice(input.title.length).replace(/^\r?\n/, '') : raw
        const size = mindmapNodeSize(outline, input.title)
        let node: CanvasNode = input
        if (outline !== raw) node = { ...node, noteOutline: outline }
        if (node.width !== size.width || node.height !== size.height) node = { ...node, width: size.width, height: size.height }
        return node
      }
      const node = input
      // 统一文本体系：note 与 markdown 文本 artifact 同样保证阅读尺寸。
      const isTextual = node.kind === 'note' || node.fileType === 'markdown'
      if (!isTextual || node.displayMode === 'compact') return node
      const body = node.noteBody ?? node.previewText ?? ''
      if (!body.trim()) return node
      const maxLines = node.displayMode === 'expanded' ? 22 : 11
      const lineCount = Math.min(maxLines, Math.max(3, body.split(/\r?\n/).filter((line) => line.trim()).length))
      const minHeight = Math.round(lineCount * 18 + 96)
      const minWidth = node.displayMode === 'expanded' ? 296 : 244
      if (node.width >= minWidth && node.height >= minHeight) return node
      return { ...node, width: Math.max(node.width, minWidth), height: Math.max(node.height, minHeight) }
    })
    if (!activeWorkspace) {
      const byId = new Map<string, CanvasNode>()
      visibleNodes.filter((node) => !mainSceneMemberIds.has(node.id)).forEach((node) => byId.set(node.id, node))
      mainWorkspaceProjectionNodes.forEach((node) => byId.set(node.id, node))
      // Conversation bodies are already canonical Core artifactViews in `nodes`.
      return withReadableSize([...byId.values()])
    }
    const focused = new Set(workspaceMemberViewIdsById[activeWorkspace.id] ?? activeWorkspace.focusedViewIds)
    const memberNodes = nodes.filter((node) => focused.has(node.id) && visibleLayers.includes(nodeMeta[node.kind].layer))
    const byId = new Map<string, CanvasNode>()
    ;[...memberNodes, ...activeWorkspaceEntityNodes].forEach((node) => byId.set(node.id, node))
    return withReadableSize([...byId.values()])
  }, [activeWorkspace, activeWorkspaceEntityNodes, mainSceneMemberIds, mainWorkspaceProjectionNodes, nodes, presentationEntityNodes, visibleLayers, visibleNodes, workspaceMemberViewIdsById])
  const sceneCanvasEdges = useMemo(() => {
    if (!activeWorkspace) return visibleEdges
    const ids = new Set(sceneCanvasNodes.map((node) => node.id))
    return edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to))
  }, [activeWorkspace, edges, sceneCanvasNodes, visibleEdges])
  // 2026-08-17 P0: the main canvas is always manual/freeform.
  // Legacy grid Presentation state is intentionally ignored here so restoring an
  // old project can never retake ownership of user positions. Deterministic
  // align/distribute actions now live on the selection overlay instead.

  const contextGraphAutoNodeIds = useMemo(() => deriveContextGraphAutoNodeIds(projectPresentationNodes, scopes, rootScope.id), [projectPresentationNodes, rootScope.id, scopes])
  const contextGraphResolvedIds = useMemo(() => mergeContextGraphNodeIds(
    [...contextGraphPresentationIds, ...projectEntityNodeIds(contextGraphEntityRefs, projectPresentationNodes)],
    contextGraphAutoNodeIds,
    savedContextViews.map((view) => view.containerViewId).filter((id): id is string => Boolean(id)),
  ), [contextGraphAutoNodeIds, contextGraphEntityRefs, contextGraphPresentationIds, projectPresentationNodes, savedContextViews])
  const contextDetailResolvedIds = useMemo(() => [...new Set([...contextPresentationIds, ...projectEntityNodeIds(contextPresentationEntityRefs, projectPresentationNodes)])], [contextPresentationEntityRefs, contextPresentationIds, projectPresentationNodes])
  const workflowResolvedIds = useMemo(() => [...new Set([...workflowPresentationIds, ...projectEntityNodeIds(workflowPresentationEntityRefs, projectPresentationNodes)])], [projectPresentationNodes, workflowPresentationEntityRefs, workflowPresentationIds])
  const currentSceneSeedIds = useMemo(() => {
    if (activeSurface === 'arrange') return sceneCanvasNodes.map((node) => node.id)
    if (activeSurface === 'context-graph') return contextGraphResolvedIds
    if (activeSurface === 'context-space' || activeSurface === 'context-flow' || activeSurface === 'context-tree' || activeSurface === 'outline') return activeContextId ? contextDetailResolvedIds : contextGraphResolvedIds
    if (activeSurface === 'workflow') return workflowResolvedIds
    return selectedIds
  }, [activeContextId, activeSurface, contextDetailResolvedIds, contextGraphResolvedIds, sceneCanvasNodes, selectedIds, workflowResolvedIds])
  const currentSceneSemantic = useMemo(() => semanticRefsForSourceIds(currentSceneSeedIds, projectPresentationNodes), [currentSceneSeedIds, projectPresentationNodes])

  const appendExactPresentationMembers = useCallback(async (
    capability: 'context' | 'workflow',
    ownerId: string,
    viewIds: readonly string[],
    seedViewIds: readonly string[] = [],
  ): Promise<string[] | null> => {
    // Do not validate membership against this render's stale `nodes` closure.
    // A newly persisted Context/Workflow container is legitimate even before the
    // post-save graph has re-rendered; Core remains the authority that validates IDs.
    const isContextGraph = capability === 'context' && ownerId === rootScope.id
    const currentMembers = capability === 'context'
      ? (isContextGraph ? contextGraphPresentationIds : (contextMembersById[ownerId] ?? seedViewIds))
      : (ownerId === rootScope.id ? workflowPresentationIds : (workflowMembersById[ownerId] ?? seedViewIds))
    // 只发送有视图身份的成员：纯本地 note（无 artifactId/viewOf）不是项目 View，
    // Core 会以 "does not belong to the project" 拒绝整批写入（S2 静默失败根因之二）。
    const additions = [...new Set(viewIds)].filter((id) => {
      if (!id || currentMembers.includes(id)) return true
      const node = nodes.find((candidate) => candidate.id === id)
      return Boolean(node && (node.artifactId || node.viewOf))
    })
    if (!additions.length) return [...currentMembers]
    const renderer = isContextGraph ? 'context-graph' : capability
    if (!isRuntimeProjectMode(bootMode)) return [...new Set([...currentMembers, ...additions])]
    const result = await appendProjectPresentationMembers({
      client: bridgeRef.current.client,
      projectId: activeProjectId,
      ownerId,
      capability,
      renderer,
      ...(capability === 'context' && !isContextGraph ? { normalizeMembers: (ids: readonly string[]) => canonicalizeContextMemberIds(ownerId, ids) } : {}),
    }, additions, currentMembers)
    if (!result.ok) {
      setNotice(`投送失败：${result.message ? humanizeRuntimeMessage(result.message) : '本地项目服务暂时没有确认这次修改'}`)
      return null
    }
    return result.memberViewIds
  }, [activeProjectId, bootMode, canonicalizeContextMemberIds, contextGraphPresentationIds, contextMembersById, nodes, rootScope.id, workflowMembersById, workflowPresentationIds])

  const appendExactPresentationEntityRefs = useCallback(async (
    capability: 'context' | 'workflow' | 'custom',
    ownerId: string,
    refs: readonly PresentationEntityRefV0[],
    renderer?: string,
    currentRefs: readonly PresentationEntityRefV0[] = [],
    persistenceScopeId?: string,
  ): Promise<PresentationEntityRefV0[] | null> => {
    const additions = [...new Map(refs.map((ref) => [`${ref.type}:${ref.id}`, ref])).values()]
    const merged = [...new Map([...currentRefs, ...additions].map((ref) => [`${ref.type}:${ref.id}`, ref])).values()]
    if (!additions.length) return merged
    if (!isRuntimeProjectMode(bootMode)) return merged
    const result = await appendProjectPresentationEntityRefs({
      client: bridgeRef.current.client,
      projectId: activeProjectId,
      ownerId,
      capability,
      renderer: renderer ?? (capability === 'custom' ? 'collection' : capability),
      ...(persistenceScopeId ? { persistenceScopeId } : {}),
    }, additions)
    if (!result.ok) { setNotice(`投送失败：${result.message ? humanizeRuntimeMessage(result.message) : '本地项目服务暂时没有确认这次内容引用'}`); return null }
    return result.memberEntityRefs
  }, [activeProjectId, bootMode])

  const removeExactPresentationMembers = useCallback(async (
    capability: 'context' | 'workflow',
    ownerId: string,
    viewIds: readonly string[],
  ): Promise<string[] | null> => {
    const removals = [...new Set(viewIds)].filter((id) => nodes.some((node) => node.id === id))
    const isContextGraph = capability === 'context' && ownerId === rootScope.id
    if (!removals.length) return capability === 'context'
      ? (isContextGraph ? contextGraphPresentationIds : (contextMembersById[ownerId] ?? []))
      : (ownerId === rootScope.id ? workflowPresentationIds : (workflowMembersById[ownerId] ?? []))
    const currentMembers = capability === 'context'
      ? (isContextGraph ? contextGraphPresentationIds : (contextMembersById[ownerId] ?? []))
      : (ownerId === rootScope.id ? workflowPresentationIds : (workflowMembersById[ownerId] ?? []))
    const renderer = isContextGraph ? 'context-graph' : capability
    if (!isRuntimeProjectMode(bootMode)) {
      const removalSet = new Set(removals)
      return currentMembers.filter((id) => !removalSet.has(id))
    }
    const result = await removeProjectPresentationMembers({
      client: bridgeRef.current.client,
      projectId: activeProjectId,
      ownerId,
      capability,
      renderer,
      ...(capability === 'context' && !isContextGraph ? { normalizeMembers: (ids: readonly string[]) => canonicalizeContextMemberIds(ownerId, ids) } : {}),
    }, removals)
    if (!result.ok) {
      setNotice(`移出失败：${result.message ? humanizeRuntimeMessage(result.message) : '本地项目服务暂时没有确认这次修改'}`)
      return null
    }
    return result.memberViewIds
  }, [activeProjectId, bootMode, canonicalizeContextMemberIds, contextGraphPresentationIds, contextMembersById, nodes, rootScope.id, workflowMembersById, workflowPresentationIds])


  const removeExactPresentationEntityRefs = useCallback(async (
    capability: 'context' | 'workflow' | 'custom',
    ownerId: string,
    refs: readonly PresentationEntityRefV0[],
    renderer: string,
    currentRefs: readonly PresentationEntityRefV0[] = [],
    persistenceScopeId?: string,
  ): Promise<PresentationEntityRefV0[] | null> => {
    const removalKeys = new Set(refs.map((ref) => `${ref.type}:${ref.id}`))
    if (!removalKeys.size) return [...currentRefs]
    if (!isRuntimeProjectMode(bootMode)) return currentRefs.filter((ref) => !removalKeys.has(`${ref.type}:${ref.id}`))
    const result = await removeProjectPresentationEntityRefs({
      client: bridgeRef.current.client,
      projectId: activeProjectId,
      ownerId,
      capability,
      renderer,
      ...(persistenceScopeId ? { persistenceScopeId } : {}),
    }, refs)
    if (!result.ok) { setNotice(`移出失败：${result.message ? humanizeRuntimeMessage(result.message) : '本地项目服务暂时没有确认这次内容引用'}`); return null }
    return result.memberEntityRefs
  }, [activeProjectId, bootMode])

  const [railOrder, setRailOrder] = useState<ProjectViewRailOrderV0 | null>(null)
  useEffect(() => {
    if (!activeProjectId || bootMode !== 'runtime') { setRailOrder(null); return }
    let cancelled = false
    void bridgeRef.current.client.viewRailOrder(activeProjectId).then((call) => {
      if (!cancelled && call.result.ok) setRailOrder(call.result.value)
    })
    return () => { cancelled = true }
  }, [activeProjectId, bootMode])

  // GUI R2: Left Rail is a flat Project View projection over existing durable
  // Scope / Workspace / Presentation state. It deliberately does not create a
  // new Core business entity just to obtain distinct visual families.
  const projectRailViews = useMemo<ProjectRailViewItem[]>(() => {
    // 债1 数据源：collectionMembersByNodeId 已按 `workspace:`/`scope:` 键聚合出真实
    // 成员节点（与画布 WorkspaceProjectionObject 同一来源），rail 预览复用这份真实几何，
    // 不再画装饰性假预览。嵌套实体视图标记为 'entity'，由 rail 端过滤出几何。
    const railMemberNodesFor = (railViewId: string): RailMemberPreview[] | undefined => {
      const members = collectionMembersByNodeId[railViewId]
      if (!members) return undefined
      return members.map((member) => ({
        id: member.id,
        x: member.x,
        y: member.y,
        width: member.width,
        height: member.height,
        kind: member.id.startsWith('scope:') || member.id.startsWith('workspace:') ? 'entity' : detectFileIdentity(member),
      }))
    }
    // Project Rail is deliberately project-wide. Entering a Collection/Context
    // must not make the user's other destinations disappear.
    const sceneWorkspaces = workspaces.filter((workspace) => normalizeSurfaceId(workspace.preferredSurface) !== 'workflow')
    const workspaceItems: ProjectRailViewItem[] = sceneWorkspaces.map((workspace) => ({
      id: `workspace:${workspace.id}`,
      title: workspace.label,
      kind: 'scene' as const,
      memberCount: (workspaceMemberViewIdsById[workspace.id]?.length ?? 0) + (workspaceEntityRefsById[workspace.id]?.length ?? 0),
      memberViewIds: workspaceMemberViewIdsById[workspace.id] ?? [],
      memberNodes: railMemberNodesFor(`workspace:${workspace.id}`),
      // Workspace is a first-class entity; semantic Drop moves the Workspace ref,
      // not an accidental explosion of every member View.
      dragViewIds: [`workspace:${workspace.id}`],
      workspaceId: workspace.id,
      active: workspaceId === workspace.id && activeSurface === 'arrange',
    }))

    const scopeItems: ProjectRailViewItem[] = scopes
      .filter((scope) => scope.kind === 'collection' || scope.kind === 'context' || scope.kind === 'workflow')
      .filter((scope) => scope.id !== rootScope.id)
      .map((scope) => {
        const physicalMembers = nodes.filter((node) => node.scopeId === scope.id).map((node) => node.id)
        const members = scope.kind === 'context'
          ? (contextMembersById[scope.id] ?? physicalMembers)
          : scope.kind === 'workflow'
            ? (workflowMembersById[scope.id] ?? [])
            : (collectionMembersById[scope.id] ?? physicalMembers)
        const kind: ProjectRailViewItem['kind'] = scope.kind === 'context' ? 'context' : scope.kind === 'workflow' ? 'workflow' : 'collection'
        return {
          id: `scope:${scope.id}`,
          title: scope.label,
          kind,
          memberCount: members.length + (scope.kind === 'collection' ? (collectionEntityRefsById[scope.id]?.length ?? 0) : scope.kind === 'context' ? (contextEntityRefsById[scope.id]?.length ?? 0) : (workflowEntityRefsById[scope.id]?.length ?? 0)),
          memberViewIds: members,
          memberNodes: railMemberNodesFor(`scope:${scope.id}`),
          dragViewIds: [`scope:${scope.id}`],
          scopeId: scope.id,
          active: scope.kind === 'context'
            ? activeContextId === scope.id
            : scope.kind === 'workflow'
              ? activeWorkflowId === scope.id && activeSurface === 'workflow'
              : scopeId === scope.id && activeSurface === 'arrange',
        }
      })

    // Legacy root Workflow survives only as a migration bridge when old data has
    // members but no explicit Workflow entity yet. New generative Drop creates a
    // real Workflow entity/scope shell and it appears above as a normal rail item.
    const legacyWorkflowItems: ProjectRailViewItem[] = savedWorkflowViews.length === 0 && workflowPresentationIds.length > 0 ? [{
      id: `workflow:${rootScope.id}`,
      title: 'Workflow',
      kind: 'workflow' as const,
      memberCount: workflowPresentationIds.length,
      memberViewIds: workflowPresentationIds,
      // 遗留桥接项没有 workspace:/scope: 聚合键，memberNodes 为 undefined——
      // rail 端如实退回真实计数统计，不伪造布局。
      memberNodes: railMemberNodesFor(`workflow:${rootScope.id}`),
      scopeId: rootScope.id,
      active: activeWorkflowId === null && activeSurface === 'workflow',
    }] : []

    const baseViews = [...workspaceItems, ...scopeItems, ...legacyWorkflowItems]
    return orderProjectRailViews(baseViews, railOrder)
  }, [activeContextId, activeSurface, activeWorkflowId, collectionEntityRefsById, collectionMembersByNodeId, collectionMembersById, contextEntityRefsById, contextMembersById, nodes, railOrder, rootScope.id, savedWorkflowViews.length, scopeId, scopes, workspaces, workflowEntityRefsById, workflowMembersById, workflowPresentationIds, workspaceEntityRefsById, workspaceId, workspaceMemberViewIdsById])

  const projectFocusCandidates = useMemo<ProjectFocusLocationCandidate[]>(() => {
    const rootEntityRefs: PresentationEntityRefV0[] = [
      ...scopes.filter((item) => item.id !== rootScope.id && (item.parentScopeId ?? rootScope.id) === rootScope.id && ['collection', 'context', 'workflow'].includes(item.kind)).map((item) => ({ type: 'scope' as const, id: item.id })),
      ...workspaces.filter((workspace) => workspace.scopeId === rootScope.id).map((workspace) => ({ type: 'workspace' as const, id: workspace.id })),
    ]
    const graphSemantic = semanticRefsForSourceIds(contextGraphResolvedIds, projectPresentationNodes)
    const workflowGraphSemantic = semanticRefsForSourceIds([
      ...workflowPresentationIds,
      ...projectEntityNodeIds(workflowPresentationEntityRefs, projectPresentationNodes),
      ...savedWorkflowViews.flatMap((view) => [...view.memberViewIds, ...(view.memberEntityNodeIds ?? []), `scope:${view.id}`]),
    ], projectPresentationNodes)
    const candidates: ProjectFocusLocationCandidate[] = [{
      key: 'canvas:root',
      kind: 'canvas',
      label: '主画布',
      memberViewIds: nodes.filter((node) => (node.scopeId ?? rootScope.id) === rootScope.id).map((node) => node.id),
      memberEntityRefs: rootEntityRefs,
      active: activeSurface === 'arrange' && workspaceId === null && scopeId === rootScope.id,
    }, {
      key: 'context-graph:root',
      kind: 'context-graph',
      label: 'Context Graph',
      memberViewIds: graphSemantic.viewIds,
      memberEntityRefs: graphSemantic.entityRefs,
      active: activeSurface === 'context-graph',
    }, {
      key: 'workflow-graph:root',
      kind: 'workflow-graph',
      label: 'Workflow Graph',
      memberViewIds: workflowGraphSemantic.viewIds,
      memberEntityRefs: workflowGraphSemantic.entityRefs,
      active: activeSurface === 'workflow' && activeWorkflowId === null,
    }]

    for (const collection of scopes.filter((item) => item.kind === 'collection')) {
      candidates.push({
        key: `collection:${collection.id}`,
        kind: 'collection',
        ownerId: collection.id,
        label: collection.label,
        memberViewIds: collectionMembersById[collection.id] ?? [],
        memberEntityRefs: collectionEntityRefsById[collection.id] ?? [],
        active: activeSurface === 'arrange' && expandedCollectionScopeIds.includes(collection.id),
      })
    }
    for (const context of scopes.filter((item) => item.kind === 'context')) {
      candidates.push({
        key: `context:${context.id}`,
        kind: 'context',
        ownerId: context.id,
        label: context.label,
        memberViewIds: contextMembersById[context.id] ?? [],
        memberEntityRefs: contextEntityRefsById[context.id] ?? [],
        active: activeContextId === context.id && (activeSurface === 'context-space' || activeSurface === 'context-flow' || activeSurface === 'context-tree' || activeSurface === 'outline'),
      })
    }
    for (const workflow of scopes.filter((item) => item.kind === 'workflow')) {
      candidates.push({
        key: `workflow:${workflow.id}`,
        kind: 'workflow',
        ownerId: workflow.id,
        label: workflow.label,
        memberViewIds: workflowMembersById[workflow.id] ?? [],
        memberEntityRefs: workflowEntityRefsById[workflow.id] ?? [],
        active: activeWorkflowId === workflow.id && activeSurface === 'workflow',
      })
    }
    for (const workspace of workspaces) {
      candidates.push({
        key: `workspace:${workspace.id}`,
        kind: 'workspace',
        ownerId: workspace.id,
        label: workspace.label,
        memberViewIds: workspaceMemberViewIdsById[workspace.id] ?? workspace.focusedViewIds,
        memberEntityRefs: workspaceEntityRefsById[workspace.id] ?? [],
        active: workspaceId === workspace.id && activeSurface === 'arrange',
      })
    }
    return candidates
  }, [activeContextId, activeSurface, activeWorkflowId, collectionEntityRefsById, collectionMembersById, contextEntityRefsById, contextGraphResolvedIds, contextMembersById, expandedCollectionScopeIds, nodes, projectPresentationNodes, rootScope.id, savedWorkflowViews, scopeId, scopes, workflowEntityRefsById, workflowMembersById, workflowPresentationEntityRefs, workflowPresentationIds, workspaceEntityRefsById, workspaceId, workspaceMemberViewIdsById, workspaces])

  const projectFocusSearchEntries = useMemo<ProjectFocusSearchEntry[]>(() => {
    const entries: ProjectFocusSearchEntry[] = []
    const artifacts = new Map<string, { title: string; kind: string; sourceIds: string[]; keywords: string[] }>()
    nodes.forEach((node) => {
      if (node.opensScopeId) return
      if (node.artifactId !== undefined) {
        const key = String(node.artifactId)
        const current = artifacts.get(key) ?? { title: node.title, kind: node.kind, sourceIds: [], keywords: [] }
        current.sourceIds.push(node.id)
        if (node.subtitle) current.keywords.push(node.subtitle)
        artifacts.set(key, current)
        return
      }
      entries.push({ key: `view:${node.id}`, title: node.title, kind: node.entityKind ?? node.kind, sourceIds: [node.id], keywords: node.subtitle ? [node.subtitle] : [] })
    })
    artifacts.forEach((artifact, id) => entries.push({
      key: `artifact:${id}`,
      title: artifact.title,
      kind: artifact.kind,
      sourceIds: [...new Set(artifact.sourceIds)],
      keywords: [...new Set(artifact.keywords)],
    }))
    scopes.filter((scope) => ['collection', 'context', 'workflow'].includes(scope.kind)).forEach((scope) => entries.push({
      key: `scope:${scope.id}`,
      title: scope.label,
      kind: scope.kind === 'collection' ? 'Collection' : scope.kind === 'context' ? 'Context' : 'Workflow',
      sourceIds: [`scope:${scope.id}`],
    }))
    workspaces.forEach((workspace) => entries.push({ key: `workspace:${workspace.id}`, title: workspace.label, kind: 'Workspace', sourceIds: [`workspace:${workspace.id}`] }))
    return entries
  }, [nodes, scopes, workspaces])

  const projectFocusSemantic = useMemo(() => semanticRefsForSourceIds(projectFocusSourceIds, projectPresentationNodes), [projectFocusSourceIds, projectPresentationNodes])
  const projectFocusLocations = useMemo(() => resolveProjectFocusLocations({
    focusViewIds: projectFocusSemantic.viewIds,
    focusEntityRefs: projectFocusSemantic.entityRefs,
    candidates: projectFocusCandidates,
  }), [projectFocusCandidates, projectFocusSemantic.entityRefs, projectFocusSemantic.viewIds])
  const projectFocusCount = projectFocusSemantic.viewIds.length + projectFocusSemantic.entityRefs.length

  const acceptContextMerge = useCallback((sourceContextId: string, targetContextId: string, additions: readonly string[]) => {
    const target = scopes.find((scope) => scope.id === targetContextId)
    if (target === undefined) { setNotice('目标 Context 已不存在，未做任何修改'); return }
    const sourceRefs = contextEntityRefsById[sourceContextId] ?? []
    const targetRefs = contextEntityRefsById[targetContextId] ?? []
    const targetRefKeys = new Set(targetRefs.map((ref) => `${ref.type}:${ref.id}`))
    const entityAdditions = sourceRefs.filter((ref) => !targetRefKeys.has(`${ref.type}:${ref.id}`))
    if (additions.length === 0 && entityAdditions.length === 0) { setNotice('目标已包含全部成员，无需合并'); return }
    void Promise.all([
      appendExactPresentationMembers('context', targetContextId, additions, contextMembersById[targetContextId] ?? []),
      appendExactPresentationEntityRefs('context', targetContextId, entityAdditions, 'context', targetRefs),
    ]).then(([members, refs]) => {
      if (members === null || refs === null) return
      setContextMembersById((current) => ({ ...current, [targetContextId]: members }))
      setContextEntityRefsById((current) => ({ ...current, [targetContextId]: refs }))
      if (activeContextId === targetContextId) { setContextPresentationIds(members); setContextPresentationEntityRefs(refs) }
      setNotice(`已把 ${additions.length + entityAdditions.length} 项加入「${target.label}」；原 Context 保持不变`)
    })
  }, [activeContextId, appendExactPresentationEntityRefs, appendExactPresentationMembers, contextEntityRefsById, contextMembersById, scopes])

  const enterScopeKeepingSelection = useCallback((targetScopeId: string, nextSelection: string[]) => {
    setActiveContextId(null)
    setActiveWorkflowId(null)
    const target = scopes.find((scope) => scope.id === targetScopeId) ?? (targetScopeId === workbenchScopeId ? { id: targetScopeId, label: '当前现场', camera: { x: 150, y: 88, zoom: 1 } } : null)
    setWorkspaceId(null)
    setScopeId(targetScopeId)
    if (target?.camera) setCamera(target.camera)
    setSelectedIds(nextSelection)
    setSelectedEdgeId(null)
    setLayoutPreview(null)
  }, [scopes, workbenchScopeId])

  const activateProjectRailView = useCallback((view: ProjectRailViewItem) => {
    if (view.kind === 'context' && view.scopeId) {
      setActiveWorkflowId(null)
      setActiveContextId(view.scopeId)
      setContextPresentationIds(contextMembersById[view.scopeId] ?? [])
      setContextPresentationEntityRefs(contextEntityRefsById[view.scopeId] ?? [])
      setSelectedIds([])
      setSelectedEdgeId(null)
      setActiveSurface('context-space')
      return
    }
    if (view.kind === 'workflow') {
      const ownerId = view.scopeId ?? rootScope.id
      setActiveContextId(null)
      setActiveWorkflowId(ownerId === rootScope.id ? null : ownerId)
      setWorkflowPresentationIds(ownerId === rootScope.id ? workflowPresentationIds : (workflowMembersById[ownerId] ?? view.memberViewIds ?? []))
      setWorkflowPresentationEntityRefs(ownerId === rootScope.id ? workflowPresentationEntityRefs : (workflowEntityRefsById[ownerId] ?? []))
      setSelectedIds([])
      setSelectedEdgeId(null)
      setActiveSurface('workflow')
      return
    }
    if (view.workspaceId) {
      openWorkspaceScene(view.workspaceId)
      return
    }
    if (view.scopeId) {
      const targetScope = scopes.find((scope) => scope.id === view.scopeId)
      if (targetScope?.kind === 'collection') {
        setActiveContextId(null)
        setActiveWorkflowId(null)
        setWorkspaceId(null)
        setScopeId(targetScope.parentScopeId ?? rootScope.id)
        setActiveSurface('arrange')
        toggleCollectionScope(targetScope.id)
        const containerId = targetScope.containerNodeId ?? nodes.find((node) => node.opensScopeId === targetScope.id)?.id
        if (containerId) setSelectedIds([containerId])
        setSelectedEdgeId(null)
        setNotice(expandedCollectionScopeIds.includes(targetScope.id) ? `已收起「${targetScope.label}」` : `已展开「${targetScope.label}」`)
        return
      }
      enterScopeKeepingSelection(view.scopeId, [])
      setActiveSurface('arrange')
    }
  }, [contextEntityRefsById, contextMembersById, enterScopeKeepingSelection, expandedCollectionScopeIds, nodes, openWorkspaceScene, rootScope.id, scopes, toggleCollectionScope, workflowEntityRefsById, workflowMembersById, workflowPresentationEntityRefs, workflowPresentationIds])

  const openSavedContextLens = useCallback((contextId: string, lens: 'space' | 'structure' | 'evolution' = 'space') => {
    const contextScope = scopes.find((scope) => scope.id === contextId && scope.kind === 'context')
    if (!contextScope) { setNotice('这个 Context 已不存在'); return }
    setActiveWorkflowId(null)
    setActiveContextId(contextId)
    setContextPresentationIds(contextMembersById[contextId] ?? [])
    setContextPresentationEntityRefs(contextEntityRefsById[contextId] ?? [])
    setSelectedIds([])
    setSelectedEdgeId(null)
    setActiveSurface(lens === 'structure' ? 'context-tree' : lens === 'evolution' ? 'context-flow' : 'context-space')
    setNotice(`已打开 Context「${contextScope.label}」${lens === 'structure' ? ' · 结构' : lens === 'evolution' ? ' · 演进' : ''}`)
  }, [contextEntityRefsById, contextMembersById, scopes])

  const openSavedContextView = useCallback((contextId: string) => {
    openSavedContextLens(contextId, 'space')
  }, [openSavedContextLens])

  const openContextProjectionLens = useCallback((node: CanvasNode, lens: 'space' | 'structure' | 'evolution') => {
    const contextId = node.opensScopeId
      ?? (node.id.startsWith('scope:') ? node.id.slice('scope:'.length) : scopes.find((scope) => scope.kind === 'context' && scope.containerNodeId === node.id)?.id)
    if (!contextId) { setNotice('这个 Context 投影缺少真实 owner'); return }
    openSavedContextLens(contextId, lens)
  }, [openSavedContextLens, scopes])

  const openSavedWorkflowView = useCallback((workflowId: string) => {
    const workflowScope = scopes.find((scope) => scope.id === workflowId && scope.kind === 'workflow')
    if (!workflowScope) { setNotice('这个 Workflow 已不存在'); return }
    setActiveContextId(null)
    setActiveWorkflowId(workflowId)
    setWorkflowPresentationIds(workflowMembersById[workflowId] ?? [])
    setWorkflowPresentationEntityRefs(workflowEntityRefsById[workflowId] ?? [])
    setSelectedIds([])
    setSelectedEdgeId(null)
    setActiveSurface('workflow')
    setNotice(`已打开 Workflow「${workflowScope.label}」`)
  }, [scopes, workflowEntityRefsById, workflowMembersById])

  const openProjectFocus = useCallback((sourceIds: readonly string[] = selectedIds, label?: string) => {
    const unique = [...new Set(sourceIds)]
    setProjectFocusSourceIds(unique)
    const titles = unique.map((id) => projectPresentationNodes.find((node) => node.id === id)?.title).filter((title): title is string => Boolean(title))
    setProjectFocusSourceLabel(label?.trim() || (titles.length <= 2 ? titles.join(' + ') : `${titles.slice(0, 2).join(' + ')} 等 ${unique.length} 项`))
    const anchor = unique.length === 1 && typeof document !== 'undefined'
      ? document.querySelector(`[data-node-id="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(unique[0]!) : unique[0]!.replace(/["\\]/g, '\\$&')}"]`)
      : null
    setProjectFocusAnchor(anchor)
    setProjectFocusListMode(false)
    setProjectFocusOpen(true)
  }, [projectPresentationNodes, selectedIds])

  const focusArtifactFromSearch = useCallback((artifactId: string, title: string) => {
    const sourceIds = nodes.filter((node) => String(node.artifactId) === String(artifactId)).map((node) => node.id)
    if (!sourceIds.length) {
      setNotice(`「${title}」存在于项目中，但目前没有可定位的 View`)
      return
    }
    openProjectFocus(sourceIds, title)
  }, [nodes, openProjectFocus])

  const navigateProjectFocus = useCallback((location: ProjectFocusLocation) => {
    const focusIds = [...new Set([...location.matchedViewIds, ...projectEntityNodeIds(location.matchedEntityRefs, projectPresentationNodes)])]
    if (location.kind === 'canvas') {
      activateOverview()
      const canvasRefIds = location.matchedEntityRefs.flatMap((ref) => {
        if (ref.type === 'scope') {
          const target = scopes.find((scope) => scope.id === ref.id)
          const id = target?.containerNodeId ?? nodes.find((node) => node.opensScopeId === ref.id)?.id
          return id ? [id] : []
        }
        return []
      })
      setProjectFocusRequest({ nonce: Date.now(), ids: [...new Set([...location.matchedViewIds, ...canvasRefIds])], targetTestId: 'canvas' })
    } else if (location.kind === 'workspace' && location.ownerId) {
      openWorkspaceScene(location.ownerId)
      setProjectFocusRequest({ nonce: Date.now(), ids: focusIds, targetTestId: 'canvas' })
    } else if (location.kind === 'collection' && location.ownerId) {
      const collection = scopes.find((scope) => scope.id === location.ownerId)
      const containerId = collection?.containerNodeId ?? nodes.find((node) => node.opensScopeId === location.ownerId)?.id ?? `scope:${location.ownerId}`
      setActiveContextId(null)
      setActiveWorkflowId(null)
      setWorkspaceId(null)
      setScopeId(collection?.parentScopeId ?? rootScope.id)
      openCollectionWithMotion(location.ownerId!)
      setActiveSurface('arrange')
      // The locator keeps the known Collection itself highlighted, while its
      // matched member Views remain selected when they are the actual hit.
      setSelectedEdgeId(null)
      setProjectFocusRequest({ nonce: Date.now(), ids: [...new Set([containerId, ...focusIds])], targetTestId: 'canvas' })
    } else if (location.kind === 'context-graph') {
      setActiveContextId(null)
      setActiveWorkflowId(null)
      setActiveSurface('context-graph')
      setSelectedIds(focusIds)
      setProjectFocusRequest({ nonce: Date.now(), ids: focusIds, targetTestId: 'context-graph-spatial' })
    } else if (location.kind === 'context' && location.ownerId) {
      openSavedContextView(location.ownerId)
      setSelectedIds(focusIds)
      setProjectFocusRequest({ nonce: Date.now(), ids: focusIds, targetTestId: 'context-space-spatial' })
    } else if (location.kind === 'workflow-graph') {
      setActiveContextId(null)
      setActiveWorkflowId(null)
      setActiveSurface('workflow')
      setSelectedIds(focusIds)
      setProjectFocusRequest({ nonce: Date.now(), ids: focusIds, targetTestId: 'workflow-graph-spatial' })
    } else if (location.kind === 'workflow' && location.ownerId) {
      openSavedWorkflowView(location.ownerId)
      setSelectedIds(focusIds)
      setProjectFocusRequest({ nonce: Date.now(), ids: focusIds, targetTestId: 'workflow-spatial' })
    }
    setProjectFocusOpen(false)
    setProjectFocusAnchor(null)
    setProjectFocusListMode(false)
    setNotice(`已定位到「${location.label}」· ${location.matchedCount}/${location.totalCount} 项`)
  }, [activateOverview, nodes, openCollectionWithMotion, openSavedContextView, openSavedWorkflowView, openWorkspaceScene, projectPresentationNodes, rootScope.id, safeInsets, scopes])

  // Legacy temporary-workbench remains readable for migration compatibility only.
  // New Context-history branching calls Core branchContextSnapshot (single truth:
  // collection scope + copied views); no local workspace reconstruction.


  const branchContextHistoryToWorkbench = useCallback((entry: ContextHistoryEntry) => {
    const snapshot = coreContextSnapshots.find((item) => String(item.id) === entry.id)
    if (snapshot === undefined) {
      setNotice('这条历史没有可恢复的保存记录，暂时无法从这里继续')
      return
    }
    if (!isRuntimeProjectMode(bootMode)) {
      setNotice('从历史建立分支需要本地项目服务')
      return
    }
    void bridgeRef.current.client.branchContextSnapshot(activeProjectId, String(snapshot.id), { label: `从 ${entry.label} 恢复` }).then(async (call) => {
      if (!call.result.ok) { setNotice(`分支失败：${call.result.error.message}`); return }
      const branched = call.result.value
      const loaded = await bridgeRef.current.loadProject()
      if (loaded.source !== 'runtime' || !loaded.state) {
        setNotice('分支已创建，但前端重新加载失败')
        return
      }
      resetGraph({ nodes: loaded.state.nodes, edges: loaded.state.edges })
      setWorkspaces(loaded.state.workspaces)
      setScopes(loaded.state.scopes)
      setActiveContextId(null)
      setActiveWorkflowId(null)
      setScopeId(branched.scopeId)
      setActiveSurface('arrange')
      setSelectedIds([...branched.viewIds])
      const branchedNodes = loaded.state.nodes.filter((node) => branched.viewIds.includes(node.id))
      const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
      const bounds = getSelectionBounds(branchedNodes, [...branched.viewIds])
      if (bounds) setCamera(fitBounds(bounds, viewport?.width ?? 1000, viewport?.height ?? 820, 70, safeInsets))
      setNotice(`已从 ${entry.label} 分支为工作集合 · ${branched.viewIds.length} 个视图；历史快照保持只读`)
    }).catch(() => setNotice('分支失败：本地项目服务暂时不可用'))
  }, [activeProjectId, bootMode, coreContextSnapshots, resetGraph, safeInsets, setCamera, setScopes, setWorkspaces])

  const compareContextHistory = useCallback((entry: ContextHistoryEntry) => {
    if (coreContextSnapshots.length > 1 && coreContextSnapshots.some((snapshot) => String(snapshot.id) === entry.id)) {
      const latest = coreContextSnapshots[coreContextSnapshots.length - 1]
      void bridgeRef.current.client.compareContextSnapshots(activeProjectId, entry.id, String(latest.id)).then((call) => {
        if (!call.result.ok) { setNotice(`对比失败：${call.result.error.message}`); return }
        const diff = call.result.value
        const targetIds = [...diff.added.focusedViewIds, ...diff.removed.focusedViewIds].filter((id) => nodes.some((node) => node.id === id))
        if (targetIds.length) setSelectedIds(targetIds)
        setActiveSurface('context-space')
        setNotice(`对比 ${entry.label} ↔ 最新：新增 ${diff.added.artifactIds.length} / 移除 ${diff.removed.artifactIds.length} / 不变 ${diff.kept.artifactIds.length} 对象`)
      })
      return
    }
    const sourceIds = entry.objectIds.filter((id) => nodes.some((node) => node.id === id))
    if (sourceIds.length) setSelectedIds(sourceIds)
    setActiveSurface('context-space')
    setNotice(`正在对比 ${entry.label} 与当前 Context；历史 Snapshot 保持只读`)
  }, [activeProjectId, coreContextSnapshots, nodes])

  const openContextHistorySource = useCallback((entry: ContextHistoryEntry) => {
    const node = entry.sourceNodeId ? nodes.find((item) => item.id === entry.sourceNodeId) : undefined
    if (!node) { setNotice(entry.sourceRunId ? '这条历史来自一次执行，但当前没有可定位的来源对象' : `${entry.label} 暂无可定位来源` ); return }
    if (node.scopeId && node.scopeId !== scopeId) setScopeId(node.scopeId)
    setSelectedIds([node.id])
    setActiveSurface(node.kind === 'process' ? 'workflow' : 'arrange')
    setNotice(`已定位 ${entry.label} 的来源「${node.title}」`)
  }, [nodes, scopeId])

  const saveWorkspaceEditor = useCallback(({ label }: { label: string }) => {
    const now = new Date().toISOString()
    if (!workspaceEditor?.id) return
    setWorkspaces((current) => updateWorkspaceRecord(current, workspaceEditor.id, { label }, now))
    setNotice('工作空间名称已更新')
    setWorkspaceEditor(null)
  }, [workspaceEditor])

  const duplicateWorkspace = useCallback((id: string) => {
    const result = duplicateWorkspaceRecord(workspaces, id, createId('workspace'), new Date().toISOString())
    if (!result.duplicate) return
    const duplicate: Workspace = { ...result.duplicate, scopeId: result.duplicate.scopeId ?? scopeId, focusedViewIds: [...(result.duplicate.focusedViewIds ?? [])], contextPolicy: result.duplicate.contextPolicy ?? 'workspace-related' }
    const entityRefs = workspaceEntityRefsById[id] ?? []
    setWorkspaces(result.workspaces.map((workspace) => workspace.id === duplicate.id ? duplicate : workspace))
    setNodes((current) => current.map((node) => node.workspaceIds?.includes(id) ? { ...node, workspaceIds: Array.from(new Set([...(node.workspaceIds ?? []), duplicate.id])) } : node))
    if (entityRefs.length) {
      setWorkspaceEntityRefsById((current) => ({ ...current, [duplicate.id]: entityRefs }))
      if (isRuntimeProjectMode(bootMode)) {
        void appendExactPresentationEntityRefs('custom', `workspace:${duplicate.id}`, entityRefs, 'workspace-scene', [], duplicate.scopeId)
          .then((refs) => { if (refs !== null) setWorkspaceEntityRefsById((current) => ({ ...current, [duplicate.id]: refs })) })
      }
    }
    setWorkspaceId(duplicate.id)
    setNotice('工作现场已复制，成员与 Camera 保持不变')
  }, [appendExactPresentationEntityRefs, bootMode, scopeId, setNodes, workspaces, workspaceEntityRefsById])

  const moveWorkspace = useCallback((id: string, direction: -1 | 1) => setWorkspaces((current) => moveWorkspaceRecord(current, id, direction)), [])

  const moveRailView = useCallback((viewId: string, direction: -1 | 1) => {
    const index = projectRailViews.findIndex((view) => (view.workspaceId ?? view.scopeId ?? view.id) === viewId)
    if (index < 0) return
    const target = index + direction
    if (target < 0 || target >= projectRailViews.length) return
    const next = [...projectRailViews]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    const orderedRefs = next.map((view) => ({
      kind: view.kind,
      viewId: view.workspaceId ?? view.scopeId ?? view.id,
    }))
    void bridgeRef.current.client.saveViewRailOrder(activeProjectId, orderedRefs, railOrder?.version ?? 0).then((call) => {
      if (!call.result.ok) {
        setNotice('视图顺序已在他处变化，已重新加载')
        void bridgeRef.current.client.viewRailOrder(activeProjectId).then((reload) => {
          if (reload.result.ok) setRailOrder(reload.result.value)
        })
        return
      }
      setRailOrder(call.result.value)
    })
  }, [activeProjectId, projectRailViews, railOrder])

  const reorderRailViewTo = useCallback((viewId: string, targetIndex: number) => {
    const index = projectRailViews.findIndex((view) => (view.workspaceId ?? view.scopeId ?? view.id) === viewId)
    if (index < 0 || index === targetIndex) return
    const bounded = Math.max(0, Math.min(projectRailViews.length - 1, targetIndex))
    const next = [...projectRailViews]
    const [item] = next.splice(index, 1)
    next.splice(bounded, 0, item)
    const orderedRefs = next.map((view) => ({
      kind: view.kind,
      viewId: view.workspaceId ?? view.scopeId ?? view.id,
    }))
    void bridgeRef.current.client.saveViewRailOrder(activeProjectId, orderedRefs, railOrder?.version ?? 0).then((call) => {
      if (!call.result.ok) {
        setNotice('视图顺序已在他处变化，已重新加载')
        void bridgeRef.current.client.viewRailOrder(activeProjectId).then((reload) => {
          if (reload.result.ok) setRailOrder(reload.result.value)
        })
        return
      }
      setRailOrder(call.result.value)
    })
  }, [activeProjectId, projectRailViews, railOrder])

  const renameRailWorkspace = useCallback((workspaceId: string, label: string) => {
    const now = new Date().toISOString()
    setWorkspaces((current) => updateWorkspaceRecord(current, workspaceId, { label }, now))
    setNotice('视图已重命名')
  }, [])

  const renameRailScope = useCallback((scopeId: string, label: string) => {
    const nextLabel = label.trim()
    if (!nextLabel) { setNotice('名称不能为空'); return }
    const now = new Date().toISOString()
    setScopes((current) => current.map((scope) => scope.id === scopeId ? { ...scope, label: nextLabel, updatedAt: now } : scope))
    // Collection identity has one user-facing name. Rail and canvas container are
    // two projections of the same Scope, never two independently renamed truths.
    setNodes((current) => current.map((node) => node.opensScopeId === scopeId ? { ...node, title: nextLabel } : node))
    setNotice('视图已重命名')
  }, [setNodes])

  const requestDeleteRailScope = useCallback((scopeId: string, label: string) => {
    setConfirmScopeDelete({ scopeId, label })
  }, [])

  const confirmDeleteRailScope = useCallback(() => {
    if (!confirmScopeDelete) return
    const targetScopeId = confirmScopeDelete.scopeId
    const removed = removeScopeTree(scopes, nodes, edges, targetScopeId)
    setScopes(removed.scopes)
    const removedScopeIds = new Set(removed.removedScopeIds)
    if (removedScopeIds.size) setWorkspaces((current) => current.map((workspace) => removedScopeIds.has(workspace.scopeId) ? { ...workspace, scopeId, focusedViewIds: [] } : workspace))
    setGraph({ nodes: removed.nodes, edges: removed.edges })
    clearSelection()
    setConfirmScopeDelete(null)
    setNotice(`已删除视图「${confirmScopeDelete.label}」及其画布`)
  }, [clearSelection, confirmScopeDelete, edges, nodes, scopeId, scopes, setGraph])

  const deleteWorkspace = useCallback((id: string) => { if (workspaces.length <= 1) setNotice('至少保留一个工作空间'); else setConfirmWorkspaceId(id) }, [workspaces.length])
  const confirmDeleteWorkspace = useCallback(() => {
    if (!confirmWorkspaceId) return
    const remaining = removeWorkspaceRecord(workspaces, confirmWorkspaceId)
    setWorkspaces(remaining)
    setWorkspaceEntityRefsById((current) => {
      const next = { ...current }
      delete next[confirmWorkspaceId]
      return next
    })
    setNodes((current) => current.map((node) => node.workspaceIds?.includes(confirmWorkspaceId) ? { ...node, workspaceIds: node.workspaceIds.filter((id) => id !== confirmWorkspaceId) } : node))
    if (workspaceId === confirmWorkspaceId) setWorkspaceId(null)
    clearSelection()
    setConfirmWorkspaceId(null)
    setNotice('工作现场已删除；项目对象本身保持不变')
  }, [clearSelection, confirmWorkspaceId, setNodes, workspaceId, workspaces])

  const addViewsToWorkspace = useCallback(async (targetWorkspaceId: string, viewIds: readonly string[], addedBy: 'user' | 'agent' | 'run' | 'import' = 'user') => {
    const uniqueIds = [...new Set(viewIds)]
    if (!uniqueIds.length) return false
    if (bootMode !== 'runtime') {
      const idSet = new Set(uniqueIds)
      setNodes((current) => current.map((node) => idSet.has(node.id)
        ? { ...node, workspaceIds: [...new Set([...(node.workspaceIds ?? []), targetWorkspaceId])] }
        : node))
      return true
    }
    const call = await bridgeRef.current.client.addWorkspaceMembers(targetWorkspaceId, { viewIds: uniqueIds, addedBy })
    if (!call.result.ok) {
      setNotice(`加入工作空间失败：${call.result.error.message}`)
      return false
    }
    applyMembershipProjection(call.result.value)
    return true
  }, [applyMembershipProjection, bootMode, setNodes])

  const createWorkflowPageDirect = useCallback((memberViewIds: readonly string[] = [], targetScopeId = scopeId, activate = true) => {
    const uniqueIds = [...new Set(memberViewIds)]
    const existingPages = workspaces.filter((workspace) => workspace.scopeId === targetScopeId && normalizeSurfaceId(workspace.preferredSurface) === 'workflow')
    const now = new Date().toISOString()
    const defaultLabel = existingPages.length === 0 ? 'Main Flow' : `Page ${String(existingPages.length + 1).padStart(2, '0')}`
    const base = createWorkspaceRecord({ id: createId('workspace'), label: defaultLabel, intent: null, camera: { x: 0, y: 0, zoom: 1 }, visibleLayers, now })
    const page: Workspace = {
      ...base,
      scopeId: targetScopeId,
      focusedViewIds: uniqueIds,
      contextPolicy: 'workspace-related',
      preferredSurface: 'workflow',
    }
    setWorkspaces((current) => [...current, page])
    if (uniqueIds.length) {
      const selected = new Set(uniqueIds)
      setNodes((current) => current.map((node) => selected.has(node.id)
        ? { ...node, workspaceIds: Array.from(new Set([...(node.workspaceIds ?? []), page.id])) }
        : node))
    }
    if (activate) {
      if (targetScopeId !== scopeId) setScopeId(targetScopeId)
      setWorkspaceId(page.id)
      setActiveSurface('workflow')
    }
    setNotice(uniqueIds.length ? `已建立 ${defaultLabel} 并加入 ${uniqueIds.length} 项` : `已建立 ${defaultLabel}`)
    return page.id
  }, [scopeId, setNodes, visibleLayers, workspaces])

  const createContextFromMembersDirect = useCallback((viewIds: readonly string[], requestedLabel?: string, entityRefs: readonly PresentationEntityRefV0[] = []) => {
    const uniqueIds = [...new Set(viewIds)].filter((id) => nodes.some((node) => node.id === id))
    const uniqueEntityRefs = [...new Map(entityRefs.map((ref) => [`${ref.type}:${ref.id}`, ref])).values()]
    if (!uniqueIds.length && !uniqueEntityRefs.length) return
    const label = requestedLabel?.trim() || `Context ${savedContextViews.length + 1}`
    const rootMembers = nodes.filter((node) => (node.scopeId ?? rootScope.id) === rootScope.id)
    const maxRight = rootMembers.reduce((value, node) => Math.max(value, node.x + node.width), 360)
    const result = createAggregateScopeEntity({
      parentScopeId: rootScope.id,
      label,
      kind: 'context',
      memberCount: uniqueIds.length + uniqueEntityRefs.length,
      containerPosition: { x: maxRight + 72, y: 160 + savedContextViews.length * 36 },
      createId,
    })
    const container = result.container
    const nextNodes = [...nodes, container]
    const nextScopes = [...scopes, result.scope]
    setGraph({ nodes: nextNodes, edges })
    setScopes(nextScopes)
    setContextMembersById((current) => ({ ...current, [result.scope.id]: uniqueIds }))
    setContextEntityRefsById((current) => ({ ...current, [result.scope.id]: uniqueEntityRefs }))

    const openCreatedContext = (members: string[], refs: PresentationEntityRefV0[]) => {
      setActiveContextId(result.scope.id)
      setContextPresentationIds(members)
      setContextPresentationEntityRefs(refs)
      setSelectedIds([])
      setSelectedEdgeId(null)
      setActiveSurface('context-space')
      setNotice(`已建立 ${label} · ${members.length} 项`)
    }

    const commitMembership = () => {
      void Promise.all([
        appendExactPresentationMembers('context', result.scope.id, uniqueIds, []),
        appendExactPresentationEntityRefs('context', result.scope.id, uniqueEntityRefs, 'context'),
        appendExactPresentationMembers('context', rootScope.id, [container.id], contextGraphPresentationIds),
      ]).then(([members, refs, graphMembers]) => {
        if (members === null || refs === null || graphMembers === null) return
        setContextMembersById((current) => ({ ...current, [result.scope.id]: members }))
        setContextEntityRefsById((current) => ({ ...current, [result.scope.id]: refs }))
        setContextGraphPresentationIds(graphMembers)
        openCreatedContext(members, refs)
      })
    }

    if (!isRuntimeProjectMode(bootMode)) {
      openCreatedContext(uniqueIds, uniqueEntityRefs)
      return
    }
    // Presentation rows have a foreign key to scopes. Commit the new Context
    // identity first, then save its exact cross-Scope membership.
    const snapshot: PersistedPrototypeState = {
      version: 10,
      projectId: activeProjectId,
      nodes: nextNodes,
      edges,
      workspaces,
      scopes: nextScopes,
      activeWorkspaceId: null,
      activeScopeId: rootScope.id,
      workRail,
    }
    void bridgeRef.current.saveMutations(snapshot).then((saved) => {
      if (saved.status !== 'saved') {
        setNotice(`上下文创建未完成：${saved.error ? humanizeRuntimeMessage(saved.error) : '本地项目服务暂时没有确认这次创建'}`)
        return
      }
      commitMembership()
    })
  }, [activeProjectId, appendExactPresentationEntityRefs, appendExactPresentationMembers, bootMode, contextGraphPresentationIds, edges, nodes, rootScope.id, savedContextViews.length, scopes, setGraph, workRail, workspaces])

  const createWorkflowFromMembersDirect = useCallback((viewIds: readonly string[], requestedLabel?: string, entityRefs: readonly PresentationEntityRefV0[] = []) => {
    const uniqueIds = [...new Set(viewIds)].filter((id) => nodes.some((node) => node.id === id))
    const uniqueEntityRefs = [...new Map(entityRefs.map((ref) => [`${ref.type}:${ref.id}`, ref])).values()]
    if (!uniqueIds.length && !uniqueEntityRefs.length) return
    const label = requestedLabel?.trim() || `Workflow ${savedWorkflowViews.length + 1}`
    const rootMembers = nodes.filter((node) => (node.scopeId ?? rootScope.id) === rootScope.id)
    const maxRight = rootMembers.reduce((value, node) => Math.max(value, node.x + node.width), 360)
    const result = createAggregateScopeEntity({
      parentScopeId: rootScope.id,
      label,
      kind: 'workflow',
      memberCount: uniqueIds.length + uniqueEntityRefs.length,
      containerPosition: { x: maxRight + 72, y: 320 + savedWorkflowViews.length * 36 },
      createId,
    })
    const container: CanvasNode = {
      ...result.container,
      kind: 'context',
      entityKind: 'workflow',
      contextOnly: false,
      subtitle: `${uniqueIds.length + uniqueEntityRefs.length} 个对象 · 双击打开 Workflow`,
    }
    const nextNodes = [...nodes, container]
    const nextScopes = [...scopes, result.scope]
    setGraph({ nodes: nextNodes, edges })
    setScopes(nextScopes)
    setWorkflowMembersById((current) => ({ ...current, [result.scope.id]: uniqueIds }))
    setWorkflowEntityRefsById((current) => ({ ...current, [result.scope.id]: uniqueEntityRefs }))

    const openCreatedWorkflow = (members: string[], refs: PresentationEntityRefV0[]) => {
      setActiveContextId(null)
      setActiveWorkflowId(result.scope.id)
      setWorkflowPresentationIds(members)
      setWorkflowPresentationEntityRefs(refs)
      setSelectedIds([])
      setSelectedEdgeId(null)
      setActiveSurface('workflow')
      setNotice(`已建立 ${label} · ${members.length} 项`)
    }

    const commitMembership = () => {
      void Promise.all([
        appendExactPresentationMembers('workflow', result.scope.id, uniqueIds, []),
        appendExactPresentationEntityRefs('workflow', result.scope.id, uniqueEntityRefs, 'workflow'),
      ]).then(([members, refs]) => {
        if (members === null || refs === null) return
        setWorkflowMembersById((current) => ({ ...current, [result.scope.id]: members }))
        setWorkflowEntityRefsById((current) => ({ ...current, [result.scope.id]: refs }))
        openCreatedWorkflow(members, refs)
      })
    }

    if (!isRuntimeProjectMode(bootMode)) {
      openCreatedWorkflow(uniqueIds, uniqueEntityRefs)
      return
    }
    const snapshot: PersistedPrototypeState = {
      version: 10,
      projectId: activeProjectId,
      nodes: nextNodes,
      edges,
      workspaces,
      scopes: nextScopes,
      activeWorkspaceId: null,
      activeScopeId: rootScope.id,
      workRail,
    }
    void bridgeRef.current.saveMutations(snapshot).then((saved) => {
      if (saved.status !== 'saved') {
        setNotice(`工作流创建未完成：${saved.error ? humanizeRuntimeMessage(saved.error) : '本地项目服务暂时没有确认这次创建'}`)
        return
      }
      commitMembership()
    })
  }, [activeProjectId, appendExactPresentationEntityRefs, appendExactPresentationMembers, bootMode, edges, nodes, rootScope.id, savedWorkflowViews.length, scopes, setGraph, workRail, workspaces])

  const createWorkspaceSceneFromDropPayload = useCallback((sourceIds: readonly string[]) => {
    // sourceIds is the payload frozen at semantic-drag start. Never read the
    // live Selection here: hover/focus changes cannot alter Scene membership.
    const normalized = semanticRefsForSourceIds(sourceIds, nodes)
    const viewIds = normalized.viewIds
    const entityRefs = normalized.entityRefs.filter((ref) => ref.id.trim().length > 0)
    if (!viewIds.length && !entityRefs.length) return false

    const scene = buildWorkspaceScene(viewIds)
    setWorkspaces((current) => [...current, scene])
    if (viewIds.length) {
      const members = new Set(viewIds)
      setNodes((current) => current.map((node) => members.has(node.id)
        ? { ...node, workspaceIds: [...new Set([...(node.workspaceIds ?? []), scene.id])] }
        : node))
    }
    setWorkspaceEntityRefsById((current) => ({ ...current, [scene.id]: entityRefs }))
    if (entityRefs.length && isRuntimeProjectMode(bootMode)) {
      void appendExactPresentationEntityRefs('custom', `workspace:${scene.id}`, entityRefs, 'workspace-scene', [], scene.scopeId)
        .then((refs) => { if (refs !== null) setWorkspaceEntityRefsById((current) => ({ ...current, [scene.id]: refs })) })
    }
    setActiveContextId(null)
    setActiveWorkflowId(null)
    setScopeId(scene.scopeId)
    setWorkspaceId(null)
    setLayoutPreview(null)
    setSelectedEdgeId(null)
    setActiveSurface('arrange')
    clearSelection()
    setNotice(`已把 ${viewIds.length + entityRefs.length} 项收进现场「${scene.label}」；主画布保留 Scene 实体`)
    return true
  }, [appendExactPresentationEntityRefs, bootMode, buildWorkspaceScene, clearSelection, nodes, setNodes])

  const mapCanvasObjectsToConversation = useCallback((conversationSessionId: string, sourceIds: readonly string[]) => {
    if (!isRuntimeProjectMode(bootMode)) { setNotice('真实项目中才能把材料长期交给对话'); return }
    const receiver = selectionReceiverChoices.find((item) => item.conversationSessionId === conversationSessionId)
    if (!receiver) { setNotice('这段对话还没有完成连接；先连接后才能长期使用这些材料'); return }
    const semantic = semanticRefsForSourceIds(sourceIds, nodes)
    const sourceRefs: AssemblySourceRefV1[] = semantic.viewIds.map((id) => ({ kind: 'artifactView', id }))
    const unresolved: PresentationEntityRefV0[] = []
    for (const ref of semantic.entityRefs) {
      if (ref.type === 'workspace') { sourceRefs.push({ kind: 'scene', id: ref.id }); continue }
      if (ref.type === 'conversation') {
        const linked = selectionReceiverChoices.find((item) => item.conversationSessionId === ref.id)
        if (linked) sourceRefs.push({ kind: 'conversation', id: linked.id })
        else unresolved.push(ref)
        continue
      }
      if (ref.type === 'scope') {
        const owner = nodes.find((node) => node.opensScopeId === ref.id || node.id === `scope:${ref.id}`)
        if (owner?.entityKind === 'context') sourceRefs.push({ kind: 'context', id: ref.id })
        else if (owner?.entityKind === 'workflow') sourceRefs.push({ kind: 'workflow', id: ref.id })
        else if (owner?.entityKind === 'collection') sourceRefs.push({ kind: 'collection', id: ref.id })
        else unresolved.push(ref)
        continue
      }
      if (ref.type === 'note') { sourceRefs.push({ kind: 'note', id: ref.id }); continue }
      unresolved.push(ref)
    }
    const unique = [...new Map(sourceRefs.map((ref) => [`${ref.kind}:${ref.id}`, ref])).values()]
    if (!unique.length) { setNotice('这些对象目前还没有可安全写入对话的来源身份'); return }
    void bridgeRef.current.client.applyAssembly(activeProjectId, {
      schemaVersion: 1,
      sourceRefs: unique,
      targetRef: { kind: 'conversation', id: receiver.id },
    }).then((call) => {
      if (!call.result.ok) { setNotice(`给这段对话失败：${humanizeRuntimeMessage(call.result.error.message)}`); return }
      const applied = call.result.value.results.filter((item) => item.status === 'applied' || item.status === 'skipped').length
      const failed = call.result.value.results.length - applied + unresolved.length
      setNotice(failed ? `已给这段对话 ${applied} 项；另有 ${failed} 项没有猜测身份` : `已给这段对话 ${applied} 项`)
    }).catch((error: unknown) => setNotice(`给这段对话失败：${humanizeRuntimeMessage(error instanceof Error ? error.message : String(error))}`))
  }, [activeProjectId, bootMode, nodes, selectionReceiverChoices])

  const directDropToProjectRailView = useCallback((targetViewId: string, sourceIds: readonly string[]) => {
    if (targetViewId === NEW_SCENE_DROP_TARGET_ID) {
      createWorkspaceSceneFromDropPayload(sourceIds)
      return
    }
    const { viewIds, entityRefs } = semanticRefsForSourceIds(sourceIds, nodes)
    if (!viewIds.length && !entityRefs.length) return

    if (targetViewId === ARRANGE_SURFACE_DROP_TARGET_ID) {
      if (!workspaceId) {
        setSelectedIds([...viewIds, ...projectEntityNodeIds(entityRefs, nodes)])
        setNotice(`已在整理中定位 ${viewIds.length + entityRefs.length} 个项目对象；没有复制或展开成员`)
        return
      }
      const workspace = workspaces.find((item) => item.id === workspaceId)
      if (!workspace) return
      void Promise.all([
        viewIds.length ? addViewsToWorkspace(workspace.id, viewIds, 'user') : Promise.resolve(true),
        entityRefs.length ? appendExactPresentationEntityRefs('custom', `workspace:${workspace.id}`, entityRefs, 'workspace-scene', workspaceEntityRefsById[workspace.id] ?? [], workspace.scopeId) : Promise.resolve(workspaceEntityRefsById[workspace.id] ?? []),
      ]).then(([viewsOk, refs]) => {
        if (!viewsOk || refs === null) return
        setWorkspaceEntityRefsById((current) => ({ ...current, [workspace.id]: refs }))
        setNotice(`已在当前 Scene 使用 ${viewIds.length + entityRefs.length} 个项目对象；没有创建子 Scene`)
      })
      return
    }
    if (targetViewId === CONTEXT_GRAPH_SURFACE_DROP_TARGET_ID || targetViewId === CONTEXT_SURFACE_DROP_TARGET_ID) {
      const ownerId = targetViewId === CONTEXT_SURFACE_DROP_TARGET_ID ? activeContextId : rootScope.id
      if (!ownerId) return
      const currentMembers = ownerId === rootScope.id ? contextGraphPresentationIds : (contextMembersById[ownerId] ?? [])
      const currentRefs = ownerId === rootScope.id ? contextGraphEntityRefs : (contextEntityRefsById[ownerId] ?? [])
      void Promise.all([
        appendExactPresentationMembers('context', ownerId, viewIds, currentMembers),
        appendExactPresentationEntityRefs('context', ownerId, entityRefs, ownerId === rootScope.id ? 'context-graph' : 'context', currentRefs),
      ]).then(([members, refs]) => {
        if (members === null || refs === null) return
        if (ownerId === rootScope.id) { setContextGraphPresentationIds(members); setContextGraphEntityRefs(refs) }
        else {
          setContextMembersById((current) => ({ ...current, [ownerId]: members }))
          setContextEntityRefsById((current) => ({ ...current, [ownerId]: refs }))
          if (activeContextId === ownerId) { setContextPresentationIds(members); setContextPresentationEntityRefs(refs) }
        }
        setNotice(`已作为引用加入 Context · ${viewIds.length + entityRefs.length} 项`)
      })
      return
    }
    if (targetViewId === WORKFLOW_GRAPH_SURFACE_DROP_TARGET_ID || targetViewId === WORKFLOW_SURFACE_DROP_TARGET_ID) {
      const ownerId = targetViewId === WORKFLOW_SURFACE_DROP_TARGET_ID ? (activeWorkflowId ?? rootScope.id) : rootScope.id
      const currentMembers = ownerId === rootScope.id ? workflowPresentationIds : (workflowMembersById[ownerId] ?? [])
      const currentRefs = ownerId === rootScope.id ? workflowPresentationEntityRefs : (workflowEntityRefsById[ownerId] ?? [])
      void Promise.all([
        appendExactPresentationMembers('workflow', ownerId, viewIds, currentMembers),
        appendExactPresentationEntityRefs('workflow', ownerId, entityRefs, 'workflow', currentRefs),
      ]).then(([members, refs]) => {
        if (members === null || refs === null) return
        setWorkflowPresentationIds(members)
        setWorkflowPresentationEntityRefs(refs)
        if (ownerId !== rootScope.id) {
          setWorkflowMembersById((current) => ({ ...current, [ownerId]: members }))
          setWorkflowEntityRefsById((current) => ({ ...current, [ownerId]: refs }))
        }
        setNotice(`已作为引用加入 Workflow · ${viewIds.length + entityRefs.length} 项`)
      })
      return
    }

    if (targetViewId === 'capability:context' || targetViewId === 'generate:context') {
      createContextFromMembersDirect(viewIds, undefined, entityRefs)
      return
    }
    if (targetViewId === 'capability:workflow' || targetViewId === 'generate:workflow') {
      createWorkflowFromMembersDirect(viewIds, undefined, entityRefs)
      return
    }

    const target = projectRailViews.find((view) => view.id === targetViewId)
    if (!target) return

    if (target.kind === 'context' && target.scopeId) {
      void Promise.all([
        appendExactPresentationMembers('context', target.scopeId, viewIds, contextMembersById[target.scopeId] ?? target.memberViewIds ?? []),
        appendExactPresentationEntityRefs('context', target.scopeId, entityRefs, 'context', contextEntityRefsById[target.scopeId] ?? []),
      ]).then(([members, refs]) => {
        if (members === null || refs === null) return
        setContextMembersById((current) => ({ ...current, [target.scopeId!]: members }))
        setContextEntityRefsById((current) => ({ ...current, [target.scopeId!]: refs }))
        if (activeContextId === target.scopeId) {
          setContextPresentationIds(members)
          setContextPresentationEntityRefs(refs)
        }
        setNotice(`已加入「${target.title}」 · ${viewIds.length + entityRefs.length} 项`)
      })
      return
    }

    if (target.kind === 'workflow') {
      const ownerId = target.scopeId ?? rootScope.id
      void Promise.all([
        appendExactPresentationMembers('workflow', ownerId, viewIds, target.memberViewIds ?? []),
        appendExactPresentationEntityRefs('workflow', ownerId, entityRefs, 'workflow', ownerId === rootScope.id ? workflowPresentationEntityRefs : (workflowEntityRefsById[ownerId] ?? [])),
      ]).then(([members, refs]) => {
        if (members === null || refs === null) return
        if (ownerId === rootScope.id) {
          setWorkflowPresentationIds(members)
          setWorkflowPresentationEntityRefs(refs)
        } else {
          setWorkflowMembersById((current) => ({ ...current, [ownerId]: members }))
          setWorkflowEntityRefsById((current) => ({ ...current, [ownerId]: refs }))
        }
        if (activeWorkflowId === ownerId) {
          setWorkflowPresentationIds(members)
          setWorkflowPresentationEntityRefs(refs)
        }
        setNotice(`已加入「${target.title}」 · ${viewIds.length + entityRefs.length} 项`)
      })
      return
    }

    if (target.workspaceId) {
      const workspace = workspaces.find((item) => item.id === target.workspaceId)
      if (!workspace) { setNotice('目标工作现场已不存在'); return }
      const viewTask = viewIds.length ? addViewsToWorkspace(target.workspaceId, viewIds, 'user') : Promise.resolve(true)
      const refTask = entityRefs.length
        ? appendExactPresentationEntityRefs('custom', `workspace:${target.workspaceId}`, entityRefs, 'workspace-scene', workspaceEntityRefsById[target.workspaceId] ?? [], workspace.scopeId)
        : Promise.resolve(workspaceEntityRefsById[target.workspaceId] ?? [])
      void Promise.all([viewTask, refTask]).then(([viewsOk, refs]) => {
        if (!viewsOk || refs === null) return
        setWorkspaceEntityRefsById((current) => ({ ...current, [target.workspaceId!]: refs }))
        setNotice(`已加入「${target.title}」 · ${viewIds.length + entityRefs.length} 项`)
      })
      return
    }

    if (target.scopeId) {
      const ownerId = target.scopeId
      const currentViews = collectionMembersById[ownerId] ?? []
      const currentRefs = collectionEntityRefsById[ownerId] ?? []
      if (!isRuntimeProjectMode(bootMode)) {
        const nextViews = [...new Set([...currentViews, ...viewIds])]
        const nextRefs = [...new Map([...currentRefs, ...entityRefs].map((ref) => [`${ref.type}:${ref.id}`, ref])).values()]
        setCollectionMembersById((current) => ({ ...current, [ownerId]: nextViews }))
        setCollectionEntityRefsById((current) => ({ ...current, [ownerId]: nextRefs }))
        setNotice(`已加入「${target.title}」 · ${viewIds.length + entityRefs.length} 项`)
        return
      }
      void Promise.all([
        appendProjectPresentationMembers({
          client: bridgeRef.current.client,
          projectId: activeProjectId,
          ownerId,
          capability: 'custom',
          renderer: 'collection',
        }, viewIds, currentViews),
        appendExactPresentationEntityRefs('custom', ownerId, entityRefs, 'collection', currentRefs),
      ]).then(([memberResult, refs]) => {
        if (!memberResult.ok || refs === null) { setNotice(`加入集合失败：${memberResult.ok ? '本地项目服务暂时没有确认这次加入' : humanizeRuntimeMessage(memberResult.message ?? '本地项目服务暂时不可用')}`); return }
        setCollectionMembersById((current) => ({ ...current, [ownerId]: memberResult.memberViewIds }))
        setCollectionEntityRefsById((current) => ({ ...current, [ownerId]: refs }))
        setNotice(`已加入「${target.title}」 · ${viewIds.length + entityRefs.length} 项`)
      })
    }
  }, [activeContextId, activeProjectId, activeWorkflowId, addViewsToWorkspace, appendExactPresentationEntityRefs, appendExactPresentationMembers, bootMode, collectionEntityRefsById, collectionMembersById, contextEntityRefsById, contextGraphEntityRefs, contextGraphPresentationIds, contextMembersById, createContextFromMembersDirect, createWorkflowFromMembersDirect, createWorkspaceSceneFromDropPayload, nodes, projectRailViews, rootScope.id, workflowEntityRefsById, workflowPresentationEntityRefs, workflowPresentationIds, workspaceEntityRefsById, workspaceId, workspaces])

  const addMembersToSavedContext = useCallback((contextId: string, sourceIds: readonly string[]) => {
    const target = savedContextViews.find((view) => view.id === contextId)
    if (!target) { setNotice('目标 Context 已不存在'); return }
    const semantic = semanticRefsForSourceIds(sourceIds, projectPresentationNodes)
    if (!semantic.viewIds.length && !semantic.entityRefs.length) return
    void Promise.all([
      appendExactPresentationMembers('context', contextId, semantic.viewIds, target.memberViewIds),
      appendExactPresentationEntityRefs('context', contextId, semantic.entityRefs, 'context', contextEntityRefsById[contextId] ?? []),
    ]).then(([members, refs]) => {
      if (members === null || refs === null) return
      setContextMembersById((current) => ({ ...current, [contextId]: members }))
      setContextEntityRefsById((current) => ({ ...current, [contextId]: refs }))
      if (activeContextId === contextId) {
        setContextPresentationIds(members)
        setContextPresentationEntityRefs(refs)
      }
      setNotice(`已加入「${target.title}」 · ${semantic.viewIds.length + semantic.entityRefs.length} 项`)
    })
  }, [activeContextId, appendExactPresentationEntityRefs, appendExactPresentationMembers, contextEntityRefsById, projectPresentationNodes, savedContextViews])

  const addSelectionToActiveWorkspace = useCallback(() => {
    if (!workspaceId) { setNotice('先激活一个工作空间'); return }
    if (!selectedIds.length) { setNotice('先选择要加入工作现场的对象'); return }
    const workspace = workspaces.find((item) => item.id === workspaceId)
    if (!workspace) { setNotice('当前工作现场已不存在'); return }
    const semantic = semanticRefsForSourceIds(selectedIds, projectPresentationNodes)
    const viewTask = semantic.viewIds.length ? addViewsToWorkspace(workspaceId, semantic.viewIds, 'user') : Promise.resolve(true)
    const refTask = semantic.entityRefs.length
      ? appendExactPresentationEntityRefs('custom', `workspace:${workspaceId}`, semantic.entityRefs, 'workspace-scene', workspaceEntityRefsById[workspaceId] ?? [], workspace.scopeId)
      : Promise.resolve(workspaceEntityRefsById[workspaceId] ?? [])
    void Promise.all([viewTask, refTask]).then(([viewsOk, refs]) => {
      if (!viewsOk || refs === null) return
      setWorkspaceEntityRefsById((current) => ({ ...current, [workspaceId]: refs }))
      setNotice(`已将 ${semantic.viewIds.length + semantic.entityRefs.length} 项加入「${workspace.label}」`)
    })
  }, [addViewsToWorkspace, appendExactPresentationEntityRefs, projectPresentationNodes, selectedIds, workspaceEntityRefsById, workspaceId, workspaces])

  const removeSelectionFromActiveWorkspace = useCallback(() => {
    if (!workspaceId) { setNotice('先激活一个工作空间'); return }
    if (!selectedIds.length) { setNotice('先选择要移出的对象'); return }
    const workspace = workspaces.find((item) => item.id === workspaceId)
    if (!workspace) { setNotice('当前工作现场已不存在'); return }
    const semantic = semanticRefsForSourceIds(selectedIds, projectPresentationNodes)
    const removeViews = async (): Promise<boolean> => {
      if (!semantic.viewIds.length) return true
      if (bootMode !== 'runtime') {
        const idSet = new Set(semantic.viewIds)
        setNodes((current) => current.map((node) => idSet.has(node.id)
          ? { ...node, workspaceIds: (node.workspaceIds ?? []).filter((id) => id !== workspaceId) }
          : node))
        return true
      }
      const calls = await Promise.all(semantic.viewIds.map((viewId) => bridgeRef.current.client.removeWorkspaceMember(workspaceId, viewId)))
      const failed = calls.find((call) => !call.result.ok)
      if (failed && !failed.result.ok) { setNotice(`移出工作现场失败：${failed.result.error.message}`); return false }
      const memberships = calls.at(-1)
      if (memberships?.result.ok) applyMembershipProjection(memberships.result.value)
      return true
    }
    const removeRefs = semantic.entityRefs.length
      ? removeExactPresentationEntityRefs('custom', `workspace:${workspaceId}`, semantic.entityRefs, 'workspace-scene', workspaceEntityRefsById[workspaceId] ?? [], workspace.scopeId)
      : Promise.resolve(workspaceEntityRefsById[workspaceId] ?? [])
    void Promise.all([removeViews(), removeRefs]).then(([viewsOk, refs]) => {
      if (!viewsOk || refs === null) return
      setWorkspaceEntityRefsById((current) => ({ ...current, [workspaceId]: refs }))
      setNotice(`已从「${workspace.label}」移出 ${semantic.viewIds.length + semantic.entityRefs.length} 项；项目对象本身保持不变`)
    })
  }, [applyMembershipProjection, bootMode, projectPresentationNodes, removeExactPresentationEntityRefs, selectedIds, setNodes, workspaceEntityRefsById, workspaceId, workspaces])

  const moveSelectionToWorkspace = useCallback((toWorkspaceId: string) => {
    if (!workspaceId) { setNotice('先激活所选内容当前所属的工作空间'); return }
    if (!selectedIds.length) { setNotice('先选择要移动的内容'); return }
    const targetWorkspace = workspaces.find((workspace) => workspace.id === toWorkspaceId)
    if (!targetWorkspace) { setNotice('目标工作空间不存在'); return }
    if (bootMode !== 'runtime') {
      const idSet = new Set(selectedIds)
      setNodes((current) => current.map((node) => idSet.has(node.id)
        ? { ...node, workspaceIds: [...new Set((node.workspaceIds ?? []).filter((id) => id !== workspaceId).concat(toWorkspaceId))] }
        : node))
      setWorkspaceId(toWorkspaceId)
      setNotice(`已将 ${selectedIds.length} 项移动到「${targetWorkspace.label}」`)
      return
    }
    void Promise.all(selectedIds.map((viewId) => bridgeRef.current.client.moveWorkspaceMember(workspaceId, { viewId, toWorkspaceId }))).then((calls) => {
      const failed = calls.find((call) => !call.result.ok)
      if (failed && !failed.result.ok) { setNotice(`移动工作空间失败：${failed.result.error.message}`); return }
      const memberships = calls.at(-1)
      if (memberships?.result.ok) applyMembershipProjection(memberships.result.value)
      setWorkspaceId(toWorkspaceId)
      setNotice(`已将 ${selectedIds.length} 项移动到「${targetWorkspace.label}」`)
    })
  }, [applyMembershipProjection, bootMode, selectedIds, setNodes, workspaceId, workspaces])

  const loadWorkspaceStates = useCallback((requestedWorkspaceId?: string) => {
    const targetWorkspaceId = requestedWorkspaceId ?? workspaceStatesWorkspaceId ?? workspaceId
    if (!targetWorkspaceId) { setWorkspaceStatesError('先激活一个工作空间'); return }
    if (bootMode !== 'runtime') {
      setWorkspaceStates([])
      setWorkspaceStatesLoading(false)
      setWorkspaceStatesError('演示模式不保存工作现场历史；打开真实项目后可查看记录。')
      return
    }
    setWorkspaceStatesLoading(true)
    setWorkspaceStatesError(undefined)
    void bridgeRef.current.client.listWorkspaceStates(targetWorkspaceId).then((call) => {
      if (!call.result.ok) {
        setWorkspaceStatesError(call.result.error.message)
        return
      }
      setWorkspaceStates(parseWorkspaceStates(call.result.value))
    }).finally(() => setWorkspaceStatesLoading(false))
  }, [bootMode, workspaceId, workspaceStatesWorkspaceId])

  const openWorkspaceStates = useCallback((requestedWorkspaceId?: string) => {
    const targetWorkspaceId = requestedWorkspaceId ?? workspaceId
    const targetWorkspace = workspaces.find((workspace) => workspace.id === targetWorkspaceId)
    if (!targetWorkspaceId || !targetWorkspace) { setNotice('先激活一个工作空间，再查看工作现场'); return }
    setWorkspaceStatesWorkspaceId(targetWorkspaceId)
    setWorkspaceStatesOpen(true)
    setWorkspaceStates([])
    setWorkspaceStatesError(undefined)
    loadWorkspaceStates(targetWorkspaceId)
  }, [loadWorkspaceStates, workspaceId, workspaces])

  const saveCurrentWorkspaceState = useCallback((requestedWorkspaceId?: string, customName?: string) => {
    const targetWorkspaceId = requestedWorkspaceId ?? workspaceStatesWorkspaceId ?? workspaceId
    const targetWorkspace = workspaces.find((workspace) => workspace.id === targetWorkspaceId)
    if (!targetWorkspaceId || !targetWorkspace) { setNotice('先激活一个工作空间，再保存工作现场'); return }
    if (bootMode !== 'runtime') {
      setNotice(`Demo 模式未写入「${targetWorkspace.label}」工作现场`)
      return
    }
    const name = customName?.trim() || `${targetWorkspace.label} · ${new Date().toLocaleString()}`
    setWorkspaceStateSaving(true)
    void bridgeRef.current.client.saveWorkspaceState(targetWorkspaceId, name).then((call) => {
      if (call.result.ok) {
        setNotice(`已保存工作现场：${name}`)
        if (workspaceStatesOpen) loadWorkspaceStates(targetWorkspaceId)
      } else {
        setNotice(`保存工作现场失败：${call.result.error.message}`)
        setWorkspaceStatesError(call.result.error.message)
      }
    }).finally(() => setWorkspaceStateSaving(false))
  }, [bootMode, loadWorkspaceStates, workspaceId, workspaceStatesOpen, workspaceStatesWorkspaceId, workspaces])

  const restoreSavedWorkspaceState = useCallback((stateId: string) => {
    const targetWorkspaceId = workspaceStatesWorkspaceId ?? workspaceId
    if (!targetWorkspaceId || bootMode !== 'runtime') return
    setWorkspaceStateRestoringId(stateId)
    setWorkspaceStatesError(undefined)
    void bridgeRef.current.client.restoreWorkspaceState(targetWorkspaceId, stateId).then(async (call) => {
      if (!call.result.ok) {
        setWorkspaceStatesError(call.result.error.message)
        return
      }
      const loaded = await bridgeRef.current.loadProject()
      if (loaded.source !== 'runtime' || !loaded.state) {
        setWorkspaceStatesError(loaded.error ?? '工作现场已恢复，但前端重新加载失败')
        return
      }
      resetGraph({ nodes: loaded.state.nodes, edges: loaded.state.edges })
      setWorkspaces(loaded.state.workspaces)
      setScopes(loaded.state.scopes)
      setWorkspaceId(loaded.state.workspaces.some((workspace) => workspace.id === targetWorkspaceId) ? targetWorkspaceId : null)
      const restoredWorkspace = loaded.state.workspaces.find((workspace) => workspace.id === targetWorkspaceId)
      if (restoredWorkspace) {
        setScopeId(restoredWorkspace.scopeId)
        setCamera(restoredWorkspace.camera)
      }
      const memberships = await bridgeRef.current.client.workspaceMemberships(activeProjectId)
      if (memberships.result.ok) applyMembershipProjection(memberships.result.value)
      await syncProcessProjection()
      setWorkspaceStatesOpen(false)
      setNotice('已恢复工作现场；后续版本和执行记录未被删除')
    }).finally(() => setWorkspaceStateRestoringId(null))
  }, [activeProjectId, applyMembershipProjection, bootMode, resetGraph, syncProcessProjection, workspaceId, workspaceStatesWorkspaceId])

  const toggleLayer = useCallback((layer: NodeLayer) => {
    if (!workspaceId) {
      setOverviewLayers((current) => current.includes(layer) ? current.length > 1 ? current.filter((item) => item !== layer) : current : [...current, layer])
      return
    }
    setWorkspaces((current) => toggleWorkspaceLayer(current, workspaceId, layer, new Date().toISOString()))
  }, [workspaceId])

  const handlePresentationInteractionChange = useCallback((active: boolean) => {
    presentationInteractionRef.current = active
  }, [])
  const handlePresentationCommit = useCallback(() => {
    presentationInteractionRef.current = false
    setPresentationCommit((current) => current + 1)
  }, [])

  const saveNoteBody = useCallback((id: string, input: { title: string; body: string }) => {
    const { title, body } = input
    if (!title.trim()) { setNotice('标题不能为空'); return }
    setNodes((current) => current.map((node) => node.id === id ? {
      ...node,
      title: title.trim(),
      subtitle: body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(1).join(' ').trim().slice(0, 24),
      noteBody: body,
      // 导图模式：大纲与正文同源（body 就是无标题行的大纲，标题独立做根）。
      ...(node.noteLayout === 'mindmap' ? { noteOutline: body } : {}),
    } : node))
    const edited = nodes.find((item) => item.id === id)
    // 会话级正文记忆：runtime text artifact 的 body 更新在 Core revision API 落地前
    // 是 presentation-local 的，存这里防刷新丢失（含导图大纲）。
    rememberNotePresentation(id, edited?.noteLayout === 'mindmap' ? { noteOutline: body, noteBody: body } : { noteBody: body })
    setNoteEditorId(null)
    // Runtime artifact title sync (body updates are presentation-local until
    // a Core text-revision API lands; recorded as known debt, not blocking).
    const node = nodes.find((item) => item.id === id)
    if (bootMode === 'runtime' && node?.artifactId && node.title !== title.trim()) {
      void bridgeRef.current.client.updateEntityTitle('artifact', node.artifactId, { title: title.trim(), mode: 'manual', generatedBy: 'user' }).catch(() => undefined)
    }
    setNotice('文本已保存')
  }, [bootMode, nodes, setNodes])

  /** 投影/本体冲突的落地动作：复制一个本地可编辑副本节点，并连一条「引用」边指向原投影。 */
  const confirmForkProjection = useCallback(() => {
    const source = forkPromptId ? nodes.find((node) => node.id === forkPromptId) : undefined
    setForkPromptId(null)
    if (!source) return
    const forkId = createId('note')
    const body = source.noteBody ?? source.previewText ?? ''
    const fork: CanvasNode = {
      id: forkId,
      kind: 'note',
      title: source.title,
      subtitle: '引用副本 · 本地可编辑',
      x: source.x + 48,
      y: source.y + 64,
      width: source.width,
      height: source.height,
      displayMode: source.displayMode ?? 'standard',
      noteBody: body,
      scopeId: source.scopeId,
      createdAt: new Date().toISOString(),
      workspaceIds: source.workspaceIds ?? [],
    }
    setNodes((current) => [...current, fork])
    setEdges((current) => [...current, {
      id: createId('edge'),
      from: forkId,
      to: source.id,
      kind: 'reference',
      label: '引用',
      scope: 'presentation',
      origin: 'user',
    }])
    setSelectedIds([forkId])
    setNoteEditorId(forkId)
    setNotice('已复制为引用副本，在副本上编辑')
  }, [forkPromptId, nodes, setEdges, setNodes])

  const toggleNoteLayout = useCallback((id: string, layout: 'text' | 'mindmap', override?: { title: string; body: string }) => {
    // 统一文本体系：note 与 markdown 文本 artifact 都能转导图（PDF/图片等非文本除外）。
    const isTextual = (node: CanvasNode) => node.kind === 'note' || node.fileType === 'markdown'
    const target = nodes.find((node) => node.id === id && isTextual(node))
    // 标题独立做根；noteOutline 不含标题行（正文首行与标题重复时剥掉）。
    const stripTitleLine = (text: string, title: string) => text.startsWith(title)
      ? text.slice(title.length).replace(/^\r?\n/, '')
      : text
    // override = 编辑器里尚未保存的最新内容（编辑器内直接转导图）。
    // markdown 投影的正文可能只在 previewText（noteBody 未投影）—— 回退链必须覆盖。
    const sourceText = override ? override.body : (target?.noteOutline || target?.noteBody || target?.previewText || '')
    const sourceTitle = override?.title ?? target?.title ?? ''
    const targetOutline = target ? stripTitleLine(sourceText, sourceTitle) : ''
    // 展开导图：节点长到导图的自然尺寸（mubu 行为），再由下方相机适配把整张图收进视口。
    const size = layout === 'mindmap' && target
      ? mindmapNodeSize(targetOutline, sourceTitle)
      : null
    const mapWidth = size?.width ?? 0
    const mapHeight = size?.height ?? 0
    setNodes((current) => current.map((node) => {
      if (node.id !== id || !isTextual(node)) return node
      const outline = layout === 'mindmap'
        ? (override ? targetOutline : (node.noteOutline || stripTitleLine(node.noteBody || node.previewText || '', node.title)))
        : node.noteOutline
      rememberNotePresentation(id, {
        noteLayout: layout,
        ...(outline ? { noteOutline: outline } : {}),
        ...(override ? { noteBody: override.body, noteOutline: override.body } : {}),
      })
      const base = override ? { ...node, title: override.title.trim() || node.title, noteBody: override.body } : node
      if (layout === 'mindmap' && mapWidth && mapHeight) {
        return {
          ...base,
          noteLayout: layout,
          noteOutline: outline,
          displayMode: 'expanded',
          // 以原中心为锚点生长，避免节点左上角固定导致视觉跳变。
          x: Math.round(node.x + (node.width - mapWidth) / 2),
          y: Math.round(node.y + (node.height - mapHeight) / 2),
          width: mapWidth,
          height: mapHeight,
        }
      }
      return {
        ...base,
        noteLayout: layout,
        ...(layout === 'mindmap' && outline ? { noteOutline: outline } : {}),
        displayMode: layout === 'mindmap' ? 'expanded' : node.displayMode,
      }
    }))
    if (size && target) {
      const bounds = {
        x: target.x + (target.width - mapWidth) / 2,
        y: target.y + (target.height - mapHeight) / 2,
        width: mapWidth,
        height: mapHeight,
      }
      const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
      setCamera(fitBoundsForReading(bounds, viewport?.width ?? 1000, viewport?.height ?? 820, 72, safeInsets))
    }
    setNotice(layout === 'mindmap' ? '已转为大纲导图（双击可编辑大纲文本）' : '已切回文本块')
  }, [nodes, safeInsets, setCamera, setNodes])

  const renameNodeTitle = useCallback((id: string, title: string) => {
    const nextTitle = title.trim()
    if (!nextTitle) { setNotice('名称不能为空'); return }
    setNodes((current) => current.map((node) => node.id === id ? { ...node, title: nextTitle } : node))
    setRenameNodeId(null)
    const node = nodes.find((item) => item.id === id)
    if (node?.opensScopeId) {
      const now = new Date().toISOString()
      setScopes((current) => current.map((scope) => scope.id === node.opensScopeId ? { ...scope, label: nextTitle, updatedAt: now } : scope))
    }
    if (bootMode === 'runtime' && node?.artifactId) {
      // Phase A14: 用户改名 → manual mode，Agent 后续不得自动覆盖。
      void bridgeRef.current.client.updateEntityTitle('artifact', node.artifactId, { title: nextTitle, mode: 'manual', generatedBy: 'user' }).then((call) => {
        if (call.result.ok) setNotice('名称已更新（手动模式）')
        else setNotice(`名称更新失败：${call.result.error.message}`)
      })
    } else {
      setNotice('名称已更新')
    }
  }, [bootMode, nodes, setNodes])

  // ── 文本节点高度自适应（格式化后字号变化，预览跟随内容）──
  // 标题（md-h1 14.5px 等）比正文行高大，固定 node.height 会截断正文：
  // 正文签名（长度 + 呈现模式）变化后实测 .lcos-readable-document 的溢出量，
  // 节点高度跟随增长；内容变少时回缩（仅限本效果调整过的节点，尊重手动 resize）。
  const noteAutoHeightsRef = useRef(new Map<string, number>())
  const noteFitSignature = useMemo(() => nodes
    .filter((node) => node.noteLayout !== 'mindmap' && node.displayMode !== 'compact'
      && (node.noteBody?.trim() || (node.fileType === 'markdown' && node.previewText?.trim())))
    .map((node) => `${node.id}:${node.noteBody?.length ?? node.previewText?.length ?? 0}:${node.displayMode}`)
    .join('|'), [nodes])
  useEffect(() => {
    if (!noteFitSignature) return
    const raf = requestAnimationFrame(() => {
      const auto = noteAutoHeightsRef.current
      const patches = new Map<string, number>()
      document.querySelectorAll<HTMLElement>('[data-testid^="canvas-node-"]').forEach((el) => {
        if (el.querySelector('.lcos-note-mindmap')) return
        const doc = el.querySelector<HTMLElement>('.lcos-readable-document')
        if (!doc) return
        const id = (el.getAttribute('data-testid') ?? '').replace(/^canvas-node-/, '')
        const overflow = doc.scrollHeight - doc.clientHeight
        if (overflow >= 2) patches.set(id, overflow + 2)
        else if (auto.has(id) && doc.clientHeight - doc.scrollHeight >= 24) patches.set(id, doc.scrollHeight - doc.clientHeight + 2)
      })
      if (!patches.size) return
      setNodes((current) => current.map((node) => {
        const delta = patches.get(node.id)
        if (delta === undefined || node.noteLayout === 'mindmap' || node.displayMode === 'compact') return node
        const next = Math.round(Math.max(120, Math.min(620, node.height + delta)))
        if (Math.abs(next - node.height) < 2) return node
        auto.set(node.id, next)
        return { ...node, height: next }
      }))
    })
    return () => cancelAnimationFrame(raf)
  }, [noteFitSignature, setNodes])

  const getPasteTarget = useCallback(() => {
    if (lastCanvasPointRef.current) return lastCanvasPointRef.current
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    return { x: ((viewport?.width ?? 1000) / 2 - camera.x) / camera.zoom, y: ((viewport?.height ?? 760) / 2 - camera.y) / camera.zoom }
  }, [camera])

  const copySelection = useCallback((ids = selectedIds, edgeId = selectedEdgeId) => {
    const payload = copyCanvasSelection(nodes, edges, ids, edgeId, activeProjectId)
    if (!payload) { setNotice('请先选择内容或关系'); return null }
    clipboardRef.current = payload
    // 同时写入系统剪贴板（自定义 MIME + 纯文本兜底），跨页面/重启后可粘贴。
    try {
      const serialized = new Blob([JSON.stringify(payload)], { type: 'application/x-lcos-nodes' })
      const text = payload.kind === 'nodes'
        ? `LCOS 视图 × ${payload.nodes.length}（在 LCOS 画布中粘贴可还原）`
        : 'LCOS 关系模板（在 LCOS 画布中选中两个节点后粘贴）'
      void navigator.clipboard?.write([
        new ClipboardItem({
          'application/x-lcos-nodes': serialized,
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]).catch(() => undefined)
    } catch {
      // 剪贴板不可用时保留内部剪贴板路径。
    }
    setNotice(payload.kind === 'nodes' ? `已复制 ${payload.nodes.length} 个视图 · ${payload.edges.length} 条内部关系` : '已复制关系模板')
    return payload
  }, [activeProjectId, edges, nodes, selectedEdgeId, selectedIds])

  const pasteClipboard = useCallback((target = getPasteTarget()) => {
    const payload = clipboardRef.current
    if (!payload) { setNotice('内部剪贴板为空'); return }
    if (payload.kind === 'relation') {
      const relation = pasteRelationTemplate(payload, selectedIds, edges, createId)
      if (!relation) { setNotice('请按顺序选择两个节点后粘贴关系'); return }
      setEdges((current) => [...current, relation]); setSelectedEdgeId(relation.id); setNotice('关系已粘贴'); return
    }
    const result = pasteCanvasNodes(payload, nodes, target, createId)
    const scopedNodes = result.nodes.map((node) => ({ ...node, scopeId }))
    setGraph((current) => ({ nodes: [...current.nodes, ...scopedNodes], edges: [...current.edges, ...result.edges] }))
    setSelectedIds(result.createdIds); setSelectedEdgeId(null); setNotice(`已创建 ${result.nodes.length} 个引用视图`)
  }, [edges, getPasteTarget, nodes, scopeId, selectedIds, setEdges, setGraph])

  const duplicateSelection = useCallback((ids = selectedIds) => {
    if (!ids.length) { setNotice('请先选择内容'); return }
    const payload = copyCanvasSelection(nodes, edges, ids, null, activeProjectId)
    if (!payload || payload.kind !== 'nodes') return
    clipboardRef.current = payload
    pasteClipboard(getPasteTarget())
  }, [activeProjectId, edges, getPasteTarget, nodes, pasteClipboard, selectedIds])

  const refreshAfterImport = useCallback(async (notice: string) => {
    const loaded = await bridgeRef.current.loadProject()
    if (loaded.source !== 'runtime' || !loaded.state) { setNotice(notice); return }
    const rootScope = loaded.state.scopes.find((scope) => scope.kind === 'root')
    resetGraph({ nodes: loaded.state.nodes, edges: loaded.state.edges })
    setWorkspaces(loaded.state.workspaces)
    setScopes(loaded.state.scopes)
    setScopeId(rootScope?.id ?? loaded.state.activeScopeId)
    setNotice(notice)
  }, [resetGraph, setNotice, setScopeId, setScopes, setWorkspaces])

  const pasteImageAsNode = useCallback(async (file: File, point: { x: number; y: number }) => {
    const call = await bridgeRef.current.client.importCopy(activeProjectId, {
      file,
      importRequestId: `clipboard-paste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      scopeId,
      x: point.x,
      y: point.y,
    })
    if (!call.result.ok) { setNotice(`粘贴图片失败：${call.result.error.message}`); return }
    await refreshAfterImport(`已粘贴图片「${file.name}」`)
  }, [activeProjectId, refreshAfterImport, scopeId])

  const pasteTextAsNode = useCallback(async (text: string, point: { x: number; y: number }, targetScopeId?: string): Promise<string | null> => {
    // G-4：targetScopeId 让 Context 视图的导图摘取落进当前 Context scope（默认仍建在当前 scope）。
    const nodeScopeId = targetScopeId ?? scopeId
    if (/^https?:\/\/\S+$/i.test(text)) {
      const call = await bridgeRef.current.client.importResourceUrl(activeProjectId, {
        url: text,
        scopeId: nodeScopeId,
        x: point.x,
        y: point.y,
      })
      if (!call.result.ok) { setNotice(`粘贴链接失败：${call.result.error.message}`); return null }
      await refreshAfterImport('已粘贴链接')
      return null
    }
    const call = await bridgeRef.current.client.createTextArtifact(activeProjectId, {
      title: inferFragmentLabel(text, '文字摘录'),
      body: text,
      scopeId: nodeScopeId,
      x: point.x,
      y: point.y,
    })
    if (!call.result.ok) { setNotice(`粘贴文本失败：${call.result.error.message}`); return null }
    await refreshAfterImport('已把剪贴板文字放到画布')
    return call.result.value.viewId
  }, [activeProjectId, refreshAfterImport, scopeId])

  /**
   * G-4 导图分支摘取 → 正常文本节点（与 createNodeAt('note') 同一条链路）：
   * 本地先立 kind:'note' + noteBody/noteOutline（摘取的就是大纲文本，天然可再转导图），
   * 再落 createTextArtifact 并回填 viewId。不走 pasteTextAsNode 的 refreshAfterImport——
   * 全量重载会把节点投影成 source 纸片（mapGraphToState 的 markdown→source），不是用户要的文本节点。
   * 返回新节点 viewId（供 Context 通道写入成员集）。
   */
  const createNoteFromBranchText = useCallback(async (text: string, point: { x: number; y: number }, targetScopeId?: string): Promise<string | null> => {
    if (!isRuntimeProjectMode(bootMode) || !activeProjectId) { setNotice('原型模式不写入导图摘取'); return null }
    const nodeScopeId = targetScopeId ?? scopeId
    const localId = createId('note')
    const isOutline = text.includes('\n')
    const temp: CanvasNode = {
      id: localId,
      kind: 'note',
      title: inferFragmentLabel(text, '摘取分支'),
      subtitle: '文本 · 可进入 Context 与修改',
      x: point.x,
      y: point.y,
      width: 244,
      height: 150,
      displayMode: 'standard',
      fileType: 'markdown',
      noteBody: text,
      ...(isOutline ? { noteOutline: text } : {}),
      scopeId: nodeScopeId,
      createdAt: new Date().toISOString(),
      workspaceIds: workspaceId ? [workspaceId] : [],
    }
    setNodes((current) => [...current, temp])
    setSelectedIds([localId])
    const call = await bridgeRef.current.client.createTextArtifact(activeProjectId, {
      title: temp.title,
      body: text,
      scopeId: nodeScopeId,
      x: point.x,
      y: point.y,
    })
    if (!call.result.ok) {
      setNodes((current) => current.filter((node) => node.id !== localId))
      setNotice(`摘取失败：${call.result.error.message}`)
      return null
    }
    const value = call.result.value
    originTextIdsRef.current.add(value.viewId)
    // 会话记忆同步写一份：mapGraphToState 重载时按 recallNotePresentation 恢复 noteBody/noteOutline。
    rememberNotePresentation(value.viewId, { noteBody: text, ...(isOutline ? { noteOutline: text } : {}) })
    setNodes((current) => current.map((node) => node.id === localId ? {
      ...node,
      id: value.viewId,
      artifactId: value.artifactId,
      revisionId: value.revisionId,
      fileRecordId: value.fileRecordId,
      managed: true,
      title: value.title || temp.title,
    } : node))
    setSelectedIds([value.viewId])
    setNotice('已把导图分支摘成新文本节点')
    return value.viewId
  }, [activeProjectId, bootMode, scopeId, workspaceId])

  const saveMaterialReference = useCallback(async (newArtifactId: string, payload: MaterialTransferPayloadV1) => {
    const sourceArtifactId = payload.source.artifactId
    if (!sourceArtifactId || payload.source.projectId !== activeProjectId || sourceArtifactId === newArtifactId) return
    const now = new Date().toISOString()
    const sourceAnchor = materialLocatorToSourceAnchor(payload.source.locator)
    const relation: Relation = {
      id: createId('relation') as RelationId,
      projectId: activeProjectId as ProjectId,
      sourceEntityType: 'artifact', sourceEntityId: newArtifactId,
      targetEntityType: 'artifact', targetEntityId: sourceArtifactId,
      kind: 'reference',
      origin: 'user', createdBy: 'material-transfer', confidence: 1,
      evidenceRefs: [{
        kind: 'artifact', id: sourceArtifactId, label: payload.source.title,
        ...(payload.source.revisionId ? { revisionId: payload.source.revisionId } : {}),
        ...(sourceAnchor ? { sourceAnchor } : {}),
      }],
      createdAt: now, updatedAt: now,
    }
    await bridgeRef.current.client.saveRelation(activeProjectId, relation).catch(() => undefined)
  }, [activeProjectId])

  const ingestMaterialTransfer = useCallback(async (payload: MaterialTransferPayloadV1, point: { x: number; y: number }) => {
    const title = materialTransferArtifactTitle(payload)
    const label = materialTransferLabel(payload)
    let createdArtifactId: string | null = null

    if (payload.content.kind === 'text') {
      const call = await bridgeRef.current.client.createTextArtifact(activeProjectId, {
        title,
        body: payload.content.text,
        scopeId,
        x: point.x,
        y: point.y,
      })
      if (!call.result.ok) { setNotice(`放入文字失败：${call.result.error.message}`); return }
      createdArtifactId = call.result.value.artifactId
    } else if (payload.content.kind === 'image') {
      const extension = payload.content.mimeType.includes('svg') ? 'svg' : payload.content.mimeType.includes('webp') ? 'webp' : payload.content.mimeType.includes('jpeg') ? 'jpg' : 'png'
      const file = dataUrlToFile(payload.content.dataUrl, payload.content.fileName ?? `${title}.${extension}`)
      if (!file) { setNotice('放入图片失败：无法读取图片数据'); return }
      const call = await bridgeRef.current.client.importCopy(activeProjectId, {
        file,
        importRequestId: `material-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        scopeId,
        x: point.x,
        y: point.y,
      })
      if (!call.result.ok) { setNotice(`放入图片失败：${call.result.error.message}`); return }
      createdArtifactId = call.result.value.artifact.id
    } else if (payload.content.kind === 'document-page') {
      const preview = payload.content.previewDataUrl
      if (preview) {
        const file = dataUrlToFile(preview, `${title}.png`)
        if (!file) { setNotice('提取页面失败：页面快照不可用'); return }
        const call = await bridgeRef.current.client.importCopy(activeProjectId, {
          file,
          importRequestId: `material-page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          scopeId,
          x: point.x,
          y: point.y,
        })
        if (!call.result.ok) { setNotice(`提取页面失败：${call.result.error.message}`); return }
        createdArtifactId = call.result.value.artifact.id
      } else {
        const fallbackBody = payload.content.text?.trim() || `来自《${payload.source.title}》${label}。\n\n打开来源可回到原页面。`
        const call = await bridgeRef.current.client.createTextArtifact(activeProjectId, { title, body: fallbackBody, scopeId, x: point.x, y: point.y })
        if (!call.result.ok) { setNotice(`提取页面失败：${call.result.error.message}`); return }
        createdArtifactId = call.result.value.artifactId
      }
    } else if (payload.content.kind === 'presentation-slide') {
      if (payload.content.svg) {
        const file = svgToFile(payload.content.svg, `${title}.svg`)
        const call = await bridgeRef.current.client.importCopy(activeProjectId, {
          file,
          importRequestId: `material-slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          scopeId,
          x: point.x,
          y: point.y,
        })
        if (!call.result.ok) { setNotice(`提取幻灯片失败：${call.result.error.message}`); return }
        createdArtifactId = call.result.value.artifact.id
      } else {
        const fallbackBody = payload.content.text?.trim() || `来自《${payload.source.title}》${label}。\n\n打开来源可回到原幻灯片。`
        const call = await bridgeRef.current.client.createTextArtifact(activeProjectId, { title, body: fallbackBody, scopeId, x: point.x, y: point.y })
        if (!call.result.ok) { setNotice(`提取幻灯片失败：${call.result.error.message}`); return }
        createdArtifactId = call.result.value.artifactId
      }
    }

    if (createdArtifactId) await saveMaterialReference(createdArtifactId, payload)
    const sourceHint = payload.source.title ? ` · 来自「${payload.source.title}」` : ''
    await refreshAfterImport(`已放入「${label}」${sourceHint}`)
  }, [activeProjectId, refreshAfterImport, saveMaterialReference, scopeId])

  // System clipboard and Material Drop share one ingest path. Legacy fragment
  // MIME is accepted as a transport adapter, not as a separate business entity.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const data = event.clipboardData
      if (!data || !activeProjectId || !isRuntimeProjectMode(bootMode)) return
      const materialPayload = parseMaterialTransfer(data.getData(LCOS_MATERIAL_TRANSFER_MIME))
      if (materialPayload) {
        event.preventDefault()
        void ingestMaterialTransfer(materialPayload, getPasteTarget())
        return
      }
      const fragmentPayload = parseFragmentClipboard(data.getData(LCOS_FRAGMENT_CLIPBOARD_MIME))
      if (fragmentPayload) {
        event.preventDefault()
        void ingestMaterialTransfer(materialTransferFromLegacyFragment(fragmentPayload), getPasteTarget())
        return
      }
      const lcosPayload = data.getData('application/x-lcos-nodes')
      if (lcosPayload) {
        event.preventDefault()
        try {
          const parsed = JSON.parse(lcosPayload) as CanvasClipboardPayload
          clipboardRef.current = parsed
          pasteClipboard(getPasteTarget())
        } catch {
          setNotice('粘贴内容无法识别')
        }
        return
      }
      const point = getPasteTarget()
      for (const item of Array.from(data.items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            event.preventDefault()
            void pasteImageAsNode(file, point)
          }
          return
        }
      }
      const text = data.getData('text/plain')?.trim()
      if (text) {
        event.preventDefault()
        void pasteTextAsNode(text, point)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [activeProjectId, bootMode, getPasteTarget, ingestMaterialTransfer, pasteClipboard, pasteImageAsNode, pasteTextAsNode, setNotice])

  // Viewer click-to-drop and future Web Tap/browser extension receiver. The main
  // app owns ingestion; external adapters only emit MaterialTransferPayloadV1.
  useEffect(() => {
    if (!activeProjectId || !isRuntimeProjectMode(bootMode)) return
    const onMaterialEvent = (event: Event) => {
      const payload = (event as CustomEvent<MaterialTransferPayloadV1>).detail
      if (!payload || payload.schemaVersion !== 1 || payload.kind !== 'material-transfer') return
      void ingestMaterialTransfer(payload, getPasteTarget())
    }
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return
      const data = event.data as { type?: string; payload?: unknown } | null
      if (!data || data.type !== LCOS_MATERIAL_CAPTURE_MESSAGE) return
      const payload = typeof data.payload === 'string' ? parseMaterialTransfer(data.payload) : data.payload as MaterialTransferPayloadV1 | undefined
      if (!payload || payload.schemaVersion !== 1 || payload.kind !== 'material-transfer') return
      void ingestMaterialTransfer(payload, getPasteTarget())
    }
    window.addEventListener(LCOS_MATERIAL_CAPTURE_EVENT, onMaterialEvent)
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener(LCOS_MATERIAL_CAPTURE_EVENT, onMaterialEvent)
      window.removeEventListener('message', onMessage)
    }
  }, [activeProjectId, bootMode, getPasteTarget, ingestMaterialTransfer])

  const deleteNodes = useCallback((ids: string[]) => {
    const idSet = new Set(ids)
    const scopeRoots = nodes.filter((node) => idSet.has(node.id) && node.opensScopeId).map((node) => node.opensScopeId!)
    let nextScopes = scopes
    let nextNodes = nodes.filter((node) => !idSet.has(node.id))
    let nextEdges = edges.filter((edge) => !idSet.has(edge.from) && !idSet.has(edge.to))
    const removedScopeIds = new Set<string>()
    scopeRoots.forEach((childScopeId) => {
      const removed = removeScopeTree(nextScopes, nextNodes, nextEdges, childScopeId)
      removed.removedScopeIds.forEach((id) => removedScopeIds.add(id))
      nextScopes = removed.scopes
      nextNodes = removed.nodes
      nextEdges = removed.edges
    })
    setScopes(nextScopes)
    if (removedScopeIds.size) setWorkspaces((current) => current.map((workspace) => removedScopeIds.has(workspace.scopeId) ? { ...workspace, scopeId, focusedViewIds: [] } : workspace))
    setGraph({ nodes: nextNodes, edges: nextEdges })
    clearSelection(); setNotice(`已删除 ${idSet.size} 个视图${scopeRoots.length ? '及其子画布' : ''} · Ctrl/Cmd+Z 可恢复`)
  }, [clearSelection, edges, nodes, scopeId, scopes, setGraph])

  const setSelectionDisplayMode = useCallback((mode: NodeDisplayMode) => {
    if (!selectedIds.length) return
    const selected = new Set(selectedIds)
    setNodes((current) => current.map((node) => {
      if (!selected.has(node.id)) return node
      const size = nodeDimensions(node.kind, mode)
      // 文本材料「直接阅读」：节点按实际行数生长，让预览行数与卡片高度匹配
      // （否则白色文本层被压成 2-3 行的“白条”，文字根本读不全）。
      const body = node.noteBody ?? ''
      const textual = node.kind === 'note' || detectFileIdentity(node) === 'markdown'
      if (mode !== 'compact' && textual && body.trim()) {
        const maxLines = mode === 'expanded' ? 22 : 11
        const lineCount = Math.min(maxLines, Math.max(3, body.split(/\r?\n/).filter((line) => line.trim()).length))
        const lineHeight = 18
        const height = Math.round(lineCount * lineHeight + 96)
        const width = Math.max(size.width, mode === 'expanded' ? 296 : 244)
        return { ...node, displayMode: mode, width, height }
      }
      return { ...node, displayMode: mode, width: size.width, height: size.height }
    }))
    setNotice(mode === 'compact' ? '已收起所选文字材料' : '已在画布直接展开所选文字材料')
  }, [selectedIds, setNodes])

  const arrangeSelection = useCallback(() => {
    if (selectedIds.length < 2) { setNotice('至少选择两个对象后再整理'); return }
    const selectedSet = new Set(selectedIds)
    const selected = nodes.filter((node) => selectedSet.has(node.id))
    const internalEdges = edges.filter((edge) => selectedSet.has(edge.from) && selectedSet.has(edge.to))
    const visualBounds = getVisualSelectionBounds(selected, selected.map((node) => node.id))
    const anchorCount = selected.filter((node) => node.positionLocked).length

    // Heterogeneous material walls default to a dependable visible-body grid.
    // No semantic relation means no reason to invent a force-directed pose.
    if (internalEdges.length === 0) {
      const positions = layoutVisualGrid(selected, { x: visualBounds?.x ?? 0, y: visualBounds?.y ?? 0 })
      setLayoutPreview(positions)
      setLayoutPreviewFocusIds(selected.map((node) => node.id))
      setNotice(`整齐网格预览 · 按节点真实外轮廓排布${anchorCount ? ` · 保留 ${anchorCount} 个固定对象` : ''}`)
      return
    }

    const bounds = getSelectionBounds(selected, selected.map((node) => node.id))
    const requestBase = {
      nodes: selected.map((node) => ({ id: node.id, x: node.x, y: node.y, width: node.width, height: node.height, pinned: Boolean(node.positionLocked) })),
      edges: internalEdges,
      gap: 30,
      componentGap: 110,
      origin: bounds ? { x: bounds.x, y: bounds.y } : undefined,
      preserveManualAnchors: true,
    }
    const strategy = chooseLayoutStrategy(requestBase)
    const proposal = layoutPreviewSync({ ...requestBase, strategy })
    const positions = repairVisualLayoutPositions(selected, proposal.positions, 28)
    setLayoutPreview(positions)
    setLayoutPreviewFocusIds(selected.map((node) => node.id))
    setNotice(`关系布局预览 · ${proposal.componentCount} 个关系簇 · 已按真实外轮廓做碰撞修复${anchorCount ? ` · 保留 ${anchorCount} 个固定对象` : ''}`)
  }, [edges, nodes, selectedIds])
  const applyLayout = useCallback(() => {
    if (!layoutPreview) return
    const projected = applyScopeLayout(nodes, layoutPreview)
    setNodes(projected)
    setScopes((current) => current.map((scope) => scope.id === scopeId ? { ...scope, layoutMode: 'semantic', updatedAt: new Date().toISOString() } : scope))
    const projectedScope = projected.filter((node) => (node.scopeId ?? 'scope-root') === scopeId)
    const focusIds = layoutPreviewFocusIds?.length ? layoutPreviewFocusIds : projectedScope.map((node) => node.id)
    const bounds = getSelectionBounds(projected, focusIds)
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    if (bounds) setCamera(fitBoundsForReading(bounds, viewport?.width ?? 1000, viewport?.height ?? 820, 72, safeInsets))
    setLayoutPreview(null)
    setLayoutPreviewFocusIds(null)
    setNotice('已应用当前布局建议')
  }, [layoutPreview, layoutPreviewFocusIds, nodes, safeInsets, scopeId, setNodes])

  const locateAndPreviewIslands = useCallback(() => {
    const preview = proposeIslandRecoveryLayout(visibleNodes, scopeId, { respectLocked: true })
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    const projected = preview.length ? applyScopeLayout(visibleNodes, preview) : visibleNodes
    const bounds = preview.length
      ? getSelectionBounds(projected, projected.map((node) => node.id))
      : restorationFocusBounds(visibleNodes) ?? getSelectionBounds(visibleNodes, visibleNodes.map((node) => node.id))
    if (bounds) setCamera(fitBoundsForReading(bounds, viewport?.width ?? 1000, viewport?.height ?? 820, 72, safeInsets))
    if (preview.length) {
      setLayoutPreview(preview)
      setLayoutPreviewFocusIds(null)
      setNotice(`发现 ${preview.length} 个孤立对象 · 预览归拢位置，确认后写入`)
    } else {
      setNotice('已定位当前内容')
    }
  }, [safeInsets, scopeId, visibleNodes])

  const createNodeAt = useCallback((kind: 'note' | 'context', x: number, y: number) => {
    if (kind === 'note' && bootMode === 'runtime' && activeProjectId) {
      const localId = createId('note')
      const temp: CanvasNode = {
        id: localId,
        kind,
        title: '新文本…',
        subtitle: '正在保存到项目…',
        x,
        y,
        // 新建即就地可编辑尺寸（幕布式：建好光标就在卡上，不是 135×70 小卡 + 改名弹窗）。
        width: 244,
        height: 150,
        displayMode: 'standard',
        scopeId,
        createdAt: new Date().toISOString(),
        workspaceIds: workspaceId ? [workspaceId] : [],
      }
      setNodes((current) => [...current, temp])
      setSelectedIds([localId])
      setNoteEditorId(localId)
      void bridgeRef.current.client.createTextArtifact(activeProjectId, {
        body: '',
        scopeId,
        ...(workspaceId === null ? {} : { workspaceId }),
        x,
        y,
      }).then((call) => {
        if (!call.result.ok) {
          setNodes((current) => current.filter((node) => node.id !== localId))
          setNoteEditorId(null)
          setNotice(`文本创建失败：${call.result.error.message}`)
          return
        }
        const value = call.result.value
        // 与 runtime 投影对齐（mapGraphToState 的 fileType: artifact.kind）：
        // 漏掉 fileType 会让 detectFileIdentity 判成 'file'，卡片退回纸片（“老样子”）。
        originTextIdsRef.current.add(value.viewId)
        setNodes((current) => current.map((node) => node.id === localId ? {
          ...node,
          id: value.viewId,
          artifactId: value.artifactId,
          revisionId: value.revisionId,
          fileRecordId: value.fileRecordId,
          managed: true,
          title: value.title,
          subtitle: '文本 · 可进入 Context 与修改',
          fileType: 'markdown',
          previewText: '',
        } : node))
        setSelectedIds([value.viewId])
        setNoteEditorId(value.viewId)
      })
      return localId
    }
    if (kind === 'context') {
      const created = createAggregateScopeEntity({ parentScopeId: rootScope.id, label: '新内容集合', kind: 'collection', memberCount: 0, containerPosition: { x, y }, createId })
      setScopes((current) => [...current, created.scope])
      setNodes((current) => [...current, created.container])
      setCollectionMembersById((current) => ({ ...current, [created.scope.id]: [] }))
      setCollectionEntityRefsById((current) => ({ ...current, [created.scope.id]: [] }))
      setSelectedIds([created.container.id])
      setRenameNodeId(created.container.id)
      return created.container.id
    }
    const id = createId(kind)
    const displayMode: NodeDisplayMode = 'standard'
    const next: CanvasNode = { id, kind, title: '新文本', subtitle: '直接输入或交给 Agent 整理', x, y, width: 244, height: 150, displayMode, scopeId, createdAt: new Date().toISOString(), workspaceIds: workspaceId ? [workspaceId] : [] }
    setNodes((current) => [...current, next]); setSelectedIds([id]); setNoteEditorId(id); return id
  }, [activeProjectId, bootMode, rootScope.id, scopeId, setNodes, setSelectedIds, setNoteEditorId, setRenameNodeId, workspaceId])

  const createWorkflowOperatorNode = useCallback(async (kind: 'condition' | 'parallel-split' | 'parallel-join' | 'reference', point: { x: number; y: number }) => {
    const title = kind === 'condition' ? '条件判断' : kind === 'parallel-split' ? '并行分支' : kind === 'parallel-join' ? '并行汇合' : '引用'
    const dimensions = nodeDimensions('note', 'standard')
    if (bootMode === 'runtime' && activeProjectId) {
      const call = await bridgeRef.current.client.createTextArtifact(activeProjectId, {
        title,
        body: '',
        scopeId,
        ...(workspaceId ? { workspaceId } : {}),
        x: point.x,
        y: point.y,
      })
      if (!call.result.ok) { setNotice(`工作流节点创建失败：${call.result.error.message}`); return null }
      const value = call.result.value
      const node: CanvasNode = {
        id: value.viewId,
        artifactId: value.artifactId,
        revisionId: value.revisionId,
        fileRecordId: value.fileRecordId,
        managed: true,
        kind: 'note',
        title: value.title || title,
        subtitle: 'Workflow logic · Presentation',
        previewText: '',
        x: point.x,
        y: point.y,
        ...dimensions,
        displayMode: 'standard',
        scopeId,
        createdAt: new Date().toISOString(),
        workspaceIds: workspaceId ? [workspaceId] : [],
      }
      setNodes((current) => current.some((item) => item.id === node.id) ? current : [...current, node])
      setWorkflowPresentationIds((current) => Array.from(new Set([...current, node.id])))
      setSelectedIds([node.id])
      return node.id
    }
    const id = createId('note')
    const node: CanvasNode = { id, kind: 'note', title, subtitle: 'Workflow logic · Presentation', x: point.x, y: point.y, ...dimensions, displayMode: 'standard', scopeId, createdAt: new Date().toISOString(), workspaceIds: workspaceId ? [workspaceId] : [] }
    setNodes((current) => [...current, node])
    setWorkflowPresentationIds((current) => Array.from(new Set([...current, id])))
    setSelectedIds([id])
    return id
  }, [activeProjectId, bootMode, scopeId, setNodes, workspaceId])

  const createBlankResultSlotAt = useCallback(async (x: number, y: number): Promise<string | null> => {
    if (bootMode !== 'runtime') { setNotice('空白结果需要真实项目保存能力；当前预览模式不会伪造一个假的结果位'); return null }
    const call = await bridgeRef.current.client.createResultSlot(activeProjectId, {
      scopeId,
      ...(workspaceId ? { workspaceId } : {}),
      x,
      y,
      width: 220,
      height: 128,
    }).catch(() => null)
    if (!call?.result.ok) {
      setNotice(`空白结果创建失败：${call?.result.ok === false ? call.result.error.message : '本地项目服务暂时不可用'}`)
      return null
    }
    const slot = call.result.value
    setResultSlots((current) => [...current.filter((item) => item.id !== slot.id), slot])
    setNodes((current) => reconcileResultSlotProjections(current, [slot, ...resultSlots.filter((item) => item.id !== slot.id)]))
    setSelectedIds([slot.id])
    return slot.id
  }, [activeProjectId, bootMode, resultSlots, scopeId, setNodes, workspaceId])

  const createContentFromDialog = useCallback((kind: 'note' | 'context' | 'result-slot') => {
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    const width = viewport?.width ?? 960
    const height = viewport?.height ?? 720
    if (kind === 'result-slot') {
      const slotWidth = 220
      const slotHeight = 128
      const x = (width / 2 - camera.x) / camera.zoom - slotWidth / 2
      const y = (height / 2 - camera.y) / camera.zoom - slotHeight / 2
      setCreateDialogOpen(false)
      void createBlankResultSlotAt(x, y).then((slotId) => { if (slotId) setNotice('已留下一个空白结果位；选择它和参考材料后，交给一段已连接的对话即可') })
      return
    }
    const dimensions = nodeDimensions(kind, 'standard')
    const x = (width / 2 - camera.x) / camera.zoom - dimensions.width / 2
    const y = (height / 2 - camera.y) / camera.zoom - dimensions.height / 2
    createNodeAt(kind, x, y)
    setCreateDialogOpen(false)
    setNotice(kind === 'note' ? '已在画布中央添加文本' : '已创建内容集合；它会在当前画布原地展开/收起')
  }, [camera, createBlankResultSlotAt, createNodeAt])

  const createNodeFromAnchor = useCallback((kind: 'note' | 'context', x: number, y: number, from: string) => {
    const id = createNodeAt(kind, x, y)
    setEdges((current) => [...current, { id: createId('edge'), from, to: id, kind: 'reference' }])
  }, [createNodeAt, setEdges])

  const createScopeFromSelection = useCallback(({ label, kind, memberIds }: { label: string; kind: Exclude<ScopeKind, 'root'>; memberIds?: readonly string[] }) => {
    const sourceIds = memberIds?.length ? [...memberIds] : selectedIds
    if (!sourceIds.length) { setScopeCreateOpen(false); return }
    const normalizedKind = kind === 'delivery' ? 'collection' : kind
    if (normalizedKind === 'context') {
      createContextFromMembersDirect(sourceIds, label.trim() || `Context ${savedContextViews.length + 1}`)
      setScopeCreateOpen(false)
      return
    }
    if (normalizedKind === 'workflow') {
      createWorkflowFromMembersDirect(sourceIds, label.trim() || `Workflow ${savedWorkflowViews.length + 1}`)
      setScopeCreateOpen(false)
      return
    }

    const finalLabel = label.trim() || '新内容集合'
    const requestedParent = scopes.find((item) => item.id === scopeId)
    const collectionParentScopeId = requestedParent?.kind === 'root' || requestedParent?.kind === 'collection' ? scopeId : rootScope.id
    let structuralDepth = 0
    let depthCursor = scopes.find((item) => item.id === collectionParentScopeId)
    const depthVisited = new Set<string>()
    while (depthCursor && depthCursor.kind !== 'root' && !depthVisited.has(depthCursor.id)) {
      depthVisited.add(depthCursor.id)
      if (depthCursor.kind === 'collection') structuralDepth += 1
      depthCursor = depthCursor.parentScopeId ? scopes.find((item) => item.id === depthCursor!.parentScopeId) : undefined
    }
    if (structuralDepth >= MAX_STRUCTURAL_CONTAINER_DEPTH) {
      setScopeCreateOpen(false)
      setNotice('已达到集合嵌套上限；可把对象作为引用加入，而不是继续创建子集合')
      return
    }
    const semantic = semanticRefsForSourceIds(sourceIds, projectPresentationNodes)
    const bounds = getSelectionBounds(projectPresentationNodes, sourceIds)
    const created = createAggregateScopeEntity({
      parentScopeId: collectionParentScopeId,
      label: finalLabel,
      kind: 'collection',
      memberCount: semantic.viewIds.length + semantic.entityRefs.length,
      containerPosition: { x: (bounds?.x ?? 420) + (bounds?.width ?? 260) + 72, y: bounds?.y ?? 160 },
      createId,
    })
    const nextNodes = [...nodes, created.container]
    const nextScopes = [...scopes, created.scope]
    setGraph({ nodes: nextNodes, edges })
    setScopes(nextScopes)
    setCollectionMembersById((current) => ({ ...current, [created.scope.id]: semantic.viewIds }))
    setCollectionEntityRefsById((current) => ({ ...current, [created.scope.id]: semantic.entityRefs }))
    setScopeCreateOpen(false)
    setSelectedIds([created.container.id])
    setSelectedEdgeId(null)
    setNodeInfoId(null)
    setLayoutPreview(null)

    const commitMembership = () => {
      if (!isRuntimeProjectMode(bootMode)) {
        setNotice(`已收纳为「${finalLabel}」 · ${semantic.viewIds.length + semantic.entityRefs.length} 项；点击 Collection 可原地展开`)
        return
      }
      void Promise.all([
        appendProjectPresentationMembers({
          client: bridgeRef.current.client,
          projectId: activeProjectId,
          ownerId: created.scope.id,
          capability: 'custom',
          renderer: 'collection',
        }, semantic.viewIds, []),
        appendExactPresentationEntityRefs('custom', created.scope.id, semantic.entityRefs, 'collection'),
      ]).then(([members, refs]) => {
        if (!members.ok || refs === null) { setNotice('集合创建后成员保存失败，已保留实体以便恢复'); return }
        setCollectionMembersById((current) => ({ ...current, [created.scope.id]: members.memberViewIds }))
        setCollectionEntityRefsById((current) => ({ ...current, [created.scope.id]: refs }))
        setNotice(`已收纳为「${finalLabel}」 · ${members.memberViewIds.length + refs.length} 项；没有创建子画布`)
      })
    }

    if (!isRuntimeProjectMode(bootMode)) { commitMembership(); return }
    const snapshot: PersistedPrototypeState = {
      version: 10, projectId: activeProjectId, nodes: nextNodes, edges, workspaces, scopes: nextScopes,
      activeWorkspaceId: workspaceId, activeScopeId: scopeId, workRail,
    }
    void bridgeRef.current.saveMutations(snapshot).then((saved) => {
      if (saved.status !== 'saved') {
        // Core is authoritative. A rejected containment write must not leave a
        // ghost Collection in the GUI that has no durable semantic effect.
        setGraph({ nodes, edges })
        setScopes(scopes)
        setCollectionMembersById((current) => { const next = { ...current }; delete next[created.scope.id]; return next })
        setCollectionEntityRefsById((current) => { const next = { ...current }; delete next[created.scope.id]; return next })
        setSelectedIds(sourceIds)
        setNotice(`集合创建未完成：${saved.error ? humanizeRuntimeMessage(saved.error) : '本地项目服务暂时没有确认这次创建'}；没有留下无效集合`)
        return
      }
      commitMembership()
    })
  }, [activeProjectId, appendExactPresentationEntityRefs, bootMode, createContextFromMembersDirect, createWorkflowFromMembersDirect, edges, nodes, projectPresentationNodes, savedContextViews.length, savedWorkflowViews.length, scopeId, scopes, selectedIds, setGraph, workRail, workspaces, workspaceId])


  const commitColonies = useCallback((next: SpatialColonyDraft[]) => {
    setColonies(next)
    if (!mainCanvasPresentation.ready) return
    mainCanvasPresentation.patch((state) => ({ ...state, colonies: next, spatialRegions: [] }))
    mainCanvasPresentation.flushSoon()
  }, [mainCanvasPresentation])

  const createColonyFromCurrentSelection = useCallback(() => {
    if (selectedIds.length < 2) { setNotice('至少选择 2 个对象后才能圈成 Colony'); return }
    const colony = colonyFromSelection(createId('colony'), selectedIds, sceneCanvasNodes)
    if (!colony) { setNotice('当前 Selection 无法建立 Colony'); return }
    commitColonies([...colonies, colony])
    setNotice(`已圈成 Colony · ${colony.memberIds.length} 项；成员关系不会因为位置变化自动丢失`)
  }, [colonies, commitColonies, sceneCanvasNodes, selectedIds])

  const createColonyFromLasso = useCallback((memberIds: readonly string[], contourPoints: readonly { x: number; y: number }[]) => {
    const ids = [...new Set(memberIds)].filter((id) => sceneCanvasNodes.some((node) => node.id === id))
    if (ids.length < 2 || contourPoints.length < 3) { setNotice('至少圈住 2 个对象才能建立 Colony'); return }
    const colony: SpatialColonyDraft = { id: createId('colony'), surface: 'main', memberIds: ids, contour: { points: contourPoints.map((point) => ({ ...point })) } }
    commitColonies([...colonies, colony])
    setNotice(`已建立 Colony · ${ids.length} 项`)
  }, [colonies, commitColonies, sceneCanvasNodes])

  const addToColony = useCallback((colonyId: string, memberIds: readonly string[], placements?: Readonly<Record<string, { x: number; y: number }>>) => {
    let added = 0
    const next = colonies.map((colony) => {
      if (colony.id !== colonyId) return colony
      const before = colony.memberIds.length
      const projectedNodes = placements ? sceneCanvasNodes.map((node) => placements[node.id] ? { ...node, ...placements[node.id] } : node) : sceneCanvasNodes
      const updated = addMembersToColony(colony, memberIds, projectedNodes)
      added = updated.memberIds.length - before
      return updated
    })
    if (!added) return
    commitColonies(next)
    setNotice(`已加入 Colony · +${added}`)
  }, [colonies, commitColonies, sceneCanvasNodes])

  const rescopeCurrentColony = useCallback((colonyId: string, points: readonly { x: number; y: number }[]) => {
    const current = colonies.find((item) => item.id === colonyId)
    if (!current) return
    const next = rescopeColony(current, points, sceneCanvasNodes)
    if (!next) { setNotice('重新圈定至少需要包含 2 个对象'); return }
    commitColonies(colonies.map((item) => item.id === colonyId ? next : item))
    setNotice(`已重新圈定 Colony · ${next.memberIds.length} 项`)
  }, [colonies, commitColonies, sceneCanvasNodes])

  const settleColonyMemberMove = useCallback((movedIds: readonly string[], placements: Readonly<Record<string, { x: number; y: number }>>) => {
    if (!movedIds.length || !colonies.length) return
    const projectedNodes = sceneCanvasNodes.map((node) => placements[node.id] ? { ...node, ...placements[node.id] } : node)
    let peeled = 0
    let touched = false
    const next = colonies.map((colony) => {
      if (!colony.memberIds.some((id) => movedIds.includes(id))) return colony
      touched = true
      const reconciled = reconcileColonyAfterMove(colony, movedIds, projectedNodes)
      peeled += reconciled.peeledIds.length
      return reconciled.colony
    })
    if (!touched) return
    commitColonies(next)
    if (peeled) setNotice(`已从 Colony 剥离 ${peeled} 项`)
  }, [colonies, commitColonies, sceneCanvasNodes])

  const dissolveColony = useCallback((colonyId: string) => {
    const colony = colonies.find((item) => item.id === colonyId)
    if (!colony) return
    commitColonies(colonies.filter((item) => item.id !== colonyId))
    setNotice(`已解散 Colony · ${colony.memberIds.length} 个对象保留原位`)
  }, [colonies, commitColonies])

  useEffect(() => {
    const legacy = mainSurfaceElements.filter((element) => (element.type === 'fence' || element.type === 'region') && (element.binding?.projectViewIds?.length ?? 0) >= 2)
    if (!legacy.length) return
    const migratedElementIds = new Set<string>()
    const additions: SpatialColonyDraft[] = []
    for (const element of legacy) {
      const colonyId = `legacy-colony:${element.id}`
      if (colonies.some((colony) => colony.id === colonyId)) { migratedElementIds.add(element.id); continue }
      const colony = colonyFromSelection(colonyId, element.binding?.projectViewIds ?? [], sceneCanvasNodes, element.presentation?.variant)
      if (!colony) continue
      migratedElementIds.add(element.id)
      additions.push(colony)
    }
    if (additions.length) commitColonies([...colonies, ...additions])
    if (migratedElementIds.size) setMainSurfaceElements(mainSurfaceElements.filter((element) => !migratedElementIds.has(element.id)))
  }, [colonies, commitColonies, mainSurfaceElements, sceneCanvasNodes, setMainSurfaceElements])

  const togglePositionLock = useCallback((nodeId: string) => {
    setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, positionLocked: !node.positionLocked } : node))
    const node = nodes.find((item) => item.id === nodeId)
    setNotice(node?.positionLocked ? '已允许自动排列移动此对象' : '已固定位置，自动排列会避开此对象')
  }, [nodes, setNodes])

  const generatePreview = useCallback((node: CanvasNode) => {
    if (bootMode !== 'runtime' || !node.revisionId) {
      setNotice('只有已保存的文件版本可以生成预览')
      return
    }
    setNotice(`正在生成 ${node.title} 的 Preview…`)
    bridgeRef.current.generatePreview(node.revisionId, 'thumbnail').then((result) => {
      if (result.state === null) {
        setNotice(`Preview 生成失败：${result.error ?? '未知错误'}`)
        return
      }
      const nextState = result.state
      projectStateCacheRef.current.set(activeProjectId, nextState)
      resetGraph({ nodes: nextState.nodes, edges: nextState.edges })
      setWorkspaces(nextState.workspaces)
      setScopes(nextState.scopes)
      setWorkRail((current) => ({ ...nextState.workRail, collapsed: current.collapsed, width: 312 }))
      setSelectedIds([node.id])
      const nextNode = nextState.nodes.find((item) => item.id === node.id)
      setNotice(nextNode?.previewStatus === 'ready' ? 'Preview 已生成' : `Preview 状态：${nextNode?.previewStatus ?? 'unknown'}`)
    })
  }, [activeProjectId, bootMode, resetGraph])

  const applyReloadedRuntimeState = useCallback((state: PersistedPrototypeState, selectedNodeId: string) => {
    projectStateCacheRef.current.set(activeProjectId, state)
    resetGraph({ nodes: state.nodes, edges: state.edges })
    setWorkspaces(state.workspaces)
    setScopes(state.scopes)
    setWorkRail((current) => ({ ...state.workRail, collapsed: current.collapsed, width: 312 }))
    setSelectedIds([selectedNodeId])
  }, [activeProjectId, resetGraph])

  const refreshSource = useCallback((node: CanvasNode) => {
    if (bootMode !== 'runtime' || !node.fileRecordId) {
      setNotice('只有已导入的本地文件可以重新读取')
      return
    }
    setNotice(`正在刷新 ${node.title}…`)
    bridgeRef.current.refreshFileRecord(node.fileRecordId).then((result) => {
      if (result.state === null) {
        setNotice(`刷新失败：${result.error ?? '未知错误'}`)
        return
      }
      applyReloadedRuntimeState(result.state, node.id)
      const refreshed = result.state.nodes.find((item) => item.id === node.id)
      setNotice(`文件状态：${refreshed?.fileAvailability ?? 'unknown'}`)
    })
  }, [applyReloadedRuntimeState, bootMode])

  const adoptExternalChange = useCallback((node: CanvasNode) => {
    if (bootMode !== 'runtime' || !node.fileRecordId || node.fileAvailability !== 'stale') {
      setNotice('只有已刷新的 stale 文件可以采纳')
      return
    }
    setNotice(`正在将 ${node.title} 的外部变化登记为新 Revision…`)
    bridgeRef.current.adoptExternalChange(node.fileRecordId).then((result) => {
      if (result.state === null) {
        setNotice(`采纳失败：${result.error ?? '未知错误'}`)
        return
      }
      applyReloadedRuntimeState(result.state, node.id)
      setNotice('外部变化已登记为新的 Current Revision')
    })
  }, [applyReloadedRuntimeState, bootMode])

  const dropFiles = useCallback((files: File[], x: number, y: number) => {
    const defaultSize = nodeDimensions('source', 'standard')
    const placements = placeNewNodesIncrementally(nodes, files.map(() => defaultSize), { x, y }, 20)
    const created: CanvasNode[] = files.map((file, index) => {
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      if (previewUrl) objectUrls.current.add(previewUrl)
      const textPreview = isTextPreviewFile(file)
      const fileType = file.type || inferFileType(file.name)
      const runtimeState = bootMode === 'runtime' ? 'importing' : 'temporary'
      const position = placements[index] ?? { x, y }
      return { id: createId('file'), artifactId: createId('artifact'), kind: 'source', title: file.name, subtitle: runtimeState === 'importing' ? 'Importing…' : previewUrl ? '本地图片 · 临时预览' : textPreview ? '本地文本 · 临时预览' : '本地文件 · 等待本地核心服务预览', x: position.x, y: position.y, ...defaultSize, displayMode: 'standard', fileType, fileSize: file.size, previewUrl, previewDataUrl: previewUrl, previewMimeType: fileType, scopeId, runtimeState, editable: /\.(pptx?|md|docx?|txt)$/i.test(file.name), managed: false, createdAt: new Date().toISOString(), workspaceIds: workspaceId ? [workspaceId] : [] }
    })
    setNodes((current) => [...current, ...created]); setSelectedIds(created.map((node) => node.id)); setNotice(bootMode === 'runtime' ? `正在导入 ${created.length} 个文件到项目…` : `已加入 ${created.length} 个本地文件引用，不上传、不移动原文件`)
    for (const [index, file] of files.entries()) {
      if (!isTextPreviewFile(file)) continue
      const nodeId = created[index]?.id
      if (nodeId === undefined) continue
      file.arrayBuffer().then((buffer) => decodeTextBuffer(buffer)).then((text) => {
        setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, previewText: text.slice(0, 64 * 1024) } : node))
      }).catch(() => {
        setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, previewError: 'Local text preview failed.' } : node))
      })
    }
    if (bootMode !== 'runtime') return
    const batchId = `import-batch-${crypto.randomUUID()}`
    const batchCreatedAt = new Date().toISOString()
    const importTasks = files.map(async (file, index) => {
      const temporaryNode = created[index]
      if (temporaryNode === undefined) return null
      const importRequestId = `${batchId}-${index}`
      try {
        const result = await bridgeRef.current.importCopy({
          file,
          importRequestId,
          scopeId,
          x: temporaryNode.x,
          y: temporaryNode.y,
        })
        if (result.state === null) {
          setNodes((current) => current.map((node) => node.id === temporaryNode.id ? { ...node, subtitle: 'Import failed', runtimeState: 'failed', error: true, previewError: result.error ?? 'Import Copy failed.' } : node))
          return { ok: false as const, importRequestId, fileName: file.name }
        }
        const nextState = result.state
        projectStateCacheRef.current.set(activeProjectId, nextState)
        resetGraph({ nodes: nextState.nodes, edges: nextState.edges })
        setWorkspaces(nextState.workspaces)
        setScopes(nextState.scopes)
        setWorkRail((current) => ({ ...nextState.workRail, collapsed: current.collapsed, width: 312 }))
        if (result.importedViewId !== undefined) {
          setSelectedIds([result.importedViewId])
          if (workspaceId) void addViewsToWorkspace(workspaceId, [result.importedViewId], 'import')
        }
        if (result.importedRevisionId !== undefined) void bridgeRef.current.generatePreview(result.importedRevisionId, 'thumbnail').then((previewResult) => {
          if (previewResult.state === null) return
          const previewState = previewResult.state
          projectStateCacheRef.current.set(activeProjectId, previewState)
          resetGraph({ nodes: previewState.nodes, edges: previewState.edges })
          setWorkspaces(previewState.workspaces)
          setScopes(previewState.scopes)
          setWorkRail((current) => ({ ...previewState.workRail, collapsed: current.collapsed, width: 312 }))
          if (result.importedViewId !== undefined) setSelectedIds([result.importedViewId])
        })
        return {
          ok: true as const,
          importRequestId,
          artifactId: result.importedArtifactId,
          revisionId: result.importedRevisionId,
          viewId: result.importedViewId,
        }
      } catch (error: unknown) {
        setNodes((current) => current.map((node) => node.id === temporaryNode.id ? { ...node, subtitle: 'Import failed', runtimeState: 'failed', error: true, previewError: error instanceof Error ? error.message : 'Import Copy failed.' } : node))
        return { ok: false as const, importRequestId, fileName: file.name }
      }
    })
    void Promise.all(importTasks).then(async (receipts) => {
      const successful = receipts.filter((item): item is NonNullable<typeof item> & { readonly ok: true } => item !== null && item.ok)
      const failed = receipts.filter((item) => item !== null && !item.ok)
      const batchCall = await bridgeRef.current.client.recordImportBatch(activeProjectId, {
        batchId,
        sourceKind: 'file_drop',
        status: successful.length === receipts.length ? 'completed' : successful.length > 0 ? 'partial' : 'failed',
        scopeId,
        importRequestIds: receipts.flatMap((item) => item ? [item.importRequestId] : []),
        artifactIds: successful.flatMap((item) => item.artifactId ? [item.artifactId] : []),
        revisionIds: successful.flatMap((item) => item.revisionId ? [item.revisionId] : []),
        viewIds: successful.flatMap((item) => item.viewId ? [item.viewId] : []),
        createdAt: batchCreatedAt,
      })
      if (!batchCall.result.ok) {
        setNotice(`文件已导入，但批次引用未保存：${batchCall.result.error.message}`)
        return
      }
      setNotice(failed.length === 0 ? `已导入 ${successful.length} 个文件 · Agent 可引用“刚导入这一批”` : `已导入 ${successful.length} 个文件，${failed.length} 个失败 · 成功项已记录为一批`)
    }).catch((error: unknown) => setNotice(`导入完成，但批次记录失败：${error instanceof Error ? error.message : '未知错误'}`))
  }, [activeProjectId, addViewsToWorkspace, bootMode, nodes, resetGraph, scopeId, setNodes, workspaceId])

  const createLinkReference = useCallback((input: LinkReferenceInput) => {
    const point = lastCanvasPointRef.current ?? { x: 180, y: 160 }
    setLinkDialogOpen(false)
    void bridgeRef.current.client.importResourceUrl(activeProjectId, {
      url: input.url,
      ...(input.title === undefined ? {} : { title: input.title }),
      ...(input.note === undefined ? {} : { note: input.note }),
      scopeId,
      x: point.x,
      y: point.y,
    }).then(async (call) => {
      if (!call.result.ok) {
        setNotice(`链接导入失败：${call.result.error.message}`)
        return
      }
      if (workspaceId && call.result.value.viewId) await addViewsToWorkspace(workspaceId, [call.result.value.viewId], 'import')
      setNotice('链接已保存；需要时可手动获取并重新理解')
      const loaded = await bridgeRef.current.loadProject()
      if (loaded.source === 'runtime' && loaded.state) {
        const rootScope = loaded.state.scopes.find((scope) => scope.kind === 'root')
        resetGraph({ nodes: loaded.state.nodes, edges: loaded.state.edges })
        setWorkspaces(loaded.state.workspaces)
        setScopes(loaded.state.scopes)
        setWorkspaceId((current) => current && loaded.state!.workspaces.some((workspace) => workspace.id === current) ? current : null)
        setScopeId(rootScope?.id ?? loaded.state.activeScopeId)
        setCamera(rootScope?.camera ?? camera)
        setWorkRail(normalizeRailPreferences(loaded.state.workRail))
      }
    }).catch(() => setNotice('链接导入失败：本地项目服务暂时不可用'))
  }, [activeProjectId, addViewsToWorkspace, camera, resetGraph, scopeId, setCamera, setScopes, setWorkRail, setWorkspaces, workspaceId])

  const reloadRuntimeProject = useCallback(async (): Promise<void> => {
    const loaded = await bridgeRef.current.loadProject()
    if (loaded.source === 'runtime' && loaded.state) {
      const rootScope = loaded.state.scopes.find((scope) => scope.kind === 'root')
      resetGraph({ nodes: loaded.state.nodes, edges: loaded.state.edges })
      setWorkspaces(loaded.state.workspaces)
      setScopes(loaded.state.scopes)
      setWorkspaceId((current) => current && loaded.state!.workspaces.some((workspace) => workspace.id === current) ? current : null)
      setScopeId(rootScope?.id ?? loaded.state.activeScopeId)
      setCamera(rootScope?.camera ?? camera)
      setWorkRail(normalizeRailPreferences(loaded.state.workRail))
    }
  }, [camera, resetGraph, setCamera, setScopes, setWorkRail, setWorkspaces])

  const handleImportDirectory = useCallback((rootName: string, files: readonly DirectoryEntryInput[], note?: string) => {
    const point = lastCanvasPointRef.current ?? { x: 180, y: 160 }
    const importRequestId = `dir-${Date.now().toString(36)}`
    const batchId = `import-batch-${crypto.randomUUID()}`
    const batchCreatedAt = new Date().toISOString()
    void bridgeRef.current.client.importResourceDirectory(activeProjectId, {
      importRequestId,
      rootName,
      files,
      scopeId,
      x: point.x,
      y: point.y,
      ...(note === undefined ? {} : { note }),
    }).then(async (call) => {
      if (!call.result.ok) {
        setNotice(`目录导入失败：${call.result.error.message}`)
        return
      }
      if (workspaceId && call.result.value.viewId) await addViewsToWorkspace(workspaceId, [call.result.value.viewId], 'import')
      const batchCall = await bridgeRef.current.client.recordImportBatch(activeProjectId, {
        batchId, sourceKind: 'directory_drop', status: 'completed', scopeId,
        importRequestIds: [importRequestId], artifactIds: [call.result.value.artifactId],
        revisionIds: [call.result.value.revisionId], viewIds: call.result.value.viewId ? [call.result.value.viewId] : [],
        createdAt: batchCreatedAt,
      }).catch(() => null)
      setNotice(batchCall?.result.ok === true
        ? `“${rootName}” 已作为来源材料导入 · Agent 可引用“刚导入这一批”`
        : `“${rootName}” 已导入，但这次批次引用没有保存`)
      await reloadRuntimeProject()
    }).catch(() => setNotice('目录导入失败：连接异常'))
  }, [activeProjectId, addViewsToWorkspace, reloadRuntimeProject, scopeId, workspaceId])

  const handleImportArchive = useCallback((file: File, note?: string) => {
    const point = lastCanvasPointRef.current ?? { x: 180, y: 160 }
    const importRequestId = `zip-${Date.now().toString(36)}`
    const batchId = `import-batch-${crypto.randomUUID()}`
    const batchCreatedAt = new Date().toISOString()
    void bridgeRef.current.client.importResourceArchive(activeProjectId, {
      file,
      importRequestId,
      scopeId,
      x: point.x,
      y: point.y,
      ...(note === undefined ? {} : { note }),
    }).then(async (call) => {
      if (!call.result.ok) {
        setNotice(`压缩包导入失败：${call.result.error.message}`)
        return
      }
      if (workspaceId && call.result.value.viewId) await addViewsToWorkspace(workspaceId, [call.result.value.viewId], 'import')
      const batchCall = await bridgeRef.current.client.recordImportBatch(activeProjectId, {
        batchId, sourceKind: 'archive_drop', status: 'completed', scopeId,
        importRequestIds: [importRequestId], artifactIds: [call.result.value.artifactId],
        revisionIds: [call.result.value.revisionId], viewIds: call.result.value.viewId ? [call.result.value.viewId] : [],
        createdAt: batchCreatedAt,
      }).catch(() => null)
      setNotice(batchCall?.result.ok === true
        ? `${file.name} 已导入 · Agent 可引用“刚导入这一批”`
        : `${file.name} 已导入，但这次批次引用没有保存`)
      await reloadRuntimeProject()
    }).catch(() => setNotice('压缩包导入失败：连接异常'))
  }, [activeProjectId, addViewsToWorkspace, reloadRuntimeProject, scopeId, workspaceId])

  const handleOpenObsidian = useCallback(() => {
    setObsidianBusy(true)
    setObsidianError(null)
    void bridgeRef.current.client.selectObsidianVault().then((call) => {
      if (!call.result.ok) {
        setObsidianError(call.result.error.message)
        setNotice('没有完成 Obsidian Vault 扫描，项目内容没有变化。')
        return
      }
      if (call.result.value === null) return
      setObsidianScan(call.result.value)
    }).catch(() => {
      setObsidianError('Obsidian Vault 扫描暂时不可用。')
      setNotice('没有完成 Obsidian Vault 扫描，项目内容没有变化。')
    }).finally(() => setObsidianBusy(false))
  }, [])

  const handleImportObsidian = useCallback((relativePaths: readonly string[]) => {
    if (!obsidianScan) return
    const point = lastCanvasPointRef.current ?? { x: 180, y: 160 }
    setObsidianBusy(true)
    setObsidianError(null)
    void bridgeRef.current.client.importObsidianNotes(activeProjectId, {
      scanId: obsidianScan.scanId,
      relativePaths,
      scopeId,
      position: point,
    }).then(async (call) => {
      if (!call.result.ok) {
        setObsidianError(call.result.error.message)
        return
      }
      const viewIds = call.result.value.flatMap((item) => item.viewId ? [item.viewId] : [])
      if (workspaceId && viewIds.length > 0) await addViewsToWorkspace(workspaceId, viewIds, 'import')
      setNotice(`已从 ${obsidianScan.vaultName} 导入 ${call.result.value.length} 篇笔记；原 Vault 保持只读。`)
      setObsidianScan(null)
      await reloadRuntimeProject()
    }).catch(() => setObsidianError('Obsidian 笔记导入暂时中断，原 Vault 没有被修改。'))
      .finally(() => setObsidianBusy(false))
  }, [activeProjectId, addViewsToWorkspace, obsidianScan, reloadRuntimeProject, scopeId, workspaceId])

  const applyRuntimeReview = useCallback((review: RunReview, current: ActiveRun, providerError?: string) => {
    const readableProviderError = providerError === undefined ? undefined : humanizeRuntimeMessage(providerError)
    const pendingReturn = review.returns.find((item) => item.status === 'pending_review')
    const draftRevision = pendingReturn?.draftRevisionId === undefined
      ? undefined
      : review.draftRevisions.find((item) => String(item.id) === String(pendingReturn.draftRevisionId))
    let pendingArtifactId = current.pendingArtifactId
    let changedFiles = current.changedFiles
    if (pendingReturn !== undefined && draftRevision !== undefined) {
      pendingArtifactId = `runtime-return-view-${String(pendingReturn.id)}`
      changedFiles = [fileNameFromPath(pendingReturn.canonicalPath)]
      const target = nodes.find((node) => node.id === current.targetIds[0])
      const dimensions = nodeDimensions('generated', 'standard')
      const position = target === undefined
        ? { x: 520, y: 560 }
        : findPendingReturnPosition(nodes, target, dimensions)
      const returnedNode: CanvasNode = {
        id: pendingArtifactId,
        artifactId: String(pendingReturn.targetArtifactId),
        revisionId: String(draftRevision.id),
        followsCurrentRevision: false,
        kind: 'generated',
        title: changedFiles[0] ?? '待确认结果',
        subtitle: '待确认结果 · 可以使用、放弃或再试一次',
        ...position,
        ...dimensions,
        displayMode: 'standard',
        draft: true,
        scopeId: target?.scopeId ?? scopeId,
        editable: true,
        parentRunId: String(review.run.id),
        revisionOf: String(review.run.targetRevisionId),
        resultGroupId: String(review.run.id),
        runtimeTransient: true,
        managed: true,
        current: false,
        createdAt: String(draftRevision.createdAt ?? review.run.createdAt),
        sourceRunId: String(review.run.id),
        sourcePrompt: review.run.instruction,
        sourceProvider: String(review.run.provider),
        revisionCount: Math.max(1, (target?.revisionCount ?? 0) + 1),
        revisionLabel: `V${Math.max(1, (target?.revisionCount ?? 0) + 1)}`,
        workspaceIds: target?.workspaceIds ?? (workspaceId ? [workspaceId] : []),
      }
      setGraph((graph) => {
        const withoutOldReturn = graph.nodes.filter((node) =>
          !(node.runtimeTransient && node.parentRunId === String(review.run.id)),
        )
        const returnEdgeId = `runtime-return-edge-${String(pendingReturn.id)}`
        const targetEdgeId = `runtime-target-edge-${String(pendingReturn.id)}`
        return {
          nodes: [...withoutOldReturn, returnedNode],
          edges: [
            ...graph.edges.filter((edge) => edge.id !== returnEdgeId && edge.id !== targetEdgeId),
            { id: returnEdgeId, from: current.processNodeId, to: returnedNode.id, kind: 'generate', active: true, scope: 'runtime' as const },
            ...(target === undefined ? [] : [{ id: targetEdgeId, from: target.id, to: returnedNode.id, kind: 'modify' as const, scope: 'runtime' as const }]),
          ],
        }
      })
      setSelectedIds([pendingArtifactId])
      setWorkRail((value) => ({ ...value, collapsed: false }))
    }
    setActiveRun({
      ...current,
      id: String(review.run.id),
      status: readableProviderError ? 'failed' : runtimePresentationStatus(review),
      runtime: true,
      pendingArtifactId,
      runtimeReturnId: pendingReturn === undefined ? current.runtimeReturnId : String(pendingReturn.id),
      baseRevisionId: pendingReturn === undefined ? current.baseRevisionId : String(pendingReturn.baseRevisionId),
      reviewStatus: pendingReturn === undefined ? current.reviewStatus : 'pending',
      changedFiles,
      providerError: readableProviderError,
      ...(review.run.resultSummary === undefined ? {} : { resultSummary: review.run.resultSummary }),
      ...(review.inputRequest === undefined ? { inputRequest: undefined } : {
        inputRequest: {
          requestId: review.inputRequest.requestId,
          question: review.inputRequest.question,
          options: [...review.inputRequest.options],
          allowFreeText: review.inputRequest.allowFreeText,
          ...(review.inputRequest.contextVersion === undefined ? {} : { contextVersion: review.inputRequest.contextVersion }),
        },
      }),
    })
  }, [nodes, scopeId, setGraph, workspaceId])

  const openRunReview = useCallback((review: RunReview) => {
    const target = review.run.targetArtifactId === undefined
      ? undefined
      : nodes.find((node) => node.artifactId === String(review.run.targetArtifactId))
    const contextAnchor = nodes.find((node) => node.artifactId !== undefined)
    const anchor = target ?? contextAnchor
    const id = String(review.run.id)
    const processNodeId = `runtime-run-view-${id}`
    const dimensions = nodeDimensions('process', 'standard')
    setGraph((graph) => graph.nodes.some((node) => node.id === processNodeId) ? graph : {
      nodes: [...graph.nodes, {
        id: processNodeId,
        kind: 'process',
        title: `${id} · ${review.run.instruction.slice(0, 22)}`,
        subtitle: activeRun === null ? '已恢复任务' : '待确认结果',
        x: anchor === undefined ? 520 : anchor.x + 24,
        y: anchor === undefined ? 420 : anchor.y + anchor.height + 54,
        ...dimensions,
        displayMode: 'standard',
        scopeId: anchor?.scopeId ?? scopeId,
        runStatus: runtimePresentationStatus(review),
        commandText: review.run.instruction,
        parentRunId: id,
        createdAt: String(review.run.createdAt),
        sourceRunId: id,
        sourcePrompt: review.run.instruction,
        sourceProvider: String(review.run.provider),
        contextCount: 0,
        targetCount: target === undefined ? 0 : 1,
        outputCount: review.returns.length,
        runtimeTransient: true,
      }],
      edges: target === undefined ? graph.edges : [...graph.edges, {
        id: `runtime-target-run-edge-${id}`,
        from: target.id,
        to: processNodeId,
        kind: 'modify',
        scope: 'runtime',
      }],
    })
    applyRuntimeReview(review, {
      id,
      status: runtimePresentationStatus(review),
      command: review.run.instruction,
      targetIds: target === undefined ? [] : [target.id],
      contextIds: [],
      processNodeId,
      contextSnapshotId: String(review.run.contextManifestId),
      reviewStatus: 'idle',
      changedFiles: [],
      createdAt: String(review.run.createdAt),
      runtime: true,
    }, review.dispatch.lastErrorMessage)
    setNotice(activeRun === null ? '已恢复 Agent 任务' : '已打开任务结果')
  }, [activeRun, applyRuntimeReview, nodes, scopeId, setGraph])

  useEffect(() => {
    if (bootMode !== 'runtime' || activeRun !== null || restoredRunProjectRef.current === activeProjectId) return
    restoredRunProjectRef.current = activeProjectId
    void bridgeRef.current.client.projectRunReviews(activeProjectId, 10).then((call) => {
      if (!call.result.ok) return
      const review = call.result.value.find((item) =>
        !['completed', 'cancelled'].includes(item.presentationPhase)
        || item.returns.some((artifactReturn) => artifactReturn.status === 'pending_review'),
      )
      if (review === undefined) return
      openRunReview(review)
    })
  }, [activeProjectId, activeRun, bootMode, openRunReview])

  const clearPersistedCommandDrafts = useCallback(() => {
    restoredDraftContextIdsRef.current = []
    if (bootMode !== 'runtime') return
    void Promise.all([
      bridgeRef.current.client.deleteCommandDraft(activeProjectId, workspaceId, 'selection'),
      bridgeRef.current.client.deleteCommandDraft(activeProjectId, workspaceId, 'global'),
    ])
  }, [activeProjectId, bootMode, workspaceId])

  /* ---------------- RECEIVER-3 Handoff：切换现场快照（全部来自真实状态，无假字段） ---------------- */

  // surface=当前视图（main/context/workflow 三类投影）；selection=当前选中；pendingReviewCount=待确认返回数。
  const receiverHandoffContext = useMemo<ReceiverHandoffContext>(() => {
    const kind = handoffSurfaceKindFromSurfaceId(activeSurface)
    const surfaceId = kind === 'context'
      ? activeContextId ?? rootScope.id
      : kind === 'workflow'
        ? activeWorkflowId ?? rootScope.id
        : workspaceId ?? scopeId
    return { surface: { kind, surfaceId }, selectionEntityIds: selectedIds, pendingReviewCount: pendingReviews.length }
  }, [activeContextId, activeSurface, activeWorkflowId, pendingReviews.length, rootScope.id, scopeId, selectedIds, workspaceId])

  /* ---------------- 权限门（第一梯队 ⑥）：写操作 Run 的发送前授权 ---------------- */

  // 待确认的写意图 Run 请求（useState open + pending payload，照 App 现有 dialog 模式）。
  const [pendingPermissionRun, setPendingPermissionRun] = useState<PendingPermissionRun | null>(null)

  // 原发送链（改名 executeRunFrom）：内部才 createRuntimeRun / dispatchRuntimeRun；权限门确认后由 startRunFrom 调它。
  const executeRunFrom = useCallback(async (command: string, targetIds: string[], contextIds: string[], intent: RunOutputIntent = 'revise', requestedProvider = 'auto', resultPolicy: ComposerResultPolicy = intent === 'revise' ? 'draft_revision_per_target' : 'create_artifact', proposalSummary?: string, targetRevisionIdOverride?: string, sessionIdOverride?: string, contextArtifactIdsOverride?: readonly string[], execution?: RunExecutionEnvelope): Promise<string | undefined> => {
    if (!command.trim()) return undefined
    const target = nodes.find((node) => node.id === targetIds[0])
    const targetRevisionId = targetRevisionIdOverride ?? target?.revisionId
    if (bootMode === 'runtime') {
      if (intent === 'revise' && (target?.artifactId === undefined || targetRevisionId === undefined)) {
        setNotice('修改现有内容前，需要先保存目标内容的当前版本')
        return undefined
      }
      setNotice('正在准备这次处理…')
      const savedContextIdForRun = activeContextId && ['context-space', 'context-tree', 'context-flow', 'outline'].includes(activeSurface)
        ? activeContextId
        : undefined
      // RECEIVER-3 next-send injection：发送前查 pending Handoff——有未消费的注入「[承接上下文]」前缀
      // （Project state > chat replay，不灌历史聊天）；已消费则不注入（幂等）。
      // 注入是拼入 prompt 文本的轻实现：0.1 不动 Runtime 的 prompt compiler，契约字段已存，0.2 升级为结构化注入。
      let handoffPrefix: string | null = null
      let handoffConsume: (() => Promise<void>) | null = null
      try {
        const identityCall = await bridgeRef.current.client.activeReceiverIdentity(activeProjectId)
        const activeReceiverId = identityCall.result.ok ? identityCall.result.value.activeReceiverId : null
        if (activeReceiverId !== null) {
          const pendingCall = await bridgeRef.current.client.getPendingReceiverHandoff(activeProjectId, activeReceiverId)
          const pending = pendingCall.result.ok ? pendingCall.result.value : null
          if (pending !== null) {
            // fromLabel 按 fromConversationId 反查前手会话标题（无前手=首次承接）。
            const conversationsCall = await bridgeRef.current.client.listConnectedConversations(activeProjectId)
            const fromLabel = conversationsCall.result.ok
              ? conversationsCall.result.value.find((conversation) => conversation.id === pending.fromConversationId)?.label ?? null
              : null
            // 选中对象标题按快照冻结的实体 id 反查当前图（节点已删则如实显示 id）。
            const selectionTitles = pending.selectionEntityIds.map((entityId) => nodes.find((node) => node.id === entityId)?.title ?? entityId)
            handoffPrefix = resolveHandoffPrefix(pending, fromLabel, selectionTitles)
            handoffConsume = async () => {
              const consumeCall = await bridgeRef.current.client.consumeReceiverHandoff(activeProjectId, activeReceiverId)
              if (!consumeCall.result.ok) setNotice(`Handoff 快照消费失败：${consumeCall.result.error.message}`)
            }
          }
        }
      } catch { /* Handoff 查询失败不阻断发送：按原指令继续，快照保持未消费，下次发送重试注入。 */ }
      const instruction = handoffPrefix === null ? command : applyHandoffPrefixToInstruction(handoffPrefix, command)
      const call = await bridgeRef.current.client.createRuntimeRun(activeProjectId, {
        instruction,
        outputIntent: intent,
        ...(target?.artifactId === undefined ? {} : { targetArtifactId: target.artifactId }),
        ...(targetRevisionId === undefined ? {} : { targetRevisionId }),
        requestedProvider,
        resultPolicy: { type: resultPolicy },
        contextArtifactIds: [...new Set((contextArtifactIdsOverride ?? contextIds
          .map((contextId) => nodes.find((node) => node.id === contextId)?.artifactId)
          .filter((artifactId): artifactId is string => artifactId !== undefined))
          .filter((artifactId) => artifactId !== target?.artifactId))],
        ...(savedContextIdForRun === undefined ? {} : { savedContextId: savedContextIdForRun }),
        ...(workspaceId === null ? {} : { workspaceId }),
        ...((sessionIdOverride ?? continuitySessionId) === undefined ? {} : { sessionId: sessionIdOverride ?? continuitySessionId }),
        ...(execution?.receiverRef ? { receiverRef: execution.receiverRef } : {}),
        ...(execution?.orderedReferences ? { orderedReferences: execution.orderedReferences } : {}),
        ...(execution?.resultSlotId ? { resultSlotId: execution.resultSlotId } : {}),
      })
      if (!call.result.ok) {
        setNotice(`任务创建失败：${humanizeRuntimeMessage(call.result.error.message)}`)
        return undefined
      }
      // Run 创建成功才消费 Handoff 快照（创建失败保持 pending，下次发送重试注入；幂等由后端保证）。
      if (handoffConsume !== null) void handoffConsume()
      const created = call.result.value
      const dispatched = await bridgeRef.current.client.dispatchRuntimeRun(String(created.review.run.id))
      const review = dispatched.result.ok ? dispatched.result.value.review : created.review
      const providerError = dispatched.result.ok
        ? dispatched.result.value.providerError
        : { code: 'DISPATCH_REQUEST_FAILED', message: dispatched.result.error.message, retryable: true }
      const providerErrorMessage = providerError === undefined ? undefined : humanizeRuntimeMessage(providerError.message)
      const id = String(review.run.id)
      const processNodeId = `runtime-run-view-${id}`
      const dimensions = nodeDimensions('process', 'standard')
      const process: CanvasNode = {
        id: processNodeId,
        kind: 'process',
        title: `Agent 任务 · ${command.slice(0, 22)}`,
        subtitle: providerErrorMessage ? '等待重新连接本地 Agent' : '已发送给本地 Agent',
        x: target ? target.x + 24 : 460,
        y: target ? target.y + target.height + 54 : 560,
        ...dimensions,
        displayMode: 'standard',
        scopeId,
        runStatus: providerError ? 'failed' : runtimePresentationStatus(review),
        commandText: command,
        parentRunId: id,
        createdAt: String(review.run.createdAt),
        sourceRunId: id,
        sourcePrompt: command,
        sourceProvider: requestedProvider,
        contextCount: contextIds.length,
        targetCount: targetIds.length,
        outputCount: review.returns.length,
        runtimeTransient: true,
      }
      const runEdges = [
        ...targetIds.map((targetId) => ({ id: createId('edge'), from: targetId, to: processNodeId, kind: 'modify' as const, scope: 'runtime' as const })),
        ...contextIds.map((contextId) => ({ id: createId('edge'), from: contextId, to: processNodeId, kind: 'reference' as const, scope: 'runtime' as const })),
      ]
      setGraph((graph) => ({ nodes: [...graph.nodes, process], edges: [...graph.edges, ...runEdges] }))
      const runtimeRun: ActiveRun = {
        id,
        status: providerErrorMessage ? 'failed' : runtimePresentationStatus(review),
        command,
        targetIds,
        contextIds,
        processNodeId,
        contextSnapshotId: String(review.run.contextManifestId),
        reviewStatus: 'idle',
        changedFiles: [],
        createdAt: String(review.run.createdAt),
        runtime: true,
        providerError: providerErrorMessage,
        baseRevisionId: targetRevisionId,
        provider: requestedProvider,
        outputIntent: intent,
        resultPolicy,
        proposalSummary,
      }
      setSelectedIds([])
      setNodeInfoId(null)
      setSelectionComposerText('')
      setGlobalComposerText('')
      clearPersistedCommandDrafts()
      applyRuntimeReview(review, runtimeRun, providerErrorMessage)
      setNotice(providerError
        ? `Agent 任务已保存，${providerErrorMessage}`
        : '任务已交给 Agent')
      return id
    }
    runCounterRef.current += 1
    const id = `RUN-${String(runCounterRef.current).padStart(3, '0')}`
    const processNodeId = createId('run')
    const dimensions = nodeDimensions('process', 'standard')
    const process: CanvasNode = { id: processNodeId, kind: 'process', title: `${id} · ${command.slice(0, 22)}`, subtitle: '排队中 · 正在冻结上下文', x: target ? target.x + 24 : 460, y: target ? target.y + target.height + 54 : 560, ...dimensions, displayMode: 'standard', scopeId, runStatus: 'queued', commandText: command, parentRunId: id, createdAt: new Date().toISOString(), sourceRunId: id, sourcePrompt: command, sourceProvider: requestedProvider, contextCount: contextIds.length, targetCount: targetIds.length, outputCount: 0 }
    const runEdges = [
      ...targetIds.map((targetId) => ({ id: createId('edge'), from: targetId, to: processNodeId, kind: 'modify' as const, scope: 'runtime' as const })),
      ...contextIds.map((contextId) => ({ id: createId('edge'), from: contextId, to: processNodeId, kind: 'reference' as const, scope: 'runtime' as const })),
    ]
    setGraph((current) => ({ nodes: [...current.nodes, process], edges: [...current.edges, ...runEdges] }))
    setSelectedIds([])
    setNodeInfoId(null)
    setActiveRun({ id, status: 'queued', command, targetIds, contextIds, processNodeId, commandId: createId('command'), contextSnapshotId: createId('context-snapshot'), reviewStatus: 'idle', inputResolved: false, changedFiles: [], createdAt: new Date().toISOString(), baseRevisionId: targetRevisionId, provider: requestedProvider, outputIntent: intent, resultPolicy, proposalSummary })
    setSelectionComposerText('')
    setGlobalComposerText('')
    clearPersistedCommandDrafts()
    setNotice('参考快照、指令和执行记录已自动保存')
    return id
  }, [activeContextId, activeProjectId, activeSurface, applyRuntimeReview, bootMode, clearPersistedCommandDrafts, continuitySessionId, nodes, scopeId, setGraph, workspaceId])

  // 用户在确认卡上点「确认执行」→ 继续原发送链（这一刻才 createRuntimeRun），并把 runId 还给当时 await 的调用方。
  const confirmPendingPermissionRun = useCallback(() => {
    const pending = pendingPermissionRun
    setPendingPermissionRun(null)
    if (pending === null) return
    void executeRunFrom(pending.args.command, pending.args.targetIds, pending.args.contextIds, pending.args.intent, pending.args.requestedProvider, pending.args.resultPolicy, pending.args.proposalSummary, pending.args.targetRevisionIdOverride, pending.args.sessionIdOverride, pending.args.contextArtifactIdsOverride, pending.args.execution)
      .then(pending.resolve, () => pending.resolve(undefined))
  }, [executeRunFrom, pendingPermissionRun])

  // 用户拒绝（取消/关卡/点 backdrop）→ resolve(undefined) 放行 await 方；Run 根本不创建（拒绝不半执行）。
  const cancelPendingPermissionRun = useCallback(() => {
    const pending = pendingPermissionRun
    setPendingPermissionRun(null)
    if (pending === null) return
    pending.resolve(undefined)
    setNotice('已取消，未发起任务')
  }, [pendingPermissionRun, setNotice])

  // 权限门统一入口：所有发起 Run 的路径（WorkRail / Selection Composer / 技能重放 / ⌘K / 局部 Agent / 反馈升级）都走这里。
  // 读意图（analyze）白名单静默直发——读操作零打扰；写意图先弹确认卡，确认后继续原发送链，取消则不发起。
  const startRunFrom = useCallback(async (command: string, targetIds: string[], contextIds: string[], intent: RunOutputIntent = 'revise', requestedProvider = 'auto', resultPolicy: ComposerResultPolicy = intent === 'revise' ? 'draft_revision_per_target' : 'create_artifact', proposalSummary?: string, targetRevisionIdOverride?: string, sessionIdOverride?: string, contextArtifactIdsOverride?: readonly string[], execution?: RunExecutionEnvelope): Promise<string | undefined> => {
    if (!command.trim()) return undefined
    // 涉及对象 = 修改目标 + 上下文参考（找不到节点时如实显示 id）。
    const involvedTitles = [...new Set([...targetIds, ...contextIds])].map((id) => nodes.find((node) => node.id === id)?.title ?? id)
    const permission = evaluateRunPermission({ outputIntent: intent, instruction: command, contextTitles: involvedTitles })
    if (permission.kind === 'allow') {
      return executeRunFrom(command, targetIds, contextIds, intent, requestedProvider, resultPolicy, proposalSummary, targetRevisionIdOverride, sessionIdOverride, contextArtifactIdsOverride, execution)
    }
    // 写意图：挂起等待用户决定；已有待确认请求时旧的先以 undefined 放行（被新请求取代，不悬挂）。
    return await new Promise<string | undefined>((resolve) => {
      setPendingPermissionRun((current) => {
        current?.resolve(undefined)
        return { card: permission, args: { command, targetIds, contextIds, intent, requestedProvider, resultPolicy, proposalSummary, targetRevisionIdOverride, sessionIdOverride, contextArtifactIdsOverride, execution }, resolve }
      })
    })
  }, [executeRunFrom, nodes])

  /* ---------------- 教工作流 MVP：编排 → 保存（SKILL.md）→ 一键重放 ---------------- */

  const [workflowSkills, setWorkflowSkills] = useState<readonly WorkflowSkillSummary[]>([])
  // 技能解析缓存：key = artifactId@revisionId（人工编辑产生新 revision 即失效重读）；null = 不是技能格式。
  const workflowSkillCacheRef = useRef(new Map<string, WorkflowSkillSummary | null>())
  useEffect(() => {
    if (bootMode !== 'runtime') return
    const candidates = projectPresentationNodes.filter((node) => node.fileType === 'markdown' && node.managed && node.fileRecordId !== undefined && node.artifactId !== undefined && node.revisionId !== undefined)
    let cancelled = false
    void Promise.all(candidates.map(async (node) => {
      const cacheKey = `${node.artifactId}@${node.revisionId}`
      const cached = workflowSkillCacheRef.current.get(cacheKey)
      if (cached !== undefined) return cached === null ? null : { ...cached, viewId: node.id, title: node.title }
      const call = await bridgeRef.current.client.readFileRecordText(activeProjectId, node.fileRecordId!)
      if (!call.result.ok) return null // 读取失败不写缓存，下次重试
      const parsed = parseWorkflowSkillSteps(call.result.value)
      if (parsed === null) {
        workflowSkillCacheRef.current.set(cacheKey, null)
        return null
      }
      const summary: WorkflowSkillSummary = {
        artifactId: node.artifactId!,
        viewId: node.id,
        title: node.title,
        name: parsed.name,
        description: parsed.description,
        stepCount: parsed.steps.length,
        steps: parsed.steps,
        createdAt: node.createdAt !== undefined ? Date.parse(node.createdAt) || 0 : 0,
      }
      workflowSkillCacheRef.current.set(cacheKey, summary)
      return summary
    })).then((results) => {
      if (cancelled) return
      setWorkflowSkills(results.filter((item): item is WorkflowSkillSummary => item !== null))
    }).catch(() => { /* 扫描失败保持现状，下次 nodes 变化重试 */ })
    return () => { cancelled = true }
  }, [activeProjectId, bootMode, projectPresentationNodes])

  // Run↔步骤链接通（做实 20260826）：技能重放的 Run 在大纲面板投影出技能步骤链；
  // 普通指令 Run 反解不出技能名，自然落空数组（deriveSkillRunSteps 纯函数）。
  const activeRunSkillSteps = useMemo(() => activeRun === null ? [] : deriveSkillRunSteps(activeRun, workflowSkills), [activeRun, workflowSkills])

  const handleSaveWorkflowSkill = useCallback(async (input: { readonly name: string; readonly steps: readonly SkillStepInput[] }): Promise<boolean> => {
    if (bootMode !== 'runtime') { setNotice('原型模式不能保存技能；请打开真实项目后再试'); return false }
    const call = await bridgeRef.current.client.createTextArtifact(activeProjectId, {
      title: `SKILL · ${input.name}`,
      body: serializeWorkflowSkill(input),
      scopeId: workflowPresentationOwnerId,
    })
    if (!call.result.ok) { setNotice(`技能保存失败：${call.result.error.message}`); return false }
    await reloadRuntimeProject()
    setNotice(`已把 ${input.steps.length} 步链存为技能「${input.name}」；刷新后可一键重放`)
    return true
  }, [activeProjectId, bootMode, reloadRuntimeProject, setNotice, workflowPresentationOwnerId])

  const handleReplayWorkflowSkill = useCallback((skill: WorkflowSkillSummary) => {
    const node = projectPresentationNodes.find((item) => item.artifactId === skill.artifactId)
    if (bootMode !== 'runtime' || node?.fileRecordId === undefined) { setNotice('原型模式不能重放技能；请打开真实项目后再试'); return }
    void bridgeRef.current.client.readFileRecordText(activeProjectId, node.fileRecordId).then((call) => {
      if (!call.result.ok) { setNotice(`技能读取失败：${call.result.error.message}`); return }
      const parsed = parseWorkflowSkillSteps(call.result.value)
      if (parsed === null) { setNotice('这份 SKILL.md 已不是可解析的技能格式'); return }
      // 材料 live pointer：按 viewId 引用现有对象；找不到的跳过并明示（不静默失败）。
      const nodeById = new Map(projectPresentationNodes.map((item) => [item.id, item]))
      const missingTitles: string[] = []
      const contextIds: string[] = []
      for (const viewId of collectSkillMaterialViewIds(parsed.steps)) {
        if (nodeById.has(viewId)) contextIds.push(viewId)
        else {
          const material = parsed.steps.flatMap((step) => step.materials).find((item) => item.viewId === viewId)
          missingTitles.push(material?.title || viewId)
        }
      }
      if (missingTitles.length > 0) setNotice(`技能里有 ${missingTitles.length} 个材料已不在项目中，已跳过：${missingTitles.slice(0, 3).join('、')}`)
      void startRunFrom(buildReplayInstruction(parsed), [], contextIds, 'analyze', 'auto', 'reply_only', `技能「${parsed.name}」一键重放`)
    })
  }, [activeProjectId, bootMode, projectPresentationNodes, setNotice, startRunFrom])

  // 沉淀池运行历史投影：画布 Run 节点的 commandText → 每个技能的 { runs, lastRunAt }。
  // 不写回 SKILL.md（运行次数是 Run 集合的投影，One Project Truth，无 Core text-revision API 依赖）。
  const skillRunStats = useMemo(
    () => projectSkillRunStats(workflowSkills, nodes.filter((node) => node.kind === 'process')),
    [nodes, workflowSkills])

  /* ---------------- CommandPalette MVP（第一梯队 ⑤）：⌘K 全局命令面板 ---------------- */

  const [paletteOpen, setPaletteOpen] = useState(false)
  // 面板用的会话承接列表：打开时拉一次（与 ReceiverChip 同源同模式），切换后即时回写。
  const [paletteConversations, setPaletteConversations] = useState<readonly ConnectedConversationV1[]>([])
  const [paletteActiveReceiverId, setPaletteActiveReceiverId] = useState<string | null>(null)

  useEffect(() => {
    if (!paletteOpen || bootMode !== 'runtime') return
    let cancelled = false
    void Promise.all([
      bridgeRef.current.client.listConnectedConversations(activeProjectId),
      bridgeRef.current.client.activeReceiverIdentity(activeProjectId),
    ]).then(([listCall, identityCall]) => {
      if (cancelled) return
      if (listCall.result.ok) setPaletteConversations(listCall.result.value)
      if (identityCall.result.ok) setPaletteActiveReceiverId(identityCall.result.value.activeReceiverId)
    }).catch(() => { /* 拉取失败保持上一次列表；下次打开重试 */ })
    return () => { cancelled = true }
  }, [activeProjectId, bootMode, paletteOpen])

  // 定位到任意画布节点：复用 selectArtifactFromTools 的跨画布切换 + revealNode 相机模式，按节点 id 寻址。
  const locateCanvasNode = useCallback((nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (node === undefined) { setNotice('节点不存在或已被移除'); return }
    if (node.scopeId && node.scopeId !== scopeId) setScopeId(node.scopeId)
    selectNode(node.id)
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    setCamera((current) => revealNode(current, node, viewport?.width ?? 1000, viewport?.height ?? 820, safeInsets))
    setNotice(`已定位「${node.title}」`)
  }, [nodes, safeInsets, scopeId, selectNode])

  const locateBirthConversationSource = useCallback((conversationViewId: string) => {
    // Provenance navigation is read-only: return to Main and Beacon the canonical source View.
    // It deliberately does not alter Selection or enter the Conversation subcanvas.
    setConversationSpaceId(null)
    activateOverview()
    setProjectFocusRequest({ nonce: Date.now(), ids: [conversationViewId], targetTestId: 'canvas' })
    setNotice('正在定位生成这份材料的对话')
  }, [activateOverview])

  const requestSetActiveConversation = useCallback(async (conversationSessionId: string): Promise<void> => {
    if (bootMode !== 'runtime') { setNotice('原型模式不能设置承接对话'); return }
    const session = conversationSessions.find((item) => item.id === conversationSessionId)
    if (!session) { setNotice('这段对话不存在'); return }
    setControllerError(null)
    const listCall = await bridgeRef.current.client.listConnectedConversations(activeProjectId).catch(() => null)
    if (!listCall?.result.ok) { setNotice('暂时无法读取可承接的对话'); return }
    const linked = listCall.result.value.find((item) => item.conversationSessionId === conversationSessionId)
    if (linked) {
      const activeCall = await bridgeRef.current.client.setActiveReceiver(activeProjectId, linked.id).catch(() => null)
      if (!activeCall?.result.ok) { setNotice('设置当前承接失败'); return }
      await refreshConversationIdentity()
      setNotice(`已由「${linked.label}」承接`)
      return
    }
    // Explicit > inferred: even one candidate is not auto-selected.
    setControllerTargetSessionId(conversationSessionId)
    setControllerChoices(listCall.result.value)
  }, [activeProjectId, bootMode, conversationSessions, refreshConversationIdentity])

  const confirmControllerLink = useCallback(async (connectedConversationId: string): Promise<void> => {
    const sessionId = controllerTargetSessionId
    if (!sessionId || controllerBusy) return
    setControllerBusy(true); setControllerError(null)
    try {
      const linked = await bridgeRef.current.client.linkConnectedConversationSession(activeProjectId, connectedConversationId, sessionId)
      if (!linked.result.ok) throw new Error(linked.result.error.message)
      const activated = await bridgeRef.current.client.setActiveReceiver(activeProjectId, connectedConversationId)
      if (!activated.result.ok) throw new Error(activated.result.error.message)
      await refreshConversationIdentity()
      setControllerTargetSessionId(null); setControllerChoices([])
      setNotice('已建立显式会话身份桥并设为当前承接')
    } catch (error: unknown) {
      setControllerError(error instanceof Error ? error.message : '建立会话身份桥失败')
    } finally { setControllerBusy(false) }
  }, [activeProjectId, controllerBusy, controllerTargetSessionId, refreshConversationIdentity])

  const enterConversationSurface = useCallback((conversationId: string) => {
    const session = conversationSessions.find((item) => item.id === conversationId)
    if (!session?.conversationViewId) { setNotice('这份对话还没有可进入的画布'); return }
    const node = nodes.find((item) => item.id === String(session.conversationViewId) && item.entityKind === 'conversation')
    if (!node) { setNotice('这份对话还没有出现在当前项目画布里'); return }
    setNodeInfoId(null)
    setWorkbench(null)
    closeImmersive()
    setConversationSpaceId(conversationId)
  }, [closeImmersive, conversationSessions, nodes])

  // 沉淀池「定位编辑」：技能 artifact 或其材料 → 相机定位（与 ⌘K 节点跳转同一 focus 链）。
  const locateWorkflowSkill = useCallback((skill: WorkflowSkillSummary) => {
    locateCanvasNode(skill.viewId)
  }, [locateCanvasNode])

  // 导出 .lcosproj：走 local-core 的 downloadLcosproj（与 ProjectToolsDialog 同一端点），浏览器锚点下载。
  const exportProjectLcosproj = useCallback(() => {
    if (bootMode !== 'runtime') { setNotice('原型模式没有工程文件可导出'); return }
    void bridgeRef.current.client.downloadLcosproj(activeProjectId).then((call) => {
      if (!call.result.ok) { setNotice(`工程文件导出失败：${call.result.error.message}`); return }
      const url = URL.createObjectURL(call.result.value.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = call.result.value.fileName
      anchor.click()
      URL.revokeObjectURL(url)
      setNotice('已导出 .lcosproj 工程文件')
    })
  }, [activeProjectId, bootMode])

  // 展开导图：项目没有全局“展开全部导图”入口，面板动作作用于当前唯一选中的文本节点（toggleNoteLayout）。
  const expandSelectionMindmap = useCallback(() => {
    const target = selectedNodes.length === 1 ? selectedNodes[0] : undefined
    if (!target || (target.kind !== 'note' && target.fileType !== 'markdown')) { setNotice('先选一个文本节点，再展开为导图'); return }
    toggleNoteLayout(target.id, 'mindmap')
  }, [selectedNodes, toggleNoteLayout])

  const switchPaletteReceiver = useCallback((conversationId: string) => {
    if (bootMode !== 'runtime') { setNotice('原型模式不能切换承接会话'); return }
    void bridgeRef.current.client.setActiveReceiver(activeProjectId, conversationId).then(async (call) => {
      if (!call.result.ok) { setNotice(`切换承接失败：${call.result.error.message}`); return }
      setPaletteActiveReceiverId(call.result.value.activeReceiverId)
      await refreshConversationIdentity()
      setNotice('已切换项目承接会话')
    })
  }, [activeProjectId, bootMode, refreshConversationIdentity])

  const replayPaletteSkill = useCallback((artifactId: string) => {
    const skill = workflowSkills.find((item) => item.artifactId === artifactId)
    if (!skill) { setNotice('这份技能已不在项目中'); return }
    handleReplayWorkflowSkill(skill)
  }, [handleReplayWorkflowSkill, workflowSkills])

  // Ctrl/Cmd+K 只装配动作；项目内容统一交给 Ctrl/Cmd+F Search。
  const paletteAssembly = useMemo(() => createCommandPaletteProviders({
    commands: {
      switchToMainView: () => selectSurface('arrange'),
      switchToContextView: () => selectSurface('context-space'),
      switchToWorkflowView: () => selectSurface('workflow'),
      createTextNode: () => { const point = lastCanvasPointRef.current ?? { x: 180, y: 160 }; createNodeAt('note', point.x, point.y) },
      expandMindmap: expandSelectionMindmap,
      exportLcosproj: exportProjectLcosproj,
      switchReceiver: switchPaletteReceiver,
      replaySkill: replayPaletteSkill,
    },
    conversations: paletteConversations.map((conversation) => ({
      id: conversation.id,
      label: conversation.label,
      active: conversation.id === paletteActiveReceiverId,
    })),
    skills: workflowSkills.map((skill) => ({ artifactId: skill.artifactId, name: skill.name, description: skill.description })),
  }), [createNodeAt, expandSelectionMindmap, exportProjectLcosproj, paletteActiveReceiverId, paletteConversations, replayPaletteSkill, selectSurface, workflowSkills])

  const requestConversationSectionAnnotation = useCallback((input: { readonly conversationId: string; readonly sectionId: string; readonly sectionTitle: string }) => {
    const prompt = [
      '请为 LCOS 当前这一条导入对话的章节生成一次轻量导航标注。',
      `Project ID: ${activeProjectId}`,
      `Conversation ID: ${input.conversationId}`,
      `Section ID: ${input.sectionId}`,
      `当前章节标题: ${input.sectionTitle}`,
      '',
      '目标：服务 GUI 的“重要变化快速导航”，不要替整个项目建立阶段、业务分类或固定语义层级。',
      '必须通过 local-creative-os MCP：',
      '1. 调用 read_lcos_conversation_section 读取原始消息和 sourceHash；',
      '2. 生成一个尽量不超过 5 个汉字的短标题，优先表达这一段发生了什么变化；',
      '3. 在现有 annotation schema 中：decisions 字段写最多 3 条最值得回看的“重要修改 / 方向变化 / 确认点”；todos 字段只写最多 3 条确实还要继续的事项；同时提取涉及文件。若没有重要变化就少写，不凑数；',
      '4. 调用 annotate_lcos_conversation_section，并原样使用读取到的 sourceHash；',
      '5. 不改原始时间线，不生成文件，不覆盖用户锁定的章节标题；不要把 Decision / Todo 字段当成项目级信息架构。',
    ].join('\n')
    setConversationDialogOpen(false)
    startRunFrom(prompt, [], [], 'analyze', 'auto', 'reply_only', `提炼对话章节「${input.sectionTitle}」`)
  }, [activeProjectId, startRunFrom])

  const requestComposerFocus = useCallback(() => {
    const focusComposer = () => {
      const composer = selectedIds.length
        ? document.querySelector<HTMLTextAreaElement>('[data-testid="selection-composer-input"]')
        : composerRef.current ?? document.querySelector<HTMLTextAreaElement>('[data-testid="work-rail-composer-input"]')
      if (!composer) return false
      composer.focus({ preventScroll: true })
      const end = composer.value.length
      composer.setSelectionRange(end, end)
      return document.activeElement === composer
    }
    if (selectedIds.length) {
      setReferencePickActive(false)
      setSelectionComposerOpen(true)
      if (bootMode === 'runtime') {
        void bridgeRef.current.client.listConnectedConversations(activeProjectId).then((call) => {
          if (!call.result.ok) { setSelectionReceiverChoices([]); return }
          const conversations = call.result.value
          setSelectionReceiverChoices(conversations)
          const resolved = resolveComposerReceiver(selectedNodes, conversations, activeReceiverIdentity?.activeReceiverId ?? null)
          const receiverId = resolved.receiver?.connectedConversationId ?? null
          setSelectionReceiverId((current) => current && conversations.some((item) => item.id === current) ? current : receiverId)
          if (receiverId) {
            const receiverSessionId = conversations.find((item) => item.id === receiverId)?.conversationSessionId ?? null
            if (receiverSessionId) setSelectionReferenceIds((current) => current.filter((id) => nodes.find((node) => node.id === id)?.conversation?.id !== receiverSessionId))
          }
        }).catch(() => setSelectionReceiverChoices([]))
      }
    } else {
      setGlobalComposerVisible(true)
      setWorkRail((current) => ({ ...current, collapsed: false }))
      setComposerFocusRequest((current) => current + 1)
    }
    queueMicrotask(focusComposer)
    window.requestAnimationFrame(() => {
      if (!focusComposer()) window.requestAnimationFrame(focusComposer)
    })
  }, [activeProjectId, activeReceiverIdentity?.activeReceiverId, bootMode, selectedIds, selectedIds.length, selectedNodes])

  const requestSelectionRun = useCallback(() => {
    const prompt = selectionComposerText.trim()
    if (!prompt) { setNotice('先写一句你希望本地 Agent 完成的工作'); return }
    if (!selectedIds.length) { setNotice('先选择要给 Agent 参考的内容'); return }
    const selectedProviderStatus = selectionProvider === 'auto' ? null : runtimeProviders.find((provider) => provider.provider === selectionProvider)
    if (selectedProviderStatus && !['ready', 'busy'].includes(selectedProviderStatus.availability)) { setNotice('当前执行工具暂时不可用，换一个再发送'); return }
    // Runtime mode lets the proposal layer resolve ambiguity from the user's
    // natural-language instruction. Do not force a visible Analyze/Create/Revise
    // mode choice merely because multiple editable objects are selected.
    if (bootMode !== 'runtime' && !selectionCreateAsNewNode && selectionEditableNodes.length > 1) {
      setNotice('有多个内容都可能被修改。请缩小选择范围，或在高级设置里选择创建新内容。')
      return
    }

    const target = selectionCreateAsNewNode ? null : selectionTargetNode
    const baseRevisionId = target ? (selectionBaseRevision?.id ?? target.revisionId) : undefined
    const requestedIntent = selectionIntent
    const fallbackIntent: RunOutputIntent = selectionResultSlotNode ? 'create' : selectionCreateAsNewNode ? (requestedIntent === 'revise' ? 'create' : requestedIntent) : requestedIntent === 'create' ? 'create' : target ? 'revise' : 'analyze'
    const fallbackPolicy: ComposerResultPolicy = selectionResultSlotNode ? 'create_artifact' : selectionResultPolicy === 'reply_only' && fallbackIntent !== 'analyze' ? (fallbackIntent === 'create' ? 'create_artifact' : 'draft_revision_per_target') : selectionResultPolicy
    const contextNodes = selectionReferenceCandidates
      .map((candidate) => candidate.node)
      .filter((node) => node.id !== target?.id && Boolean(node.artifactId && node.revisionId))
    const targetIds = target ? [target.id] : []
    const contextIds = contextNodes.map((node) => node.id)

    if (bootMode !== 'runtime') {
      startRunFrom(prompt, targetIds, contextIds, fallbackIntent, selectionProvider, fallbackPolicy, undefined, baseRevisionId)
      return
    }
    if (selectionExecutionBlockedReason || !effectiveSelectionReceiverId) {
      setNotice(selectionExecutionBlockedReason ?? '还没有选择承接这次工作的对话')
      return
    }
    const execution: RunExecutionEnvelope = {
      receiverRef: { connectedConversationId: effectiveSelectionReceiverId },
      orderedReferences: selectionOrderedReferences,
      ...(selectionResultSlotNode?.resultSlotId ? { resultSlotId: selectionResultSlotNode.resultSlotId } : {}),
    }
    setNotice('Agent 正在理解要求并确认本次操作…')
    void bridgeRef.current.client.proposeRun(activeProjectId, {
      ...(workspaceId ? { workspaceId } : {}),
      prompt,
      requestedProvider: selectionProvider,
      createAsNewNode: selectionCreateAsNewNode,
      contextItems: contextNodes.map((node, order) => ({ artifactId: node.artifactId!, revisionId: node.revisionId!, order })),
      editTargets: target && baseRevisionId ? [{ artifactId: target.artifactId!, baseRevisionId }] : [],
      receiverRef: execution.receiverRef,
      orderedReferences: execution.orderedReferences,
      ...(execution.resultSlotId ? { resultSlotId: execution.resultSlotId } : {}),
    }).then((call) => {
      if (!call.result.ok) {
        setNotice(`Agent 计划未通过安全校验：${humanizeRuntimeMessage(call.result.error.message)}`)
        return
      }
      const proposal = call.result.value
      setRunProposal(proposal)
      if (proposal.ambiguity) {
        setNotice(proposal.ambiguity.question)
        return
      }
      startRunFrom(
        proposal.proposal.prompt,
        targetIds,
        contextIds,
        proposal.proposal.intent,
        proposal.proposal.requestedProvider,
        proposal.proposal.resultPolicy.type,
        proposal.summary,
        baseRevisionId,
        undefined,
        undefined,
        {
          receiverRef: proposal.proposal.receiverRef ?? execution.receiverRef,
          orderedReferences: proposal.proposal.orderedReferences ?? execution.orderedReferences,
          ...(proposal.proposal.resultSlotId ?? execution.resultSlotId ? { resultSlotId: proposal.proposal.resultSlotId ?? execution.resultSlotId } : {}),
        },
      )
    })
  }, [activeProjectId, bootMode, selectionBaseRevision?.id, selectionComposerText, selectionCreateAsNewNode, selectionEditableNodes.length, selectionExecutionBlockedReason, selectionOrderedReferences, selectionProvider, effectiveSelectionReceiverId, selectionReferenceCandidates, selectionResultPolicy, selectionResultSlotNode, selectionTargetNode, selectedIds.length, startRunFrom, runtimeProviders, workspaceId])

  const requestGlobalRun = useCallback(() => {
    const prompt = globalComposerText.trim()
    if (!prompt) { setNotice('先写一句要对当前工作空间做什么'); return }
    const selectedProviderStatus = globalProvider === 'auto' ? null : runtimeProviders.find((provider) => provider.provider === globalProvider)
    if (selectedProviderStatus && !['ready', 'busy'].includes(selectedProviderStatus.availability)) { setNotice('当前执行工具暂时不可用，换一个再发送'); return }
    const contextNodes = globalContextIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is CanvasNode => Boolean(node?.artifactId && node.revisionId))
    const contextIds = contextNodes.map((node) => node.id)
    const fallbackIntent: RunOutputIntent = globalCreateAsNewNode ? 'create' : 'analyze'
    const fallbackPolicy: ComposerResultPolicy = globalCreateAsNewNode ? 'create_artifact' : 'reply_only'
    const summary = `${activeWorkspace ? activeWorkspace.label : activeScope.label} · ${contextIds.length} 项参考`
    if (bootMode !== 'runtime') {
      setGlobalComposerVisible(false)
      startRunFrom(prompt, [], contextIds, fallbackIntent, globalProvider, fallbackPolicy, summary)
      return
    }
    setNotice('Agent 正在理解要求并确认本次操作…')
    void bridgeRef.current.client.proposeRun(activeProjectId, {
      ...(workspaceId ? { workspaceId } : {}),
      prompt,
      requestedProvider: globalProvider,
      createAsNewNode: globalCreateAsNewNode,
      contextItems: contextNodes.map((node, order) => ({ artifactId: node.artifactId!, revisionId: node.revisionId!, order })),
      editTargets: [],
    }).then((call) => {
      if (!call.result.ok) { setNotice(`Agent 计划未通过安全校验：${humanizeRuntimeMessage(call.result.error.message)}`); return }
      const proposal = call.result.value
      if (proposal.ambiguity) { setNotice(proposal.ambiguity.question); return }
      setGlobalComposerVisible(false)
      startRunFrom(proposal.proposal.prompt, [], contextIds, proposal.proposal.intent, proposal.proposal.requestedProvider, proposal.proposal.resultPolicy.type, proposal.summary)
    })
  }, [activeProjectId, activeScope.label, activeWorkspace, bootMode, globalComposerText, globalContextIds, globalCreateAsNewNode, globalProvider, nodes, runtimeProviders, startRunFrom, workspaceId])

  const requestSurfaceAgentRun = useCallback(async (input: SurfaceExecutionSubmission): Promise<SurfaceExecutionSubmissionResult | void> => {
    const promptInput = input.prompt.trim()
    if (!promptInput) return undefined
    const receiver = selectionReceiverChoices.find((item) => item.id === input.receiverId)
    const selectedExecutionNodes = input.selectionIds.map((id) => nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
    const selectedEditable = selectedExecutionNodes.filter((node) => node.managed && node.artifactId && node.revisionId)
    const target = input.intent === 'revise' && selectedEditable.length === 1 ? selectedEditable[0] ?? null : null
    if (input.intent === 'revise' && target === null) {
      setNotice('修改现有内容需要恰好选择一个可编辑内容；额外参考不会自动变成修改目标。')
      return undefined
    }
    const executionReferenceIds = mergeExecutionReferenceIds(input.selectionIds, input.referenceIds, target?.id)
    const candidates = referenceCandidates(executionReferenceIds, nodes, input.receiverId, selectionReceiverChoices)
    const proposalGap = proposalCompatibilityBlockReason({
      receiverId: input.receiverId,
      activeReceiverId: activeReceiverIdentity?.activeReceiverId ?? null,
      receivers: selectionReceiverChoices,
      references: candidates,
    })
    if (proposalGap) { setNotice(proposalGap); return undefined }
    if (!receiver?.conversationSessionId) { setNotice('这段对话还没有完成连接，请先选择一段已连接的对话。'); return undefined }

    const orderedReferences = candidates.flatMap((candidate) => candidate.orderedReference ? [candidate.orderedReference] : [])
    const referenceNodes = candidates.map((candidate) => candidate.node)
    const contextNodes = referenceNodes.filter((node) => node.id !== target?.id && node.artifactId && node.revisionId)
    const contextIds = contextNodes.map((node) => node.id)
    const targetIds = target ? [target.id] : []
    const surfaceLabel = input.surface === 'workflow' ? '工作流' : input.surface === 'conversation' ? '对话现场' : '上下文'
    const summary = `${surfaceLabel} · ${receiver.label?.trim() || receiver.conversationRef} · ${orderedReferences.length} 项参考`
    const guardedPrompt = input.surface === 'context'
      ? [
          '你正在 LCOS 当前 Context 工作现场内执行这次 Command。当前 Selection/References 是前景材料，Conversation Reach 是背景可达范围。',
          `Project ID: ${activeProjectId}`,
          ...(workspaceId ? [`Workspace ID: ${workspaceId}`] : []),
          `Receiver ConnectedConversation: ${input.receiverId}`,
          `Explicit references: ${orderedReferences.length}`,
          '',
          '如果只是分析、回答、总结，直接完成当前请求。',
          '如果需要改变 Context 的长期成员或目标，只能通过既有 Proposal / Semantic mutation 链；禁止把一次 Prompt Reference 偷偷变成长期 membership。',
          '如果用户说“刚导入这一批”或 latest import batch，使用持久化批次引用；禁止按时间戳猜。',
          '',
          `用户请求：${promptInput}`,
        ].join('\n')
      : input.surface === 'workflow'
        ? [
            '你正在 LCOS 当前 Workflow 工作现场内执行这次 Command。当前 Selection/References 是前景材料，Workflow 本身不是一个临时聊天 Session。',
            `Project ID: ${activeProjectId}`,
            ...(workspaceId ? [`Workspace ID: ${workspaceId}`] : []),
            `Receiver ConnectedConversation: ${input.receiverId}`,
            `Explicit references: ${orderedReferences.length}`,
            '',
            '围绕当前 Workflow 回答、创建结果或修改明确目标。不要因为一次局部问答自动固化 Workflow/Skill。',
            '如果需要长期结构变化，仍走 Project mutation / Review；不要绕过用户确认。',
            '',
            `用户请求：${promptInput}`,
          ].join('\n')
        : [
            '你正在 LCOS 当前 Conversation Subcanvas 内继续这段项目对话。这个现场投影的是同一段 canonical Conversation，不创建新的 chat/session truth。',
            `Project ID: ${activeProjectId}`,
            `Receiver ConnectedConversation: ${input.receiverId}`,
            `Explicit references: ${orderedReferences.length}`,
            '',
            'Conversation Reach 是这只 Glyth 的背景可达范围。当前时间线里的 Message 不是 Project Entity，不得伪造为 Artifact/Reference。',
            '如果要修改 Project Truth，仍走 Proposal / Gate / Review；一次对话请求不会自动改变长期 membership。',
            '',
            `用户请求：${promptInput}`,
          ].join('\n')

    const baseRevisionId = target?.revisionId
    const execution: RunExecutionEnvelope = {
      receiverRef: { connectedConversationId: input.receiverId },
      orderedReferences,
      ...(input.resultSlotId ? { resultSlotId: input.resultSlotId } : {}),
    }

    setNotice('Agent 正在理解当前现场的要求并确认操作…')
    try {
      const call = await bridgeRef.current.client.proposeRun(activeProjectId, {
        ...(workspaceId ? { workspaceId } : {}),
        prompt: guardedPrompt,
        requestedProvider: input.provider,
        createAsNewNode: input.intent === 'create',
        contextItems: contextNodes.map((node, order) => ({ artifactId: node.artifactId!, revisionId: node.revisionId!, order })),
        editTargets: target && baseRevisionId ? [{ artifactId: target.artifactId!, baseRevisionId }] : [],
        receiverRef: execution.receiverRef,
        orderedReferences: execution.orderedReferences,
        ...(execution.resultSlotId ? { resultSlotId: execution.resultSlotId } : {}),
      })
      if (!call.result.ok) { setNotice(`Agent 计划未通过安全校验：${humanizeRuntimeMessage(call.result.error.message)}`); return undefined }
      const proposal = call.result.value
      if (proposal.ambiguity) { setNotice(proposal.ambiguity.question); return undefined }
      const runId = await startRunFrom(
        proposal.proposal.prompt,
        targetIds,
        contextIds,
        proposal.proposal.intent,
        proposal.proposal.requestedProvider,
        proposal.proposal.resultPolicy.type,
        proposal.summary,
        baseRevisionId,
        undefined,
        undefined,
        {
          receiverRef: proposal.proposal.receiverRef ?? execution.receiverRef,
          orderedReferences: proposal.proposal.orderedReferences ?? execution.orderedReferences,
          ...(proposal.proposal.resultSlotId ?? execution.resultSlotId ? { resultSlotId: proposal.proposal.resultSlotId ?? execution.resultSlotId } : {}),
        },
      )
      return { ...(runId ? { runId } : {}) }
    } catch {
      setNotice('当前工作现场暂时无法交给 Agent；项目内容没有被修改')
      return undefined
    }
  }, [activeProjectId, activeReceiverIdentity?.activeReceiverId, nodes, selectionReceiverChoices, startRunFrom, workspaceId])

  const requestContextProposalModification = useCallback((proposal: ContextChangeProposalV1, instruction: string) => {
    const changeRequest = instruction.trim()
    if (!changeRequest) return
    const proposalSummary = [
      `当前待审查 Proposal: ${proposal.proposalId}`,
      `原原因: ${proposal.reason}`,
      `原加入 View: ${proposal.addViewIds.join(', ') || '无'}`,
      `原移除 View: ${proposal.removeViewIds.join(', ') || '无'}`,
      `原目标 View: ${proposal.targetViewId ?? '不变'}`,
      '',
      `用户要求修改：${changeRequest}`,
      '',
      '请重新读取当前 ActiveContext。不要直接应用旧 Proposal，也不要修改旧 Proposal；请用 propose_lcos_context_change 生成一条新的待审查 Proposal。旧 Proposal 继续保持 pending，由用户自行保留或撤掉。',
    ].join('\n')
    const receiverId = activeReceiverIdentity?.activeReceiverId ?? null
    if (!receiverId) { setNotice('当前没有承接对话；先选择一段对话，再修改这次提案。'); return }
    void requestSurfaceAgentRun({
      surface: 'context',
      selectionIds: [...selectedIds],
      receiverId,
      referenceIds: [],
      provider: 'auto',
      intent: 'analyze',
      resultPolicy: 'reply_only',
      prompt: proposalSummary,
    })
    setNotice('已让当前 Receiver 重新生成一版 Context Proposal；旧提案不会被覆盖')
  }, [activeReceiverIdentity?.activeReceiverId, requestSurfaceAgentRun, selectedIds])

  const returnArtifact = useCallback((run: ActiveRun) => {
    const target = nodes.find((node) => node.id === run.targetIds[0])
    if (!target) return
    const id = createId('generated')
    const dimensions = nodeDimensions('generated', 'standard')
    const position = findPendingReturnPosition(nodes, target, dimensions)
    const generated: CanvasNode = { id, artifactId: target.artifactId ?? createId('artifact'), revisionId: createId('revision'), followsCurrentRevision: false, kind: 'generated', title: `Thinker_Concept_${run.id}_AI.pptx`, subtitle: '结果待回收 · 等待确认', ...position, ...dimensions, displayMode: 'standard', draft: true, pageCount: target.pageCount ?? 18, scopeId: target.scopeId ?? scopeId, editable: true, parentRunId: run.id, revisionOf: target.revisionId ?? target.id, resultGroupId: run.id, createdAt: new Date().toISOString(), sourceRunId: run.id, sourcePrompt: run.command, sourceProvider: run.provider, managed: true, workspaceIds: target.workspaceIds }
    setGraph((current) => ({ nodes: [...current.nodes, generated], edges: [...current.edges, { id: createId('edge'), from: run.processNodeId, to: id, kind: 'generate', active: true, scope: 'runtime' as const }, { id: createId('edge'), from: target.id, to: id, kind: 'modify', scope: 'runtime' as const }] }))
    setActiveRun((current) => current?.id === run.id ? { ...current, status: 'review', pendingArtifactId: id, reviewStatus: 'pending', changedFiles: [generated.title] } : current)
    setSelectedIds([id])
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    setCamera((current) => revealNode(current, generated, viewport?.width ?? 1000, viewport?.height ?? 820, safeInsets))
    setNotice('结果已自动归位，工作栏已进入版本确认')
  }, [nodes, safeInsets, scopeId, setGraph])


  useEffect(() => {
    if (!activeRun?.runtime) {
      runEventSequenceRef.current = undefined
      setRunEvents([])
      setRunEventsError(null)
      return
    }
    let cancelled = false
    let timer = 0
    const load = async (): Promise<void> => {
      const call = await bridgeRef.current.client.runEvents(activeRun.id, runEventSequenceRef.current)
      if (cancelled) return
      if (!call.result.ok) {
        setRunEventsError(call.result.error.message)
      } else {
        setRunEventsError(null)
        const events = call.result.value
        if (events.length > 0) {
          runEventSequenceRef.current = Math.max(runEventSequenceRef.current ?? 0, ...events.map((event) => event.sequence))
          setRunEvents((current) => {
            const bySequence = new Map(current.map((event) => [event.sequence, event]))
            for (const event of events) bySequence.set(event.sequence, event)
            return [...bySequence.values()].sort((left, right) => left.sequence - right.sequence)
          })
        }
      }
      if (!cancelled && !['completed', 'cancelled', 'failed'].includes(activeRun.status)) {
        timer = window.setTimeout(() => { void load() }, 2_000)
      }
    }
    runEventSequenceRef.current = undefined
    setRunEvents([])
    setRunEventsError(null)
    void load()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [activeRun?.id, activeRun?.runtime, activeRun?.status])

  const recoverActiveRun = useCallback(() => {
    if (!activeRun?.runtime || runtimeRecovering) return
    setRuntimeRecovering(true)
    setNotice('正在重新连接本地 Agent，并恢复这个任务…')
    void bridgeRef.current.client.recoverRuntimeRun(activeRun.id).then((call) => {
      if (!call.result.ok) {
        setNotice(`暂时无法恢复：${humanizeRuntimeMessage(call.result.error.message)}`)
        return
      }
      applyRuntimeReview(call.result.value.review, activeRun, call.result.value.providerError?.message)
      setNotice(humanizeRuntimeMessage(call.result.value.providerError?.message) || '任务已重新连接，将继续从已有记录恢复')
    }).finally(() => { setRuntimeRecovering(false) })
  }, [activeRun, applyRuntimeReview, runtimeRecovering])


  const syncRuntimeRun = useCallback(() => {
    if (!activeRun?.runtime || runtimeSyncBusyRef.current) return
    runtimeSyncBusyRef.current = true
    void bridgeRef.current.client.syncRuntimeRun(activeRun.id).then((call) => {
      if (!call.result.ok) {
        setNotice(`同步失败：${call.result.error.message}`)
        return
      }
      const review = call.result.value.review
      const providerError = call.result.value.providerError?.message
      const hadReturn = activeRun.pendingArtifactId !== undefined
      applyRuntimeReview(review, activeRun, providerError)
      // 只在需要用户决策或真正出错时提示，避免每 3 秒轮询刷屏（queued/running 中间态不弹）。
      if (review.presentationPhase === 'review' && !hadReturn) setNotice('结果已摄取为 Draft，等待你的决定')
      else if (providerError) setNotice(humanizeRuntimeMessage(providerError))
    }).finally(() => { runtimeSyncBusyRef.current = false })
  }, [activeRun, applyRuntimeReview])

  const cancelActiveRun = useCallback(() => {
    if (!activeRun || !['queued', 'running'].includes(activeRun.status)) return
    if (!activeRun.runtime) {
      setActiveRun((current) => current?.id === activeRun.id ? { ...current, status: 'cancelled' } : current)
      setNotice('任务已撤回；之后返回的结果不会成为待确认版本')
      return
    }
    setNotice('正在撤回 Agent 任务…')
    void bridgeRef.current.client.cancelRuntimeRun(activeRun.id).then((call) => {
      if (!call.result.ok) {
        setNotice(`撤回失败：${call.result.error.message}`)
        return
      }
      applyRuntimeReview(call.result.value.review, activeRun, call.result.value.providerError?.message)
      setActiveRun((current) => current?.id === activeRun.id ? { ...current, status: 'cancelled' } : current)
      setNotice('任务已撤回；迟到结果只保留审计，不会进入当前版本')
    })
  }, [activeRun, applyRuntimeReview])

  const answerActiveRunInput = useCallback((input: { readonly requestId: string; readonly text?: string; readonly selectedOptions?: readonly string[] }) => {
    if (!activeRun?.runtime || activeRun.status !== 'waiting_input') return
    setNotice('已收到补充，正在继续同一个任务…')
    void bridgeRef.current.client.answerRunInput(activeRun.id, input).then((call) => {
      if (!call.result.ok) {
        setNotice(`暂时无法继续：${call.result.error.message}`)
        return
      }
      applyRuntimeReview(call.result.value.review, activeRun, call.result.value.providerError?.message)
      setNotice(humanizeRuntimeMessage(call.result.value.providerError?.message) || '补充信息已发送，Agent 会继续处理')
    })
  }, [activeRun, applyRuntimeReview])

  useEffect(() => {
    if (!activeRun?.runtime || !['queued', 'running'].includes(activeRun.status)) return
    const timer = window.setInterval(syncRuntimeRun, 3_000)
    return () => window.clearInterval(timer)
  }, [activeRun?.id, activeRun?.runtime, activeRun?.status, syncRuntimeRun])

  const acceptRun = useCallback(() => {
    if (!activeRun?.pendingArtifactId || !pendingNode) return
    if (activeRun.runtime) {
      if (activeRun.runtimeReturnId === undefined || activeRun.baseRevisionId === undefined) {
        setNotice('这份返回结果信息不完整，暂时不能接受')
        return
      }
      setNotice('正在确认这份草稿版本…')
      void bridgeRef.current.client.acceptArtifactReturn(activeRun.runtimeReturnId, {
        expectedBaseRevisionId: activeRun.baseRevisionId as never,
      }).then(async (call) => {
        if (!call.result.ok) {
          setNotice(`接受失败：${humanizeRuntimeMessage(call.result.error.message)}`)
          return
        }
        const finalized = await bridgeRef.current.client.finalizeRuntimeRun(
          activeRun.id,
          'completed',
          'Artifact Return accepted in LCOS.',
        )
        void bridgeRef.current.loadProject().then((loaded) => {
          if (loaded.state !== null) applyReloadedRuntimeState(loaded.state, activeRun.targetIds[0] ?? '')
          setActiveRun((run) => run === null ? null : {
            ...run,
            status: 'completed',
            reviewStatus: 'accepted',
            resultArtifactId: pendingNode.artifactId,
            resultRevisionId: pendingNode.revisionId,
            resultNodeId: loaded.state?.nodes.find((node) => node.artifactId === pendingNode.artifactId && (!pendingNode.revisionId || node.revisionId === pendingNode.revisionId))?.id ?? activeRun.targetIds[0],
            pendingArtifactId: undefined,
            providerError: undefined,
          })
              setNotice(finalized.result.ok && finalized.result.value.providerError === undefined
            ? 'Draft 已成为 Current Revision，Bridge Review 已完成'
            : 'Draft 已成为 Current；Bridge finalize 将在后续恢复')
        })
      })
      return
    }
    const acceptedArtifactId = pendingNode.artifactId
    const acceptedRevisionId = pendingNode.revisionId
    const targetIds = new Set(activeRun.targetIds)
    const compactProcess = nodeDimensions('process', 'compact')
    setGraph((current) => ({
      nodes: current.nodes.map((node) => {
        if (node.id === activeRun.processNodeId) {
          return {
            ...node,
            runStatus: 'completed',
            subtitle: `已完成 · ${activeRun.targetIds.length} 个目标`,
            displayMode: 'compact',
            ...compactProcess,
          }
        }
        if (node.id === activeRun.pendingArtifactId) {
          return { ...node, kind: 'working', draft: false, current: true, followsCurrentRevision: true, subtitle: `当前版本 · 接受自 ${activeRun.id}`, displayMode: 'expanded', ...nodeDimensions('working', 'expanded') }
        }
        if (targetIds.has(node.id)) return { ...node, current: false, followsCurrentRevision: false, subtitle: `${node.subtitle} · 已归档` }
        if (acceptedArtifactId && node.artifactId === acceptedArtifactId && node.followsCurrentRevision) {
          return { ...node, revisionId: acceptedRevisionId, subtitle: `跟随当前版本 · ${activeRun.id}` }
        }
        return node
      }),
      edges: current.edges.map((edge) => edge.from === activeRun.processNodeId ? { ...edge, active: false } : edge),
    }))
    setSelectedIds([activeRun.pendingArtifactId])
    setNodeInfoId(null)
    setActiveRun((run) => run ? { ...run, status: 'completed', reviewStatus: 'accepted', resultArtifactId: acceptedArtifactId, resultRevisionId: acceptedRevisionId, resultNodeId: activeRun.pendingArtifactId } : run)
    setNotice('已接受为当前版本，相关视图已同步')
  }, [activeRun, applyReloadedRuntimeState, pendingNode, setGraph])

  const rejectRun = useCallback(() => {
    if (!activeRun?.runtime || activeRun.runtimeReturnId === undefined) {
      setNotice('当前没有可放弃的返回结果')
      return
    }
    setNotice('正在放弃这份草稿…')
    void bridgeRef.current.client.rejectArtifactReturn(activeRun.runtimeReturnId).then(async (call) => {
      if (!call.result.ok) {
        setNotice(`放弃失败：${humanizeRuntimeMessage(call.result.error.message)}`)
        return
      }
      setGraph((graph) => ({
        nodes: graph.nodes.filter((node) => node.id !== activeRun.pendingArtifactId),
        edges: graph.edges.filter((edge) => edge.to !== activeRun.pendingArtifactId),
      }))
      setActiveRun((run) => run === null ? null : {
        ...run,
        status: 'completed',
        reviewStatus: 'idle',
        pendingArtifactId: undefined,
        providerError: undefined,
      })
      const finalized = await bridgeRef.current.client.finalizeRuntimeRun(
        activeRun.id,
        'completed',
        'Artifact Return rejected in LCOS; Current Revision unchanged.',
      )
      setNotice(finalized.result.ok && finalized.result.value.providerError === undefined
        ? 'Draft 已拒绝；Current 未改变，Bridge Review 已完成'
        : 'Draft 已拒绝；Bridge finalize 将在后续恢复')
    })
  }, [activeRun, setGraph])

  const continueModify = useCallback(() => {
    if (!activeRun?.pendingArtifactId || !pendingNode) return
    setSelectedIds([pendingNode.id])
    setNodeInfoId(null)
    setSelectionBaseRevision(null)
    setSelectionComposerText(activeRun.command)
    setNotice('返回结果已设为本轮修改目标，请直接在节点下方补充要求')
    window.requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('[data-testid="selection-composer-input"]')?.focus({ preventScroll: true }))
  }, [activeRun?.pendingArtifactId, pendingNode])


  const upgradeAgentResultWithFeedback = useCallback(async (input: RevisionUpgradeInput) => {
    if (bootMode !== 'runtime' || !activeRun || activeRun.status !== 'completed' || !revisionUpgradeTargetNode?.artifactId || !revisionUpgradeTargetNode.revisionId) {
      setNotice('只有已经完成并落回项目的 Agent 结果可以进入反馈升级链')
      return
    }
    setRevisionUpgradeBusy(true)
    try {
      const feedbackBody = [
        `# 反馈｜${revisionUpgradeTargetNode.title}`,
        '',
        input.feedback,
        '',
        `> 来源执行记录: ${activeRun.id}`,
        `> 反馈目标 Revision: ${revisionUpgradeTargetNode.revisionId}`,
      ].join('\n')
      const feedbackCall = await bridgeRef.current.client.createTextArtifact(activeProjectId, {
        title: `反馈 · ${revisionUpgradeTargetNode.title}`,
        body: feedbackBody,
        scopeId: revisionUpgradeTargetNode.scopeId ?? scopeId,
        ...(workspaceId ? { workspaceId } : {}),
        x: revisionUpgradeTargetNode.x + revisionUpgradeTargetNode.width + 36,
        y: revisionUpgradeTargetNode.y,
      })
      if (!feedbackCall.result.ok) {
        setNotice(`反馈保存失败：${feedbackCall.result.error.message}`)
        return
      }
      const feedback = feedbackCall.result.value
      const preparedCall = await bridgeRef.current.client.prepareRevisionWorkflow(activeProjectId, {
        targetArtifactId: String(revisionUpgradeTargetNode.artifactId),
        baseRevisionId: String(revisionUpgradeTargetNode.revisionId),
        feedbackArtifactIds: [feedback.artifactId],
        decision: input.decision,
        changeItems: input.changeItems,
        preserveItems: input.preserveItems,
        scopeId: revisionUpgradeTargetNode.scopeId ?? scopeId,
        ...(workspaceId ? { workspaceId } : {}),
        requestedProvider: activeRun.provider ?? 'auto',
      })
      if (!preparedCall.result.ok) {
        setNotice(`反馈升级准备失败：${humanizeRuntimeMessage(preparedCall.result.error.message)}`)
        return
      }
      const prepared = preparedCall.result.value
      if (prepared.proposal.ambiguity) {
        setNotice(prepared.proposal.ambiguity.question)
        return
      }
      const proposal = prepared.proposal.proposal
      await startRunFrom(
        proposal.prompt,
        [revisionUpgradeTargetNode.id],
        [],
        proposal.intent,
        proposal.requestedProvider,
        proposal.resultPolicy.type,
        prepared.proposal.summary,
        prepared.baseRevisionId,
        undefined,
        [feedback.artifactId, prepared.decisionArtifactId, prepared.changeRequestArtifactId],
      )
      setRevisionUpgradeOpen(false)
      setNotice('反馈已整理为决定和修改要求，并创建了新的待确认版本')
      void openProject(activeProjectId)
    } finally {
      setRevisionUpgradeBusy(false)
    }
  }, [activeProjectId, activeRun, bootMode, openProject, revisionUpgradeTargetNode, scopeId, startRunFrom, workspaceId])

  const useHistoricalRevision = useCallback((revision: ArtifactRevisionProvenance) => {
    if (!workbenchNode?.artifactId || workbenchNode.managed !== true) {
      setNotice('只有受管内容可以从历史 Revision 继续修改')
      return
    }
    setSelectedIds([workbenchNode.id])
    setSelectionBaseRevision(revision)
    setSelectionCreateAsNewNode(false)
    if (revision.provider && runtimeProviders.some((provider) => provider.provider === revision.provider)) setSelectionProvider(revision.provider)
    setSelectionComposerText(revision.prompt ?? '')
    setWorkbench(null)
    setNodeInfoId(null)
    setNotice(`已将 ${revision.label} 设为修改基线；发送后只会创建新的 Draft`)
    window.requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('[data-testid="selection-composer-input"]')?.focus({ preventScroll: true }))
  }, [runtimeProviders, workbenchNode])

  const retryRun = useCallback(() => {
    if (!activeRun) return
    if (activeRun.runtime) {
      if (activeRun.runtimeReturnId === undefined) {
        void bridgeRef.current.client.dispatchRuntimeRun(activeRun.id).then((call) => {
          if (!call.result.ok) {
            setNotice(`恢复失败：${call.result.error.message}`)
            return
          }
          applyRuntimeReview(call.result.value.review, activeRun, call.result.value.providerError?.message)
          setNotice(humanizeRuntimeMessage(call.result.value.providerError?.message) || 'Agent 任务已重新连接')
        })
        return
      }
      setNotice('正在创建一次重试…')
      void bridgeRef.current.client.retryArtifactReturn(activeRun.runtimeReturnId, {
        // 重新执行 = 用原指令重跑；输入框里的新文本属于“补充修改要求”。
        instruction: activeRun.command,
      }).then(async (retryCall) => {
        if (!retryCall.result.ok) {
          setNotice(`重试失败：${humanizeRuntimeMessage(retryCall.result.error.message)}`)
          return
        }
        const newRun = retryCall.result.value.run
        const finalized = await bridgeRef.current.client.finalizeRuntimeRun(
          activeRun.id,
          'retrying',
          `Superseded by ${String(newRun.id)}.`,
        )
        const dispatchCall = await bridgeRef.current.client.dispatchRuntimeRun(String(newRun.id))
        if (!dispatchCall.result.ok) {
          setNotice(`重试已保存，但暂时无法交给 Agent：${humanizeRuntimeMessage(dispatchCall.result.error.message)}`)
          return
        }
        setGraph((graph) => ({
          nodes: graph.nodes.filter((node) => node.id !== activeRun.pendingArtifactId),
          edges: graph.edges.filter((edge) => edge.to !== activeRun.pendingArtifactId),
        }))
        const next: ActiveRun = {
          ...activeRun,
          id: String(newRun.id),
          status: dispatchCall.result.value.providerError ? 'failed' : runtimePresentationStatus(dispatchCall.result.value.review),
          command: String(newRun.instruction),
          pendingArtifactId: undefined,
          runtimeReturnId: undefined,
          baseRevisionId: undefined,
          reviewStatus: 'idle',
          changedFiles: [],
          createdAt: String(newRun.createdAt),
          providerError: dispatchCall.result.value.providerError?.message,
        }
        applyRuntimeReview(dispatchCall.result.value.review, next, dispatchCall.result.value.providerError?.message)
        setSelectionComposerText('')
        setGlobalComposerText('')
        setNotice(dispatchCall.result.value.providerError?.message
          ?? (finalized.result.ok && finalized.result.value.providerError === undefined
            ? '重试任务已交给 Agent'
            : '重试任务已交给 Agent；上一条待确认状态仍需恢复'))
      })
      return
    }
    startRunFrom(activeRun.command.replace(/（已确认.*?）/, ''), activeRun.targetIds, activeRun.contextIds, activeRun.outputIntent ?? 'revise', activeRun.provider ?? 'auto', activeRun.resultPolicy ?? 'draft_revision_per_target', activeRun.proposalSummary, activeRun.baseRevisionId)
    setNotice('已沿用原指令与上下文重新执行')
  }, [activeRun, applyRuntimeReview, globalComposerText, selectionComposerText, setGraph, startRunFrom])

  const toggleSelectionReference = useCallback((id: string) => {
    setSelectionReferenceIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }, [])

  const moveSelectionReference = useCallback((id: string, delta: -1 | 1) => {
    setSelectionReferenceIds((current) => {
      const index = current.indexOf(id)
      if (index < 0) return current
      const nextIndex = Math.max(0, Math.min(current.length - 1, index + delta))
      if (nextIndex === index) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(nextIndex, 0, moved!)
      return next
    })
  }, [])

  const chooseSelectionReceiver = useCallback((connectedConversationId: string | null) => {
    setSelectionReceiverId(connectedConversationId)
    if (!connectedConversationId) return
    const sessionId = selectionReceiverChoices.find((item) => item.id === connectedConversationId)?.conversationSessionId ?? null
    if (sessionId) setSelectionReferenceIds((current) => current.filter((id) => nodes.find((node) => node.id === id)?.conversation?.id !== sessionId))
  }, [nodes, selectionReceiverChoices])

  const changeSharedComposerIntent = useCallback((intent: RunOutputIntent) => {
    setSelectionIntent(intent)
    setSelectionCreateAsNewNode(intent === 'create')
    setSelectionResultPolicy(intent === 'create' ? 'create_artifact' : intent === 'revise' ? 'draft_revision_per_target' : 'reply_only')
    if (intent !== 'revise') setSelectionBaseRevision(null)
  }, [])

  const sharedComposerCommand: SharedComposerCommandState = useMemo(() => ({
    nodes,
    selectionIds: selectedIds,
    referenceIds: selectionReferenceIds,
    receiverId: selectionReceiverId,
    prompt: selectionComposerText,
    provider: selectionProvider,
    intent: selectionIntent,
    resultPolicy: selectionResultPolicy,
    referencePickActive,
    onPromptChange: setSelectionComposerText,
    onProviderChange: setSelectionProvider,
    onIntentChange: changeSharedComposerIntent,
    onResultPolicyChange: setSelectionResultPolicy,
    onReceiverChange: chooseSelectionReceiver,
    onToggleReference: toggleSelectionReference,
    onMoveReference: moveSelectionReference,
    onStartReferencePick: () => setReferencePickActive(true),
    onFinishReferencePick: () => setReferencePickActive(false),
  }), [changeSharedComposerIntent, chooseSelectionReceiver, moveSelectionReference, nodes, referencePickActive, selectedIds, selectionComposerText, selectionIntent, selectionProvider, selectionReceiverId, selectionReferenceIds, selectionResultPolicy, toggleSelectionReference])

  const resolveAssemblyWarehouseReferenceId = useCallback((item: WarehouseItemV1): string | null => {
    const entity = item.entityRef
    let node: CanvasNode | undefined
    if (entity.type === 'artifact') {
      node = (entity.viewId ? nodes.find((candidate) => candidate.id === entity.viewId) : undefined)
        ?? nodes.find((candidate) => candidate.artifactId === entity.id)
    } else if (entity.type === 'conversation') {
      const sessionId = selectionReceiverChoices.find((candidate) => candidate.id === entity.id)?.conversationSessionId ?? null
      node = sessionId ? nodes.find((candidate) => candidate.entityKind === 'conversation' && candidate.conversation?.id === sessionId) : undefined
    } else if (entity.type === 'context' || entity.type === 'workflow' || entity.type === 'collection') {
      node = nodes.find((candidate) => candidate.opensScopeId === entity.id || candidate.id === `scope:${entity.id}`)
    } else if (entity.type === 'scene') {
      node = nodes.find((candidate) => candidate.id === `workspace:${entity.id}`)
    } else {
      node = nodes.find((candidate) => candidate.id === entity.id)
    }
    if (!node) return null
    return orderedReferenceForNode(node, 0).supported ? node.id : null
  }, [nodes, selectionReceiverChoices])

  const toggleContext = useCallback((id: string) => {
    if (selectionContextIds.includes(id)) {
      setExcludedContextIds((current) => Array.from(new Set([...current, id])))
      setPinnedContextIds((current) => current.filter((item) => item !== id))
    } else {
      setPinnedContextIds((current) => Array.from(new Set([...current, id])))
      setExcludedContextIds((current) => current.filter((item) => item !== id))
    }
  }, [selectionContextIds])

  const selectPrimaryTarget = useCallback((id: string) => setManualInference(setPrimaryTarget(inference, id, selectedIds)), [inference, selectedIds])
  const moveRole = useCallback((id: string, role: 'target' | 'context') => setManualInference(moveBetweenTargetAndContext(inference, id, role, nodes)), [inference, nodes])
  const openNative = useCallback((node: CanvasNode) => {
    const url = node.previewText?.match(/^url:\s*(https?:\/\/\S+)/mi)?.[1]
    if (url) { window.open(url, '_blank', 'noopener,noreferrer'); return }
    if (!node.artifactId) { setNotice('该节点没有可打开的本地源'); return }
    if (bootMode !== 'runtime') { setNotice('原型模式没有本地文件服务'); return }
    void bridgeRef.current.client.openArtifactSource(node.artifactId).then((call) => {
      if (!call.result.ok) setNotice(`打开失败：${call.result.error.message}`)
      else setNotice(`已交给系统打开 ${node.title}`)
    })
  }, [bootMode])

  const revealSource = useCallback((node: CanvasNode) => {
    if (!node.artifactId) { setNotice('该节点没有本地源可定位'); return }
    if (bootMode !== 'runtime') { setNotice('原型模式没有本地文件服务'); return }
    void bridgeRef.current.client.revealArtifactSource(node.artifactId).then((call) => {
      if (!call.result.ok) setNotice(`定位失败：${call.result.error.message}`)
      else setNotice('已在资源管理器中定位源文件')
    })
  }, [bootMode])

  const copySourcePath = useCallback((node: CanvasNode) => {
    if (!node.artifactId) { setNotice('该节点没有可复制的源路径'); return }
    if (bootMode !== 'runtime') { setNotice('原型模式没有本地文件服务'); return }
    void bridgeRef.current.client.artifactSourcePath(node.artifactId).then((call) => {
      if (!call.result.ok) { setNotice(`读取路径失败：${call.result.error.message}`); return }
      const path = call.result.value.path
      if (!path) { setNotice('该节点没有本地路径（可能是网页链接）'); return }
      void navigator.clipboard?.writeText(path).then(() => setNotice('源路径已复制到剪贴板')).catch(() => setNotice(`路径：${path}`))
    })
  }, [bootMode])

  const copyNodeImage = useCallback(async (node: CanvasNode) => {
    const src = node.previewDataUrl ?? node.previewUrl
    if (!src) { setNotice('图片预览不可用'); return }
    try {
      const response = await fetch(src)
      const blob = await response.blob()
      const type = blob.type.startsWith('image/') ? blob.type : 'image/png'
      await navigator.clipboard.write([new ClipboardItem({ [type]: blob })])
      setNotice(`已复制图片「${node.title}」`)
    } catch (error) {
      setNotice(`复制图片失败：${error instanceof Error ? error.message : '剪贴板不可用'}`)
    }
  }, [setNotice])

  const copyNodeLink = useCallback((node: CanvasNode) => {
    const url = node.previewText?.match(/^url:\s*(https?:\/\/\S+)/mi)?.[1]
      ?? (node.previewUrl?.startsWith('http') ? node.previewUrl : undefined)
      ?? node.title.match(/^https?:\/\/\S+/)?.[0]
      ?? node.observedPath?.match(/^https?:\/\/\S+/)?.[0]
    if (!url) { setNotice('没有可复制的链接'); return }
    void navigator.clipboard?.writeText(url).then(() => setNotice('链接已复制')).catch(() => setNotice('复制失败'))
  }, [setNotice])

  const copyNodeText = useCallback((node: CanvasNode) => {
    const text = node.previewText?.replace(/^url:\s*https?:\/\/\S+$/mi, '').trim() || node.title
    if (!text) { setNotice('没有可复制的文本'); return }
    void navigator.clipboard?.writeText(text).then(() => setNotice('文本已复制')).catch(() => setNotice('复制失败'))
  }, [setNotice])

  const relinkSource = useCallback((node: CanvasNode, path: string) => {
    if (!node.artifactId) return
    if (bootMode !== 'runtime') { setNotice('原型模式没有本地文件服务'); return }
    void bridgeRef.current.client.relinkArtifactSource(node.artifactId, path).then((call) => {
      if (!call.result.ok) { setNotice(`重新链接失败：${call.result.error.message}`); return }
      setNodes((current) => current.map((item) => item.id === node.id
        ? { ...item, observedPath: path, fileAvailability: 'current' }
        : item))
      setShortcutResolution(null)
      setNotice('源已重新链接')
    })
  }, [bootMode, setNodes])

  const openMaterialSource = useCallback((node: CanvasNode) => {
    const source = node.materialSource
    if (!source) return
    const sourceNode = (source.viewId ? nodes.find((item) => item.id === source.viewId) : undefined)
      ?? nodes.find((item) => item.artifactId === source.artifactId)
    if (!sourceNode) { setNotice('来源仍在项目里，但当前没有可打开的画布视图'); return }
    setNodeInfoId(null)
    setWorkbench(null)
    openImmersive(sourceNode.id, source.sourceAnchor, source.revisionId)
    setNotice(source.sourceAnchor ? `已回到来源 · ${source.title ?? sourceNode.title}` : `已打开来源 · ${source.title ?? sourceNode.title}`)
  }, [nodes, openImmersive])

  const openHandoff = useCallback(async () => {
    if (dataSource !== 'runtime') {
      setNotice('交接内容只能从当前已加载的真实项目状态生成')
      return
    }
    setHandoffOpen(true)
    setHandoffLoading(true)
    setHandoffError(undefined)
    const selectedTarget = selectedNodes.length === 1 ? selectedNodes[0]?.artifactId : undefined
    const result = await bridgeRef.current.buildContextManifest({
      ...(selectedTarget ? { targetArtifactId: selectedTarget } : {}),
      requestedOutput: 'Markdown Script Revision',
    })
    setHandoffManifest(result.manifest)
    setHandoffError(result.error)
    setHandoffLoading(false)
  }, [dataSource, selectedNodes])

  const copyHandoff = useCallback(async () => {
    if (!handoffManifest) return
    await navigator.clipboard.writeText(handoffManifest.renderedMarkdown)
    setNotice('本次参考清单已复制为 Markdown')
  }, [handoffManifest])

  const downloadHandoff = useCallback(() => {
    if (!handoffManifest) return
    const url = URL.createObjectURL(new Blob([handoffManifest.renderedMarkdown], { type: 'text/markdown;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${activeProjectId}-context-manifest-v0.md`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice('Handoff Markdown 已下载')
  }, [activeProjectId, handoffManifest])

  const downloadHandoffZip = useCallback(async () => {
    if (!handoffManifest) return
    setNotice('正在打包 Handoff ZIP…')
    const call = await bridgeRef.current.client.downloadHandoffZip(activeProjectId, {
      ...(handoffManifest.target === null ? {} : { targetArtifactId: handoffManifest.target.artifactId }),
      ...(handoffManifest.requestedOutput ? { requestedOutput: handoffManifest.requestedOutput } : {}),
    })
    if (!call.result.ok) {
      setNotice(`Handoff ZIP 打包失败：${call.result.error.message}`)
      return
    }
    const { fileName, blob } = call.result.value
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setNotice('Handoff ZIP 已下载')
  }, [activeProjectId, handoffManifest])

  const handleDoubleClick = useCallback((id: string) => {
    setSelectionComposerOpen(false)
    if (id.startsWith('workspace:')) { openWorkspaceScene(id.slice('workspace:'.length)); return }
    if (id.startsWith('scope:')) {
      const entityScope = scopes.find((scope) => scope.id === id.slice('scope:'.length))
      if (entityScope?.kind === 'context') openSavedContextView(entityScope.id)
      else if (entityScope?.kind === 'workflow') openSavedWorkflowView(entityScope.id)
      // Collection is single-click expand/fold. A double press is deliberately a
      // no-op so the second click cannot reopen a legacy child Scope.
      else if (entityScope?.kind === 'collection') return
      return
    }
    const node = nodes.find((item) => item.id === id) ?? presentationEntityNodes.find((item) => item.id === id)
    if (!node) return
    selectNode(id)
    if (node.entityKind === 'conversation' && node.conversation) {
      enterConversationSurface(node.conversation.id)
      return
    }
    // Text nodes open the inline editor (mubu-style canvas writing), not the Reader.
    // 统一文本体系：note 与 markdown 文本 artifact 双击都直接就地编辑。
    if (node.kind === 'note' || node.fileType === 'markdown') {
      setNodeInfoId(null)
      closeImmersive()
      // 投影/本体冲突：runtime 实体投影的正文属于本体（text-revision API 未落地，
      // 本地改写只会造成投影分叉）。双击不直接编辑，提示复制一个引用副本节点来改。
      if (bootMode === 'runtime' && node.artifactId && !originTextIdsRef.current.has(node.id)) {
        setForkPromptId(id)
        return
      }
      setNoteEditorId(id)
      return
    }
    if (node.opensScopeId) {
      const targetScope = scopes.find((scope) => scope.id === node.opensScopeId)
      if (targetScope?.kind === 'context') openSavedContextView(targetScope.id)
      else if (targetScope?.kind === 'workflow') openSavedWorkflowView(targetScope.id)
      else if (targetScope?.kind === 'collection') return
      else enterScope(node.opensScopeId)
      return
    }
    const viewerKind = resolveArtifactViewerKind(node)
    if (viewerKind === 'link') {
      const url = node.previewText?.match(/^url:\s*(https?:\/\/\S+)/mi)?.[1]
      if (url) { window.open(url, '_blank', 'noopener,noreferrer'); return }
    }
    if (canPreviewArtifact(node) || node.artifactId !== undefined) {
      // One temporary Reader for every readable material. Workbench remains a
      // metadata/version surface instead of silently becoming a second reader.
      setNodeInfoId(null)
      setWorkbench(null)
      openImmersive(id)
    }
  }, [bootMode, closeImmersive, enterConversationSurface, enterScope, nodes, openImmersive, openSavedContextView, openSavedWorkflowView, openWorkspaceScene, presentationEntityNodes, scopes, selectNode])

  const showNodeDetails = useCallback((id: string) => {
    setNodeInfoId(id)
  }, [])
  const copySelectedViews = useCallback(() => { copySelection() }, [copySelection])
  const duplicateSelectedViews = useCallback(() => { duplicateSelection() }, [duplicateSelection])
  const deleteSelectedViews = useCallback(() => { deleteNodes(selectedIds) }, [deleteNodes, selectedIds])
  const rememberCanvasPoint = useCallback((point: { x: number; y: number }) => { lastCanvasPointRef.current = point }, [])
  const requestDeleteProject = useCallback((project: ProjectPackage) => setConfirmProjectDelete(project), [])
  const handleFrameBoundsChange = useCallback((workspaceId: string, frameBounds: { x: number; y: number; width: number; height: number }) => {
    setWorkspaces((current) => current.map((workspace) => workspace.id === workspaceId
      ? { ...workspace, frameBounds, version: (workspace.version ?? 0) + 1 }
      : workspace))
  }, [])

  useEffect(() => {
    const editableTarget = (target: EventTarget | null) => {
      const element = target instanceof HTMLElement ? target : null
      return Boolean(element?.closest('input, textarea, select, [contenteditable="true"], [data-native-context-menu="true"]'))
    }
    const suppressContextMenu = (event: MouseEvent) => {
      if (!editableTarget(event.target)) event.preventDefault()
    }
    const suppressRightButtonDefault = (event: PointerEvent) => {
      if (event.button === 2 && !editableTarget(event.target)) event.preventDefault()
    }
    // Semantic Drop owns secondary-pointer drag on LCOS work surfaces. Right-drag
    // remains the fastest trigger, while handle/Alt-primary triggers use the same session.
    // Browser-native context behavior stays available inside editable/native-menu zones.
    window.addEventListener('contextmenu', suppressContextMenu, true)
    window.addEventListener('pointerdown', suppressRightButtonDefault, true)
    return () => {
      window.removeEventListener('contextmenu', suppressContextMenu, true)
      window.removeEventListener('pointerdown', suppressRightButtonDefault, true)
    }
  }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isText = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable
      const modifier = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      const activeElement = document.activeElement as HTMLElement | null
      const canvasActive = Boolean(activeElement?.closest('[data-testid="canvas"]')) && !document.querySelector('[role="dialog"][aria-modal="true"]')
      if (createDialogOpen || scopeCreateOpen || projectCreateOpen) return
      // ⌘K / Ctrl+K 全局唤起命令面板（键位进统一键位表 PALETTE_KEYS）。
      if (modifier && key === PALETTE_KEYS.open) { event.preventDefault(); setPaletteOpen(true); return }
      if (modifier && event.key === 'Enter') {
        event.preventDefault()
        if (layoutMode === 'sidecar') { setNotice('侧边协作模式不提供 LCOS 输入框，请直接使用当前宿主 Agent / Chat'); return }
        selectedIds.length ? requestSelectionRun() : requestGlobalRun()
        return
      }
      if (event.key === 'Escape' && referencePickActive) { event.preventDefault(); setReferencePickActive(false); return }
      if (event.key === 'Escape' && escapeTopOverlay()) { event.preventDefault(); return }
      if (isText) return
      if (modifier && key === 'f') { event.preventDefault(); setProjectSearchInitialQuery(''); setProjectToolsMode('search'); return }
      if (modifier && key === 'a' && canvasActive) {
        event.preventDefault()
        setSelectionComposerOpen(false)
        selectMarquee(visibleNodes.map((node) => node.id), false)
        return
      }
      if (modifier && key === 'c') {
        // 页面里存在文本选区时让浏览器默认复制（OCR 文字层等），不劫持成画布复制。
        const textSelection = window.getSelection()
        if (textSelection && !textSelection.isCollapsed) return
        event.preventDefault(); copySelection(); return
      }
      if (modifier && key === 'd') { event.preventDefault(); duplicateSelection(); return }
      if (modifier && key === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return }
      if (modifier && key === 'y') { event.preventDefault(); redo(); return }
      if (modifier && event.shiftKey && key === 'l') { event.preventDefault(); if (bootMode === 'runtime') setReorganizeOpen(true); else setNotice('智能体整理只在真实项目中可用'); return }
      if (modifier && key === 'o' && selectedNodes.length === 1) { event.preventDefault(); openNative(selectedNodes[0]); return }
      if (event.code === 'Space') { event.preventDefault(); setSpaceHeld(true); return }
      if (event.key === 'Escape') { if (paletteOpen) { setPaletteOpen(false); return } if (projectFocusOpen) setProjectFocusOpen(false); else if (confirmProjectDelete) setConfirmProjectDelete(null); else if (confirmWorkspaceId) setConfirmWorkspaceId(null); else if (conversationSpaceId) setConversationSpaceId(null); else if (immersiveNodeId) closeImmersive(); else if (workbench) setWorkbench(null); else if (capabilityOpen) setCapabilityOpen(false); else if (nodeInfoId) setNodeInfoId(null); else if (layoutPreview) { setLayoutPreview(null); setLayoutPreviewFocusIds(null) } else clearSelection(); return }
      if (key === 'f' && selectedIds.length === 1) { event.preventDefault(); openProjectFocus(); return }
      if (key === 'c') { event.preventDefault(); if (layoutMode === 'sidecar') { setNotice('侧边协作模式不提供 LCOS 输入框'); return } requestComposerFocus(); return }
      if (event.key === 'F2' && selectedIds.length === 1 && selectedNodes.length === 1) { event.preventDefault(); setRenameNodeId(selectedNodes[0]!.id); return }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedIds.length) { deleteNodes(selectedIds); return }
        if (selectedEdgeId) { setEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId)); setSelectedEdgeId(null); setNotice('关系已删除') }
      }
    }
    const release = (event: KeyboardEvent) => { if (event.code === 'Space') setSpaceHeld(false) }
    window.addEventListener('keydown', handler); window.addEventListener('keyup', release)
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('keyup', release) }
  }, [bootMode, clearSelection, closeImmersive, confirmProjectDelete, confirmWorkspaceId, conversationSpaceId, copySelection, createDialogOpen, deleteNodes, duplicateSelection, capabilityOpen, immersiveNodeId, layoutMode, nodeInfoId, paletteOpen, referencePickActive, workbench, layoutPreview, openNative, openProjectFocus, pasteClipboard, projectCreateOpen, projectFocusOpen, redo, requestComposerFocus, requestGlobalRun, requestSelectionRun, scopeCreateOpen, selectMarquee, selectedEdgeId, selectedId, selectedIds, selectedNodes, setEdges, undo, visibleNodes])


  const refreshProjectCatalog = useCallback(() => {
    void bridgeRef.current.loadCatalog().then((catalog) => {
      if (catalog.source !== 'runtime') {
        setNotice('项目列表暂时无法刷新，请重新启动 LCOS 后再试。')
        return
      }
      setProjects([...catalog.projects])
      saveProjectCatalog([...catalog.projects])
      // 只有当前项目确实已不在目录里（如被删除）才回到列表；
      // 常规刷新（导入工程文件 / 项目工具打开项目）不把已打开的项目踢出去。
      if (!catalog.projects.some((entry) => entry.id === activeProjectId)) setProjectOpen(false)
    })
  }, [activeProjectId])

  const confirmDeleteProject = useCallback(() => {
    const target = confirmProjectDelete
    if (target === null) return
    setConfirmProjectDelete(null)
    void bridgeRef.current.client.deleteProject(target.id).then((call) => {
      if (!call.result.ok) {
        setNotice(`删除失败：${call.result.error.message}`)
        return
      }
      if (activeProjectId === target.id) {
        setOpenProjectIds((current) => current.filter((id) => id !== target.id))
        setProjectOpen(false)
      }
      refreshProjectCatalog()
      setNotice(`「${target.label}」已从 LCOS 移除；源文件与工程文件保留在磁盘。`)
    })
  }, [activeProjectId, confirmProjectDelete, refreshProjectCatalog])

  const importLcosprojFile = useCallback((file: File) => {
    setNotice('正在打开工程文件…')
    void bridgeRef.current.client.openLcosprojUpload(file).then((call) => {
      if (!call.result.ok) {
        setNotice(`工程文件打开失败：${call.result.error.message}`)
        return
      }
      setNotice('工程文件已恢复为项目')
      refreshProjectCatalog()
    })
  }, [refreshProjectCatalog])

  const selectArtifactFromTools = useCallback((artifactId: string) => {
    const node = nodes.find((item) => String(item.artifactId) === artifactId)
    if (node === undefined) {
      setNotice('内容存在于项目中，但当前画布没有对应视图。可以在项目总览中创建或定位视图。')
      return
    }
    if (node.scopeId && node.scopeId !== scopeId) setScopeId(node.scopeId)
    selectNode(node.id)
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    setCamera((current) => revealNode(current, node, viewport?.width ?? 1000, viewport?.height ?? 820, safeInsets))
    setNotice(`已定位「${node.title}」`)
  }, [nodes, safeInsets, scopeId, selectNode])

  const activateConversationContextSource = useCallback((viewId: string) => {
    setContextPresentationIds([viewId])
    setNotice('已将该对话设为上下文投影来源，可在上下文视图中展开')
  }, [])

  const closeReorganize = useCallback(() => {
    setReorganizeOpen(false)
    setLayoutPreview(null)
  }, [])
  const reorganizeGhost = useCallback((positions: readonly { id: string; x: number; y: number }[] | null) => {
    setLayoutPreview(positions as unknown as LayoutPreviewItem[] | null)
  }, [])

  const contextSurfaceRuntime = useMemo<ContextSurfaceRuntime>(() => ({
    // Context 历史 = Core 项目快照（Checkpoint 表，B5）：历史栏「对比当前 / 从这里建现场」
    // 直接复用既有 compareContextHistory / branchContextHistoryToWorkbench（按 snapshot.id 路由）。
    history: coreContextSnapshots.map((snapshot, index) => ({
      id: String(snapshot.id),
      label: snapshot.label,
      title: snapshot.label,
      summary: snapshot.workspaceId === undefined ? '项目上下文快照' : '工作现场快照',
      current: index === coreContextSnapshots.length - 1,
      objectIds: [],
      createdAt: snapshot.createdAt,
    })),
    handoffs: coreHandoffs.map(handoffToProjection),
    onBranchHistory: branchContextHistoryToWorkbench,
    onCompareHistory: compareContextHistory,
    onOpenHistorySource: openContextHistorySource,
  }), [branchContextHistoryToWorkbench, compareContextHistory, coreContextSnapshots, coreHandoffs, openContextHistorySource])
  const openCurrentRunReview = useCallback(() => {
    const review = pendingReviews[0]
    if (review) { openRunReview(review); return }
    if (activeRun) { setSelectedIds([activeRun.processNodeId]); setWorkRail((current) => ({ ...current, collapsed: false })); setNotice(`当前执行 · ${runStatusLabel[activeRun.status]}`); return }
    setNotice('当前没有待确认的任务')
  }, [activeRun, openRunReview, pendingReviews])
  const workSurfaceRuntime = useMemo<WorkSurfaceRuntime>(() => ({
    activeRun,
    runEvents,
    pendingReviewCount: pendingReviews.length,
    onCancel: cancelActiveRun,
    onRetry: retryRun,
    onReview: openCurrentRunReview,
    onOpenRunDetails: (node) => showNodeDetails(node.id),
    onAnswerInput: answerActiveRunInput,
  }), [activeRun, answerActiveRunInput, cancelActiveRun, openCurrentRunReview, pendingReviews.length, retryRun, runEvents, showNodeDetails])
  const deliverSurfaceRuntime = useMemo<DeliverSurfaceRuntime>(() => ({
    activeRun,
    pendingReviewCount: pendingReviews.length,
    onAccept: acceptRun,
    onReject: rejectRun,
    onRetry: retryRun,
    onReview: openCurrentRunReview,
    onOpenRevisions: (node) => setWorkbench({ nodeId: node.id, focus: 'revisions' }),
    onCompareNodes: (left, right) => { setSelectedIds([left.id, right.id]); setWorkbench({ nodeId: right.id, focus: 'revisions' }); setNotice(`Compare · ${left.title} ↔ ${right.title}`) },
  }), [acceptRun, activeRun, openCurrentRunReview, pendingReviews.length, rejectRun, retryRun])

  const surfaceContextMenuItems = useCallback((surface: SurfaceId): readonly SurfaceContextMenuItem[] => {
    const hasSelection = selectedIds.length > 0
    const allowLocalAgent = layoutMode === 'desktop'
    if (surface === 'arrange') {
      return [
        { action: 'create-content', label: '新建内容' },
        { action: 'import', label: '导入材料' },
        { action: 'create-scene', label: '新建现场', hint: '空白工作现场' },
        { action: 'reorganize', label: '让智能体整理当前画布', hint: '按内容关系整理 · 变化需确认', dividerBefore: true },
        { action: 'create-context', label: '从选择沉淀上下文', disabled: !hasSelection, dividerBefore: true },
        { action: 'create-workflow', label: '从选择沉淀工作流', disabled: !hasSelection },
      ]
    }
    if (surface === 'workflow') {
      return [
        ...(allowLocalAgent ? [{ action: 'summon-agent' as const, label: '放一个 Agent', hint: '只在这里对话 / 整理方法' }] : []),
        { action: 'review-deposits', label: '查看最近方法线索', disabled: workflowDepositCandidates.length === 0 },
        { action: 'create-workflow', label: '从选择建立工作流', disabled: !hasSelection, dividerBefore: true },
        { action: 'create-content', label: '新建内容', dividerBefore: true },
        { action: 'import', label: '导入材料' },
      ]
    }
    return [
      ...(allowLocalAgent ? [{ action: 'summon-agent' as const, label: '放一个 Agent', hint: '围绕当前上下文就地对话' }] : []),
      { action: 'review-deposits', label: '查看最近可沉淀内容', disabled: contextDepositCandidates.length === 0 },
      { action: 'create-context', label: '从选择建立上下文', disabled: !hasSelection, dividerBefore: true },
      { action: 'create-content', label: '新建内容', dividerBefore: true },
      { action: 'import', label: '导入材料' },
    ]
  }, [contextDepositCandidates.length, layoutMode, selectedIds.length, workflowDepositCandidates.length])

  const handleSurfaceContextMenuAction = useCallback((action: SurfaceContextMenuAction) => {
    if (action === 'create-content') { setCreateDialogOpen(true); return }
    if (action === 'import') { setImportPanelOpen(true); return }
    if (action === 'create-scene') { createEmptyWorkspaceScene(); return }
    if (action === 'reorganize') { setReorganizeOpen(true); setNotice('告诉智能体你希望怎么整理；当前能安全确认到什么粒度，面板里会如实显示'); return }
    if (action === 'create-context') {
      if (!selectedIds.length) { setNotice('先选择要沉淀进上下文的对象'); return }
      const semantic = semanticRefsForSourceIds(selectedIds, projectPresentationNodes)
      createContextFromMembersDirect(semantic.viewIds, undefined, semantic.entityRefs)
      return
    }
    if (action === 'create-workflow') {
      if (!selectedIds.length) { setNotice('先选择要沉淀为工作方法的对象'); return }
      const semantic = semanticRefsForSourceIds(selectedIds, projectPresentationNodes)
      createWorkflowFromMembersDirect(semantic.viewIds, undefined, semantic.entityRefs)
    }
  }, [createContextFromMembersDirect, createEmptyWorkspaceScene, createWorkflowFromMembersDirect, projectPresentationNodes, selectedIds])

  const resumeCandidate = useMemo(() => {
    const candidates = resumeBoundary?.attentionRuntime.candidates ?? []
    return candidates.find((candidate) => candidate.type === 'resume' && candidate.confidence >= .5)
      ?? candidates.find((candidate) => candidate.confidence >= .65)
      ?? null
  }, [resumeBoundary])

  const resumeHint = !resumeHintDismissed && resumeCandidate ? {
    title: resumeCandidate.title,
    ...(resumeCandidate.subtitle ? { subtitle: resumeCandidate.subtitle } : {}),
    onContinue: () => {
      if (resumeCandidate.workspaceId && workspaces.some((workspace) => workspace.id === resumeCandidate.workspaceId)) openWorkspaceScene(resumeCandidate.workspaceId)
      const available = resumeCandidate.requiredViewIds.filter((id) => nodes.some((node) => node.id === id))
      if (available.length) setSelectedIds(available)
      setActiveSurface('arrange')
      if (resumeBoundary) setAttentionRuntimeSnapshot(resumeBoundary.attentionRuntime)
      setResumeHintDismissed(true)
      setNotice('已接回上次现场；不会自动开始任何动作')
    },
    onDismiss: () => setResumeHintDismissed(true),
  } : null

  const idleHint = attentionRuntimeSnapshot?.intent.goal
    ? { title: '刚才这段我还记得', subtitle: `你刚才主要围绕「${attentionRuntimeSnapshot.intent.goal}」工作，相关材料关系还在。` }
    : activeContextProjection?.recentChanges?.some((change) => change.kind !== 'viewport')
      ? { title: '刚才这段我还记得', subtitle: '最近的项目变化已经留在现场里，回来可以直接继续。' }
      : null

  const editorWorkspace = workspaceEditor?.id ? workspaces.find((workspace) => workspace.id === workspaceEditor.id) : undefined
  const nodeToRename = renameNodeId ? nodes.find((node) => node.id === renameNodeId) : undefined
  const noteToEdit = noteEditorId ? nodes.find((node) => node.id === noteEditorId) : undefined
  const scopePath = buildScopePath(scopes, activeScope)
  return <LocalCoreClientProvider value={bridgeRef.current.client}>
    <ProjectSpatialMarkerProvider key={activeProjectId} projectId={activeProjectId}>
    <AppShellView
    layoutDensity={layoutDensity}
    layoutMode={layoutMode}
    narrowCollaboration={layoutMode === 'sidecar' && viewportWidth <= 560}
    layoutStyle={sceneStyle}
    notice={notice}
    capture={{
      open: captureSpaceOpen,
      client: bridgeRef.current.client,
      projects,
      referenceSet: {
        projectId: activeProjectId,
        ids: selectionReferenceIds,
        resolveWarehouseReferenceId: resolveAssemblyWarehouseReferenceId,
        onToggle: toggleSelectionReference,
      },
      onClose: () => { setCaptureSpaceOpen(false); setProjectOpen(false) },
      onOpenProject: openProjectInNewTab,
      onNotice: setNotice,
    }}
    drive={{
      open: !projectOpen,
      projects,
      openProjectIds,
      onOpenCaptureSpace: () => { setCaptureSpaceOpen(true); setProjectOpen(false) },
      onOpen: openProjectInNewTab,
      onRevealFolder: revealProjectFolder,
      onCreate: (intent = 'create') => { setProjectCreateIntent(intent); setProjectCreateOpen(true) },
      onDelete: requestDeleteProject,
      onImportLcosproj: importLcosprojFile,
      capturePendingCount,
    }}
    strip={{
      projectLabel: activeProject.label,
      scopeLabel: activeScope.label,
      saveStatus,
      runStatus: activeRun?.status ?? null,
      showWorkRailActions: layoutMode === 'desktop',
      onOpenProjectDrive: () => setProjectOpen(false),
      onImport: () => setImportPanelOpen(true),
      onSearch: () => { setProjectSearchInitialQuery(''); setProjectToolsMode('search') },
      pendingCount: pendingReviews.length,
      onPending: () => { setWorkRail((current) => ({ ...current, collapsed: false })); if (pendingReviews[0]) openRunReview(pendingReviews[0]); setNotice(pendingReviews.length ? `${pendingReviews.length} 项待确认，已在右侧执行列表中定位` : '当前没有待确认的返回结果') },
      onHistory: () => { setConversationDialogOpen(true); setNotice('打开已导入对话；历史导航只属于每条对话本身') },
      onMore: () => setCapabilityOpen((value) => !value),
      onRevealFolder: () => revealProjectFolder(activeProjectId),
      // RECEIVER-1：项目级会话承接 Chip（Work Identity 常驻顶条；历史对话入口复用现有 ConversationContextDialog）
      // RECEIVER-3：透传切换现场快照，Switcher 的承接确认小卡据此展示（承接前可见）。
      receiverSlot: <ReceiverChip projectId={activeProjectId} client={bridgeRef.current.client} onOpenArchive={() => setConversationDialogOpen(true)} handoffContext={receiverHandoffContext} onIdentityChanged={setActiveReceiverIdentity} />,
    }}
    conversationScene={conversationSpaceId ? {
      projectId: activeProjectId,
      conversationId: conversationSpaceId,
      onExit: () => setConversationSpaceId(null),
      execution: {
        command: sharedComposerCommand,
        receivers: selectionReceiverChoices,
        activeReceiverId: activeReceiverIdentity?.activeReceiverId ?? null,
        providers: runtimeProviders,
        busy: runBusy,
        onSubmit: requestSurfaceAgentRun,
        onReadReach: async (connectedConversationId) => {
          if (bootMode !== 'runtime') return 0
          const call = await bridgeRef.current.client.conversationReach(activeProjectId, connectedConversationId)
          return call.result.ok ? call.result.value.items.length : 0
        },
      },
    } : null}
    scene={{
      sceneStyle,
      sceneData: {
        projectId: activeProjectId,
        scopeId,
        workspaceId,
        workspaceIntent: 'blank',
      },
      capability: capabilityOpen ? {
        capabilities,
        nodes: scopeNodes,
        onClose: () => setCapabilityOpen(false),
        onImport: (files) => { const point = lastCanvasPointRef.current ?? { x: 180, y: 160 }; dropFiles(files, point.x, point.y); setCapabilityOpen(false) },
        onCreateObject: () => { setCapabilityOpen(false); setCreateDialogOpen(true) },
        onAddLink: () => { setCapabilityOpen(false); setLinkDialogOpen(true) },
        onUniversalImport: () => { setCapabilityOpen(false); setImportPanelOpen(true) },
        onHandoff: () => { setCapabilityOpen(false); void openHandoff() },
        onProjectTools: () => { setCapabilityOpen(false); setProjectToolsMode('full') },
        onSelectNode: (id) => { selectNode(id); setCapabilityOpen(false) },
      } : null,
      workspaceRail: {
        views: projectRailViews,
        runStatus: activeRun?.status ?? null,
        onOverview: activateOverview,
        onActivateView: activateProjectRailView,
        onLocateWorkspace: locateWorkspace,
        onAdd: createEmptyWorkspaceScene,
        onDeleteWorkspace: deleteWorkspace,
        onReorderRailView: reorderRailViewTo,
        onDeleteScope: requestDeleteRailScope,
        onRenameWorkspace: renameRailWorkspace,
        onRenameScope: renameRailScope,
        onDirectProjectViewDrop: directDropToProjectRailView,
      },
      surface: activeSurface,
      surfaceMenu: {
        items: surfaceContextMenuItems,
        onAction: handleSurfaceContextMenuAction,
      },
      surfaceExecution: {
        command: sharedComposerCommand,
        receivers: selectionReceiverChoices,
        activeReceiverId: activeReceiverIdentity?.activeReceiverId ?? null,
        providers: runtimeProviders,
        busy: runBusy,
        onSubmit: requestSurfaceAgentRun,
        onReadReach: async (connectedConversationId) => {
          if (bootMode !== 'runtime') return 0
          const call = await bridgeRef.current.client.conversationReach(activeProjectId, connectedConversationId)
          return call.result.ok ? call.result.value.items.length : 0
        },
      },
      resumeHint: layoutMode === 'desktop' ? resumeHint : null,
      idleHint: layoutMode === 'desktop' ? idleHint : null,
      depositHints: layoutMode === 'desktop' ? {
        context: contextDepositCandidates,
        workflow: workflowDepositCandidates,
        contextEvidenceKey: contextDepositEvidenceKey,
        workflowEvidenceKey: workflowDepositEvidenceKey,
        ...(contextDepositReflection ? { contextReflection: contextDepositReflection } : {}),
        ...(workflowDepositReflection ? { workflowReflection: workflowDepositReflection } : {}),
        onOrganize: (kind) => setNotice(kind === 'context' ? 'Agent 只会提出上下文整理方案，不会自动改项目结构' : 'Agent 只会提出方法沉淀方案，不会自动固化工作流'),
        evaluate: async (kind, evidenceKey, items, reflection) => {
          if (bootMode !== 'runtime') return { shouldShow: false, reason: '本地核心未连接，保持静默。' }
          const call = await bridgeRef.current.client.boundaryEvaluate(activeProjectId, { kind, evidenceKey, evidence: items, ...(reflection ? { reflection } : {}), ...(workspaceId ? { workspaceId } : {}) })
          return call.result.ok ? { shouldShow: call.result.value.shouldShow, reason: call.result.value.reason } : { shouldShow: false, reason: call.result.error.message }
        },
      } : undefined,
      canvas: {
        projectId: activeProjectId,
        nodes: sceneCanvasNodes,
        setNodes,
        edges: sceneCanvasEdges,
        setEdges,
        camera,
        setCamera,
        selectedId,
        selectedIds,
        selectedEdgeId,
        setSelectedEdgeId,
        pendingId: activeRun?.pendingArtifactId ?? null,
        pendingReviewIds: reorganizePendingIds,
        runId: activeRun?.id ?? 'RUN-043',
        runStatus: activeRun?.status ?? null,
        spaceHeld,
        locked: createDialogOpen || scopeCreateOpen,
        layoutPreview,
        workspaceFrames: visibleWorkspaceFrames,
        workspaceMemberNodes: scopeNodes,
        activeWorkspaceId: workspaceId,
        onWorkspaceActivate: openWorkspaceScene,
        onWorkspaceProjectionMove: (targetWorkspaceId, x, y) => setWorkspaces((current) => current.map((workspace) => workspace.id === targetWorkspaceId ? { ...workspace, frameBounds: { x, y, width: workspace.frameBounds?.width ?? 260, height: workspace.frameBounds?.height ?? 140 }, version: (workspace.version ?? 0) + 1 } : workspace)),
        onPresentationInteractionChange: handlePresentationInteractionChange,
        onPresentationCommit: handlePresentationCommit,
        onFrameBoundsChange: handleFrameBoundsChange,
        selectionComposer: layoutMode === 'desktop' && selectedIds.length && selectionComposerOpen ? {
          contextIds: selectionContextIds,
          referenceIds: selectionReferenceIds,
          receivers: selectionReceiverChoices,
          activeReceiverId: activeReceiverIdentity?.activeReceiverId ?? null,
          receiverId: effectiveSelectionReceiverId,
          reachCount: selectionReachCount,
          referencePickActive,
          ...(selectionExecutionBlockedReason ? { executionBlockedReason: selectionExecutionBlockedReason } : {}),
          ...(selectionResultSlotNode?.resultSlotId ? { resultSlot: { id: selectionResultSlotNode.resultSlotId, status: selectionResultSlotNode.resultSlotStatus ?? 'empty', title: selectionResultSlotNode.title } } : {}),
          prompt: selectionComposerText,
          provider: selectionProvider,
          createAsNewNode: selectionCreateAsNewNode,
          intent: selectionIntent,
          resultPolicy: selectionResultPolicy,
          ...(selectionBaseRevision ? { baseRevision: selectionBaseRevision } : {}),
          providers: runtimeProviders,
          busy: runBusy,
          ...(runProposal?.ambiguity?.question ? { ambiguityQuestion: runProposal.ambiguity.question } : {}),
          onPromptChange: setSelectionComposerText,
          onProviderChange: setSelectionProvider,
          onCreateAsNewNodeChange: setSelectionCreateAsNewNode,
          onIntentChange: changeSharedComposerIntent,
          onResultPolicyChange: setSelectionResultPolicy,
          onToggleContext: toggleContext,
          onReceiverChange: chooseSelectionReceiver,
          onRemoveReference: toggleSelectionReference,
          onMoveReference: moveSelectionReference,
          onStartReferencePick: () => setReferencePickActive(true),
          onFinishReferencePick: () => setReferencePickActive(false),
          onSend: requestSelectionRun,
          onClose: () => { setReferencePickActive(false); setSelectionComposerOpen(false) },
        } : undefined,
        referencePick: layoutMode === 'desktop' ? { active: referencePickActive, ids: selectionReferenceIds, onToggle: toggleSelectionReference } : undefined,
        onSelect: selectNode,
        onClearSelection: clearSelection,
        onMarqueeSelect: selectMarquee,
        onSelectEdge: selectEdge,
        onDoubleClick: handleDoubleClick,
        onDetails: showNodeDetails,
        onOpenConversation: enterConversationSurface,
        onSetActiveConversation: (conversationId) => { void requestSetActiveConversation(conversationId) },
        onMapToConversation: mapCanvasObjectsToConversation,
        activeConversationId: activeReceiverIdentity?.chain?.conversationSession?.id ?? null,
        onFocusSelection: selectedIds.length === 1 ? () => openProjectFocus() : undefined,
        onRenameSelection: selectedIds.length === 1 && selectedNodes.length === 1 ? () => setRenameNodeId(selectedNodes[0]!.id) : undefined,
        onToggleNoteLayout: toggleNoteLayout,
        onCreateNodeFromAnchor: createNodeFromAnchor,
        onFilesDropped: dropFiles,
        onExternalTextDrop: (text, x, y) => {
          if (!isRuntimeProjectMode(bootMode)) { setNotice('原型模式不写入外部拖拽内容'); return }
          void pasteTextAsNode(text, { x, y })
        },
        // G-4 主画布通道：导图分支摘取落成正常文本节点（createNodeAt 同款 note 形态）。
        onMindmapBranchDrop: (text, x, y) => { void createNoteFromBranchText(text, { x, y }) },
        onMaterialTransferDrop: (raw, x, y) => {
          if (!isRuntimeProjectMode(bootMode)) { setNotice('原型模式不写入材料投送'); return }
          const payload = parseMaterialTransfer(raw)
          if (!payload) { setNotice('这块材料无法识别'); return }
          void ingestMaterialTransfer(payload, { x, y })
        },
        onArrangeSelection: arrangeSelection,
        gridSnapEnabled,
        onSetSelectionDisplayMode: setSelectionDisplayMode,
        onCopySelection: copySelectedViews,
        onDuplicateSelection: duplicateSelectedViews,
        onCreateScopeFromSelection: () => selectedIds.length ? createScopeFromSelection({ label: '', kind: 'collection' }) : setNotice('先选择要组织的对象'),
        onDeleteSelection: deleteSelectedViews,
        onDirectProjectViewDrop: directDropToProjectRailView,
        onReorganize: () => {
          if (bootMode === 'runtime') setReorganizeOpen(true)
          else setNotice('智能体整理只在真实项目中可用')
        },
        onPointerWorldChange: rememberCanvasPoint,
        onSpaceCreate: (point) => { lastCanvasPointRef.current = point; setCreateDialogOpen(true) },
        onLocateNode: locateNote,
        locatePulseId,
        attentionBucketsByViewId,
        collectionMembersByNodeId,
        expandedCollectionScopeIds,
        openingCollectionScopeIds,
        closingCollectionScopeIds,
        onToggleCollection: toggleCollectionScope,
        onOpenContextLens: openContextProjectionLens,
        colonies,
        surfaceElements: mainSurfaceElements,
        onSurfaceElementsChange: setMainSurfaceElements,
        portalTargets: projectRailViews.filter((view) => view.kind === 'scene' || view.kind === 'context' || view.kind === 'workflow').map((view) => ({ id: view.id, label: view.title, kind: view.kind })),
        onOpenPortalTarget: (targetId) => { const target = projectRailViews.find((view) => view.id === targetId); if (target) activateProjectRailView(target) },
        onCreateColonyFromSelection: createColonyFromCurrentSelection,
        onCreateColonyFromLasso: createColonyFromLasso,
        onAddToColony: addToColony,
        onRescopeColony: rescopeCurrentColony,
        onDissolveColony: dissolveColony,
        onColonyMemberMoveSettled: settleColonyMemberMove,
      },
      projection: {
        projectId: activeProjectId,
        // Presentation owner is independent from navigation Scope. Context detail
        // uses its Context identity; Workflow uses its Workflow entity identity; Context Graph is project-level.
        scopeId: activeSurface === 'workflow'
          ? workflowPresentationOwnerId
          : activeSurface === 'context-graph'
            ? rootScope.id
            : (activeSurface === 'context-space' || activeSurface === 'context-flow' || activeSurface === 'context-tree' || activeSurface === 'outline')
              ? (activeContextId ?? rootScope.id)
              : scopeId,
        contextHomeScopeId: rootScope.id,
        surface: activeSurface as Exclude<SurfaceId, 'arrange'>,
        nodes: projectPresentationNodes,
        edges,
        selectedIds,
        attentionBucketsByViewId,
        presentationIds: activeSurface === 'workflow'
          ? (activeWorkflowId ? workflowResolvedIds : undefined)
          : activeSurface === 'context-graph'
            ? contextGraphResolvedIds
            : (activeSurface === 'outline' || activeSurface === 'context-space' || activeSurface === 'context-flow' || activeSurface === 'context-tree')
              ? (activeContextId ? contextDetailResolvedIds : contextGraphResolvedIds)
              : undefined,
        workspaceFocusIds: effectiveWorkspace.focusedViewIds,
        contextRuntime: contextSurfaceRuntime,
        workRuntime: workSurfaceRuntime,
        deliverRuntime: deliverSurfaceRuntime,
        contextViews: savedContextViews,
        workflowViews: savedWorkflowViews,
        activeWorkflowId,
        focusRequest: projectFocusRequest,
        onSurfaceChange: setActiveSurface,
        // G-4 导图分支摘取（Context 通道）：建进当前 Context scope 并写入成员集——
        // Context 视图只排 presentation 成员，漏写成员集会让新节点"建了却看不见"。
        onExternalTextDrop: (text, x, y) => {
          const ownerId = activeContextId ?? rootScope.id
          const rootContext = ownerId === rootScope.id
          const currentMembers = rootContext ? contextGraphPresentationIds : (contextMembersById[ownerId] ?? [])
          void createNoteFromBranchText(text, { x, y }, ownerId).then((viewId) => {
            if (!viewId) return
            void appendExactPresentationMembers('context', ownerId, [viewId], currentMembers).then((members) => {
              if (members === null) return
              if (rootContext) { setContextGraphPresentationIds(members); return }
              setContextMembersById((current) => ({ ...current, [ownerId]: members }))
              setContextPresentationIds(members)
            })
          })
        },
        onContextMergeAccept: acceptContextMerge,
        onOpenContextView: openSavedContextView,
        onOpenWorkflowView: openSavedWorkflowView,
        onAddMembersToContext: addMembersToSavedContext,
        onAddMembersToContextGraph: (sourceIds) => {
          const semantic = semanticRefsForSourceIds(sourceIds, projectPresentationNodes)
          if (!semantic.viewIds.length && !semantic.entityRefs.length) return
          void Promise.all([
            appendExactPresentationMembers('context', rootScope.id, semantic.viewIds, contextGraphPresentationIds),
            appendExactPresentationEntityRefs('context', rootScope.id, semantic.entityRefs, 'context-graph', contextGraphEntityRefs),
          ]).then(([members, refs]) => {
            if (members === null || refs === null) return
            setContextGraphPresentationIds(members)
            setContextGraphEntityRefs(refs)
          })
        },
        onCreateContextFromMembers: (sourceIds) => {
          const semantic = semanticRefsForSourceIds(sourceIds, projectPresentationNodes)
          createContextFromMembersDirect(semantic.viewIds, undefined, semantic.entityRefs)
        },
        onImportProjectViewToContext: (sourceIds) => {
          const semantic = semanticRefsForSourceIds(sourceIds, projectPresentationNodes)
          if (!semantic.viewIds.length && !semantic.entityRefs.length) return []
          const ownerId = activeContextId ?? rootScope.id
          const rootContext = ownerId === rootScope.id
          const currentMembers = rootContext ? contextGraphPresentationIds : (contextMembersById[ownerId] ?? [])
          const currentRefs = rootContext ? contextGraphEntityRefs : (contextEntityRefsById[ownerId] ?? [])
          void Promise.all([
            appendExactPresentationMembers('context', ownerId, semantic.viewIds, currentMembers),
            appendExactPresentationEntityRefs('context', ownerId, semantic.entityRefs, rootContext ? 'context-graph' : 'context', currentRefs),
          ]).then(([members, refs]) => {
            if (members === null || refs === null) return
            if (rootContext) {
              setContextGraphPresentationIds(members)
              setContextGraphEntityRefs(refs)
              return
            }
            setContextMembersById((current) => ({ ...current, [ownerId]: members }))
            setContextEntityRefsById((current) => ({ ...current, [ownerId]: refs }))
            setContextPresentationIds(members)
            setContextPresentationEntityRefs(refs)
          })
          return [...semantic.viewIds, ...projectEntityNodeIds(semantic.entityRefs, projectPresentationNodes)]
        },
        onRemoveProjectViewFromContext: (memberViewId) => {
          const ownerId = activeContextId ?? rootScope.id
          const rootContext = ownerId === rootScope.id
          void removeExactPresentationMembers('context', ownerId, [memberViewId]).then((members) => {
            if (members === null) return
            if (rootContext) setContextGraphPresentationIds(members)
            else {
              setContextMembersById((current) => ({ ...current, [ownerId]: members }))
              setContextPresentationIds(members)
            }
            setNotice('已从当前 Context 投影移出；原对象保持不变')
          })
        },
        onImportProjectViewToWorkflow: (sourceIds) => {
          const semantic = semanticRefsForSourceIds(sourceIds, projectPresentationNodes)
          if (!semantic.viewIds.length && !semantic.entityRefs.length) return []
          const ownerId = workflowPresentationOwnerId
          const currentRefs = ownerId === rootScope.id ? workflowPresentationEntityRefs : (workflowEntityRefsById[ownerId] ?? [])
          void Promise.all([
            appendExactPresentationMembers('workflow', ownerId, semantic.viewIds, ownerId === rootScope.id ? workflowPresentationIds : (workflowMembersById[ownerId] ?? [])),
            appendExactPresentationEntityRefs('workflow', ownerId, semantic.entityRefs, 'workflow', currentRefs),
          ]).then(([members, refs]) => {
            if (members === null || refs === null) return
            setWorkflowPresentationIds(members)
            setWorkflowPresentationEntityRefs(refs)
            if (ownerId !== rootScope.id) {
              setWorkflowMembersById((current) => ({ ...current, [ownerId]: members }))
              setWorkflowEntityRefsById((current) => ({ ...current, [ownerId]: refs }))
            }
          })
          return [...semantic.viewIds, ...projectEntityNodeIds(semantic.entityRefs, projectPresentationNodes)]
        },
        onCreateWorkflowOperatorNode: createWorkflowOperatorNode,
        onCreateDomainRelation: async (fromViewId, toViewId, kind) => {
          if (bootMode !== 'runtime') { setNotice('原型模式不写入项目关系'); return }
          const now = new Date().toISOString()
          const relation = {
            id: createId('relation'),
            projectId: activeProjectId,
            sourceEntityType: 'view', sourceEntityId: fromViewId,
            targetEntityType: 'view', targetEntityId: toViewId,
            kind: kind.trim() || 'reference',
            origin: 'user', createdBy: 'workflow-canvas', confidence: 1,
            createdAt: now, updatedAt: now,
          } as Relation
          const call = await bridgeRef.current.client.saveRelation(activeProjectId, relation)
          if (!call.result.ok) { setNotice(`关系保存失败：${call.result.error.message}`); throw new Error(call.result.error.message) }
          await reloadRuntimeProject()
          setNotice('已保存为项目关系，可在其它视图与 Agent 上下文中复用')
        },
        onUpdateDomainRelation: async (relationId, kind) => {
          if (bootMode !== 'runtime') return
          const listed = await bridgeRef.current.client.relations(activeProjectId)
          if (!listed.result.ok) { setNotice(`关系读取失败：${listed.result.error.message}`); throw new Error(listed.result.error.message) }
          const relation = listed.result.value.find((item) => String(item.id) === relationId)
          if (!relation) { setNotice('这条项目关系已不存在，正在刷新'); await reloadRuntimeProject(); return }
          const call = await bridgeRef.current.client.saveRelation(activeProjectId, { ...relation, kind: kind.trim() || relation.kind, updatedAt: new Date().toISOString() })
          if (!call.result.ok) { setNotice(`关系更新失败：${call.result.error.message}`); throw new Error(call.result.error.message) }
          await reloadRuntimeProject()
          setNotice('项目关系已更新')
        },
        onDeleteDomainRelation: async (relationId) => {
          if (bootMode !== 'runtime') return
          const call = await bridgeRef.current.client.deleteRelation(activeProjectId, relationId)
          if (!call.result.ok) { setNotice(`关系删除失败：${call.result.error.message}`); throw new Error(call.result.error.message) }
          await reloadRuntimeProject()
          setNotice('项目关系已删除；可在变更记录中安全撤销')
        },
        workflowRunOverlay: activeRun ? {
          activeNodeIds: activeRun.targetIds,
          completedNodeIds: activeRun.status === 'completed' ? activeRun.targetIds : [],
          failedNodeIds: activeRun.status === 'failed' ? activeRun.targetIds : [],
        } : undefined,
        workflowReviews: runReviews.map((review) => ({ runId: String(review.run.id), label: review.run.instruction || String(review.run.id), phase: review.presentationPhase })),
        workflowCheckpoints: workflowCheckpoints.filter((checkpoint) => String(checkpoint.scopeId) === workflowPresentationOwnerId || String(checkpoint.scopeId) === scopeId).map((checkpoint) => ({ checkpointId: String(checkpoint.id), label: checkpoint.label, createdAt: checkpoint.createdAt })),
        onOpenWorkflowReview: (runId) => { const review = runReviews.find((item) => String(item.run.id) === runId); if (review) openRunReview(review) },
        workflowWorkspaces: workspaces
          .filter((workspace) => workspace.scopeId === workflowPresentationOwnerId && normalizeSurfaceId(workspace.preferredSurface) === 'workflow')
          .map((workspace, order) => ({ id: workspace.id, title: workspace.label, memberCount: workspace.focusedViewIds.length, order, active: workspace.id === workspaceId })),
        onReorderWorkspace: moveWorkspace,
        onActivateWorkflowWorkspace: (id) => { changeWorkspace(id); setActiveSurface('workflow') },
        onCreateWorkflowWorkspace: () => { createWorkflowPageDirect([], workflowPresentationOwnerId) },
        onAddToWorkspace: (workspaceId, viewIds) => { void addViewsToWorkspace(workspaceId, viewIds, 'user') },
        skills: workflowSkills,
        onSaveSkill: handleSaveWorkflowSkill,
        onReplaySkill: handleReplayWorkflowSkill,
        skillRunStats,
        onLocateSkill: locateWorkflowSkill,
        onExportWorkflow: () => {
          if (bootMode !== 'runtime') { setNotice('原型模式没有工作流工程文件'); return }
          void bridgeRef.current.client.exportWorkflow(activeProjectId, workflowPresentationOwnerId).then((call) => {
            if (!call.result.ok) { setNotice(`导出失败：${call.result.error.message}`); return }
            const url = URL.createObjectURL(call.result.value.blob)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = call.result.value.fileName
            anchor.click()
            URL.revokeObjectURL(url)
            setNotice('已导出 .lcos-workflow.zip')
          })
        },
        onImportWorkflow: (file) => {
          if (bootMode !== 'runtime') { setNotice('原型模式没有工作流工程文件'); return }
          void bridgeRef.current.client.importWorkflow(activeProjectId, file, workflowPresentationOwnerId).then((call) => {
            if (!call.result.ok) { setNotice(`导入失败：${call.result.error.message}`); return }
            setNotice(`已导入工作流：${call.result.value.members} 个成员 · ${call.result.value.workspaces} 个工作空间`)
            void bridgeRef.current.loadProject().then((loaded) => {
              if (loaded.source === 'runtime' && loaded.state) {
                resetGraph({ nodes: loaded.state.nodes, edges: loaded.state.edges })
                setWorkspaces(loaded.state.workspaces)
              }
            })
          })
        },
        onSelect: selectNode,
        onMarqueeSelect: selectMarquee,
        onDoubleClick: handleDoubleClick,
        onDirectProjectViewDrop: directDropToProjectRailView,
        onContextStart: (kind) => {
          if (kind === 'conversation') { setConversationDialogOpen(true); return }
          if (kind === 'selection') {
            if (!selectedIds.length) { setNotice('先选择要理解的对象'); return }
            setContextPresentationIds([...selectedIds])
            setNotice(`已用当前 Selection 建立临时 Context View · ${selectedIds.length} 项`)
            return
          }
          setNotice('在上下文空白处右键“放一个 Agent”，对话会自动带上当前位置与选择')
        },
        onWorkflowStart: (kind) => {
          if (kind === 'selection') {
            if (!selectedIds.length) { setNotice('先选择要进入工作流的对象'); return }
            setWorkflowPresentationIds([...selectedIds])
            setNotice(`已从当前 Selection 建立临时工作流 View · ${selectedIds.length} 项`)
            return
          }
          if (kind === 'skill') { setCapabilityOpen(true); setNotice('Skill 属于执行方法，不作为工作流入口；需要时从项目能力中检查'); return }
          setNotice('在工作流空白处右键“放一个 Agent”，只讨论 / 整理当前方法')
        },
      },
      surfaceDock: {
        surface: activeSurface,
        scopePath,
        activeScopeId: scopeId,
        workbenchScopeId: activeWorkspace?.scopeId ?? null,
        workbenchCount: activeWorkspace ? activeWorkspace.focusedViewIds.length + (workspaceEntityRefsById[activeWorkspace.id]?.length ?? 0) : 0,
        onSurface: selectSurface,
        onScope: enterScope,
        onWorkbench: openCurrentScene,
        onMergeWorkbench: undefined,
        onProjectViewDrop: (capability, memberViewIds) => directDropToProjectRailView(`capability:${capability}`, memberViewIds),
      },
      miniMap: {
        nodes: sceneCanvasNodes,
        workspaceFrames: visibleWorkspaceFrames,
        camera,
        setCamera,
        collapsed: miniMapCollapsed,
        onCollapsedChange: setMiniMapCollapsed,
        safeInsets,
        onLocateContent: locateAndPreviewIslands,
        gridSnapEnabled,
        onGridSnapChange: setGridSnapEnabled,
        navigationRequest: projectFocusRequest,
      },
      emptyState: bootMode === 'runtime' && nodes.length === 0 ? {
        onImport: () => setImportPanelOpen(true),
      } : null,
      firstArtifactGuide: firstArtifactGuideOpen ? {
        onDismiss: () => setFirstArtifactGuideOpen(false),
      } : null,
      breadcrumbs: {
        projectLabel: activeProject.label,
        items: scopePath.map((scope, index) => ({ id: scope.id, label: index === 0 ? activeProject.label : scope.label, current: index === scopePath.length - 1 })),
        onEnter: enterScope,
        onBack: activeScope.parentScopeId ? leaveScope : null,
      },
      shortcutHintVisible: !selectedIds.length && !activeRun,
      runPill: activeRun ? {
        status: activeRun.status,
        label: runStatusLabel[activeRun.status],
        onClick: () => { clearSelection(); setWorkRail((current) => ({ ...current, collapsed: false })) },
      } : null,
      layoutPreview: layoutPreview ? {
        onApply: applyLayout,
        onCancel: () => { setLayoutPreview(null); setLayoutPreviewFocusIds(null) },
      } : null,
      notice,
      nodeInfo: nodeInfoNode ? {
        node: nodeInfoNode,
        camera,
        relationCount: nodeInfoRelationCount,
        onClose: () => setNodeInfoId(null),
        onRelations: () => { selectNode(nodeInfoNode.id); setNodeInfoId(null); setNotice(`${nodeInfoRelationCount} 个关联已在画布中高亮`) },
        onPreview: (node) => { setNodeInfoId(null); setWorkbench(null); openImmersive(node.id) },
        onOpenMaterialSource: openMaterialSource,
        onShowResource: (node) => { setNodeInfoId(null); setResourceDetailArtifactId(String(node.artifactId)) },
        onRevisions: (node) => { setNodeInfoId(null); setWorkbench({ nodeId: node.id, focus: 'revisions' }) },
        onOpenSource: openNative,
        onRevealSource: revealSource,
        onCopyPath: copySourcePath,
        onCopyImage: copyNodeImage,
        onCopyLink: copyNodeLink,
        onCopyText: copyNodeText,
        onRelinkSource: relinkSource,
        shortcutResolution: shortcutResolution?.nodeId === nodeInfoNode.id ? shortcutResolution.resolution : null,
      } : null,
      agentSurface: agentMode ? {
        projectLabel: activeProject.label,
        workspaceLabel: effectiveWorkspace.label,
        projection: activeContextProjection,
        selectedNodes,
        error: activeContextError,
        syncState: contextSync,
        proposals: contextProposals,
        pendingRuns: pendingCodexCount,
        pendingReviews,
        detailsOpen: agentSurfaceDetailsOpen,
        runLocked: activeRun ? { id: activeRun.id, contextCount: activeRun.contextIds.length } : null,
        receiver: [...(resumeBoundary?.providerSessions ?? [])].sort((a, b) => {
          if (a.status === 'active' && b.status !== 'active') return -1
          if (b.status === 'active' && a.status !== 'active') return 1
          return b.lastSeenAt.localeCompare(a.lastSeenAt)
        })[0],
        onAcceptProposal: (proposalId) => resolveContextProposal(proposalId, 'accept'),
        onRejectProposal: (proposalId) => resolveContextProposal(proposalId, 'reject'),
        onModifyProposal: requestContextProposalModification,
        onRefresh: () => { refreshActiveContext(); setAttentionRefreshNonce((value) => value + 1) },
        onToggleDetails: () => setAgentSurfaceDetailsOpen((current) => !current),
        onOpenReview: openRunReview,
        onHandoff: () => { void openHandoff() },
      } : null,
    }}
    rail={{
      workspace: effectiveWorkspace,
      nodes,
      activeRun,
      runActions: activeRun === null
        ? undefined
        : executionItems.find((item) => item.runId === activeRun.id)?.availableActions
          ?? (["queued", "running", "waiting_input", "failed"].includes(activeRun.status)
            ? (["cancel"] as ExecutionItemAction[]).concat(activeRun.status === "waiting_input" ? (["answer_input"] as ExecutionItemAction[]) : [], activeRun.status === "failed" ? (["retry"] as ExecutionItemAction[]) : [])
            : []),
      pendingNode,
      collapsed: workRail.collapsed,
      width: effectiveRailWidth,
      contextLabel: globalContextLabel,
      contextCount: globalContextIds.length,
      contextScope: globalContextScope,
      onContextScope: setGlobalContextScope,
      runSteps: activeRunSkillSteps,
      composerText: globalComposerText,
      composerRef,
      composerFocusRequest,
      composerVisible: globalComposerVisible,
      provider: globalProvider,
      createAsNewNode: globalCreateAsNewNode,
      providers: runtimeProviders,
      onCollapse: () => setWorkRail((current) => ({ ...current, collapsed: true })),
      onExpand: () => setWorkRail((current) => ({ ...current, collapsed: false })),
      onComposerChange: setGlobalComposerText,
      onComposerClose: () => setGlobalComposerVisible(false),
      onProviderChange: setGlobalProvider,
      onCreateAsNewNodeChange: setGlobalCreateAsNewNode,
      onSend: requestGlobalRun,
      onSaveWorkspaceState: () => saveCurrentWorkspaceState(),
      onOpenWorkspaceStates: () => openWorkspaceStates(),
      onAccept: acceptRun,
      onReject: rejectRun,
      onRetry: retryRun,
      onSyncRun: syncRuntimeRun,
      onCancelRun: cancelActiveRun,
      runEvents,
      runReviews,
      onOpenRunReview: openRunReview,
      runEventsError,
      runtimeRecovering,
      onRecoverRun: recoverActiveRun,
      onAnswerInput: answerActiveRunInput,
      onContinueModify: continueModify,
      onUpgradeWithFeedback: () => setRevisionUpgradeOpen(true),
      onShowRun: clearSelection,
    }}
    dialogs={{
      projectCreate: {
        open: projectCreateOpen,
        initialIntent: projectCreateIntent,
        onCancel: () => setProjectCreateOpen(false),
        onBrowseDirectory: browseProjectDirectory,
        onInspectDirectory: inspectProjectDirectory,
        onCreate: createProject,
      },
      projectTools: projectToolsMode ? {
        open: true,
        searchOnly: projectToolsMode === 'search',
        initialSearchQuery: projectSearchInitialQuery,
        project: activeProject,
        projects,
        client: bridgeRef.current.client,
        onClose: () => { setProjectToolsMode(null); setProjectSearchInitialQuery('') },
        onProjectOpened: refreshProjectCatalog,
        onSelectArtifact: (artifactId) => focusArtifactFromSearch(artifactId, nodes.find((node) => String(node.artifactId) === String(artifactId))?.title ?? '项目内容'),
        onSelectSourceIds: (sourceIds, title) => openProjectFocus(sourceIds, title),
        searchEntries: projectFocusSearchEntries,
        onNotice: setNotice,
      } : null,
      workbench: workbenchNode ? {
        node: workbenchNode,
        projectId: activeProjectId,
        client: bridgeRef.current.client,
        relationCount: workbenchRelationCount,
        focus: workbench?.focus ?? 'preview',
        onFocusChange: (focus) => setWorkbench((current) => current ? { ...current, focus } : current),
        onClose: () => setWorkbench(null),
        onLocate: () => {
          selectNode(workbenchNode.id)
          setNodeInfoId(null)
          const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
          setCamera(revealNode(camera, workbenchNode, viewport?.width ?? 1000, viewport?.height ?? 820))
          setNotice(`已定位「${workbenchNode.title}」`)
        },
        onUseRevision: useHistoricalRevision,
        onShowResource: workbenchNode.artifactId === undefined ? undefined : () => { setWorkbench(null); setResourceDetailArtifactId(String(workbenchNode.artifactId)) },
        onRefreshFile: workbenchNode.fileRecordId === undefined ? undefined : () => refreshSource(workbenchNode),
        onAdoptExternalChange: workbenchNode.fileRecordId === undefined || workbenchNode.fileAvailability !== 'stale' ? undefined : () => adoptExternalChange(workbenchNode),
      } : null,
      scopeCreate: scopeCreateOpen ? {
        open: scopeCreateOpen,
        selectedCount: selectedIds.length,
        leftInset: safeInsets.left,
        rightInset: 24,
        onCancel: () => setScopeCreateOpen(false),
        onCreate: createScopeFromSelection,
      } : null,
      createContent: createDialogOpen ? {
        open: createDialogOpen,
        leftInset: safeInsets.left,
        rightInset: 24,
        onCancel: () => setCreateDialogOpen(false),
        onCreate: createContentFromDialog,
      } : null,
      workspaceEditor: workspaceEditor && editorWorkspace ? {
        workspace: editorWorkspace,
        onCancel: () => setWorkspaceEditor(null),
        onSave: saveWorkspaceEditor,
      } : null,
      nodeRename: nodeToRename ? {
        node: nodeToRename,
        camera,
        onCancel: () => setRenameNodeId(null),
        onSave: (value) => renameNodeTitle(nodeToRename.id, value),
      } : null,
      noteEdit: noteToEdit ? {
        node: noteToEdit,
        camera,
        onCancel: () => setNoteEditorId(null),
        onSave: (input) => saveNoteBody(noteToEdit.id, input),
        onConvertToMindmap: (input) => { setNoteEditorId(null); toggleNoteLayout(noteToEdit.id, 'mindmap', input) },
      } : null,
      confirmWorkspaceDelete: confirmWorkspaceId ? {
        title: '删除这个工作空间？',
        description: '只删除工作空间定义，不删除内容、节点、本地文件或 Camera。',
        onCancel: () => setConfirmWorkspaceId(null),
        onConfirm: confirmDeleteWorkspace,
      } : null,
      confirmScopeDelete: confirmScopeDelete ? {
        title: `删除视图「${confirmScopeDelete.label}」？`,
        description: '删除该视图及其画布内容；真实文件与已投送到其他视图的副本不受影响。',
        onCancel: () => setConfirmScopeDelete(null),
        onConfirm: confirmDeleteRailScope,
      } : null,
      confirmProjectDelete: confirmProjectDelete ? {
        title: `从 LCOS 移除「${confirmProjectDelete.label}」？`,
        description: '项目会从项目列表移除；磁盘上的源文件和 .lcosproj 工程文件都会保留，之后仍可重新打开。',
        onCancel: () => setConfirmProjectDelete(null),
        onConfirm: confirmDeleteProject,
      } : null,
      confirmForkProjection: forkPromptId ? {
        title: '这是项目实体的投影，直接修改会与本体冲突',
        description: '画布上的文本节点是文本实体的投影，正文属于本体。要修改时，可复制一个新节点作为该投影的引用，在副本上编辑；原投影保持与本体一致。',
        confirmLabel: '复制并编辑',
        onCancel: () => setForkPromptId(null),
        onConfirm: confirmForkProjection,
      } : null,
      handoff: handoffOpen ? {
        open: handoffOpen,
        loading: handoffLoading,
        manifest: handoffManifest,
        error: handoffError,
        onClose: () => setHandoffOpen(false),
        onCopy: () => { void copyHandoff() },
        onDownload: downloadHandoff,
        onDownloadZip: () => { void downloadHandoffZip() },
      } : null,
      linkReference: linkDialogOpen ? {
        open: linkDialogOpen,
        onClose: () => setLinkDialogOpen(false),
        onCreate: createLinkReference,
      } : null,
      universalImport: importPanelOpen ? {
        open: importPanelOpen,
        onClose: () => setImportPanelOpen(false),
        onFiles: (files) => { const point = lastCanvasPointRef.current ?? { x: 180, y: 160 }; dropFiles([...files], point.x, point.y) },
        onDirectory: (rootName, files, note) => { void handleImportDirectory(rootName, files, note) },
        onArchive: (file, note) => { void handleImportArchive(file, note) },
        onOpenLink: () => setLinkDialogOpen(true),
        onOpenObsidian: handleOpenObsidian,
        onOpenConversations: () => setConversationDialogOpen(true),
      } : null,
      conversationContext: conversationDialogOpen ? {
        open: conversationDialogOpen,
        projectId: activeProjectId,
        scopeId,
        ...(workspaceId === null ? {} : { workspaceId }),
        client: bridgeRef.current.client,
        onClose: () => setConversationDialogOpen(false),
        onImported: () => { setNotice('对话上下文已更新'); void openProject(activeProjectId) },
        onFocusArtifact: selectArtifactFromTools,
        onActivateContextSource: activateConversationContextSource,
        onRequestSectionAnnotation: requestConversationSectionAnnotation,
      } : null,
      obsidianImport: obsidianScan ? {
        scan: obsidianScan,
        busy: obsidianBusy,
        error: obsidianError,
        onClose: () => { setObsidianScan(null); setObsidianError(null) },
        onImport: handleImportObsidian,
      } : null,
      resourceDetail: resourceDetailArtifactId !== null ? {
        open: true,
        projectId: activeProjectId,
        artifactId: resourceDetailArtifactId,
        client: bridgeRef.current.client,
        onClose: () => setResourceDetailArtifactId(null),
        onChanged: () => undefined,
      } : null,
      extraDialogs: <>
        {/* 权限门确认卡（第一梯队 ⑥）：写意图 Run 挂起在此，确认→原发送链，取消→不发起。 */}
        {pendingPermissionRun !== null ? <PermissionConfirmCard title={pendingPermissionRun.card.title} items={pendingPermissionRun.card.items} onConfirm={confirmPendingPermissionRun} onCancel={cancelPendingPermissionRun} /> : null}
        {revisionUpgradeOpen && revisionUpgradeTargetNode ? <RevisionUpgradeDialog targetTitle={revisionUpgradeTargetNode.title} busy={revisionUpgradeBusy} onClose={() => { if (!revisionUpgradeBusy) setRevisionUpgradeOpen(false) }} onSubmit={(input) => { void upgradeAgentResultWithFeedback(input) }} /> : null}
        {workspaceStatesOpen && workspaceStatesWorkspaceId ? (() => {
          const stateWorkspace = workspaces.find((workspace) => workspace.id === workspaceStatesWorkspaceId)
          return stateWorkspace ? <WorkspaceStatesDialog workspace={stateWorkspace} states={workspaceStates} loading={workspaceStatesLoading} saving={workspaceStateSaving} restoringId={workspaceStateRestoringId} error={workspaceStatesError} onClose={() => setWorkspaceStatesOpen(false)} onRefresh={() => loadWorkspaceStates(workspaceStatesWorkspaceId)} onSave={(name) => saveCurrentWorkspaceState(workspaceStatesWorkspaceId, name)} onRestore={restoreSavedWorkspaceState} /> : null
        })() : null}
        {controllerTargetSessionId ? <ConversationControllerDialog
          sessionTitle={conversationSessions.find((item) => item.id === controllerTargetSessionId)?.title ?? 'Conversation'}
          conversations={controllerChoices}
          busy={controllerBusy}
          error={controllerError}
          onChoose={(id) => { void confirmControllerLink(id) }}
          onClose={() => { if (!controllerBusy) { setControllerTargetSessionId(null); setControllerChoices([]); setControllerError(null) } }}
        /> : null}
        {projectFocusOpen && projectFocusSourceIds.length === 1 && projectFocusAnchor !== null && projectFocusLocations.length > 0 && !projectFocusListMode ? <ArtifactLocationOrbit
          open
          anchor={projectFocusAnchor}
          sourceLabel={projectFocusSourceLabel || '当前对象'}
          locations={projectFocusLocations}
          onClose={() => { setProjectFocusOpen(false); setProjectFocusAnchor(null) }}
          onNavigate={navigateProjectFocus}
          onMore={() => setProjectFocusListMode(true)}
        /> : <ProjectFocusNavigator
          open={projectFocusOpen}
          sourceLabel={projectFocusSourceLabel || (projectFocusCount ? `已选 ${projectFocusCount} 项` : '')}
          sourceCount={projectFocusCount}
          locations={projectFocusLocations}
          onClose={() => { setProjectFocusOpen(false); setProjectFocusAnchor(null); setProjectFocusListMode(false) }}
          onNavigate={navigateProjectFocus}
        />}
        {reorganizeOpen && bootMode === 'runtime' ? <ReorganizePanel
          projectId={activeProjectId}
          scopeId={scopeId}
          nodes={scopeNodes}
          selectedIds={selectedIds}
          client={bridgeRef.current.client}
          onClose={closeReorganize}
          onApplied={setNotice}
          onGhost={reorganizeGhost}
          onLivePositions={(positions, phase) => {
            const byId = new Map(positions.map((position) => [position.id, position]))
            setNodes((current) => current.map((node) => {
              const position = byId.get(node.id)
              return position ? { ...node, x: position.x, y: position.y } : node
            }))
            setReorganizePendingIds(phase === 'apply' ? positions.map((position) => position.id) : [])
          }}
          onReviewSettled={() => setReorganizePendingIds([])}
        /> : null}
      </>,
    }}
    immersive={immersiveNodeId ? (() => {
      const immersiveNode = nodes.find((node) => node.id === immersiveNodeId) ?? presentationEntityNodes.find((node) => node.id === immersiveNodeId)
      if (immersiveNode?.entityKind === 'conversation') return null
      return immersiveNode ? { node: immersiveNode, projectId: activeProjectId, ...(immersiveSourceAnchor ? { sourceAnchor: immersiveSourceAnchor } : {}), ...(immersiveRevisionId ? { sourceRevisionId: immersiveRevisionId } : {}), onClose: closeImmersive, onOpenSource: openNative, onRevealSource: revealSource, onRelinkSource: relinkSource, onOpenMaterialSource: openMaterialSource } : null
    })() : null}
    />
    {/* ⌘K 命令面板：portal 到 body 的全局顶层浮层；providers 纯查询、actions 全部为现有函数。 */}
    <CommandPalette
      open={paletteOpen}
      onClose={() => setPaletteOpen(false)}
      providers={paletteAssembly.providers}
      actions={paletteAssembly.actions}
      onSearchProject={(query) => { setPaletteOpen(false); setProjectSearchInitialQuery(query); setProjectToolsMode('search') }}
    />
    </ProjectSpatialMarkerProvider>
    </LocalCoreClientProvider>
  }