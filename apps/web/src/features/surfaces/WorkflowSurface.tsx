import { Bot, Network, Sparkles, Unplug, Wrench } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { CanvasEdge, CanvasNode } from '../../model'
import { SurfaceObject } from './SurfaceObject'
import { layoutWorkflowGraph } from './surfaceLayouts'

interface Props { projectId:string;scopeId:string;nodes:CanvasNode[];edges:CanvasEdge[];selectedIds:string[];onSelect:(id:string,additive?:boolean)=>void;onDoubleClick:(id:string)=>void;onStart?:(kind:'selection'|'skill'|'agent')=>void }
type Offset={x:number;y:number}

/** Project-defined workflow Presentation; never a fixed DAG schema. */
export function WorkflowSurface(props:Props){
  const [hiddenIds,setHiddenIds]=useState<string[]>([])
  const [presentationEdges,setPresentationEdges]=useState<CanvasEdge[]>(props.edges)
  const [selectedEdge,setSelectedEdge]=useState<string|null>(null)
  const [offsets,setOffsets]=useState<Record<string,Offset>>({})
  const stageRef=useRef<HTMLDivElement>(null)
  const drag=useRef<{id:string;x:number;y:number;origin:Offset}|null>(null)
  const visibleNodes=props.nodes.filter((node)=>!hiddenIds.includes(node.id))
  const visibleEdges=presentationEdges.filter((edge)=>!hiddenIds.includes(edge.from)&&!hiddenIds.includes(edge.to))
  const base=useMemo(()=>layoutWorkflowGraph(visibleNodes,visibleEdges),[visibleEdges,visibleNodes])
  const items=base.items.map((item)=>({...item,left:item.left+(offsets[item.node.id]?.x??0),top:item.top+(offsets[item.node.id]?.y??0)}))
  const byId=new Map(items.map((item)=>[item.node.id,item]))
  const edges=visibleEdges.flatMap((edge)=>{const from=byId.get(edge.from),to=byId.get(edge.to);return from&&to?[{edge,x1:from.left+from.width,y1:from.top+5,x2:to.left,y2:to.top+5}]:[]})
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if((event.key==='Delete'||event.key==='Backspace')&&selectedEdge){event.preventDefault();setPresentationEdges((current)=>current.filter((edge)=>edge.id!==selectedEdge));setSelectedEdge(null)}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[selectedEdge])
  const beginDrag=(event:ReactPointerEvent,id:string)=>{drag.current={id,x:event.clientX,y:event.clientY,origin:offsets[id]??{x:0,y:0}};event.currentTarget.setPointerCapture(event.pointerId)}
  const moveDrag=(event:ReactPointerEvent)=>{const current=drag.current,stage=stageRef.current;if(!current||!stage)return;const rect=stage.getBoundingClientRect();setOffsets((value)=>({...value,[current.id]:{x:current.origin.x+(event.clientX-current.x)/rect.width*100,y:current.origin.y+(event.clientY-current.y)/rect.height*100}}))}
  const removeKeepingFlow=(id:string)=>{const incoming=presentationEdges.filter((edge)=>edge.to===id),outgoing=presentationEdges.filter((edge)=>edge.from===id),bridges=incoming.flatMap((from)=>outgoing.map((to,index)=>({id:`presentation:${id}:${from.from}:${to.to}:${index}`,from:from.from,to:to.to,kind:'reference' as const})));setPresentationEdges((current)=>[...current.filter((edge)=>edge.from!==id&&edge.to!==id),...bridges]);setHiddenIds((current)=>[...current,id])}
  return <section className="lcos-dedicated-surface lcos-workflow-surface" data-testid="surface-workflow">
    <header className="lcos-surface-heading lcos-workflow-heading"><div><strong>工作流</strong><span>能力与执行现场</span></div><small>项目自己定义怎么工作 · {visibleNodes.length} 个对象 · {visibleEdges.length} 条 Presentation 关系</small></header>
    <div ref={stageRef} className="lcos-workflow-stage" onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}>
      <div className="lcos-workflow-hint"><Sparkles size={13}/><span>框选、点空白处描述，或从任意对象开始</span><button type="button" onClick={()=>props.onStart?.('agent')}>交给 Agent</button></div>
      <svg className="lcos-workflow-edges" viewBox="0 0 100 100" preserveAspectRatio="none">{edges.map(({edge,x1,y1,x2,y2})=>{const m=x1+(x2-x1)*.5;return <path key={edge.id} d={`M${x1} ${y1} C${m} ${y1},${m} ${y2},${x2} ${y2}`} className={`${edge.active?'active':''} ${selectedEdge===edge.id?'selected':''} ${edge.id.startsWith('presentation:')?'presentation':''}`} onClick={()=>setSelectedEdge(edge.id)}/>})}</svg>
      {items.map(({node,left,top,width},index)=><div key={node.id} className={`lcos-workflow-node ${node.kind==='process'?'is-execution':''}`} style={{left:`${left}%`,top:`${top}%`,width:`${width}%`,'--i':index} as CSSProperties} onPointerDown={(event)=>beginDrag(event,node.id)} onPointerMove={moveDrag}>
        <SurfaceObject node={node} compact={node.kind!=='process'} selected={props.selectedIds.includes(node.id)} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/><button type="button" className="lcos-workflow-bypass" title="从当前 Workflow 移除，但保持上下游连接" aria-label={`保持链条并移除 ${node.title}`} onPointerDown={(event)=>event.stopPropagation()} onClick={()=>removeKeepingFlow(node.id)}><Unplug size={10}/></button>
      </div>)}
      {!items.length&&<div className="lcos-workflow-empty"><Network size={19}/><strong>从项目正在做的事开始</strong><span>工作流不会自动吞入整个项目。选择对象、找到项目 Skill，或让 Agent 按当前 Intent 搭建临时 View。</span><div className="lcos-workflow-start-actions"><button type="button" disabled={!props.selectedIds.length} onClick={()=>props.onStart?.('selection')}><Network size={12}/>从 Selection</button><button type="button" onClick={()=>props.onStart?.('skill')}><Wrench size={12}/>项目 Skill</button><button type="button" onClick={()=>props.onStart?.('agent')}><Bot size={12}/>让 Agent 搭建</button></div></div>}
    </div>
  </section>
}
