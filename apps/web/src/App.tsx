import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Command, Play } from 'lucide-react'
import type { Checkpoint, ContextChangeProposalV1, ContextManifestV0, ObsidianVaultScanV1, RunEvent, RunProposalResult, RunReview, RuntimeProviderStatus, WorkspaceMembership } from '@local-creative-os/contracts'
import type { ActiveRun, Camera, CanvasNode, CanvasScope, NodeDisplayMode, NodeLayer, PersistedPrototypeState, ProjectPackage, ScopeKind, TargetContextInference, WorkRailPreferences, Workspace } from './model'
import { nodeMeta, runStatusLabel } from './model'
import { ProjectCanvas } from './features/canvas/ProjectCanvas'
import type { ComposerResultPolicy } from './features/canvas/SelectionComposer'
import { CanvasMiniMap } from './features/canvas/CanvasMiniMap'
import { WorkRail } from './features/workrail/WorkRail'
import { ProjectDrive } from './features/project/ProjectDrive'
import { ProjectToolsDialog } from './features/project/ProjectToolsDialog'
import { WorkspaceDock } from './features/workspace/WorkspaceDock'
import { WorkspaceDialog } from './features/workspace/WorkspaceDialog'
import { ConfirmDialog } from './features/ui/ConfirmDialog'
import { InlineNodeRename } from './features/ui/InlineNodeRename'
import { CreateContentDialog } from './features/create/CreateContentDialog'
import { ScopeCreateDialog } from './features/create/ScopeCreateDialog'
import { ProjectCreateDialog } from './features/create/ProjectCreateDialog'
import { HandoffDialog } from './features/handoff/HandoffDialog'
import { V07TopBar } from './features/shell/V07TopBar'
import { CapabilityPopover } from './features/shell/CapabilityPopover'
import { NodeInfoPopover } from './features/canvas/NodeInfoPopover'
import { LinkReferenceDialog } from './features/create/LinkReferenceDialog'
import { UniversalImportPanel, type DirectoryEntryInput } from './features/resources/UniversalImportPanel'
import { ResourceDetailDialog } from './features/resources/ResourceDetailDialog'
import { ObsidianImportDialog } from './features/resources/ObsidianImportDialog'
import { ConversationContextDialog } from './features/conversations/ConversationContextDialog'
import { capabilitiesFor, type LinkReferenceInput, type RunOutputIntent } from './runtime/v07UiContracts'
import { loadProjectCatalog, loadPrototypeState, saveProjectCatalog, savePrototypeState } from './state/prototypeStorage'
import { clearProjectNavigationState, loadProjectNavigationState, saveProjectNavigationState } from './state/projectNavigation'
import { buildWorkspaceFrames } from './state/workspaceFrames'
import { RuntimeBridge, type DataSource, type SaveStatus } from './runtime/runtimeBridge'
import { selectRuntimeProject } from './runtime/runtimeProjectSelection'
import { createWorkspaceRecord, duplicateWorkspaceRecord, moveWorkspaceRecord, removeWorkspaceRecord, toggleWorkspaceLayer, updateWorkspaceRecord } from './state/workspaceState'
import { fitBounds, fitBoundsForReading, getSelectionBounds, MIN_CANVAS_ZOOM, nodeDimensions, restorationFocusBounds, restoredCameraIsMeaningful, revealNode } from './features/canvas/canvasGeometry'
import { findPendingReturnPosition } from './features/canvas/canvasLayout'
import { applyScopeLayout, proposeIslandRecoveryLayout, proposeScopeLayout, type LayoutPreviewItem } from './features/canvas/scopeLayout'
import { arrangeSelectedNodes } from './features/canvas/selectionLayout'
import { ArtifactWorkbench, type WorkbenchFocus } from './features/workbench/ArtifactWorkbench'
import { canPreviewArtifact } from './features/viewer/artifactViewerRegistry'
import { copyCanvasSelection, pasteCanvasNodes, pasteRelationTemplate, type CanvasClipboardPayload } from './state/canvasClipboard'
import { useCanvasHistory } from './state/useCanvasHistory'
import { inferTargetContext, moveBetweenTargetAndContext, setPrimaryTarget } from './state/workContext'
import { createBlankProjectState } from './state/projectState'
import { createChildScopeFromSelection, removeScopeTree } from './state/canvasScopes'
import type { ActiveContextProjection } from './runtime/localCoreClient'
import { humanizeRuntimeMessage } from './runtime/messages'
import { AgentContextSurface } from './features/shell/AgentContextSurface'
import { buildScopePath, createId, fileNameFromPath, inferFileType, isTextPreviewFile, runtimePresentationStatus } from './features/shell/appShell'
import { AppShellView } from './features/shell/AppShellView'
import { parseArtifactRevisions, parseProcessProjection, parseWorkspaceStates, type ArtifactRevisionProvenance, type WorkspaceStateSummary } from './runtime/projectionAdapters'
import { WorkspaceStatesDialog } from './features/workspace/WorkspaceStatesDialog'
import { ProjectStripVNext } from './features/shell/ProjectStripVNext'
import { WorkspaceRailVNext } from './features/shell/WorkspaceRailVNext'
import { SurfaceDock, normalizeSurfaceId, type SurfaceId } from './features/shell/SurfaceDock'
import { ProjectionSurface } from './features/surfaces/ProjectionSurfaces'
import { SurfaceComposerBar } from './features/surfaces/SurfaceComposerBar'
import type { ContextHistoryEntry, ContextSurfaceRuntime, DeliverSurfaceRuntime, WorkSurfaceRuntime } from './features/surfaces/surfaceContracts'
import { DropShelf, type DropAnchor, type DropDestination, type TransferVerb } from './features/drop/DropShelf'
import { ImmersiveViewer } from './features/viewer/ImmersiveViewer'
import { resolveArtifactViewerKind } from './features/viewer/artifactViewerRegistry'

const MVP_SAMPLE_PROJECT_ID = 'disposable-mvp-sample'
const DEFAULT_PROJECT_ID = MVP_SAMPLE_PROJECT_ID

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
    const sceneHeight = Math.max(320, height - 84)
    const top = 56
    const bottom = 96
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

function initialPrototype(projectId: string): PersistedPrototypeState {
  const persisted = loadPrototypeState(projectId)
  if (persisted) return persisted
  return createBlankProjectState({ id: projectId, label: projectId, localPath: '', updatedAt: '', pendingCount: 0 }, defaultRailWidth())
}

