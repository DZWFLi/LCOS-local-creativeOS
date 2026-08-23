import type { SurfaceBinding, SurfaceComponentType, SurfaceElement, SurfaceKind } from './surfaceElementTypes'
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
  | { readonly kind: 'stack-selection'; readonly targetIds: readonly string[] }
  | { readonly kind: 'compare-selection'; readonly targetIds: readonly string[] }
  | { readonly kind: 'trace-active-path'; readonly targetIds: readonly string[] }
  | { readonly kind: 'restore-routine'; readonly targetIds: readonly string[] }
  | { readonly kind: 'save-current-routine'; readonly targetIds: readonly string[] }
  | { readonly kind: 'open-page-set'; readonly targetIds: readonly string[] }
  | { readonly kind: 'foreground-page'; readonly targetIds: readonly string[] }
  | { readonly kind: 'place-quick-note-near-page'; readonly targetIds: readonly string[] }
  | { readonly kind: 'prepare-agent-tool'; readonly targetIds: readonly string[]; readonly toolKind?: string }
  | { readonly kind: 'continue-from-current'; readonly targetIds: readonly string[] }
  | { readonly kind: 'collapse-inactive-pages'; readonly targetIds: readonly string[] }

export interface SurfaceIntentContext {
  readonly projectId: string
  readonly surface: SurfaceKind
  readonly existing: readonly SurfaceElement[]
  readonly selectionBounds?: SurfaceBounds | null
  readonly viewportOrigin: { readonly x: number; readonly y: number }
  readonly createId?: (type: SurfaceComponentType) => string
}

function componentForIntent(surface: SurfaceKind, intent: SurfaceIntent): SurfaceComponentType | null {
  if (intent.kind === 'show-structure') return surface === 'context' ? 'structure-map' : null
  if (intent.kind === 'show-evolution') return surface === 'context' ? 'evolution' : null
  if (intent.kind === 'mark-review') return surface === 'workflow' ? 'review' : null
  if (intent.kind === 'stack-selection') return surfaceSupportsComponent(surface, 'stack') ? 'stack' : null
  if (intent.kind === 'compare-selection') return surfaceSupportsComponent(surface, 'compare') ? 'compare' : null
  if (intent.kind === 'trace-active-path') return surfaceSupportsComponent(surface, 'active-path') ? 'active-path' : null
  if (intent.kind === 'prepare-workbench' || intent.kind === 'place-quick-note-near-page' || intent.kind === 'prepare-agent-tool' || intent.kind === 'collapse-inactive-pages') return surfaceSupportsComponent(surface, 'workbench') ? 'workbench' : null
  if (intent.kind === 'focus-region' || intent.kind === 'organize') return 'region'
  return null
}

function bindingForTargets(targetIds: readonly string[]): SurfaceBinding | undefined {
  const ids = [...new Set(targetIds.map((id) => id.trim()).filter(Boolean))]
  if (!ids.length) return undefined
  return { projectViewIds: ids }
}

export function resolveSurfaceIntent(intent: SurfaceIntent, context: SurfaceIntentContext): SurfaceOp[] {
  const type = componentForIntent(context.surface, intent)
  if (!type) return []
  const contract = surfaceComponentContract(type)
  if (!surfaceSupportsComponent(context.surface, type) || contract.createMode !== 'presentation') return []
  const binding = bindingForTargets(intent.targetIds)
  const createId = context.createId ?? ((componentType) => `surface:${componentType}:${Date.now().toString(36)}`)
  const bounds = type === 'region' && context.selectionBounds
    ? regionBoundsForSelection(context.selectionBounds, contract.minSize)
    : placeSurfaceComponent({
        size: contract.minSize,
        selection: context.selectionBounds,
        viewportOrigin: context.viewportOrigin,
        existing: context.existing,
      })
  const variant = intent.kind === 'organize' ? intent.hint
    : intent.kind === 'prepare-workbench' ? intent.workbenchKind
      : intent.kind === 'place-quick-note-near-page' ? 'quick-note'
        : intent.kind === 'prepare-agent-tool' ? `agent-tool:${intent.toolKind ?? 'summary'}`
          : intent.kind === 'collapse-inactive-pages' ? 'collapse-inactive'
            : undefined
  return [{
    type: 'create-component',
    component: {
      id: createId(type),
      projectId: context.projectId,
      surface: context.surface,
      type,
      bounds,
      ...(binding ? { binding } : {}),
      presentation: { ...(variant ? { variant } : {}) },
    },
  }]
}
