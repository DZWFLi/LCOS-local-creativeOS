import { useCallback, useEffect, useRef, useState } from 'react'
import type { CanvasNode } from '../../model'
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
 * Context/Workflow currently persist this A13 path through the existing
 * view-endpoint Relation contract. Aggregate scope/workspace projections and
 * Conversation Glyth therefore fail closed until their endpoint semantics are
 * explicitly owned instead of being guessed from presentation ids.
 */
export function isProjectViewRelationEligible(node: CanvasNode): boolean {
  return node.entityKind !== 'conversation'
    && !node.id.startsWith('scope:')
    && !node.id.startsWith('workspace:')
}

/** Explicit physical receptor lookup. Never fall back to generic data-node-id. */
export function projectMaterialRelationTargetAt(clientX: number, clientY: number, sourceId?: string | null): string | null {
  const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-project-relation-target]')
  const targetId = element?.dataset.projectRelationTarget?.trim()
  return targetId && targetId !== sourceId ? targetId : null
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
