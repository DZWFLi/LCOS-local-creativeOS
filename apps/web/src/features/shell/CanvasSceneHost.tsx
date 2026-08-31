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
import { UnifiedExecutionComposer } from '../execution/UnifiedExecutionComposer'
import { explicitExecutionReferenceIds, proposalCompatibilityBlockReason, referenceCandidates, resolveComposerReceiver } from '../execution/commandDraft'
import type { SharedComposerCommandState, SurfaceExecutionSubmission, SurfaceExecutionSubmissionResult } from '../execution/surfaceExecution'
import type { ConnectedConversationV1, RuntimeProviderStatus } from '@local-creative-os/contracts'
import { ProjectResumeHint, SurfaceDepositHint, type DepositHintItem } from './BoundaryHints'
import { CANVAS_IDLE_HINT_MS, loadBoundaryHintMemory, recordDepositHint, saveBoundaryHintMemory, shouldShowDepositHint, type BoundaryHintMemory } from '../../runtime/boundaryHintState'
import { referencePickModifier } from '../spatial/pointerInteractionLanguage'
import { dismissTop, queryStack } from '../ui/overlayStack'

type SceneContextMenuState =
  | { readonly kind: 'surface'; readonly x: number; readonly y: number }
  | { readonly kind: 'object'; readonly x: number; readonly y: number; readonly anchorId: string; readonly ids: readonly string[] }

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
  }
  readonly surfaceExecution?: {
    readonly command: SharedComposerCommandState
    readonly receivers: readonly ConnectedConversationV1[]
    readonly activeReceiverId: string | null
    readonly providers: readonly RuntimeProviderStatus[]
    readonly busy: boolean
    readonly onSubmit: (input: SurfaceExecutionSubmission) => Promise<SurfaceExecutionSubmissionResult | void> | SurfaceExecutionSubmissionResult | void
    readonly onReadReach?: (connectedConversationId: string) => Promise<number>
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
  const [menu, setMenu] = useState<SceneContextMenuState | null>(null)
  const [agentNode, setAgentNode] = useState<{ x: number; y: number; seedPrompt?: string; contextLabel?: string } | null>(null)
  const readReachRef = useRef(props.surfaceExecution?.onReadReach ?? null)
  const [surfaceReachCount, setSurfaceReachCount] = useState(0)
  const [referenceModifierHeld, setReferenceModifierHeld] = useState(false)
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
    props.surfaceExecution?.command.onFinishReferencePick()
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
    props.surfaceExecution?.command.onFinishReferencePick()
  }, [props.surface])

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

  const menuPoint = (event: ReactMouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - 240)),
      y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - 280)),
    }
  }

  const sceneSelectedIds = props.surface === 'arrange' ? (props.canvas.selectedIds ?? []) : props.projection.selectedIds
  const sceneNodes = props.surface === 'arrange' ? props.canvas.nodes : props.projection.nodes
  const sceneSelect = props.surface === 'arrange' ? props.canvas.onSelect : props.projection.onSelect

  const openSurfaceMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const objectTarget = target.closest<HTMLElement>('[data-node-id]')
    if (objectTarget?.dataset.nodeId) {
      event.preventDefault()
      markMeaningfulActivity()
      const overlayStack = queryStack()
      const top = overlayStack[overlayStack.length - 1]
      if (top?.kind === 'orbit') dismissTop()
      const anchorId = objectTarget.dataset.nodeId
      const ids = sceneSelectedIds.includes(anchorId) && sceneSelectedIds.length > 1 ? [...sceneSelectedIds] : [anchorId]
      if (!sceneSelectedIds.includes(anchorId) || sceneSelectedIds.length !== ids.length) sceneSelect(anchorId, false)
      setMenu({ kind: 'object', ...menuPoint(event), anchorId, ids })
      return
    }
    if (!props.surfaceMenu) return
    const interactive = target.closest('button, input, textarea, select, summary, a, [contenteditable="true"], [data-context-view], .lcos-spatial-placement, .lcos-workflow-node, .lcos-signal-segment, .lcos-context-project-dot, .lcos-context-dot-node, .lcos-workflow-edge-group, .lcos-boundary-hint, .lcos-unified-execution-composer')
    if (interactive) return
    event.preventDefault()
    markMeaningfulActivity()
    setMenu({ kind: 'surface', ...menuPoint(event) })
  }

  const openSurfaceExecution = (input: { readonly x: number; readonly y: number; readonly seedPrompt?: string; readonly contextLabel?: string }) => {
    if (capabilityKind === 'arrange' || !props.surfaceExecution) return
    setAgentNode(input)
    if (input.seedPrompt && !props.surfaceExecution.command.prompt.trim()) props.surfaceExecution.command.onPromptChange(input.seedPrompt)
    props.surfaceExecution.command.onFinishReferencePick()
  }

  const runMenuAction = (action: SurfaceContextMenuAction) => {
    if (action === 'summon-agent') {
      if (capabilityKind === 'arrange') return
      const point = menu ?? { x: 170, y: 120 }
      openSurfaceExecution({ x: point.x, y: point.y, contextLabel: `${capabilityKind === 'context' ? '上下文' : '工作流'} · ${props.projection.selectedIds?.length ?? 0} 项选择` })
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
  // B-2 互斥：画布选中集（arrange 画布 + 投影视图并集）。
  // 同一节点同一时刻只显示一个浮层：选中态由 ObjectOrbit / Selection Field controls 负责，详情 Popover 让位。
  const selectedNodeIds = new Set([...(props.canvas.selectedIds ?? []), ...(props.projection.selectedIds ?? [])])
  const contextSeed = '整理最近项目变化、Agent/Chat 对话与材料，提出值得沉淀到 Context 的内容。只做提案，不自动修改项目结构。'
  const workflowSeed = '回看最近项目工作、Agent/Chat 对话和修改记录，提出已经重复出现、值得保存为 Workflow/Skill 的方法。只做提案，不自动固化流程。'

  const surfaceReceivers = props.surfaceExecution?.receivers ?? []
  const command = props.surfaceExecution?.command
  const objectMenuNodes = menu?.kind === 'object'
    ? menu.ids.flatMap((id) => { const node = sceneNodes.find((candidate) => candidate.id === id); return node ? [node] : [] })
    : []
  const referenceableMenuIds = objectMenuNodes.filter((node) => node.entityKind !== 'conversation').map((node) => node.id)
  const allMenuReferences = referenceableMenuIds.length > 0 && referenceableMenuIds.every((id) => command?.referenceIds.includes(id))
  const canRenameObject = menu?.kind === 'object' && props.surface === 'arrange' && menu.ids.length === 1 && Boolean(props.canvas.onRenameSelection)
  const canCopyObject = menu?.kind === 'object' && props.surface === 'arrange' && Boolean(props.canvas.onCopySelection)
  const removableProjectionSurface = props.surface === 'workflow' || props.surface === 'context-graph' || props.surface === 'context-space' || props.surface === 'context-flow' || props.surface === 'context-tree' || props.surface === 'outline'
  const canRemoveProjection = menu?.kind === 'object' && (props.surface === 'arrange' ? Boolean(props.canvas.onDeleteSelection) : removableProjectionSurface && Boolean(props.projection.onRemoveProjection))
  const canDuplicateView = menu?.kind === 'object' && props.surface === 'arrange' && Boolean(props.canvas.onDuplicateSelection)
  const objectMenuItems: readonly SurfaceContextMenuItem[] = menu?.kind === 'object' ? [
    ...(canRenameObject ? [{ action: 'rename' as const, label: '重命名' }] : []),
    ...(canCopyObject ? [{ action: 'copy' as const, label: menu.ids.length > 1 ? '复制这些对象' : '复制' }] : []),
    ...(command && referenceableMenuIds.length > 0
      ? [{ action: allMenuReferences ? 'remove-reference' as const : 'add-reference' as const, label: allMenuReferences ? (referenceableMenuIds.length > 1 ? '从参考移除这些对象' : '从参考移除') : '加入这次参考', dividerBefore: canRenameObject || canCopyObject }]
      : []),
    ...(canDuplicateView ? [{ action: 'duplicate-view' as const, label: menu.ids.length > 1 ? '额外 View' : '创建额外 View', dividerBefore: true }] : []),
    ...(canRemoveProjection ? [{ action: 'remove-projection' as const, label: menu.ids.length > 1 ? '移出这些投影' : '移出当前投影', dividerBefore: !canDuplicateView, danger: true }] : []),
  ] : []

  const runObjectMenuAction = (action: SurfaceContextMenuAction) => {
    if (menu?.kind !== 'object') return
    const ids = [...menu.ids]
    if (action === 'rename' && props.surface === 'arrange') { props.canvas.onRenameSelection?.(); return }
    if (action === 'copy' && props.surface === 'arrange') { props.canvas.onCopySelection?.(); return }
    if ((action === 'add-reference' || action === 'remove-reference') && command) {
      const removing = action === 'remove-reference'
      for (const id of referenceableMenuIds) {
        const referenced = command.referenceIds.includes(id)
        if ((removing && referenced) || (!removing && !referenced)) command.onToggleReference(id)
      }
      return
    }
    if (action === 'duplicate-view' && props.surface === 'arrange') { props.canvas.onDuplicateSelection?.(); return }
    if (action === 'remove-projection') {
      if (props.surface === 'arrange') props.canvas.onDeleteSelection?.()
      else props.projection.onRemoveProjection?.(ids)
    }
  }
  const surfaceSelectedNodes = (command?.selectionIds ?? props.projection.selectedIds).map((id) => (command?.nodes ?? props.projection.nodes).find((node) => node.id === id)).filter((node): node is NonNullable<typeof node> => Boolean(node))
  const defaultSurfaceReceiver = resolveComposerReceiver(surfaceSelectedNodes, surfaceReceivers, props.surfaceExecution?.activeReceiverId ?? null)
  const effectiveSurfaceReceiverId = command?.receiverId ?? defaultSurfaceReceiver.receiver?.connectedConversationId ?? null
  const surfaceResultSlots = surfaceSelectedNodes.filter((node) => node.resultSlotId && node.resultSlotStatus !== 'materialized')
  const surfaceResultSlot = surfaceResultSlots.length === 1 ? surfaceResultSlots[0] ?? null : null
  const surfaceTarget = command?.intent === 'revise' && surfaceSelectedNodes.length === 1 ? surfaceSelectedNodes[0] ?? null : null
  const surfaceExecutionReferenceIds = explicitExecutionReferenceIds(command?.referenceIds ?? [], surfaceTarget?.id)
  const surfaceReferenceCandidates = referenceCandidates(surfaceExecutionReferenceIds, command?.nodes ?? props.projection.nodes, effectiveSurfaceReceiverId, surfaceReceivers)
  const surfaceExecutionBlockedReason = agentNode && props.surfaceExecution ? (() => {
    if (surfaceResultSlots.length > 1) return '一次处理只能写入一个空白结果，请只保留一个结果位。'
    const proposalGap = proposalCompatibilityBlockReason({
      receiverId: effectiveSurfaceReceiverId,
      activeReceiverId: props.surfaceExecution.activeReceiverId,
      receivers: surfaceReceivers,
      references: surfaceReferenceCandidates,
    })
    if (proposalGap) return proposalGap
    return undefined
  })() : undefined

  useEffect(() => {
    readReachRef.current = props.surfaceExecution?.onReadReach ?? null
  }, [props.surfaceExecution?.onReadReach])

  useEffect(() => {
    const readReach = readReachRef.current
    if (!agentNode || !readReach || !effectiveSurfaceReceiverId) {
      setSurfaceReachCount((current) => current === 0 ? current : 0)
      return
    }
    let cancelled = false
    void readReach(effectiveSurfaceReceiverId)
      .then((count) => { if (!cancelled) setSurfaceReachCount((current) => current === count ? current : count) })
      .catch(() => { if (!cancelled) setSurfaceReachCount((current) => current === 0 ? current : 0) })
    return () => { cancelled = true }
  }, [agentNode, effectiveSurfaceReceiverId])

  const surfaceReferencePickIntent = Boolean(command && (command.referencePickActive || (agentNode && referenceModifierHeld)))
  const pickSurfaceReference = (id: string) => {
    if (!command) return
    const node = (command.nodes ?? props.projection.nodes).find((candidate) => candidate.id === id)
    if (node?.entityKind === 'conversation' && node.conversation) {
      const receiver = surfaceReceivers.find((candidate) => candidate.conversationSessionId === node.conversation?.id)
      if (receiver) command.onReceiverChange(receiver.id)
      return
    }
    command.onToggleReference(id)
  }
  const projectionForRender = surfaceReferencePickIntent
    ? { ...props.projection, onSelect: (id: string) => pickSurfaceReference(id), onDoubleClick: (id: string) => pickSurfaceReference(id) }
    : props.projection

  const submitSurfaceExecution = () => {
    if (!props.surfaceExecution || !command || !agentNode || capabilityKind === 'arrange' || !effectiveSurfaceReceiverId || surfaceExecutionBlockedReason || !command.prompt.trim()) return
    void Promise.resolve(props.surfaceExecution.onSubmit({
      prompt: command.prompt.trim(),
      surface: capabilityKind,
      selectionIds: command.selectionIds,
      receiverId: effectiveSurfaceReceiverId,
      referenceIds: command.referenceIds,
      provider: command.provider,
      intent: surfaceResultSlot ? 'create' : command.intent,
      resultPolicy: surfaceResultSlot ? 'create_artifact' : command.resultPolicy,
      ...(surfaceResultSlot?.resultSlotId ? { resultSlotId: surfaceResultSlot.resultSlotId } : {}),
    })).then((result) => {
      if (result?.runId) command.onPromptChange('')
    })
  }

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
    <div className={`vnext-surface-host lcos-surface-host ${surfaceReferencePickIntent ? 'is-reference-pick' : ''}`} data-pointer-state={surfaceReferencePickIntent ? 'reference-pick' : 'normal'} data-surface={props.surface} data-lcos-context-menu-zone="true" onContextMenu={(event) => { event.preventDefault(); openSurfaceMenu(event) }} onPointerDown={() => { setMenu(null); markMeaningfulActivity() }}>
      <div className="lcos-surface-mount" data-surface-mount={props.surface}>
        {props.surface === 'arrange' ? <ProjectCanvas {...props.canvas}/> : <ProjectionSurface {...projectionForRender}/>}
      </div>
      {props.surface === 'arrange' && props.emptyState && <CanvasEmptyState {...props.emptyState}/>}
      {menu?.kind === 'surface' && props.surfaceMenu && <SurfaceContextMenu x={menu.x} y={menu.y} title={title} items={props.surfaceMenu.items(props.surface)} onAction={runMenuAction} onClose={() => setMenu(null)}/>}
      {menu?.kind === 'object' && objectMenuItems.length > 0 && <SurfaceContextMenu x={menu.x} y={menu.y} title={objectMenuNodes.length > 1 ? `${objectMenuNodes.length} 项选择` : (objectMenuNodes[0]?.title ?? '对象')} contextLabel={objectMenuNodes.length > 1 ? 'Selection' : '对象'} items={objectMenuItems} onAction={runObjectMenuAction} onClose={() => setMenu(null)}/>}
      {agentNode && capabilityKind !== 'arrange' && props.surfaceExecution && <UnifiedExecutionComposer
        nodes={props.surfaceExecution.command.nodes}
        selectedIds={props.surfaceExecution.command.selectionIds}
        referenceIds={props.surfaceExecution.command.referenceIds}
        receivers={surfaceReceivers}
        activeReceiverId={props.surfaceExecution.activeReceiverId}
        receiverId={effectiveSurfaceReceiverId}
        reachCount={surfaceReachCount}
        x={agentNode.x}
        y={agentNode.y}
        prompt={props.surfaceExecution.command.prompt}
        provider={props.surfaceExecution.command.provider}
        createAsNewNode={props.surfaceExecution.command.intent === 'create'}
        intent={surfaceResultSlot ? 'create' : props.surfaceExecution.command.intent}
        resultPolicy={surfaceResultSlot ? 'create_artifact' : props.surfaceExecution.command.resultPolicy}
        providers={props.surfaceExecution.providers}
        busy={props.surfaceExecution.busy}
        referencePickActive={props.surfaceExecution.command.referencePickActive}
        {...(surfaceExecutionBlockedReason ? { executionBlockedReason: surfaceExecutionBlockedReason } : {})}
        {...(surfaceResultSlot?.resultSlotId ? { resultSlot: { id: surfaceResultSlot.resultSlotId, status: surfaceResultSlot.resultSlotStatus ?? 'empty', title: surfaceResultSlot.title } } : {})}
        onPromptChange={props.surfaceExecution.command.onPromptChange}
        onProviderChange={props.surfaceExecution.command.onProviderChange}
        onCreateAsNewNodeChange={() => undefined}
        onIntentChange={props.surfaceExecution.command.onIntentChange}
        onResultPolicyChange={props.surfaceExecution.command.onResultPolicyChange}
        onReceiverChange={(value) => props.surfaceExecution?.command.onReceiverChange(value)}
        onRemoveReference={props.surfaceExecution.command.onToggleReference}
        onMoveReference={props.surfaceExecution.command.onMoveReference}
        onStartReferencePick={props.surfaceExecution.command.onStartReferencePick}
        onFinishReferencePick={props.surfaceExecution.command.onFinishReferencePick}
        onSend={submitSurfaceExecution}
        onClose={() => { props.surfaceExecution?.command.onFinishReferencePick(); setAgentNode(null) }}
      />}
    </div>
    {props.surface === 'arrange' && !props.emptyState && <div className="canvas-hud lcos-canvas-hud" data-testid="canvas-hud" onContextMenu={(event) => event.preventDefault()}><CanvasMiniMap {...props.miniMap}/></div>}
    {props.surface === 'arrange' && props.firstArtifactGuide && <FirstArtifactGuide {...props.firstArtifactGuide}/>}
    <SurfaceDock {...props.surfaceDock}/>
    {props.agentSurface && <AgentContextSurface {...props.agentSurface}/>}
    {props.resumeHint && capabilityKind === 'arrange' && !resumeDismissed && <ProjectResumeHint {...props.resumeHint} onDismiss={() => { setResumeDismissed(true); props.resumeHint?.onDismiss() }}/>}
    {idleHintVisible && props.idleHint && <ProjectResumeHint eyebrow="刚才这段" title={props.idleHint.title} subtitle={props.idleHint.subtitle} onDismiss={() => setIdleEpisodeHintShown(true)}/>}
    {contextHintVisible && capabilityKind === 'context' && contextItems.length > 0 && <SurfaceDepositHint kind="context" items={contextItems} reflection={contextEvaluatorReason ?? props.depositHints?.contextReflection} onOrganize={() => { setContextHintVisible(false); props.depositHints?.onOrganize('context'); openSurfaceExecution({ x: 180, y: 120, seedPrompt: contextSeed, contextLabel: `上下文 · ${props.projection.selectedIds?.length ?? 0} 项选择` }) }} onDismiss={() => setContextHintVisible(false)}/>}
    {workflowHintVisible && capabilityKind === 'workflow' && workflowItems.length > 0 && <SurfaceDepositHint kind="workflow" items={workflowItems} reflection={workflowEvaluatorReason ?? props.depositHints?.workflowReflection} onOrganize={() => { setWorkflowHintVisible(false); props.depositHints?.onOrganize('workflow'); openSurfaceExecution({ x: 180, y: 120, seedPrompt: workflowSeed, contextLabel: `工作流 · ${props.projection.selectedIds?.length ?? 0} 项选择` }) }} onDismiss={() => setWorkflowHintVisible(false)}/>}
    {/* A10：节点已被选中时 object-local / Selection Field controls 拥有交互焦点，详情 Popover 与其互斥。 */}
    {props.nodeInfo && !selectedNodeIds.has(props.nodeInfo.node.id) && <NodeInfoPopover {...props.nodeInfo}/>}
    {props.layoutPreview && <div className="layout-preview-banner lcos-layout-preview"><span>预览布局</span><button onClick={props.layoutPreview.onApply}>应用</button><button onClick={props.layoutPreview.onCancel}>取消</button></div>}
  </section>
}
