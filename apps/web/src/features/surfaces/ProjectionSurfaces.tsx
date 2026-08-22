import { lazy, Suspense, useMemo } from 'react'
import type { AttentionBucketV0 } from '@local-creative-os/contracts'
import type { CanvasEdge, CanvasNode } from '../../model'
import type { ContextViewSummary } from '../context/contextMerge'
import type { SurfaceId } from '../shell/SurfaceDock'
import type { ContextHistoryEntry, ContextSurfaceRuntime, DeliverSurfaceRuntime, WorkSurfaceRuntime } from './surfaceContracts'
import type { WorkflowViewSummary } from './WorkflowGraphSurface'
import { resolveContextView, resolveWorkflowView } from './capabilityViewResolver'
import type { SpatialFocusRequest } from '../spatial/useSpatialFocusRequest'

const OutlineSurface=lazy(()=>import('./OutlineSurface').then((module)=>({default:module.OutlineSurface})))
const ContextSpaceSurface=lazy(()=>import('./ContextSpaceSurface').then((module)=>({default:module.ContextSpaceSurface})))
const ContextFlowSurface=lazy(()=>import('./ContextFlowSurface').then((module)=>({default:module.ContextFlowSurface})))
const ContextRelationshipHomeSurface=lazy(()=>import('./ContextRelationshipHomeSurface').then((module)=>({default:module.ContextRelationshipHomeSurface})))
const ContextTreeSurface=lazy(()=>import('./ContextTreeSurface').then((module)=>({default:module.ContextTreeSurface})))
const WorkflowSurface=lazy(()=>import('./WorkflowSurface').then((module)=>({default:module.WorkflowSurface})))
// Legacy renderers stay in the source package so older saved preferredSurface
// values can still be opened during migration. They are not dock destinations.
const DeliverSurface=lazy(()=>import('./DeliverSurface').then((module)=>({default:module.DeliverSurface})))
const WorkSurface=lazy(()=>import('./WorkSurface').then((module)=>({default:module.WorkSurface})))
const WorkFreeSurface=lazy(()=>import('./WorkFreeSurface').then((module)=>({default:module.WorkFreeSurface})))

const EMPTY_HISTORY: readonly ContextHistoryEntry[] = []

interface Props { projectId:string; scopeId:string; attentionBucketsByViewId?:Readonly<Record<string,AttentionBucketV0>>; contextHomeScopeId?:string; surface:Exclude<SurfaceId,'arrange'>; nodes:CanvasNode[]; edges:CanvasEdge[]; selectedIds:string[]; presentationIds?:string[]; workspaceFocusIds?:string[]; contextRuntime?:ContextSurfaceRuntime; workRuntime?:WorkSurfaceRuntime; deliverRuntime?:DeliverSurfaceRuntime; contextViews?:readonly ContextViewSummary[]; workflowViews?:readonly WorkflowViewSummary[]; workflowReviews?:readonly {runId:string;label:string;phase:string}[]; workflowCheckpoints?:readonly {checkpointId:string;label:string;createdAt:string}[]; onOpenWorkflowReview?:(runId:string)=>void; activeWorkflowId?:string|null; onContextMergeAccept?:(sourceContextId:string, targetContextId:string, additions:readonly string[])=>void; onOpenContextView?:(contextId:string)=>void; onOpenWorkflowView?:(workflowId:string)=>void; onAddMembersToContext?:(contextId:string,memberViewIds:readonly string[])=>void; onAddMembersToContextGraph?:(memberViewIds:readonly string[])=>void; onCreateContextFromMembers?:(memberViewIds:readonly string[])=>void; onImportProjectViewToContext?:(memberViewIds:readonly string[])=>string[]; onRemoveProjectViewFromContext?:(memberViewId:string)=>void; onImportProjectViewToWorkflow?:(memberViewIds:readonly string[])=>string[]; onCreateWorkflowOperatorNode?:(kind:'condition'|'parallel-split'|'parallel-join'|'reference',point:{x:number;y:number})=>Promise<string|null>; workflowRunOverlay?:{activeNodeIds:string[];completedNodeIds:string[];failedNodeIds:string[]}; workflowWorkspaces?:{id:string;title:string;memberCount:number;order:number;active?:boolean}[]; onReorderWorkspace?:(id:string,direction:-1|1)=>void; onActivateWorkflowWorkspace?:(id:string)=>void; onCreateWorkflowWorkspace?:()=>void; onAddToWorkspace?:(workspaceId:string,viewIds:readonly string[])=>void; onExportWorkflow?:()=>void; onImportWorkflow?:(file:File)=>void; onSelect:(id:string, additive?:boolean)=>void; onMarqueeSelect?:(ids:string[], additive:boolean)=>void; onDoubleClick:(id:string)=>void; onContextStart?:(kind:'conversation'|'selection'|'agent')=>void; onWorkflowStart?:(kind:'selection'|'skill'|'agent')=>void; onDirectProjectViewDrop?:(targetViewId:string,sourceIds:readonly string[])=>void; onCreateDomainRelation?:(fromViewId:string,toViewId:string,kind:string)=>Promise<void>; onUpdateDomainRelation?:(relationId:string,kind:string)=>Promise<void>; onDeleteDomainRelation?:(relationId:string)=>Promise<void>; onSurfaceChange?:(surface:SurfaceId)=>void; focusRequest?:SpatialFocusRequest }

