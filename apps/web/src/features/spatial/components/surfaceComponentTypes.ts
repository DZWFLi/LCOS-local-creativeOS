import type { SurfaceElement } from '../model/surfaceElementTypes'

export interface SurfaceComponentRenderProps {
  readonly element: SurfaceElement
  readonly selected?: boolean
  readonly meta?: string
}
