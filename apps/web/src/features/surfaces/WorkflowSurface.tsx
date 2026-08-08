import { Bot, Network, Sparkles, Wrench } from 'lucide-react'
import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { CanvasEdge, CanvasNode } from '../../model'
import { SurfaceObject } from './SurfaceObject'

interface Props {
  projectId:string
  scopeId:string
  nodes:CanvasNode[]
  edges:CanvasEdge[]
  selectedIds:string[]
  onSelect:(id:string, additive?:boolean)=>void
  onDoubleClick:(id:string)=>void
}

/**
 * A project-defined workflow canvas. LCOS intentionally does not prescribe a
 * workflow schema here: Skill / Agent / file / note / gate objects can coexist,
 * and the user or local Agent decides the meaning of the graph.
 */
export function WorkflowSurface(props:Props){
  const layout=useMemo(()=>{
    if(!props.nodes.length)return{items:[],edges:[]}
    const left=Math.min(...props.nodes.map((node)=>node.x))
    const top=Math.min(...props.nodes.map((node)=>node.y))
    const right=Math.max(...props.nodes.map((node)=>node.x+node.width))
    const bottom=Math.max(...props.nodes.map((node)=>node.y+node.height))
    const spanX=Math.max(1,right-left),spanY=Math.max(1,bottom-top)
    const padX=10,padY=12
    const items=props.nodes.map((node)=>({
      node,
      left:padX+((node.x-left)/spanX)*(100-padX*2),
      top:padY+((node.y-top)/spanY)*(100-padY*2),
      width:Math.max(10,Math.min(38,(node.width/spanX)*100)),
    }))
    const byId=new Map(items.map((item)=>[item.node.id,item]))
    const edges=props.edges.filter((edge)=>byId.has(edge.from)&&byId.has(edge.to)).map((edge)=>{const a=byId.get(edge.from)!,b=byId.get(edge.to)!;return{edge,x1:a.left+(a.width/2),y1:a.top+4,x2:b.left+(b.width/2),y2:b.top+4}})
    return{items,edges}
  },[props.edges,props.nodes])

  return <section className="lcos-dedicated-surface lcos-workflow-surface" data-testid="surface-workflow">
    <header className="lcos-surface-heading lcos-workflow-heading"><div><strong>工作流</strong><span>项目自己定义怎么工作</span></div><small>{props.nodes.length} objects · {props.edges.length} relations</small></header>
    <div className="lcos-workflow-stage">
      <div className="lcos-workflow-hint" aria-hidden="true"><Sparkles size={13}/><span>选中内容后让 Agent 帮你搭 Skill / Agent / Review 关系</span></div>
      <svg className="lcos-workflow-edges" aria-hidden="true">{layout.edges.map(({edge,x1,y1,x2,y2})=><line key={edge.id} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} className={edge.active?'active':''}/>)}</svg>
      {layout.items.map(({node,left,top,width},index)=><div key={node.id} className={`lcos-workflow-node ${node.kind==='process'?'is-execution':''}`} style={{left:`${left}%`,top:`${top}%`,width:`${width}%`,'--i':index} as CSSProperties}>
        <SurfaceObject node={node} compact={node.kind!=='process'} selected={props.selectedIds.includes(node.id)} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/>
      </div>)}
      {!layout.items.length&&<div className="lcos-workflow-empty"><Network size={19}/><strong>这张工作流还没有结构</strong><span>把文件、Skill 或已有节点放进来，或者直接让本地 Agent 按项目理解搭建。</span><div><Wrench size={12}/>Skill <Bot size={12}/>Agent</div></div>}
    </div>
  </section>
}
