import { ArrowRight, GripVertical, Network } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { AttentionBucketV0 } from '@local-creative-os/contracts'
import type { CanvasEdge, CanvasNode } from '../../model'
import { SpatialCanvas } from '../spatial/SpatialCanvas'
import { SpatialEdgeLayer } from '../spatial/SpatialEdgeLayer'
import { SpatialNodeLayer } from '../spatial/SpatialNodeLayer'
import { fitSpatialBounds, spatialBoundsForPlacements } from '../spatial/spatialCamera'
import { useSpatialSessionCamera } from '../../state/spatialSessionState'
import { useSpatialFocusRequest, type SpatialFocusRequest } from '../spatial/useSpatialFocusRequest'
import { beginSemanticDrop } from '../spatial/semanticDrop'
import { DropFeedbackLayer } from '../drop/dropFeedbackLayer'
import { useSemanticDropFeedback } from '../drop/useSemanticDropFeedback'
import { advanceSpatialNodeDrag, beginSpatialNodeDrag, endSpatialPointer } from '../spatial/spatialInteractionMachine'
import { IDLE_SPATIAL_POINTER, type SpatialPointerSession } from '../spatial/spatialTypes'
import { usePresentationDraftPositions } from '../../state/presentationDraftState'
import { SurfaceObject } from './SurfaceObject'
import { WorkflowGlyph } from '../design/LcosGlyphs'

export interface WorkflowViewSummary {
  id: string
  title: string
  containerViewId?: string
  memberViewIds: readonly string[]
  memberEntityNodeIds?: readonly string[]
}

interface Props {
  projectId: string
  scopeId: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  selectedIds: string[]
  attentionBucketsByViewId?: Readonly<Record<string, AttentionBucketV0>>
  workflowViews?: readonly WorkflowViewSummary[]
  onOpenWorkflowView?: (workflowId: string) => void
  onSelect: (id: string, additive?: boolean) => void
  onMarqueeSelect?: (ids: string[], additive: boolean) => void
  onDoubleClick: (id: string) => void
  onDirectProjectViewDrop?: (targetViewId: string, sourceIds: readonly string[]) => void
  focusRequest?: SpatialFocusRequest
  runOverlay?: { activeNodeIds:string[]; completedNodeIds:string[]; failedNodeIds:string[] }
}

interface Placement { id:string; node?:CanvasNode; workflow?:WorkflowViewSummary; x:number; y:number; width:number; height:number }

function additive(event: { shiftKey:boolean; ctrlKey:boolean; metaKey:boolean }) {
  return event.shiftKey || event.ctrlKey || event.metaKey
}

/**
 * Workflow level 1: project action network.
 *
 * This is an overview Presentation: click selects, double-click opens, and drag
 * only adjusts this graph's Presentation positions. Editing Workflow relations
 * belongs to the level-2 Workflow Canvas.
 */
