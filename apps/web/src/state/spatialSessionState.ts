import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Camera } from '../model'
import type { SpatialCameraSetter } from '../features/spatial/spatialTypes'

interface SpatialSessionSnapshot {
  camera: Camera
}

const memory = new Map<string, SpatialSessionSnapshot>()

function keyOf(projectId: string, scopeId: string, renderer: string) {
  return `spatial:${projectId}:${scopeId}:${renderer}`
}

/**
 * Ephemeral UI session state only. This deliberately does not use localStorage and
 * must not be mistaken for confirmed Presentation state.
 */
export function useSpatialSessionCamera(projectId: string, scopeId: string, renderer: string, fallback: Camera = { x: 0, y: 0, zoom: 1 }): readonly [Camera, SpatialCameraSetter] {
  const key = useMemo(() => keyOf(projectId, scopeId, renderer), [projectId, renderer, scopeId])
  const [camera, setCameraState] = useState<Camera>(() => memory.get(key)?.camera ?? fallback)

  useEffect(() => {
    setCameraState(memory.get(key)?.camera ?? fallback)
  }, [fallback.x, fallback.y, fallback.zoom, key])

  const setCamera = useCallback<SpatialCameraSetter>((next) => {
    setCameraState((current) => {
      const value = typeof next === 'function' ? next(current) : next
      memory.set(key, { camera: value })
      return value
    })
  }, [key])

  return [camera, setCamera] as const
}
