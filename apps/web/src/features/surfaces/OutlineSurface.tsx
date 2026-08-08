import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, DragEvent, KeyboardEvent } from 'react'
import type { CanvasEdge, CanvasNode } from '../../model'
import { useProjectionLayoutState } from '../../state/projectionLayoutState'
import { nodeTypeIcon } from '../canvas/CanvasNodeVisual'
import { incomingMap, orderedNodes } from './surfaceModel'

interface Props { projectId:string; scopeId:string; nodes:CanvasNode[]; edges:CanvasEdge[]; selectedIds:string[]; onSelect:(id:string, additive?:boolean)=>void; onDoubleClick:(id:string)=>void }
type Row = { node:CanvasNode; depth:number; hasChildren:boolean }

export function OutlineSurface(props: Props) {
  const initial = useMemo(() => buildInitialRows(props.nodes, props.edges), [props.edges, props.nodes])
  const [state, setState] = useProjectionLayoutState(props.projectId, props.scopeId, 'outline', {
    orderIds: initial.map((row)=>row.node.id),
    depthById: Object.fromEntries(initial.map((row)=>[row.node.id,row.depth])),
    collapsedIds: [],
  })
  const [dragId,setDragId] = useState<string|null>(null)

  useEffect(() => {
    const ids = new Set(props.nodes.map((node)=>node.id))
    setState((current) => {
      const order = [...current.orderIds.filter((id)=>ids.has(id)), ...initial.map((row)=>row.node.id).filter((id)=>!current.orderIds.includes(id))]
      const depth = { ...Object.fromEntries(initial.map((row)=>[row.node.id,row.depth])), ...current.depthById }
      if (order.join('|') === current.orderIds.join('|') && Object.keys(depth).length === Object.keys(current.depthById).length) return current
      return { ...current, orderIds:order, depthById:depth }
    })
  }, [initial, props.nodes, setState])

  const rows = useMemo<Row[]>(() => {
    const byId=new Map(props.nodes.map((node)=>[node.id,node]))
    const hiddenDepths:number[]=[]
    const result:Row[]=[]
    for(const id of state.orderIds){
      const node=byId.get(id); if(!node) continue
      const depth=Math.max(0,state.depthById[id]??0)
      while(hiddenDepths.length && depth<=hiddenDepths.at(-1)!) hiddenDepths.pop()
      if(hiddenDepths.length) continue
      const index=state.orderIds.indexOf(id)
      const nextId=state.orderIds.slice(index+1).find((candidate)=>byId.has(candidate))
      const nextDepth=nextId ? Math.max(0,state.depthById[nextId]??0) : 0
      const hasChildren=Boolean(nextId && nextDepth>depth)
      result.push({node,depth,hasChildren})
      if(hasChildren && state.collapsedIds.includes(id)) hiddenDepths.push(depth)
    }
    return result
  }, [props.nodes, state.collapsedIds, state.depthById, state.orderIds])

  const updateDepth=(id:string,delta:number)=>setState((current)=>({...current,depthById:{...current.depthById,[id]:Math.max(0,Math.min(8,(current.depthById[id]??0)+delta))}}))
  const move=(id:string,delta:number)=>setState((current)=>{const order=current.orderIds.filter((item)=>item!==id); const old=current.orderIds.indexOf(id); const target=Math.max(0,Math.min(order.length,old+delta)); order.splice(target,0,id); return {...current,orderIds:order}})
  const toggleCollapse=(id:string)=>setState((current)=>({...current,collapsedIds:current.collapsedIds.includes(id)?current.collapsedIds.filter((item)=>item!==id):[...current.collapsedIds,id]}))
  const reorder=(from:string,to:string)=>{if(from===to)return;setState((current)=>{const order=current.orderIds.filter((id)=>id!==from);const index=Math.max(0,order.indexOf(to));order.splice(index,0,from);return {...current,orderIds:order}})}
  const onKey=(event:KeyboardEvent<HTMLButtonElement>,row:Row)=>{
    if(event.key==='Tab'){event.preventDefault();updateDepth(row.node.id,event.shiftKey?-1:1)}
    else if(event.altKey&&event.key==='ArrowUp'){event.preventDefault();move(row.node.id,-1)}
    else if(event.altKey&&event.key==='ArrowDown'){event.preventDefault();move(row.node.id,1)}
    else if(event.key==='ArrowLeft'&&row.hasChildren&&!state.collapsedIds.includes(row.node.id)){event.preventDefault();toggleCollapse(row.node.id)}
    else if(event.key==='ArrowRight'&&row.hasChildren&&state.collapsedIds.includes(row.node.id)){event.preventDefault();toggleCollapse(row.node.id)}
  }

  return <section className="lcos-dedicated-surface lcos-outline-surface" data-testid="surface-outline">
    <header className="lcos-surface-heading"><div><strong>整理</strong><span>大纲</span></div><small>{rows.length} objects · Tab 层级</small></header>
    <div className="lcos-outline-sheet" role="tree">
      {rows.map((row,index)=>{const Icon=nodeTypeIcon(row.node);const selected=props.selectedIds.includes(row.node.id);return <div key={row.node.id} className={`lcos-outline-row ${selected?'selected':''} ${dragId===row.node.id?'dragging':''}`} style={{'--outline-depth':row.depth,'--i':index} as CSSProperties} role="treeitem" aria-level={row.depth+1} draggable onDragStart={(event:DragEvent<HTMLDivElement>)=>{setDragId(row.node.id);event.dataTransfer.setData('text/plain',row.node.id);event.dataTransfer.effectAllowed='move'}} onDragEnd={()=>setDragId(null)} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{event.preventDefault();reorder(event.dataTransfer.getData('text/plain'),row.node.id);setDragId(null)}}>
        <span className="lcos-outline-guides" aria-hidden="true">{Array.from({length:row.depth},(_,level)=><i key={level} className={level===row.depth-1?'current':''} style={{left:`${level*22+6}px`}}/>)}</span><span className="lcos-outline-grip" aria-hidden="true"><GripVertical size={11}/></span>
        <button className="lcos-outline-fold" type="button" disabled={!row.hasChildren} aria-label={state.collapsedIds.includes(row.node.id)?'展开':'折叠'} onClick={()=>toggleCollapse(row.node.id)}>{row.hasChildren?(state.collapsedIds.includes(row.node.id)?<ChevronRight size={12}/>:<ChevronDown size={12}/>):null}</button>
        <button type="button" className="lcos-outline-main" onKeyDown={(event)=>onKey(event,row)} onClick={(event)=>props.onSelect(row.node.id,event.shiftKey||event.metaKey||event.ctrlKey)} onDoubleClick={()=>props.onDoubleClick(row.node.id)}><Icon/><strong>{row.node.title}</strong><small>{row.node.revisionLabel||row.node.subtitle}</small></button>
        {(row.node.current||row.node.draft)&&<span className={`lcos-outline-status ${row.node.draft?'draft':'current'}`}>{row.node.draft?'Draft':'Current'}</span>}
      </div>})}
    </div>
  </section>
}

function buildInitialRows(nodes:CanvasNode[],edges:CanvasEdge[]):Row[]{
  const incoming=incomingMap(edges),byId=new Map(nodes.map((node)=>[node.id,node])),children=new Map<string,string[]>()
  for(const edge of edges)children.set(edge.from,[...(children.get(edge.from)??[]),edge.to])
  const result:Row[]=[],seen=new Set<string>()
  const walk=(node:CanvasNode,depth:number)=>{if(seen.has(node.id))return;seen.add(node.id);const ids=children.get(node.id)??[];result.push({node,depth,hasChildren:ids.length>0});ids.forEach((id)=>{const child=byId.get(id);if(child)walk(child,depth+1)})}
  orderedNodes(nodes).filter((node)=>!(incoming.get(node.id)?.length)).forEach((root)=>walk(root,0))
  orderedNodes(nodes).filter((node)=>!seen.has(node.id)).forEach((node)=>walk(node,0))
  return result
}
