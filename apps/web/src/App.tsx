import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Check, Command, Play } from 'lucide-react'
import type { ContextManifestV0, RunReview } from '@local-creative-os/contracts'
import { makePerformanceFixture } from './qa-fixtures/fixtures'
import type { ActiveRun, Camera, CanvasNode, CanvasScope, NodeDisplayMode, NodeLayer, PersistedPrototypeState, ProjectPackage, ScopeKind, TargetContextInference, WorkRailPreferences, Workspace, WorkspaceIntent } from './model'
import { nodeMeta, runStatusLabel } from './model'
import { ProjectCanvas } from './features/canvas/ProjectCanvas'
import { CanvasMiniMap } from './features/canvas/CanvasMiniMap'
import { WorkRail } from './features/workrail/WorkRail'
import { ProjectDrive } from './features/project/ProjectDrive'
import { WorkspaceDock } from './features/workspace/WorkspaceDock'
import { WorkspaceDialog } from './features/workspace/WorkspaceDialog'
import { ConfirmDialog } from './features/ui/ConfirmDialog'
import { InlineNodeRename } from './features/ui/InlineNodeRename'
import { CreateContentDialog } from './features/create/CreateContentDialog'
import { RunConfirmDialog } from './features/create/RunConfirmDialog'
import { ScopeCreateDialog } from './features/create/ScopeCreateDialog'
import { ProjectCreateDialog } from './features/create/ProjectCreateDialog'
import { HandoffDialog } from './features/handoff/HandoffDialog'
import { V07TopBar } from './features/shell/V07TopBar'
import { CapabilityPopover } from './features/shell/CapabilityPopover'
import { NodeInfoPopover } from './features/canvas/NodeInfoPopover'
import { LinkReferenceDialog } from './features/create/LinkReferenceDialog'
import { UniversalImportPanel, type DirectoryEntryInput } from './features/resources/UniversalImportPanel'
import { ResourceDetailDialog } from './features/resources/ResourceDetailDialog'
import { capabilitiesFor, type LinkReferenceInput } from './runtime/v07UiContracts'
import { clearPrototypeState, loadProjectCatalog, loadPrototypeState, saveProjectCatalog, savePrototypeState } from './state/prototypeStorage'
import { clearProjectNavigationState, loadProjectNavigationState, saveProjectNavigationState } from './state/projectNavigation'
import { buildWorkspaceFrames } from './state/workspaceFrames'
import { RuntimeBridge, type DataSource, type SaveStatus } from './runtime/runtimeBridge'
import { selectRuntimeProject } from './runtime/runtimeProjectSelection'
import { createWorkspaceRecord, duplicateWorkspaceRecord, moveWorkspaceRecord, removeWorkspaceRecord, toggleWorkspaceLayer, updateWorkspaceRecord } from './state/workspaceState'
import { fitBounds, getSelectionBounds, nodeDimensions, revealNode } from './features/canvas/canvasGeometry'
import { findPendingReturnPosition } from './features/canvas/canvasLayout'
import { applyScopeLayout, proposeScopeLayout, type LayoutPreviewItem } from './features/canvas/scopeLayout'
import { arrangeSelectedNodes } from './features/canvas/selectionLayout'
import { copyCanvasSelection, pasteCanvasNodes, pasteRelationTemplate, type CanvasClipboardPayload } from './state/canvasClipboard'
import { useCanvasHistory } from './state/useCanvasHistory'
import { inferTargetContext, moveBetweenTargetAndContext, setPrimaryTarget } from './state/workContext'
import { defaultProjectCatalog, fixtureStateForProject } from './qa-fixtures/projectFixtures'
import { createChildScopeFromSelection, removeScopeTree } from './state/canvasScopes'
import type { ActiveContextProjection } from './runtime/localCoreClient'

const MVP_SAMPLE_PROJECT_ID = 'disposable-mvp-sample'
const DEFAULT_PROJECT_ID = MVP_SAMPLE_PROJECT_ID

function defaultRailWidth(viewport = typeof window === 'undefined' ? 1440 : window.innerWidth): number {
  if (viewport >= 1600) return 390
  if (viewport >= 1440) return 350
  return 312
}


function normalizeRailPreferences(value: WorkRailPreferences): WorkRailPreferences {
  return { ...value, collapsed: true, width: 312 }
}

