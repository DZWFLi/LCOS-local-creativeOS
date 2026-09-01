import type { ProjectFocusLocation, ProjectFocusLocationKind } from '../../state/projectFocus'
import type { CenteredSpatialIndexItem } from '../spatial/centeredSpatialIndex'

const KIND_LABEL: Readonly<Record<ProjectFocusLocationKind, string>> = {
  canvas: 'Main',
  collection: 'Collection',
  'context-graph': 'Context Graph',
  context: 'Context',
  'workflow-graph': 'Workflow Graph',
  workflow: 'Workflow',
  workspace: 'Workspace',
}

export function projectFocusKindLabel(kind: ProjectFocusLocationKind): string {
  return KIND_LABEL[kind]
}

/**
 * Focus truth stays in projectFocus.ts. This adapter only turns each resolved
 * occurrence/location into the shared top-center spatial-index presentation.
 */
export function projectFocusLocationIndexItems(
  locations: readonly ProjectFocusLocation[],
): readonly CenteredSpatialIndexItem[] {
  return locations.map((location) => ({
    id: location.key,
    label: `${location.active ? '当前 · ' : ''}${projectFocusKindLabel(location.kind)} · ${location.label}`,
    shortLabel: location.label,
    ...(location.matchedCount > 1 ? { count: location.matchedCount } : {}),
    active: location.active,
  }))
}

export function projectFocusLocationForIndexId(
  locations: readonly ProjectFocusLocation[],
  id: string,
): ProjectFocusLocation | null {
  return locations.find((location) => location.key === id) ?? null
}
