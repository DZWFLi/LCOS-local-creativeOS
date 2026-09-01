import type { CSSProperties, ReactNode } from 'react'
import { useActiveSpatialViewport } from './ActiveSpatialViewportContext'
import {
  layoutCenteredSpatialIndex,
  type CenteredSpatialIndexItem,
  type CenteredSpatialIndexOwner,
} from './centeredSpatialIndex'

interface Props {
  readonly owner: CenteredSpatialIndexOwner
  readonly items: readonly CenteredSpatialIndexItem[]
  readonly activeId?: string
  readonly ariaLabel?: string
  readonly overflowExpanded?: boolean
  readonly onActivate?: (id: string) => void
  readonly onHover?: (id: string | null) => void
  readonly onOverflow?: () => void
  readonly control?: ReactNode
}

function itemLabel(item: CenteredSpatialIndexItem): string {
  const count = item.count !== undefined && item.count > 1 ? ` · ${item.count}` : ''
  return `${item.label}${count}`
}

function markerButton(
  item: CenteredSpatialIndexItem,
  props: Pick<Props, 'activeId' | 'onActivate' | 'onHover'>,
  className: string,
  style?: CSSProperties,
) {
  return <button
    key={item.id}
    type="button"
    className={`${className}${item.presentation === 'result' ? ' is-result' : ''}${props.onActivate ? '' : ' is-readonly'}${item.active || item.id === props.activeId ? ' is-active' : ''}`}
    style={style}
    aria-label={itemLabel(item)}
    title={itemLabel(item)}
    aria-disabled={props.onActivate ? undefined : true}
    onClick={props.onActivate ? () => props.onActivate?.(item.id) : undefined}
    onPointerEnter={() => props.onHover?.(item.id)}
    onPointerLeave={() => props.onHover?.(null)}
  >
    <span className="lcos-centered-spatial-index-glyph" aria-hidden="true" />
    {item.shortLabel ? <span className="lcos-centered-spatial-index-short-label">{item.shortLabel}</span> : null}
    {item.hint ? <span className="lcos-centered-spatial-index-hint">{item.hint}</span> : null}
  </button>
}

/**
 * One screen-space top slot shared by Search / Focus / Color Pin presentation.
 * Canonical state remains outside this component; it only renders the winning owner.
 */
export function CenteredSpatialIndex(props: Props) {
  const environment = useActiveSpatialViewport()
  const layout = layoutCenteredSpatialIndex(props.items)
  if (props.owner === 'none') return null

  const anchor = environment?.topCenterAnchor
  const resultScale = props.owner === 'search' ? 2.15 : 1
  const overflowItems = layout.overflowCount > 0 ? props.items.slice(layout.visibleItems.length) : []
  const style = {
    '--lcos-spatial-index-anchor-x': `${anchor?.x ?? 0}px`,
    '--lcos-spatial-index-anchor-y': `${anchor?.y ?? 0}px`,
    ...(environment ? { '--lcos-spatial-index-active-width': `${environment.activeSpatialRect.width}px` } : {}),
    ...(anchor ? {} : { left: '50%', top: 0 }),
  } as CSSProperties

  return <div
    className={`lcos-centered-spatial-index is-${props.owner}${layout.visibleItems.length ? '' : ' is-empty'}${props.control ? ' has-control' : ''}${props.overflowExpanded ? ' is-overflow-expanded' : ''}`}
    data-testid="centered-spatial-index"
    data-spatial-index-owner={props.owner}
    aria-label={props.ariaLabel ?? '空间索引'}
    style={style}
  >
    {props.control ? <div className="lcos-centered-spatial-index-control">{props.control}</div> : null}
    {layout.visibleItems.map((item) => markerButton(item, props, 'lcos-centered-spatial-index-item', {
      '--lcos-index-x': `${item.x * resultScale}px`,
      '--lcos-index-y': `${item.y}px`,
      ...(item.tone ? { '--lcos-index-tone': item.tone } : {}),
    } as CSSProperties))}
    {layout.overflowCount > 0 && layout.overflowOffset ? <button
      type="button"
      className="lcos-centered-spatial-index-overflow"
      style={{ '--lcos-index-x': `${layout.overflowOffset.x * resultScale}px`, '--lcos-index-y': `${layout.overflowOffset.y}px` } as CSSProperties}
      aria-label={`还有 ${layout.overflowCount} 项`}
      aria-expanded={Boolean(props.overflowExpanded)}
      title={`还有 ${layout.overflowCount} 项`}
      onClick={props.onOverflow}
    >+{layout.overflowCount}</button> : null}
    {props.overflowExpanded && overflowItems.length > 0 ? <div
      className="lcos-centered-spatial-index-overflow-fan"
      data-testid="centered-spatial-index-overflow-fan"
      role="group"
      aria-label="更多空间位置"
    >
      {overflowItems.map((item) => markerButton(item, props, 'lcos-centered-spatial-index-overflow-item', item.tone ? { '--lcos-index-tone': item.tone } as CSSProperties : undefined))}
    </div> : null}
  </div>
}
