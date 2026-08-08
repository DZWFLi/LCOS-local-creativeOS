import { lazy, Suspense } from 'react'
import type { CanvasEdge, CanvasNode } from '../../model'
import type { SurfaceId } from '../shell/SurfaceDock'
import type { ContextSurfaceRuntime, DeliverSurfaceRuntime, WorkSurfaceRuntime } from './surfaceContracts'

const OutlineSurface=lazy(()=>import('./OutlineSurface').then((module)=>({default:module.OutlineSurface})))
const ContextFlowSurface=lazy(()=>import('./ContextFlowSurface').then((module)=>({default:module.ContextFlowSurface})))
const ContextGraphSurface=lazy(()=>import('./ContextGraphSurface').then((module)=>({default:module.ContextGraphSurface})))
const ContextTreeSurface=lazy(()=>import('./ContextTreeSurface').then((module)=>({default:module.ContextTreeSurface})))
const DeliverSurface=lazy(()=>import('./DeliverSurface').then((module)=>({default:module.DeliverSurface})))
const WorkSurface=lazy(()=>import('./WorkSurface').then((module)=>({default:module.WorkSurface})))

interface Props { projectId:string; scopeId:string; surface:Exclude<SurfaceId,'arrange'>; nodes:CanvasNode[]; edges:CanvasEdge[]; selectedIds:string[]; contextRuntime?:ContextSurfaceRuntime; workRuntime?:WorkSurfaceRuntime; deliverRuntime?:DeliverSurfaceRuntime; onSelect:(id:string, additive?:boolean)=>void; onDoubleClick:(id:string)=>void }

/** Dedicated renderers share Project Truth and Selection, not DOM anatomy or coordinates. */
export function ProjectionSurface(props:Props){
  const common={projectId:props.projectId,scopeId:props.scopeId,nodes:props.nodes,edges:props.edges,selectedIds:props.selectedIds,onSelect:props.onSelect,onDoubleClick:props.onDoubleClick}
  return <Suspense fallback={<SurfaceLoading/>}>{props.surface==='outline'?<OutlineSurface {...common}/>:props.surface==='context-flow'?<ContextFlowSurface {...common} runtime={props.contextRuntime}/>:props.surface==='context-tree'?<ContextTreeSurface {...common} runtime={props.contextRuntime}/>:props.surface==='context-graph'?<ContextGraphSurface {...common} runtime={props.contextRuntime}/>:props.surface==='work'?<WorkSurface {...common} runtime={props.workRuntime}/>:<DeliverSurface {...common} runtime={props.deliverRuntime}/>}</Suspense>
}
function SurfaceLoading(){return <div className="lcos-surface-loading" aria-live="polite"><i/><span>Loading view…</span></div>}
