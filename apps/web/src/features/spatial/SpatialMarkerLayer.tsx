import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Camera } from '../../model'
import type { SpatialInsets } from './spatialTypes'
import {
  projectSpatialMarkers,
  spatialMarkerFanGroups,
  type ProjectedSpatialMarker,
  type SpatialMarkerCluster,
  type SpatialMarkerItem,
  type SpatialMarkerProjection,
} from './spatialMarkerSystem'

interface Props {
  readonly camera: Camera
  readonly viewportSize: Readonly<{ width: number; height: number }>
  readonly safeInsets?: SpatialInsets | undefined
  readonly items: readonly SpatialMarkerItem[]
  readonly currentSurfaceRef?: string
  readonly interactive?: boolean
  readonly onLocate?: (id: string) => void
  readonly onLocateCluster?: (ids: readonly string[]) => void
  readonly className?: string
  readonly markerPhase?: 'approach' | 'arrival'
  readonly onMarkerAnimationEnd?: () => void
}

function markerStyle(marker: ProjectedSpatialMarker): CSSProperties {
  return {
    left: marker.x,
    top: marker.y,
    '--lcos-marker-angle': `${marker.angleRad}rad`,
  } as CSSProperties
}

function clusterStyle(cluster: SpatialMarkerCluster): CSSProperties {
  return { left: cluster.x, top: cluster.y }
}

function Fan({ cluster, onLocate, onLocateCluster }: {
  readonly cluster: SpatialMarkerCluster
  readonly onLocate?: (id: string) => void
  readonly onLocateCluster?: (ids: readonly string[]) => void
}) {
  const groups = spatialMarkerFanGroups(cluster)
  const [openGroupId, setOpenGroupId] = useState<string | null>(null)
  return <div className="lcos-spatial-marker-fan" data-testid="spatial-marker-fan">
    {groups.map((group, index) => {
      const angle = -Math.PI * .72 + (groups.length === 1 ? 0 : index / Math.max(1, groups.length - 1)) * Math.PI * 1.44
      const radius = 58
      const style = {
        '--lcos-marker-fan-x': `${Math.cos(angle) * radius}px`,
        '--lcos-marker-fan-y': `${Math.sin(angle) * radius}px`,
      } as CSSProperties
      const single = group.members.length === 1 && group.overflowCount === 0
      const open = openGroupId === group.id
      const ids = group.memberIds
      return <div
        key={group.id}
        className={`lcos-spatial-marker-fan-group${open ? ' is-open' : ''}`}
        style={style}
        onMouseEnter={() => { if (!single) setOpenGroupId(group.id) }}
        onMouseLeave={() => { if (!single) setOpenGroupId((current) => current === group.id ? null : current) }}
      >
        <button
          type="button"
          className="lcos-spatial-marker-fan-button"
          aria-expanded={single ? undefined : open}
          onFocus={() => { if (!single) setOpenGroupId(group.id) }}
          onClick={() => {
            if (single) onLocate?.(group.members[0]!.item.id)
            else if (group.overflowCount > 0) onLocateCluster?.(ids)
            else setOpenGroupId((current) => current === group.id ? null : group.id)
          }}
        >
          <span>{group.label}</span>
          {!single ? <b>{group.members.length + group.overflowCount}</b> : null}
        </button>
        {open && group.overflowCount === 0 ? <div className="lcos-spatial-marker-fan-children">
          {group.members.map((member, childIndex) => {
            const childAngle = -Math.PI * .56 + (group.members.length === 1 ? 0 : childIndex / Math.max(1, group.members.length - 1)) * Math.PI * 1.12
            const childStyle = {
              '--lcos-marker-child-x': `${Math.cos(childAngle) * 54}px`,
              '--lcos-marker-child-y': `${Math.sin(childAngle) * 54}px`,
            } as CSSProperties
            return <button
              key={member.item.id}
              type="button"
              className={`lcos-spatial-marker-fan-child is-${member.morphology}`}
              style={childStyle}
              data-surface={member.item.surface}
              title={member.item.label}
              aria-label={`定位：${member.item.label}`}
              onClick={(event) => { event.stopPropagation(); onLocate?.(member.item.id) }}
            >
              <span className="lcos-spatial-marker-glyph" aria-hidden="true"/>
              <span>{member.item.label}</span>
            </button>
          })}
        </div> : null}
      </div>
    })}
  </div>
}

