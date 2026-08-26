import type { CSSProperties } from 'react'
import type { SurfaceComponentRenderProps } from './surfaceComponentTypes'
import { LcosGlyth } from '../visual/LcosGlyth'
import { LightSegment } from '../visual/LightSegment'
import { resolveSpatialSignal, shouldShowGlyth } from '../visual/spatialSignal'

function boundNodes(element: SurfaceComponentRenderProps['element'], context: SurfaceComponentRenderProps['context']) {
  const ids = new Set([
    element.binding?.projectViewId,
    ...(element.binding?.projectViewIds ?? []),
  ].filter((id): id is string => Boolean(id)))
  return (context?.nodes ?? []).filter((node) => ids.has(node.id))
}

/**
 * Stack — a physical pile of bound Project Views (Spatial-style). Layers
 * offset like sheets; the bottom segment bar counts members (progress =
 * pile size, max 12). References only, never copies.
 */
export function StackComponent({ element, selected, context }: SurfaceComponentRenderProps) {
  const members = boundNodes(element, context)
  const collapsed = Boolean(element.presentation?.collapsed)
  const signal = resolveSpatialSignal({ selected, semantic: element.presentation?.variant, runtime: 'idle' })
  return <div className={`lcos-stack-component ${selected ? 'is-selected' : ''}`} data-surface-component="stack">
    <header>
      <strong>堆叠</strong>
      <small>{members.length ? `${members.length} 个真实对象` : '拖入对象成堆'}</small>
      {shouldShowGlyth(signal) && <LcosGlyth state={signal.glyph}/>}
    </header>
    {members.length === 0
      ? <div className="lcos-stack-empty">把对象拖到这里；堆叠只保存稳定引用。</div>
      : collapsed
        ? <div className="lcos-stack-collapsed">{members[0]!.title}{members.length > 1 ? ` +${members.length - 1}` : ''}</div>
        : <ul className="lcos-stack-layers" data-count={Math.min(members.length, 6)}>
          {members.slice(0, 6).map((node, index) => <li key={node.id} style={{ '--layer-index': index } as CSSProperties} onClick={() => context?.onSelectNode?.(node.id)} title={node.subtitle || node.title}>
            <b>{node.title}</b>
            <small>{node.subtitle}</small>
          </li>)}
          {members.length > 6 && <li className="lcos-stack-more">还有 {members.length - 6} 件</li>}
        </ul>}
    <footer><LightSegment axis="horizontal" length={120} segments={12} mode={members.length ? 'progress' : 'static'} progress={members.length ? Math.min(1, members.length / 12) : undefined} active={signal.segmentActive}/></footer>
  </div>
}

/**
 * Compare — two bound objects side by side. The centre divider is a vertical
 * discrete light segment (structural branch, allowed by the light discipline),
 * not a decorative bar. Exactly two sides; extra drops replace the far side.
 */
export function CompareComponent({ element, selected, context }: SurfaceComponentRenderProps) {
  const members = boundNodes(element, context).slice(0, 2)
  const signal = resolveSpatialSignal({ selected, semantic: element.presentation?.variant, runtime: 'idle' })
  const left = members[0]
  const right = members[1]
  return <div className={`lcos-compare-component ${selected ? 'is-selected' : ''}`} data-surface-component="compare">
    <header>
      <strong>对比</strong>
      <small>{members.length === 2 ? '两个真实对象' : members.length === 1 ? '还差一侧' : '每侧拖入一个对象'}</small>
      {shouldShowGlyth(signal) && <LcosGlyth state={signal.glyph}/>}
    </header>
    <div className="lcos-compare-panels">
      <section onClick={left ? () => context?.onSelectNode?.(left.id) : undefined}>
        {left ? <><b>{left.title}</b><small>{left.subtitle}</small></> : <span className="lcos-compare-hint">拖入左侧对象</span>}
      </section>
      <LightSegment className="lcos-compare-divider" axis="vertical" length={64} segments={7} mode="checkpoint" checkpointIndex={3} active={members.length === 2}/>
      <section onClick={right ? () => context?.onSelectNode?.(right.id) : undefined}>
        {right ? <><b>{right.title}</b><small>{right.subtitle}</small></> : <span className="lcos-compare-hint">拖入右侧对象</span>}
      </section>
    </div>
  </div>
}

/**
 * Active Path — the workflow skeleton as a horizontal path projection: bound
 * steps read left to right, joined by a flowing light segment (direction =
 * execution order). Steady-state discipline: only the path segment flows.
 */
export function ActivePathComponent({ element, selected, context }: SurfaceComponentRenderProps) {
  const members = boundNodes(element, context)
  const signal = resolveSpatialSignal({ selected, semantic: element.presentation?.variant, runtime: members.length ? 'active' : 'idle' })
  return <div className={`lcos-active-path-component ${selected ? 'is-selected' : ''}`} data-surface-component="active-path">
    <header>
      <strong>活动路径</strong>
      <small>{members.length ? `${members.length} 步 · 灯条流向即顺序` : '拖入步骤对象连成路径'}</small>
      {shouldShowGlyth(signal) && <LcosGlyth state={signal.glyph}/>}
    </header>
    {members.length === 0
      ? <div className="lcos-active-path-empty">把步骤或对象拖进来，按顺序连成行动路径。</div>
      : <ol className="lcos-active-path-steps">
        {members.slice(0, 8).map((node, index) => <li key={node.id} style={{ '--step-index': index } as CSSProperties} onClick={() => context?.onSelectNode?.(node.id)}>
          <LightSegment axis="horizontal" length={26} segments={4} mode={index === 0 ? 'checkpoint' : 'flow'} checkpointIndex={1} active/>
          <span>{node.title}</span>
        </li>)}
      </ol>}
  </div>
}
