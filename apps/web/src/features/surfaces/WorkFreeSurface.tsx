import { Play } from 'lucide-react'
import { useMemo } from 'react'
import type { CanvasEdge, CanvasNode } from '../../model'
import { runStatusLabel } from '../../model'
import { SurfaceObject } from './SurfaceObject'

interface Props { projectId:string; scopeId:string; nodes:CanvasNode[]; edges:CanvasEdge[]; selectedIds:string[]; onSelect:(id:string, additive?:boolean)=>void; onDoubleClick:(id:string)=>void }

/**
 * 运行 Lens 的「自由」投影（brief 10.3）：不强制泳道，
 * 按节点在画布上的实际相对位置自由排布，Run 节点携带状态徽标。
 * 与泳道投影共享同一批 Project Truth，只是观看方式不同。
 */
export function WorkFreeSurface(props:Props){
  const layout=useMemo(()=>{
    const nodes=props.nodes
    if(!nodes.length)return{items:[],edges:[]}
    const left=Math.min(...nodes.map((node)=>node.x)),top=Math.min(...nodes.map((node)=>node.y))
    const right=Math.max(...nodes.map((node)=>node.x+node.width)),bottom=Math.max(...nodes.map((node)=>node.y+node.height))
    const spanX=Math.max(1,right-left),spanY=Math.max(1,bottom-top)
    const padX=12,padY=10
    const items=nodes.map((node)=>({
      node,
      left:padX+((node.x-left)/spanX)*(100-padX*2),
      top:padY+((node.y-top)/spanY)*(100-padY*2),
      width:Math.max(9,Math.min(42,(node.width/spanX)*100)),
    }))
    const byId=new Map(items.map((item)=>[item.node.id,item]))
    const edges=props.edges.filter((edge)=>byId.has(edge.from)&&byId.has(edge.to)).map((edge)=>{const a=byId.get(edge.from)!,b=byId.get(edge.to)!;return{edge,x1:a.left,y1:a.top,x2:b.left,y2:b.top}})
    return{items,edges}
  },[props.edges,props.nodes])
  const runs=props.nodes.filter((node)=>node.kind==='process').length
  return <section className="lcos-dedicated-surface lcos-work-free" data-testid="surface-work-free">
    <header className="lcos-surface-heading"><div><strong>运行</strong><span>自由图</span></div><small>{runs} runs · {props.nodes.length} objects</small></header>
    <div className="lcos-workfree-stage">
      <svg className="lcos-workfree-edges" aria-hidden="true">{layout.edges.map(({edge,x1,y1,x2,y2})=><line key={edge.id} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} className={edge.active?'active':''}/>)}</svg>
      {layout.items.map(({node,left,top,width})=><div key={node.id} className={`lcos-workfree-node ${node.kind==='process'?'is-run':''}`} style={{left:`${left}%`,top:`${top}%`,width:`${width}%`}}>
        <SurfaceObject node={node} compact={node.kind!=='process'} selected={props.selectedIds.includes(node.id)} onSelect={props.onSelect} onDoubleClick={props.onDoubleClick}/>
        {node.kind==='process'&&<span className={`lcos-run-badge status-${node.runStatus??'idle'}`} title={node.runStatus?runStatusLabel[node.runStatus]:'执行记录'}><Play size={9} fill="currentColor"/>{node.runStatus?runStatusLabel[node.runStatus]:'Run'}</span>}
      </div>)}
      {!layout.items.length&&<div className="lcos-work-empty"><Play size={18}/><strong>还没有 Run</strong><span>任意 Surface 的 Selection 都可以直接开始。</span></div>}
    </div>
  </section>
}
