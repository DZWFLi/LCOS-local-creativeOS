import { MessageSquareText } from 'lucide-react'
import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { CanvasEdge, CanvasNode } from '../../model'
import { ContextHistoryRail } from './ContextHistoryRail'
import type { ContextSurfaceRuntime } from './surfaceContracts'
import { SurfaceObject } from './SurfaceObject'

interface Props { projectId:string; scopeId:string; nodes:CanvasNode[]; edges:CanvasEdge[]; selectedIds:string[]; runtime?:ContextSurfaceRuntime; onSelect:(id:string, additive?:boolean)=>void; onDoubleClick:(id:string)=>void }

/**
 * Context Free View: no role lanes and no project taxonomy. It is simply a
 * flexible projection that local Agents can shape per imported conversation or
 * per temporary context set.
 */
export function ContextFlowSurface(props:Props){
  const layout=useMemo(()=>{
    if(!props.nodes.length)return{items:[],edges:[]}
    const left=Math.min(...props.nodes.map((node)=>node.x)),top=Math.min(...props.nodes.map((node)=>node.y))
    const right=Math.max(...props.nodes.map((node)=>node.x+node.width)),bottom=Math.max(...props.nodes.map((node)=>node.y+node.height))
    const spanX=Math.max(1,right-left),spanY=Math.max(1,bottom-top)
    const items=props.nodes.map((node)=>({node,left:10+((node.x-left)/spanX)*80,top:12+((node.y-top)/spanY)*74,width:Math.max(10,Math.min(36,(node.width/spanX)*100))}))
    const byId=new Map(items.map((item)=>[item.node.id,item]))
    const edges=props.edges.filter((edge)=>byId.has(edge.from)&&byId.has(edge.to)).map((edge)=>{const a=byId.get(edge.from)!,b=byId.get(edge.to)!;return{edge,x1:a.left+a.width/2,y1:a.top+4,x2:b.left+b.width/2,y2:b.top+4}})
    return{items,edges}
  },[props.edges,props.nodes])
  return <section className="lcos-dedicated-surface lcos-context-free" data-testid="surface-context-flow">
    <header className="lcos-surface-heading"><div><strong>上下文</strong><span>自由视图</span></div><small>不预设项目语义 · 让 Agent / 用户自己组织</small></header>
    <div className="lcos-context-free-stage">
      <svg className="lcos-context-free-edges" aria-hidden="true">{layout.edges.map(({edge,x1,y1,x2,y2})=><line key={edge.id} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} className={edge.active?'active':''}/>)}</svg>
      {layout.items.map(({node,left,top,width},index)=><div key={node.id} className="lcos-context-free-node" style={{left:`${left}%`,top:`${top}%`,width:`${width}%`,'--i':index} as CSSProperties}><SurfaceObject node={node} compact selected={props.selectedIds.includes(node.id)} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/></div>)}
      {!layout.items.length&&<div className="lcos-context-free-empty"><MessageSquareText size={18}/><strong>没有固定的“项目上下文结构”</strong><span>导入一条对话，或选一批内容，让 Agent 按这次协作需要组织。</span></div>}
    </div>
    {props.runtime&&props.runtime.history.length>0&&<ContextHistoryRail history={props.runtime.history} handoffs={props.runtime.handoffs} onBranch={props.runtime.onBranchHistory} onCompare={props.runtime.onCompareHistory} onSource={props.runtime.onOpenHistorySource}/>} 
  </section>
}
