import type { SurfaceComponentType, SurfaceElement, SurfaceKind } from './surfaceElementTypes'
import { surfaceComponentContract, surfaceSupportsComponent } from './surfaceComponentCatalog'
import { placeSurfaceComponent, regionBoundsForSelection } from './surfaceGeometry'
import type { SurfaceBounds } from './surfaceElementTypes'
import type { SurfaceOp } from './surfaceOps'

export type SurfaceIntent =
  | { readonly kind: 'organize'; readonly targetIds: readonly string[]; readonly hint?: 'cluster' | 'sequence' | 'compare' }
  | { readonly kind: 'show-structure'; readonly targetIds: readonly string[] }
  | { readonly kind: 'show-evolution'; readonly targetIds: readonly string[] }
  | { readonly kind: 'mark-review'; readonly targetIds: readonly string[] }
  | { readonly kind: 'prepare-workbench'; readonly targetIds: readonly string[]; readonly workbenchKind?: string }
  | { readonly kind: 'focus-region'; readonly targetIds: readonly string[] }

export interface SurfaceIntentContext {
  readonly projectId: string
  readonly surface: SurfaceKind
  readonly existing: readonly SurfaceElement[]
  readonly selectionBounds?: SurfaceBounds | null
  readonly viewportOrigin: { readonly x: number; readonly y: number }
  readonly createId?: (type: SurfaceComponentType) => string
}

const fallbackType = (surface: SurfaceKind, preferred: SurfaceComponentType, fallback: SurfaceComponentType): SurfaceComponentType =>
  surfaceSupportsComponent(surface, preferred) ? preferred : fallback

function componentForIntent(surface: SurfaceKind, intent: SurfaceIntent): SurfaceComponentType {
  if (intent.kind === 'show-structure') return fallbackType(surface, 'structure-map', 'region')
  if (intent.kind === 'show-evolution') return fallbackType(surface, 'evolution', surface === 'workflow' ? 'checkpoint' : 'region')
  if (intent.kind === 'mark-review') return fallbackType(surface, 'review', 'region')
  if (intent.kind === 'prepare-workbench') return 'workbench'
  if (intent.kind === 'focus-region') return 'region'
  return 'region'
}

export function resolveSurfaceIntent(intent: SurfaceIntent, context: SurfaceIntentContext): SurfaceOp[] {
  const type = componentForIntent(context.surface, intent)
  const contract = surfaceComponentContract(type)
  if (!surfaceSupportsComponent(context.surface, type) || contract.createMode !== 'presentation') return []
  const createId = context.createId ?? ((componentType) => `surface:${componentType}:${Date.now().toString(36)}`)
  const bounds = type === 'region' && context.selectionBounds
    ? regionBoundsForSelection(context.selectionBounds, contract.minSize)
    : placeSurfaceComponent({
        size: contract.minSize,
        selection: context.selectionBounds,
        viewportOrigin: context.viewportOrigin,
        existing: context.existing,
      })
  const variant = intent.kind === 'organize' ? intent.hint : intent.kind === 'prepare-workbench' ? intent.workbenchKind : undefined
  return [{
    type: 'create-component',
    component: {
      id: createId(type),
      projectId: context.projectId,
      surface: context.surface,
      type,
      bounds,
      presentation: { ...(variant ? { variant } : {}) },
    },
  }]
}
