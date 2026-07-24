import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Check, Cloud, Command, Layers3, Play, X } from 'lucide-react'
import { makePerformanceFixture } from './fixtures'
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
import { clearPrototypeState, loadProjectCatalog, loadPrototypeState, saveProjectCatalog, savePrototypeState } from './state/prototypeStorage'
import { RuntimeBridge, type DataSource, type SaveStatus } from './runtime/runtimeBridge'
import { createWorkspaceRecord, duplicateWorkspaceRecord, moveWorkspaceRecord, removeWorkspaceRecord, toggleWorkspaceLayer, updateWorkspaceRecord } from './state/workspaceState'
import { fitBounds, getSelectionBounds, nodeDimensions, revealNode } from './features/canvas/canvasGeometry'
import { findPendingReturnPosition } from './features/canvas/canvasLayout'
import { applyScopeLayout, proposeScopeLayout, type LayoutPreviewItem } from './features/canvas/scopeLayout'
import { arrangeSelectedNodes } from './features/canvas/selectionLayout'
import { copyCanvasSelection, pasteCanvasNodes, pasteRelationTemplate, type CanvasClipboardPayload } from './state/canvasClipboard'
import { useCanvasHistory } from './state/useCanvasHistory'
import { inferTargetContext, moveBetweenTargetAndContext, setPrimaryTarget } from './state/workContext'
import { createBlankProjectState, defaultProjectCatalog, fixtureStateForProject } from './state/projectFixtures'
import { createChildScopeFromSelection, removeScopeTree } from './state/canvasScopes'

const DEFAULT_PROJECT_ID = 'project-portasplit'

