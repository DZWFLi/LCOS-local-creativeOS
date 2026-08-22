import { ArrowUpRight, GitBranch, History, Layers3, Link2, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { LcosGlyph } from '../visual/LcosGlyph'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'
import { LightSegment } from '../visual/LightSegment'

function ids(element: SurfaceComponentRenderProps['element']) {
  const binding = element.binding ?? {}
  return Object.values(binding).filter((value): value is string => typeof value === 'string' && value.length > 0)
}

function Header({ icon, title, hint, selected }: { icon: ReactNode; title: string; hint: string; selected?: boolean }) {
  return <header className="lcos-context-component-header">
    <span className="lcos-context-component-icon">{icon}</span>
    <span><strong>{title}</strong><small>{hint}</small></span>
    <LightSegment axis="horizontal" length={20} active={selected}/><LcosGlyph state={selected ? 'focus' : 'stable'} />
  </header>
}

export function StructureMapComponent({ element, selected }: SurfaceComponentRenderProps) {
  const bound = ids(element)
  return <div className={`lcos-context-component lcos-context-structure ${selected ? 'is-selected' : ''}`} data-context-component="structure-map">
    <Header icon={<Layers3 size={15}/>} title="结构" hint="从当前 Context 读出层级与主线" selected={selected}/>
    <div className="lcos-context-structure-tree"><span>当前理解范围</span><i/><b>主线材料</b><i/><b>关联分支</b></div>
    <footer><span>{bound.length ? `${bound.length} 个已绑定对象` : '绑定当前选择后生成结构'}</span><ArrowUpRight size={12}/></footer>
  </div>
}

export function EvolutionComponent({ element, selected }: SurfaceComponentRenderProps) {
  const bound = ids(element)
  return <div className={`lcos-context-component lcos-context-evolution ${selected ? 'is-selected' : ''}`} data-context-component="evolution">
    <Header icon={<History size={15}/>} title="演进" hint="查看变化、版本与决策转折" selected={selected}/>
    <div className="lcos-context-evolution-track"><span>起点</span><i/><span className="active">当前判断</span><i/><span>下一步</span></div>
    <footer><span>{bound.length ? `${bound.length} 个来源锚点` : '绑定来源后显示变化链'}</span><ArrowUpRight size={12}/></footer>
  </div>
}

export function RelationshipFieldComponent({ element, selected }: SurfaceComponentRenderProps) {
  const bound = ids(element)
  return <div className={`lcos-context-component lcos-context-relationship ${selected ? 'is-selected' : ''}`} data-context-component="relationship-field">
    <Header icon={<GitBranch size={15}/>} title="关系场" hint="只强调当前材料之间的局部关系" selected={selected}/>
    <div className="lcos-context-relationship-field"><span>原因</span><i/><b>判断</b><i/><span>影响</span></div>
    <footer><span>{bound.length ? `${bound.length} 个关系端点` : '绑定对象后显示关系'}</span><Link2 size={12}/></footer>
  </div>
}

export function ContextPackComponent({ element, selected }: SurfaceComponentRenderProps) {
  const bound = ids(element)
  return <div className={`lcos-context-component lcos-context-pack ${selected ? 'is-selected' : ''}`} data-context-component="context-pack">
    <Header icon={<Sparkles size={15}/>} title="Context Pack" hint="把选择整理成可交给 Agent 的阅读范围" selected={selected}/>
    <div className="lcos-context-pack-list"><span/><span/><span/><small>{bound.length ? `${bound.length} 个对象已准备` : '等待绑定选择'}</small></div>
    <footer><span>不复制 Project Truth · 只保存当前承接意图</span><ArrowUpRight size={12}/></footer>
  </div>
}
