import { useCallback, useEffect, useRef, useState } from 'react'
import type { SpatialPointerContext } from './SpatialCanvas'
import type { SpatialPoint } from './spatialTypes'

/**
 * Phase A13 physical Relation grammar for ordinary Project material bodies.
 *
 * This adapter owns only transient pointer/target state. It deliberately does
 * NOT know how a Relation is persisted. Main, Context and Workflow keep their
 * own canonical commit semantics and inject them through `onCommit`.
 */
export interface ProjectMaterialRelationGestureState {
  readonly sourceId: string | null
  readonly sourcePoint: SpatialPoint | null
  readonly pointerPoint: SpatialPoint | null
  readonly targetId: string | null
}

const EMPTY_RELATION_GESTURE: ProjectMaterialRelationGestureState = {
  sourceId: null,
  sourcePoint: null,
  pointerPoint: null,
  targetId: null,
}

/**
 * A13 owns only transient gesture state. A16 separately resolves visible
 * Project-object ids to canonical view/note/scope/workspace persistence endpoints.
 * Conversation ordinary Relation remains fail-close.
 */

/** Latest L0 motor-tolerance truth: Relation receptors keep a 12–18px screen-space halo. */
export const RELATION_RECEPTOR_SCREEN_HALO_PX = 16

export interface RelationReceptorScreenRect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly width: number
  readonly height: number
}

/** Distance from a screen pointer to the visible receptor body. Inside = 0. */
export function relationReceptorScreenDistance(rect: RelationReceptorScreenRect, clientX: number, clientY: number): number {
  const dx = clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0
  const dy = clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0
  return Math.hypot(dx, dy)
}

/**
 * Screen-space receptor lookup used only while Relation intent is active.
 * The invisible halo never changes visual/selection/layout bounds and therefore
 * remains stable across canvas zoom. Direct body hits still win first.
 */
export function relationTargetWithinScreenHaloAt(
  clientX: number,
  clientY: number,
  selector: string,
  targetAttribute: string,
  sourceId?: string | null,
  haloPx = RELATION_RECEPTOR_SCREEN_HALO_PX,
): string | null {
  const direct = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>(selector)
  const directId = direct?.getAttribute(targetAttribute)?.trim()
  if (directId && directId !== sourceId) return directId

  let best: { readonly id: string; readonly distance: number } | null = null
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    const id = element.getAttribute(targetAttribute)?.trim()
    if (!id || id === sourceId) continue
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) continue
    const distance = relationReceptorScreenDistance(rect, clientX, clientY)
    if (distance > haloPx) continue
    if (!best || distance < best.distance) best = { id, distance }
  }
  return best?.id ?? null
}

/** Explicit Project-material receptor lookup. Never fall back to generic data-node-id. */
export function projectMaterialRelationTargetAt(clientX: number, clientY: number, sourceId?: string | null): string | null {
  return relationTargetWithinScreenHaloAt(clientX, clientY, '[data-project-relation-target]', 'data-project-relation-target', sourceId)
}

interface RelationGestureOptions {
  readonly onCommit: (sourceId: string, targetId: string) => void | Promise<void>
}

export function useProjectMaterialRelationGesture({ onCommit }: RelationGestureOptions) {
  const stateRef = useRef<ProjectMaterialRelationGestureState>(EMPTY_RELATION_GESTURE)
  const [state, setReactState] = useState<ProjectMaterialRelationGestureState>(EMPTY_RELATION_GESTURE)

  const replaceState = useCallback((next: ProjectMaterialRelationGestureState) => {
    stateRef.current = next
    setReactState(next)
  }, [])

  const cancel = useCallback(() => replaceState(EMPTY_RELATION_GESTURE), [replaceState])

  const beginIntent = useCallback((sourceId: string, sourcePoint: SpatialPoint) => {
    replaceState({ sourceId, sourcePoint, pointerPoint: sourcePoint, targetId: null })
  }, [replaceState])

  const onPointerMove = useCallback((context: SpatialPointerContext) => {
    const current = stateRef.current
    if (!current.sourceId) return
    replaceState({
      ...current,
      pointerPoint: context.world,
      targetId: projectMaterialRelationTargetAt(context.event.clientX, context.event.clientY, current.sourceId),
    })
  }, [replaceState])

  const commitTarget = useCallback((targetId: string) => {
    const current = stateRef.current
    if (!current.sourceId || targetId === current.sourceId) return
    const sourceId = current.sourceId
    replaceState(EMPTY_RELATION_GESTURE)
    void Promise.resolve().then(() => onCommit(sourceId, targetId)).catch(() => undefined)
  }, [onCommit, replaceState])

  useEffect(() => {
    if (!state.sourceId) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      cancel()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [cancel, state.sourceId])

  return {
    ...state,
    active: state.sourceId !== null,
    beginIntent,
    onPointerMove,
    commitTarget,
    cancel,
  }
}

export function ProjectMaterialRelationLiveEdge({ start, end }: { start: SpatialPoint | null; end: SpatialPoint | null }) {
  if (!start || !end) return null
  const middleX = start.x + (end.x - start.x) * .5
  return <path
    className="lcos-project-material-relation-live"
    d={`M${start.x} ${start.y} C${middleX} ${start.y},${middleX} ${end.y},${end.x} ${end.y}`}
    aria-hidden="true"
  />
}
