import { Bot, LayoutGrid, Network, Sparkles, Unplug, Wrench } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { CanvasEdge, CanvasNode } from '../../model'
import { layoutPreviewSync } from '../layout/layoutService'
import type { LayoutResult } from '../layout/layoutTypes'
import { SpatialCanvas } from '../spatial/SpatialCanvas'
import { SpatialEdgeLayer } from '../spatial/SpatialEdgeLayer'
import { SpatialNodeLayer } from '../spatial/SpatialNodeLayer'
import { spatialBoundsForPlacements } from '../spatial/spatialCamera'
import { advanceSpatialNodeDrag, beginSpatialNodeDrag, endSpatialPointer } from '../spatial/spatialInteractionMachine'
import { IDLE_SPATIAL_POINTER, type SpatialPointerSession } from '../spatial/spatialTypes'
import { usePresentationDraftEdges, usePresentationDraftHiddenIds, usePresentationDraftPinnedIds, usePresentationDraftPositions } from '../../state/presentationDraftState'
import { useSpatialSessionCamera } from '../../state/spatialSessionState'
import { SurfaceObject } from './SurfaceObject'
import { layoutManualSpatial } from './surfaceLayouts'

interface Props { projectId:string;scopeId:string;nodes:CanvasNode[];edges:CanvasEdge[];selectedIds:string[];source?:{kind:string;label:string};onSelect:(id:string,additive?:boolean)=>void;onDoubleClick:(id:string)=>void;onStart?:(kind:'selection'|'skill'|'agent')=>void }

