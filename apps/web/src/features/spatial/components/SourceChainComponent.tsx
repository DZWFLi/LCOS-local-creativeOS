import { ArrowUpRight, Link2 } from 'lucide-react'
import { LcosGlyth } from '../visual/LcosGlyth'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'

function sourceIds(element: SurfaceComponentRenderProps['element']): string[] {
  return [...new Set([element.binding?.projectViewId, ...(element.binding?.projectViewIds ?? [])].filter((id): id is string => Boolean(id)))]
}

/** A movable reading object, not a fixed source strip and not copied history. */
export function SourceChainComponent({ element, selected, context }: SurfaceComponentRenderProps) {
  const ids = sourceIds(element)
  const byId = new Map((context?.nodes ?? []).map((node) => [node.id, node]))
  const sources = ids.flatMap((id) => {
    const node = byId.get(id)
    return node ? [node] : []
  })

  return <section className={`lcos-source-chain ${selected ? 'is-selected' : ''}`} data-context-component="source-chain">
    <header>
      <span><Link2 size={14}/><strong>{element.presentation?.variant || '来源脉络'}</strong></span>
      <small>{sources.length} 个真实来源</small>
      {selected && <LcosGlyth state="focus" size={22}/>} 
    </header>
    {sources.length ? <div className="lcos-source-chain-flow">
      {sources.map((node, index) => <div className="lcos-source-chain-segment" key={node.id}>
        {index > 0 && <i aria-hidden="true"/>}
        <button type="button" onClick={() => context?.onSelectNode?.(node.id)} onDoubleClick={() => context?.onOpenNode?.(node.id)} title="单击选中，双击打开详情">
          <span>{node.title}</span>
          <small>{node.subtitle || node.fileType || (node.anchors?.length ? '有来源锚点' : '项目对象')}</small>
          <b><ArrowUpRight size={11}/> 双击阅读</b>
        </button>
      </div>)}
    </div> : <div className="lcos-source-chain-empty">把真实来源拖进 Context 后，这里会形成可移动的阅读脉络</div>}
  </section>
}
