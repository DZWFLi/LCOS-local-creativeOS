import { ChevronDown, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { CanvasEdge, CanvasNode } from '../../model'
import { useProjectionLayoutState } from '../../state/projectionLayoutState'
import { ContextHistoryRail } from './ContextHistoryRail'
import type { ContextSurfaceRuntime } from './surfaceContracts'
import { SurfaceObject } from './SurfaceObject'
import { incomingMap, orderedNodes, outgoingMap } from './surfaceModel'

interface Props { projectId:string; scopeId:string; nodes:CanvasNode[]; edges:CanvasEdge[]; selectedIds:string[]; runtime?:ContextSurfaceRuntime; onSelect:(id:string, additive?:boolean)=>void; onDoubleClick:(id:string)=>void }
type Placed={node:CanvasNode;x:number;y:number;w:number;h:number;depth:number;hasChildren:boolean}

export function ContextTreeSurface(props:Props){
  const defaultRoots=useMemo(()=>{const incoming=incomingMap(props.edges);return orderedNodes(props.nodes).filter((node)=>!(incoming.get(node.id)?.length)).map((node)=>node.id)},[props.edges,props.nodes])
  const [state,setState]=useProjectionLayoutState(props.projectId,props.scopeId,'context-tree',{collapsedIds:[],rootIds:defaultRoots})
  const placed=useMemo<Placed[]>(()=>{
    const byId=new Map(props.nodes.map((node)=>[node.id,node])),incoming=incomingMap(props.edges),outgoing=outgoingMap(props.edges)
    const roots=[...state.rootIds.filter((id)=>byId.has(id)),...defaultRoots.filter((id)=>!state.rootIds.includes(id))]
    if(!roots.length)roots.push(...orderedNodes(props.nodes).slice(0,1).map((node)=>node.id))
    const depthById=new Map<string,number>(),visible=new Set<string>(),queue=roots.map((id)=>({id,depth:0}))
    while(queue.length){const item=queue.shift()!;if(visible.has(item.id))continue;visible.add(item.id);depthById.set(item.id,item.depth);if(state.collapsedIds.includes(item.id))continue;for(const edge of outgoing.get(item.id)??[])queue.push({id:edge.to,depth:item.depth+1})}
    for(const node of orderedNodes(props.nodes)){if(!visible.has(node.id)&&!(incoming.get(node.id)?.some((edge)=>visible.has(edge.from)))){visible.add(node.id);depthById.set(node.id,0)}}
    const columns=new Map<number,CanvasNode[]>()
    orderedNodes(props.nodes).filter((node)=>visible.has(node.id)).forEach((node)=>{const depth=depthById.get(node.id)??0;columns.set(depth,[...(columns.get(depth)??[]),node])})
    const result:Placed[]=[]
    for(const [depth,nodes] of [...columns.entries()].sort(([a],[b])=>a-b))nodes.forEach((node,row)=>result.push({node,depth,x:96+depth*254,y:92+row*108+(depth%2)*20,w:188,h:72,hasChildren:(outgoing.get(node.id)?.length??0)>0}))
    return result
  },[defaultRoots,props.edges,props.nodes,state.collapsedIds,state.rootIds])
  const byPlaced=new Map<string,Placed>(placed.map((item)=>[item.node.id,item]))
  const toggle=(id:string)=>setState((current)=>({...current,collapsedIds:current.collapsedIds.includes(id)?current.collapsedIds.filter((item)=>item!==id):[...current.collapsedIds,id]}))
  return <section className="lcos-dedicated-surface lcos-context-tree" data-testid="surface-context-tree">
    <header className="lcos-surface-heading"><div><strong>上下文</strong><span>树状</span></div><small>{defaultRoots.length||1} roots · 可折叠</small></header>
    <svg className="lcos-tree-edges" viewBox="0 0 1260 760" preserveAspectRatio="none">{props.edges.map((edge)=>{const from=byPlaced.get(edge.from),to=byPlaced.get(edge.to);if(!from||!to)return null;const x1=from.x+from.w,y1=from.y+from.h/2,x2=to.x,y2=to.y+to.h/2,m=(x1+x2)/2;return <path key={edge.id} d={`M${x1} ${y1} H${m} V${y2} H${x2}`} className={edge.active?'active':''}/>})}</svg>
    {placed.map((item,index)=><div key={item.node.id} className="lcos-tree-node" style={{left:item.x,top:item.y,width:item.w,height:item.h,'--i':index} as CSSProperties}>{item.hasChildren&&<button className="lcos-tree-fold" type="button" aria-label={state.collapsedIds.includes(item.node.id)?'展开分支':'折叠分支'} onClick={()=>toggle(item.node.id)}>{state.collapsedIds.includes(item.node.id)?<ChevronRight size={11}/>:<ChevronDown size={11}/>}</button>}<SurfaceObject node={item.node} selected={props.selectedIds.includes(item.node.id)} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/></div>)}
    {props.runtime&&<ContextHistoryRail history={props.runtime.history} handoffs={props.runtime.handoffs} onBranch={props.runtime.onBranchHistory} onCompare={props.runtime.onCompareHistory} onSource={props.runtime.onOpenHistorySource}/>} 
  </section>
}