function initialPrototype(projectId: string, performanceFixture: ReturnType<typeof makePerformanceFixture> | null): PersistedPrototypeState {
  if (!performanceFixture) {
    const persisted = loadPrototypeState(projectId)
    if (persisted) return persisted
  }
  const fixture = fixtureStateForProject(projectId, defaultRailWidth())
  return performanceFixture
    ? { ...fixture, nodes: performanceFixture.nodes, edges: performanceFixture.edges }
    : fixture
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function runtimePresentationStatus(review: RunReview): ActiveRun['status'] {
  if (review.dispatch.status === 'recovery_required' || review.dispatch.status === 'failed') return 'failed'
  if (review.presentationPhase === 'created' || review.presentationPhase === 'queued') return 'queued'
  if (review.presentationPhase === 'cancelled') return 'failed'
  return review.presentationPhase
}

function fileNameFromPath(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path
}

export function App() {
  const launchSearchParams = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search)
  const agentMode = launchSearchParams?.get('agent') === '1'
  const qaSearchParams = typeof window === 'undefined' || !import.meta.env.DEV ? null : new URLSearchParams(window.location.search)
  const queryState = qaSearchParams?.get('state') ?? ''
  const perfCount = Number(qaSearchParams?.get('perf') ?? 0)
  const performanceFixture = perfCount >= 80 ? makePerformanceFixture(Math.min(300, perfCount)) : null
  const requestedProjectId = launchSearchParams?.get('project')
  const initialProjectId = requestedProjectId || DEFAULT_PROJECT_ID
  const initial = useMemo(() => initialPrototype(initialProjectId, performanceFixture), [performanceFixture])
  const { nodes, edges, setNodes, setEdges, setGraph, undo, redo, resetGraph } = useCanvasHistory({ nodes: initial.nodes, edges: initial.edges })

  const [projects, setProjects] = useState<ProjectPackage[]>(() => loadProjectCatalog(defaultProjectCatalog()))
  const [activeProjectId, setActiveProjectId] = useState(initialProjectId)
  const [openProjectIds, setOpenProjectIds] = useState<string[]>([initialProjectId])
  const [projectOpen, setProjectOpen] = useState(queryState !== 'drive')
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initial.workspaces)
  const [scopes, setScopes] = useState<CanvasScope[]>(initial.scopes)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [scopeId, setScopeId] = useState(initial.scopes.find((scope) => scope.kind === 'root')?.id ?? initial.activeScopeId)
  const [camera, setCamera] = useState<Camera>(() => loadProjectNavigationState(initialProjectId)?.camera ?? initial.scopes.find((scope) => scope.kind === 'root')?.camera ?? { x: 120, y: 72, zoom: 1 })
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [nodeInfoId, setNodeInfoId] = useState<string | null>(null)
  const [pinnedContextIds, setPinnedContextIds] = useState<string[]>(['brief', 'feedback', 'reference'])
  const [excludedContextIds, setExcludedContextIds] = useState<string[]>([])
  const [manualInference, setManualInference] = useState<TargetContextInference | null>(null)
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null)
  const [checkpoint, setCheckpoint] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [notice, setNotice] = useState('已恢复上次工作现场')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [dataSource, setDataSource] = useState<DataSource>('none')
  const [bootMode, setBootMode] = useState<'loading' | 'runtime' | 'offline'>('loading')
  const [workRail, setWorkRail] = useState<WorkRailPreferences>(() => normalizeRailPreferences(initial.workRail))
  const [dockCollapsed, setDockCollapsed] = useState(true)
  const [miniMapCollapsed, setMiniMapCollapsed] = useState(false)
  const [composerText, setComposerText] = useState(() => queryState === 'confirm' ? '根据第二轮客户反馈调整构图，拉开产品与雕像距离，优化人物比例，保留 0–6 秒缓慢拉镜和三句字幕。' : '')
  const [confirmWorkspaceId, setConfirmWorkspaceId] = useState<string | null>(null)
  const [workspaceEditor, setWorkspaceEditor] = useState<{ mode: 'create' | 'edit'; id?: string } | null>(null)
  const [renameNodeId, setRenameNodeId] = useState<string | null>(null)
  const [layoutPreview, setLayoutPreview] = useState<LayoutPreviewItem[] | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [runConfirmOpen, setRunConfirmOpen] = useState(false)
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
  const [resourceDetailArtifactId, setResourceDetailArtifactId] = useState<string | null>(null)
  const [activeContextProjection, setActiveContextProjection] = useState<ActiveContextProjection | null>(null)
  const [activeContextError, setActiveContextError] = useState<string | null>(null)

  const objectUrls = useRef<Set<string>>(new Set())
  const clipboardRef = useRef<CanvasClipboardPayload | null>(null)
  const lastCanvasPointRef = useRef<{ x: number; y: number } | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const runCounterRef = useRef(43)
  const runConfirmFrameRef = useRef<number | null>(null)
  const seededStateRef = useRef(false)
  const projectStateCacheRef = useRef<Map<string, PersistedPrototypeState>>(new Map([[initialProjectId, initial]]))
  const bridgeRef = useRef(new RuntimeBridge(initialProjectId))
  const presentationInteractionRef = useRef(false)
  const cameraRef = useRef(camera)
  const activeProjectIdRef = useRef(activeProjectId)
  const restoredRunProjectRef = useRef<string | null>(null)
  const runtimeSyncBusyRef = useRef(false)

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0]
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
  const nodeInfoNode = nodeInfoId ? nodes.find((node) => node.id === nodeInfoId) ?? null : null
  const visibleLayers: NodeLayer[] = activeWorkspace ? (activeWorkspace.visibleLayers.length ? activeWorkspace.visibleLayers : ['core', 'process']) : overviewLayers
  const scopeNodes = useMemo(() => nodes.filter((node) => (node.scopeId ?? 'scope-root') === scopeId), [nodes, scopeId])
  const scopeWorkspaces = useMemo(() => workspaces.filter((workspace) => workspace.scopeId === scopeId), [scopeId, workspaces])
  const visibleNodes = useMemo(() => scopeNodes.filter((node) => visibleLayers.includes(nodeMeta[node.kind].layer)), [scopeNodes, visibleLayers])
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes])
  const visibleEdges = useMemo(() => edges.filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)), [edges, visibleNodeIds])
  const workspaceFrames = useMemo(() => buildWorkspaceFrames(workspaces, scopeNodes, workspaceId, scopeId), [scopeId, scopeNodes, workspaceId, workspaces])
  const activeWorkspaceFrames = useMemo(() => workspaceId ? workspaceFrames.filter((frame) => frame.workspaceId === workspaceId) : [], [workspaceFrames, workspaceId])
  const relationNodes = useMemo(() => selectedId ? edges.filter((edge) => edge.from === selectedId || edge.to === selectedId).map((edge) => nodes.find((node) => node.id === (edge.from === selectedId ? edge.to : edge.from))).filter((node): node is CanvasNode => Boolean(node)) : [], [edges, nodes, selectedId])
  const nodeInfoRelationCount = useMemo(() => nodeInfoId ? edges.filter((edge) => edge.from === nodeInfoId || edge.to === nodeInfoId).length : 0, [edges, nodeInfoId])
  const capabilities = useMemo(() => capabilitiesFor(dataSource), [dataSource])

  const baseInference = useMemo(() => inferTargetContext(nodes, selectedIds, effectiveWorkspace, scopeId, pinnedContextIds), [effectiveWorkspace, nodes, pinnedContextIds, scopeId, selectedIds])
  const inference = useMemo(() => {
    const current = manualInference ?? baseInference
    return { ...current, contextIds: current.contextIds.filter((id) => !excludedContextIds.includes(id)) }
  }, [baseInference, excludedContextIds, manualInference])
  const pendingNode = activeRun?.pendingArtifactId ? nodes.find((node) => node.id === activeRun.pendingArtifactId) ?? null : null
  const compareExpanded = activeRun?.status === 'review' && Boolean(pendingNode)
  const effectiveRailWidth = workRail.collapsed ? 48 : compareExpanded ? Math.min(520, Math.max(460, typeof window === 'undefined' ? 480 : window.innerWidth * .34)) : 312
  const sceneStyle = useMemo(() => ({ '--work-rail-width': `${effectiveRailWidth}px` } as CSSProperties), [effectiveRailWidth])
  const safeInsets = useMemo(() => ({
    left: dockCollapsed ? 66 : 204,
    right: 28,
    top: 58,
    bottom: miniMapCollapsed ? 72 : 164,
  }), [dockCollapsed, miniMapCollapsed])

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
    if (runConfirmFrameRef.current !== null) window.cancelAnimationFrame(runConfirmFrameRef.current)
  }, [])
  useEffect(() => { setManualInference(null) }, [scopeId, selectedIds.join(',')])

  useEffect(() => {
    if (bootMode !== 'runtime') return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      void bridgeRef.current.client.updateActiveContext(activeProjectId, {
        ...(workspaceId === null ? {} : { workspaceId }),
        scopeId,
        selectedViewIds: selectedIds,
        pinnedContextIds,
        excludedContextIds,
      }, controller.signal).then((call) => {
        if (call.result.ok) {
          setActiveContextProjection(call.result.value)
          setActiveContextError(null)
        } else {
          setActiveContextError(call.result.error.message)
        }
      })
    }, 150)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [activeProjectId, bootMode, excludedContextIds, pinnedContextIds, scopeId, selectedIds, workspaceId])
  useEffect(() => {
    const bridge = bridgeRef.current
    bridge.isAvailable().then((available) => {
      if (!available) {
        setNotice('Local Core 离线，当前为 Demo 模式')
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
          setNotice(`项目不存在：${selection.requestedProjectId}。Local Core 中未找到该项目，已回到项目列表，未使用 Demo 数据`)
          return
        }
        if (selection.kind === 'empty-catalog') {
          setProjects([])
          setBootMode('offline')
          setNotice('Local Core 暂无项目数据，当前为 Demo 模式')
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
          setNotice('已打开 Runtime MVP Sample · 默认项目总览')
        } else if (result !== undefined) {
          setProjects([])
          setProjectOpen(false)
          setBootMode('offline')
          setNotice('Runtime 项目加载失败，已回到项目列表（未回退 Demo 数据）')
        }
      }).catch(() => {
        setProjectOpen(false)
        setBootMode('offline')
        setNotice('Local Core 连接异常，已回到项目列表（未使用 Demo 数据）')
      })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const resize = () => {
      if (window.innerWidth < 1160) setWorkRail((current) => ({ ...current, collapsed: true }))
      else setWorkRail((current) => current.collapsed ? current : { ...current, width: defaultRailWidth(window.innerWidth) })
      if (window.innerWidth <= 1366) setDockCollapsed(true)
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    if (seededStateRef.current || !queryState) return
    seededStateRef.current = true
    if (queryState === 'collapsed') setWorkRail((current) => ({ ...current, collapsed: true }))
    if (queryState === 'create') setCreateDialogOpen(true)
    if (queryState === 'confirm') { setSelectedIds(['proposal', 'feedback', 'reference']); setRunConfirmOpen(true) }
    if (queryState === 'scope') enterScope('scope-reference')
    if (queryState === 'selection') selectNode('proposal')
    if (queryState === 'multi') setSelectedIds(['proposal', 'feedback', 'reference'])
    if (queryState === 'running') startRunFrom('调整第 6 页构图与产品距离', ['proposal'], ['feedback', 'reference'])
    if (queryState === 'waiting') {
      const processNodeId = createId('run')
      setActiveRun({ id: 'RUN-044', status: 'waiting_input', command: '调整第 6 页构图与产品距离', targetIds: ['proposal'], contextIds: ['feedback', 'reference'], processNodeId, reviewStatus: 'idle', inputResolved: false, changedFiles: [], createdAt: new Date().toISOString() })
    }
    if (queryState === 'review') {
      setActiveRun({ id: 'RUN-044', status: 'review', command: '调整第 6 页构图与产品距离', targetIds: ['proposal'], contextIds: ['feedback', 'reference'], processNodeId: 'run-042', pendingArtifactId: 'generated', reviewStatus: 'pending', inputResolved: true, changedFiles: ['Thinker_Concept_V4_AI.pptx'], createdAt: new Date().toISOString() })
    }
    if (queryState === 'accepted') {
      setNodes((current) => current.map((node) => node.id === 'generated' ? { ...node, kind: 'working', draft: false, current: true, followsCurrentRevision: true, subtitle: '当前版本 · 已接受' } : node.id === 'proposal' ? { ...node, current: false, followsCurrentRevision: false, subtitle: `${node.subtitle} · 已归档` } : node))
      setSelectedIds(['generated'])
      setActiveRun({ id: 'RUN-044', status: 'completed', command: '调整第 6 页构图与产品距离', targetIds: ['proposal'], contextIds: ['feedback', 'reference'], processNodeId: 'run-042', pendingArtifactId: 'generated', reviewStatus: 'accepted', inputResolved: true, changedFiles: ['Thinker_Concept_V4_AI.pptx'], createdAt: new Date().toISOString() })
      setCheckpoint(true)
    }
    if (queryState === 'layout') setLayoutPreview(proposeScopeLayout(nodes, scopeId))
    if (queryState === 'scope-create') { setSelectedIds(['proposal', 'feedback', 'reference']); setScopeCreateOpen(true) }
    if (queryState === 'phase2-single') {
      setSelectedIds(['proposal'])
      setComposerText('根据第二轮客户反馈调整第 6 页构图和产品距离。')
    }
    if (queryState === 'phase2-multi') {
      setSelectedIds(['proposal', 'feedback', 'reference'])
      setComposerText('结合客户反馈与参考图优化提案构图。')
    }
  }, [queryState])

  useEffect(() => {
    if (performanceFixture || presentationInteractionRef.current) return
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
            setNotice('已保存至 Local Core')
          } else {
            setSaveStatus('unsaved')
            setNotice(`保存失败: ${result.error ?? 'Local Core 不可用'}`)
            console.warn('[RuntimeBridge] Save failed:', result.error)
          }
          saveProjectCatalog(projects)
        }).catch(() => {
          setSaveStatus('unsaved')
          setNotice('保存失败: Local Core 连接异常')
        })
        return
      }
      savePrototypeState(activeProjectId, snapshot)
      saveProjectCatalog(projects)
      setSaveStatus('saved')
    }, 280)
    return () => window.clearTimeout(timer)
  }, [activeProjectId, bootMode, edges, nodes, performanceFixture, presentationCommit, projects, scopes, workRail, workspaces])

  useEffect(() => { cameraRef.current = camera }, [camera])
  useEffect(() => { activeProjectIdRef.current = activeProjectId }, [activeProjectId])

  useEffect(() => {
    if (performanceFixture) return
    const timer = window.setTimeout(() => saveProjectNavigationState(activeProjectId, camera), 3000)
    return () => window.clearTimeout(timer)
  }, [activeProjectId, camera, performanceFixture])

  useEffect(() => {
    if (performanceFixture) return
    const flush = () => saveProjectNavigationState(activeProjectIdRef.current, cameraRef.current)
    const hidden = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [performanceFixture])

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

  const clearSelection = useCallback(() => { setSelectedIds([]); setSelectedEdgeId(null); setNodeInfoId(null) }, [])

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
    setCheckpoint(false)
    setComposerText('')
    setLayoutPreview(null)
    setProjectOpen(true)
  }, [resetGraph])

  const openProject = useCallback((projectId: string) => {
    if (projectId === activeProjectId && projectOpen) return
    if (projectOpen) { saveProjectNavigationState(activeProjectId, camera); projectStateCacheRef.current.set(activeProjectId, captureProjectState()) }
    const next = projectStateCacheRef.current.get(projectId) ?? loadPrototypeState(projectId) ?? fixtureStateForProject(projectId, defaultRailWidth())
    projectStateCacheRef.current.set(projectId, next)
    setOpenProjectIds((current) => current.includes(projectId) ? current : [...current, projectId])
    applyProjectState(projectId, next)
    setNotice(`已打开 ${projects.find((project) => project.id === projectId)?.label ?? '项目'}`)
  }, [activeProjectId, applyProjectState, camera, captureProjectState, projectOpen, projects])

  const closeProjectTab = useCallback((projectId: string) => {
    if (projectId === activeProjectId) { saveProjectNavigationState(projectId, camera); projectStateCacheRef.current.set(projectId, captureProjectState()) }
    const remaining = openProjectIds.filter((id) => id !== projectId)
    setOpenProjectIds(remaining)
    if (projectId !== activeProjectId) return
    const nextId = remaining.at(-1)
    if (nextId) {
      const next = projectStateCacheRef.current.get(nextId) ?? loadPrototypeState(nextId) ?? fixtureStateForProject(nextId, defaultRailWidth())
      applyProjectState(nextId, next)
    } else setProjectOpen(false)
  }, [activeProjectId, applyProjectState, camera, captureProjectState, openProjectIds])

  const createProject = useCallback(async ({ label, localPath }: { label: string; localPath: string }) => {
    setProjectCreateOpen(false)
    const call = await bridgeRef.current.client.createProject({ name: label, rootPath: localPath })
    if (!call.result.ok) {
      setNotice(`项目创建失败：${call.result.error.message}`)
      return
    }
    const entry = call.result.value
    bridgeRef.current = new RuntimeBridge(entry.id)
    const loaded = await bridgeRef.current.loadProject()
    if (loaded.source !== 'runtime' || !loaded.state) {
      setNotice(`项目已创建（${entry.name}），但 Runtime 数据加载失败`)
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
    setNotice(`${label} 已创建并写入 Local Core，可以直接拖入本地文件`)
  }, [camera, resetGraph, setCamera, setDataSource, setProjectOpen, setScopes, setWorkRail, setWorkspaces])
  const selectNode = useCallback((id: string, additive = false) => {
    setSelectedEdgeId(null)
    setSelectedIds((current) => additive ? current.includes(id) ? current.filter((item) => item !== id) : [...current, id] : [id])
    if (!additive) setNodeInfoId(null)
  }, [])
  const selectMarquee = useCallback((ids: string[], additive: boolean) => {
    setSelectedEdgeId(null)
    setSelectedIds((current) => additive ? Array.from(new Set([...current, ...ids])) : ids)
    setNodeInfoId(null)
  }, [])
  const selectEdge = useCallback((id: string | null) => { setSelectedEdgeId(id); if (id) { setSelectedIds([]); setNodeInfoId(null) } }, [])

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


  const saveWorkspaceEditor = useCallback(({ label, intent }: { label: string; intent: WorkspaceIntent }) => {
    const now = new Date().toISOString()
    if (workspaceEditor?.mode === 'edit' && workspaceEditor.id) {
      setWorkspaces((current) => updateWorkspaceRecord(current, workspaceEditor.id!, { label, intent }, now))
      setNotice('工作空间名称与意图已更新')
    } else {
      const next = createWorkspaceRecord({ id: createId('workspace'), label, intent, camera: { x: 0, y: 0, zoom: 1 }, visibleLayers, now })
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
    if (bounds) setCamera(fitBounds(bounds, viewport?.width ?? 1000, viewport?.height ?? 820, 72, safeInsets))
    setLayoutPreview(null)
    setNotice('已应用当前子画布的语义布局')
  }, [layoutPreview, nodes, safeInsets, scopeId, setNodes])

  const createNodeAt = useCallback((kind: 'note' | 'context', x: number, y: number) => {
    const id = createId(kind)
    const displayMode: NodeDisplayMode = 'standard'
    let opensScopeId: string | undefined
    if (kind === 'context') {
      opensScopeId = createId('scope')
      setScopes((current) => [...current, { id: opensScopeId!, label: '新内容集合', kind: 'collection', parentScopeId: scopeId, containerNodeId: id, camera: { x: 170, y: 100, zoom: 1 } }])
    }
    const next: CanvasNode = { id, kind, title: kind === 'note' ? '新备注' : '新内容集合', subtitle: kind === 'note' ? '双击名称或从工作栏修改' : '双击进入子画布', x, y, ...nodeDimensions(kind, displayMode), displayMode, scopeId, opensScopeId, contextOnly: kind === 'context' }
    setNodes((current) => [...current, next]); setSelectedIds([id]); setRenameNodeId(id); return id
  }, [scopeId, setNodes])

  const createContentFromDialog = useCallback((kind: 'note' | 'context') => {
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    const width = viewport?.width ?? 960
    const height = viewport?.height ?? 720
    const dimensions = nodeDimensions(kind, 'standard')
    const x = (width / 2 - camera.x) / camera.zoom - dimensions.width / 2
    const y = (height / 2 - camera.y) / camera.zoom - dimensions.height / 2
    createNodeAt(kind, x, y)
    setCreateDialogOpen(false)
    setNotice(kind === 'note' ? '已在画布中央添加备注' : '已创建内容集合与子画布')
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
      setNotice('只有 Runtime Revision 可以生成 Preview')
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
      setNotice('只有 Runtime FileRecord 可以刷新')
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
      return { id: createId('file'), artifactId: createId('artifact'), kind: 'source', title: file.name, subtitle: runtimeState === 'importing' ? 'Importing…' : previewUrl ? '本地图片 · 临时预览' : textPreview ? '本地文本 · 临时预览' : '本地文件 · 等待本地核心服务预览', x: x + index * 28, y: y + index * 28, ...nodeDimensions('source', 'standard'), displayMode: 'standard', fileType, fileSize: file.size, previewUrl, previewDataUrl: previewUrl, previewMimeType: fileType, scopeId, runtimeState, editable: /\.(pptx?|md|docx?|txt)$/i.test(file.name) }
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
        if (result.importedViewId !== undefined) setSelectedIds([result.importedViewId])
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
  }, [activeProjectId, bootMode, resetGraph, scopeId, setNodes])

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
      setNotice('链接已加入项目，正在理解…')
      const loaded = await bridgeRef.current.loadProject()
      if (loaded.source === 'runtime' && loaded.state) {
        const rootScope = loaded.state.scopes.find((scope) => scope.kind === 'root')
        resetGraph({ nodes: loaded.state.nodes, edges: loaded.state.edges })
        setWorkspaces(loaded.state.workspaces)
        setScopes(loaded.state.scopes)
        setWorkspaceId(null)
        setScopeId(rootScope?.id ?? loaded.state.activeScopeId)
        setCamera(rootScope?.camera ?? camera)
        setWorkRail(normalizeRailPreferences(loaded.state.workRail))
      }
    }).catch(() => {
      setNotice('链接已保存，但画布刷新失败')
    })
  }, [activeProjectId, camera, resetGraph, scopeId, setCamera, setScopes, setWorkRail, setWorkspaces])

  const reloadRuntimeProject = useCallback(async (): Promise<void> => {
    const loaded = await bridgeRef.current.loadProject()
    if (loaded.source === 'runtime' && loaded.state) {
      const rootScope = loaded.state.scopes.find((scope) => scope.kind === 'root')
      resetGraph({ nodes: loaded.state.nodes, edges: loaded.state.edges })
      setWorkspaces(loaded.state.workspaces)
      setScopes(loaded.state.scopes)
      setWorkspaceId(null)
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
      setNotice(`${rootName} 已导入，正在理解…`)
      await reloadRuntimeProject()
      await refreshResourceStatuses()
    }).catch(() => setNotice('目录导入失败：连接异常'))
  }, [activeProjectId, refreshResourceStatuses, reloadRuntimeProject, scopeId])

  const handleImportArchive = useCallback((file: File, note?: string) => {
    const point = lastCanvasPointRef.current ?? { x: 180, y: 160 }
    void bridgeRef.current.client.importResourceArchive(activeProjectId, {
      file,
      importRequestId: `zip-${Date.now().toString(36)}`,
      scopeId,
      x: point.x,
      y: point.y,
    }).then(async (call) => {
      if (!call.result.ok) {
        setNotice(`压缩包导入失败：${call.result.error.message}`)
        return
      }
      setNotice(`${file.name} 已导入，正在理解…`)
      await reloadRuntimeProject()
      await refreshResourceStatuses()
    }).catch(() => setNotice('压缩包导入失败：连接异常'))
  }, [activeProjectId, refreshResourceStatuses, reloadRuntimeProject, scopeId])

  useEffect(() => {
    if (bootMode !== 'runtime' || !activeProjectId) return
    const timer = window.setInterval(() => { void refreshResourceStatuses() }, 60_000)
    return () => window.clearInterval(timer)
  }, [activeProjectId, bootMode, refreshResourceStatuses])

  const applyRuntimeReview = useCallback((review: RunReview, current: ActiveRun, providerError?: string) => {
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
        title: changedFiles[0] ?? 'Runtime Draft',
        subtitle: 'Runtime Draft · 等待 Accept / Reject / Retry',
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
      status: providerError ? 'failed' : runtimePresentationStatus(review),
      runtime: true,
      pendingArtifactId,
      runtimeReturnId: pendingReturn === undefined ? current.runtimeReturnId : String(pendingReturn.id),
      baseRevisionId: pendingReturn === undefined ? current.baseRevisionId : String(pendingReturn.baseRevisionId),
      reviewStatus: pendingReturn === undefined ? current.reviewStatus : 'pending',
      changedFiles,
      providerError,
    })
  }, [nodes, scopeId, setGraph])

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
      const target = nodes.find((node) => node.artifactId === String(review.run.targetArtifactId))
      if (target === undefined) return
      const id = String(review.run.id)
      const processNodeId = `runtime-run-view-${id}`
      const dimensions = nodeDimensions('process', 'standard')
      setGraph((graph) => graph.nodes.some((node) => node.id === processNodeId) ? graph : {
        nodes: [...graph.nodes, {
          id: processNodeId,
          kind: 'process',
          title: `${id} · ${review.run.instruction.slice(0, 22)}`,
          subtitle: '从 Runtime 恢复',
          x: target.x + 24,
          y: target.y + target.height + 54,
          ...dimensions,
          displayMode: 'standard',
          scopeId: target.scopeId ?? scopeId,
          runStatus: runtimePresentationStatus(review),
          commandText: review.run.instruction,
          parentRunId: id,
          runtimeTransient: true,
        }],
        edges: [...graph.edges, {
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
        targetIds: [target.id],
        contextIds: [],
        processNodeId,
        contextSnapshotId: String(review.run.contextManifestId),
        reviewStatus: 'idle',
        changedFiles: [],
        createdAt: String(review.run.createdAt),
        runtime: true,
      }, review.dispatch.lastErrorMessage)
      setNotice(`已恢复 Runtime Run：${id}`)
    })
  }, [activeProjectId, activeRun, applyRuntimeReview, bootMode, nodes, scopeId, setGraph])

  const startRunFrom = useCallback((command: string, targetIds: string[], contextIds: string[]) => {
    if (!command.trim() || !targetIds.length) return
    const target = nodes.find((node) => node.id === targetIds[0])
    if (bootMode === 'runtime') {
      if (target?.artifactId === undefined || target.revisionId === undefined) {
        setNotice('真实 Run 需要已持久化且具有 Current Revision 的目标')
        return
      }
      setNotice('正在冻结 ContextManifest 并创建真实 Run…')
      void bridgeRef.current.client.createRuntimeRun(activeProjectId, {
        instruction: command,
        targetArtifactId: target.artifactId,
        contextArtifactIds: [...new Set(contextIds
          .map((contextId) => nodes.find((node) => node.id === contextId)?.artifactId)
          .filter((artifactId): artifactId is string => artifactId !== undefined && artifactId !== target.artifactId))],
        ...(workspaceId === null ? {} : { workspaceId }),
      }).then((call) => {
        if (!call.result.ok) {
          setNotice(`Run 创建失败：${call.result.error.message}`)
          return
        }
        const { review, providerError } = call.result.value
        const id = String(review.run.id)
        const processNodeId = `runtime-run-view-${id}`
        const dimensions = nodeDimensions('process', 'standard')
        const process: CanvasNode = {
          id: processNodeId,
          kind: 'process',
          title: `${id} · ${command.slice(0, 22)}`,
          subtitle: providerError ? `派发待恢复 · ${providerError.code}` : '真实 Runtime Run',
          x: target.x + 24,
          y: target.y + target.height + 54,
          ...dimensions,
          displayMode: 'standard',
          scopeId,
          runStatus: providerError ? 'failed' : runtimePresentationStatus(review),
          commandText: command,
          parentRunId: id,
          runtimeTransient: true,
        }
        const runEdges = [
          ...targetIds.map((targetId) => ({ id: createId('edge'), from: targetId, to: processNodeId, kind: 'modify' as const })),
          ...contextIds.map((contextId) => ({ id: createId('edge'), from: contextId, to: processNodeId, kind: 'reference' as const })),
        ]
        setGraph((graph) => ({ nodes: [...graph.nodes, process], edges: [...graph.edges, ...runEdges] }))
        const runtimeRun: ActiveRun = {
          id,
          status: providerError ? 'failed' : runtimePresentationStatus(review),
          command,
          targetIds,
          contextIds,
          processNodeId,
          contextSnapshotId: String(review.run.contextManifestId),
          reviewStatus: 'idle',
          changedFiles: [],
          createdAt: String(review.run.createdAt),
          runtime: true,
          providerError: providerError?.message,
        }
        setSelectedIds([])
        setNodeInfoId(null)
        setComposerText('')
        setCheckpoint(false)
        applyRuntimeReview(review, runtimeRun, providerError?.message)
        setNotice(providerError
          ? `Run 已保存，但 Bridge 派发需要恢复：${providerError.message}`
          : `真实 Run 已派发：${id}`)
      })
      return
    }
    runCounterRef.current += 1
    const id = `RUN-${String(runCounterRef.current).padStart(3, '0')}`
    const processNodeId = createId('run')
    const dimensions = nodeDimensions('process', 'standard')
    const process: CanvasNode = { id: processNodeId, kind: 'process', title: `${id} · ${command.slice(0, 22)}`, subtitle: '排队中 · 正在冻结上下文', x: target ? target.x + 24 : 460, y: target ? target.y + target.height + 54 : 560, ...dimensions, displayMode: 'standard', scopeId, runStatus: 'queued', commandText: command, parentRunId: id }
    const runEdges = [
      ...targetIds.map((targetId) => ({ id: createId('edge'), from: targetId, to: processNodeId, kind: 'modify' as const })),
      ...contextIds.map((contextId) => ({ id: createId('edge'), from: contextId, to: processNodeId, kind: 'reference' as const })),
    ]
    setGraph((current) => ({ nodes: [...current.nodes, process], edges: [...current.edges, ...runEdges] }))
    setSelectedIds([])
    setNodeInfoId(null)
    setActiveRun({ id, status: 'queued', command, targetIds, contextIds, processNodeId, commandId: createId('command'), contextSnapshotId: createId('context-snapshot'), reviewStatus: 'idle', inputResolved: false, changedFiles: [], createdAt: new Date().toISOString() })
    setComposerText('')
    setCheckpoint(false)
    setNotice('参考快照、指令和执行记录已自动保存')
  }, [activeProjectId, applyRuntimeReview, bootMode, nodes, scopeId, setGraph, workspaceId])

  const requestComposerFocus = useCallback(() => {
    setWorkRail((current) => ({ ...current, collapsed: false }))
    setComposerFocusRequest((current) => current + 1)
    const focusComposer = () => {
      const composer = composerRef.current ?? document.querySelector<HTMLTextAreaElement>('[data-testid="work-rail-composer-input"]')
      if (!composer) return false
      composer.focus({ preventScroll: true })
      const end = composer.value.length
      composer.setSelectionRange(end, end)
      return document.activeElement === composer
    }
    queueMicrotask(focusComposer)
    window.requestAnimationFrame(() => {
      if (!focusComposer()) window.requestAnimationFrame(focusComposer)
    })
  }, [])

  const requestRun = useCallback(() => {
    if (!composerText.trim()) { setNotice('先写一句你希望 AI 完成的修改'); return }
    if (runConfirmFrameRef.current !== null) window.cancelAnimationFrame(runConfirmFrameRef.current)
    // Mount the confirmation after the current keyboard/click event completes.
    // This prevents the same Ctrl/Cmd+Enter gesture from opening and immediately
    // confirming the dialog in one native event bubble.
    runConfirmFrameRef.current = window.requestAnimationFrame(() => {
      runConfirmFrameRef.current = null
      setRunConfirmOpen(true)
    })
  }, [composerText])

  const confirmRun = useCallback(() => {
    if (inference.ambiguousTargetIds.length || inference.targetIds.length !== 1) { setNotice('请先确认一个主要修改目标'); return }
    setRunConfirmOpen(false)
    startRunFrom(composerText, inference.targetIds, inference.contextIds)
  }, [composerText, inference, startRunFrom])

  const returnArtifact = useCallback((run: ActiveRun) => {
    const target = nodes.find((node) => node.id === run.targetIds[0])
    if (!target) return
    const id = createId('generated')
    const dimensions = nodeDimensions('generated', 'standard')
    const position = findPendingReturnPosition(nodes, target, dimensions)
    const generated: CanvasNode = { id, artifactId: target.artifactId ?? createId('artifact'), revisionId: createId('revision'), followsCurrentRevision: false, kind: 'generated', title: `Thinker_Concept_${run.id}_AI.pptx`, subtitle: '结果待回收 · 等待确认', ...position, ...dimensions, displayMode: 'standard', draft: true, pageCount: target.pageCount ?? 18, scopeId: target.scopeId ?? scopeId, editable: true, parentRunId: run.id, revisionOf: target.revisionId ?? target.id, resultGroupId: run.id, workspaceIds: target.workspaceIds }
    setGraph((current) => ({ nodes: [...current.nodes, generated], edges: [...current.edges, { id: createId('edge'), from: run.processNodeId, to: id, kind: 'generate', active: true }, { id: createId('edge'), from: target.id, to: id, kind: 'modify' }] }))
    setActiveRun((current) => current?.id === run.id ? { ...current, status: 'review', pendingArtifactId: id, reviewStatus: 'pending', changedFiles: [generated.title] } : current)
    setSelectedIds([id])
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    setCamera((current) => revealNode(current, generated, viewport?.width ?? 1000, viewport?.height ?? 820, safeInsets))
    setNotice('结果已自动归位，工作栏已进入版本确认')
  }, [nodes, safeInsets, scopeId, setGraph])

  const continueRun = useCallback((answer: '35%' | '30%') => {
    if (activeRun?.runtime) {
      setNotice('当前 MVP Runtime 不伪造 waiting_input；请使用 Retry 补充新指令')
      return
    }
    setActiveRun((run) => run ? { ...run, status: 'running', inputResolved: true, command: `${run.command}（已确认使用 ${answer}）` } : run)
    setNotice(`已确认 ${answer}，继续同一任务`)
  }, [activeRun?.runtime])

  const syncRuntimeRun = useCallback(() => {
    if (!activeRun?.runtime || runtimeSyncBusyRef.current) return
    runtimeSyncBusyRef.current = true
    setNotice(`正在同步 ${activeRun.id}…`)
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
          setCheckpoint(true)
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
    setCheckpoint(true)
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
    setComposerText('继续修改：')
    setNotice('返回结果已设为本轮修改目标，请直接补充下一步要求')
    requestComposerFocus()
  }, [activeRun?.pendingArtifactId, pendingNode, requestComposerFocus])

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
          setNotice(call.result.value.providerError?.message ?? 'Runtime Dispatch 已恢复')
        })
        return
      }
      setNotice('正在创建 Retry Run…')
      void bridgeRef.current.client.retryArtifactReturn(activeRun.runtimeReturnId, {
        instruction: composerText.trim() || activeRun.command,
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
        setComposerText('')
        setNotice(dispatchCall.result.value.providerError?.message
          ?? (finalized.result.ok && finalized.result.value.providerError === undefined
            ? `Retry Run 已派发：${String(newRun.id)}`
            : `Retry Run 已派发；旧 Bridge Review 待恢复：${String(newRun.id)}`))
      })
      return
    }
    startRunFrom(activeRun.command.replace(/（已确认.*?）/, ''), activeRun.targetIds, activeRun.contextIds)
    setNotice('已沿用原指令与上下文重新执行')
  }, [activeRun, applyRuntimeReview, composerText, setGraph, startRunFrom])

  const toggleContext = useCallback((id: string) => {
    if (inference.contextIds.includes(id)) {
      setExcludedContextIds((current) => Array.from(new Set([...current, id])))
      setPinnedContextIds((current) => current.filter((item) => item !== id))
    } else {
      setPinnedContextIds((current) => Array.from(new Set([...current, id])))
      setExcludedContextIds((current) => current.filter((item) => item !== id))
    }
  }, [inference.contextIds])

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
    const node = nodes.find((item) => item.id === id)
    if (!node) return
    selectNode(id)
    if (node.opensScopeId) enterScope(node.opensScopeId)
  }, [enterScope, nodes, selectNode])

  const showNodeDetails = useCallback((id: string) => {
    setNodeInfoId(id)
  }, [])
  const copySelectedViews = useCallback(() => { copySelection() }, [copySelection])
  const duplicateSelectedViews = useCallback(() => { duplicateSelection() }, [duplicateSelection])
  const deleteSelectedViews = useCallback(() => { deleteNodes(selectedIds) }, [deleteNodes, selectedIds])
  const rememberCanvasPoint = useCallback((point: { x: number; y: number }) => { lastCanvasPointRef.current = point }, [])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isText = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable
      const modifier = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (createDialogOpen || runConfirmOpen || scopeCreateOpen || projectCreateOpen) return
      if (modifier && event.key === 'Enter') {
        event.preventDefault()
        requestRun()
        return
      }
      if (isText) return
      if (modifier && key === 'c') { event.preventDefault(); copySelection(); return }
      if (modifier && key === 'v') { event.preventDefault(); pasteClipboard(); return }
      if (modifier && key === 'd') { event.preventDefault(); duplicateSelection(); return }
      if (modifier && key === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return }
      if (modifier && key === 'y') { event.preventDefault(); redo(); return }
      if (modifier && event.shiftKey && key === 'l') { event.preventDefault(); arrangeSelection(); return }
      if (modifier && key === 'o' && selectedNodes.length === 1) { event.preventDefault(); openNative(selectedNodes[0]); return }
      if (event.code === 'Space') { event.preventDefault(); setSpaceHeld(true); return }
      if (event.key === 'Escape') { if (capabilityOpen) setCapabilityOpen(false); else if (nodeInfoId) setNodeInfoId(null); else if (layoutPreview) setLayoutPreview(null); else clearSelection(); return }
      if (key === 'c') { event.preventDefault(); requestComposerFocus(); return }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedIds.length) { deleteNodes(selectedIds); return }
        if (selectedEdgeId) { setEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId)); setSelectedEdgeId(null); setNotice('关系已删除') }
      }
    }
    const release = (event: KeyboardEvent) => { if (event.code === 'Space') setSpaceHeld(false) }
    window.addEventListener('keydown', handler); window.addEventListener('keyup', release)
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('keyup', release) }
  }, [arrangeSelection, clearSelection, copySelection, createDialogOpen, deleteNodes, duplicateSelection, capabilityOpen, nodeInfoId, layoutPreview, openNative, pasteClipboard, projectCreateOpen, redo, requestComposerFocus, requestRun, runConfirmOpen, scopeCreateOpen, selectedEdgeId, selectedId, selectedIds, selectedNodes, setEdges, undo])

  if (!projectOpen) return <>
    {notice && <div data-testid="toast" className="notice" role="status" aria-live="polite">{notice}</div>}
    <ProjectDrive projects={projects} openProjectIds={openProjectIds} onOpen={openProject} onCreate={() => setProjectCreateOpen(true)} />
    <ProjectCreateDialog open={projectCreateOpen} onCancel={() => setProjectCreateOpen(false)} onCreate={createProject} />
  </>

  const editorWorkspace = workspaceEditor?.id ? workspaces.find((workspace) => workspace.id === workspaceEditor.id) : undefined
  const nodeToRename = renameNodeId ? nodes.find((node) => node.id === renameNodeId) : undefined
  const scopePath = buildScopePath(scopes, activeScope)

  return <main className="app-shell v05 v051 v052 v053 v056 v0561 v06 v06-phase2 v06-phase3 v061 v07 v071 porcelain-studio-v2" data-testid="creative-os-app">
    <V07TopBar projects={projects} openProjectIds={openProjectIds} activeProjectId={activeProjectId} scopePath={scopePath} saveStatus={saveStatus} runStatus={activeRun?.status ?? null} workRailCollapsed={workRail.collapsed} onOpenDrive={() => setProjectOpen(false)} onOpenProject={openProject} onCloseProject={closeProjectTab} onOpenScope={enterScope} onToggleWorkRail={() => setWorkRail((current) => ({ ...current, collapsed: !current.collapsed }))} />
    <section className={`scene intent-${effectiveWorkspace.intent ?? 'blank'}`} style={sceneStyle} data-project-id={activeProjectId} data-scope-id={scopeId} data-workspace-id={workspaceId ?? 'project-overview'} data-workspace-intent={effectiveWorkspace.intent ?? 'blank'}>
      {capabilityOpen && <CapabilityPopover capabilities={capabilities} nodes={scopeNodes} onClose={() => setCapabilityOpen(false)} onImport={(files) => { const point = lastCanvasPointRef.current ?? { x: 180, y: 160 }; dropFiles(files, point.x, point.y); setCapabilityOpen(false) }} onCreateObject={() => { setCapabilityOpen(false); setCreateDialogOpen(true) }} onAddLink={() => { setCapabilityOpen(false); setLinkDialogOpen(true) }} onUniversalImport={() => { setCapabilityOpen(false); setImportPanelOpen(true) }} onHandoff={() => { setCapabilityOpen(false); void openHandoff() }} onOpenComposer={() => { setCapabilityOpen(false); requestComposerFocus() }} onSelectNode={(id) => { selectNode(id); setCapabilityOpen(false) }} />}
      <WorkspaceDock workspaces={scopeWorkspaces} activeId={workspaceId} collapsed={dockCollapsed} onCollapsedChange={setDockCollapsed} capabilitiesOpen={capabilityOpen} onOpenCapabilities={() => setCapabilityOpen((value) => !value)} onOverview={activateOverview} onChange={changeWorkspace} onLocate={locateWorkspace} onAddWorkspace={() => setWorkspaceEditor({ mode: 'create' })} onEditWorkspace={(id) => setWorkspaceEditor({ mode: 'edit', id })} onDuplicateWorkspace={duplicateWorkspace} onDeleteWorkspace={deleteWorkspace} onMoveWorkspace={moveWorkspace} runStatus={activeRun?.status ?? null} />
      <ProjectCanvas nodes={visibleNodes} setNodes={setNodes} edges={visibleEdges} setEdges={setEdges} camera={camera} setCamera={setCamera} selectedId={selectedId} selectedIds={selectedIds} selectedEdgeId={selectedEdgeId} setSelectedEdgeId={setSelectedEdgeId} pendingId={activeRun?.pendingArtifactId ?? null} runId={activeRun?.id ?? 'RUN-043'} runStatus={activeRun?.status ?? null} spaceHeld={spaceHeld} locked={createDialogOpen || runConfirmOpen || scopeCreateOpen} layoutPreview={layoutPreview} workspaceFrames={activeWorkspaceFrames} workspaceMemberNodes={scopeNodes} activeWorkspaceId={workspaceId} onWorkspaceActivate={changeWorkspace} onPresentationInteractionChange={handlePresentationInteractionChange} onPresentationCommit={handlePresentationCommit} onSelect={selectNode} onClearSelection={clearSelection} onMarqueeSelect={selectMarquee} onSelectEdge={selectEdge} onDoubleClick={handleDoubleClick} onDetails={showNodeDetails} onRequestAi={requestComposerFocus} onCreateNodeFromAnchor={createNodeFromAnchor} onFilesDropped={dropFiles} onArrangeSelection={arrangeSelection} onCopySelection={copySelectedViews} onDuplicateSelection={duplicateSelectedViews} onCreateScopeFromSelection={() => selectedIds.length ? setScopeCreateOpen(true) : setNotice('先选择要整理进子画布的对象')} onDeleteSelection={deleteSelectedViews} onPointerWorldChange={rememberCanvasPoint} />
      <div className="canvas-hud" data-testid="canvas-hud"><CanvasMiniMap nodes={scopeNodes} workspaceFrames={activeWorkspaceFrames} camera={camera} setCamera={setCamera} collapsed={miniMapCollapsed} onCollapsedChange={setMiniMapCollapsed} safeInsets={safeInsets} /></div>
      <WorkRail workspace={effectiveWorkspace} nodes={nodes} inference={inference} activeRun={activeRun} pendingNode={pendingNode} collapsed={workRail.collapsed} width={effectiveRailWidth} composerText={composerText} composerRef={composerRef} composerFocusRequest={composerFocusRequest} onRequestComposerFocus={requestComposerFocus} onCollapse={() => setWorkRail((current) => ({ ...current, collapsed: true }))} onExpand={() => setWorkRail((current) => ({ ...current, collapsed: false }))} onComposerChange={setComposerText} onSend={requestRun} onContinue={continueRun} onAccept={acceptRun} onReject={rejectRun} onRetry={retryRun} onSyncRun={syncRuntimeRun} onContinueModify={continueModify} onShowRun={clearSelection} />
      {agentMode && <AgentContextSurface
        projectLabel={activeProject.label}
        workspaceLabel={effectiveWorkspace.label}
        projection={activeContextProjection}
        selectedNodes={selectedNodes}
        error={activeContextError}
      />}
      {nodeInfoNode && <NodeInfoPopover node={nodeInfoNode} camera={camera} relationCount={nodeInfoRelationCount} onClose={() => setNodeInfoId(null)} onRelations={() => { selectNode(nodeInfoNode.id); setNodeInfoId(null); setNotice(`${nodeInfoRelationCount} 个关联已在画布中高亮`) }} onShowResource={(node) => { setNodeInfoId(null); setResourceDetailArtifactId(String(node.artifactId)) }} />}
      {activeRun && <button className={`run-pill ${activeRun.status}`} onClick={() => { clearSelection(); setWorkRail((current) => ({ ...current, collapsed: false })) }}><Play size={13} /> {activeRun.id} · {runStatusLabel[activeRun.status]}</button>}
      {checkpoint && <div className="checkpoint"><Check size={15} /> 已形成稳定修改集 <button onClick={() => { setCheckpoint(false); setNotice('检查点已创建') }}>创建检查点</button><button className="quiet" onClick={() => setCheckpoint(false)}>稍后</button></div>}
      <nav className="scene-title v06-breadcrumbs" aria-label="画布层级">{scopePath.map((scope, index) => {
        const current = index === scopePath.length - 1
        return <button key={scope.id} data-testid={`scope-crumb-${scope.id}`} aria-current={current ? 'page' : undefined} disabled={current} onClick={() => enterScope(scope.id)}>{index > 0 && <span>/</span>}{index === 0 ? activeProject.label : scope.label}</button>
      })}{activeScope.parentScopeId && <button className="scope-back" data-testid="scope-back" onClick={leaveScope}>返回上级</button>}</nav>
      {!selectedIds.length && !activeRun && <div className="shortcut-hint"><Command size={12} /> 单击内容 · C 输入指令 · Ctrl/Cmd+Enter 执行</div>}
      {layoutPreview && <div className="layout-preview-banner"><span>预览自动布局 · 只移动当前子画布中的视图</span><button onClick={applyLayout}>应用</button><button onClick={() => setLayoutPreview(null)}>取消</button></div>}
      {notice && <div data-testid="toast" className="notice" role="status" aria-live="polite">{notice}</div>}
      <ScopeCreateDialog open={scopeCreateOpen} selectedCount={selectedIds.length} leftInset={safeInsets.left} rightInset={24} onCancel={() => setScopeCreateOpen(false)} onCreate={createScopeFromSelection} />
      <RunConfirmDialog open={runConfirmOpen} command={composerText} nodes={nodes} inference={inference} leftInset={safeInsets.left} rightInset={24} onCommandChange={setComposerText} onSelectTarget={selectPrimaryTarget} onCancel={() => setRunConfirmOpen(false)} onConfirm={confirmRun} />
      <CreateContentDialog open={createDialogOpen} leftInset={safeInsets.left} rightInset={24} onCancel={() => setCreateDialogOpen(false)} onCreate={createContentFromDialog} />
      {workspaceEditor && <WorkspaceDialog mode={workspaceEditor.mode} workspace={editorWorkspace} currentCamera={camera} onCancel={() => setWorkspaceEditor(null)} onSave={saveWorkspaceEditor} />}
      {nodeToRename && <InlineNodeRename node={nodeToRename} camera={camera} onCancel={() => setRenameNodeId(null)} onSave={(value) => renameNodeTitle(nodeToRename.id, value)} />}
      {confirmWorkspaceId && <ConfirmDialog title="删除这个工作空间？" description="只删除工作空间定义，不删除内容、节点、本地文件或 Camera。" onCancel={() => setConfirmWorkspaceId(null)} onConfirm={confirmDeleteWorkspace} />}
      <HandoffDialog open={handoffOpen} loading={handoffLoading} manifest={handoffManifest} error={handoffError} onClose={() => setHandoffOpen(false)} onCopy={() => { void copyHandoff() }} onDownload={downloadHandoff} />
      <LinkReferenceDialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} onCreate={createLinkReference} />
      <UniversalImportPanel open={importPanelOpen} onClose={() => setImportPanelOpen(false)} onFiles={(files) => { const point = lastCanvasPointRef.current ?? { x: 180, y: 160 }; dropFiles([...files], point.x, point.y) }} onDirectory={(rootName, files, note) => { void handleImportDirectory(rootName, files, note) }} onArchive={(file, note) => { void handleImportArchive(file, note) }} onOpenLink={() => setLinkDialogOpen(true)} />
      {resourceDetailArtifactId !== null && <ResourceDetailDialog open projectId={activeProjectId} artifactId={resourceDetailArtifactId} client={bridgeRef.current.client} onClose={() => setResourceDetailArtifactId(null)} onChanged={() => { void refreshResourceStatuses() }} />}
      <button className="prototype-reset" onClick={() => { clearPrototypeState(activeProjectId); clearProjectNavigationState(activeProjectId); window.location.reload() }}>重置演示数据</button>
    </section>
  </main>
}

