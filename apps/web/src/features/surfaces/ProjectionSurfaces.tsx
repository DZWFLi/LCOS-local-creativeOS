import { lazy, Suspense } from 'react'
import type { CanvasEdge, CanvasNode } from '../../model'
import type { SurfaceId } from '../shell/SurfaceDock'
import type { ContextSurfaceRuntime, DeliverSurfaceRuntime, WorkSurfaceRuntime } from './surfaceContracts'
import { resolveContextView, resolveWorkflowView } from './capabilityViewResolver'

const OutlineSurface=lazy(()=>import('./OutlineSurface').then((module)=>({default:module.OutlineSurface})))
const ContextFlowSurface=lazy(()=>import('./ContextFlowSurface').then((module)=>({default:module.ContextFlowSurface})))
const ContextGraphSurface=lazy(()=>import('./ContextGraphSurface').then((module)=>({default:module.ContextGraphSurface})))
const ContextTreeSurface=lazy(()=>import('./ContextTreeSurface').then((module)=>({default:module.ContextTreeSurface})))
const WorkflowSurface=lazy(()=>import('./WorkflowSurface').then((module)=>({default:module.WorkflowSurface})))
// Legacy renderers stay in the source package so older saved preferredSurface
// values can still be opened during migration. They are not dock destinations.
const DeliverSurface=lazy(()=>import('./DeliverSurface').then((module)=>({default:module.DeliverSurface})))
const WorkSurface=lazy(()=>import('./WorkSurface').then((module)=>({default:module.WorkSurface})))
const WorkFreeSurface=lazy(()=>import('./WorkFreeSurface').then((module)=>({default:module.WorkFreeSurface})))

interface Props { projectId:string; scopeId:string; surface:Exclude<SurfaceId,'arrange'>; nodes:CanvasNode[]; edges:CanvasEdge[]; selectedIds:string[]; presentationIds?:string[]; presentationIncludeOneHop?:boolean; workspaceFocusIds?:string[]; contextRuntime?:ContextSurfaceRuntime; workRuntime?:WorkSurfaceRuntime; deliverRuntime?:DeliverSurfaceRuntime; onSelect:(id:string, additive?:boolean)=>void; onDoubleClick:(id:string)=>void; onContextStart?:(kind:'conversation'|'selection'|'agent')=>void; onWorkflowStart?:(kind:'selection'|'skill'|'agent')=>void }

/** Dedicated renderers share Project Truth and Selection, not business taxonomy. */
export function ProjectionSurface(props:Props){
  // Selection is a transient spatial session. It becomes Presentation membership only after an explicit action.
  const intent={explicitObjectIds:props.presentationIds,workspaceFocusIds:props.workspaceFocusIds,includeOneHop:props.presentationIncludeOneHop??true}
  const context=resolveContextView(props.nodes,props.edges,intent,props.contextRuntime?.history??[])
  const workflow=resolveWorkflowView(props.nodes,props.edges,intent)
  const isContext=props.surface==='outline'||props.surface==='context-flow'||props.surface==='context-tree'||props.surface==='context-graph'
  const resolved=isContext?context:props.surface==='workflow'?workflow:null
  const common={projectId:props.projectId,scopeId:props.scopeId,nodes:resolved?.nodes??props.nodes,edges:resolved?.edges??props.edges,selectedIds:props.selectedIds,onSelect:props.onSelect,onDoubleClick:props.onDoubleClick}
  const contextRuntime=context.sourceKind==='conversation'?props.contextRuntime:undefined
  return <Suspense fallback={<SurfaceLoading/>}>{
    props.surface==='outline'?<OutlineSurface {...common} source={{kind:context.sourceKind,label:context.sourceLabel}}/>:
    props.surface==='context-flow'?<ContextFlowSurface {...common} source={{kind:context.sourceKind,label:context.sourceLabel}} runtime={contextRuntime} onStart={props.onContextStart}/>:
    props.surface==='context-tree'?<ContextTreeSurface {...common} source={{kind:context.sourceKind,label:context.sourceLabel}} runtime={contextRuntime}/>:
    props.surface==='context-graph'?<ContextGraphSurface {...common} source={{kind:context.sourceKind,label:context.sourceLabel}} runtime={contextRuntime}/>:
    props.surface==='workflow'?<WorkflowSurface {...common} source={{kind:workflow.sourceKind,label:workflow.sourceLabel}} onStart={props.onWorkflowStart}/>:
    props.surface==='work'?<WorkSurface {...common} runtime={props.workRuntime}/>:
    props.surface==='work-free'?<WorkFreeSurface {...common}/>:
    props.surface==='deliver-versions'?<DeliverSurface {...common} runtime={props.deliverRuntime} variant="versions"/>:
    props.surface==='deliver-pack'?<DeliverSurface {...common} runtime={props.deliverRuntime} variant="pack"/>:
    <DeliverSurface {...common} runtime={props.deliverRuntime}/>
  }</Suspense>
}
function SurfaceLoading(){return <div className="lcos-surface-loading" aria-live="polite"><i/><span>Loading view…</span></div>}