export function WorkflowGraphSurface(props: Props) {
  const [camera,setCamera]=useSpatialSessionCamera(props.projectId,props.scopeId,'workflow-graph',{x:0,y:0,zoom:1})
  const [draftPositions,setDraftPositions]=usePresentationDraftPositions(props.projectId,props.scopeId,'workflow-graph')
  const canvasRef=useRef<HTMLDivElement|null>(null)
  const drag=useRef<SpatialPointerSession>(IDLE_SPATIAL_POINTER)
  const checked=useRef(false)
  const [draggingId,setDraggingId]=useState<string|null>(null)
  const workflows=props.workflowViews??[]
  const nodeById=useMemo(()=>new Map(props.nodes.map((node)=>[node.id,node])),[props.nodes])
  const workflowEntityNodeIds=useMemo(()=>new Set(workflows.flatMap((view)=>[view.containerViewId,`scope:${view.id}`].filter((id):id is string=>Boolean(id)))),[workflows])
  const sourceIds=useMemo(()=>[...new Set(workflows.flatMap((view)=>[...view.memberViewIds,...(view.memberEntityNodeIds??[])]))].filter((id)=>!workflowEntityNodeIds.has(id)), [workflowEntityNodeIds,workflows])
  const sourceNodes=useMemo(()=>sourceIds.map((id)=>nodeById.get(id)).filter((node):node is CanvasNode=>Boolean(node)),[nodeById,sourceIds])

  // Stable, readable seed lanes; user drag overrides are persisted separately.
  const sourcePlacements=useMemo<Placement[]>(()=>sourceNodes.map((node,index)=>{
    const fallback={x:110+(index%3)*220,y:130+Math.floor(index/3)*132}
    const manual=draftPositions[node.id]??fallback
    return {id:node.id,node,x:manual.x,y:manual.y,width:164,height:58}
  }),[draftPositions,sourceNodes])
  const workflowPlacements=useMemo<Placement[]>(()=>workflows.map((workflow,index)=>{
    const id=`scope:${workflow.id}`
    const fallback={x:840+(index%2)*340,y:145+Math.floor(index/2)*216}
    const manual=draftPositions[id]??fallback
    return {id,workflow,x:manual.x,y:manual.y,width:224,height:84}
  }),[draftPositions,workflows])
  const allPlacements=useMemo(()=>[...sourcePlacements,...workflowPlacements],[sourcePlacements,workflowPlacements])
  const placementByNodeId=useMemo(()=>new Map(sourcePlacements.map((item)=>[item.id,item])),[sourcePlacements])
  const placementByEndpoint=useMemo(()=>{
    const map=new Map(placementByNodeId)
    workflowPlacements.forEach((item)=>{
      const workflow=item.workflow!
      map.set(`scope:${workflow.id}`,item)
      if(workflow.containerViewId)map.set(workflow.containerViewId,item)
    })
    return map
  },[placementByNodeId,workflowPlacements])
  const membershipEdges=useMemo(()=>workflows.flatMap((workflow)=>[...workflow.memberViewIds,...(workflow.memberEntityNodeIds??[])].flatMap((id)=>{
    const from=placementByEndpoint.get(id)
    const to=placementByEndpoint.get(`scope:${workflow.id}`)
    return from&&to&&from!==to?[{id:`member:${workflow.id}:${id}`,from,to}]:[]
  })),[placementByEndpoint,workflows])
  const domainEdges=useMemo(()=>props.edges.flatMap((edge)=>{
    const from=placementByEndpoint.get(edge.from),to=placementByEndpoint.get(edge.to)
    return from&&to&&from!==to?[{edge,from,to}]:[]
  }),[placementByEndpoint,props.edges])
  const bounds=useMemo(()=>spatialBoundsForPlacements(allPlacements,70),[allPlacements])
  const worldWidth=Math.max(1280,bounds.x+bounds.width+100),worldHeight=Math.max(760,bounds.y+bounds.height+100)
  const spatialItems=useMemo(()=>allPlacements.map((item)=>({id:item.id,x:item.x,y:item.y,width:item.width,height:item.height})),[allPlacements])

  useEffect(()=>{
    if(checked.current||!allPlacements.length)return
    const frame=requestAnimationFrame(()=>{const root=canvasRef.current;if(!root)return;checked.current=true;setCamera(fitSpatialBounds(bounds,root.clientWidth||1,root.clientHeight||1,90))})
    return()=>cancelAnimationFrame(frame)
  },[allPlacements.length,bounds,setCamera])

  useSpatialFocusRequest({request:props.focusRequest,items:spatialItems,testId:'workflow-graph-spatial',setCamera})
  const workflowRunStatus=(workflow:WorkflowViewSummary):'active'|'failed'|'completed'|'idle'=>{
    const ids=[...workflow.memberViewIds,...(workflow.memberEntityNodeIds??[])]
    if(props.runOverlay?.failedNodeIds.some((id)=>ids.includes(id)))return 'failed'
    if(props.runOverlay?.activeNodeIds.some((id)=>ids.includes(id)))return 'active'
    if(props.runOverlay?.completedNodeIds.some((id)=>ids.includes(id)))return 'completed'
    return 'idle'
  }
  const beginDrag=(event:ReactPointerEvent<HTMLElement>,id:string)=>{
    if(event.button!==0)return
    const item=allPlacements.find((placement)=>placement.id===id)
    if(!item)return
    event.stopPropagation()
    drag.current=beginSpatialNodeDrag(event.pointerId,id,{x:event.clientX,y:event.clientY},{x:item.x,y:item.y},camera.zoom)
    setDraggingId(id)
    try{event.currentTarget.setPointerCapture(event.pointerId)}catch{/* browser owns capture */}
  }
  const moveDrag=(event:ReactPointerEvent<HTMLElement>)=>{
    const session=drag.current
    if(session.kind!=='node-drag')return
    const next=advanceSpatialNodeDrag(session,{x:event.clientX,y:event.clientY})
    if(next)setDraftPositions((current)=>({...current,[session.id]:next}))
  }
  const endDrag=(event?:ReactPointerEvent<HTMLElement>)=>{
    const session=drag.current
    if(event?.defaultPrevented&&session.kind==='node-drag')setDraftPositions((current)=>({...current,[session.id]:session.origin}))
    drag.current=endSpatialPointer();setDraggingId(null)
  }

  const empty=!workflows.length?<div className="lcos-workflow-graph-empty"><Network size={22}/><strong>还没有 Workflow</strong><span>把项目对象直接拖到下方「工作流」，一次 Drop 就会生成一个 Workflow。</span></div>:undefined
  const dropFeedback = useSemanticDropFeedback()

  return <>
  <section className="lcos-dedicated-surface lcos-workflow-graph-surface" data-testid="surface-workflow-graph">
    <header className="lcos-surface-heading"><div><strong>工作流</strong><span>Workflow Graph</span></div><small>{workflows.length} 个 Workflow · {sourceNodes.length} 个参与对象 · 单击选中 / 双击进入</small></header>
    <SpatialCanvas ref={canvasRef} camera={camera} setCamera={setCamera} marqueeItems={spatialItems} minimapItems={spatialItems} minimapLabel="Workflow Graph" onMarqueeSelect={props.onMarqueeSelect} className="lcos-workflow-graph-stage lcos-presentation-spatial" worldClassName="lcos-presentation-world lcos-workflow-graph-world" worldStyle={{width:worldWidth,height:worldHeight}} testId="workflow-graph-spatial" overlays={empty}>
      <SpatialEdgeLayer bounds={{x:0,y:0,width:worldWidth,height:worldHeight}} className="lcos-workflow-graph-edges" ariaLabel="Workflow Graph 关系">
        <defs><marker id="lcos-workflow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8 z"/></marker></defs>
        {membershipEdges.map(({id,from,to})=>{const sx=from.x+from.width,sy=from.y+from.height/2,tx=to.x,ty=to.y+to.height/2,mx=(sx+tx)/2;return <g key={id} className="membership"><path markerEnd="url(#lcos-workflow-arrow)" d={`M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`}/><text x={mx} y={(sy+ty)/2-5} textAnchor="middle">参与</text></g>})}
        {domainEdges.map(({edge,from,to})=>{const sx=from.x+from.width,sy=from.y+from.height/2,tx=to.x,ty=to.y+to.height/2,mx=(sx+tx)/2;return <g key={edge.id} className={`domain kind-${edge.kind}`}><path markerEnd="url(#lcos-workflow-arrow)" d={`M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`}/>{edge.label&&<text x={mx} y={(sy+ty)/2-5} textAnchor="middle">{edge.label}</text>}</g>})}
      </SpatialEdgeLayer>
      <SpatialNodeLayer>
        {sourcePlacements.map((placement)=><div key={placement.id} className={`lcos-workflow-graph-source lcos-spatial-placement ${props.selectedIds.includes(placement.id)?'is-selected':''} ${props.attentionBucketsByViewId?.[placement.id] ? `attention-${props.attentionBucketsByViewId[placement.id]}` : ''}`} data-attention-bucket={props.attentionBucketsByViewId?.[placement.id]} style={{left:placement.x,top:placement.y,width:placement.width,minHeight:placement.height} as CSSProperties} onPointerDown={(event)=>beginDrag(event,placement.id)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}><SurfaceObject node={placement.node!} usageHint="Workflow 输入" selected={props.selectedIds.includes(placement.id)} dropIds={props.selectedIds.includes(placement.id)&&props.selectedIds.length?props.selectedIds:[placement.id]} onDirectProjectViewDrop={props.onDirectProjectViewDrop} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/></div>)}
        {workflowPlacements.map((placement,index)=>{
          const id=`scope:${placement.workflow!.id}`
          const runStatus=workflowRunStatus(placement.workflow!)
          const memberCount=placement.workflow!.memberViewIds.length+(placement.workflow!.memberEntityNodeIds?.length??0)
          return <button key={placement.id} type="button" className={`lcos-workflow-graph-workflow ${props.selectedIds.includes(id)?'is-selected':''} ${draggingId===id?'is-dragging':''} run-${runStatus} ${props.attentionBucketsByViewId?.[id] ? `attention-${props.attentionBucketsByViewId[id]}` : ''}`} data-attention-bucket={props.attentionBucketsByViewId?.[id]} style={{left:placement.x,top:placement.y,width:placement.width,minHeight:placement.height,'--i':index} as CSSProperties}
            onPointerDown={(event)=>{if(beginSemanticDrop(event,[id],props.onDirectProjectViewDrop,dropFeedback.onPhase))return;beginDrag(event,id)}} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
            onClick={(event)=>props.onSelect(id,additive(event))} onDoubleClick={(event)=>{event.stopPropagation();props.onOpenWorkflowView?.(placement.workflow!.id)}} data-workflow-view={placement.workflow!.id} data-project-view-drop-target={id} data-project-view-drop-kind="workflow" data-project-view-drop-label={placement.workflow!.title}>
            <span className="lcos-semantic-drop-handle" data-semantic-drop-handle aria-hidden="true" onClick={(event)=>event.stopPropagation()} title="Semantic Drop：拖到其它上下文或工作流（右键拖 / Alt+左拖）"><GripVertical size={11}/></span>
            <span className="lcos-workflow-graph-signal"><WorkflowGlyph/><i className="lcos-workflow-status-dot" data-status={runStatus} aria-label={`状态 ${runStatus}`}/></span>
            <span className="lcos-workflow-graph-copy"><small>WORKFLOW · {memberCount} 项</small><strong>{placement.workflow!.title}</strong><em>{runStatus==='active'?'执行中':runStatus==='failed'?'有异常':runStatus==='completed'?'已完成':'双击进入执行路径'}</em></span>
            <ArrowRight className="lcos-workflow-graph-enter" size={14}/>
          </button>
        })}
      </SpatialNodeLayer>
    </SpatialCanvas>
  </section>
    <DropFeedbackLayer phase={dropFeedback.phase} hitElement={dropFeedback.hitElement} />
  </>
}