/** Dedicated renderers share Project Truth and Selection, not business taxonomy. */
export function ProjectionSurface(props:Props){
  // Selection is a transient spatial session. It becomes Presentation membership only after an explicit action.
  // GUI-7: resolved views must be stable across renders — a fresh edges/nodes array
  // every render makes renderer reconciliation effects re-run and echo-save forever.
  // Phase 3 §6.2：层级渲染面（大纲/思维导图）只排「已保存的 Context 成员」，
  // 不把一跳邻居混进可编辑层级——Core 的 hierarchy 校验要求成员内引用。
  // Context detail and Workflow consume exact Project View membership. A saved
  // Presentation is not a transient Selection and is never auto-expanded by Scope
  // or one-hop neighbours.
  const intent=useMemo(()=>({explicitViewIds:props.presentationIds,workspaceFocusIds:props.workspaceFocusIds,includeOneHop:false}),[props.presentationIds,props.workspaceFocusIds])
  const history=props.contextRuntime?.history ?? EMPTY_HISTORY
  const context=useMemo(()=>resolveContextView(props.nodes,props.edges,intent,history),[history,intent,props.edges,props.nodes])
  const workflow=useMemo(()=>resolveWorkflowView(props.nodes,props.edges,intent),[intent,props.edges,props.nodes])
  const isContextDetail=props.surface==='outline'||props.surface==='context-space'||props.surface==='context-flow'||props.surface==='context-tree'
  const graphIds=useMemo(()=>props.surface==='context-graph'&&props.presentationIds!==undefined?new Set(props.presentationIds):null,[props.presentationIds,props.surface])
  const graphResolved=useMemo(()=>graphIds===null?null:{
    nodes:props.nodes.filter((node)=>graphIds.has(node.id)),
    edges:props.edges.filter((edge)=>graphIds.has(edge.from)&&graphIds.has(edge.to)),
  },[graphIds,props.edges,props.nodes])
  const isWorkflowDetail=props.surface==='workflow'
  const resolved=isContextDetail?context:isWorkflowDetail?workflow:null
  // All capability surfaces project the same Project node identities. Context
  // Graph has its own exact project-level membership; concrete Context detail
  // and Workflow have independent exact memberships over that same universe.
  const common={projectId:props.projectId,scopeId:props.scopeId,attentionBucketsByViewId:props.attentionBucketsByViewId,nodes:graphResolved?.nodes??resolved?.nodes??props.nodes,edges:graphResolved?.edges??resolved?.edges??props.edges,selectedIds:props.selectedIds,onSelect:props.onSelect,onMarqueeSelect:props.onMarqueeSelect,onDoubleClick:props.onDoubleClick}
  const focusable={...common,focusRequest:props.focusRequest}
  // S2：Context History（快照 + Handoff）是任意 Context 详情的真实历史，
  // 不再只对 conversation 来源的 Context 开放。
  const contextRuntime=props.contextRuntime
  return <Suspense fallback={<SurfaceLoading/>}>{
    props.surface==='outline'?<OutlineSurface {...common} source={{kind:context.sourceKind,label:context.sourceLabel}}/>:
    props.surface==='context-space'?<ContextSpaceSurface {...focusable} onSurfaceChange={props.onSurfaceChange} onDirectProjectViewDrop={props.onDirectProjectViewDrop} source={{kind:context.sourceKind,label:context.sourceLabel}} runtime={contextRuntime} onImportProjectView={props.onImportProjectViewToContext}/>:
    props.surface==='context-flow'?<ContextFlowSurface {...focusable} onSurfaceChange={props.onSurfaceChange} onDirectProjectViewDrop={props.onDirectProjectViewDrop} source={{kind:context.sourceKind,label:context.sourceLabel}} runtime={contextRuntime} onStart={props.onContextStart} onImportProjectView={props.onImportProjectViewToContext} onRemoveMember={props.onRemoveProjectViewFromContext}/>:
    props.surface==='context-tree'?<ContextTreeSurface {...focusable} onSurfaceChange={props.onSurfaceChange} onDirectProjectViewDrop={props.onDirectProjectViewDrop} source={{kind:context.sourceKind,label:context.sourceLabel}} runtime={contextRuntime}/>:
    props.surface==='context-graph'?<ContextRelationshipHomeSurface {...focusable} onDirectProjectViewDrop={props.onDirectProjectViewDrop} scopeId={props.contextHomeScopeId??props.scopeId} contextViews={props.contextViews} onContextMergeAccept={props.onContextMergeAccept} onOpenContextView={props.onOpenContextView} onAddMembersToContext={props.onAddMembersToContext} onAddMembersToGraph={props.onAddMembersToContextGraph} onCreateContextFromMembers={props.onCreateContextFromMembers}/>:
    props.surface==='workflow'?<WorkflowSurface {...focusable} reviews={props.workflowReviews} checkpoints={props.workflowCheckpoints} onOpenReview={props.onOpenWorkflowReview} onDirectProjectViewDrop={props.onDirectProjectViewDrop} onCreateDomainRelation={props.onCreateDomainRelation} onUpdateDomainRelation={props.onUpdateDomainRelation} onDeleteDomainRelation={props.onDeleteDomainRelation} source={{kind:workflow.sourceKind,label:workflow.sourceLabel}} runOverlay={props.workflowRunOverlay} workspaces={props.workflowWorkspaces} onReorderWorkspace={props.onReorderWorkspace} onActivateWorkspace={props.onActivateWorkflowWorkspace} onCreateWorkspace={props.onCreateWorkflowWorkspace} onAddToWorkspace={props.onAddToWorkspace} onImportProjectView={props.onImportProjectViewToWorkflow} onCreateOperatorNode={props.onCreateWorkflowOperatorNode} onExportWorkflow={props.onExportWorkflow} onImportWorkflow={props.onImportWorkflow} onStart={props.onWorkflowStart}/>:
    props.surface==='work'?<WorkSurface {...common} runtime={props.workRuntime}/>:
    props.surface==='work-free'?<WorkFreeSurface {...common}/>:
    props.surface==='deliver-versions'?<DeliverSurface {...common} runtime={props.deliverRuntime} variant="versions"/>:
    props.surface==='deliver-pack'?<DeliverSurface {...common} runtime={props.deliverRuntime} variant="pack"/>:
    <DeliverSurface {...common} runtime={props.deliverRuntime}/>
  }</Suspense>
}
function SurfaceLoading(){return <div className="lcos-surface-loading" aria-live="polite"><i/><span>Loading view…</span></div>}
