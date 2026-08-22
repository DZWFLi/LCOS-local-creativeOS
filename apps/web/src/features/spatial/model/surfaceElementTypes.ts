import type {
  SurfaceBindingV0,
  SurfaceBoundsV0,
  SurfaceComponentTypeV0,
  SurfaceElementV0,
  SurfaceKindV0,
} from '@local-creative-os/contracts'

export type SurfaceKind = SurfaceKindV0
export type SurfaceBounds = SurfaceBoundsV0
export type SurfaceBinding = SurfaceBindingV0
export type SurfaceComponentType = SurfaceComponentTypeV0
export type SurfaceElement = SurfaceElementV0

export type SurfaceDropKind = 'project-view' | 'file' | 'text' | 'material-transfer'

export const isFiniteSurfaceBounds = (bounds: SurfaceBounds): boolean =>
  [bounds.x, bounds.y, bounds.w, bounds.h].every(Number.isFinite) && bounds.w > 0 && bounds.h > 0

export const withSurfaceBounds = (element: SurfaceElement, bounds: SurfaceBounds): SurfaceElement => ({ ...element, bounds })
