import { Bot, MessageSquareText, MousePointer2, Route } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { CanvasEdge, CanvasNode } from '../../model'
import type { ContextSurfaceRuntime } from './surfaceContracts'
import { SurfaceObject } from './SurfaceObject'
import { layoutContextTrail } from './surfaceLayouts'

interface Props { projectId:string; scopeId:string; nodes:CanvasNode[]; edges:CanvasEdge[]; selectedIds:string[]; source:{kind:string;label:string}; runtime?:ContextSurfaceRuntime; onSelect:(id:string, additive?:boolean)=>void; onDoubleClick:(id:string)=>void; onStart?:(kind:'conversation'|'selection'|'agent')=>void }
type Point={x:number;y:number}

/** Context Strand: sources live on the canvas and can coexist, move and unfold. */
export function ContextFlowSurface(props:Props){
  const layout=useMemo(()=>layoutContextTrail(props.nodes,props.edges),[props.edges,props.nodes])
  const sources=useMemo(()=>props.runtime?.history.length?props.runtime.history.map((entry,index)=>({id:entry.id,label:entry.title||entry.label,summary:entry.summary||`${entry.objectIds.length} 个关联对象`,objectIds:entry.objectIds,x:7,y:17+index*24})):props.source.kind!=='empty'?[{id:`temporary:${props.source.kind}`,label:props.source.label,summary:'Temporary Context Presentation',objectIds:props.nodes.map((node)=>node.id),x:7,y:24}]:[],[props.nodes,props.runtime?.history,props.source.kind,props.source.label])
  const [offsets,setOffsets]=useState<Record<string,Point>>({})
  const drag=useRef<{id:string;startX:number;startY:number;origin:Point}|null>(null)
  const beginDrag=(event:ReactPointerEvent,id:string)=>{const origin=offsets[id]??{x:0,y:0};drag.current={id,startX:event.clientX,startY:event.clientY,origin};event.currentTarget.setPointerCapture(event.pointerId)}
  const moveDrag=(event:ReactPointerEvent)=>{const current=drag.current;if(!current)return;setOffsets((value)=>({...value,[current.id]:{x:current.origin.x+event.clientX-current.startX,y:current.origin.y+event.clientY-current.startY}}))}
  const endDrag=()=>{drag.current=null}
  const itemById=new Map(layout.items.map((item)=>[item.node.id,item]))
  return <section className="lcos-dedicated-surface lcos-context-free" data-testid="surface-context-flow">
    <header className="lcos-surface-heading"><div><strong>上下文</strong><span>多来源轨迹</span></div><small>来源和链条属于当前 Presentation · 不改变项目原始结构</small></header>
    <div className="lcos-context-free-stage">
      <svg className="lcos-context-free-edges" aria-hidden="true">{layout.edges.map(({edge,x1,y1,x2,y2})=><line key={edge.id} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} className={edge.active?'active':''}/>)}</svg>
      <svg className="lcos-context-source-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{sources.flatMap((source)=>source.objectIds.slice(0,5).flatMap((id)=>{const item=itemById.get(id);if(!item)return[];const offset=offsets[source.id]??{x:0,y:0},sx=source.x+offset.x/12+15,sy=source.y+offset.y/7.6+3;return <path key={`${source.id}:${id}`} d={`M ${sx} ${sy} C 28 ${sy}, ${Math.max(30,item.left-9)} ${item.top+5}, ${item.left} ${item.top+5}`}/> }))}</svg>
      {sources.map((source,index)=>{const offset=offsets[source.id]??{x:0,y:0};const history=props.runtime?.history.find((entry)=>entry.id===source.id);return <div key={source.id} className="lcos-context-source-object" style={{left:`${source.x}%`,top:`${source.y}%`,transform:`translate(${offset.x}px,${offset.y}px)`,'--i':index} as CSSProperties} onPointerDown={(event)=>beginDrag(event,source.id)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onDoubleClick={()=>history&&props.runtime?.onOpenHistorySource(history)}>
        <span className="lcos-context-source-icon"><MessageSquareText size={14}/></span><div><strong>{source.label}</strong><small>{source.summary}</small><p>{history?.createdAt?new Date(history.createdAt).toLocaleString():'当前临时组织'} · {source.objectIds.length} objects</p></div><Route size={12}/>
      </div>})}
      {layout.items.map(({node,left,top,width},index)=><div key={node.id} className="lcos-context-free-node" style={{left:`${Math.max(32,left)}%`,top:`${top}%`,width:`${width}%`,'--i':index} as CSSProperties}><SurfaceObject node={node} compact selected={props.selectedIds.includes(node.id)} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/></div>)}
      {!layout.items.length&&<div className="lcos-context-free-empty"><MessageSquareText size={18}/><strong>选择这次要找回的协作来源</strong><span>上下文不会自动把整个项目拼成历史。可以并列打开多条对话、使用当前 Selection，或让 Agent 临时组织。</span><div className="lcos-context-start-actions"><button type="button" onClick={()=>props.onStart?.('conversation')}><MessageSquareText size={12}/>添加对话</button><button type="button" disabled={!props.selectedIds.length} onClick={()=>props.onStart?.('selection')}><MousePointer2 size={12}/>当前 Selection</button><button type="button" onClick={()=>props.onStart?.('agent')}><Bot size={12}/>让 Agent 组织</button></div></div>}
    </div>
  </section>
}
