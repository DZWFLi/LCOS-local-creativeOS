import { ArrowUpRight, GitBranchPlus, Link2, Unlink2 } from 'lucide-react'
import { LcosGlyth } from '../visual/LcosGlyth'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'

function sourceIds(element: SurfaceComponentRenderProps['element']): string[] {
  return [...new Set([element.binding?.projectViewId, ...(element.binding?.projectViewIds ?? [])].filter((id): id is string => Boolean(id)))]
}

/** A movable reading object, not a fixed source strip and not copied history. */
const SOURCE_CHAIN_MIME = 'application/x-lcos-source-chain-item'

export function SourceChainComponent({ element, selected, context, onSourceChainEdit }: SurfaceComponentRenderProps) {
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
      {selected && <LcosGlyth state="absorb" size={22}/>}
    </header>
    {sources.length ? <div className="lcos-source-chain-flow">
      {sources.map((node, index) => <div className="lcos-source-chain-segment" key={node.id} onDragOver={(event) => { if (event.dataTransfer.types.includes(SOURCE_CHAIN_MIME)) event.preventDefault() }} onDrop={(event) => {
        event.preventDefault(); event.stopPropagation()
        try {
          const payload = JSON.parse(event.dataTransfer.getData(SOURCE_CHAIN_MIME)) as { sourceElementId?: unknown; viewId?: unknown }
          if (typeof payload.sourceElementId === 'string' && typeof payload.viewId === 'string') onSourceChainEdit?.({ kind: 'move', sourceElementId: payload.sourceElementId, viewId: payload.viewId, targetIndex: index })
        } catch { /* malformed internal drag: no mutation */ }
      }}>
        {index > 0 && <i aria-hidden="true"/>}
        <button type="button" draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData(SOURCE_CHAIN_MIME, JSON.stringify({ sourceElementId: element.id, viewId: node.id })) }} onClick={() => context?.onSelectNode?.(node.id)} onDoubleClick={() => context?.onOpenNode?.(node.id)} title="单击选中，双击打开详情；拖动可重排或拼接">
          <span>{node.title}</span>
          <small>{node.subtitle || node.fileType || (node.anchors?.length ? '有来源锚点' : '项目对象')}</small>
          <b><ArrowUpRight size={11}/> 双击阅读</b>
        </button>
        {selected && <nav><button type="button" title="从这里剪出一条平行来源链" aria-label={`将 ${node.title} 剪出为平行来源链`} onClick={() => onSourceChainEdit?.({ kind: 'split', viewId: node.id })}><GitBranchPlus size={11}/></button><button type="button" title="仅从当前来源链断开" aria-label={`从当前来源链断开 ${node.title}`} onClick={() => onSourceChainEdit?.({ kind: 'remove', viewId: node.id })}><Unlink2 size={11}/></button></nav>}
      </div>)}
    </div> : <div className="lcos-source-chain-empty">把真实来源拖进 Context 后，这里会形成可移动的阅读脉络</div>}
  </section>
}