function defaultRailWidth(viewport = typeof window === 'undefined' ? 1440 : window.innerWidth): number {
  if (viewport >= 1600) return 390
  if (viewport >= 1440) return 350
  return 312
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

export function App() {
  const queryState = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('state') ?? ''
  const perfCount = typeof window === 'undefined' ? 0 : Number(new URLSearchParams(window.location.search).get('perf') ?? 0)
  const performanceFixture = perfCount >= 80 ? makePerformanceFixture(Math.min(300, perfCount)) : null
  const initialProjectId = queryState === 'project-huaxin' ? 'project-huaxin' : DEFAULT_PROJECT_ID
  const initial = useMemo(() => initialPrototype(initialProjectId, performanceFixture), [performanceFixture])
  const { nodes, edges, setNodes, setEdges, setGraph, undo, redo, resetGraph } = useCanvasHistory({ nodes: initial.nodes, edges: initial.edges })

  const [projects, setProjects] = useState<ProjectPackage[]>(() => loadProjectCatalog(defaultProjectCatalog()))
  const [activeProjectId, setActiveProjectId] = useState(initialProjectId)
  const [openProjectIds, setOpenProjectIds] = useState<string[]>([initialProjectId])
  const [projectOpen, setProjectOpen] = useState(queryState !== 'drive')
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initial.workspaces)
  const [scopes, setScopes] = useState<CanvasScope[]>(initial.scopes)
  const [workspaceId, setWorkspaceId] = useState(initial.activeWorkspaceId)
  const [scopeId, setScopeId] = useState(initial.activeScopeId)
  const [camera, setCamera] = useState<Camera>(() => initial.scopes.find((scope) => scope.id === initial.activeScopeId)?.camera ?? initial.workspaces[0].camera)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [focusPreviewId, setFocusPreviewId] = useState<string | null>(null)
  const [pinnedContextIds, setPinnedContextIds] = useState<string[]>(['brief', 'feedback', 'reference'])
  const [excludedContextIds, setExcludedContextIds] = useState<string[]>([])
  const [manualInference, setManualInference] = useState<TargetContextInference | null>(null)
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null)
  const [checkpoint, setCheckpoint] = useState(false)
  const [spaceHeld, setSpaceHeld] = useState(false)
  const [notice, setNotice] = useState('已恢复上次工作现场')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [dataSource, setDataSource] = useState<DataSource>('none')
  const [workRail, setWorkRail] = useState<WorkRailPreferences>(initial.workRail)
  const [dockCollapsed, setDockCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 1366)
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

  const objectUrls = useRef<Set<string>>(new Set())
  const clipboardRef = useRef<CanvasClipboardPayload | null>(null)
  const lastCanvasPointRef = useRef<{ x: number; y: number } | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const runCounterRef = useRef(43)
  const runConfirmFrameRef = useRef<number | null>(null)
  const seededStateRef = useRef(false)
  const projectStateCacheRef = useRef<Map<string, PersistedPrototypeState>>(new Map([[initialProjectId, initial]]))
  const bridgeRef = useRef(new RuntimeBridge(initialProjectId))

  // Try loading from Local Core on mount. Never silently fall back — show notice if offline.
  useEffect(() => {
    const bridge = bridgeRef.current
    bridge.isAvailable().then((available) => {
      if (!available) {
        setNotice('Local Core 离线，当前为本地 Fixture 模式')
        return
      }
      bridge.loadProject().then((result) => {
        if (result.source === 'runtime' && result.state) {
          setGraph(result.state)
          setWorkspaces(result.state.workspaces)
          setScopes(result.state.scopes)
          setWorkspaceId(result.state.activeWorkspaceId)
          setScopeId(result.state.activeScopeId)
          setCamera(result.state.scopes[0]?.camera ?? camera)
          setDataSource('runtime')
          setNotice('已从 Local Core 恢复项目')
        }
      }).catch(() => {
        setNotice('Local Core 加载失败，使用本地 Fixture')
      })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const activeProject = projects.find((project) => project.id === activeProjectId) ?? projects[0]
  const activeWorkspace = workspaces.find((workspace) => workspace.id === workspaceId) ?? workspaces[0]
  const activeScope = scopes.find((scope) => scope.id === scopeId) ?? scopes[0]
  const selectedNodes = selectedIds.map((id) => nodes.find((node) => node.id === id)).filter((node): node is CanvasNode => Boolean(node))
  const selectedId = selectedIds.at(-1) ?? null
  const focusNode = focusPreviewId ? nodes.find((node) => node.id === focusPreviewId) ?? null : null
  const visibleLayers: NodeLayer[] = activeWorkspace.visibleLayers.length ? activeWorkspace.visibleLayers : ['core', 'process']
  const scopeNodes = useMemo(() => nodes.filter((node) => (node.scopeId ?? 'scope-root') === scopeId), [nodes, scopeId])
  const visibleNodes = useMemo(() => scopeNodes.filter((node) => visibleLayers.includes(nodeMeta[node.kind].layer)), [scopeNodes, visibleLayers])
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes])
  const visibleEdges = useMemo(() => edges.filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)), [edges, visibleNodeIds])
  const relationNodes = useMemo(() => selectedId ? edges.filter((edge) => edge.from === selectedId || edge.to === selectedId).map((edge) => nodes.find((node) => node.id === (edge.from === selectedId ? edge.to : edge.from))).filter((node): node is CanvasNode => Boolean(node)) : [], [edges, nodes, selectedId])

  const baseInference = useMemo(() => inferTargetContext(nodes, selectedIds, activeWorkspace, scopeId, pinnedContextIds), [activeWorkspace, nodes, pinnedContextIds, scopeId, selectedIds])
  const inference = useMemo(() => {
    const current = manualInference ?? baseInference
    return { ...current, contextIds: current.contextIds.filter((id) => !excludedContextIds.includes(id)) }
  }, [baseInference, excludedContextIds, manualInference])
  const pendingNode = activeRun?.pendingArtifactId ? nodes.find((node) => node.id === activeRun.pendingArtifactId) ?? null : null
  const compareExpanded = activeRun?.status === 'review' && Boolean(pendingNode)
  const effectiveRailWidth = workRail.collapsed ? 56 : compareExpanded ? Math.min(600, Math.max(520, typeof window === 'undefined' ? 560 : window.innerWidth * .4)) : workRail.width
  const sceneStyle = useMemo(() => ({ '--work-rail-width': `${effectiveRailWidth}px` } as CSSProperties), [effectiveRailWidth])
  const safeInsets = useMemo(() => ({
    left: dockCollapsed ? 76 : 230,
    right: 28,
    top: 58,
    bottom: miniMapCollapsed ? 72 : 164,
  }), [dockCollapsed, miniMapCollapsed])

  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 2600); return () => window.clearTimeout(timer) }, [notice])
  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url))
    objectUrls.current.clear()
    if (runConfirmFrameRef.current !== null) window.cancelAnimationFrame(runConfirmFrameRef.current)
  }, [])
  useEffect(() => { setManualInference(null) }, [scopeId, selectedIds.join(','), workspaceId])
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
    if (performanceFixture) return
    setSaveStatus('saving')
    const timer = window.setTimeout(() => {
      const now = new Date().toISOString()
      const persistedWorkspaces = workspaces.map((workspace) => workspace.id === workspaceId ? { ...workspace, camera, updatedAt: now } : workspace)
      const persistedScopes = scopes.map((scope) => scope.id === scopeId ? { ...scope, camera, updatedAt: now } : scope)
      const snapshot: PersistedPrototypeState = { version: 9, projectId: activeProjectId, nodes, edges, workspaces: persistedWorkspaces, scopes: persistedScopes, activeWorkspaceId: workspaceId, activeScopeId: scopeId, workRail }
      projectStateCacheRef.current.set(activeProjectId, snapshot)

      // Save to Local Core via runtimeBridge
      const bridge = bridgeRef.current
      bridge.saveProject(snapshot).then((result) => {
        if (result.status === 'saved') {
          setSaveStatus('saved')
          setDataSource('runtime')
          setNotice('已保存至 Local Core')
        } else {
          setSaveStatus('unsaved')
          setNotice(`保存失败: ${result.error ?? 'Local Core 不可用'}`)
        }
        saveProjectCatalog(projects)
      }).catch(() => {
        setSaveStatus('unsaved')
        setNotice('保存失败: Local Core 连接异常')
      })
    }, 280)
    return () => window.clearTimeout(timer)
  }, [activeProjectId, camera, edges, nodes, performanceFixture, projects, scopeId, scopes, workRail, workspaceId, workspaces])

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

  const clearSelection = useCallback(() => { setSelectedIds([]); setSelectedEdgeId(null); setFocusPreviewId(null) }, [])

  const captureProjectState = useCallback((): PersistedPrototypeState => ({
    version: 9,
    projectId: activeProjectId,
    nodes,
    edges,
    workspaces: workspaces.map((workspace) => workspace.id === workspaceId ? { ...workspace, camera } : workspace),
    scopes: scopes.map((scope) => scope.id === scopeId ? { ...scope, camera, updatedAt: new Date().toISOString() } : scope),
    activeWorkspaceId: workspaceId,
    activeScopeId: scopeId,
    workRail,
  }), [activeProjectId, camera, edges, nodes, scopeId, scopes, workRail, workspaceId, workspaces])

  const applyProjectState = useCallback((projectId: string, state: PersistedPrototypeState) => {
    resetGraph({ nodes: state.nodes, edges: state.edges })
    setWorkspaces(state.workspaces)
    setScopes(state.scopes)
    setWorkspaceId(state.activeWorkspaceId)
    setScopeId(state.activeScopeId)
    const nextScope = state.scopes.find((scope) => scope.id === state.activeScopeId) ?? state.scopes[0]
    const nextWorkspace = state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) ?? state.workspaces[0]
    setCamera(nextScope?.camera ?? nextWorkspace.camera)
    setWorkRail(state.workRail)
    setActiveProjectId(projectId)
    setSelectedIds([])
    setSelectedEdgeId(null)
    setFocusPreviewId(null)
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
    if (projectOpen) projectStateCacheRef.current.set(activeProjectId, captureProjectState())
    const next = projectStateCacheRef.current.get(projectId) ?? loadPrototypeState(projectId) ?? fixtureStateForProject(projectId, defaultRailWidth())
    projectStateCacheRef.current.set(projectId, next)
    setOpenProjectIds((current) => current.includes(projectId) ? current : [...current, projectId])
    applyProjectState(projectId, next)
    setNotice(`已打开 ${projects.find((project) => project.id === projectId)?.label ?? '项目'}`)
  }, [activeProjectId, applyProjectState, captureProjectState, projectOpen, projects])

  const closeProjectTab = useCallback((projectId: string) => {
    if (projectId === activeProjectId) projectStateCacheRef.current.set(projectId, captureProjectState())
    const remaining = openProjectIds.filter((id) => id !== projectId)
    setOpenProjectIds(remaining)
    if (projectId !== activeProjectId) return
    const nextId = remaining.at(-1)
    if (nextId) {
      const next = projectStateCacheRef.current.get(nextId) ?? loadPrototypeState(nextId) ?? fixtureStateForProject(nextId, defaultRailWidth())
      applyProjectState(nextId, next)
    } else setProjectOpen(false)
  }, [activeProjectId, applyProjectState, captureProjectState, openProjectIds])

  const createProject = useCallback(({ label, localPath }: { label: string; localPath: string }) => {
    const project: ProjectPackage = { id: createId('project'), label, localPath, updatedAt: '刚刚', pendingCount: 0, rootScopeId: createId('scope-root') }
    const state = createBlankProjectState(project, defaultRailWidth())
    projectStateCacheRef.current.set(project.id, state)
    setProjects((current) => [...current, project])
    setOpenProjectIds((current) => [...current, project.id])
    setProjectCreateOpen(false)
    applyProjectState(project.id, state)
    setNotice(`${label} 已创建，可以直接拖入本地文件`)
  }, [applyProjectState])
  const selectNode = useCallback((id: string, additive = false) => {
    setSelectedEdgeId(null)
    setSelectedIds((current) => additive ? current.includes(id) ? current.filter((item) => item !== id) : [...current, id] : [id])
    setFocusPreviewId(null)
  }, [])
  const selectMarquee = useCallback((ids: string[], additive: boolean) => {
    setSelectedEdgeId(null)
    setSelectedIds((current) => additive ? Array.from(new Set([...current, ...ids])) : ids)
    setFocusPreviewId(null)
  }, [])
  const selectEdge = useCallback((id: string | null) => { setSelectedEdgeId(id); if (id) { setSelectedIds([]); setFocusPreviewId(null) } }, [])

  const changeWorkspace = useCallback((id: string) => {
    const next = workspaces.find((workspace) => workspace.id === id)
    if (!next) return
    const now = new Date().toISOString()
    setWorkspaces((current) => current.map((workspace) => workspace.id === workspaceId ? { ...workspace, camera, updatedAt: now } : workspace))
    setWorkspaceId(id)
    setScopeId(next.scopeId)
    const focusNodes = nodes.filter((node) => (node.scopeId ?? 'scope-root') === next.scopeId && next.focusedNodeIds.includes(node.id))
    const focusBounds = getSelectionBounds(focusNodes, focusNodes.map((node) => node.id))
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    setCamera(focusBounds ? fitBounds(focusBounds, viewport?.width ?? 1000, viewport?.height ?? 820, 82, safeInsets) : next.camera)
    clearSelection()
    setLayoutPreview(null)
  }, [camera, clearSelection, nodes, safeInsets, workspaceId, workspaces])

  const enterScope = useCallback((nextScopeId: string) => {
    if (nextScopeId === scopeId) return
    const next = scopes.find((scope) => scope.id === nextScopeId)
    if (!next) {
      setNotice('目标画布不存在或已被删除')
      return
    }
    const now = new Date().toISOString()
    setScopes((current) => current.map((scope) => scope.id === scopeId ? { ...scope, camera, updatedAt: now } : scope))
    setWorkspaces((current) => current.map((workspace) => workspace.id === workspaceId ? { ...workspace, scopeId, camera, updatedAt: now } : workspace))
    const matchingWorkspace = workspaces.find((workspace) => workspace.scopeId === nextScopeId)
    if (matchingWorkspace) setWorkspaceId(matchingWorkspace.id)
    setScopeId(nextScopeId)
    const nextNodes = nodes.filter((node) => (node.scopeId ?? 'scope-root') === nextScopeId)
    const bounds = getSelectionBounds(nextNodes, nextNodes.map((node) => node.id))
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    const restoredCamera = matchingWorkspace?.camera ?? next.camera
    setCamera(bounds ? fitBounds(bounds, viewport?.width ?? 1000, viewport?.height ?? 820, 82, safeInsets) : restoredCamera)
    clearSelection()
    setLayoutPreview(null)
    setNotice(`已进入 ${next.label}`)
  }, [camera, clearSelection, nodes, safeInsets, scopeId, scopes, workspaceId, workspaces])

  const leaveScope = useCallback(() => {
    if (!activeScope.parentScopeId) return
    enterScope(activeScope.parentScopeId)
  }, [activeScope.parentScopeId, enterScope])

  const fitScope = useCallback(() => {
    const bounds = getSelectionBounds(scopeNodes, scopeNodes.map((node) => node.id))
    const viewport = document.querySelector<HTMLElement>('[data-testid="canvas"]')?.getBoundingClientRect()
    if (bounds) setCamera(fitBounds(bounds, viewport?.width ?? 1000, viewport?.height ?? 820, 72, safeInsets))
    clearSelection()
  }, [clearSelection, safeInsets, scopeNodes])

  const saveCurrentView = useCallback((id: string) => {
    const now = new Date().toISOString()
    setWorkspaces((current) => current.map((workspace) => workspace.id === id ? { ...workspace, scopeId, camera, focusedNodeIds: selectedIds.length ? selectedIds : workspace.focusedNodeIds, updatedAt: now } : workspace))
    setNotice('当前画布位置和焦点已保存到工作视角')
  }, [camera, scopeId, selectedIds])

  const saveWorkspaceEditor = useCallback(({ label, intent }: { label: string; intent: WorkspaceIntent }) => {
    const now = new Date().toISOString()
    if (workspaceEditor?.mode === 'edit' && workspaceEditor.id) {
      setWorkspaces((current) => updateWorkspaceRecord(current, workspaceEditor.id!, { label, intent }, now))
      setNotice('工作视角名称与意图已更新')
    } else {
      const next = createWorkspaceRecord({ id: createId('workspace'), label, intent, camera, visibleLayers, now })
      const v06Workspace: Workspace = { ...next, scopeId, focusedNodeIds: selectedIds, contextPolicy: 'workspace-related' }
      setWorkspaces((current) => [...current, v06Workspace])
      setWorkspaceId(v06Workspace.id)
      setNotice(`${label} 已创建`)
    }
    setWorkspaceEditor(null)
  }, [camera, scopeId, selectedIds, visibleLayers, workspaceEditor])

  const duplicateWorkspace = useCallback((id: string) => {
    const result = duplicateWorkspaceRecord(workspaces, id, createId('workspace'), new Date().toISOString())
    if (!result.duplicate) return
    const duplicate: Workspace = { ...result.duplicate, scopeId: result.duplicate.scopeId ?? scopeId, focusedNodeIds: [...(result.duplicate.focusedNodeIds ?? [])], contextPolicy: result.duplicate.contextPolicy ?? 'workspace-related' }
    setWorkspaces(result.workspaces.map((workspace) => workspace.id === duplicate.id ? duplicate : workspace))
    setWorkspaceId(duplicate.id)
    setScopeId(duplicate.scopeId)
    setCamera(duplicate.camera)
    setNotice('工作视角已复制，节点与文件没有被复制')
  }, [scopeId, workspaces])

  const moveWorkspace = useCallback((id: string, direction: -1 | 1) => setWorkspaces((current) => moveWorkspaceRecord(current, id, direction)), [])
  const deleteWorkspace = useCallback((id: string) => { if (workspaces.length <= 1) setNotice('至少保留一个工作视角'); else setConfirmWorkspaceId(id) }, [workspaces.length])
  const confirmDeleteWorkspace = useCallback(() => {
    if (!confirmWorkspaceId) return
    const remaining = removeWorkspaceRecord(workspaces, confirmWorkspaceId)
    const next = remaining.find((workspace) => workspace.id === workspaceId) ?? remaining[0]
    setWorkspaces(remaining); setWorkspaceId(next.id); setScopeId(next.scopeId); setCamera(next.camera); clearSelection(); setConfirmWorkspaceId(null); setNotice('工作视角已删除，内容和本地文件未受影响')
  }, [clearSelection, confirmWorkspaceId, workspaceId, workspaces])
  const toggleLayer = useCallback((layer: NodeLayer) => setWorkspaces((current) => toggleWorkspaceLayer(current, workspaceId, layer, new Date().toISOString())), [workspaceId])

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
    if (removedScopeIds.size) setWorkspaces((current) => current.map((workspace) => removedScopeIds.has(workspace.scopeId) ? { ...workspace, scopeId, camera, focusedNodeIds: [] } : workspace))
    setGraph({ nodes: nextNodes, edges: nextEdges })
    clearSelection(); setNotice(`已删除 ${idSet.size} 个视图${scopeRoots.length ? '及其子画布' : ''} · Ctrl/Cmd+Z 可恢复`)
  }, [camera, clearSelection, edges, nodes, scopeId, scopes, setGraph])

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
    setScopes((current) => [
      ...current.map((scope) => scope.id === scopeId ? { ...scope, camera, updatedAt: new Date().toISOString() } : scope),
      result.scope,
    ])
    setScopeCreateOpen(false)
    setScopeId(result.scope.id)
    setCamera(result.scope.camera)
    setSelectedIds(result.views.map((node) => node.id))
    setSelectedEdgeId(null)
    setFocusPreviewId(null)
    setLayoutPreview(null)
    setNotice(`已创建子画布「${label}」· ${result.views.length} 个视图 · ${result.edges.length} 条内部关系`)
  }, [camera, edges, nodes, scopeId, selectedIds, setGraph])

  const togglePositionLock = useCallback((nodeId: string) => {
    setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, positionLocked: !node.positionLocked } : node))
    const node = nodes.find((item) => item.id === nodeId)
    setNotice(node?.positionLocked ? '已允许自动排列移动此对象' : '已固定位置，自动排列会避开此对象')
  }, [nodes, setNodes])

  const dropFiles = useCallback((files: File[], x: number, y: number) => {
    const created: CanvasNode[] = files.map((file, index) => {
      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
      if (previewUrl) objectUrls.current.add(previewUrl)
      return { id: createId('file'), artifactId: createId('artifact'), kind: 'source', title: file.name, subtitle: previewUrl ? '本地图片 · 临时预览' : '本地文件 · 等待本地核心服务预览', x: x + index * 28, y: y + index * 28, ...nodeDimensions('source', 'standard'), displayMode: 'standard', fileType: file.type || 'unknown', fileSize: file.size, previewUrl, scopeId, editable: /\.(pptx?|md|docx?)$/i.test(file.name) }
    })
    setNodes((current) => [...current, ...created]); setSelectedIds(created.map((node) => node.id)); setNotice(`已加入 ${created.length} 个本地文件引用，不上传、不移动原文件`)
  }, [scopeId, setNodes])

  const startRunFrom = useCallback((command: string, targetIds: string[], contextIds: string[]) => {
    if (!command.trim() || !targetIds.length) return
    runCounterRef.current += 1
    const id = `RUN-${String(runCounterRef.current).padStart(3, '0')}`
    const target = nodes.find((node) => node.id === targetIds[0])
    const processNodeId = createId('run')
    const dimensions = nodeDimensions('process', 'standard')
    const process: CanvasNode = { id: processNodeId, kind: 'process', title: `${id} · ${command.slice(0, 22)}`, subtitle: '排队中 · 正在冻结上下文', x: target ? target.x + 24 : 460, y: target ? target.y + target.height + 54 : 560, ...dimensions, displayMode: 'standard', scopeId, runStatus: 'queued', commandText: command, parentRunId: id }
    const runEdges = [
      ...targetIds.map((targetId) => ({ id: createId('edge'), from: targetId, to: processNodeId, kind: 'modify' as const })),
      ...contextIds.map((contextId) => ({ id: createId('edge'), from: contextId, to: processNodeId, kind: 'reference' as const })),
    ]
    setGraph((current) => ({ nodes: [...current.nodes, process], edges: [...current.edges, ...runEdges] }))
    setSelectedIds([])
    setFocusPreviewId(null)
    setActiveRun({ id, status: 'queued', command, targetIds, contextIds, processNodeId, commandId: createId('command'), contextSnapshotId: createId('context-snapshot'), reviewStatus: 'idle', inputResolved: false, changedFiles: [], createdAt: new Date().toISOString() })
    setComposerText('')
    setCheckpoint(false)
    setNotice('参考快照、指令和执行记录已自动保存')
  }, [nodes, scopeId, setGraph])

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
    setActiveRun((run) => run ? { ...run, status: 'running', inputResolved: true, command: `${run.command}（已确认使用 ${answer}）` } : run)
    setNotice(`已确认 ${answer}，继续同一任务`)
  }, [])

  const acceptRun = useCallback(() => {
    if (!activeRun?.pendingArtifactId || !pendingNode) return
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
    setFocusPreviewId(null)
    setActiveRun((run) => run ? { ...run, status: 'completed', reviewStatus: 'accepted' } : run)
    setCheckpoint(true)
    setNotice('已接受为当前版本，相关视图已同步')
  }, [activeRun, pendingNode, setGraph])

  const continueModify = useCallback(() => {
    if (!activeRun?.pendingArtifactId || !pendingNode) return
    setSelectedIds([pendingNode.id])
    setFocusPreviewId(null)
    setComposerText('继续修改：')
    setNotice('返回结果已设为本轮修改目标，请直接补充下一步要求')
    requestComposerFocus()
  }, [activeRun?.pendingArtifactId, pendingNode, requestComposerFocus])

  const retryRun = useCallback(() => {
    if (!activeRun) return
    startRunFrom(activeRun.command.replace(/（已确认.*?）/, ''), activeRun.targetIds, activeRun.contextIds)
    setNotice('已沿用原指令与上下文重新执行')
  }, [activeRun, startRunFrom])

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

  const handleDoubleClick = useCallback((id: string) => {
    const node = nodes.find((item) => item.id === id)
    if (!node) return
    selectNode(id)
    if (node.opensScopeId) enterScope(node.opensScopeId)
    else setFocusPreviewId(id)
  }, [enterScope, nodes, selectNode])

  const showNodeDetails = useCallback((id: string) => { selectNode(id) }, [selectNode])
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
      if (modifier && key === 's') { event.preventDefault(); saveCurrentView(workspaceId); return }
      if (modifier && key === 'o' && selectedNodes.length === 1) { event.preventDefault(); openNative(selectedNodes[0]); return }
      if (event.code === 'Space') { event.preventDefault(); setSpaceHeld(true); return }
      if (event.key === 'Escape') { if (focusPreviewId) setFocusPreviewId(null); else if (layoutPreview) setLayoutPreview(null); else clearSelection(); return }
      if (event.key === 'Enter' && selectedId) { setFocusPreviewId(selectedId); return }
      if (key === 'c') { event.preventDefault(); requestComposerFocus(); return }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedIds.length) { deleteNodes(selectedIds); return }
        if (selectedEdgeId) { setEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId)); setSelectedEdgeId(null); setNotice('关系已删除') }
      }
    }
    const release = (event: KeyboardEvent) => { if (event.code === 'Space') setSpaceHeld(false) }
    window.addEventListener('keydown', handler); window.addEventListener('keyup', release)
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('keyup', release) }
  }, [arrangeSelection, clearSelection, copySelection, createDialogOpen, deleteNodes, duplicateSelection, focusPreviewId, layoutPreview, openNative, pasteClipboard, projectCreateOpen, redo, requestComposerFocus, requestRun, runConfirmOpen, saveCurrentView, scopeCreateOpen, selectedEdgeId, selectedId, selectedIds, selectedNodes, setEdges, undo, workspaceId])

  if (!projectOpen) return <>
    <ProjectDrive projects={projects} openProjectIds={openProjectIds} onOpen={openProject} onCreate={() => setProjectCreateOpen(true)} />
    <ProjectCreateDialog open={projectCreateOpen} onCancel={() => setProjectCreateOpen(false)} onCreate={createProject} />
  </>

  const editorWorkspace = workspaceEditor?.id ? workspaces.find((workspace) => workspace.id === workspaceEditor.id) : undefined
  const nodeToRename = renameNodeId ? nodes.find((node) => node.id === renameNodeId) : undefined
  const scopePath = buildScopePath(scopes, activeScope)

  return <main className="app-shell v05 v051 v052 v053 v056 v0561 v06 v06-phase2 v06-phase3" data-testid="creative-os-app">
    <header className="tabbar">
      <button className="brand" onClick={() => setProjectOpen(false)} title="返回项目磁盘"><Layers3 size={16} /> Local Creative OS</button>
      <div className="tabs" role="tablist" aria-label="已打开项目">{openProjectIds.map((projectId) => {
        const project = projects.find((item) => item.id === projectId)
        if (!project) return null
        const active = projectId === activeProjectId
        return <div key={projectId} role="presentation" className={active ? 'project-tab active' : 'project-tab'} data-testid={`project-tab-${projectId}`}>
          <button className="project-tab-open" role="tab" aria-selected={active} title={project.localPath} onClick={() => openProject(projectId)}><span>{project.label}</span></button>
          <button className="project-tab-close" aria-label={`关闭项目 ${project.label}`} title={`关闭 ${project.label}`} onClick={() => closeProjectTab(projectId)}><X size={13} /></button>
        </div>
      })}<button className="add-tab chrome-control" aria-label="新建或打开项目" onClick={() => setProjectOpen(false)}><span>+</span></button></div>
      <button className="new-run-button" onClick={requestComposerFocus}><Play size={13} />告诉 AI</button>
      <button className={`runtime-badge ${saveStatus}`} onClick={() => setNotice(dataSource === 'runtime' ? '数据来自 Local Core \u00b7 SQLite' : '\u5f53\u524d\u4e3a Fixture \u6f14\u793a\u6a21\u5f0f')}><Cloud size={13} /> {saveStatus === 'saving' ? '\u6b63\u5728\u4fdd\u5b58\u2026' : saveStatus === 'unsaved' ? '\u672a\u4fdd\u5b58' : '\u5df2\u4fdd\u5b58'} <span>{dataSource === 'runtime' ? 'Runtime' : 'Fixture'}</span></button>
    </header>
    <section className={`scene intent-${activeWorkspace.intent ?? 'blank'}`} style={sceneStyle} data-project-id={activeProjectId} data-scope-id={scopeId} data-workspace-id={workspaceId} data-workspace-intent={activeWorkspace.intent ?? 'blank'}>
      <WorkspaceDock workspaces={workspaces} activeId={workspaceId} collapsed={dockCollapsed} onCollapsedChange={setDockCollapsed} onOverview={fitScope} onChange={changeWorkspace} onAddWorkspace={() => setWorkspaceEditor({ mode: 'create' })} onEditWorkspace={(id) => setWorkspaceEditor({ mode: 'edit', id })} onDuplicateWorkspace={duplicateWorkspace} onDeleteWorkspace={deleteWorkspace} onMoveWorkspace={moveWorkspace} onSaveView={saveCurrentView} visibleLayers={visibleLayers} onToggleLayer={toggleLayer} onOpenCreate={() => setCreateDialogOpen(true)} onArrangeCanvas={previewScopeLayout} runStatus={activeRun?.status ?? null} />
      <ProjectCanvas nodes={visibleNodes} setNodes={setNodes} edges={visibleEdges} setEdges={setEdges} camera={camera} setCamera={setCamera} selectedId={selectedId} selectedIds={selectedIds} selectedEdgeId={selectedEdgeId} setSelectedEdgeId={setSelectedEdgeId} pendingId={activeRun?.pendingArtifactId ?? null} runId={activeRun?.id ?? 'RUN-043'} runStatus={activeRun?.status ?? null} spaceHeld={spaceHeld} locked={createDialogOpen || runConfirmOpen || scopeCreateOpen} layoutPreview={layoutPreview} onSelect={selectNode} onClearSelection={clearSelection} onMarqueeSelect={selectMarquee} onSelectEdge={selectEdge} onDoubleClick={handleDoubleClick} onDetails={showNodeDetails} onCreateNodeFromAnchor={createNodeFromAnchor} onFilesDropped={dropFiles} onArrangeSelection={arrangeSelection} onCopySelection={copySelectedViews} onDuplicateSelection={duplicateSelectedViews} onCreateScopeFromSelection={() => selectedIds.length ? setScopeCreateOpen(true) : setNotice('先选择要整理进子画布的对象')} onDeleteSelection={deleteSelectedViews} onPointerWorldChange={rememberCanvasPoint} />
      <CanvasMiniMap nodes={scopeNodes} camera={camera} setCamera={setCamera} collapsed={miniMapCollapsed} onCollapsedChange={setMiniMapCollapsed} safeInsets={safeInsets} />
      <WorkRail workspace={activeWorkspace} scope={activeScope} nodes={nodes} selectedNodes={selectedNodes} focusNode={focusNode} relationNodes={relationNodes} inference={inference} activeRun={activeRun} pendingNode={pendingNode} collapsed={workRail.collapsed} width={effectiveRailWidth} composerText={composerText} composerRef={composerRef} composerFocusRequest={composerFocusRequest} onRequestComposerFocus={requestComposerFocus} onCollapse={() => setWorkRail((current) => ({ ...current, collapsed: true }))} onExpand={() => setWorkRail((current) => ({ ...current, collapsed: false }))} onComposerChange={setComposerText} onSend={requestRun} onSelectTarget={selectPrimaryTarget} onToggleContext={toggleContext} onMoveRole={moveRole} onFocusPreview={setFocusPreviewId} onEnterScope={enterScope} onContinue={continueRun} onAccept={acceptRun} onRetry={retryRun} onContinueModify={continueModify} onOpenNative={openNative} onTogglePositionLock={togglePositionLock} onShowRun={clearSelection} />
      {activeRun && <button className={`run-pill ${activeRun.status}`} onClick={() => { clearSelection(); setWorkRail((current) => ({ ...current, collapsed: false })) }}><Play size={13} /> {activeRun.id} · {runStatusLabel[activeRun.status]}</button>}
      {checkpoint && <div className="checkpoint"><Check size={15} /> 已形成稳定修改集 <button onClick={() => { setCheckpoint(false); setNotice('检查点已创建') }}>创建检查点</button><button className="quiet" onClick={() => setCheckpoint(false)}>稍后</button></div>}
      <nav className="scene-title v06-breadcrumbs" aria-label="画布层级">{scopePath.map((scope, index) => {
        const current = index === scopePath.length - 1
        return <button key={scope.id} data-testid={`scope-crumb-${scope.id}`} aria-current={current ? 'page' : undefined} disabled={current} onClick={() => enterScope(scope.id)}>{index > 0 && <span>/</span>}{index === 0 ? activeProject.label : scope.label}</button>
      })}{activeScope.parentScopeId && <button className="scope-back" data-testid="scope-back" onClick={leaveScope}>返回上级</button>}</nav>
      {!selectedIds.length && !activeRun && <div className="shortcut-hint"><Command size={12} /> 单击内容 · C 输入指令 · Ctrl/Cmd+Enter 执行</div>}
      {layoutPreview && <div className="layout-preview-banner"><span>预览自动布局 · 只移动当前子画布中的视图</span><button onClick={applyLayout}>应用</button><button onClick={() => setLayoutPreview(null)}>取消</button></div>}
      {notice && <div data-testid="toast" className="notice" role="status" aria-live="polite">{notice}</div>}
      <ScopeCreateDialog open={scopeCreateOpen} selectedCount={selectedIds.length} leftInset={safeInsets.left} rightInset={effectiveRailWidth} onCancel={() => setScopeCreateOpen(false)} onCreate={createScopeFromSelection} />
      <RunConfirmDialog open={runConfirmOpen} command={composerText} nodes={nodes} inference={inference} leftInset={safeInsets.left} rightInset={effectiveRailWidth} onCommandChange={setComposerText} onSelectTarget={selectPrimaryTarget} onCancel={() => setRunConfirmOpen(false)} onConfirm={confirmRun} />
      <CreateContentDialog open={createDialogOpen} leftInset={safeInsets.left} rightInset={effectiveRailWidth} onCancel={() => setCreateDialogOpen(false)} onCreate={createContentFromDialog} />
      {workspaceEditor && <WorkspaceDialog mode={workspaceEditor.mode} workspace={editorWorkspace} currentCamera={camera} onCancel={() => setWorkspaceEditor(null)} onSave={saveWorkspaceEditor} />}
      {nodeToRename && <InlineNodeRename node={nodeToRename} camera={camera} onCancel={() => setRenameNodeId(null)} onSave={(value) => renameNodeTitle(nodeToRename.id, value)} />}
      {confirmWorkspaceId && <ConfirmDialog title="删除这个工作视角？" description="只删除语义视角和镜头位置，不删除内容、节点或本地文件。" onCancel={() => setConfirmWorkspaceId(null)} onConfirm={confirmDeleteWorkspace} />}
      <button className="prototype-reset" onClick={() => { clearPrototypeState(activeProjectId); window.location.reload() }}>重置演示数据</button>
    </section>
  </main>
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
