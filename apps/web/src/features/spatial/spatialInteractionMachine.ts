import type { Camera } from '../../model'
import { IDLE_SPATIAL_POINTER, type SpatialPoint, type SpatialPointerSession } from './spatialTypes'

export function beginSpatialPan(pointerId: number, point: SpatialPoint, camera: Camera): SpatialPointerSession {
  return { kind: 'pan', pointerId, start: point, originCamera: camera }
}

export function advanceSpatialPan(session: SpatialPointerSession, point: SpatialPoint): Camera | null {
  if (session.kind !== 'pan') return null
  return {
    ...session.originCamera,
    x: session.originCamera.x + point.x - session.start.x,
    y: session.originCamera.y + point.y - session.start.y,
  }
}

export function beginSpatialMarquee(pointerId: number, point: SpatialPoint): SpatialPointerSession {
  return { kind: 'marquee', pointerId, start: point, current: point, moved: false }
}

export function advanceSpatialMarquee(session: SpatialPointerSession, point: SpatialPoint, threshold = 4): SpatialPointerSession {
  if (session.kind !== 'marquee') return session
  return { ...session, current: point, moved: session.moved || Math.hypot(point.x - session.start.x, point.y - session.start.y) > threshold }
}

export function spatialMarqueeRect(session: SpatialPointerSession) {
  if (session.kind !== 'marquee' || !session.moved) return null
  return {
    left: Math.min(session.start.x, session.current.x),
    top: Math.min(session.start.y, session.current.y),
    width: Math.abs(session.current.x - session.start.x),
    height: Math.abs(session.current.y - session.start.y),
  }
}

export function beginSpatialNodeDrag(pointerId: number, id: string, point: SpatialPoint, origin: SpatialPoint, zoom: number): SpatialPointerSession {
  return { kind: 'node-drag', pointerId, id, start: point, origin, startZoom: zoom }
}

export function advanceSpatialNodeDrag(session: SpatialPointerSession, point: SpatialPoint): SpatialPoint | null {
  if (session.kind !== 'node-drag') return null
  const zoom = session.startZoom
  return {
    x: session.origin.x + (point.x - session.start.x) / zoom,
    y: session.origin.y + (point.y - session.start.y) / zoom,
  }
}

export function endSpatialPointer(): SpatialPointerSession {
  return IDLE_SPATIAL_POINTER
}