export function App() {
  const launchSearchParams = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search)
  const agentMode = launchSearchParams?.get('agent') === '1' || launchSearchParams?.get('agent') === 'codex'
  const requestedProjectId = launchSearchParams?.get('project')
  const initialProjectId = requestedProjectId || DEFAULT_PROJECT_ID
  const initial = useMemo(() => initialPrototype(initialProjectId), [initialProjectId])
  const { nodes, edges, setNodes, setEdges, setGraph, undo, redo, resetGraph } = useCanvasHistory({ nodes: initial.nodes, edges: initial.edges })

  const [projects, setProjects] = useState<ProjectPackage[]>(() => loadProjectCatalog([]))
  const [activeProjectId, setActiveProjectId] = useState(initialProjectId)
  const [openProjectIds, setOpenProjectIds] = useState<string[]>([initialProjectId])
  const [projectOpen, setProjectOpen] = useState(true)
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
  const [workbench, setWorkbench] = useState<{ nodeId: string; focus: WorkbenchFocus } | null>(null)
  const [pinnedContextIds, setPinnedContextIds] = useState<string[]>(['brief', 'feedback', 'reference'])
  const [excludedContextIds, setExcludedContextIds] = useState<string[]>([])
  const [manualInference, setManualInference] = useState<TargetContextInference | null>(null)
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null)
  const [runReviews, setRunReviews] = useState<readonly RunReview[]>([])
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
  const [globalComposerText, setGlobalComposerText] = useState('')
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
  const [activeSurface, setActiveSurface] = useState<SurfaceId>('arrange')
  const [stagedTransfer, setStagedTransfer] = useState<{ ids: string[]; anchor: DropAnchor } | null>(null)
  const [immersiveNodeId, setImmersiveNodeId] = useState<string | null>(null)
  const [runtimeProviders, setRuntimeProviders] = useState<readonly RuntimeProviderStatus[]>([])
  const runtimeProvidersRef = useRef(runtimeProviders)
  runtimeProvidersRef.current = runtimeProviders
  const [runProposal, setRunProposal] = useState<RunProposalResult | null>(null)
  const [, setWorkspaceMemberships] = useState<readonly WorkspaceMembership[]>([])
  const [confirmWorkspaceId, setConfirmWorkspaceId] = useState<string | null>(null)
  const [confirmProjectDelete, setConfirmProjectDelete] = useState<ProjectPackage | null>(null)
  const [workspaceEditor, setWorkspaceEditor] = useState<{ mode: 'create' | 'edit'; id?: string } | null>(null)
  const [renameNodeId, setRenameNodeId] = useState<string | null>(null)
  const [layoutPreview, setLayoutPreview] = useState<LayoutPreviewItem[] | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [scopeCreateOpen, setScopeCreateOpen] = useState(false)
  const [projectCreateOpen, setProjectCreateOpen] = useState(false)
  const [composerFocusRequest, setComposerFocusRequest] = useState(0)
  const [presentationCommit, setPresentationCommit] = useState(0)
  const [overviewLayers, setOverviewLayers] = useState<NodeLayer[]>(['core', 'process'])
  const [handoffOpen, setHandoffOpen] = useState(false)
  const [handoffLoading, setHandoffLoading] = useState(false)
  const [handoffManifest, setHandoffManifest] = useState<ContextManifestV0 | null>(null)
  const [handoffError, setHandoffError] = useState<string | undefined>()
  const [capabilityOpen, setCapabilityOpen] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [importPanelOpen, setImportPanelOpen] = useState(false)
  const [conversationDialogOpen, setConversationDialogOpen] = useState(false)
  const [projectToolsMode, setProjectToolsMode] = useState<'search' | 'full' | null>(null)
  const [resourceDetailArtifactId, setResourceDetailArtifactId] = useState<string | null>(null)
  const [obsidianScan, setObsidianScan] = useState<ObsidianVaultScanV1 | null>(null)
  const [obsidianBusy, setObsidianBusy] = useState(false)
  const [obsidianError, setObsidianError] = useState<string | null>(null)
  const [activeContextProjection, setActiveContextProjection] = useState<ActiveContextProjection | null>(null)
  const [activeContextError, setActiveContextError] = useState<string | null>(null)
  const [contextSync, setContextSync] = useState<'syncing' | 'synced' | 'conflict'>('synced')
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

  const objectUrls = useRef<Set<string>>(new Set())
  const clipboardRef = useRef<CanvasClipboardPayload | null>(null)
  const lastCanvasPointRef = useRef<{ x: number; y: number } | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const runCounterRef = useRef(43)
  const projectStateCacheRef = useRef<Map<string, PersistedPrototypeState>>(new Map([[initialProjectId, initial]]))
  const bridgeRef = useRef(new RuntimeBridge(initialProjectId))
  const presentationInteractionRef = useRef(false)
  const cameraRef = useRef(camera)
  const activeProjectIdRef = useRef(activeProjectId)
  const restoredRunProjectRef = useRef<string | null>(null)
  const runtimeSyncBusyRef = useRef(false)
  const draftHydratedKeyRef = useRef<string | null>(null)
  const activeContextHydratedKeyRef = useRef<string | null>(null)
  const activeContextVersionRef = useRef(0)
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
  const selectedNodes = selectedIds.map((id) => nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
  const selectedId = selectedIds.at(-1) ?? null
  const singleSelectedNode = selectedIds.length === 1 ? selectedNodes[0] ?? null : null
  const nodeInfoNode = nodeInfoId ? nodes.find((node) => node.id === nodeInfoId) ?? null : null
  const workbenchNode = workbench ? nodes.find((node) => node.id === workbench.nodeId) ?? null : null
  const workbenchRelationCount = useMemo(() => workbenchNode ? edges.filter((edge) => edge.from === workbenchNode.id || edge.to === workbenchNode.id).length : 0, [edges, workbenchNode])
  const visibleLayers: NodeLayer[] = activeWorkspace ? (activeWorkspace.visibleLayers.length ? activeWorkspace.visibleLayers : ['core', 'process']) : overviewLayers
  const scopeNodes = useMemo(() => nodes.filter((node) => (node.scopeId ?? 'scope-root') === scopeId), [nodes, scopeId])
  const scopeWorkspaces = useMemo(() => workspaces.filter((workspace) => workspace.scopeId === scopeId), [scopeId, workspaces])
  const visibleNodes = useMemo(() => scopeNodes.filter((node) => visibleLayers.includes(nodeMeta[node.kind].layer)), [scopeNodes, visibleLayers])
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
  const activeWorkspaceFrames = useMemo(() => workspaceId ? workspaceFrames.filter((frame) => frame.workspaceId === workspaceId) : [], [workspaceFrames, workspaceId])
  const relationNodes = useMemo(() => selectedId ? edges.filter((edge) => edge.from === selectedId || edge.to === selectedId).map((edge) => nodes.find((node) => node.id === (edge.from === selectedId ? edge.to : edge.from))).filter((node): node is CanvasNode => Boolean(node)) : [], [edges, nodes, selectedId])
  const nodeInfoRelationCount = useMemo(() => nodeInfoId ? edges.filter((edge) => edge.from === nodeInfoId || edge.to === nodeInfoId).length : 0, [edges, nodeInfoId])
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
  const selectionEditableNodes = useMemo(() => selectedNodes.filter((node) => node.managed === true && node.artifactId && node.revisionId), [selectedNodes])
  const selectionTargetNode = !selectionCreateAsNewNode && selectionEditableNodes.length === 1 ? selectionEditableNodes[0] ?? null : null
  const runBusy = Boolean(activeRun && ['queued', 'running'].includes(activeRun.status))
  const capabilities = useMemo(() => capabilitiesFor(dataSource), [dataSource])

  const baseInference = useMemo(() => inferTargetContext(nodes, selectedIds, effectiveWorkspace, scopeId, pinnedContextIds), [effectiveWorkspace, nodes, pinnedContextIds, scopeId, selectedIds])
  const inference = useMemo(() => {
    const current = manualInference ?? baseInference
    return { ...current, contextIds: current.contextIds.filter((id) => !excludedContextIds.includes(id)) }
  }, [baseInference, excludedContextIds, manualInference])
  const pendingNode = activeRun?.pendingArtifactId ? nodes.find((node) => node.id === activeRun.pendingArtifactId) ?? null : null
  const compareExpanded = activeRun?.status === 'review' && Boolean(pendingNode)
  const layoutDensity = shellLayoutDensity(viewportWidth)
  const layoutMode = shellLayoutMode(viewportWidth, viewportHeight)
  const effectiveRailWidth = workRail.collapsed ? 48 : responsiveRailWidth(viewportWidth, compareExpanded)
  const sceneStyle = useMemo(() => ({
    '--work-rail-width': `${effectiveRailWidth}px`,
  } as CSSProperties), [effectiveRailWidth])
  const safeInsets = useMemo(() => ({
    left: layoutMode === 'sidecar' ? 18 : 76,
    right: layoutMode === 'sidecar' ? 18 : 28,
    top: layoutMode === 'sidecar' ? 64 : 24,
    bottom: layoutMode === 'sidecar' ? 106 : miniMapCollapsed ? 72 : 164,
  }), [layoutMode, miniMapCollapsed])
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

  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 2600); return () => window.clearTimeout(timer) }, [notice])
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
        restoredDraftContextIdsRef.current = [...draft.contextViewIds]
        setPinnedContextIds((current) => Array.from(new Set([...current, ...draft.contextViewIds])))
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
      if (!selectionComposerText.trim()) {
        void bridgeRef.current.client.deleteCommandDraft(activeProjectId, workspaceId, 'selection', controller.signal)
        return
      }
      void bridgeRef.current.client.saveCommandDraft(activeProjectId, workspaceId, 'selection', {
        prompt: selectionComposerText,
        contextViewIds: selectionContextIds,
        provider: selectionProvider,
        createAsNewNode: selectionCreateAsNewNode,
      }, controller.signal)
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [activeProjectId, bootMode, selectionComposerText, selectionContextIds, selectionCreateAsNewNode, selectionProvider, workspaceId])

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
        prompt: globalComposerText,
        contextViewIds: globalContextIds,
        provider: globalProvider,
        createAsNewNode: globalCreateAsNewNode,
      }, controller.signal)
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [activeProjectId, bootMode, globalComposerText, globalContextIds, globalCreateAsNewNode, globalProvider, workspaceId])

  useEffect(() => {
    if (bootMode !== 'runtime') return
    const key = `${activeProjectId}::${workspaceId ?? '__project_overview__'}`
    if (activeContextHydratedKeyRef.current !== key) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setContextSync('syncing')
      const expectedVersion = activeContextVersionRef.current
      void bridgeRef.current.client.updateActiveContext(activeProjectId, {
        ...(workspaceId === null ? {} : { workspaceId }),
        scopeId,
        selectedViewIds: selectedIds,
        pinnedContextIds,
        excludedContextIds,
        viewport: { x: camera.x, y: camera.y, zoom: camera.zoom },
        visibleViewIds: visibleNodes.map((node) => node.id),
        ...(expectedVersion === undefined ? {} : { expectedVersion }),
        ...(selectionTargetNode?.artifactId ? { targetArtifactId: selectionTargetNode.artifactId } : {}),
        ...((selectionBaseRevision?.id ?? selectionTargetNode?.revisionId) ? { targetRevisionId: selectionBaseRevision?.id ?? selectionTargetNode?.revisionId } : {}),
      }, controller.signal).then((call) => {
        if (call.result.ok) {
          setActiveContextProjection(call.result.value)
          activeContextVersionRef.current = call.result.value.version
          setActiveContextError(null)
          setContextSync('synced')
        } else {
          setActiveContextError(call.result.error.message)
          if (call.result.error.code === 'ACTIVE_CONTEXT_CONFLICT') {
            setContextSync('conflict')
            void bridgeRef.current.client.activeContext(activeProjectId, workspaceId).then((refresh) => {
              if (refresh.result.ok) {
                setActiveContextProjection(refresh.result.value)
                activeContextVersionRef.current = refresh.result.value.version
                setContextSync('synced')
              }
            })
          }
        }
      })
    }, 250)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [activeProjectId, bootMode, camera.x, camera.y, camera.zoom, excludedContextIds, pinnedContextIds, scopeId, selectedIds, selectionBaseRevision?.id, selectionTargetNode?.artifactId, selectionTargetNode?.revisionId, visibleNodes, workspaceId])

  useEffect(() => {
    if (bootMode !== 'runtime' || workRail.collapsed || !activeProjectId) return
    let cancelled = false
    let timer: number | undefined
    const pollRunList = async () => {
      const call = await bridgeRef.current.client.projectRunReviews(activeProjectId, 40).catch(() => null)
      if (!cancelled && call?.result.ok) setRunReviews(call.result.value)
    }
    void pollRunList()
    timer = window.setInterval(() => { void pollRunList() }, 4_000)
    return () => { cancelled = true; if (timer !== undefined) window.clearInterval(timer) }
  }, [activeProjectId, bootMode, workRail.collapsed])

  useEffect(() => {
    if (!agentMode || !activeProjectId || bootMode !== 'runtime') return
    const controller = new AbortController()
    let stopped = false
    let version = activeContextVersionRef.current
    let fallbackTimer: number | undefined
    let cardTimer: number | undefined
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
    const pollCard = async () => {
      if (stopped) return
      const [proposals, reviews] = await Promise.all([
        bridgeRef.current.client.listContextProposals(activeProjectId, workspaceId).catch(() => null),
        bridgeRef.current.client.projectRunReviews(activeProjectId, 100).catch(() => null),
      ])
      if (stopped) return
      if (proposals?.result.ok) applyProposals(proposals.result.value)
      if (reviews?.result.ok) applyRuns(reviews.result.value)
    }
    const startCardPolling = () => {
      if (stopped || cardTimer !== undefined) return
      cardTimer = window.setInterval(() => { void pollCard() }, 3_000)
    }
    const poll = async () => {
      while (!stopped && !controller.signal.aborted) {
        const call = await bridgeRef.current.client.activeContext(
          activeProjectId,
          workspaceId,
          version,
          controller.signal,
        )
        if (stopped || controller.signal.aborted) return
        if (call.result.ok) {
          apply(call.result.value)
          continue
        }
        setActiveContextError(call.result.error.message)
        await new Promise((resolve) => window.setTimeout(resolve, 750))
      }
    }
    const startPolling = () => {
      if (stopped || fallbackTimer !== undefined) return
      fallbackTimer = window.setTimeout(() => {
        fallbackTimer = undefined
        void poll()
      }, 750)
      startCardPolling()
    }
    void bridgeRef.current.client.streamActiveContext(
      activeProjectId,
      workspaceId,
      version,
      {
        onContext: apply,
        onProposals: applyProposals,
        onRuns: applyRuns,
      },
      controller.signal,
    ).then(() => {
      if (!stopped) startPolling()
    }).catch(() => {
      if (!stopped) startPolling()
    })
    return () => {
      stopped = true
      controller.abort()
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer)
      if (cardTimer !== undefined) window.clearInterval(cardTimer)
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
    bridge.isAvailable().then((available) => {
      if (!available) {
        setNotice('本地项目服务暂时不可用，当前仅显示演示内容')
        setBootMode('offline')
        return
      }
      bridge.loadCatalog().then((catalog) => {
        const runtimeProjects = catalog.projects
        const selection = selectRuntimeProject(runtimeProjects, requestedProjectId ?? null, MVP_SAMPLE_PROJECT_ID)
        if (selection.kind === 'missing-requested') {
          setProjects(runtimeProjects)
          setProjectOpen(false)
          setBootMode('offline')
          setNotice(`没有找到这个项目，已回到项目列表。项目 ID：${selection.requestedProjectId}`)
          return
        }
        if (selection.kind === 'empty-catalog') {
          setProjects([])
          setBootMode('offline')
          setNotice('还没有本地项目，请创建新项目或打开已有文件夹')
          return
        }
        const runtimeProjectId = selection.projectId
        setProjects(runtimeProjects)
        setOpenProjectIds([runtimeProjectId])
        setActiveProjectId(runtimeProjectId)
        bridgeRef.current = new RuntimeBridge(runtimeProjectId)
        return bridgeRef.current.loadProject()
      }).then((result) => {
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
        } else if (result !== undefined) {
          setProjects([])
          setProjectOpen(false)
          setBootMode('offline')
          setNotice('项目暂时无法打开，已回到项目列表。你的项目文件没有被修改')
        }
      }).catch(() => {
        setProjectOpen(false)
        setBootMode('offline')
        setNotice('本地项目服务连接中断，已回到项目列表。你的内容仍保留在本地')
      })
    })
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
      const snapshot: PersistedPrototypeState = { version: 10, projectId: activeProjectId, nodes, edges, workspaces, scopes, activeWorkspaceId: null, activeScopeId: rootScopeId, workRail }
      projectStateCacheRef.current.set(activeProjectId, snapshot)
      if (bootMode === 'runtime') {
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
  }, [activeProjectId, bootMode, edges, nodes, presentationCommit, projects, scopes, workRail, workspaces])

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
  }), [activeProjectId, edges, nodes, scopeId, scopes, workRail, workspaces])

  const applyProjectState = useCallback((projectId: string, state: PersistedPrototypeState) => {
    resetGraph({ nodes: state.nodes, edges: state.edges })
    setWorkspaces(state.workspaces)
    setScopes(state.scopes)
    setWorkspaceId(null)
    const rootScope = state.scopes.find((scope) => scope.kind === 'root') ?? state.scopes[0]
    setScopeId(rootScope.id)
    setCamera(loadProjectNavigationState(projectId)?.camera ?? rootScope.camera)
    setWorkRail(normalizeRailPreferences(state.workRail))
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
  const selectNode = useCallback((id: string, additive = false) => {
    selectionContextIntentRef.current.touched = true
    selectionIntentVersionRef.current += 1
    setSelectedEdgeId(null)
    // 第一次单击只选中；再次单击已选中的节点才唤起提示词浮层，
    // 避免拖拽/多选时被 nearfield composer 干扰。
    setSelectionComposerOpen(!additive && selectedIds.includes(id))
    setSelectedIds((current) => additive ? current.includes(id) ? current.filter((item) => item !== id) : [...current, id] : [id])
    if (!additive) setNodeInfoId(null)
  }, [selectedIds])
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
    setWorkspaceId(null)
    setLayoutPreview(null)
    setNotice('当前画布总览 · Scope 与 Camera 保持不变')
  }, [])

  const changeWorkspace = useCallback((id: string) => {
    const next = workspaces.find((workspace) => workspace.id === id && workspace.scopeId === scopeId)
    if (!next) { setNotice('这个工作空间不属于当前画布'); return }
    setWorkspaceId(id)
    setLayoutPreview(null)
    // Projection Preference：进入工作空间时恢复它偏好的 Lens（brief 5 Workspace 组成之一）。
    if (next.preferredSurface && next.preferredSurface !== 'arrange') {
      setActiveSurface(normalizeSurfaceId(next.preferredSurface))
    }
    setNotice(`已激活工作空间「${next.label}」· Scope 与 Camera 未改变`)
  }, [scopeId, workspaces])

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

  const enterScope = useCallback((nextScopeId: string) => {
    if (nextScopeId === scopeId) return
    const next = scopes.find((scope) => scope.id === nextScopeId)
    if (!next) { setNotice('目标画布不存在或已被删除'); return }
    setWorkspaceId(null)
    setScopeId(nextScopeId)
    const nextNodes = nodes.filter((node) => (node.scopeId ?? 'scope-root') === nextScopeId)
    const bounds = getSelectionBounds(nextNodes, nextNodes.map((node) => node.id))
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    if (bounds) setCamera(fitBounds(bounds, viewport?.width ?? 1000, viewport?.height ?? 820, 82, safeInsets))
    clearSelection()
    setLayoutPreview(null)
    setNotice(`已进入 ${next.label}`)
  }, [clearSelection, nodes, safeInsets, scopeId, scopes, workspaces])

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

  const enterScopeKeepingSelection = useCallback((targetScopeId: string, nextSelection: string[]) => {
    const target = scopes.find((scope) => scope.id === targetScopeId) ?? (targetScopeId === workbenchScopeId ? { id: targetScopeId, label: '当前现场', camera: { x: 150, y: 88, zoom: 1 } } : null)
    setWorkspaceId(null)
    setScopeId(targetScopeId)
    if (target?.camera) setCamera(target.camera)
    setSelectedIds(nextSelection)
    setSelectedEdgeId(null)
    setLayoutPreview(null)
  }, [scopes, workbenchScopeId])

  const openCurrentWorkbench = useCallback(() => {
    const id = ensureWorkbenchScope()
    workbenchEntryFitRef.current = { scopeId: id, enteredAt: Date.now(), nodeKey: '' }
    enterScopeKeepingSelection(id, [])
    const workbenchNodes = nodes.filter((node) => node.scopeId === id)
    if (workbenchNodes.length > 0) {
      // Workbench 是有限、临时的第一工作现场，进入时应看见完整 payload，
      // 不能像大型 Project overview 一样只挑一个密集岛。
      const bounds = getSelectionBounds(workbenchNodes, workbenchNodes.map((node) => node.id))
      if (bounds) {
        setCamera(fitBoundsForReading(
          bounds,
          window.innerWidth,
          window.innerHeight,
          64,
          safeInsets,
        ))
      }
    }
    setActiveSurface('arrange')
    setNotice('已进入当前现场')
  }, [ensureWorkbenchScope, enterScopeKeepingSelection, nodes, safeInsets, setCamera])

  const mergeWorkbenchViews = useCallback(() => {
    if (!workbenchScope) { setNotice('当前没有可并回的工作现场'); return }
    if (bootMode === 'runtime') {
      void bridgeRef.current.mergeWorkbench(workbenchScope.id).then((outcome) => {
        if (!outcome.ok) { setNotice(`并回失败：${outcome.error ?? '未知错误'}`); return }
        if (outcome.state) {
          resetGraph({ nodes: outcome.state.nodes, edges: outcome.state.edges })
          setWorkspaces(outcome.state.workspaces)
          setScopes(outcome.state.scopes)
          setWorkspaceId(null)
          const rootScope = outcome.state.scopes.find((scope) => scope.kind === 'root') ?? outcome.state.scopes[0]
          setScopeId(rootScope?.id ?? outcome.state.activeScopeId)
          setSelectedIds([])
          setSelectedEdgeId(null)
        }
        setActiveSurface('arrange')
        const merged = outcome.result?.mergedViews ?? 0
        const restored = outcome.result?.restoredRefs ?? 0
        setNotice(`已并回 ${merged} 个新稳定结果${restored > 0 ? `，复位 ${restored} 个原项目引用` : ''}；临时现场已清空`)
      })
      return
    }
    const benchNodes = nodes.filter((node) => (node.scopeId ?? rootScope.id) === workbenchScope.id)
    if (!benchNodes.length) { enterScopeKeepingSelection(rootScope.id, []); setNotice('当前现场已经是空的'); return }
    const rootNodes = nodes.filter((node) => (node.scopeId ?? rootScope.id) === rootScope.id)
    const canonicalKey = (node: CanvasNode) => node.artifactId ?? node.viewOf ?? node.id
    const existing = new Map(rootNodes.map((node) => [canonicalKey(node), node]))
    const benchToRoot = new Map<string, string>()
    const additions: CanvasNode[] = []
    const isStableOutput = (node: CanvasNode) => node.current === true || node.kind === 'decision' || node.kind === 'note' || node.kind === 'context'
    benchNodes.forEach((node, index) => {
      const key = canonicalKey(node)
      const current = existing.get(key)
      if (current) { benchToRoot.set(node.id, current.id); return }
      if (!isStableOutput(node)) return
      const id = createId('view')
      benchToRoot.set(node.id, id)
      additions.push({ ...node, id, artifactId: node.artifactId, viewOf: key, scopeId: rootScope.id, workspaceIds: undefined, x: 180 + (index % 3) * 300, y: 160 + Math.floor(index / 3) * 210, positionLocked: false })
    })
    const benchIds = new Set(benchNodes.map((node) => node.id))
    const retainedEdges = edges.filter((edge) => !benchIds.has(edge.from) && !benchIds.has(edge.to))
    const mergedEdges = edges.filter((edge) => benchIds.has(edge.from) && benchIds.has(edge.to)).flatMap((edge) => {
      const from = benchToRoot.get(edge.from), to = benchToRoot.get(edge.to)
      if (!from || !to || retainedEdges.some((current) => current.from === from && current.to === to && current.kind === edge.kind)) return []
      return [{ ...edge, id: createId('edge'), from, to, active: false }]
    })
    const nextNodes = [...nodes.filter((node) => !benchIds.has(node.id)), ...additions]
    setGraph({ nodes: nextNodes, edges: [...retainedEdges, ...mergedEdges] })
    enterScopeKeepingSelection(rootScope.id, [...benchToRoot.values()])
    setActiveSurface('arrange')
    const restoredRefs = benchToRoot.size - additions.length
    setNotice(`已并回 ${additions.length} 个新稳定结果${restoredRefs > 0 ? `，复位 ${restoredRefs} 个原项目引用` : ''}；临时现场已清空`)
  }, [edges, enterScopeKeepingSelection, nodes, rootScope.id, setGraph, workbenchScope])

  const branchContextHistoryToWorkbench = useCallback((entry: ContextHistoryEntry) => {
    if (coreContextSnapshots.some((snapshot) => String(snapshot.id) === entry.id)) {
      const targetScopeId = ensureWorkbenchScope()
      void bridgeRef.current.client.branchContextSnapshot(activeProjectId, entry.id, { label: `从 ${entry.label} 分支`, targetScopeId }).then((call) => {
        if (!call.result.ok) { setNotice(`分支失败：${call.result.error.message}`); return }
        const value = call.result.value
        const viewIds = value.viewIds.filter((id) => nodes.some((node) => node.id === id))
        enterScopeKeepingSelection(value.scopeId, viewIds)
        setActiveSurface('arrange')
        setNotice(viewIds.length ? `已从快照 ${entry.label} 建立当前现场 · ${viewIds.length} refs` : `已进入从快照 ${entry.label} 创建的当前现场；历史记录保持只读`)
      })
      return
    }
    const targetScopeId = ensureWorkbenchScope()
    const sourceIds = entry.objectIds.filter((id) => nodes.some((node) => node.id === id))
    const projectedIds = projectViewsIntoScope(sourceIds, targetScopeId)
    enterScopeKeepingSelection(targetScopeId, projectedIds)
    setActiveSurface('arrange')
    setNotice(projectedIds.length ? `已从 ${entry.label} 建立当前现场 · ${projectedIds.length} refs` : `已进入从 ${entry.label} 创建的当前现场；历史记录保持只读`)
  }, [activeProjectId, coreContextSnapshots, ensureWorkbenchScope, enterScopeKeepingSelection, nodes, projectViewsIntoScope])

  const compareContextHistory = useCallback((entry: ContextHistoryEntry) => {
    if (coreContextSnapshots.length > 1 && coreContextSnapshots.some((snapshot) => String(snapshot.id) === entry.id)) {
      const latest = coreContextSnapshots[coreContextSnapshots.length - 1]
      void bridgeRef.current.client.compareContextSnapshots(activeProjectId, entry.id, String(latest.id)).then((call) => {
        if (!call.result.ok) { setNotice(`对比失败：${call.result.error.message}`); return }
        const diff = call.result.value
        const targetIds = [...diff.added.focusedViewIds, ...diff.removed.focusedViewIds].filter((id) => nodes.some((node) => node.id === id))
        if (targetIds.length) setSelectedIds(targetIds)
        setActiveSurface('context-flow')
        setNotice(`对比 ${entry.label} ↔ 最新：新增 ${diff.added.artifactIds.length} / 移除 ${diff.removed.artifactIds.length} / 不变 ${diff.kept.artifactIds.length} 对象`)
      })
      return
    }
    const sourceIds = entry.objectIds.filter((id) => nodes.some((node) => node.id === id))
    if (sourceIds.length) setSelectedIds(sourceIds)
    setActiveSurface('context-flow')
    setNotice(`正在对比 ${entry.label} 与当前 Context；历史 Snapshot 保持只读`)
  }, [activeProjectId, coreContextSnapshots, nodes])

  const openContextHistorySource = useCallback((entry: ContextHistoryEntry) => {
    const node = entry.sourceNodeId ? nodes.find((item) => item.id === entry.sourceNodeId) : undefined
    if (!node) { setNotice(entry.sourceRunId ? `来源 Run · ${entry.sourceRunId}` : `${entry.label} 暂无可定位来源`); return }
    if (node.scopeId && node.scopeId !== scopeId) setScopeId(node.scopeId)
    setSelectedIds([node.id])
    setActiveSurface(node.kind === 'process' ? 'workflow' : 'arrange')
    setNotice(`已定位 ${entry.label} 的来源「${node.title}」`)
  }, [nodes, scopeId])

  const stageTransfer = useCallback((ids: string[], anchor: DropAnchor) => {
    if (!ids.length) return
    setSelectedIds(ids)
    setStagedTransfer({ ids: [...ids], anchor })
  }, [])

  const cancelTransfer = useCallback(() => setStagedTransfer(null), [])

  const handleTransfer = useCallback((destination: DropDestination, verb: TransferVerb) => {
    const payload = stagedTransfer?.ids ?? []
    if (!payload.length) { setStagedTransfer(null); return }
    const follow = verb === '继续工作'
    if (destination.kind === 'workspace') {
      const target = workspaces.find((workspace) => workspace.id === destination.id)
      if (!target) { setNotice('目标工作空间不存在'); setStagedTransfer(null); return }
      const targetFrame = buildWorkspaceFrames(workspaces, scopeNodes, workspaceId, scopeId).find((frame) => frame.workspaceId === destination.id)
      const payloadSet = new Set(payload)
      setNodes((current) => current.map((node) => {
        if (!payloadSet.has(node.id)) return node
        const index = payload.indexOf(node.id)
        // 加入：真实节点留在原画布位置，只登记进目标空间；移动/继续工作：节点移入目标框体。
        const moved = verb !== '加入'
        const x = moved && targetFrame ? targetFrame.bounds.x + 28 + (index % 2) * 240 : node.x
        const y = moved && targetFrame ? targetFrame.bounds.y + 54 + Math.floor(index / 2) * 170 : node.y
        return { ...node, x, y, workspaceIds: [...new Set([...(node.workspaceIds ?? []).filter((id) => id !== workspaceId), destination.id])] }
      }))
      if (bootMode === 'runtime') {
        if (workspaceId && workspaceId !== destination.id && verb !== '加入') {
          void Promise.all(payload.map((viewId) => bridgeRef.current.client.moveWorkspaceMember(workspaceId, { viewId, toWorkspaceId: destination.id }))).then((calls) => {
            const latest = calls.at(-1)
            if (latest?.result.ok) applyMembershipProjection(latest.result.value)
          })
        } else {
          void bridgeRef.current.client.addWorkspaceMembers(destination.id, { viewIds: payload, addedBy: 'user' }).then((call) => {
            if (call.result.ok) applyMembershipProjection(call.result.value)
          })
        }
      }
      if (follow) {
        setWorkspaceId(destination.id)
        window.setTimeout(() => locateWorkspace(destination.id), 0)
      }
      setNotice(`${payload.length} 项已投送到「${target.label}」${follow ? '并前往' : ''}`)
    } else {
      const targetScopeId = destination.kind === 'workbench' ? ensureWorkbenchScope() : destination.kind === 'root' ? rootScope.id : destination.id
      // workbench/scope 投送即投影：目标 scope 建立视图引用，主画布原视图不动。
      const projectedIds = projectViewsIntoScope(payload, targetScopeId)
      if (follow) {
        enterScopeKeepingSelection(targetScopeId, projectedIds)
        if (destination.kind === 'workbench') setActiveSurface('arrange')
      }
      setNotice(`${payload.length} 项已投送到「${destination.label}」${follow ? '并前往' : ''}`)
    }
    setStagedTransfer(null)
  }, [applyMembershipProjection, bootMode, ensureWorkbenchScope, enterScopeKeepingSelection, locateWorkspace, projectViewsIntoScope, rootScope.id, scopeId, scopeNodes, setNodes, stagedTransfer, workspaceId, workspaces])


  const saveWorkspaceEditor = useCallback(({ label }: { label: string }) => {
    const now = new Date().toISOString()
    if (workspaceEditor?.mode === 'edit' && workspaceEditor.id) {
      setWorkspaces((current) => updateWorkspaceRecord(current, workspaceEditor.id!, { label }, now))
      setNotice('工作空间名称与意图已更新')
    } else {
      const next = createWorkspaceRecord({ id: createId('workspace'), label, intent: null, camera: { x: 0, y: 0, zoom: 1 }, visibleLayers, now })
      const workspace: Workspace = { ...next, scopeId, focusedViewIds: selectedIds, contextPolicy: 'workspace-related' }
      setWorkspaces((current) => [...current, workspace])
      if (selectedIds.length) {
        const selected = new Set(selectedIds)
        setNodes((current) => current.map((node) => selected.has(node.id) ? { ...node, workspaceIds: Array.from(new Set([...(node.workspaceIds ?? []), workspace.id])) } : node))
      }
      setWorkspaceId(workspace.id)
      setNotice(`${label} 已创建为长期工作空间`)
    }
    setWorkspaceEditor(null)
  }, [scopeId, selectedIds, setNodes, visibleLayers, workspaceEditor])

  const duplicateWorkspace = useCallback((id: string) => {
    const result = duplicateWorkspaceRecord(workspaces, id, createId('workspace'), new Date().toISOString())
    if (!result.duplicate) return
    const duplicate: Workspace = { ...result.duplicate, scopeId: result.duplicate.scopeId ?? scopeId, focusedViewIds: [...(result.duplicate.focusedViewIds ?? [])], contextPolicy: result.duplicate.contextPolicy ?? 'workspace-related' }
    setWorkspaces(result.workspaces.map((workspace) => workspace.id === duplicate.id ? duplicate : workspace))
    setNodes((current) => current.map((node) => node.workspaceIds?.includes(id) ? { ...node, workspaceIds: Array.from(new Set([...(node.workspaceIds ?? []), duplicate.id])) } : node))
    setWorkspaceId(duplicate.id)
    setNotice('工作空间已复制，Camera 保持不变')
  }, [scopeId, setNodes, workspaces])

  const moveWorkspace = useCallback((id: string, direction: -1 | 1) => setWorkspaces((current) => moveWorkspaceRecord(current, id, direction)), [])
  const deleteWorkspace = useCallback((id: string) => { if (workspaces.length <= 1) setNotice('至少保留一个工作空间'); else setConfirmWorkspaceId(id) }, [workspaces.length])
  const confirmDeleteWorkspace = useCallback(() => {
    if (!confirmWorkspaceId) return
    const remaining = removeWorkspaceRecord(workspaces, confirmWorkspaceId)
    setWorkspaces(remaining)
    setNodes((current) => current.map((node) => node.workspaceIds?.includes(confirmWorkspaceId) ? { ...node, workspaceIds: node.workspaceIds.filter((id) => id !== confirmWorkspaceId) } : node))
    if (workspaceId === confirmWorkspaceId) setWorkspaceId(null)
    clearSelection()
    setConfirmWorkspaceId(null)
    setNotice('工作空间已删除，内容、节点与 Camera 均未删除')
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

  const addSelectionToActiveWorkspace = useCallback(() => {
    if (!workspaceId) { setNotice('先激活一个工作空间'); return }
    if (!selectedIds.length) { setNotice('先选择要加入工作空间的内容'); return }
    void addViewsToWorkspace(workspaceId, selectedIds, 'user').then((ok) => {
      if (ok) setNotice(`已将 ${selectedIds.length} 项加入「${activeWorkspace?.label ?? '当前工作空间'}」`)
    })
  }, [activeWorkspace?.label, addViewsToWorkspace, selectedIds, workspaceId])

  const removeSelectionFromActiveWorkspace = useCallback(() => {
    if (!workspaceId) { setNotice('先激活一个工作空间'); return }
    if (!selectedIds.length) { setNotice('先选择要移出的内容'); return }
    if (bootMode !== 'runtime') {
      const idSet = new Set(selectedIds)
      setNodes((current) => current.map((node) => idSet.has(node.id)
        ? { ...node, workspaceIds: (node.workspaceIds ?? []).filter((id) => id !== workspaceId) }
        : node))
      setNotice(`已从「${activeWorkspace?.label ?? '当前工作空间'}」移出 ${selectedIds.length} 项`)
      return
    }
    void Promise.all(selectedIds.map((viewId) => bridgeRef.current.client.removeWorkspaceMember(workspaceId, viewId))).then((calls) => {
      const failed = calls.find((call) => !call.result.ok)
      if (failed && !failed.result.ok) { setNotice(`移出工作空间失败：${failed.result.error.message}`); return }
      const memberships = calls.at(-1)
      if (memberships?.result.ok) applyMembershipProjection(memberships.result.value)
      setNotice(`已从「${activeWorkspace?.label ?? '当前工作空间'}」移出 ${selectedIds.length} 项`)
    })
  }, [activeWorkspace?.label, applyMembershipProjection, bootMode, selectedIds, setNodes, workspaceId])

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
      setNotice('已恢复工作现场；后续 Revision 和 Run 记录未被删除')
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

  const renameNodeTitle = useCallback((id: string, title: string) => { setNodes((current) => current.map((node) => node.id === id ? { ...node, title } : node)); setRenameNodeId(null); setNotice('名称已更新') }, [setNodes])

  const getPasteTarget = useCallback(() => {
    if (lastCanvasPointRef.current) return lastCanvasPointRef.current
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    return { x: ((viewport?.width ?? 1000) / 2 - camera.x) / camera.zoom, y: ((viewport?.height ?? 760) / 2 - camera.y) / camera.zoom }
  }, [camera])

  const copySelection = useCallback((ids = selectedIds, edgeId = selectedEdgeId) => {
    const payload = copyCanvasSelection(nodes, edges, ids, edgeId, activeProjectId)
    if (!payload) { setNotice('请先选择内容或关系'); return null }
    clipboardRef.current = payload
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

  const arrangeSelection = useCallback(() => {
    if (selectedIds.length < 2) { setNotice('至少选择两个对象后再整理'); return }
    setNodes((current) => arrangeSelectedNodes(current, selectedIds)); setNotice('已整理所选对象')
  }, [selectedIds, setNodes])

  const previewScopeLayout = useCallback(() => {
    const preview = proposeScopeLayout(nodes, scopeId, { respectLocked: true })
    const lockedCount = nodes.filter((node) => (node.scopeId ?? 'scope-root') === scopeId && node.positionLocked).length
    setLayoutPreview(preview)
    setNotice(`正在预览语义布局${lockedCount ? ` · 已避开 ${lockedCount} 个固定对象` : ''}`)
  }, [nodes, scopeId])
  const applyLayout = useCallback(() => {
    if (!layoutPreview) return
    const projected = applyScopeLayout(nodes, layoutPreview)
    setNodes(projected)
    setScopes((current) => current.map((scope) => scope.id === scopeId ? { ...scope, layoutMode: 'semantic', updatedAt: new Date().toISOString() } : scope))
    const projectedScope = projected.filter((node) => (node.scopeId ?? 'scope-root') === scopeId)
    const bounds = getSelectionBounds(projectedScope, projectedScope.map((node) => node.id))
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    if (bounds) setCamera(fitBoundsForReading(bounds, viewport?.width ?? 1000, viewport?.height ?? 820, 72, safeInsets))
    setLayoutPreview(null)
    setNotice('已应用当前画布布局')
  }, [layoutPreview, nodes, safeInsets, scopeId, setNodes])

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
        ...nodeDimensions(kind, 'standard'),
        displayMode: 'standard',
        scopeId,
        createdAt: new Date().toISOString(),
        workspaceIds: workspaceId ? [workspaceId] : [],
      }
      setNodes((current) => [...current, temp])
      setSelectedIds([localId])
      void bridgeRef.current.client.createTextArtifact(activeProjectId, {
        body: '',
        scopeId,
        ...(workspaceId === null ? {} : { workspaceId }),
        x,
        y,
      }).then((call) => {
        if (!call.result.ok) {
          setNodes((current) => current.filter((node) => node.id !== localId))
          setNotice(`文本创建失败：${call.result.error.message}`)
          return
        }
        const value = call.result.value
        setNodes((current) => current.map((node) => node.id === localId ? {
          ...node,
          id: value.viewId,
          artifactId: value.artifactId,
          revisionId: value.revisionId,
          fileRecordId: value.fileRecordId,
          managed: true,
          title: value.title,
          subtitle: '文本 · 可进入 Context 与修改',
          previewText: '',
        } : node))
        setSelectedIds([value.viewId])
        setRenameNodeId(value.viewId)
      })
      return localId
    }
    const id = createId(kind)
    const displayMode: NodeDisplayMode = 'standard'
    let opensScopeId: string | undefined
    if (kind === 'context') {
      opensScopeId = createId('scope')
      setScopes((current) => [...current, { id: opensScopeId!, label: '新内容集合', kind: 'collection', parentScopeId: scopeId, containerNodeId: id, camera: { x: 170, y: 100, zoom: 1 } }])
    }
    const next: CanvasNode = { id, kind, title: kind === 'note' ? '新文本' : '新内容集合', subtitle: kind === 'note' ? '直接输入或交给 Agent 整理' : '双击进入子画布', x, y, ...nodeDimensions(kind, displayMode), displayMode, scopeId, opensScopeId, contextOnly: kind === 'context', createdAt: new Date().toISOString(), workspaceIds: workspaceId ? [workspaceId] : [] }
    setNodes((current) => [...current, next]); setSelectedIds([id]); setRenameNodeId(id); return id
  }, [activeProjectId, bootMode, scopeId, setNodes, setSelectedIds, setRenameNodeId, workspaceId])

  const createContentFromDialog = useCallback((kind: 'note' | 'context') => {
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    const width = viewport?.width ?? 960
    const height = viewport?.height ?? 720
    const dimensions = nodeDimensions(kind, 'standard')
    const x = (width / 2 - camera.x) / camera.zoom - dimensions.width / 2
    const y = (height / 2 - camera.y) / camera.zoom - dimensions.height / 2
    createNodeAt(kind, x, y)
    setCreateDialogOpen(false)
    setNotice(kind === 'note' ? '已在画布中央添加文本' : '已创建内容集合与子画布')
  }, [camera, createNodeAt])

  const createNodeFromAnchor = useCallback((kind: 'note' | 'context', x: number, y: number, from: string) => {
    const id = createNodeAt(kind, x, y)
    setEdges((current) => [...current, { id: createId('edge'), from, to: id, kind: 'reference' }])
  }, [createNodeAt, setEdges])

  const createScopeFromSelection = useCallback(({ label, kind }: { label: string; kind: Exclude<ScopeKind, 'root'> }) => {
    if (!selectedIds.length) { setScopeCreateOpen(false); return }
    const bounds = getSelectionBounds(nodes, selectedIds)
    const result = createChildScopeFromSelection(nodes, edges, {
      parentScopeId: scopeId,
      label,
      kind,
      selectedIds,
      containerPosition: { x: (bounds?.x ?? 420) + (bounds?.width ?? 260) + 72, y: bounds?.y ?? 160 },
      createId,
    })
    const nextGraph = {
      nodes: [...nodes, result.container, ...result.views],
      edges: [...edges, ...result.edges],
    }
    setGraph(nextGraph)
    setScopes((current) => [...current, result.scope])
    setScopeCreateOpen(false)
    setScopeId(result.scope.id)
    setCamera(result.scope.camera)
    setSelectedIds(result.views.map((node) => node.id))
    setSelectedEdgeId(null)
    setNodeInfoId(null)
    setLayoutPreview(null)
    setNotice(`已创建子画布「${label}」· ${result.views.length} 个视图 · ${result.edges.length} 条内部关系`)
  }, [edges, nodes, scopeId, selectedIds, setGraph])

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
    const created: CanvasNode[] = files.map((file, index) => {
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      if (previewUrl) objectUrls.current.add(previewUrl)
      const textPreview = isTextPreviewFile(file)
      const fileType = file.type || inferFileType(file.name)
      const runtimeState = bootMode === 'runtime' ? 'importing' : 'temporary'
      return { id: createId('file'), artifactId: createId('artifact'), kind: 'source', title: file.name, subtitle: runtimeState === 'importing' ? 'Importing…' : previewUrl ? '本地图片 · 临时预览' : textPreview ? '本地文本 · 临时预览' : '本地文件 · 等待本地核心服务预览', x: x + index * 28, y: y + index * 28, ...nodeDimensions('source', 'standard'), displayMode: 'standard', fileType, fileSize: file.size, previewUrl, previewDataUrl: previewUrl, previewMimeType: fileType, scopeId, runtimeState, editable: /\.(pptx?|md|docx?|txt)$/i.test(file.name), managed: false, createdAt: new Date().toISOString(), workspaceIds: workspaceId ? [workspaceId] : [] }
    })
    setNodes((current) => [...current, ...created]); setSelectedIds(created.map((node) => node.id)); setNotice(bootMode === 'runtime' ? `正在导入 ${created.length} 个文件到 Project imports…` : `已加入 ${created.length} 个本地文件引用，不上传、不移动原文件`)
    for (const [index, file] of files.entries()) {
      if (!isTextPreviewFile(file)) continue
      const nodeId = created[index]?.id
      if (nodeId === undefined) continue
      file.text().then((text) => {
        setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, previewText: text.slice(0, 64 * 1024) } : node))
      }).catch(() => {
        setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, previewError: 'Local text preview failed.' } : node))
      })
    }
    if (bootMode !== 'runtime') return
    for (const [index, file] of files.entries()) {
      const temporaryNode = created[index]
      if (temporaryNode === undefined) continue
      const importRequestId = `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 10)}`
      bridgeRef.current.importCopy({
        file,
        importRequestId,
        scopeId,
        x: x + index * 28,
        y: y + index * 28,
      }).then((result) => {
        if (result.state === null) {
          setNodes((current) => current.map((node) => node.id === temporaryNode.id ? { ...node, subtitle: 'Import failed', runtimeState: 'failed', error: true, previewError: result.error ?? 'Import Copy failed.' } : node))
          setNotice(`导入失败：${result.error ?? file.name}`)
          return
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
        setNotice(`已导入 ${file.name} 到 Project imports`)
      }).catch((error: unknown) => {
        setNodes((current) => current.map((node) => node.id === temporaryNode.id ? { ...node, subtitle: 'Import failed', runtimeState: 'failed', error: true, previewError: error instanceof Error ? error.message : 'Import Copy failed.' } : node))
      })
    }
  }, [activeProjectId, addViewsToWorkspace, bootMode, resetGraph, scopeId, setNodes, workspaceId])

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

  const refreshResourceStatuses = useCallback(async (): Promise<void> => {
    if (bootMode !== 'runtime') return
    const call = await bridgeRef.current.client.resourceList(activeProjectId)
    if (!call.result.ok) return
    const statusByArtifact = new Map(call.result.value.map((entry) => [entry.artifactId, entry.status]))
    setNodes((current) => current.map((node) => {
      if (node.artifactId === undefined) return node
      const status = statusByArtifact.get(String(node.artifactId))
      if (status === undefined) return node
      const label = status === 'ready' ? '已理解' : status === 'partial' ? '部分理解' : status === 'failed' ? '理解失败' : '理解中'
      if (node.subtitle === label) return node
      return { ...node, subtitle: label }
    }))
  }, [activeProjectId, bootMode, setNodes])

  const handleImportDirectory = useCallback((rootName: string, files: readonly DirectoryEntryInput[], note?: string) => {
    const point = lastCanvasPointRef.current ?? { x: 180, y: 160 }
    void bridgeRef.current.client.importResourceDirectory(activeProjectId, {
      importRequestId: `dir-${Date.now().toString(36)}`,
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
      setNotice(`${rootName} 已导入，正在理解…`)
      await reloadRuntimeProject()
      await refreshResourceStatuses()
    }).catch(() => setNotice('目录导入失败：连接异常'))
  }, [activeProjectId, addViewsToWorkspace, refreshResourceStatuses, reloadRuntimeProject, scopeId, workspaceId])

  const handleImportArchive = useCallback((file: File, note?: string) => {
    const point = lastCanvasPointRef.current ?? { x: 180, y: 160 }
    void bridgeRef.current.client.importResourceArchive(activeProjectId, {
      file,
      importRequestId: `zip-${Date.now().toString(36)}`,
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
      setNotice(`${file.name} 已导入，正在理解…`)
      await reloadRuntimeProject()
      await refreshResourceStatuses()
    }).catch(() => setNotice('压缩包导入失败：连接异常'))
  }, [activeProjectId, addViewsToWorkspace, refreshResourceStatuses, reloadRuntimeProject, scopeId, workspaceId])

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
      await refreshResourceStatuses()
    }).catch(() => setObsidianError('Obsidian 笔记导入暂时中断，原 Vault 没有被修改。'))
      .finally(() => setObsidianBusy(false))
  }, [activeProjectId, addViewsToWorkspace, obsidianScan, refreshResourceStatuses, reloadRuntimeProject, scopeId, workspaceId])

  useEffect(() => {
    if (bootMode !== 'runtime' || !activeProjectId) return
    const timer = window.setInterval(() => { void refreshResourceStatuses() }, 60_000)
    return () => window.clearInterval(timer)
  }, [activeProjectId, bootMode, refreshResourceStatuses])

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
            { id: returnEdgeId, from: current.processNodeId, to: returnedNode.id, kind: 'generate', active: true },
            ...(target === undefined ? [] : [{ id: targetEdgeId, from: target.id, to: returnedNode.id, kind: 'modify' as const }]),
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

  const startRunFrom = useCallback((command: string, targetIds: string[], contextIds: string[], intent: RunOutputIntent = 'revise', requestedProvider = 'auto', resultPolicy: ComposerResultPolicy = intent === 'revise' ? 'draft_revision_per_target' : 'create_artifact', proposalSummary?: string, targetRevisionIdOverride?: string) => {
    if (!command.trim()) return
    const target = nodes.find((node) => node.id === targetIds[0])
    const targetRevisionId = targetRevisionIdOverride ?? target?.revisionId
    if (bootMode === 'runtime') {
      if (intent === 'revise' && (target?.artifactId === undefined || targetRevisionId === undefined)) {
        setNotice('修改 Run 需要已持久化且具有 Current Revision 的目标')
        return
      }
      setNotice('正在冻结 ContextManifest 并创建真实 Run…')
      void bridgeRef.current.client.createRuntimeRun(activeProjectId, {
        instruction: command,
        outputIntent: intent,
        ...(target?.artifactId === undefined ? {} : { targetArtifactId: target.artifactId }),
        ...(targetRevisionId === undefined ? {} : { targetRevisionId }),
        requestedProvider,
        resultPolicy: { type: resultPolicy },
        contextArtifactIds: [...new Set(contextIds
          .map((contextId) => nodes.find((node) => node.id === contextId)?.artifactId)
          .filter((artifactId): artifactId is string => artifactId !== undefined && artifactId !== target?.artifactId))],
        ...(workspaceId === null ? {} : { workspaceId }),
      }).then(async (call) => {
        if (!call.result.ok) {
          setNotice(`Run 创建失败：${call.result.error.message}`)
          return
        }
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
          ...targetIds.map((targetId) => ({ id: createId('edge'), from: targetId, to: processNodeId, kind: 'modify' as const })),
          ...contextIds.map((contextId) => ({ id: createId('edge'), from: contextId, to: processNodeId, kind: 'reference' as const })),
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
          : `真实 Run 已派发：${id}`)
      })
      return
    }
    runCounterRef.current += 1
    const id = `RUN-${String(runCounterRef.current).padStart(3, '0')}`
    const processNodeId = createId('run')
    const dimensions = nodeDimensions('process', 'standard')
    const process: CanvasNode = { id: processNodeId, kind: 'process', title: `${id} · ${command.slice(0, 22)}`, subtitle: '排队中 · 正在冻结上下文', x: target ? target.x + 24 : 460, y: target ? target.y + target.height + 54 : 560, ...dimensions, displayMode: 'standard', scopeId, runStatus: 'queued', commandText: command, parentRunId: id, createdAt: new Date().toISOString(), sourceRunId: id, sourcePrompt: command, sourceProvider: requestedProvider, contextCount: contextIds.length, targetCount: targetIds.length, outputCount: 0 }
    const runEdges = [
      ...targetIds.map((targetId) => ({ id: createId('edge'), from: targetId, to: processNodeId, kind: 'modify' as const })),
      ...contextIds.map((contextId) => ({ id: createId('edge'), from: contextId, to: processNodeId, kind: 'reference' as const })),
    ]
    setGraph((current) => ({ nodes: [...current.nodes, process], edges: [...current.edges, ...runEdges] }))
    setSelectedIds([])
    setNodeInfoId(null)
    setActiveRun({ id, status: 'queued', command, targetIds, contextIds, processNodeId, commandId: createId('command'), contextSnapshotId: createId('context-snapshot'), reviewStatus: 'idle', inputResolved: false, changedFiles: [], createdAt: new Date().toISOString(), baseRevisionId: targetRevisionId, provider: requestedProvider, outputIntent: intent, resultPolicy, proposalSummary })
    setSelectionComposerText('')
    setGlobalComposerText('')
    clearPersistedCommandDrafts()
    setNotice('参考快照、指令和执行记录已自动保存')
  }, [activeProjectId, applyRuntimeReview, bootMode, clearPersistedCommandDrafts, nodes, scopeId, setGraph, workspaceId])

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
    if (!selectedIds.length) {
      setWorkRail((current) => ({ ...current, collapsed: false }))
      setComposerFocusRequest((current) => current + 1)
    }
    queueMicrotask(focusComposer)
    window.requestAnimationFrame(() => {
      if (!focusComposer()) window.requestAnimationFrame(focusComposer)
    })
  }, [selectedIds.length])

  const requestSelectionRun = useCallback(() => {
    const prompt = selectionComposerText.trim()
    if (!prompt) { setNotice('先写一句你希望本地 Agent 完成的工作'); return }
    if (!selectedIds.length) { setNotice('先选择要给 Agent 参考的内容'); return }
    const selectedProviderStatus = selectionProvider === 'auto' ? null : runtimeProviders.find((provider) => provider.provider === selectionProvider)
    if (selectedProviderStatus && !['ready', 'busy'].includes(selectedProviderStatus.availability)) { setNotice(`Agent ${selectionProvider} 当前不能自动执行，换一个再发送`); return }
    if (!selectionCreateAsNewNode && selectionEditableNodes.length > 1) {
      setNotice('有多个内容都可能被修改。请点一下真正要改的内容，或打开“结果作为新节点”。')
      return
    }

    const target = selectionCreateAsNewNode ? null : selectionTargetNode
    const baseRevisionId = target ? (selectionBaseRevision?.id ?? target.revisionId) : undefined
    const requestedIntent = selectionIntent
    const fallbackIntent: RunOutputIntent = selectionCreateAsNewNode ? (requestedIntent === 'revise' ? 'create' : requestedIntent) : requestedIntent === 'create' ? 'create' : target ? 'revise' : 'analyze'
    const fallbackPolicy: ComposerResultPolicy = selectionResultPolicy === 'reply_only' && fallbackIntent !== 'analyze' ? (fallbackIntent === 'create' ? 'create_artifact' : 'draft_revision_per_target') : selectionResultPolicy
    const contextNodes = selectionContextIds
      .filter((id) => id !== target?.id)
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is CanvasNode => Boolean(node?.artifactId && node.revisionId))
    const targetIds = target ? [target.id] : []
    const contextIds = contextNodes.map((node) => node.id)

    if (bootMode !== 'runtime') {
      startRunFrom(prompt, targetIds, contextIds, fallbackIntent, selectionProvider, fallbackPolicy, undefined, baseRevisionId)
      return
    }
    setNotice('Agent 正在理解要求并确认本次操作…')
    void bridgeRef.current.client.proposeRun(activeProjectId, {
      ...(workspaceId ? { workspaceId } : {}),
      prompt,
      requestedProvider: selectionProvider,
      createAsNewNode: selectionCreateAsNewNode,
      contextItems: contextNodes.map((node, order) => ({ artifactId: node.artifactId!, revisionId: node.revisionId!, order })),
      editTargets: target && baseRevisionId ? [{ artifactId: target.artifactId!, baseRevisionId }] : [],
    }).then((call) => {
      if (!call.result.ok) {
        setNotice(`Agent 计划未通过安全校验：${call.result.error.message}`)
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
      )
    })
  }, [activeProjectId, bootMode, nodes, selectionBaseRevision?.id, selectionComposerText, selectionContextIds, selectionCreateAsNewNode, selectionProvider, selectionTargetNode, selectionEditableNodes.length, selectedIds.length, startRunFrom, runtimeProviders, workspaceId])

  const requestGlobalRun = useCallback(() => {
    const prompt = globalComposerText.trim()
    if (!prompt) { setNotice('先写一句要对当前工作空间做什么'); return }
    const selectedProviderStatus = globalProvider === 'auto' ? null : runtimeProviders.find((provider) => provider.provider === globalProvider)
    if (selectedProviderStatus && !['ready', 'busy'].includes(selectedProviderStatus.availability)) { setNotice(`Agent ${globalProvider} 当前不能自动执行，换一个再发送`); return }
    const contextNodes = globalContextIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is CanvasNode => Boolean(node?.artifactId && node.revisionId))
    const contextIds = contextNodes.map((node) => node.id)
    const fallbackIntent: RunOutputIntent = globalCreateAsNewNode ? 'create' : 'analyze'
    const fallbackPolicy: ComposerResultPolicy = globalCreateAsNewNode ? 'create_artifact' : 'reply_only'
    const summary = `${activeWorkspace ? activeWorkspace.label : activeScope.label} · ${contextIds.length} 项参考`
    if (bootMode !== 'runtime') {
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
      if (!call.result.ok) { setNotice(`Agent 计划未通过安全校验：${call.result.error.message}`); return }
      const proposal = call.result.value
      if (proposal.ambiguity) { setNotice(proposal.ambiguity.question); return }
      startRunFrom(proposal.proposal.prompt, [], contextIds, proposal.proposal.intent, proposal.proposal.requestedProvider, proposal.proposal.resultPolicy.type, proposal.summary)
    })
  }, [activeProjectId, activeScope.label, activeWorkspace, bootMode, globalComposerText, globalContextIds, globalCreateAsNewNode, globalProvider, nodes, runtimeProviders, startRunFrom, workspaceId])

  const returnArtifact = useCallback((run: ActiveRun) => {
    const target = nodes.find((node) => node.id === run.targetIds[0])
    if (!target) return
    const id = createId('generated')
    const dimensions = nodeDimensions('generated', 'standard')
    const position = findPendingReturnPosition(nodes, target, dimensions)
    const generated: CanvasNode = { id, artifactId: target.artifactId ?? createId('artifact'), revisionId: createId('revision'), followsCurrentRevision: false, kind: 'generated', title: `Thinker_Concept_${run.id}_AI.pptx`, subtitle: '结果待回收 · 等待确认', ...position, ...dimensions, displayMode: 'standard', draft: true, pageCount: target.pageCount ?? 18, scopeId: target.scopeId ?? scopeId, editable: true, parentRunId: run.id, revisionOf: target.revisionId ?? target.id, resultGroupId: run.id, createdAt: new Date().toISOString(), sourceRunId: run.id, sourcePrompt: run.command, sourceProvider: run.provider, managed: true, workspaceIds: target.workspaceIds }
    setGraph((current) => ({ nodes: [...current.nodes, generated], edges: [...current.edges, { id: createId('edge'), from: run.processNodeId, to: id, kind: 'generate', active: true }, { id: createId('edge'), from: target.id, to: id, kind: 'modify' }] }))
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
    setNotice('正在更新 Agent 任务状态…')
    void bridgeRef.current.client.syncRuntimeRun(activeRun.id).then((call) => {
      if (!call.result.ok) {
        setNotice(`同步失败：${call.result.error.message}`)
        return
      }
      applyRuntimeReview(call.result.value.review, activeRun, call.result.value.providerError?.message)
      setNotice(call.result.value.review.presentationPhase === 'review'
        ? '结果已摄取为 Draft，等待你的决定'
        : call.result.value.providerError?.message ?? `状态：${call.result.value.review.presentationPhase}`)
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
        setNotice('Runtime Return 身份不完整，不能 Accept')
        return
      }
      setNotice('正在以 CAS 接受 Draft Revision…')
      void bridgeRef.current.client.acceptArtifactReturn(activeRun.runtimeReturnId, {
        expectedBaseRevisionId: activeRun.baseRevisionId as never,
      }).then(async (call) => {
        if (!call.result.ok) {
          setNotice(`Accept 失败：${call.result.error.message}`)
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
    setActiveRun((run) => run ? { ...run, status: 'completed', reviewStatus: 'accepted' } : run)
    setNotice('已接受为当前版本，相关视图已同步')
  }, [activeRun, applyReloadedRuntimeState, pendingNode, setGraph])

  const rejectRun = useCallback(() => {
    if (!activeRun?.runtime || activeRun.runtimeReturnId === undefined) {
      setNotice('当前没有可拒绝的 Runtime Return')
      return
    }
    setNotice('正在拒绝此 Draft…')
    void bridgeRef.current.client.rejectArtifactReturn(activeRun.runtimeReturnId).then(async (call) => {
      if (!call.result.ok) {
        setNotice(`Reject 失败：${call.result.error.message}`)
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
      setNotice('正在创建 Retry Run…')
      void bridgeRef.current.client.retryArtifactReturn(activeRun.runtimeReturnId, {
        // 重新执行 = 用原指令重跑；输入框里的新文本属于“补充修改要求”。
        instruction: activeRun.command,
      }).then(async (retryCall) => {
        if (!retryCall.result.ok) {
          setNotice(`Retry 失败：${retryCall.result.error.message}`)
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
          setNotice(`Retry 已保存，但派发失败：${dispatchCall.result.error.message}`)
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
            ? `Retry Run 已派发：${String(newRun.id)}`
            : `Retry Run 已派发；旧 Bridge Review 待恢复：${String(newRun.id)}`))
      })
      return
    }
    startRunFrom(activeRun.command.replace(/（已确认.*?）/, ''), activeRun.targetIds, activeRun.contextIds, activeRun.outputIntent ?? 'revise', activeRun.provider ?? 'auto', activeRun.resultPolicy ?? 'draft_revision_per_target', activeRun.proposalSummary, activeRun.baseRevisionId)
    setNotice('已沿用原指令与上下文重新执行')
  }, [activeRun, applyRuntimeReview, globalComposerText, selectionComposerText, setGraph, startRunFrom])

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
  const openNative = useCallback((node: CanvasNode) => setNotice(`将由本地核心服务打开 ${node.title}`), [])

  const openHandoff = useCallback(async () => {
    if (dataSource !== 'runtime') {
      setNotice('Handoff 只从 Runtime Project Truth 构建')
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
    setNotice('Context Manifest Markdown 已复制')
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

  const handleDoubleClick = useCallback((id: string) => {
    setSelectionComposerOpen(false)
    const node = nodes.find((item) => item.id === id)
    if (!node) return
    selectNode(id)
    if (node.opensScopeId) {
      enterScope(node.opensScopeId)
      return
    }
    const viewerKind = resolveArtifactViewerKind(node)
    if (viewerKind === 'link') {
      const url = node.previewText?.match(/^url:\s*(https?:\/\/\S+)/mi)?.[1]
      if (url) { window.open(url, '_blank', 'noopener,noreferrer'); return }
    }
    if (['image', 'pdf', 'presentation', 'audio', 'video'].includes(viewerKind)) {
      setNodeInfoId(null)
      setWorkbench(null)
      setImmersiveNodeId(id)
      return
    }
    if (canPreviewArtifact(node) || node.artifactId !== undefined) {
      setNodeInfoId(null)
      setWorkbench({ nodeId: id, focus: 'preview' })
    }
  }, [enterScope, nodes, selectNode])

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
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isText = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable
      const modifier = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      const activeElement = document.activeElement as HTMLElement | null
      const canvasActive = Boolean(activeElement?.closest('[data-testid="canvas"]')) && !document.querySelector('[role="dialog"][aria-modal="true"]')
      if (createDialogOpen || scopeCreateOpen || projectCreateOpen) return
      if (modifier && event.key === 'Enter') {
        event.preventDefault()
        selectedIds.length ? requestSelectionRun() : requestGlobalRun()
        return
      }
      if (isText) return
      if (modifier && key === 'a' && canvasActive) {
        event.preventDefault()
        setSelectionComposerOpen(false)
        selectMarquee(visibleNodes.map((node) => node.id), false)
        return
      }
      if (modifier && key === 'c') { event.preventDefault(); copySelection(); return }
      if (modifier && key === 'v') { event.preventDefault(); pasteClipboard(); return }
      if (modifier && key === 'd') { event.preventDefault(); duplicateSelection(); return }
      if (modifier && key === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return }
      if (modifier && key === 'y') { event.preventDefault(); redo(); return }
      if (modifier && event.shiftKey && key === 'l') { event.preventDefault(); arrangeSelection(); return }
      if (modifier && key === 'o' && selectedNodes.length === 1) { event.preventDefault(); openNative(selectedNodes[0]); return }
      if (event.code === 'Space') { event.preventDefault(); setSpaceHeld(true); return }
      if (event.key === 'Escape') { if (confirmProjectDelete) setConfirmProjectDelete(null); else if (confirmWorkspaceId) setConfirmWorkspaceId(null); else if (stagedTransfer) setStagedTransfer(null); else if (immersiveNodeId) setImmersiveNodeId(null); else if (workbench) setWorkbench(null); else if (capabilityOpen) setCapabilityOpen(false); else if (nodeInfoId) setNodeInfoId(null); else if (layoutPreview) setLayoutPreview(null); else clearSelection(); return }
      if (key === 'c') { event.preventDefault(); requestComposerFocus(); return }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedIds.length) { deleteNodes(selectedIds); return }
        if (selectedEdgeId) { setEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId)); setSelectedEdgeId(null); setNotice('关系已删除') }
      }
    }
    const release = (event: KeyboardEvent) => { if (event.code === 'Space') setSpaceHeld(false) }
    window.addEventListener('keydown', handler); window.addEventListener('keyup', release)
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('keyup', release) }
  }, [arrangeSelection, clearSelection, confirmProjectDelete, confirmWorkspaceId, copySelection, createDialogOpen, deleteNodes, duplicateSelection, capabilityOpen, immersiveNodeId, nodeInfoId, workbench, layoutPreview, openNative, pasteClipboard, projectCreateOpen, redo, requestComposerFocus, requestGlobalRun, requestSelectionRun, scopeCreateOpen, selectMarquee, selectedEdgeId, selectedId, selectedIds, selectedNodes, setEdges, stagedTransfer, undo, visibleNodes])


  const refreshProjectCatalog = useCallback(() => {
    void bridgeRef.current.loadCatalog().then((catalog) => {
      if (catalog.source !== 'runtime') {
        setNotice('项目列表暂时无法刷新，请重新启动 LCOS 后再试。')
        return
      }
      setProjects([...catalog.projects])
      saveProjectCatalog([...catalog.projects])
      setProjectOpen(false)
    })
  }, [])

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

  const contextSurfaceRuntime = useMemo<ContextSurfaceRuntime>(() => ({
    // Project-level ContextSnapshot / Handoff records remain queryable in Core,
    // but the user-facing Context history belongs to one imported conversation.
    // Do not project the whole project's history into a generic Context surface.
    history: [],
    handoffs: [],
    onBranchHistory: branchContextHistoryToWorkbench,
    onCompareHistory: compareContextHistory,
    onOpenHistorySource: openContextHistorySource,
  }), [branchContextHistoryToWorkbench, compareContextHistory, openContextHistorySource])
  const openCurrentRunReview = useCallback(() => {
    const review = pendingReviews[0]
    if (review) { openRunReview(review); return }
    if (activeRun) { setSelectedIds([activeRun.processNodeId]); setWorkRail((current) => ({ ...current, collapsed: false })); setNotice(`Run ${activeRun.id} · ${runStatusLabel[activeRun.status]}`); return }
    setNotice('当前没有待 Review 的 Run')
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

  const editorWorkspace = workspaceEditor?.id ? workspaces.find((workspace) => workspace.id === workspaceEditor.id) : undefined
  const nodeToRename = renameNodeId ? nodes.find((node) => node.id === renameNodeId) : undefined
  const scopePath = buildScopePath(scopes, activeScope)
  return <AppShellView
    layoutDensity={layoutDensity}
    layoutMode={layoutMode}
    layoutStyle={sceneStyle}
    notice={notice}
    drive={{
      open: !projectOpen,
      projects,
      openProjectIds,
      onOpen: openProject,
      onCreate: () => setProjectCreateOpen(true),
      onDelete: requestDeleteProject,
      onImportLcosproj: importLcosprojFile,
    }}
    strip={{
      projectLabel: activeProject.label,
      scopeLabel: activeScope.label,
      saveStatus,
      runStatus: activeRun?.status ?? null,
      showWorkRailActions: layoutMode === 'desktop',
      onOpenProjectDrive: () => setProjectOpen(false),
      onImport: () => setImportPanelOpen(true),
      onSearch: () => setProjectToolsMode('search'),
      onGlobalChat: () => { if (agentMode) setNotice('Agent Browser 模式下请直接使用宿主 Agent 对话框'); else setWorkRail((current) => ({ ...current, collapsed: false })) },
      pendingCount: pendingReviews.length,
      onPending: () => { setWorkRail((current) => ({ ...current, collapsed: false })); if (pendingReviews[0]) openRunReview(pendingReviews[0]); setNotice(pendingReviews.length ? `${pendingReviews.length} 项待确认，已在右侧执行列表中定位` : '当前没有待确认的返回结果') },
      onHistory: () => { setConversationDialogOpen(true); setNotice('打开已导入对话；历史导航只属于每条对话本身') },
      onMore: () => setCapabilityOpen((value) => !value),
    }}
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
        onOpenComposer: () => { setCapabilityOpen(false); requestComposerFocus() },
        onSelectNode: (id) => { selectNode(id); setCapabilityOpen(false) },
      } : null,
      workspaceRail: {
        workspaces: scopeWorkspaces,
        activeId: workspaceId,
        runStatus: activeRun?.status ?? null,
        onOverview: activateOverview,
        onActivate: changeWorkspace,
        onLocate: locateWorkspace,
        onAdd: () => setWorkspaceEditor({ mode: 'create' }),
        onEdit: (id) => setWorkspaceEditor({ mode: 'edit', id }),
        onDuplicate: duplicateWorkspace,
        onDelete: deleteWorkspace,
        onMove: moveWorkspace,
        onSaveState: saveCurrentWorkspaceState,
        onOpenStates: openWorkspaceStates,
      },
      surface: activeSurface,
      canvas: {
        nodes: visibleNodes,
        setNodes,
        edges: visibleEdges,
        setEdges,
        camera,
        setCamera,
        selectedId,
        selectedIds,
        selectedEdgeId,
        setSelectedEdgeId,
        pendingId: activeRun?.pendingArtifactId ?? null,
        runId: activeRun?.id ?? 'RUN-043',
        runStatus: activeRun?.status ?? null,
        spaceHeld,
        locked: createDialogOpen || scopeCreateOpen,
        layoutPreview,
        workspaceFrames: activeWorkspaceFrames,
        workspaceMemberNodes: scopeNodes,
        activeWorkspaceId: workspaceId,
        onWorkspaceActivate: changeWorkspace,
        onPresentationInteractionChange: handlePresentationInteractionChange,
        onPresentationCommit: handlePresentationCommit,
        onFrameBoundsChange: handleFrameBoundsChange,
        selectionComposer: selectedIds.length && selectionComposerOpen ? {
          contextIds: selectionContextIds,
          prompt: selectionComposerText,
          provider: selectionProvider,
          createAsNewNode: selectionCreateAsNewNode,
          intent: selectionIntent,
          resultPolicy: selectionResultPolicy,
          ...(selectionBaseRevision ? { baseRevision: selectionBaseRevision } : {}),
          providers: runtimeProviders,
          activeWorkspace,
          workspaces: scopeWorkspaces,
          busy: runBusy,
          ...(runProposal?.summary ? { proposalSummary: runProposal.summary } : {}),
          ...(runProposal?.ambiguity?.question ? { ambiguityQuestion: runProposal.ambiguity.question } : {}),
          onPromptChange: setSelectionComposerText,
          onProviderChange: setSelectionProvider,
          onCreateAsNewNodeChange: (value) => { setSelectionCreateAsNewNode(value); if (value) { setSelectionIntent('create'); setSelectionResultPolicy('create_artifact') } setSelectionBaseRevision(null) },
          onIntentChange: (intent) => { setSelectionIntent(intent); setSelectionCreateAsNewNode(intent === 'create'); setSelectionResultPolicy(intent === 'create' ? 'create_artifact' : intent === 'revise' ? 'draft_revision_per_target' : 'reply_only'); if (intent !== 'revise') setSelectionBaseRevision(null) },
          onResultPolicyChange: setSelectionResultPolicy,
          onToggleContext: toggleContext,
          onSend: requestSelectionRun,
          onAddToWorkspace: addSelectionToActiveWorkspace,
          onRemoveFromWorkspace: removeSelectionFromActiveWorkspace,
          onMoveToWorkspace: moveSelectionToWorkspace,
          onClose: clearSelection,
        } : undefined,
        onSelect: selectNode,
        onClearSelection: clearSelection,
        onMarqueeSelect: selectMarquee,
        onSelectEdge: selectEdge,
        onDoubleClick: handleDoubleClick,
        onDetails: showNodeDetails,
        onRequestAi: requestComposerFocus,
        onCreateNodeFromAnchor: createNodeFromAnchor,
        onFilesDropped: dropFiles,
        onArrangeSelection: arrangeSelection,
        onCopySelection: copySelectedViews,
        onDuplicateSelection: duplicateSelectedViews,
        onCreateScopeFromSelection: () => selectedIds.length ? setScopeCreateOpen(true) : setNotice('先选择要整理进子画布的对象'),
        onDeleteSelection: deleteSelectedViews,
        onPointerWorldChange: rememberCanvasPoint,
        onSpaceCreate: (point) => { lastCanvasPointRef.current = point; setCreateDialogOpen(true) },
        onStageTransfer: stageTransfer,
      },
      projection: {
        projectId: activeProjectId,
        scopeId,
        surface: activeSurface as Exclude<SurfaceId, 'arrange'>,
        nodes: visibleNodes,
        edges: visibleEdges,
        selectedIds,
        contextRuntime: contextSurfaceRuntime,
        workRuntime: workSurfaceRuntime,
        deliverRuntime: deliverSurfaceRuntime,
        onSelect: selectNode,
        onDoubleClick: handleDoubleClick,
      },
      composer: activeSurface !== 'arrange' && selectedIds.length > 0 && selectionComposerOpen ? {
        nodes,
        selectedIds,
        prompt: selectionComposerText,
        intent: selectionIntent,
        provider: selectionProvider,
        resultPolicy: selectionResultPolicy,
        providers: runtimeProviders,
        busy: runBusy,
        onPrompt: setSelectionComposerText,
        onIntent: (intent) => { setSelectionIntent(intent); setSelectionCreateAsNewNode(intent === 'create'); setSelectionResultPolicy(intent === 'create' ? 'create_artifact' : intent === 'revise' ? 'draft_revision_per_target' : 'reply_only') },
        onProvider: setSelectionProvider,
        onResult: setSelectionResultPolicy,
        onSend: requestSelectionRun,
      } : null,
      surfaceDock: {
        surface: activeSurface,
        scopePath,
        activeScopeId: scopeId,
        workbenchScopeId: workbenchScope?.id ?? workbenchScopeId,
        workbenchCount: nodes.filter((node) => (node.scopeId ?? rootScope.id) === workbenchScopeId).length,
        zoom: camera.zoom,
        onZoomBy: (factor) => setCamera((current) => ({ ...current, zoom: Math.min(4, Math.max(MIN_CANVAS_ZOOM, current.zoom * factor)) })),
        onZoomReset: () => setCamera((current) => ({ ...current, zoom: 1 })),
        onSurface: setActiveSurface,
        onScope: enterScope,
        onWorkbench: openCurrentWorkbench,
        onMergeWorkbench: mergeWorkbenchViews,
      },
      dropShelf: {
        open: Boolean(stagedTransfer),
        anchor: stagedTransfer?.anchor ?? 'left',
        count: stagedTransfer?.ids.length ?? 0,
        workspaces: scopeWorkspaces,
        scopes,
        rootScopeId: rootScope.id,
        currentScopeId: scopeId,
        excludedScopeIds: [workbenchScopeId],
        onCancel: cancelTransfer,
        onSend: handleTransfer,
      },
      miniMap: {
        nodes: visibleNodes,
        workspaceFrames: activeWorkspaceFrames,
        camera,
        setCamera,
        collapsed: miniMapCollapsed,
        onCollapsedChange: setMiniMapCollapsed,
        safeInsets,
        onLocateContent: locateAndPreviewIslands,
      },
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
        onCancel: () => setLayoutPreview(null),
      } : null,
      notice,
      nodeInfo: nodeInfoNode ? {
        node: nodeInfoNode,
        camera,
        relationCount: nodeInfoRelationCount,
        onClose: () => setNodeInfoId(null),
        onRelations: () => { selectNode(nodeInfoNode.id); setNodeInfoId(null); setNotice(`${nodeInfoRelationCount} 个关联已在画布中高亮`) },
        onPreview: (node) => { setNodeInfoId(null); setWorkbench({ nodeId: node.id, focus: 'preview' }) },
        onShowResource: (node) => { setNodeInfoId(null); setResourceDetailArtifactId(String(node.artifactId)) },
        onRevisions: (node) => { setNodeInfoId(null); setWorkbench({ nodeId: node.id, focus: 'revisions' }) },
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
        onAcceptProposal: (proposalId) => resolveContextProposal(proposalId, 'accept'),
        onRejectProposal: (proposalId) => resolveContextProposal(proposalId, 'reject'),
        onRefresh: refreshActiveContext,
        onToggleDetails: () => setAgentSurfaceDetailsOpen((current) => !current),
        onOpenReview: openRunReview,
      } : null,
    }}
    rail={{
      workspace: effectiveWorkspace,
      nodes,
      activeRun,
      pendingNode,
      collapsed: workRail.collapsed,
      width: effectiveRailWidth,
      contextLabel: globalContextLabel,
      contextCount: globalContextIds.length,
      contextScope: globalContextScope,
      onContextScope: setGlobalContextScope,
      composerText: globalComposerText,
      composerRef,
      composerFocusRequest,
      provider: globalProvider,
      createAsNewNode: globalCreateAsNewNode,
      providers: runtimeProviders,
      onRequestComposerFocus: requestComposerFocus,
      onCollapse: () => setWorkRail((current) => ({ ...current, collapsed: true })),
      onExpand: () => setWorkRail((current) => ({ ...current, collapsed: false })),
      onComposerChange: setGlobalComposerText,
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
      onShowRun: clearSelection,
    }}
    dialogs={{
      projectCreate: {
        open: projectCreateOpen,
        onCancel: () => setProjectCreateOpen(false),
        onBrowseDirectory: browseProjectDirectory,
        onInspectDirectory: inspectProjectDirectory,
        onCreate: createProject,
      },
      projectTools: projectToolsMode ? {
        open: true,
        searchOnly: projectToolsMode === 'search',
        project: activeProject,
        projects,
        client: bridgeRef.current.client,
        onClose: () => setProjectToolsMode(null),
        onProjectOpened: refreshProjectCatalog,
        onSelectArtifact: selectArtifactFromTools,
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
      workspaceEditor: workspaceEditor ? {
        mode: workspaceEditor.mode,
        workspace: editorWorkspace,
        currentCamera: camera,
        onCancel: () => setWorkspaceEditor(null),
        onSave: saveWorkspaceEditor,
      } : null,
      nodeRename: nodeToRename ? {
        node: nodeToRename,
        camera,
        onCancel: () => setRenameNodeId(null),
        onSave: (value) => renameNodeTitle(nodeToRename.id, value),
      } : null,
      confirmWorkspaceDelete: confirmWorkspaceId ? {
        title: '删除这个工作空间？',
        description: '只删除工作空间定义，不删除内容、节点、本地文件或 Camera。',
        onCancel: () => setConfirmWorkspaceId(null),
        onConfirm: confirmDeleteWorkspace,
      } : null,
      confirmProjectDelete: confirmProjectDelete ? {
        title: `从 LCOS 移除「${confirmProjectDelete.label}」？`,
        description: '项目会从项目列表移除；磁盘上的源文件和 .lcosproj 工程文件都会保留，之后仍可重新打开。',
        onCancel: () => setConfirmProjectDelete(null),
        onConfirm: confirmDeleteProject,
      } : null,
      handoff: handoffOpen ? {
        open: handoffOpen,
        loading: handoffLoading,
        manifest: handoffManifest,
        error: handoffError,
        onClose: () => setHandoffOpen(false),
        onCopy: () => { void copyHandoff() },
        onDownload: downloadHandoff,
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
        onChanged: () => { void refreshResourceStatuses() },
      } : null,
      extraDialogs: workspaceStatesOpen && workspaceStatesWorkspaceId ? (() => {
        const stateWorkspace = workspaces.find((workspace) => workspace.id === workspaceStatesWorkspaceId)
        return stateWorkspace ? <WorkspaceStatesDialog workspace={stateWorkspace} states={workspaceStates} loading={workspaceStatesLoading} saving={workspaceStateSaving} restoringId={workspaceStateRestoringId} error={workspaceStatesError} onClose={() => setWorkspaceStatesOpen(false)} onRefresh={() => loadWorkspaceStates(workspaceStatesWorkspaceId)} onSave={(name) => saveCurrentWorkspaceState(workspaceStatesWorkspaceId, name)} onRestore={restoreSavedWorkspaceState} /> : null
      })() : null,
    }}
    immersive={immersiveNodeId ? (() => {
      const immersiveNode = nodes.find((node) => node.id === immersiveNodeId)
      return immersiveNode ? { node: immersiveNode, projectId: activeProjectId, onClose: () => setImmersiveNodeId(null) } : null
    })() : null}
  />
}
