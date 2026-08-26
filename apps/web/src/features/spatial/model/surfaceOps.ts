import type { SurfaceBinding, SurfaceElement } from './surfaceElementTypes'
import { isFiniteSurfaceBounds } from './surfaceElementTypes'
import { surfaceComponentContract, surfaceSupportsComponent } from './surfaceComponentCatalog'

export type SurfaceOp =
  | { readonly type: 'move'; readonly elementId: string; readonly x: number; readonly y: number }
  /** resize 携带完整落点(含 x/y):west/north 边拖拽会改变原点,只传 w/h 会把组件弹回旧原点。 */
  | { readonly type: 'resize'; readonly elementId: string; readonly w: number; readonly h: number; readonly x?: number; readonly y?: number }
  | { readonly type: 'create-component'; readonly component: SurfaceElement }
  | { readonly type: 'remove-projection'; readonly elementId: string }
  | { readonly type: 'bind'; readonly elementId: string; readonly binding: SurfaceBinding }

export type SurfaceOpValidation = { readonly ok: true } | { readonly ok: false; readonly reason: string }
export type SurfaceOpBatchValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string; readonly opIndex: number }

const finite = (...values: readonly number[]) => values.every(Number.isFinite)

const validBindingValue = (value: unknown): boolean => {
  if (typeof value === 'string') return Boolean(value.trim())
  if (!Array.isArray(value) || value.length === 0) return false
  const ids = value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
  return ids.length === value.length && new Set(ids).size === ids.length
}

export function validateSurfaceOp(op: SurfaceOp, elements: readonly SurfaceElement[]): SurfaceOpValidation {
  const byId = new Map(elements.map((element) => [element.id, element]))
  if (op.type === 'create-component') {
    if (byId.has(op.component.id)) return { ok: false, reason: `Surface element ${op.component.id} already exists.` }
    if (!op.component.id.trim() || !op.component.projectId.trim()) return { ok: false, reason: 'Surface component requires stable id and projectId.' }
    if (!isFiniteSurfaceBounds(op.component.bounds)) return { ok: false, reason: 'Surface component bounds must be finite and positive.' }
    if (!surfaceSupportsComponent(op.component.surface, op.component.type)) return { ok: false, reason: `${op.component.type} is not allowed on ${op.component.surface}.` }
    const min = surfaceComponentContract(op.component.type).minSize
    if (op.component.bounds.w < min.w || op.component.bounds.h < min.h) return { ok: false, reason: `${op.component.type} is smaller than its minimum size.` }
    return { ok: true }
  }
  const element = byId.get(op.elementId)
  if (!element) return { ok: false, reason: `Surface element ${op.elementId} does not exist.` }
  if (op.type === 'move') {
    if (!surfaceComponentContract(element.type).movable) return { ok: false, reason: `${element.type} is not movable.` }
    if (element.presentation?.pinned) return { ok: false, reason: `${element.id} is pinned.` }
    return finite(op.x, op.y) ? { ok: true } : { ok: false, reason: 'Move coordinates must be finite.' }
  }
  if (op.type === 'resize') {
    const contract = surfaceComponentContract(element.type)
    if (!contract.resizable) return { ok: false, reason: `${element.type} is not resizable.` }
    if (element.presentation?.pinned) return { ok: false, reason: `${element.id} is pinned.` }
    if (!finite(op.w, op.h) || op.w < contract.minSize.w || op.h < contract.minSize.h) return { ok: false, reason: 'Resize is below component minimum size.' }
    return { ok: true }
  }
  if (op.type === 'bind') {
    if (!surfaceComponentContract(element.type).capabilities.bind) return { ok: false, reason: `${element.type} does not accept bindings.` }
    const values = Object.values(op.binding)
    if (!values.length || values.some((value) => !validBindingValue(value))) return { ok: false, reason: 'Binding requires non-empty identity values.' }
  }
  return { ok: true }
}

function applyValidatedSurfaceOp(elements: readonly SurfaceElement[], op: SurfaceOp): SurfaceElement[] {
  if (op.type === 'create-component') return [...elements, op.component]
  if (op.type === 'remove-projection') return elements.filter((element) => element.id !== op.elementId)
  return elements.map((element) => {
    if (element.id !== op.elementId) return element
    if (op.type === 'move') return { ...element, bounds: { ...element.bounds, x: op.x, y: op.y } }
    if (op.type === 'resize') return { ...element, bounds: { ...element.bounds, w: op.w, h: op.h, ...(op.x === undefined ? {} : { x: op.x }), ...(op.y === undefined ? {} : { y: op.y }) } }
    if (op.type === 'bind') return { ...element, binding: { ...op.binding } }
    return element
  })
}

export function applySurfaceOp(elements: readonly SurfaceElement[], op: SurfaceOp): SurfaceElement[] {
  const validation = validateSurfaceOp(op, elements)
  return validation.ok ? applyValidatedSurfaceOp(elements, op) : [...elements]
}

/**
 * Proposal batches are fail-closed. Validation walks the proposed future state
 * so create -> bind is legal, but one invalid op means zero durable changes.
 */
export function validateSurfaceOps(elements: readonly SurfaceElement[], ops: readonly SurfaceOp[]): SurfaceOpBatchValidation {
  let current = [...elements]
  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index]!
    const validation = validateSurfaceOp(op, current)
    if (!validation.ok) return { ok: false, reason: validation.reason, opIndex: index }
    current = applyValidatedSurfaceOp(current, op)
  }
  return { ok: true }
}

export function applySurfaceOps(elements: readonly SurfaceElement[], ops: readonly SurfaceOp[]): SurfaceElement[] {
  const validation = validateSurfaceOps(elements, ops)
  if (!validation.ok) return [...elements]
  return ops.reduce<SurfaceElement[]>((current, op) => applyValidatedSurfaceOp(current, op), [...elements])
}
