import { Filter, Orbit } from 'lucide-react'
import { useMemo } from 'react'
import type { CanvasEdge, CanvasNode } from '../../model'
import { useProjectionLayoutState } from '../../state/projectionLayoutState'
import { ContextHistoryRail } from './ContextHistoryRail'
import type { ContextSurfaceRuntime } from './surfaceContracts'
import { SurfaceObject } from './SurfaceObject'
import { adjacency, orderedNodes } from './surfaceModel'

interface Props { projectId:string; scopeId:string; nodes:CanvasNode[]; edges:CanvasEdge[]; selectedIds:string[]; runtime?:ContextSurfaceRuntime; onSelect:(id:string, additive?:boolean)=>void; onDoubleClick:(id:string)=>void }
type Dot={node:CanvasNode;x:number;y:number;ring:0|1|2}
const RELATION_KINDS=['reference','generate','modify','feedback'] as const

export function ContextGraphSurface(props:Props){
  const [state,setState]=useProjectionLayoutState(props.projectId,props.scopeId,'context-graph',{hops:2,relationKinds:[...RELATION_KINDS]})
  const filteredEdges=useMemo(()=>props.edges.filter((edge)=>state.relationKinds.includes(edge.kind)),[props.edges,state.relationKinds])
  const dots=useMemo<Dot[]>(()=>{
    const ordered=orderedNodes(props.nodes),focusId=props.selectedIds.at(-1)??ordered[0]?.id;if(!focusId)return[]
    const graph=adjacency(filteredEdges),first=[...(graph.get(focusId)??[])],firstSet=new Set(first),secondSet=new Set<string>()
    if(state.hops===2)first.forEach((id)=>graph.get(id)?.forEach((next)=>{if(next!==focusId&&!firstSet.has(next))secondSet.add(next)}))
    const byId=new Map(props.nodes.map((node)=>[node.id,node])),center=byId.get(focusId),result:Dot[]=center?[{node:center,x:50,y:50,ring:0}]:[]
    first.forEach((id,index)=>{const node=byId.get(id);if(!node)return;const a=(index/Math.max(1,first.length))*Math.PI*2-.45;result.push({node,x:50+Math.cos(a)*23,y:50+Math.sin(a)*29,ring:1})})
    ;[...secondSet].forEach((id,index,arr)=>{const node=byId.get(id);if(!node)return;const a=(index/Math.max(1,arr.length))*Math.PI*2+.2;result.push({node,x:50+Math.cos(a)*39,y:50+Math.sin(a)*41,ring:2})})
    return result
  },[filteredEdges,props.nodes,props.selectedIds,state.hops])
  const ids=new Set(dots.map((dot)=>dot.node.id)),pos=new Map<string,Dot>(dots.map((dot)=>[dot.node.id,dot]))
  const toggleKind=(kind:string)=>setState((current)=>({...current,relationKinds:current.relationKinds.includes(kind)?current.relationKinds.filter((item)=>item!==kind):[...current.relationKinds,kind]}))
  return <section className="lcos-dedicated-surface lcos-context-graph" data-testid="surface-context-graph">
    <header className="lcos-surface-heading"><div><strong>上下文</strong><span>局部关系</span></div><div className="lcos-graph-controls"><button type="button" className={state.hops===1?'active':''} onClick={()=>setState((current)=>({...current,hops:1}))}>1 hop</button><button type="button" className={state.hops===2?'active':''} onClick={()=>setState((current)=>({...current,hops:2}))}>2 hops</button><details><summary title="关系筛选"><Filter size={12}/></summary><div>{RELATION_KINDS.map((kind)=><label key={kind}><input type="checkbox" checked={state.relationKinds.includes(kind)} onChange={()=>toggleKind(kind)}/><span>{kind}</span></label>)}</div></details></div></header>
    <div className="lcos-graph-orbit" aria-hidden="true"><Orbit size={15}/><span>{dots.length} local objects</span></div>
    <svg className="lcos-graph-edges" viewBox="0 0 100 100" preserveAspectRatio="none">{filteredEdges.filter((edge)=>ids.has(edge.from)&&ids.has(edge.to)).map((edge)=>{const a=pos.get(edge.from)!,b=pos.get(edge.to)!;return <line key={edge.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={edge.active?'active':''}/>})}</svg>
    {dots.map((dot)=><div key={dot.node.id} className={`lcos-graph-dot ring-${dot.ring}`} style={{left:`${dot.x}%`,top:`${dot.y}%`}}><SurfaceObject node={dot.node} glyph dim={dot.ring===2} selected={props.selectedIds.includes(dot.node.id)} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/></div>)}
    {props.runtime&&<ContextHistoryRail history={props.runtime.history} handoffs={props.runtime.handoffs} onBranch={props.runtime.onBranchHistory} onCompare={props.runtime.onCompareHistory} onSource={props.runtime.onOpenHistorySource}/>} 
  </section>
}
