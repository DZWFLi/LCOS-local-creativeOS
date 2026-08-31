import { spatialOverlayRectFromDomRect, spatialOverlayRectIntersects, type SpatialOverlayRect } from './spatialOverlayPlacement'

export const SPATIAL_OVERLAY_OCCUPIED_SELECTORS = [
  '.lcos-bottom-dock',
  '.lcos-workspace-rail',
  '.work-rail:not(.collapsed)',
  '.minimap',
  '.canvas-minimap',
  '.vnext-project-strip',
  '.lcos-orbit-layer',
  '.lcos-selection-group-actions',
  '.lcos-surface-context-menu',
  '.anchor-create-menu',
] as const

export function collectSpatialOverlayOccupiedRects(
  viewport: SpatialOverlayRect,
  exclude?: Element | null,
  root: ParentNode | null = typeof document === 'undefined' ? null : document,
): SpatialOverlayRect[] {
  if (!root) return []
  const elements = new Set<Element>()
  SPATIAL_OVERLAY_OCCUPIED_SELECTORS.forEach((selector) => {
    root.querySelectorAll(selector).forEach((element) => elements.add(element))
  })
  return [...elements].flatMap((element) => {
    if (exclude && (element === exclude || exclude.contains(element) || element.contains(exclude))) return []
    const rect = spatialOverlayRectFromDomRect(element.getBoundingClientRect())
    if (rect.width <= 1 || rect.height <= 1 || !spatialOverlayRectIntersects(rect, viewport)) return []
    return [rect]
  })
}
