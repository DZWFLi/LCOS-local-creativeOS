import type { ColorPinDefinitionV0, ColorPinMembershipV0, NavigationResolutionV0 } from '@local-creative-os/contracts'
import type { CenteredSpatialIndexItem } from './centeredSpatialIndex'

export interface ProjectColorPinRecordForIndex {
  readonly definition: ColorPinDefinitionV0
  readonly membership: ColorPinMembershipV0
  readonly resolution: NavigationResolutionV0 | null
}

export interface ProjectColorPinGroup {
  readonly id: string
  readonly colorPinId: string
  readonly color: string
  readonly label?: string
  readonly records: readonly ProjectColorPinRecordForIndex[]
}

/** Only resolved memberships count as live spatial Pin truth in the top index. */
export function projectColorPinGroups(records: readonly ProjectColorPinRecordForIndex[]): readonly ProjectColorPinGroup[] {
  const groups = new Map<string, { color: string; label?: string; records: ProjectColorPinRecordForIndex[]; createdAt: string }>()
  for (const record of records) {
    if (record.resolution?.status !== 'resolved') continue
    const current = groups.get(record.definition.id)
    if (current) { current.records.push(record); continue }
    groups.set(record.definition.id, {
      color: record.definition.color,
      ...(record.definition.label ? { label: record.definition.label } : {}),
      records: [record],
      createdAt: record.definition.createdAt,
    })
  }
  return [...groups.entries()]
    .sort((a, b) => a[1].createdAt.localeCompare(b[1].createdAt) || a[0].localeCompare(b[0]))
    .map(([colorPinId, value]) => ({ id: `color-pin:${colorPinId}`, colorPinId, color: value.color, ...(value.label ? { label: value.label } : {}), records: value.records }))
}

export function projectColorPinIndexItems(groups: readonly ProjectColorPinGroup[]): readonly CenteredSpatialIndexItem[] {
  return groups.map((group) => ({
    id: group.id,
    label: group.label?.trim() || group.color,
    count: group.records.length,
    tone: group.color,
    presentation: 'marker',
  }))
}

export function projectColorPinGroupForIndexId(groups: readonly ProjectColorPinGroup[], id: string): ProjectColorPinGroup | undefined {
  return groups.find((group) => group.id === id)
}


/** Single-member Color Pin may hand directly to Focus; multi-member stays in the compact member view. */
export function projectColorPinDirectViewId(group: ProjectColorPinGroup): string | null {
  if (group.records.length !== 1) return null
  const target = group.records[0]?.membership.targetRef
  return target?.kind === 'view' ? target.id : null
}
