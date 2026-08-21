import { useCallback, useState } from 'react'
import type { SpatialPoint } from '../features/spatial/spatialTypes'

/**
 * HU-3 §6/§16：GesturePreviewStore —— purely visual / never persisted / never undone。
 * 无 persistence API、无 localStorage、无 Core mirror；project/presentation 切换或手势结束即清空。
 * 为后续 Reorganize Ghost UI 提供 layoutGhost 槽位。
 */
export interface AlignmentGuideV0 {
  readonly axis: 'x' | 'y'
  readonly position: number
  readonly span: readonly [number, number]
}

export interface GesturePreviewStateV0 {
  readonly dragPositions: Readonly<Record<string, SpatialPoint>>
  readonly layoutGhost?: Readonly<Record<string, SpatialPoint>>
  readonly dropTargetViewId?: string
  readonly alignmentGuides: readonly AlignmentGuideV0[]
  readonly relationHoverIds: readonly string[]
}

const EMPTY: GesturePreviewStateV0 = {
  dragPositions: {},
  alignmentGuides: [],
  relationHoverIds: [],
}

export function useGesturePreviewState() {
  const [preview, setPreview] = useState<GesturePreviewStateV0>(EMPTY)

  const update = useCallback((patch: Partial<GesturePreviewStateV0>) => {
    setPreview((current) => ({ ...current, ...patch }))
  }, [])

  const clear = useCallback(() => setPreview(EMPTY), [])

  const setDragPosition = useCallback((viewId: string, point: SpatialPoint) => {
    setPreview((current) => ({ ...current, dragPositions: { ...current.dragPositions, [viewId]: point } }))
  }, [])

  const clearDrag = useCallback(() => setPreview((current) => ({ ...current, dragPositions: {} })), [])

  return { preview, update, clear, setDragPosition, clearDrag }
}