function AgentContextSurface({
  projectLabel,
  workspaceLabel,
  projection,
  selectedNodes,
  error,
}: {
  readonly projectLabel: string
  readonly workspaceLabel: string
  readonly projection: ActiveContextProjection | null
  readonly selectedNodes: readonly CanvasNode[]
  readonly error: string | null
}) {
  return <aside className="agent-context-surface" data-testid="agent-context-surface" aria-label="Agent visual context">
    <header>
      <span className={`agent-context-live ${error ? 'error' : ''}`} />
      <div><strong>Agent Context</strong><small>{error ? 'Local Core unavailable' : 'Live from Canvas'}</small></div>
      <code>v{projection?.version ?? 0}</code>
    </header>
    <dl>
      <div><dt>Project</dt><dd>{projectLabel}</dd></div>
      <div><dt>Workspace</dt><dd>{workspaceLabel}</dd></div>
      <div><dt>Selection</dt><dd>{selectedNodes.length || 'None'}</dd></div>
      <div><dt>Context</dt><dd>{projection?.contextArtifacts.length ?? 0}</dd></div>
    </dl>
    {selectedNodes.length > 0
      ? <ul>{selectedNodes.slice(0, 5).map((node) => <li key={node.id}><span className={`agent-kind kind-${node.kind}`} />{node.title}</li>)}</ul>
      : <p>在画布中选择内容，Agent 将通过 LCOS MCP 读取同一份 Active Context。</p>}
    {error && <p className="agent-context-error">{error}</p>}
  </aside>
}

function buildScopePath(scopes: CanvasScope[], scope: CanvasScope): CanvasScope[] {
  const result: CanvasScope[] = [scope]
  let current = scope
  while (current.parentScopeId) {
    const parent = scopes.find((item) => item.id === current.parentScopeId)
    if (!parent) break
    result.unshift(parent)
    current = parent
  }
  return result
}

function isTextPreviewFile(file: File): boolean {
  return file.type.startsWith('text/')
    || /\.(md|markdown|txt|log|json|csv|tsv|yaml|yml)$/i.test(file.name)
}

function inferFileType(fileName: string): string {
  if (/\.(md|markdown)$/i.test(fileName)) return 'text/markdown'
  if (/\.txt$/i.test(fileName)) return 'text/plain'
  if (/\.json$/i.test(fileName)) return 'application/json'
  if (/\.csv$/i.test(fileName)) return 'text/csv'
  if (/\.docx$/i.test(fileName)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (/\.pdf$/i.test(fileName)) return 'application/pdf'
  if (/\.svg$/i.test(fileName)) return 'image/svg+xml'
  if (/\.avif$/i.test(fileName)) return 'image/avif'
  if (/\.bmp$/i.test(fileName)) return 'image/bmp'
  return 'unknown'
}
