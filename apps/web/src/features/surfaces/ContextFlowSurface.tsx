import { ChevronDown, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import type { CanvasEdge, CanvasNode } from '../../model'
import { useProjectionLayoutState } from '../../state/projectionLayoutState'
import { ContextHistoryRail } from './ContextHistoryRail'
import type { ContextSurfaceRuntime } from './surfaceContracts'
import { SurfaceObject } from './SurfaceObject'
import { nodeRole, orderedNodes } from './surfaceModel'

interface Props { projectId:string; scopeId:string; nodes:CanvasNode[]; edges:CanvasEdge[]; selectedIds:string[]; runtime?:ContextSurfaceRuntime; onSelect:(id:string, additive?:boolean)=>void; onDoubleClick:(id:string)=>void }
type Axis={id:string;label:string;hint:string;nodes:CanvasNode[]}

export function ContextFlowSurface(props:Props){
  const [state,setState]=useProjectionLayoutState(props.projectId,props.scopeId,'context-flow',{collapsedAxisIds:[]})
  const axes=useMemo<Axis[]>(()=>{
    const ordered=orderedNodes(props.nodes)
    const feedback=ordered.filter((node)=>['feedback','decision','note'].includes(nodeRole(node)))
    const sessions=ordered.filter((node)=>['session','run','context'].includes(nodeRole(node)))
    const revisions=ordered.filter((node)=>nodeRole(node)==='artifact')
    return [
      {id:'feedback',label:'反馈 / 决策',hint:'why',nodes:feedback},
      {id:'sessions',label:'Session / Run',hint:'who',nodes:sessions},
      {id:'revisions',label:'版本 / 内容',hint:'what changed',nodes:revisions},
    ].filter((axis)=>axis.nodes.length)
  },[props.nodes])
  const toggle=(id:string)=>setState((current)=>({...current,collapsedAxisIds:current.collapsedAxisIds.includes(id)?current.collapsedAxisIds.filter((item)=>item!==id):[...current.collapsedAxisIds,id]}))
  return <section className="lcos-dedicated-surface lcos-context-flow" data-testid="surface-context-flow">
    <header className="lcos-surface-heading"><div><strong>上下文</strong><span>流式轴</span></div><small>{axes.length} axes · {props.nodes.length} objects</small></header>
    {props.runtime?.handoffs.length ? <div className="lcos-handoff-ribbon" aria-label="Agent handoffs">{props.runtime.handoffs.slice(-6).map((handoff,index)=><span key={handoff.id} className="lcos-handoff-step">{index===0&&<b>{handoff.from}</b>}<i>→</i><b>{handoff.to}</b></span>)}</div> : null}
    <div className="lcos-flow-stage">
      {axes.map((axis)=>{const collapsed=state.collapsedAxisIds.includes(axis.id);return <div key={axis.id} className={`lcos-flow-axis axis-${axis.id} ${collapsed?'collapsed':''}`}>
        <button type="button" className="lcos-flow-axis-label" onClick={()=>toggle(axis.id)}>{collapsed?<ChevronRight size={10}/>:<ChevronDown size={10}/>}<strong>{axis.label}</strong><small>{axis.nodes.length}</small></button>
        <i className="lcos-flow-baseline" aria-hidden="true"/>
        {!collapsed&&<div className="lcos-flow-items">{axis.nodes.map((node)=><SurfaceObject key={node.id} node={node} compact selected={props.selectedIds.includes(node.id)} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/>)}</div>}
      </div>})}
    </div>
    {props.runtime&&<ContextHistoryRail history={props.runtime.history} handoffs={props.runtime.handoffs} onBranch={props.runtime.onBranchHistory} onCompare={props.runtime.onCompareHistory} onSource={props.runtime.onOpenHistorySource}/>} 
  </section>
}
