import { AlertTriangle, CircleAlert, Clock3, History, Play, RefreshCw, RotateCcw, Square } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ExecutionItemAction } from '@local-creative-os/contracts'
import type { CanvasEdge, CanvasNode } from '../../model'
import { runStatusLabel } from '../../model'
import { SurfaceObject } from './SurfaceObject'
import type { WorkSurfaceRuntime } from './surfaceContracts'
import { incomingMap, nodeRole, orderedNodes, outgoingMap } from './surfaceModel'
import { additiveSelectionModifier } from '../spatial/pointerInteractionLanguage'

interface Props { projectId:string; scopeId:string; nodes:CanvasNode[]; edges:CanvasEdge[]; selectedIds:string[]; runtime?:WorkSurfaceRuntime; onSelect:(id:string, additive?:boolean)=>void; onDoubleClick:(id:string)=>void }

function runEventLabel(type:string):string{
  const normalized=type.replace(/^run[._-]?/,'').replace(/[._-]+/g,' ')
  const labels:Record<string,string>={started:'开始执行',queued:'等待执行',running:'正在执行',completed:'执行完成',failed:'执行失败',cancelled:'已取消',waiting_input:'等待输入',review:'等待确认'}
  return labels[normalized]??'状态更新'
}

export function WorkSurface(props:Props){
  const [inputText,setInputText]=useState('')
  const byId=useMemo(()=>new Map(props.nodes.map((node)=>[node.id,node])),[props.nodes])
  const fallbackGroups=useMemo(()=>{
    const incoming=incomingMap(props.edges),outgoing=outgoingMap(props.edges)
    return orderedNodes(props.nodes).filter((node)=>nodeRole(node)==='run').map((run)=>({
      run,
      context:(incoming.get(run.id)??[]).map((edge)=>byId.get(edge.from)).filter((node):node is CanvasNode=>Boolean(node)),
      output:(outgoing.get(run.id)??[]).map((edge)=>byId.get(edge.to)).filter((node):node is CanvasNode=>Boolean(node)),
    }))
  },[byId,props.edges,props.nodes])
  const runtime=props.runtime,active=runtime?.activeRun??null
  const canRunAction=(action:ExecutionItemAction)=>runtime?.runActions.includes(action)===true
  const activeRunNode=active?props.nodes.find((node)=>node.id===active.processNodeId)??fallbackGroups.find((group)=>group.run.sourceRunId===active.id)?.run??null:null
  const contextNodes=active?active.contextIds.map((id)=>byId.get(id)).filter((node):node is CanvasNode=>Boolean(node)):[]
  const targetNodes=active?active.targetIds.map((id)=>byId.get(id)).filter((node):node is CanvasNode=>Boolean(node)):[]
  const outputNodes=active?.pendingArtifactId?[byId.get(active.pendingArtifactId)].filter((node):node is CanvasNode=>Boolean(node)):[]
  const showActive=Boolean(active&&activeRunNode)
  return <section className="lcos-dedicated-surface lcos-work-surface" data-testid="surface-work">
    <header className="lcos-surface-heading"><div><strong>执行</strong><span>当前工作</span></div><small>{active?`${runStatusLabel[active.status]} · ${active.provider||activeRunNode?.sourceProvider||'Agent'}`:`${fallbackGroups.length} 次处理`}</small></header>
    <div className="lcos-work-column-labels"><span>参考</span><span>执行</span><span>目标 / 结果</span></div><div className="lcos-work-lanes" aria-hidden="true"><i/><i/><i/></div>
    {showActive&&active&&activeRunNode?<div className="lcos-active-run-stage">
      <div className="lcos-run-context-list">{contextNodes.length?contextNodes.map((node)=><SurfaceObject key={node.id} node={node} compact selected={props.selectedIds.includes(node.id)} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/>):<span className="lcos-empty-slot">本次参考已固定 · {active.contextIds.length} 项</span>}</div>
      <div className="lcos-run-center-stack">
        <button type="button" className={`lcos-run-actor status-${active.status} ${props.selectedIds.includes(activeRunNode.id)?'selected':''}`} onClick={(event)=>props.onSelect(activeRunNode.id,additiveSelectionModifier(event))} onDoubleClick={()=>runtime?.onOpenRunDetails(activeRunNode)}><span className="lcos-run-actor-icon"><Play size={15} fill="currentColor"/></span><div><small>{active.provider||activeRunNode.sourceProvider||'Agent 执行'}</small><strong>{activeRunNode.title}</strong><p>{active.command||activeRunNode.commandText||activeRunNode.subtitle}</p></div><span className="lcos-run-actor-status">{runStatusLabel[active.status]}</span>{active.status==='waiting_input'&&<CircleAlert size={14} className="lcos-run-alert"/>}{active.status==='failed'&&<AlertTriangle size={14} className="lcos-run-alert"/>}</button>
        <div className="lcos-run-actions">{canRunAction('cancel')&&<button type="button" onClick={runtime?.onCancel}><Square size={11}/>取消</button>}{canRunAction('retry')&&<button type="button" onClick={runtime?.onRetry}><RotateCcw size={11}/>再试</button>}{(active.status==='review'||(runtime?.pendingReviewCount??0)>0)&&<button type="button" className="primary" onClick={runtime?.onReview}><RefreshCw size={11}/>查看待确认结果</button>}</div>
        {active.inputRequest&&<div className="lcos-waiting-input"><CircleAlert size={12}/><div><strong>等待输入</strong><span>{active.inputRequest.question}</span>{canRunAction('answer_input')&&active.inputRequest.options.length>0&&<div className="lcos-waiting-options">{active.inputRequest.options.map((option)=><button key={option} type="button" onClick={()=>runtime?.onAnswerInput({requestId:active.inputRequest!.requestId,selectedOptions:[option]})}>{option}</button>)}</div>}{canRunAction('answer_input')&&active.inputRequest.allowFreeText&&<form className="lcos-waiting-form" onSubmit={(event)=>{event.preventDefault();const value=inputText.trim();if(!value)return;runtime?.onAnswerInput({requestId:active.inputRequest!.requestId,text:value});setInputText('')}}><input value={inputText} onChange={(event)=>setInputText(event.target.value)} placeholder="补充说明…"/><button type="submit">继续</button></form>}</div></div>}
        {active.resultSummary&&<div className="lcos-run-result-summary"><History size={11}/><span>{active.resultSummary}</span></div>}
      </div>
      <div className="lcos-run-output-list">{targetNodes.map((node)=><SurfaceObject key={`target-${node.id}`} node={node} compact selected={props.selectedIds.includes(node.id)} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/>)}{outputNodes.map((node)=><SurfaceObject key={`output-${node.id}`} node={node} selected={props.selectedIds.includes(node.id)} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/>)}{!targetNodes.length&&!outputNodes.length&&<span className="lcos-empty-slot">等待结果</span>}</div>
      {(runtime?.runEvents.length??0)>0&&<div className="lcos-run-event-strip" aria-label="执行时间线">{runtime!.runEvents.slice(-7).map((event)=><div key={String(event.id)} title={new Date(event.occurredAt).toLocaleString()}><i className={String(event.type).replace(/\./g,'-')}/><span>{runEventLabel(String(event.type))}</span><Clock3 size={9}/></div>)}</div>}
    </div>:<div className="lcos-run-groups">{fallbackGroups.length?fallbackGroups.map(({run,context,output})=><div className="lcos-run-group" key={run.id}><div className="lcos-run-context-list">{context.length?context.map((node)=><SurfaceObject key={node.id} node={node} compact selected={props.selectedIds.includes(node.id)} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/>):<span className="lcos-empty-slot">没有额外参考材料</span>}</div><button className={`lcos-run-actor status-${run.runStatus??'idle'} ${props.selectedIds.includes(run.id)?'selected':''}`} onClick={(event)=>props.onSelect(run.id,additiveSelectionModifier(event))} onDoubleClick={()=>props.onDoubleClick(run.id)}><span className="lcos-run-actor-icon"><Play size={15} fill="currentColor"/></span><div><small>{run.sourceProvider||'Agent 执行'}</small><strong>{run.title}</strong><p>{run.commandText||run.subtitle}</p></div><span className="lcos-run-actor-status">{run.runStatus?runStatusLabel[run.runStatus]:'执行记录'}</span></button><div className="lcos-run-output-list">{output.length?output.map((node)=><SurfaceObject key={node.id} node={node} compact selected={props.selectedIds.includes(node.id)} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/>):<span className="lcos-empty-slot">等待结果</span>}</div></div>):<div className="lcos-work-empty"><Play size={18}/><strong>还没有执行记录</strong><span>在任意工作现场选中内容后，都可以直接开始。</span></div>}</div>}
  </section>
}
