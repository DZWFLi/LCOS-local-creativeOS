import type { Camera } from '../../model'
import type { SpatialBounds, SpatialSize } from './spatialTypes'
import { spatialViewportWorldBounds, spatialWorldToScreen } from './spatialCamera'
import { spatialBoundsIntersect } from './spatialHitTest'

/**
 * §4.13 边缘气泡标点几何(纯函数,复刻 Unreal FindScreenEdgeLocationForWorldLocation 的
 * 纯向量解法,不用 RayCast):世界 bounds 中心投影到屏幕;对象与视口相交 → isOnscreen=true
 * (不出气泡);视口外 → 以视口中心为原点向对象方向发射线,与边缘内缩矩形的交点即气泡
 * 锚点,同时返回指向真实方位的角度。零依赖、纯几何。
 */
export interface EdgePinPlacement {
  /** 边缘锚点屏幕坐标(视口内时为对象中心的屏幕投影,仅供调试,组件层会过滤) */
  screenX: number
  screenY: number
  /** 指向对象真实方位的角度(弧度,atan2(dy, dx);CSS rotate 需乘 180/π 转度) */
  angle: number
  /** 对象 bounds 是否与当前视口相交——相交则不出气泡(不重复、不干扰) */
  isOnscreen: boolean
}

/** 边缘四向(同边缘的标点在组件层聚合为一个"巢") */
export type EdgePinEdge = 'left' | 'right' | 'top' | 'bottom'

/** 边缘气泡贴边内缩(px),气泡壳半宽 14px + 呼吸位 4px */
export const EDGE_PIN_EDGE_INSET = 18

export function edgePinForWorldBounds(
  worldBounds: SpatialBounds,
  camera: Camera,
  viewportSize: SpatialSize,
  edgeInset: number = EDGE_PIN_EDGE_INSET,
): EdgePinPlacement {
  // 世界 bounds 中心 → 屏幕坐标(与 spatialWorldToScreen 同一坐标系,不跟随相机 transform)
  const center = { x: worldBounds.x + worldBounds.width / 2, y: worldBounds.y + worldBounds.height / 2 }
  const projected = spatialWorldToScreen(center, camera)
  // 视口判断:世界 bounds 与视口世界范围相交(无 overscan,贴边即算在屏)
  if (spatialBoundsIntersect(worldBounds, spatialViewportWorldBounds(camera, viewportSize))) {
    return { screenX: projected.x, screenY: projected.y, angle: 0, isOnscreen: true }
  }
  // 视口外:从视口中心向对象中心发射线,与边缘内缩矩形求交——先碰到的边即锚点所在边
  const centerX = viewportSize.width / 2
  const centerY = viewportSize.height / 2
  const dx = projected.x - centerX
  const dy = projected.y - centerY
  const angle = Math.atan2(dy, dx)
  const minX = edgeInset
  const maxX = Math.max(edgeInset, viewportSize.width - edgeInset)
  const minY = edgeInset
  const maxY = Math.max(edgeInset, viewportSize.height - edgeInset)
  // 射线参数化:对可行轴取最小缩放倍数(先碰到的边胜出);视口极小时退化为中心点
  let scale = Infinity
  if (dx > 0) scale = Math.min(scale, (maxX - centerX) / dx)
  else if (dx < 0) scale = Math.min(scale, (minX - centerX) / dx)
  if (dy > 0) scale = Math.min(scale, (maxY - centerY) / dy)
  else if (dy < 0) scale = Math.min(scale, (minY - centerY) / dy)
  if (!Number.isFinite(scale) || scale < 0) scale = 0
  return { screenX: centerX + dx * scale, screenY: centerY + dy * scale, angle, isOnscreen: false }
}

/**
 * 由 clamp 后的屏幕锚点反推所属物理边缘:视口外对象的锚点必然贴至少一条边
 * (x 侧优先,角点归横向边缘)。组件层用此分组做同边缘聚合(§4.13 B)。
 */
export function edgePinEdgeForPlacement(
  placement: Pick<EdgePinPlacement, 'screenX' | 'screenY'>,
  viewportSize: SpatialSize,
  edgeInset: number = EDGE_PIN_EDGE_INSET,
): EdgePinEdge {
  const minX = edgeInset
  const maxX = Math.max(edgeInset, viewportSize.width - edgeInset)
  const minY = edgeInset
  const maxY = Math.max(edgeInset, viewportSize.height - edgeInset)
  if (placement.screenX <= minX + .5) return 'left'
  if (placement.screenX >= maxX - .5) return 'right'
  if (placement.screenY <= minY + .5) return 'top'
  if (placement.screenY >= maxY - .5) return 'bottom'
  return 'right'
}
