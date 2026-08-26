import { useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentProps, CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { ProjectCanvas } from '../canvas/ProjectCanvas'
import { CanvasMiniMap } from '../canvas/CanvasMiniMap'
import { CapabilityPopover } from './CapabilityPopover'
import { NodeInfoPopover } from '../canvas/NodeInfoPopover'
import { AgentContextSurface } from './AgentContextSurface'
import { WorkspaceRailVNext } from './WorkspaceRailVNext'
import { SurfaceDock, type SurfaceId } from './SurfaceDock'
import { ProjectionSurface } from '../surfaces/ProjectionSurfaces'
import { CanvasEmptyState, FirstArtifactGuide } from '../onboarding/CanvasEmptyState'
import { SurfaceContextMenu, type SurfaceContextMenuAction, type SurfaceContextMenuItem } from './SurfaceContextMenu'
import { SurfaceAgentNode, type SurfaceAgentRunState, type SurfaceAgentSubmission, type SurfaceAgentSubmissionResult } from './SurfaceAgentNode'
import { ProjectResumeHint, SurfaceDepositHint, type DepositHintItem } from './BoundaryHints'
import { CANVAS_IDLE_HINT_MS, loadBoundaryHintMemory, recordDepositHint, saveBoundaryHintMemory, shouldShowDepositHint, type BoundaryHintMemory } from '../../runtime/boundaryHintState'

export interface CanvasSceneHostProps {
  readonly sceneStyle: CSSProperties
  readonly sceneData: { readonly projectId: string; readonly scopeId: string | null; readonly workspaceId: string | null; readonly workspaceIntent: string }
  readonly capability: ComponentProps<typeof CapabilityPopover> | null
  readonly workspaceRail: ComponentProps<typeof WorkspaceRailVNext>
  readonly surface: SurfaceId
  readonly canvas: ComponentProps<typeof ProjectCanvas>
  readonly projection: ComponentProps<typeof ProjectionSurface>
  readonly surfaceDock: ComponentProps<typeof SurfaceDock>
  readonly miniMap: ComponentProps<typeof CanvasMiniMap>
  readonly breadcrumbs: { readonly projectLabel: string; readonly items: ReadonlyArray<{ readonly id: string; readonly label: string; readonly current: boolean }>; readonly onEnter: (id: string) => void; readonly onBack: (() => void) | null }
  readonly shortcutHintVisible: boolean
  readonly runPill: { readonly status: string; readonly label: string; readonly onClick: () => void } | null
  readonly layoutPreview: { readonly onApply: () => void; readonly onCancel: () => void } | null
  readonly notice: string | null
  readonly nodeInfo: ComponentProps<typeof NodeInfoPopover> | null
  readonly agentSurface: ComponentProps<typeof AgentContextSurface> | null
  readonly emptyState: ComponentProps<typeof CanvasEmptyState> | null
  readonly firstArtifactGuide: ComponentProps<typeof FirstArtifactGuide> | null
  readonly surfaceMenu?: {
    readonly items: (surface: SurfaceId) => readonly SurfaceContextMenuItem[]
    readonly onAction: (action: SurfaceContextMenuAction) => void
    readonly onAgentPrompt: (input: SurfaceAgentSubmission) => Promise<SurfaceAgentSubmissionResult | void> | SurfaceAgentSubmissionResult | void
    readonly onReadAgentRun?: (runId: string) => Promise<SurfaceAgentRunState | null>
  }
  readonly resumeHint?: { readonly title: string; readonly subtitle?: string; readonly onContinue: () => void; readonly onDismiss: () => void } | null
  readonly idleHint?: { readonly title: string; readonly subtitle?: string } | null
  readonly depositHints?: {
    readonly context: readonly DepositHintItem[]
    readonly workflow: readonly DepositHintItem[]
    readonly contextEvidenceKey: string
    readonly workflowEvidenceKey: string
    readonly contextReflection?: string
    readonly workflowReflection?: string
    readonly onOrganize: (kind: 'context' | 'workflow') => void
    readonly evaluate?: (kind: 'context' | 'workflow', evidenceKey: string, items: readonly DepositHintItem[], reflection?: string) => Promise<{ readonly shouldShow: boolean; readonly reason?: string }>
  }
}

/** Persistent shell. Project/Scope/Selection persist while each Lens owns its renderer. */
export function CanvasSceneHost(props: CanvasSceneHostProps) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [agentNode, setAgentNode] = useState<{ x: number; y: number; seedPrompt?: string; contextLabel?: string } | null>(null)
  const [resumeDismissed, setResumeDismissed] = useState(false)
  const [contextHintVisible, setContextHintVisible] = useState(false)
  const [workflowHintVisible, setWorkflowHintVisible] = useState(false)
  const [hintMemory, setHintMemory] = useState<BoundaryHintMemory>(() => loadBoundaryHintMemory(props.sceneData.projectId))
  const [now, setNow] = useState(() => Date.now())
  const [sessionStartedAt, setSessionStartedAt] = useState(() => Date.now())
  const [lastMeaningfulActivityAt, setLastMeaningfulActivityAt] = useState(() => Date.now())
  const [idleEpisodeHintShown, setIdleEpisodeHintShown] = useState(false)
  const boundaryEvaluatedRef = useRef(new Set<string>())
  const [contextEvaluatorReason, setContextEvaluatorReason] = useState<string | undefined>()
  const [workflowEvaluatorReason, setWorkflowEvaluatorReason] = useState<string | undefined>()

  useEffect(() => {
    setMenu(null)
    setAgentNode(null)
    setResumeDismissed(false)
    setContextHintVisible(false)
    setWorkflowHintVisible(false)
    const openedAt = Date.now()
    setHintMemory(loadBoundaryHintMemory(props.sceneData.projectId))
    setSessionStartedAt(openedAt)
    setLastMeaningfulActivityAt(openedAt)
    setIdleEpisodeHintShown(false)
    boundaryEvaluatedRef.current.clear()
    setContextEvaluatorReason(undefined)
    setWorkflowEvaluatorReason(undefined)
  }, [props.sceneData.projectId])


  useEffect(() => {
    setMenu(null)
    setAgentNode(null)
  }, [props.surface])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    const onVisibility = () => { if (document.visibilityState === 'visible') setNow(Date.now()) }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility) }
  }, [])

  const capabilityKind = props.surface === 'arrange' ? 'arrange' : props.surface === 'workflow' ? 'workflow' : 'context'
  const contextItems = props.depositHints?.context ?? []
  const workflowItems = props.depositHints?.workflow ?? []
  const contextEvidenceKey = props.depositHints?.contextEvidenceKey ?? ''
  const workflowEvidenceKey = props.depositHints?.workflowEvidenceKey ?? ''

  useEffect(() => {
    if (capabilityKind !== 'context' || !contextItems.length || contextHintVisible) return
    if (!shouldShowDepositHint({ kind: 'context', now, evidenceKey: contextEvidenceKey, memory: hintMemory, sessionStartedAt })) return
    const evaluationKey = `context:${contextEvidenceKey}`
    if (boundaryEvaluatedRef.current.has(evaluationKey)) return
    boundaryEvaluatedRef.current.add(evaluationKey)
    const evaluate = props.depositHints?.evaluate
    if (!evaluate) return
    void evaluate('context', contextEvidenceKey, contextItems, props.depositHints?.contextReflection).then((result) => {
      if (!result.shouldShow) return
      const shownAt = Date.now()
      const next = recordDepositHint({ kind: 'context', now: shownAt, evidenceKey: contextEvidenceKey, memory: hintMemory })
      setHintMemory(next)
      saveBoundaryHintMemory(props.sceneData.projectId, next)
      setContextEvaluatorReason(result.reason)
      setContextHintVisible(true)
    }).catch(() => undefined)
  }, [capabilityKind, contextEvidenceKey, contextHintVisible, contextItems, hintMemory, now, props.depositHints, props.sceneData.projectId, sessionStartedAt])

  useEffect(() => {
    if (capabilityKind !== 'workflow' || !workflowItems.length || workflowHintVisible) return
    if (!shouldShowDepositHint({ kind: 'workflow', now, evidenceKey: workflowEvidenceKey, memory: hintMemory, sessionStartedAt })) return
    const evaluationKey = `workflow:${workflowEvidenceKey}`
    if (boundaryEvaluatedRef.current.has(evaluationKey)) return
    boundaryEvaluatedRef.current.add(evaluationKey)
    const evaluate = props.depositHints?.evaluate
    if (!evaluate) return
    void evaluate('workflow', workflowEvidenceKey, workflowItems, props.depositHints?.workflowReflection).then((result) => {
      if (!result.shouldShow) return
      const shownAt = Date.now()
      const next = recordDepositHint({ kind: 'workflow', now: shownAt, evidenceKey: workflowEvidenceKey, memory: hintMemory })
      setHintMemory(next)
      saveBoundaryHintMemory(props.sceneData.projectId, next)
      setWorkflowEvaluatorReason(result.reason)
      setWorkflowHintVisible(true)
    }).catch(() => undefined)
  }, [capabilityKind, hintMemory, now, props.depositHints, props.sceneData.projectId, sessionStartedAt, workflowEvidenceKey, workflowHintVisible, workflowItems])

  const markMeaningfulActivity = () => {
    setLastMeaningfulActivityAt(Date.now())
    setIdleEpisodeHintShown(false)
  }

  const idleHintVisible = capabilityKind === 'arrange'
    && props.idleHint !== null && props.idleHint !== undefined
    && !idleEpisodeHintShown
    && now - lastMeaningfulActivityAt >= CANVAS_IDLE_HINT_MS
    && (typeof document === 'undefined' || document.visibilityState === 'visible')
    && !menu && !agentNode
    && (props.resumeHint === null || props.resumeHint === undefined || resumeDismissed)

  const openSurfaceMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!props.surfaceMenu) return
    const target = event.target as HTMLElement
    const interactive = target.closest('button, input, textarea, select, summary, a, [contenteditable="true"], [data-node-id], [data-context-view], .lcos-spatial-placement, .lcos-workflow-node, .lcos-signal-segment, .lcos-context-project-dot, .lcos-context-dot-node, .lcos-workflow-edge-group, .lcos-boundary-hint, .lcos-surface-agent-node')
    if (interactive) return
    event.preventDefault()
    markMeaningfulActivity()
    const rect = event.currentTarget.getBoundingClientRect()
    setMenu({ x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - 240)), y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - 280)) })
  }

  const runMenuAction = (action: SurfaceContextMenuAction) => {
    if (action === 'summon-agent') {
      if (capabilityKind === 'arrange') return
      const point = menu ?? { x: 170, y: 120 }
      setAgentNode({ x: point.x, y: point.y, contextLabel: `${capabilityKind === 'context' ? '上下文' : '工作流'} · ${props.projection.selectedIds?.length ?? 0} 项选择` })
      return
    }
    if (action === 'review-deposits') {
      if (capabilityKind === 'context' && contextItems.length) setContextHintVisible(true)
      if (capabilityKind === 'workflow' && workflowItems.length) setWorkflowHintVisible(true)
      return
    }
    props.surfaceMenu?.onAction(action)
  }

  const title = capabilityKind === 'arrange' ? '主画布' : capabilityKind === 'context' ? '上下文' : '工作流'
  const agentContextLabel = `${title} · ${props.projection.selectedIds?.length ?? props.canvas.selectedIds?.length ?? 0} 项选择`
  // B-2 互斥：画布选中集（arrange 画布 + 投影视图并集）。
  // 同一节点同一时刻只显示一个浮层：选中态由 selection-toolbar 负责，详情 Popover 让位。
  const selectedNodeIds = new Set([...(props.canvas.selectedIds ?? []), ...(props.projection.selectedIds ?? [])])
  const contextSeed = '整理最近项目变化、Agent/Chat 对话与材料，提出值得沉淀到 Context 的内容。只做提案，不自动修改项目结构。'
  const workflowSeed = '回看最近项目工作、Agent/Chat 对话和修改记录，提出已经重复出现、值得保存为 Workflow/Skill 的方法。只做提案，不自动固化流程。'

  return <section className={`scene lcos-scene intent-${props.sceneData.workspaceIntent} ${props.agentSurface ? 'agent-browser-mode' : ''}`} style={props.sceneStyle} data-project-id={props.sceneData.projectId} data-scope-id={props.sceneData.scopeId ?? undefined} data-workspace-id={props.sceneData.workspaceId ?? 'project-overview'} data-workspace-intent={props.sceneData.workspaceIntent}>
    {props.capability && <CapabilityPopover {...props.capability}/>}
    <WorkspaceRailVNext {...props.workspaceRail}/>
    {props.surface === 'arrange' && <nav className="canvas-context-bar" aria-label="当前位置与画布状态">
      {props.breadcrumbs.onBack && <button type="button" className="canvas-context-back" aria-label="返回上一层" title="返回上一层" onClick={props.breadcrumbs.onBack}><ArrowLeft size={14}/></button>}
      <div className="canvas-context-path">
        {props.breadcrumbs.items.map((item, index) => <span key={item.id}>{index > 0 && <ChevronRight size={11}/>}<button type="button" className={item.current ? 'current' : ''} disabled={item.current} onClick={() => props.breadcrumbs.onEnter(item.id)}>{item.label}</button></span>)}
      </div>
      {props.shortcutHintVisible && <small className="canvas-context-hint">双击打开 · C 创建 · Ctrl+A 全选</small>}
      {props.runPill && <button type="button" className={`canvas-run-pill status-${props.runPill.status}`} onClick={props.runPill.onClick}><i/>{props.runPill.label}</button>}
    </nav>}
    <div className="vnext-surface-host lcos-surface-host" data-surface={props.surface} data-lcos-context-menu-zone="true" onContextMenu={(event) => { event.preventDefault(); openSurfaceMenu(event) }} onPointerDown={() => { setMenu(null); markMeaningfulActivity() }}>
      <div className="lcos-surface-mount" data-surface-mount={props.surface}>
        {props.surface === 'arrange' ? <ProjectCanvas {...props.canvas}/> : <ProjectionSurface {...props.projection}/>}
      </div>
      {props.surface === 'arrange' && props.emptyState && <CanvasEmptyState {...props.emptyState}/>}
      {menu && props.surfaceMenu && <SurfaceContextMenu x={menu.x} y={menu.y} title={title} items={props.surfaceMenu.items(props.surface)} onAction={runMenuAction} onClose={() => setMenu(null)}/>}
      {agentNode && capabilityKind !== 'arrange' && <SurfaceAgentNode x={agentNode.x} y={agentNode.y} contextLabel={agentNode.contextLabel ?? agentContextLabel} seedPrompt={agentNode.seedPrompt} surface={capabilityKind} onSubmit={props.surfaceMenu?.onAgentPrompt ?? (() => undefined)} onReadRun={props.surfaceMenu?.onReadAgentRun} onClose={() => setAgentNode(null)}/>}
    </div>
    {props.surface === 'arrange' && !props.emptyState && <div className="canvas-hud lcos-canvas-hud" data-testid="canvas-hud" onContextMenu={(event) => event.preventDefault()}><CanvasMiniMap {...props.miniMap}/></div>}
    {props.surface === 'arrange' && props.firstArtifactGuide && <FirstArtifactGuide {...props.firstArtifactGuide}/>}
    <SurfaceDock {...props.surfaceDock}/>
    {props.agentSurface && <AgentContextSurface {...props.agentSurface}/>}
    {props.resumeHint && capabilityKind === 'arrange' && !resumeDismissed && <ProjectResumeHint {...props.resumeHint} onDismiss={() => { setResumeDismissed(true); props.resumeHint?.onDismiss() }}/>}
    {idleHintVisible && props.idleHint && <ProjectResumeHint eyebrow="刚才这段" title={props.idleHint.title} subtitle={props.idleHint.subtitle} onDismiss={() => setIdleEpisodeHintShown(true)}/>}
    {contextHintVisible && capabilityKind === 'context' && contextItems.length > 0 && <SurfaceDepositHint kind="context" items={contextItems} reflection={contextEvaluatorReason ?? props.depositHints?.contextReflection} onOrganize={() => { setContextHintVisible(false); props.depositHints?.onOrganize('context'); setAgentNode({ x: 180, y: 120, seedPrompt: contextSeed, contextLabel: `上下文 · ${props.projection.selectedIds?.length ?? 0} 项选择` }) }} onDismiss={() => setContextHintVisible(false)}/>}
    {workflowHintVisible && capabilityKind === 'workflow' && workflowItems.length > 0 && <SurfaceDepositHint kind="workflow" items={workflowItems} reflection={workflowEvaluatorReason ?? props.depositHints?.workflowReflection} onOrganize={() => { setWorkflowHintVisible(false); props.depositHints?.onOrganize('workflow'); setAgentNode({ x: 180, y: 120, seedPrompt: workflowSeed, contextLabel: `工作流 · ${props.projection.selectedIds?.length ?? 0} 项选择` }) }} onDismiss={() => setWorkflowHintVisible(false)}/>}
    {/* B-2：节点已被选中时 selection-toolbar 正在显示，详情 Popover 与其互斥（同节点不叠两个浮层）。 */}
    {props.nodeInfo && !selectedNodeIds.has(props.nodeInfo.node.id) && <NodeInfoPopover {...props.nodeInfo}/>}
    {props.layoutPreview && <div className="layout-preview-banner lcos-layout-preview"><span>预览布局</span><button onClick={props.layoutPreview.onApply}>应用</button><button onClick={props.layoutPreview.onCancel}>取消</button></div>}
  </section>
}
