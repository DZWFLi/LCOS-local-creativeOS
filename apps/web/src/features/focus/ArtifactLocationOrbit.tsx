import { Crosshair, FolderTree, LayoutGrid, ListTree, Network, Workflow } from 'lucide-react'
import { useMemo } from 'react'
import type { ProjectFocusLocation } from '../../state/projectFocus'
import { ObjectOrbit, type ObjectOrbitAction } from '../ui/ObjectOrbit'

interface Props {
  readonly open: boolean
  readonly anchor: Element
  readonly sourceLabel: string
  readonly locations: readonly ProjectFocusLocation[]
  readonly onClose: () => void
  readonly onNavigate: (location: ProjectFocusLocation) => void
  readonly onMore: () => void
}

function iconFor(kind: ProjectFocusLocation['kind']) {
  if (kind === 'collection') return FolderTree
  if (kind === 'context' || kind === 'context-graph') return Network
  if (kind === 'workflow' || kind === 'workflow-graph') return Workflow
  if (kind === 'workspace') return LayoutGrid
  return Crosshair
}

/**
 * Single-object Focus is object-local navigation: known object → where it appears.
 * It reuses ObjectOrbit behavior instead of reopening the old projection registry card.
 */
export function ArtifactLocationOrbit(props: Props) {
  const anchorRef = useMemo(() => ({ current: props.anchor }), [props.anchor])
  const visibleLocations = props.locations.length > 5 ? props.locations.slice(0, 4) : props.locations
  const actions: ObjectOrbitAction[] = visibleLocations.map((location) => ({
    id: `location:${location.key}`,
    label: `${location.active ? '当前 · ' : ''}${location.label}`,
    icon: iconFor(location.kind),
    readOnly: location.active,
    onClick: location.active ? undefined : () => props.onNavigate(location),
  }))
  if (props.locations.length > visibleLocations.length) {
    actions.push({
      id: 'location:more',
      label: `更多位置 · ${props.locations.length}`,
      icon: ListTree,
      keepOpen: true,
      onClick: props.onMore,
    })
  }

  return <ObjectOrbit
    open={props.open}
    onClose={props.onClose}
    anchorRef={anchorRef}
    ariaLabel={`「${props.sourceLabel}」出现位置`}
    actions={actions}
  />
}
