import type { SurfaceBounds, SurfaceElement } from './surfaceElementTypes'

export interface SurfacePlacementRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export function boundsAroundSurfaceRects(rects: readonly SurfacePlacementRect[], padding = 28): SurfaceBounds | null {
  if (!rects.length) return null
  const left = Math.min(...rects.map((item) => item.x))
  const top = Math.min(...rects.map((item) => item.y))
  const right = Math.max(...rects.map((item) => item.x + item.w))
  const bottom = Math.max(...rects.map((item) => item.y + item.h))
  return { x: left - padding, y: top - padding, w: right - left + padding * 2, h: bottom - top + padding * 2 }
}

export function surfaceViewportOrigin(
  camera: { readonly x: number; readonly y: number; readonly zoom: number },
  screenPoint: { readonly x: number; readonly y: number } = { x: 140, y: 120 },
) {
  const zoom = Math.max(.05, camera.zoom)
  return { x: (screenPoint.x - camera.x) / zoom, y: (screenPoint.y - camera.y) / zoom }
}

export function surfaceBoundsOverlap(a: SurfaceBounds, b: SurfaceBounds, gap = 0): boolean {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y
}

function candidateBounds(x: number, y: number, size: { readonly w: number; readonly h: number }): SurfaceBounds {
  return { x, y, w: size.w, h: size.h }
}

/**
 * Deterministic geometry owns pixels. Intent/Agent chooses capability, not x/y.
 * Existing pinned/manual elements are hard obstacles and are never rewritten.
 */
export function placeSurfaceComponent(params: {
  readonly size: { readonly w: number; readonly h: number }
  readonly selection?: SurfaceBounds | null
  readonly viewportOrigin: { readonly x: number; readonly y: number }
  readonly existing: readonly SurfaceElement[]
  readonly gap?: number
}): SurfaceBounds {
  const gap = params.gap ?? 34
  const { size } = params
  const anchor = params.selection
  const base = anchor
    ? { x: anchor.x + anchor.w + gap, y: anchor.y }
    : params.viewportOrigin
  const candidates: SurfaceBounds[] = []
  if (anchor) {
    candidates.push(
      candidateBounds(base.x, base.y, size),
      candidateBounds(anchor.x, anchor.y + anchor.h + gap, size),
      candidateBounds(anchor.x - size.w - gap, anchor.y, size),
      candidateBounds(anchor.x, anchor.y - size.h - gap, size),
    )
  } else {
    candidates.push(candidateBounds(base.x, base.y, size))
  }
  for (let ring = 1; ring <= 12; ring += 1) {
    candidates.push(candidateBounds(base.x + ring * (size.w + gap), base.y, size))
    candidates.push(candidateBounds(base.x, base.y + ring * (size.h + gap), size))
    candidates.push(candidateBounds(base.x + ring * gap * 2, base.y + ring * gap * 1.4, size))
  }
  const blockers = params.existing.map((element) => element.bounds)
  return candidates.find((candidate) => blockers.every((blocker) => !surfaceBoundsOverlap(candidate, blocker, 12))) ?? candidates[0]!
}

export function regionBoundsForSelection(selection: SurfaceBounds, minSize = { w: 260, h: 170 }): SurfaceBounds {
  return {
    x: selection.x,
    y: selection.y,
    w: Math.max(minSize.w, selection.w),
    h: Math.max(minSize.h, selection.h),
  }
}
