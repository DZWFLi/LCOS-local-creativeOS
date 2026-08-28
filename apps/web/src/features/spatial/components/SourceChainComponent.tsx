import { useState } from 'react'
import { ArrowUpRight, GitBranchPlus, Link2, Maximize2, Unlink2 } from 'lucide-react'
import { LcosSignalGlyph } from '../../design/DotGlyph'
import { SurfaceComponentImmersive } from './SurfaceComponentImmersive'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'

function sourceIds(element: SurfaceComponentRenderProps['element']): string[] {
  return [...new Set([element.binding?.projectViewId, ...(element.binding?.projectViewIds ?? [])].filter((id): id is string => Boolean(id)))]
}

/** A movable reading object, not a fixed source strip and not copied history. */
const SOURCE_CHAIN_MIME = 'application/x-lcos-source-chain-item'

export function SourceChainComponent({ element, selected, context, onSourceChainEdit }: SurfaceComponentRenderProps) {
  const ids = sourceIds(element)
  const [maximized, setMaximized] = useState(false)
  const byId = new Map((context?.nodes ?? []).map((node) => [node.id, node]))
  const sources = ids.flatMap((id) => {
    const node = byId.get(id)
    return node ? [node] : []
  })

  /** 来源链 flow 渲染（G-1）：fullscreen=true（沉浸）为纯查看版——无拖拽重排/剪出/断开（drop 目标是卡本身，
   *  沉浸里没有意义），segment 换行铺开全量可见；卡内（false）维持现状原样。 */
  const renderFlow = (fullscreen: boolean) => sources.length ? <div className="lcos-source-chain-flow" style={fullscreen ? { width: '100%', height: '100%', flexWrap: 'wrap', alignContent: 'flex-start', gap: '10px 0', padding: '20px 26px', overflow: 'auto', boxSizing: 'border-box' } : undefined}>
    {sources.map((node, index) => <div className="lcos-source-chain-segment" key={node.id} style={fullscreen ? { flex: '1 1 260px' } : undefined} onDragOver={fullscreen ? undefined : (event) => { if (event.dataTransfer.types.includes(SOURCE_CHAIN_MIME)) event.preventDefault() }} onDrop={fullscreen ? undefined : (event) => {
      event.preventDefault(); event.stopPropagation()
      try {
        const payload = JSON.parse(event.dataTransfer.getData(SOURCE_CHAIN_MIME)) as { sourceElementId?: unknown; viewId?: unknown }
        if (typeof payload.sourceElementId === 'string' && typeof payload.viewId === 'string') onSourceChainEdit?.({ kind: 'move', sourceElementId: payload.sourceElementId, viewId: payload.viewId, targetIndex: index })
      } catch { /* malformed internal drag: no mutation */ }
    }}>
      {index > 0 && <i aria-hidden="true"/>}
      <button type="button" draggable={!fullscreen} onDragStart={fullscreen ? undefined : (event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData(SOURCE_CHAIN_MIME, JSON.stringify({ sourceElementId: element.id, viewId: node.id })) }} onClick={() => context?.onSelectNode?.(node.id)} onDoubleClick={() => context?.onOpenNode?.(node.id)} title={fullscreen ? '单击选中，双击打开详情' : '单击选中，双击打开详情；拖动可重排或拼接'}>
        <span>{node.title}</span>
        <small>{node.subtitle || node.fileType || (node.anchors?.length ? '有来源锚点' : '项目对象')}</small>
        <b><ArrowUpRight size={11}/> 双击阅读</b>
      </button>
      {!fullscreen && selected && <nav><button type="button" title="从这里剪出一条平行来源链" aria-label={`将 ${node.title} 剪出为平行来源链`} onClick={() => onSourceChainEdit?.({ kind: 'split', viewId: node.id })}><GitBranchPlus size={11}/></button><button type="button" title="仅从当前来源链断开" aria-label={`从当前来源链断开 ${node.title}`} onClick={() => onSourceChainEdit?.({ kind: 'remove', viewId: node.id })}><Unlink2 size={11}/></button></nav>}
    </div>)}
  </div> : <div className="lcos-source-chain-empty">把真实来源拖进 Context 后，这里会形成可移动的阅读脉络</div>

  return <section className={`lcos-source-chain ${selected ? 'is-selected' : ''}`} data-context-component="source-chain">
    <header>
      <span><Link2 size={14}/><strong>{element.presentation?.variant || '来源脉络'}</strong></span>
      <small>{sources.length} 个真实来源</small>
      {/* G-1 最大化入口：与组件卡同款 20×20 方钮；button 在 SurfaceFrame 的 INTERACTIVE_SELECTOR 内，不被拖拽劫持 */}
      <button type="button" className="lcos-context-maximize" onClick={(event) => { event.stopPropagation(); setMaximized(true) }} aria-label="最大化查看来源链" title="最大化查看来源链"><Maximize2 size={11}/></button>
      {selected && <LcosSignalGlyph state="focus"/>}
    </header>
    {renderFlow(false)}
    {/* G-1 最大化：沉浸版全量来源脉络（换行铺开、无截断），关闭只卸载浮层、画布 state 不变 */}
    <SurfaceComponentImmersive open={maximized} title={element.presentation?.variant || '来源脉络'} hint="引用真实对象，不复制内容" onClose={() => setMaximized(false)}>
      {renderFlow(true)}
    </SurfaceComponentImmersive>
  </section>
}
