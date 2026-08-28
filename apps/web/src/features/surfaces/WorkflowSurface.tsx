import {
  Download,
  LayoutGrid,
  Link2,
  Network,
  Paperclip,
  Play,
  Plus,
  Save,
  Trash2,
  Unplug,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { AttentionBucketV0, WorkflowActionV0 } from '@local-creative-os/contracts'
import type { CanvasEdge, CanvasNode } from '../../model'
import { chooseLayoutStrategy, layoutPreview as runLayoutPreview } from '../layout/layoutService'
import { loadPresentationLayoutEngines } from '../layout/layoutEngines'
import type { LayoutResult } from '../layout/layoutTypes'
import type { SkillStepInput, WorkflowSkillSummary } from '../workflow/skillLibrary'
import { filterWorkflowSkills, formatSkillRunStats, sortWorkflowSkills, type SkillRunStats, type WorkflowSkillSortMode } from '../workflow/skillLibrary'
import { relativeTime } from '../shell/relativeTime'
import { SpatialCanvas } from '../spatial/SpatialCanvas'
import { SpatialEdgeLayer } from '../spatial/SpatialEdgeLayer'
import { SpatialNodeLayer } from '../spatial/SpatialNodeLayer'
import { spatialBoundsForPlacements, spatialScreenToWorld } from '../spatial/spatialCamera'
import { advanceSpatialNodeDrag, beginSpatialNodeDrag, endSpatialPointer } from '../spatial/spatialInteractionMachine'
import { IDLE_SPATIAL_POINTER, type SpatialPointerSession } from '../spatial/spatialTypes'
import {
  usePresentationDraftEdges,
  usePresentationDraftHiddenIds,
  usePresentationDraftPinnedIds,
  usePresentationDraftPositions,
  usePresentationSurfaceElements,
} from '../../state/presentationDraftState'
import { useWorkflowActionState } from '../../state/presentationWorkflowActionState'
import { useSpatialSessionCamera } from '../../state/spatialSessionState'
import { useSpatialFocusRequest, type SpatialFocusRequest } from '../spatial/useSpatialFocusRequest'
import { SurfaceObject } from './SurfaceObject'
import { LcosSignalGlyph } from '../design/DotGlyph'
import { boundRegionSemanticForView, resolveSpatialSignal, type SpatialRuntimeSignal } from '../spatial/visual/spatialSignal'
import { spatialLodForCount, spatialOverviewProjection } from '../spatial/spatialLod'
import { layoutManualSpatial } from './surfaceLayouts'
import { SurfaceComponentLayer } from '../spatial/components/SurfaceComponentLayer'
import { SurfaceComponentProposalLayer } from '../spatial/components/SurfaceComponentProposalLayer'
import { SurfaceComponentShelf } from '../spatial/components/SurfaceComponentShelf'
import { surfaceComponentContract } from '../spatial/model/surfaceComponentCatalog'
import { boundsAroundSurfaceRects, placeSurfaceComponent, surfaceViewportOrigin } from '../spatial/model/surfaceGeometry'
import { applySurfaceOps, type SurfaceOp, validateSurfaceOps } from '../spatial/model/surfaceOps'
import { resolveSurfaceIntent, type SurfaceIntent } from '../spatial/model/surfaceIntent'
import { AgentSurfaceComposer } from './AgentSurfaceComposer'
import type { SurfaceBinding, SurfaceComponentType } from '../spatial/model/surfaceElementTypes'

interface Props {
  projectId: string
  scopeId: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  selectedIds: string[]
  attentionBucketsByViewId?: Readonly<Record<string, AttentionBucketV0>>
  source?: { kind: string; label: string }
  runOverlay?: { activeNodeIds: string[]; completedNodeIds: string[]; failedNodeIds: string[] }
  reviews?: readonly { readonly runId: string; readonly label: string; readonly phase: string }[]
  checkpoints?: readonly { readonly checkpointId: string; readonly label: string; readonly createdAt: string }[]
  onOpenReview?: (runId: string) => void
  onImportProjectView?: (memberViewIds: readonly string[]) => string[]
  onExportWorkflow?: () => void
  onImportWorkflow?: (file: File) => void
  /** 教工作流：技能列表（App 层扫描项目的 SKILL.md artifacts 得出）。 */
  skills?: readonly WorkflowSkillSummary[]
  /** 教工作流：把当前 Step 链保存为 SKILL.md artifact。 */
  onSaveSkill?: (input: { readonly name: string; readonly steps: readonly SkillStepInput[] }) => Promise<boolean>
  /** 教工作流：一键重放一个已保存技能（走与手动链相同的 Run 发起路径）。 */
  onReplaySkill?: (skill: WorkflowSkillSummary) => void
  /** 教工作流：技能运行历史投影（从画布 Run 节点推导；key = artifactId）。 */
  skillRunStats?: ReadonlyMap<string, SkillRunStats>
  /** 教工作流：定位技能 artifact 节点（沉淀池详情的「定位编辑」动作）。 */
  onLocateSkill?: (skill: WorkflowSkillSummary) => void
  onSelect: (id: string, additive?: boolean) => void
  onMarqueeSelect?: (ids: string[], additive: boolean) => void
  onDoubleClick: (id: string) => void
  onStart?: (kind: 'selection' | 'skill' | 'agent') => void
  onDirectProjectViewDrop?: (targetViewId: string, sourceIds: readonly string[]) => void
  onCreateDomainRelation?: (fromViewId: string, toViewId: string, kind: string) => Promise<void>
  onUpdateDomainRelation?: (relationId: string, kind: string) => Promise<void>
  onDeleteDomainRelation?: (relationId: string) => Promise<void>
  focusRequest?: SpatialFocusRequest
  // Legacy props remain accepted during migration. They are intentionally not
  // rendered as Workflow Pages or fake business Step entities.
  workspaces?: readonly unknown[]
  onReorderWorkspace?: unknown
  onActivateWorkspace?: unknown
  onCreateWorkspace?: unknown
  onAddToWorkspace?: unknown
  onCreateOperatorNode?: unknown
}

interface ActionDragSession {
  readonly id: string
  readonly pointerId: number
  readonly clientX: number
  readonly clientY: number
  readonly x: number
  readonly y: number
}

const WORKFLOW_STEP_CONTRACT = surfaceComponentContract('workflow-step')
const ACTION_WIDTH = WORKFLOW_STEP_CONTRACT.minSize.w
const ACTION_HEIGHT = WORKFLOW_STEP_CONTRACT.minSize.h
const MATERIAL_START_Y = 420

const actionId = () => `workflow-action:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`
const actionEdgeId = () => `workflow-action-edge:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`

/**
 * Workflow is an action scene, not a second material graph.
 *
 * - WorkflowActionV0 is Presentation-only Step state.
 * - CanvasNode remains the same Project material identity.
 * - Only actions own Workflow ports / Step-to-Step edges.
 * - Removing an action never removes its attached Project material.
 */
export function WorkflowSurface(props: Props) {
  const [hiddenIds, setHiddenIds] = usePresentationDraftHiddenIds(props.projectId, props.scopeId, 'workflow')
  const [presentationEdges, setPresentationEdges] = usePresentationDraftEdges(props.projectId, props.scopeId, 'workflow', props.edges)
  const [workflowActionState, setWorkflowActionState] = useWorkflowActionState(props.projectId, props.scopeId)
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null)
  const [selectedActionEdge, setSelectedActionEdge] = useState<string | null>(null)
  const [edgeLabelDraft, setEdgeLabelDraft] = useState('')
  const [actionEdgeLabelDraft, setActionEdgeLabelDraft] = useState('')
  const [edgeBusy, setEdgeBusy] = useState(false)
  const [camera, setCamera] = useSpatialSessionCamera(props.projectId, props.scopeId, 'workflow', { x: 0, y: 0, zoom: 1 })
  const [draftPositions, setDraftPositions] = usePresentationDraftPositions(props.projectId, props.scopeId, 'workflow')
  const [pinnedIds, setPinnedIds] = usePresentationDraftPinnedIds(props.projectId, props.scopeId, 'workflow')
  const [surfaceElements, setSurfaceElements] = usePresentationSurfaceElements(props.projectId, props.scopeId, 'workflow')
  const [proposalOps, setProposalOps] = useState<readonly SurfaceOp[]>([])
  const [layoutPreview, setLayoutPreview] = useState<LayoutResult | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [stepTitle, setStepTitle] = useState('')
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null)
  // 教工作流：存（存为技能浮层）与放（技能列表浮层）
  const [saveSkillOpen, setSaveSkillOpen] = useState(false)
  const [skillPanelOpen, setSkillPanelOpen] = useState(false)
  const [skillNameDraft, setSkillNameDraft] = useState('')
  const [saveSkillBusy, setSaveSkillBusy] = useState(false)
  // 沉淀池 GUI：搜索 + 排序 + master/detail 选中项。
  const [skillQuery, setSkillQuery] = useState('')
  const [skillSortMode, setSkillSortMode] = useState<WorkflowSkillSortMode>('created')
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const [link, setLink] = useState<{ from: string; x: number; y: number; clientX: number; clientY: number } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [draggingActionId, setDraggingActionId] = useState<string | null>(null)
  const [linkTargetId, setLinkTargetId] = useState<string | null>(null)
  const drag = useRef<SpatialPointerSession>(IDLE_SPATIAL_POINTER)
  /** §4.13.2-G-2 整组拖动会话:锚点 + 组员原位(锚点格点收敛后组员按相对偏移一次落位,主画布同款语义)。 */
  const groupDrag = useRef<{ pointerId: number; anchorId: string; members: ReadonlyArray<{ id: string; x: number; y: number }> } | null>(null)
  const actionDrag = useRef<ActionDragSession | null>(null)
  /** §4.13.2-G-2 组件多选:与节点 Selection 平行的本 surface 组件选中集(框选/Shift·Ctrl 点选进组)。 */
  const [selectedComponentIds, setSelectedComponentIds] = useState<readonly string[]>([])
  const componentIds = useMemo(() => new Set(surfaceElements.map((element) => element.id)), [surfaceElements])
  // 组件被移除后清掉选中残留,避免悬空 id 留在组里。
  useEffect(() => { setSelectedComponentIds((current) => { const next = current.filter((id) => componentIds.has(id)); return next.length === current.length ? current : next }) }, [componentIds])

  const visibleNodes = useMemo(() => props.nodes.filter((node) => !hiddenIds.includes(node.id)), [hiddenIds, props.nodes])
  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes])
  const visibleEdges = useMemo(
    () => presentationEdges.filter((edge) => !hiddenIds.includes(edge.from) && !hiddenIds.includes(edge.to)),
    [hiddenIds, presentationEdges],
  )
  const actions = workflowActionState.actions
  const actionEdges = workflowActionState.edges
  const actionById = useMemo(() => new Map(actions.map((action) => [action.id, action])), [actions])
  const firstActionForView = useMemo(() => {
    const result = new Map<string, WorkflowActionV0>()
    for (const action of actions) {
      for (const viewId of action.attachedViewIds) if (!result.has(viewId)) result.set(viewId, action)
    }
    return result
  }, [actions])
  const usageCountByView = useMemo(() => {
    const result = new Map<string, number>()
    for (const action of actions) for (const viewId of action.attachedViewIds) result.set(viewId, (result.get(viewId) ?? 0) + 1)
    return result
  }, [actions])

  // 沉淀池 GUI：搜索过滤 + 排序 + master/detail 选中项（全部走 skillLibrary 纯函数）。
  const skillStats = props.skillRunStats
  const visibleSkills = useMemo(
    () => sortWorkflowSkills(filterWorkflowSkills(props.skills ?? [], skillQuery), skillStats ?? new Map(), skillSortMode),
    [props.skills, skillQuery, skillSortMode, skillStats])
  const selectedSkill = useMemo(
    () => visibleSkills.find((skill) => skill.artifactId === selectedSkillId) ?? visibleSkills[0] ?? null,
    [visibleSkills, selectedSkillId])
  // 相对时间的基准：列表/过滤变化时重算一次（够用，不为秒级新鲜度起 interval）。
  const skillRelativeNow = useMemo(() => Date.now(), [visibleSkills])

  const materialBase = useMemo(() => layoutManualSpatial(visibleNodes, visibleEdges, { x: 120, y: MATERIAL_START_Y }), [visibleEdges, visibleNodes])
  const items = useMemo(() => materialBase.items.map((item) => {
    const explicit = draftPositions[item.node.id]
    if (explicit) return { ...item, ...explicit }
    const owner = firstActionForView.get(item.node.id)
    if (!owner) return item
    const index = owner.attachedViewIds.filter((id) => visibleNodeIds.has(id)).indexOf(item.node.id)
    if (index < 0) return item
    return {
      ...item,
      x: owner.x + 18 + (index % 2) * 174,
      y: owner.y + 100 + Math.floor(index / 2) * 72,
    }
  }), [draftPositions, firstActionForView, materialBase.items, visibleNodeIds])
  const materialLod = spatialLodForCount(items.length)
  const renderItems = useMemo(() => {
    const placements = spatialOverviewProjection(items.map((item) => ({ ...item, id: item.node.id })), camera, new Set(props.selectedIds))
    return placements.map(({ id: _id, ...item }) => item)
  }, [camera, items, props.selectedIds])
  const renderIds = useMemo(() => new Set(renderItems.map((item) => item.node.id)), [renderItems])
  const byId = useMemo(() => new Map(items.map((item) => [item.node.id, item])), [items])
  const materialEdgePlacements = useMemo(() => visibleEdges.flatMap((edge) => {
    if (!renderIds.has(edge.from) || !renderIds.has(edge.to)) return []
    const from = byId.get(edge.from)
    const to = byId.get(edge.to)
    return from && to ? [{ edge, x1: from.x + from.width, y1: from.y + from.height / 2, x2: to.x, y2: to.y + to.height / 2 }] : []
  }), [byId, renderIds, visibleEdges])
  const actionEdgePlacements = useMemo(() => actionEdges.flatMap((edge) => {
    const from = actionById.get(edge.fromActionId)
    const to = actionById.get(edge.toActionId)
    return from && to ? [{ edge, x1: from.x + ACTION_WIDTH, y1: from.y + ACTION_HEIGHT / 2, x2: to.x, y2: to.y + ACTION_HEIGHT / 2 }] : []
  }), [actionById, actionEdges])
  const previewPlacements = useMemo(() => layoutPreview?.positions.flatMap((position) => {
    const item = byId.get(position.id)
    return item ? [{ x: position.x, y: position.y, width: item.width, height: item.height }] : []
  }) ?? [], [byId, layoutPreview])
  const actionSpatialItems = useMemo(() => actions.map((action) => ({ id: action.id, x: action.x, y: action.y, width: ACTION_WIDTH, height: ACTION_HEIGHT })), [actions])
  const materialSpatialItems = useMemo(() => items.map(({ node, x, y, width, height }) => ({ id: node.id, x, y, width, height })), [items])
  /** G-2:组件卡也进框选命中(bounds 与选框相交即选中);Step 卡走自身点选(selectedActionId),小地图仍只看节点+Step。 */
  const componentMarqueeItems = useMemo(() => surfaceElements.map((element) => ({ id: element.id, x: element.bounds.x, y: element.bounds.y, width: element.bounds.w, height: element.bounds.h })), [surfaceElements])
  const marqueeItems = useMemo(() => [...materialSpatialItems, ...componentMarqueeItems], [materialSpatialItems, componentMarqueeItems])
  const spatialItems = useMemo(() => [...actionSpatialItems, ...materialSpatialItems], [actionSpatialItems, materialSpatialItems])
  const selectedSurfaceBounds = useMemo(() => boundsAroundSurfaceRects([
    ...materialSpatialItems.filter((item) => props.selectedIds.includes(item.id)).map((item) => ({ x: item.x, y: item.y, w: item.width, h: item.height })),
    ...actionSpatialItems.filter((item) => item.id === selectedActionId).map((item) => ({ x: item.x, y: item.y, w: item.width, h: item.height })),
  ], 24), [actionSpatialItems, materialSpatialItems, props.selectedIds, selectedActionId])
  const componentViewportOrigin = useMemo(() => surfaceViewportOrigin(camera), [camera])
  const proposalElements = useMemo(() => proposalOps.flatMap((op) => op.type === 'create-component' ? [op.component] : []), [proposalOps])
  const projectedReviewIds = useMemo(() => new Set(surfaceElements.flatMap((element) => element.binding?.runId ? [element.binding.runId] : [])), [surfaceElements])
  const projectedCheckpointIds = useMemo(() => new Set(surfaceElements.flatMap((element) => element.binding?.checkpointId ? [element.binding.checkpointId] : [])), [surfaceElements])
  const nextReview = props.reviews?.find((review) => !projectedReviewIds.has(review.runId))
  const nextCheckpoint = props.checkpoints?.find((checkpoint) => !projectedCheckpointIds.has(checkpoint.checkpointId))
  const edgeBounds = spatialBoundsForPlacements([...spatialItems, ...previewPlacements], 180)
  useSpatialFocusRequest({ request: props.focusRequest, items: materialSpatialItems, testId: 'workflow-spatial', setCamera })

  // Core/domain relations stay visible as secondary material evidence. The
  // editable action skeleton is stored separately and never mutates those relations.
  useEffect(() => {
    setPresentationEdges((current) => {
      const presentation = current.filter((edge) => edge.scope === 'presentation' || edge.id.startsWith('presentation:'))
      return [...props.edges, ...presentation.filter((edge) => !props.edges.some((item) => item.id === edge.id))]
    })
  }, [props.edges, setPresentationEdges])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedActionId) {
        const active = document.activeElement
        if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return
        event.preventDefault()
        setWorkflowActionState((current) => ({
          actions: current.actions.filter((action) => action.id !== selectedActionId),
          edges: current.edges.filter((edge) => edge.fromActionId !== selectedActionId && edge.toActionId !== selectedActionId),
        }))
        setSelectedActionId(null)
        return
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedEdge) {
        const edge = visibleEdges.find((item) => item.id === selectedEdge)
        if (edge?.scope === 'presentation' || edge?.id.startsWith('presentation:')) {
          event.preventDefault()
          setPresentationEdges((current) => current.filter((item) => item.id !== selectedEdge))
          setSelectedEdge(null)
        }
      }
      if (event.key === 'Escape') {
        if (layoutPreview) setLayoutPreview(null)
        if (composerOpen) { setComposerOpen(false); setStepTitle('') }
        if (saveSkillOpen) { setSaveSkillOpen(false); setSkillNameDraft('') }
        if (skillPanelOpen) { setSkillPanelOpen(false); setSkillQuery(''); setSelectedSkillId(null) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [composerOpen, layoutPreview, saveSkillOpen, selectedActionId, selectedEdge, setPresentationEdges, setSkillPanelOpen, setWorkflowActionState, visibleEdges])

  const beginMaterialDrag = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    if (event.button !== 0 || layoutPreview) return
    event.stopPropagation()
    const item = byId.get(id)
    if (!item) return
    // G-2 整组拖动:按住的是多选成员之一时全组跟手,否则维持单节点(主画布同款语义)。
    const group = props.selectedIds.includes(id) && props.selectedIds.length > 1
      ? props.selectedIds.flatMap((memberId) => { const member = byId.get(memberId); return member ? [{ id: member.node.id, x: member.x, y: member.y }] : [] })
      : [{ id, x: item.x, y: item.y }]
    drag.current = beginSpatialNodeDrag(event.pointerId, id, { x: event.clientX, y: event.clientY }, { x: item.x, y: item.y }, camera.zoom)
    groupDrag.current = { pointerId: event.pointerId, anchorId: id, members: group }
    setDraggingId(id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveMaterialDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = drag.current
    if (session.kind !== 'node-drag') return
    event.stopPropagation()
    const next = advanceSpatialNodeDrag(session, { x: event.clientX, y: event.clientY })
    if (!next) return
    const group = groupDrag.current
    const anchor = group?.members.find((member) => member.id === group.anchorId)
    if (group && anchor && group.members.length > 1) {
      const dx = next.x - anchor.x
      const dy = next.y - anchor.y
      setDraftPositions((current) => ({ ...current, ...Object.fromEntries(group.members.map((member) => [member.id, { x: member.x + dx, y: member.y + dy }])) }))
      return
    }
    setDraftPositions((current) => ({ ...current, [session.id]: next }))
  }
  const endMaterialDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = drag.current
    if (session.kind !== 'node-drag') return
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const group = groupDrag.current
    if (group && group.members.length > 1) {
      // G-2 组拖动收尾:锚点格点收敛、组员保持相对偏移一次落位;被打断则整组回原位。
      const anchor = group.members.find((member) => member.id === group.anchorId)!
      if (event.defaultPrevented) {
        setDraftPositions((current) => ({ ...current, ...Object.fromEntries(group.members.map((member) => [member.id, { x: member.x, y: member.y }])) }))
      } else {
        const final = advanceSpatialNodeDrag(session, { x: event.clientX, y: event.clientY }) ?? session.origin
        const snap = (v: number) => Math.round(v / 24) * 24
        const dx = snap(final.x) - anchor.x
        const dy = snap(final.y) - anchor.y
        setPinnedIds((current) => Array.from(new Set([...current, ...group.members.map((member) => member.id)])))
        setDraftPositions((current) => ({ ...current, ...Object.fromEntries(group.members.map((member) => [member.id, { x: member.x + dx, y: member.y + dy }])) }))
      }
    } else if (event.defaultPrevented) {
      setDraftPositions((current) => ({ ...current, [session.id]: session.origin }))
    } else {
      setPinnedIds((current) => current.includes(session.id) ? current : [...current, session.id])
      // 松手格点吸附(与主画布/Context 画布同一步长):拖动过程连续跟手,只在落点收敛。
      setDraftPositions((current) => {
        const pos = current[session.id]
        if (!pos) return current
        const snap = (v: number) => Math.round(v / 24) * 24
        return { ...current, [session.id]: { ...pos, x: snap(pos.x), y: snap(pos.y) } }
      })
    }
    groupDrag.current = null
    drag.current = endSpatialPointer()
    setDraggingId(null)
  }
  const cancelMaterialDrag = () => { drag.current = endSpatialPointer(); groupDrag.current = null; setDraggingId(null) }

  /** G-2 框选分流:命中组件 id 进本 surface 组件选中集,节点 id 走全局 Selection(additive 语义与主画布框选一致)。 */
  const handleMarqueeSelect = (ids: string[], additive: boolean) => {
    const componentHits = ids.filter((id) => componentIds.has(id))
    const nodeIds = ids.filter((id) => !componentIds.has(id))
    setSelectedComponentIds((current) => {
      if (componentHits.length) return additive ? Array.from(new Set([...current, ...componentHits])) : componentHits
      return additive ? current : []
    })
    props.onMarqueeSelect?.(nodeIds, additive)
  }
  /** G-2 组件点选(受控):Shift/Ctrl 切换、普通点击单选重置——与节点点选同语义。 */
  const handleComponentSelect = (id: string, additive: boolean) => {
    setSelectedComponentIds((current) => additive
      ? current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
      : current.length === 1 && current[0] === id ? current : [id])
  }

  const beginActionDrag = (event: ReactPointerEvent<HTMLDivElement>, action: WorkflowActionV0) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button,input')) return
    event.stopPropagation()
    actionDrag.current = { id: action.id, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: action.x, y: action.y }
    setDraggingActionId(action.id)
    setSelectedActionId(action.id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveActionDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = actionDrag.current
    if (!session || session.pointerId !== event.pointerId) return
    event.stopPropagation()
    const x = session.x + (event.clientX - session.clientX) / camera.zoom
    const y = session.y + (event.clientY - session.clientY) / camera.zoom
    setWorkflowActionState((current) => ({
      ...current,
      actions: current.actions.map((action) => action.id === session.id ? { ...action, x, y } : action),
    }))
  }
  const endActionDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const session = actionDrag.current
    if (!session || session.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    actionDrag.current = null
    setDraggingActionId(null)
  }

  const removeMaterial = (id: string) => {
    const incoming = presentationEdges.filter((edge) => edge.to === id)
    const outgoing = presentationEdges.filter((edge) => edge.from === id)
    const bridges = incoming.flatMap((from) => outgoing.map((to, index) => ({
      id: `presentation:${id}:${from.from}:${to.to}:${index}`,
      from: from.from,
      to: to.to,
      kind: 'reference' as const,
      scope: 'presentation' as const,
      label: from.label || to.label,
    })))
    setPresentationEdges((current) => [...current.filter((edge) => edge.from !== id && edge.to !== id), ...bridges])
    setWorkflowActionState((current) => ({
      ...current,
      actions: current.actions.map((action) => ({ ...action, attachedViewIds: action.attachedViewIds.filter((viewId) => viewId !== id) })),
    }))
    setHiddenIds((current) => current.includes(id) ? current : [...current, id])
    setPinnedIds((current) => current.filter((item) => item !== id))
  }

  const selectedMaterialIds = props.selectedIds.filter((id) => visibleNodeIds.has(id))
  // 教工作流「存」：当前 Step 链的语义快照（材料只存 viewId live pointer + 人读标题，不复制内容）
  const currentSkillSteps = useMemo(() => actions.map((action) => ({
    label: action.label,
    materials: action.attachedViewIds.map((viewId) => {
      const node = props.nodes.find((item) => item.id === viewId)
      return { viewId, title: node?.title ?? '' }
    }),
  })), [actions, props.nodes])
  const saveSkill = async () => {
    if (!props.onSaveSkill || currentSkillSteps.length === 0 || saveSkillBusy) return
    const name = skillNameDraft.trim() || currentSkillSteps[0]?.label || '未命名技能'
    setSaveSkillBusy(true)
    try {
      const saved = await props.onSaveSkill({ name, steps: currentSkillSteps })
      if (saved) {
        setSaveSkillOpen(false)
        setSkillNameDraft('')
      }
    } finally {
      setSaveSkillBusy(false)
    }
  }
  const createAction = () => {
    const label = stepTitle.trim() || `步骤 ${actions.length + 1}`
    const previous = actions.at(-1)
    const id = actionId()
    const next: WorkflowActionV0 = {
      id,
      label,
      attachedViewIds: [...new Set(selectedMaterialIds)],
      x: previous ? previous.x + 360 : 130,
      y: previous ? previous.y : 128,
    }
    const edge = previous ? { id: actionEdgeId(), fromActionId: previous.id, toActionId: id } : null
    const saved = setWorkflowActionState((current) => ({
      actions: [...current.actions, next],
      edges: edge ? [...current.edges, edge] : current.edges,
    }))
    if (!saved) return
    setSelectedActionId(id)
    setComposerOpen(false)
    setStepTitle('')
  }
  const attachSelection = (id: string) => {
    if (!selectedMaterialIds.length) return
    setWorkflowActionState((current) => ({
      ...current,
      actions: current.actions.map((action) => action.id === id
        ? { ...action, attachedViewIds: [...new Set([...action.attachedViewIds, ...selectedMaterialIds])] }
        : action),
    }))
  }
  const detachMaterial = (actionIdValue: string, viewId: string) => {
    setWorkflowActionState((current) => ({
      ...current,
      actions: current.actions.map((action) => action.id === actionIdValue
        ? { ...action, attachedViewIds: action.attachedViewIds.filter((id) => id !== viewId) }
        : action),
    }))
  }
  const removeAction = (id: string) => {
    setWorkflowActionState((current) => ({
      actions: current.actions.filter((action) => action.id !== id),
      edges: current.edges.filter((edge) => edge.fromActionId !== id && edge.toActionId !== id),
    }))
    if (selectedActionId === id) setSelectedActionId(null)
  }

  const toWorld = (clientX: number, clientY: number) => {
    const canvas = document.querySelector<HTMLElement>('[data-testid="workflow-spatial"]')
    const rect = canvas?.getBoundingClientRect()
    return rect ? spatialScreenToWorld(clientX, clientY, rect, camera) : { x: 0, y: 0 }
  }
  const beginLink = (event: ReactPointerEvent<HTMLButtonElement>, from: string) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const world = toWorld(event.clientX, event.clientY)
    setLink({ from, x: world.x, y: world.y, clientX: event.clientX, clientY: event.clientY })
  }
  const moveLink = ({ event }: { event: React.PointerEvent<HTMLDivElement>; rect: DOMRect }) => {
    if (!link) return
    const world = toWorld(event.clientX, event.clientY)
    setLink((current) => current ? { ...current, x: world.x, y: world.y, clientX: event.clientX, clientY: event.clientY } : current)
    const at = document.elementFromPoint(event.clientX, event.clientY)
    const target = at?.closest<HTMLElement>('[data-workflow-action-id]')
    const next = target?.dataset.workflowActionId
    setLinkTargetId(next && next !== link.from ? next : null)
  }
  const endLink = (clientX?: number, clientY?: number) => {
    if (!link) return
    const at = document.elementFromPoint(clientX ?? link.clientX, clientY ?? link.clientY)
    const targetPort = at?.closest<HTMLElement>('[data-workflow-action-input]')
    const targetAction = at?.closest<HTMLElement>('[data-workflow-action-id]')
    const to = targetPort?.dataset.workflowActionInput ?? targetAction?.dataset.workflowActionId
    if (to && to !== link.from && actionById.has(to)) {
      setWorkflowActionState((current) => current.edges.some((edge) => edge.fromActionId === link.from && edge.toActionId === to)
        ? current
        : { ...current, edges: [...current.edges, { id: actionEdgeId(), fromActionId: link.from, toActionId: to }] })
    }
    setLink(null)
    setLinkTargetId(null)
  }

  const previewLayout = async () => {
    if (visibleNodes.length < 2 || layoutPreview) return
    const engines = await loadPresentationLayoutEngines()
    const layoutInput = {
      nodes: items.map((item) => ({ id: item.node.id, x: item.x, y: item.y, width: item.width, height: item.height, pinned: pinnedIds.includes(item.node.id) })),
      edges: visibleEdges,
      gap: 28,
      componentGap: 96,
      preserveManualAnchors: true,
    }
    const result = await runLayoutPreview({
      ...layoutInput,
      strategy: chooseLayoutStrategy(layoutInput),
    }, engines)
    setLayoutPreview(result)
  }
  const applyLayoutPreview = () => {
    if (!layoutPreview) return
    setDraftPositions((current) => ({ ...current, ...Object.fromEntries(layoutPreview.positions.map((position) => [position.id, { x: position.x, y: position.y }])) }))
    setLayoutPreview(null)
  }

  const selectedEdgeRecord = selectedEdge ? visibleEdges.find((edge) => edge.id === selectedEdge) : undefined
  const editableSelectedEdge = Boolean(selectedEdgeRecord && (selectedEdgeRecord.scope === 'presentation' || selectedEdgeRecord.id.startsWith('presentation:')))
  const selectedActionEdgeRecord = selectedActionEdge ? actionEdges.find((edge) => edge.id === selectedActionEdge) : undefined
  useEffect(() => { setEdgeLabelDraft(selectedEdgeRecord?.label ?? '') }, [selectedEdgeRecord?.id, selectedEdgeRecord?.label])
  useEffect(() => { setActionEdgeLabelDraft(selectedActionEdgeRecord?.label ?? '') }, [selectedActionEdgeRecord?.id, selectedActionEdgeRecord?.label])
  const updateSelectedEdgeLabel = (label: string) => {
    setEdgeLabelDraft(label)
    if (!selectedEdgeRecord || !editableSelectedEdge) return
    setPresentationEdges((current) => current.map((edge) => edge.id === selectedEdgeRecord.id ? { ...edge, label } : edge))
  }
  const updateActionEdgeLabel = (label: string) => {
    setActionEdgeLabelDraft(label)
    if (!selectedActionEdgeRecord) return
    setWorkflowActionState((current) => ({
      ...current,
      edges: current.edges.map((edge) => edge.id === selectedActionEdgeRecord.id ? { ...edge, label } : edge),
    }))
  }
  const promoteSelectedEdge = async () => {
    if (!selectedEdgeRecord || !editableSelectedEdge || !props.onCreateDomainRelation) return
    setEdgeBusy(true)
    try {
      await props.onCreateDomainRelation(selectedEdgeRecord.from, selectedEdgeRecord.to, (edgeLabelDraft || 'reference').trim())
      setPresentationEdges((current) => current.filter((edge) => edge.id !== selectedEdgeRecord.id))
      setSelectedEdge(null)
    } finally { setEdgeBusy(false) }
  }
  const saveDomainEdge = async () => {
    if (!selectedEdgeRecord || selectedEdgeRecord.scope !== 'domain' || !props.onUpdateDomainRelation) return
    const kind = edgeLabelDraft.trim()
    if (!kind) return
    setEdgeBusy(true)
    try {
      await props.onUpdateDomainRelation(selectedEdgeRecord.id, kind)
      setPresentationEdges((current) => current.map((edge) => edge.id === selectedEdgeRecord.id ? { ...edge, label: kind } : edge))
    } finally { setEdgeBusy(false) }
  }
  const deleteDomainEdge = async () => {
    if (!selectedEdgeRecord || selectedEdgeRecord.scope !== 'domain' || !props.onDeleteDomainRelation) return
    setEdgeBusy(true)
    try {
      await props.onDeleteDomainRelation(selectedEdgeRecord.id)
      setPresentationEdges((current) => current.filter((edge) => edge.id !== selectedEdgeRecord.id))
      setSelectedEdge(null)
    } finally { setEdgeBusy(false) }
  }

  const previewIntent = (intent: SurfaceIntent) => {
    const ops = resolveSurfaceIntent(intent, { projectId: props.projectId, surface: 'workflow', existing: surfaceElements, selectionBounds: selectedSurfaceBounds, viewportOrigin: componentViewportOrigin })
    setProposalOps(validateSurfaceOps(surfaceElements, ops).ok ? ops : [])
  }
  const keepProposal = () => { setSurfaceElements(applySurfaceOps(surfaceElements, proposalOps)); setProposalOps([]) }
  const addBoundComponent = (type: Extract<SurfaceComponentType, 'review' | 'checkpoint'>, identity: string, binding: SurfaceBinding, variant: string) => {
    const contract = surfaceComponentContract(type)
    const component = {
      id: `surface:${type}:${identity}`,
      projectId: props.projectId,
      surface: 'workflow' as const,
      type,
      bounds: placeSurfaceComponent({ size: contract.minSize, viewportOrigin: componentViewportOrigin, existing: surfaceElements }),
      binding,
      presentation: { variant, zIndex: 4 },
    }
    setSurfaceElements(applySurfaceOps(surfaceElements, [{ type: 'create-component', component }]))
  }

  const overlay = <>
    {layoutPreview && <div className="lcos-spatial-layout-preview" data-testid="workflow-layout-preview"><span><LayoutGrid size={12}/><strong>材料布局建议</strong><small>{layoutPreview.componentCount} 个关系簇 · {pinnedIds.length} 个手工锚点</small></span><button type="button" onClick={applyLayoutPreview}>应用</button><button type="button" className="quiet" onClick={() => setLayoutPreview(null)}>取消</button></div>}
    {!actions.length && items.length > 0 && <div className="lcos-workflow-step-empty"><span><strong>材料已经在这里</strong><small>建立第一步，把“做什么”和“用什么”分开。</small></span><button type="button" onClick={() => setComposerOpen(true)}><Plus size={12}/>建立第一步</button></div>}
    {!items.length && !actions.length && <div className="lcos-workflow-empty"><Network size={19}/><strong>从真实材料搭出下一步</strong><span>把材料带进来，再建立第一步。默认只搭建，不执行。</span><div className="lcos-workflow-start-actions"><button type="button" disabled={!props.selectedIds.length} onClick={() => props.onStart?.('selection')}><Network size={12}/>从 Selection</button><small>也可以从 Context 直接“做成工作流”</small></div></div>}
    <SurfaceComponentShelf projectId={props.projectId} surface="workflow" elements={surfaceElements} selectionIds={selectedMaterialIds} selectionBounds={selectedSurfaceBounds} viewportOrigin={componentViewportOrigin} onElementsChange={setSurfaceElements}/>
    <AgentSurfaceComposer surface="workflow" targetIds={selectedMaterialIds} previewing={proposalOps.length > 0} onPreview={previewIntent} onKeep={keepProposal} onRevert={() => setProposalOps([])}/>
  </>

  return <section className="lcos-dedicated-surface lcos-workflow-surface" data-testid="surface-workflow">
    <header className="lcos-surface-heading lcos-workflow-heading">
      <div><strong>工作流</strong><span>行动骨架 · 材料挂接</span></div>
      <div className="lcos-layout-tools">
        <small>{actions.length} 步 · {visibleNodes.length} 份材料</small>
        <button type="button" onClick={() => setComposerOpen(true)}><Plus size={11}/>步骤</button>
        {nextReview && <button type="button" title={nextReview.label} onClick={() => addBoundComponent('review', nextReview.runId, { runId: nextReview.runId }, nextReview.phase)}><Plus size={11}/>Review</button>}
        {nextCheckpoint && <button type="button" title={nextCheckpoint.label} onClick={() => addBoundComponent('checkpoint', nextCheckpoint.checkpointId, { checkpointId: nextCheckpoint.checkpointId }, 'protected')}><Plus size={11}/>Checkpoint</button>}
        <button type="button" disabled={items.length < 2 || Boolean(layoutPreview)} onClick={previewLayout}><LayoutGrid size={11}/>整理材料</button>
        {pinnedIds.length > 0 && <button type="button" className="quiet" onClick={() => setPinnedIds([])}>解除 {pinnedIds.length} 个锚点</button>}
        {props.onSaveSkill && <button type="button" disabled={!actions.length || saveSkillBusy} title="把当前 Step 链存成 SKILL.md 技能" onClick={() => { setSaveSkillOpen(true); setSkillPanelOpen(false) }}><Save size={11}/>存为技能</button>}
        {props.onReplaySkill && <button type="button" title="项目技能（SKILL.md）· 一键重放" onClick={() => { setSkillPanelOpen((open) => !open); setSaveSkillOpen(false) }}><Play size={11}/>技能{props.skills?.length ? ` · ${props.skills.length}` : ''}</button>}
        {props.onExportWorkflow && <button type="button" onClick={props.onExportWorkflow}><Download size={11}/>导出</button>}
        {props.onImportWorkflow && <><button type="button" onClick={() => importInputRef.current?.click()}><Upload size={11}/>导入</button><input ref={importInputRef} hidden type="file" accept=".zip,.lcos-workflow.zip" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) props.onImportWorkflow?.(file); event.currentTarget.value = '' }}/></>}
      </div>
    </header>

    {composerOpen && <div className="lcos-workflow-step-composer" role="dialog" aria-label="建立工作流步骤">
      <span><strong>这一步做什么？</strong><small>{selectedMaterialIds.length ? `会挂接当前 Selection · ${selectedMaterialIds.length} 项` : '可先建空步骤，再选择材料挂接'}</small></span>
      <input autoFocus value={stepTitle} placeholder="例如：确认创意方向" onChange={(event) => setStepTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') createAction(); if (event.key === 'Escape') { setComposerOpen(false); setStepTitle('') } }}/>
      <button type="button" onClick={createAction}>建立</button>
      <button type="button" className="quiet" onClick={() => { setComposerOpen(false); setStepTitle('') }}>取消</button>
    </div>}

    {saveSkillOpen && <div className="lcos-workflow-step-composer" role="dialog" aria-label="存为技能" data-testid="workflow-skill-composer">
      <span><strong>把这条链教给系统</strong><small>存成 SKILL.md · {currentSkillSteps.length} 步 · 材料只存引用不复制</small></span>
      <input autoFocus value={skillNameDraft} placeholder={`技能名（默认：${currentSkillSteps[0]?.label ?? '未命名技能'}）`} onChange={(event) => setSkillNameDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void saveSkill(); if (event.key === 'Escape') { setSaveSkillOpen(false); setSkillNameDraft('') } }}/>
      <button type="button" disabled={saveSkillBusy || currentSkillSteps.length === 0} onClick={() => void saveSkill()}>{saveSkillBusy ? '保存中…' : '保存'}</button>
      <button type="button" className="quiet" onClick={() => { setSaveSkillOpen(false); setSkillNameDraft('') }}>取消</button>
    </div>}

    {skillPanelOpen && <div className="lcos-workflow-skill-panel" role="dialog" aria-label="项目技能" data-testid="workflow-skill-panel">
      <header><strong>技能 · SKILL.md</strong><small>{props.skills?.length ?? 0} 个已教流程</small><button type="button" aria-label="关闭技能列表" onClick={() => setSkillPanelOpen(false)}>×</button></header>
      {(props.skills?.length ?? 0) === 0
        ? <p className="lcos-workflow-skill-empty">还没有技能。先搭 Step 链，再「存为技能」。</p>
        : <>
          <div className="lcos-skill-toolbar">
            <input value={skillQuery} placeholder="搜索技能名 / 描述 / 步骤…" aria-label="搜索技能" data-testid="workflow-skill-search" onChange={(event) => setSkillQuery(event.target.value)}/>
            <select value={skillSortMode} aria-label="技能排序" data-testid="workflow-skill-sort" onChange={(event) => setSkillSortMode(event.target.value as WorkflowSkillSortMode)}>
              <option value="created">最近创建</option>
              <option value="name">名称</option>
              <option value="runs">运行次数</option>
            </select>
          </div>
          {visibleSkills.length === 0
            ? <p className="lcos-workflow-skill-empty" data-testid="workflow-skill-no-match">没有匹配「{skillQuery}」的技能。</p>
            : <div className="lcos-skill-body" onKeyDown={(event) => {
              // 键位表：↑↓ 移动选中（焦点在搜索框时同样生效）；Enter 重放选中项（焦点在搜索框时忽略，避免打字误触）。
              if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return
              if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') return
              event.preventDefault()
              const index = visibleSkills.findIndex((skill) => skill.artifactId === selectedSkill?.artifactId)
              if (event.key === 'Enter') { if (selectedSkill !== null) { setSkillPanelOpen(false); props.onReplaySkill?.(selectedSkill) } return }
              const next = event.key === 'ArrowDown' ? Math.min(visibleSkills.length - 1, index + 1) : Math.max(0, index - 1)
              const target = visibleSkills[next]
              if (target !== undefined) { setSelectedSkillId(target.artifactId); document.querySelector<HTMLElement>(`[data-skill-id="${target.artifactId}"]`)?.scrollIntoView({ block: 'nearest' }) }
            }}>
            <ul className="lcos-skill-list" data-testid="workflow-skill-list">
              {visibleSkills.map((skill) => (
                <li key={skill.artifactId} data-testid="workflow-skill-item" data-skill-id={skill.artifactId} aria-current={selectedSkill?.artifactId === skill.artifactId ? 'true' : undefined} className={selectedSkill?.artifactId === skill.artifactId ? 'selected' : undefined}>
                  <button type="button" className="lcos-skill-row" onClick={() => setSelectedSkillId(skill.artifactId)} onDoubleClick={() => { setSkillPanelOpen(false); props.onReplaySkill?.(skill) }}>
                    <strong title={skill.title}>{skill.name}</strong>
                    <small>{skill.description || skill.title}</small>
                    <small className="lcos-skill-meta">{skill.stepCount} 步 · {formatSkillRunStats(skillStats?.get(skill.artifactId), relativeTime, skillRelativeNow)}</small>
                  </button>
                  <button type="button" className="lcos-skill-replay" title={`重放「${skill.name}」`} onClick={() => { setSkillPanelOpen(false); props.onReplaySkill?.(skill) }}><Play size={10}/>重放</button>
                </li>
              ))}
            </ul>
            {selectedSkill !== null && <div className="lcos-skill-detail" data-testid="workflow-skill-detail">
              <strong title={selectedSkill.title}>{selectedSkill.name}</strong>
              <p>{selectedSkill.description || selectedSkill.title}</p>
              <small className="lcos-skill-meta">{selectedSkill.stepCount} 步 · {selectedSkill.steps.reduce((count, step) => count + step.materials.length, 0)} 份材料 · {formatSkillRunStats(skillStats?.get(selectedSkill.artifactId), relativeTime, skillRelativeNow)}</small>
              <ol>
                {selectedSkill.steps.map((step, index) => (
                  <li key={`${selectedSkill.artifactId}-${index}`}>
                    <span><b>{index + 1}</b>{step.label}</span>
                    {step.materials.length > 0 && <div className="lcos-skill-materials">{step.materials.map((material) => (
                      <button key={material.viewId} type="button" title={`材料：${material.title || material.viewId}`} onClick={() => props.onLocateSkill?.({ ...selectedSkill, viewId: material.viewId })}>{material.title || material.viewId}</button>
                    ))}</div>}
                  </li>
                ))}
              </ol>
              <div className="lcos-skill-actions">
                <button type="button" className="primary" onClick={() => { setSkillPanelOpen(false); props.onReplaySkill?.(selectedSkill) }}><Play size={10}/>重放</button>
                {props.onLocateSkill && <button type="button" onClick={() => props.onLocateSkill?.(selectedSkill)}>定位编辑</button>}
              </div>
            </div>}
          </div>}
        </>}
    </div>}

    <details className={`lcos-capability-source source-${props.source?.kind ?? 'empty'}`}><summary><i/><strong>{props.source?.label ?? '当前 Workflow Presentation'}</strong><small>来源</small></summary><div><span>Workflow Source</span><small>Step 只描述行动；材料始终引用 Project Entity。</small><nav><button type="button" disabled={!props.selectedIds.length} onClick={() => props.onStart?.('selection')}><Network size={11}/>加入 Selection</button></nav></div></details>

    <SpatialCanvas
      camera={camera}
      setCamera={setCamera}
      marqueeItems={marqueeItems}
      minimapItems={spatialItems}
      minimapLabel="Workflow"
      onMarqueeSelect={handleMarqueeSelect}
      className={`lcos-workflow-stage lcos-presentation-spatial ${layoutPreview ? 'has-layout-preview' : ''}`}
      worldClassName="lcos-presentation-world"
      testId="workflow-spatial"
      overlays={overlay}
      onPointerMove={moveLink}
      onPointerUp={({ event }) => { drag.current = endSpatialPointer(); groupDrag.current = null; setDraggingId(null); endLink(event.clientX, event.clientY) }}
      onPointerCancel={() => { drag.current = endSpatialPointer(); groupDrag.current = null; setDraggingId(null); setLink(null); setLinkTargetId(null) }}
      onExternalDrop={(kind, raw, _screen, point) => {
        if (kind !== 'project-view' || !props.onImportProjectView) return
        try {
          const payload = JSON.parse(raw) as { memberViewIds?: unknown }
          const sourceIds = Array.isArray(payload.memberViewIds) ? payload.memberViewIds.filter((item): item is string => typeof item === 'string') : []
          const imported = props.onImportProjectView(sourceIds)
          if (imported.length) setDraftPositions((current) => ({ ...current, ...Object.fromEntries(imported.map((id, index) => [id, { x: point.x + (index % 3) * 230, y: point.y + Math.floor(index / 3) * 130 }])) }))
        } catch { /* malformed rail payload: ignore */ }
      }}
    >
      <SpatialEdgeLayer bounds={edgeBounds} className="lcos-workflow-edges" ariaLabel="工作流关系">
        <defs><marker id="lcos-workflow-action-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7 z"/></marker></defs>
        {actionEdgePlacements.map(({ edge, x1, y1, x2, y2 }) => {
          const m = x1 + (x2 - x1) * .5
          return <g key={edge.id} className={`lcos-workflow-action-edge ${selectedActionEdge === edge.id ? 'selected' : ''}`} onClick={(event) => { event.stopPropagation(); setSelectedActionEdge(edge.id); setSelectedEdge(null) }}>
            <path d={`M${x1} ${y1} C${m} ${y1},${m} ${y2},${x2} ${y2}`} markerEnd="url(#lcos-workflow-action-arrow)"/>
            {edge.label && <text x={m} y={(y1 + y2) / 2 - 9} textAnchor="middle">{edge.label}</text>}
          </g>
        })}
        {materialEdgePlacements.map(({ edge, x1, y1, x2, y2 }) => {
          const m = x1 + (x2 - x1) * .5
          return <g key={edge.id} className={`lcos-workflow-edge-group material-relation ${selectedEdge === edge.id ? 'selected' : ''}`}><path d={`M${x1} ${y1} C${m} ${y1},${m} ${y2},${x2} ${y2}`} className={`${edge.active ? 'active' : ''} ${selectedEdge === edge.id ? 'selected' : ''} ${edge.scope === 'presentation' ? 'presentation' : ''}`} onClick={(event) => { event.stopPropagation(); setSelectedEdge(edge.id); setSelectedActionEdge(null) }}/>{edge.label && <text x={m} y={(y1 + y2) / 2 - 8} textAnchor="middle">{edge.label}</text>}</g>
        })}
        {link && actionById.get(link.from) && (() => { const from = actionById.get(link.from)!; const startX = from.x + ACTION_WIDTH; const startY = from.y + ACTION_HEIGHT / 2; const m = startX + (link.x - startX) * .5; return <path key="workflow-action-link" className="edge temporary workflow-link" d={`M${startX} ${startY} C${m} ${startY},${m} ${link.y},${link.x} ${link.y}`}/> })()}
        {layoutPreview?.routes.map((route) => route.points.length > 1 ? <path key={`preview:${route.id}`} className="layout-preview-edge" d={route.points.map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`).join(' ')}/> : null)}
      </SpatialEdgeLayer>

      <SurfaceComponentLayer surface="workflow" elements={surfaceElements} zoom={camera.zoom} selectionIds={selectedComponentIds} onSelectElement={handleComponentSelect} renderContext={{ nodes: visibleNodes, edges: visibleEdges, projectId: props.projectId, reviews: props.reviews, checkpoints: props.checkpoints, onSelectNode: props.onSelect, onOpenNode: props.onDoubleClick, onOpenReview: props.onOpenReview }} onElementsChange={setSurfaceElements}/>
      <SurfaceComponentProposalLayer surface="workflow" elements={proposalElements} renderContext={{ nodes: visibleNodes, edges: visibleEdges }}/>

      <SpatialNodeLayer>
        {actions.map((action, index) => {
          const attachments = action.attachedViewIds.flatMap((id) => { const node = visibleNodes.find((item) => item.id === id); return node ? [node] : [] })
          const runtimeSignal: SpatialRuntimeSignal = props.runOverlay
            ? action.attachedViewIds.some((id) => props.runOverlay?.failedNodeIds.includes(id)) ? 'failed'
              : action.attachedViewIds.some((id) => props.runOverlay?.activeNodeIds.includes(id)) ? 'processing'
                : action.attachedViewIds.length > 0 && action.attachedViewIds.every((id) => props.runOverlay?.completedNodeIds.includes(id)) ? 'complete'
                  : 'idle'
            : 'idle'
          const actionSignal = resolveSpatialSignal({ selected: selectedActionId === action.id, runtime: runtimeSignal })
          return <div
            key={action.id}
            data-workflow-action-id={action.id}
            className={`lcos-workflow-action lcos-spatial-placement ${actionSignal.signalClass} ${selectedActionId === action.id ? 'selected' : ''} ${draggingActionId === action.id ? 'is-dragging' : ''} ${linkTargetId === action.id ? 'is-link-target' : ''} ${link?.from === action.id ? 'is-link-source' : ''}`}
            data-spatial-signal={actionSignal.state}
            style={{ left: action.x, top: action.y, width: ACTION_WIDTH, height: ACTION_HEIGHT, '--i': index } as CSSProperties}
            onPointerDown={(event) => beginActionDrag(event, action)}
            onPointerMove={moveActionDrag}
            onPointerUp={endActionDrag}
            onClick={(event) => { event.stopPropagation(); setSelectedActionId(action.id); setSelectedEdge(null); setSelectedActionEdge(null) }}
          >
            <button type="button" data-workflow-action-input={action.id} className="lcos-workflow-port input" aria-label={`连接到 ${action.label}`} onPointerDown={(event) => event.stopPropagation()}/>
            <div className="lcos-workflow-action-index">{String(index + 1).padStart(2, '0')}</div>
            <div className="lcos-workflow-action-copy"><strong>{action.label}</strong><small>{attachments.length ? `${attachments.length} 份材料` : '暂未挂材料'}</small></div>
            <div className="lcos-workflow-action-attachments">
              <Paperclip size={9}/>
              {attachments.slice(0, 3).map((node) => <span key={node.id} title={node.title}>{node.title}<button type="button" aria-label={`从 ${action.label} 移除 ${node.title}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); detachMaterial(action.id, node.id) }}>×</button></span>)}
              {attachments.length > 3 && <em>+{attachments.length - 3}</em>}
            </div>
            <div className="lcos-workflow-action-tools">
              <button type="button" disabled={!selectedMaterialIds.length} title="把当前 Selection 作为这一步的材料" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); attachSelection(action.id) }}><Paperclip size={10}/></button>
              <button type="button" title="删除步骤；材料不会被删除" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); removeAction(action.id) }}><Trash2 size={10}/></button>
            </div>
            <button type="button" className="lcos-workflow-port output" aria-label={`从 ${action.label} 连接下一步`} onPointerDown={(event) => beginLink(event, action.id)}><Link2 size={8}/></button>
            {(selectedActionId === action.id || runtimeSignal !== 'idle') && <span className="lcos-workflow-action-signal" data-spatial-signal={selectedActionId === action.id && actionSignal.state === 'stable' ? 'focus' : actionSignal.state} aria-hidden="true"><LcosSignalGlyph state={selectedActionId === action.id && actionSignal.state === 'stable' ? 'focus' : actionSignal.state}/></span>}
          </div>
        })}

        {renderItems.map(({ node, x, y, width }, index) => {
          const owner = firstActionForView.get(node.id)
          const usageCount = usageCountByView.get(node.id) ?? 0
          const usageHint = owner ? (usageCount > 1 ? `用于 ${usageCount} 步 · 首先：${owner.label}` : `用于：${owner.label}`) : (node.kind === 'process' ? '运行记录 · 不是 Step' : '待挂接材料')
          const runClass = props.runOverlay ? props.runOverlay.activeNodeIds.includes(node.id) ? 'run-active' : props.runOverlay.failedNodeIds.includes(node.id) ? 'run-failed' : props.runOverlay.completedNodeIds.includes(node.id) ? 'run-completed' : '' : ''
          return <div key={node.id} data-workflow-material-id={node.id} className={`lcos-workflow-node lcos-workflow-material lcos-spatial-placement ${owner ? 'is-attached' : 'is-unassigned'} ${props.selectedIds.includes(node.id) ? 'selected' : ''} ${draggingId === node.id ? 'is-dragging' : ''} ${pinnedIds.includes(node.id) ? 'is-manual-anchor' : ''} ${props.attentionBucketsByViewId?.[node.id] ? `attention-${props.attentionBucketsByViewId[node.id]}` : ''} ${runClass}`} data-attention-bucket={props.attentionBucketsByViewId?.[node.id]} style={{ left: x, top: y, width, '--i': index } as CSSProperties} onPointerDown={(event) => beginMaterialDrag(event, node.id)} onPointerMove={moveMaterialDrag} onPointerUp={endMaterialDrag} onPointerCancel={cancelMaterialDrag}>
            <SurfaceObject node={node} compact performanceProxy={(materialLod === 'aggregate' || materialLod === 'overview') && !props.selectedIds.includes(node.id)} usageHint={usageHint} spatialSemantic={boundRegionSemanticForView(surfaceElements, node.id)} selected={props.selectedIds.includes(node.id)} dropIds={props.selectedIds.includes(node.id) && props.selectedIds.length ? props.selectedIds : [node.id]} onDirectProjectViewDrop={props.onDirectProjectViewDrop} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/>
            <button type="button" className="lcos-workflow-bypass" title="从当前 Workflow 移除；原材料保持不变" aria-label={`从工作流移除 ${node.title}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => removeMaterial(node.id)}><Unplug size={10}/></button>
            {pinnedIds.includes(node.id) && <i className="lcos-manual-anchor-mark" title="手工位置锚点"/>}
          </div>
        })}
        {layoutPreview?.positions.map((position) => { const item = byId.get(position.id); return item ? <div key={`layout-ghost:${position.id}`} className="lcos-layout-ghost lcos-layout-ghost-workflow" style={{ left: position.x, top: position.y, width: item.width, height: item.height }} aria-hidden="true"><span>{item.node.title}</span></div> : null })}
      </SpatialNodeLayer>
    </SpatialCanvas>

    {selectedActionEdgeRecord && <aside className="lcos-workflow-edge-inspector action-edge" aria-label="步骤关系"><header><strong>步骤关系</strong><button type="button" onClick={() => setSelectedActionEdge(null)}>×</button></header><label>条件 / 分支 / handoff<input value={actionEdgeLabelDraft} placeholder="例如：客户确认后 / A 方向" onChange={(event) => updateActionEdgeLabel(event.target.value)}/></label><small>{actionById.get(selectedActionEdgeRecord.fromActionId)?.label ?? 'Step'} → {actionById.get(selectedActionEdgeRecord.toActionId)?.label ?? 'Step'}</small><div className="lcos-workflow-edge-actions"><button type="button" className="danger" onClick={() => { setWorkflowActionState((current) => ({ ...current, edges: current.edges.filter((edge) => edge.id !== selectedActionEdgeRecord.id) })); setSelectedActionEdge(null) }}>删除步骤关系</button></div></aside>}

    {selectedEdgeRecord && <aside className="lcos-workflow-edge-inspector material-edge" aria-label="材料关系"><header><strong>{selectedEdgeRecord.scope === 'domain' ? '项目材料关系' : '临时材料关系'}</strong><button type="button" onClick={() => setSelectedEdge(null)}>×</button></header><label>关系类型 / 说明<input value={edgeLabelDraft} disabled={edgeBusy} placeholder="例如：depends_on / supports" onChange={(event) => updateSelectedEdgeLabel(event.target.value)}/></label><small>{selectedEdgeRecord.from} → {selectedEdgeRecord.to}</small>{editableSelectedEdge && <div className="lcos-workflow-edge-actions">{props.onCreateDomainRelation && <button type="button" disabled={edgeBusy} onClick={() => { void promoteSelectedEdge() }}>保存为项目关系</button>}<button type="button" className="danger" disabled={edgeBusy} onClick={() => { setPresentationEdges((current) => current.filter((edge) => edge.id !== selectedEdgeRecord.id)); setSelectedEdge(null) }}>删除临时关系</button></div>}{selectedEdgeRecord.scope === 'domain' && <div className="lcos-workflow-edge-actions">{props.onUpdateDomainRelation && <button type="button" disabled={edgeBusy || !edgeLabelDraft.trim()} onClick={() => { void saveDomainEdge() }}>保存关系</button>}{props.onDeleteDomainRelation && <button type="button" className="danger" disabled={edgeBusy} onClick={() => { void deleteDomainEdge() }}>删除项目关系</button>}</div>}</aside>}
  </section>
}