/** Project-defined workflow Presentation; never a fixed DAG schema. */
export function WorkflowSurface(props:Props){
  const [hiddenIds,setHiddenIds]=usePresentationDraftHiddenIds(props.projectId,props.scopeId,'workflow')
  const [presentationEdges,setPresentationEdges]=usePresentationDraftEdges(props.projectId,props.scopeId,'workflow',props.edges)
  const [selectedEdge,setSelectedEdge]=useState<string|null>(null)
  const [camera,setCamera]=useSpatialSessionCamera(props.projectId,props.scopeId,'workflow',{x:0,y:0,zoom:1})
  const [draftPositions,setDraftPositions]=usePresentationDraftPositions(props.projectId,props.scopeId,'workflow')
  const [pinnedIds,setPinnedIds]=usePresentationDraftPinnedIds(props.projectId,props.scopeId,'workflow')
  const [layoutPreview,setLayoutPreview]=useState<LayoutResult|null>(null)
  const drag=useRef<SpatialPointerSession>(IDLE_SPATIAL_POINTER)

  const visibleNodes=useMemo(()=>props.nodes.filter((node)=>!hiddenIds.includes(node.id)),[hiddenIds,props.nodes])
  const visibleEdges=useMemo(()=>presentationEdges.filter((edge)=>!hiddenIds.includes(edge.from)&&!hiddenIds.includes(edge.to)),[hiddenIds,presentationEdges])
  const base=useMemo(()=>layoutManualSpatial(visibleNodes,visibleEdges),[visibleEdges,visibleNodes])
  const items=useMemo(()=>base.items.map((item)=>({...item,...(draftPositions[item.node.id]??{x:item.x,y:item.y})})),[base.items,draftPositions])
  const byId=useMemo(()=>new Map(items.map((item)=>[item.node.id,item])),[items])
  const edges=useMemo(()=>visibleEdges.flatMap((edge)=>{const from=byId.get(edge.from),to=byId.get(edge.to);return from&&to?[{edge,x1:from.x+from.width,y1:from.y+from.height/2,x2:to.x,y2:to.y+to.height/2}]:[]}),[byId,visibleEdges])
  const previewPlacements=useMemo(()=>layoutPreview?.positions.flatMap((position)=>{const item=byId.get(position.id);return item?[{x:position.x,y:position.y,width:item.width,height:item.height}]:[]})??[],[byId,layoutPreview])
  const edgeBounds=spatialBoundsForPlacements([...items,...previewPlacements],180)

  useEffect(()=>{setPresentationEdges((current)=>{const presentation=current.filter((edge)=>edge.id.startsWith('presentation:'));return [...props.edges,...presentation.filter((edge)=>!props.edges.some((item)=>item.id===edge.id))]})},[props.edges,setPresentationEdges])
  useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if((event.key==='Delete'||event.key==='Backspace')&&selectedEdge){event.preventDefault();setPresentationEdges((current)=>current.filter((edge)=>edge.id!==selectedEdge));setSelectedEdge(null)}if(event.key==='Escape'&&layoutPreview)setLayoutPreview(null)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[layoutPreview,selectedEdge,setPresentationEdges])

  const beginDrag=(event:ReactPointerEvent<HTMLDivElement>,id:string)=>{if(event.button!==0||layoutPreview)return;event.stopPropagation();const item=byId.get(id);if(!item)return;drag.current=beginSpatialNodeDrag(event.pointerId,id,{x:event.clientX,y:event.clientY},{x:item.x,y:item.y});event.currentTarget.setPointerCapture(event.pointerId)}
  const moveDrag=(event:ReactPointerEvent<HTMLDivElement>)=>{const session=drag.current;if(session.kind!=='node-drag')return;event.stopPropagation();const next=advanceSpatialNodeDrag(session,{x:event.clientX,y:event.clientY},camera.zoom);if(!next)return;setDraftPositions((current)=>({...current,[session.id]:next}))}
  const endDrag=(event:ReactPointerEvent<HTMLDivElement>)=>{const session=drag.current;if(session.kind!=='node-drag')return;event.stopPropagation();if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);setPinnedIds((current)=>current.includes(session.id)?current:[...current,session.id]);drag.current=endSpatialPointer()}
  const removeKeepingFlow=(id:string)=>{const incoming=presentationEdges.filter((edge)=>edge.to===id),outgoing=presentationEdges.filter((edge)=>edge.from===id),bridges=incoming.flatMap((from)=>outgoing.map((to,index)=>({id:`presentation:${id}:${from.from}:${to.to}:${index}`,from:from.from,to:to.to,kind:'reference' as const})));setPresentationEdges((current)=>[...current.filter((edge)=>edge.from!==id&&edge.to!==id),...bridges]);setHiddenIds((current)=>[...current,id]);setPinnedIds((current)=>current.filter((item)=>item!==id))}

  const previewLayout=()=>{
    if(items.length<2)return
    const pinned=new Set(pinnedIds)
    const result=layoutPreviewSync({
      strategy:'layered',
      nodes:items.map((item)=>({id:item.node.id,x:item.x,y:item.y,width:item.width,height:item.height,pinned:pinned.has(item.node.id)})),
      edges:visibleEdges,
      gap:30,
      componentGap:120,
      origin:{x:Math.min(...items.map((item)=>item.x)),y:Math.min(...items.map((item)=>item.y))},
      preserveManualAnchors:true,
    })
    setLayoutPreview(result)
  }
  const applyLayoutPreview=()=>{
    if(!layoutPreview)return
    setDraftPositions((current)=>({...current,...Object.fromEntries(layoutPreview.positions.map((item)=>[item.id,{x:item.x,y:item.y}]))}))
    setLayoutPreview(null)
  }

  const overlay=<>
    <div className="lcos-workflow-hint"><Sparkles size={13}/><span>框选、点空白处描述，或从任意对象开始</span><button type="button" onClick={()=>props.onStart?.('agent')}>交给 Agent</button></div>
    {layoutPreview&&<div className="lcos-spatial-layout-preview" data-testid="workflow-layout-preview"><span><LayoutGrid size={12}/><strong>布局建议</strong><small>{layoutPreview.componentCount} 个关系簇 · {pinnedIds.length} 个手工锚点</small></span><button type="button" onClick={applyLayoutPreview}>应用</button><button type="button" className="quiet" onClick={()=>setLayoutPreview(null)}>取消</button></div>}
    {!items.length&&<div className="lcos-workflow-empty"><Network size={19}/><strong>从项目正在做的事开始</strong><span>工作流不会自动吞入整个项目。选择对象、找到项目 Skill，或让 Agent 按当前 Intent 搭建临时 View。</span><div className="lcos-workflow-start-actions"><button type="button" disabled={!props.selectedIds.length} onClick={()=>props.onStart?.('selection')}><Network size={12}/>从 Selection</button><button type="button" onClick={()=>props.onStart?.('skill')}><Wrench size={12}/>项目 Skill</button><button type="button" onClick={()=>props.onStart?.('agent')}><Bot size={12}/>让 Agent 搭建</button></div></div>}
  </>

  return <section className="lcos-dedicated-surface lcos-workflow-surface" data-testid="surface-workflow">
    <header className="lcos-surface-heading lcos-workflow-heading"><div><strong>工作流</strong><span>能力与执行现场</span></div><div className="lcos-layout-tools"><small>项目自己定义怎么工作 · {visibleNodes.length} 个对象 · {visibleEdges.length} 条关系</small><button type="button" disabled={items.length<2||Boolean(layoutPreview)} onClick={previewLayout}><LayoutGrid size={11}/>整理</button>{pinnedIds.length>0&&<button type="button" className="quiet" onClick={()=>setPinnedIds([])}>解除 {pinnedIds.length} 个锚点</button>}</div></header>
    <details className={`lcos-capability-source source-${props.source?.kind??'empty'}`}>
      <summary><i/><strong>{props.source?.label??'尚未组织 Workflow Presentation'}</strong><small>Presentation 来源</small></summary>
      <div><span>Workflow Source</span><small>启发式内容只是建议。Selection 只有显式加入后才成为当前工作流成员。</small><nav><button type="button" disabled={!props.selectedIds.length} onClick={()=>props.onStart?.('selection')}><Network size={11}/>Selection</button><button type="button" onClick={()=>props.onStart?.('skill')}><Wrench size={11}/>Skill</button><button type="button" onClick={()=>props.onStart?.('agent')}><Bot size={11}/>Agent</button></nav></div>
    </details>
    <SpatialCanvas camera={camera} setCamera={setCamera} className={`lcos-workflow-stage lcos-presentation-spatial ${layoutPreview?'has-layout-preview':''}`} worldClassName="lcos-presentation-world" testId="workflow-spatial" overlays={overlay} onPointerUp={()=>{drag.current=endSpatialPointer()}} onPointerCancel={()=>{drag.current=endSpatialPointer()}}>
      <SpatialEdgeLayer bounds={edgeBounds} className="lcos-workflow-edges" ariaLabel="工作流关系">
        {edges.map(({edge,x1,y1,x2,y2})=>{const m=x1+(x2-x1)*.5;return <path key={edge.id} d={`M${x1} ${y1} C${m} ${y1},${m} ${y2},${x2} ${y2}`} className={`${edge.active?'active':''} ${selectedEdge===edge.id?'selected':''} ${edge.id.startsWith('presentation:')?'presentation':''}`} onClick={(event)=>{event.stopPropagation();setSelectedEdge(edge.id)}}/>})}
        {layoutPreview?.routes.map((route)=>route.points.length>1?<path key={`preview:${route.id}`} className="layout-preview-edge" d={route.points.map((point,index)=>`${index?'L':'M'}${point.x} ${point.y}`).join(' ')}/>:null)}
      </SpatialEdgeLayer>
      <SpatialNodeLayer>
        {items.map(({node,x,y,width,height},index)=><div key={node.id} className={`lcos-workflow-node lcos-spatial-placement ${node.kind==='process'?'is-execution':''} ${pinnedIds.includes(node.id)?'is-manual-anchor':''}`} style={{left:x,top:y,width,'--i':index} as CSSProperties} onPointerDown={(event)=>beginDrag(event,node.id)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
          <SurfaceObject node={node} compact={node.kind!=='process'} selected={props.selectedIds.includes(node.id)} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/><button type="button" className="lcos-workflow-bypass" title="从当前 Workflow 移除，但保持上下游连接" aria-label={`保持链条并移除 ${node.title}`} onPointerDown={(event)=>event.stopPropagation()} onClick={()=>removeKeepingFlow(node.id)}><Unplug size={10}/></button>
          {pinnedIds.includes(node.id)&&<i className="lcos-manual-anchor-mark" title="手工位置锚点"/>}
        </div>)}
        {layoutPreview?.positions.map((position)=>{const item=byId.get(position.id);return item?<div key={`layout-ghost:${position.id}`} className="lcos-layout-ghost lcos-layout-ghost-workflow" style={{left:position.x,top:position.y,width:item.width,height:item.height}} aria-hidden="true"><span>{item.node.title}</span></div>:null})}
      </SpatialNodeLayer>
    </SpatialCanvas>
  </section>
}
