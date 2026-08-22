import { ArrowUpRight, GitBranch, History, Layers3, Link2, Sparkles } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { visibleHierarchyRows } from '../../presentation/presentationHierarchy'
import { LcosGlyph } from '../visual/LcosGlyph'
import { LightSegment } from '../visual/LightSegment'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'

function boundIds(element: SurfaceComponentRenderProps['element']) {
  const values = Object.values(element.binding ?? {})
  return [...new Set(values.flatMap((value) => {
    if (typeof value === 'string' && value.length) return [value]
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    return []
  }))]
}

function Header({ icon, title, hint, selected }: { icon: ReactNode; title: string; hint: string; selected?: boolean }) {
  return <header className="lcos-context-component-header">
    <span className="lcos-context-component-icon">{icon}</span>
    <span><strong>{title}</strong><small>{hint}</small></span>
    <LightSegment axis="horizontal" length={20} active={selected}/><LcosGlyph state={selected ? 'focus' : 'stable'} />
  </header>
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="lcos-context-component-empty">{children}</div>
}

function scopedNodes({ element, context }: SurfaceComponentRenderProps) {
  const ids = boundIds(element)
  const nodes = context?.nodes ?? []
  return ids.length ? nodes.filter((node) => ids.includes(node.id)) : nodes
}

export function StructureMapComponent(props: SurfaceComponentRenderProps) {
  const { selected, context } = props
  const nodes = scopedNodes(props)
  const rows = context?.hierarchy ? visibleHierarchyRows(nodes, context.hierarchy) : nodes.map((node) => ({ id: node.id, node, depth: 0 }))
  return <div className={`lcos-context-component lcos-context-structure ${selected ? 'is-selected' : ''}`} data-context-component="structure-map">
    <Header icon={<Layers3 size={15}/>} title="结构" hint="当前材料的阅读层级，不改写项目真相" selected={selected}/>
    {rows.length ? <div className="lcos-context-structure-rows">
      {rows.slice(0, 12).map((row) => <button key={row.id} type="button" style={{ '--context-depth': row.depth } as CSSProperties} onClick={() => context?.onSelectNode?.(row.id)} onDoubleClick={() => context?.onOpenNode?.(row.id)}>
        <i/><span>{row.node.title}</span><small>{row.node.subtitle || row.node.fileType || '项目对象'}</small>
      </button>)}
    </div> : <Empty>当前 Context 还没有可组织的对象</Empty>}
    <footer><span>{rows.length ? `${rows.length} 个真实对象` : '从选择或当前 Context 生成'}</span><ArrowUpRight size={12}/></footer>
  </div>
}

export function EvolutionComponent(props: SurfaceComponentRenderProps) {
  const { element, selected, context } = props
  const ids = boundIds(element)
  const history = (context?.history ?? []).filter((entry) => !ids.length || entry.objectIds.some((id) => ids.includes(id)))
  return <div className={`lcos-context-component lcos-context-evolution ${selected ? 'is-selected' : ''}`} data-context-component="evolution">
    <Header icon={<History size={15}/>} title="演进" hint="真实版本、变化与决策来源" selected={selected}/>
    {history.length ? <div className="lcos-context-evolution-rows">
      {history.slice(0, 8).map((entry) => <button key={entry.id} type="button" className={entry.current ? 'is-current' : ''} onClick={() => context?.onOpenHistorySource?.(entry)}>
        <i/><span><strong>{entry.title}</strong><small>{entry.summary || entry.label}</small></span>{entry.createdAt && <time>{entry.createdAt.slice(0, 10)}</time>}
      </button>)}
    </div> : <Empty>当前对象还没有可读取的演进记录</Empty>}
    <footer><span>{history.length ? `${history.length} 个可追溯变化` : '不伪造历史'}</span><ArrowUpRight size={12}/></footer>
  </div>
}

export function RelationshipFieldComponent(props: SurfaceComponentRenderProps) {
  const { selected, context } = props
  const nodes = scopedNodes(props)
  const nodeIds = new Set(nodes.map((node) => node.id))
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const edges = (context?.edges ?? []).filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
  return <div className={`lcos-context-component lcos-context-relationship ${selected ? 'is-selected' : ''}`} data-context-component="relationship-field">
    <Header icon={<GitBranch size={15}/>} title="关系" hint="当前材料之间的局部关联" selected={selected}/>
    {edges.length ? <div className="lcos-context-relationship-rows">
      {edges.slice(0, 10).map((edge) => <div key={edge.id}><button type="button" onClick={() => context?.onSelectNode?.(edge.from)}>{byId.get(edge.from)?.title}</button><span>{edge.label || edge.kind}</span><button type="button" onClick={() => context?.onSelectNode?.(edge.to)}>{byId.get(edge.to)?.title}</button></div>)}
    </div> : <Empty>当前范围内还没有真实关系</Empty>}
    <footer><span>{edges.length ? `${edges.length} 条真实关系` : '不自动猜测因果'}</span><Link2 size={12}/></footer>
  </div>
}

export function ContextPackComponent(props: SurfaceComponentRenderProps) {
  const { selected, context } = props
  const ids = boundIds(props.element)
  const nodes = scopedNodes(props)
  return <div className={`lcos-context-component lcos-context-pack ${selected ? 'is-selected' : ''}`} data-context-component="context-pack">
    <Header icon={<Sparkles size={15}/>} title="Context Pack" hint="交给 Agent 的当前阅读范围" selected={selected}/>
    {ids.length && nodes.length ? <div className="lcos-context-pack-items">
      {nodes.slice(0, 9).map((node) => <button key={node.id} type="button" onClick={() => context?.onSelectNode?.(node.id)} onDoubleClick={() => context?.onOpenNode?.(node.id)}><span>{node.title}</span><small>{node.subtitle || node.fileType || '项目对象'}</small></button>)}
    </div> : <Empty>先选择要交给 Agent 的对象，再创建 Context Pack</Empty>}
    <footer><span>{ids.length ? `${ids.length} 个引用 · 不复制 Project Truth` : '等待明确意图'}</span><ArrowUpRight size={12}/></footer>
  </div>
}
