import type { PresentationStateV0 } from '@local-creative-os/contracts'

export type SpatialLayoutMode = 'freeform' | 'grid'

function canonicalVisibleIds(ids: readonly string[]): string[] {
  return ids.filter((id, index) => Boolean(id) && ids.indexOf(id) === index)
}

/**
 * Grid order is Presentation-only. The visible ids are supplied by the current
 * Surface projection, so aggregate Project-entity node ids can participate
 * without being smuggled into semantic membership.
 */
export function ensureGridOrder(state: PresentationStateV0, visibleIds: readonly string[] = state.memberViewIds): PresentationStateV0 {
  const visible = canonicalVisibleIds(visibleIds)
  const visibleSet = new Set(visible)
  const currentOrder = state.gridLayout?.order ?? []
  const retained = currentOrder.filter((id, index) => visibleSet.has(id) && currentOrder.indexOf(id) === index)
  const missing = visible.filter((id) => !retained.includes(id))
  return {
    ...state,
    gridLayout: {
      ...state.gridLayout,
      order: [...retained, ...missing],
    },
  }
}

/**
 * Layout mode is Presentation state only. Switching modes never mutates the
 * semantic member set and never discards Freeform coordinates.
 */
export function setSpatialLayoutMode(state: PresentationStateV0, mode: SpatialLayoutMode, visibleIds: readonly string[] = state.memberViewIds): PresentationStateV0 {
  if (mode === 'freeform') return { ...state, layoutMode: 'freeform' }
  return { ...ensureGridOrder(state, visibleIds), layoutMode: 'grid' }
}

export function reorderGridMember(state: PresentationStateV0, sourceId: string, targetId: string, visibleIds: readonly string[] = state.memberViewIds): PresentationStateV0 {
  const base = setSpatialLayoutMode(state, 'grid', visibleIds)
  const order = [...(base.gridLayout?.order ?? [])]
  const source = order.indexOf(sourceId)
  const target = order.indexOf(targetId)
  if (source < 0 || target < 0 || source === target) return base
  const [moved] = order.splice(source, 1)
  order.splice(target, 0, moved)
  return { ...base, gridLayout: { ...base.gridLayout, order } }
}
