import type { SurfaceElement } from './surfaceElementTypes'

export type SourceChainEdit =
  | { readonly kind: 'move'; readonly sourceElementId: string; readonly viewId: string; readonly targetIndex: number }
  | { readonly kind: 'remove'; readonly viewId: string }
  | { readonly kind: 'split'; readonly viewId: string }

function idsFor(item: SurfaceElement): string[] {
  return [...new Set([item.binding?.projectViewId, ...(item.binding?.projectViewIds ?? [])].filter((id): id is string => Boolean(id)))]
}

function bindingWithIds(item: SurfaceElement, ids: readonly string[]): SurfaceElement['binding'] {
  const { projectViewId: _single, projectViewIds: _many, ...rest } = item.binding ?? {}
  return { ...rest, ...(ids.length ? { projectViewIds: [...ids] } : {}) }
}

/** Presentation-only source-chain editing. Underlying Project Views are never mutated or deleted. */
export function applySourceChainEdit(elements: readonly SurfaceElement[], targetElementId: string, edit: SourceChainEdit, createId = () => `${targetElementId}:branch:${Date.now().toString(36)}`): SurfaceElement[] {
  const target = elements.find((item) => item.id === targetElementId && item.type === 'source-chain')
  if (!target) return [...elements]
  if (edit.kind === 'remove') return elements.map((item) => item.id === target.id ? { ...item, binding: bindingWithIds(item, idsFor(item).filter((id) => id !== edit.viewId)) } : item)
  if (edit.kind === 'split') {
    if (!idsFor(target).includes(edit.viewId)) return [...elements]
    const sibling: SurfaceElement = {
      ...target,
      id: createId(),
      bounds: { ...target.bounds, y: target.bounds.y + target.bounds.h + 28 },
      binding: { projectViewIds: [edit.viewId] },
      presentation: { ...target.presentation, variant: `${target.presentation?.variant || '来源'} · 并行线` },
    }
    return [...elements.map((item) => item.id === target.id ? { ...item, binding: bindingWithIds(item, idsFor(item).filter((id) => id !== edit.viewId)) } : item), sibling]
  }
  const source = elements.find((item) => item.id === edit.sourceElementId && item.type === 'source-chain')
  if (!source || !idsFor(source).includes(edit.viewId)) return [...elements]
  const withoutSource = elements.map((item) => item.id === source.id ? { ...item, binding: bindingWithIds(item, idsFor(item).filter((id) => id !== edit.viewId)) } : item)
  return withoutSource.map((item) => {
    if (item.id !== target.id) return item
    const ids = idsFor(item).filter((id) => id !== edit.viewId)
    ids.splice(Math.max(0, Math.min(edit.targetIndex, ids.length)), 0, edit.viewId)
    return { ...item, binding: bindingWithIds(item, ids) }
  })
}