function MarkerBody({ marker, interactive, onLocate, markerPhase, onMarkerAnimationEnd }: {
  readonly marker: ProjectedSpatialMarker
  readonly interactive: boolean
  readonly onLocate?: (id: string) => void
  readonly markerPhase?: 'approach' | 'arrival'
  readonly onMarkerAnimationEnd?: () => void
}) {
  const className = [
    'lcos-spatial-marker',
    `is-${marker.kind}`,
    `is-${marker.morphology}`,
    marker.item.scope === 'cross-surface' ? 'is-cross-surface' : '',
    marker.item.attention && marker.item.attention !== 'normal' ? `is-${marker.item.attention}` : '',
    markerPhase ? `is-${markerPhase}` : '',
  ].filter(Boolean).join(' ')
  const content = <>
    <span className="lcos-spatial-marker-glyph" aria-hidden="true"/>
    <span className="lcos-spatial-marker-label">{marker.item.label}</span>
  </>
  const common = {
    className,
    'data-testid': 'spatial-marker',
    'data-marker-id': marker.item.id,
    'data-marker-projection': marker.kind,
    'data-marker-surface': marker.item.surface,
    'data-marker-scope': marker.item.scope,
    style: markerStyle(marker),
    onAnimationEnd: () => { if (markerPhase === 'arrival') onMarkerAnimationEnd?.() },
  } as const
  if (!interactive || !onLocate) return <div {...common} aria-hidden="true">{content}</div>
  return <button {...common} type="button" aria-label={`定位：${marker.item.label}`} title={marker.item.label} onClick={() => onLocate(marker.item.id)}>{content}</button>
}

function ClusterBody({ cluster, interactive, expanded, onExpandedChange, onLocate, onLocateCluster }: {
  readonly cluster: SpatialMarkerCluster
  readonly interactive: boolean
  readonly expanded: boolean
  readonly onExpandedChange: (expanded: boolean) => void
  readonly onLocate?: (id: string) => void
  readonly onLocateCluster?: (ids: readonly string[]) => void
}) {
  const ids = cluster.members.map((member) => member.item.id)
  const enter = () => onExpandedChange(true)
  return <div
    className={`lcos-spatial-marker-cluster is-${cluster.morphology}${cluster.scope === 'cross-surface' ? ' is-cross-surface' : ''}${expanded ? ' is-expanded' : ''}`}
    data-testid="spatial-marker-cluster"
    data-marker-surface={cluster.surface}
    data-marker-scope={cluster.scope}
    style={clusterStyle(cluster)}
    onMouseEnter={enter}
    onMouseLeave={() => onExpandedChange(false)}
  >
    <button
      type="button"
      className="lcos-spatial-marker-cluster-core"
      disabled={!interactive}
      aria-expanded={expanded}
      aria-label={`${cluster.members.length} 个空间标记`}
      onFocus={enter}
      onClick={() => {
        if (!interactive) return
        if (onLocateCluster) onLocateCluster(ids)
        else onExpandedChange(!expanded)
      }}
    >
      <span className="lcos-spatial-marker-glyph" aria-hidden="true"/>
      <b>{cluster.members.length}</b>
    </button>
    {expanded && interactive ? <Fan cluster={cluster} onLocate={onLocate} onLocateCluster={onLocateCluster}/> : null}
  </div>
}

/**
 * Unified presentation owner for persistent pins, offscreen cursors and
 * density clusters. Label collision remains delegated to SpatialLabelSystem's
 * mature provider seam; this component only owns marker projection/grouping.
 */
export function SpatialMarkerLayer({
  camera,
  viewportSize,
  safeInsets,
  items,
  currentSurfaceRef,
  interactive = true,
  onLocate,
  onLocateCluster,
  className = '',
  markerPhase,
  onMarkerAnimationEnd,
}: Props) {
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null)
  const projections = useMemo<readonly SpatialMarkerProjection[]>(() => projectSpatialMarkers({
    items,
    camera,
    viewportSize,
    safeInsets,
    currentSurfaceRef,
  }), [camera, currentSurfaceRef, items, safeInsets, viewportSize])

  if (!projections.length) return null
  return <div className={`lcos-spatial-marker-layer ${className}`.trim()} data-testid="spatial-marker-layer">
    {projections.map((projection) => projection.kind === 'marker'
      ? <MarkerBody
          key={projection.marker.item.id}
          marker={projection.marker}
          interactive={interactive}
          onLocate={onLocate}
          markerPhase={markerPhase}
          onMarkerAnimationEnd={onMarkerAnimationEnd}
        />
      : <ClusterBody
          key={projection.id}
          cluster={projection}
          interactive={interactive}
          expanded={expandedClusterId === projection.id}
          onExpandedChange={(expanded) => setExpandedClusterId(expanded ? projection.id : null)}
          onLocate={onLocate}
          onLocateCluster={onLocateCluster}
        />)}
  </div>
}
