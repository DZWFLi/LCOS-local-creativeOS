import { ChevronRight, CirclePlus, MessageSquareText } from 'lucide-react'
import { useMemo } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import type { CanvasEdge, CanvasNode } from '../../model'
import { useProjectionLayoutState } from '../../state/projectionLayoutState'
import { nodeTypeIcon } from '../canvas/CanvasNodeVisual'
import { ContextHistoryRail } from './ContextHistoryRail'
import type { ContextSurfaceRuntime } from './surfaceContracts'
import { incomingMap, orderedNodes, outgoingMap } from './surfaceModel'

interface Props { projectId:string; scopeId:string; nodes:CanvasNode[]; edges:CanvasEdge[]; selectedIds:string[]; runtime?:ContextSurfaceRuntime; onSelect:(id:string, additive?:boolean)=>void; onDoubleClick:(id:string)=>void }
type Placed={node:CanvasNode;x:number;y:number;depth:number;parentId:string|null;hasChildren:boolean;branch:number}

const COLORS=['#7862c8','#4f83a3','#bd766b','#71906a','#9a72a8','#a58a52']

/** Mubu-inspired Mind Map renderer. Outline remains a separate document renderer. */
export function ContextTreeSurface(props:Props){
  const defaultRoots=useMemo(()=>{const incoming=incomingMap(props.edges);return orderedNodes(props.nodes).filter((node)=>!(incoming.get(node.id)?.length)).map((node)=>node.id)},[props.edges,props.nodes])
  const [state,setState]=useProjectionLayoutState(props.projectId,props.scopeId,'context-tree',{collapsedIds:[],rootIds:defaultRoots})
  const placed=useMemo<Placed[]>(()=>{
    const byId=new Map(props.nodes.map((node)=>[node.id,node])),incoming=incomingMap(props.edges),outgoing=outgoingMap(props.edges)
    const roots=[...state.rootIds.filter((id)=>byId.has(id)),...defaultRoots.filter((id)=>!state.rootIds.includes(id))]
    if(!roots.length)roots.push(...orderedNodes(props.nodes).slice(0,1).map((node)=>node.id))
    const visible=new Set<string>(),queue=roots.map((id,index)=>({id,depth:0,parentId:null as string|null,branch:index}))
    const rows: Array<{id:string;depth:number;parentId:string|null;branch:number}>=[]
    while(queue.length){const item=queue.shift()!;if(visible.has(item.id)||!byId.has(item.id))continue;visible.add(item.id);rows.push(item);if(state.collapsedIds.includes(item.id))continue;for(const edge of outgoing.get(item.id)??[])queue.push({id:edge.to,depth:item.depth+1,parentId:item.id,branch:item.depth===0?rows.length:item.branch})}
    for(const node of orderedNodes(props.nodes))if(!visible.has(node.id)&&!(incoming.get(node.id)?.some((edge)=>visible.has(edge.from))))rows.push({id:node.id,depth:0,parentId:null,branch:rows.length})
    const levels=new Map<number,typeof rows>()
    rows.forEach((row)=>levels.set(row.depth,[...(levels.get(row.depth)??[]),row]))
    return rows.map((row)=>{
      const level=levels.get(row.depth)??[row]
      const index=level.findIndex((item)=>item.id===row.id)
      const spread=Math.min(560,Math.max(90,(level.length-1)*86))
      return {node:byId.get(row.id)!,depth:row.depth+1,parentId:row.parentId,branch:row.branch,x:364+row.depth*246,y:380-spread/2+(level.length===1?0:index*(spread/(level.length-1))),hasChildren:(outgoing.get(row.id)?.length??0)>0}
    })
  },[defaultRoots,props.edges,props.nodes,state.collapsedIds,state.rootIds])
  const byPlaced=new Map(placed.map((item)=>[item.node.id,item]))
  const toggle=(id:string)=>setState((current)=>({...current,collapsedIds:current.collapsedIds.includes(id)?current.collapsedIds.filter((item)=>item!==id):[...current.collapsedIds,id]}))
  const navigate=(event:KeyboardEvent<HTMLButtonElement>,index:number)=>{
    const key=event.key
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key))return
    event.preventDefault()
    const current=placed[index]
    const target=key==='ArrowLeft'&&current.parentId?byPlaced.get(current.parentId):key==='ArrowRight'?placed.find((item)=>item.parentId===current.node.id):placed[Math.max(0,Math.min(placed.length-1,index+(key==='ArrowUp'?-1:1)))]
    if(target){props.onSelect(target.node.id);document.querySelector<HTMLButtonElement>(`[data-mind-topic="${CSS.escape(target.node.id)}"]`)?.focus()}
  }
  return <section className="lcos-dedicated-surface lcos-context-tree lcos-mind-map" data-testid="surface-context-tree">
    <header className="lcos-surface-heading"><div><strong>思维导图</strong><span>结构化理解</span></div><small>{defaultRoots.length||1} 个中心主题 · Hover 编辑</small></header>
    <svg className="lcos-mind-map-edges" viewBox="0 0 1260 760" preserveAspectRatio="none">{placed.map((to)=>{const from=to.parentId?byPlaced.get(to.parentId):null,x1=from?from.x+182:312,y1=from?from.y+17:397,x2=to.x,y2=to.y+17,m=x1+(x2-x1)*.48;return <path key={`${to.parentId??'context-root'}:${to.node.id}`} d={`M${x1} ${y1} C${m} ${y1},${m} ${y2},${x2} ${y2}`} style={{'--branch-color':COLORS[to.branch%COLORS.length]} as CSSProperties}/>})}</svg>
    <div className="lcos-mind-map-root"><MessageSquareText size={14}/><span><strong>当前 Context</strong><small>{props.nodes.length} 个对象 · Presentation</small></span></div>
    {placed.map((item,index)=>{const Icon=nodeTypeIcon(item.node),color=COLORS[item.branch%COLORS.length],collapsed=state.collapsedIds.includes(item.node.id);return <div key={item.node.id} className={`lcos-mind-topic-wrap depth-${Math.min(3,item.depth)}`} style={{left:item.x,top:item.y,'--branch-color':color,'--i':index} as CSSProperties}>
      <button type="button" data-mind-topic={item.node.id} className={`lcos-mind-topic ${props.selectedIds.includes(item.node.id)?'selected':''}`} onClick={(event)=>props.onSelect(item.node.id,event.shiftKey||event.metaKey||event.ctrlKey)} onDoubleClick={()=>props.onDoubleClick(item.node.id)} onKeyDown={(event)=>navigate(event,index)}><Icon/><span><strong>{item.node.title}</strong>{item.node.subtitle&&<small>{item.node.subtitle}</small>}</span></button>
      <div className="lcos-mind-topic-tools"><button type="button" aria-label={`从 ${item.node.title} 新增分支`} title="新增分支（Presentation）"><CirclePlus size={11}/></button>{item.hasChildren&&<button type="button" aria-label={collapsed?'展开分支':'折叠分支'} onClick={()=>toggle(item.node.id)}><ChevronRight size={11} className={collapsed?'':'expanded'}/>{collapsed&&<em>{(outgoingMap(props.edges).get(item.node.id)?.length??0)}</em>}</button>}</div>
    </div>})}
    {props.runtime&&<ContextHistoryRail history={props.runtime.history} handoffs={props.runtime.handoffs} onBranch={props.runtime.onBranchHistory} onCompare={props.runtime.onCompareHistory} onSource={props.runtime.onOpenHistorySource}/>} 
  </section>
}
