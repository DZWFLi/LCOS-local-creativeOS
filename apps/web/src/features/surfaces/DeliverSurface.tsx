import { Check, CheckCircle2, GitCompareArrows, PackageCheck, RotateCcw, XCircle } from 'lucide-react'
import { useMemo } from 'react'
import type { CanvasEdge, CanvasNode } from '../../model'
import { useProjectionLayoutState } from '../../state/projectionLayoutState'
import type { DeliverSurfaceRuntime } from './surfaceContracts'
import { SurfaceObject } from './SurfaceObject'
import { orderedNodes } from './surfaceModel'

interface Props { projectId:string; scopeId:string; nodes:CanvasNode[]; edges:CanvasEdge[]; selectedIds:string[]; runtime?:DeliverSurfaceRuntime; onSelect:(id:string, additive?:boolean)=>void; onDoubleClick:(id:string)=>void; variant?:'all'|'versions'|'pack' }

export function DeliverSurface(props:Props){
  const variant=props.variant??'all'
  const {revisions,packageNodes}=useMemo(()=>{const revisions=orderedNodes(props.nodes).filter((node)=>Boolean(node.managed||node.current||node.draft||node.historical||node.revisionId));const ids=new Set(revisions.map((node)=>node.id));return{revisions,packageNodes:orderedNodes(props.nodes).filter((node)=>!ids.has(node.id)&&node.kind!=='process')}},[props.nodes])
  const [state,setState]=useProjectionLayoutState(props.projectId,props.scopeId,'deliver',{selectedRevisionIds:[]})
  const selectedRevisions=state.selectedRevisionIds.map((id)=>revisions.find((node)=>node.id===id)).filter((node):node is CanvasNode=>Boolean(node))
  const toggleRevision=(id:string)=>setState((current)=>{const exists=current.selectedRevisionIds.includes(id);return{...current,selectedRevisionIds:exists?current.selectedRevisionIds.filter((item)=>item!==id):[...current.selectedRevisionIds.slice(-1),id]}})
  const compareReady=selectedRevisions.length===2,reviewReady=Boolean(props.runtime?.activeRun?.status==='review'||props.runtime?.pendingReviewCount)
  return <section className="lcos-dedicated-surface lcos-deliver-surface" data-testid="surface-deliver">
    <header className="lcos-surface-heading"><div><strong>交付</strong><span>版本与结果</span></div><small>{revisions.length} 个版本 · {packageNodes.length} 个交付内容</small></header>
    {variant!=='pack'&&<div className="lcos-deliver-commandbar"><span>选择两个版本即可比较</span>{compareReady&&<button type="button" onClick={()=>props.runtime?.onCompareNodes(selectedRevisions[0]!,selectedRevisions[1]!)}><GitCompareArrows size={12}/>比较</button>}{reviewReady&&<button type="button" className="primary" onClick={props.runtime?.onReview}><CheckCircle2 size={12}/>查看待确认结果</button>}</div>}
    {variant!=='pack'&&<div className="lcos-revision-stage"><div className="lcos-revision-label">版本时间线</div><div className="lcos-revision-line"/><div className="lcos-revision-items">{revisions.length?revisions.map((node,index)=>{const selected=state.selectedRevisionIds.includes(node.id);return <div className={`lcos-revision-item ${node.current?'current':''} ${node.draft?'draft':''} ${selected?'compare-selected':''}`} key={node.id}><button type="button" className="lcos-revision-dot" aria-label={`选择版本 ${node.revisionLabel??index+1}`} onClick={()=>toggleRevision(node.id)}>{node.current?<Check size={10}/>:index+1}</button><SurfaceObject node={node} compact selected={props.selectedIds.includes(node.id)} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/><div className="lcos-revision-actions"><button type="button" onClick={()=>props.runtime?.onOpenRevisions(node)}>版本</button><button type="button" onClick={()=>toggleRevision(node.id)}>{selected?'取消比较':'比较'}</button></div></div>}):<span className="lcos-empty-slot">当前现场还没有可管理的版本。</span>}</div></div>}
    {variant!=='pack'&&selectedRevisions.length>0&&<div className="lcos-inline-compare" aria-label="版本比较"><GitCompareArrows size={13}/>{selectedRevisions.map((node)=><article key={node.id}><small>{node.current?'当前':node.draft?'草稿':'版本'}</small><strong>{node.title}</strong><span>{node.revisionLabel||node.revisionId||'—'}</span><p>{node.sourcePrompt||node.subtitle||'暂无来源说明。'}</p></article>)}</div>}
    {variant!=='versions'&&<div className="lcos-delivery-package"><header><PackageCheck size={15}/><div><strong>交付包</strong><small>稳定结果，不带临时过程</small></div></header><div>{packageNodes.slice(0,8).map((node)=><SurfaceObject key={node.id} node={node} compact selected={props.selectedIds.includes(node.id)} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/>)}</div></div>}
    {props.runtime?.activeRun&&<div className="lcos-deliver-reviewbar"><div><strong>{props.runtime.activeRun.status==='review'?'结果待确认':'最近执行'}</strong><span>{props.runtime.activeRun.resultSummary||props.runtime.activeRun.command}</span></div>{props.runtime.activeRun.status==='review'&&<><button type="button" className="accept" onClick={props.runtime.onAccept}><CheckCircle2 size={12}/>接受</button><button type="button" onClick={props.runtime.onReject}><XCircle size={12}/>放弃</button></>}{props.runtime.runActions.includes('retry')===true&&<button type="button" onClick={props.runtime.onRetry}><RotateCcw size={12}/>再试</button>}</div>}
  </section>
}
