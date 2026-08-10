import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { CSSProperties, DragEvent, PointerEvent as ReactPointerEvent, ReactNode, WheelEvent } from 'react'
import type { Camera } from '../../model'
import { applySpatialWheelGesture, spatialScreenToWorld } from './spatialCamera'
import { spatialDensityForSize } from './spatialLod'
import { advanceSpatialPan, beginSpatialPan, endSpatialPointer } from './spatialInteractionMachine'
import { SpatialOverlayLayer } from './SpatialOverlayLayer'
import { SpatialViewport } from './SpatialViewport'
import { IDLE_SPATIAL_POINTER, type SpatialCameraSetter, type SpatialPoint, type SpatialPointerSession } from './spatialTypes'

export interface SpatialPointerContext {
  event: ReactPointerEvent<HTMLDivElement>
  rect: DOMRect
  world: SpatialPoint
}

interface Props {
  camera: Camera
  setCamera: SpatialCameraSetter
  children: ReactNode
  overlays?: ReactNode
  className?: string
  worldClassName?: string
  worldTestId?: string
  worldStyle?: CSSProperties
  style?: CSSProperties
  disabled?: boolean
  tabIndex?: number
  testId?: string
  ariaBusy?: boolean
  nodeCount?: number
  edgeCount?: number
  locked?: boolean
  onPointerDown?: (context: SpatialPointerContext) => void
  onPointerMove?: (context: SpatialPointerContext) => void
  onPointerUp?: (context: SpatialPointerContext) => void
  onPointerCancel?: (context: SpatialPointerContext) => void
  onPointerWorldChange?: (point: SpatialPoint) => void
  onFilesDropped?: (files: File[], point: SpatialPoint) => void
  onPanningChange?: (active: boolean) => void
}

/**
 * Shared camera/transform shell for Arrange, Context and Workflow.
 * Domain-specific node drag, relation editing and presentation commits stay in adapters.
 */
export const SpatialCanvas = forwardRef<HTMLDivElement, Props>(function SpatialCanvas({
  camera,
  setCamera,
  children,
  overlays,
  className = '',
  worldClassName = '',
  worldTestId,
  worldStyle,
  style,
  disabled = false,
  tabIndex = -1,
  testId,
  ariaBusy,
  nodeCount,
  edgeCount,
  locked,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onPointerWorldChange,
  onFilesDropped,
  onPanningChange,
}, forwardedRef) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const wheelHandlerRef = useRef<(event: globalThis.WheelEvent) => void>(() => {})
  const pointerSession = useRef<SpatialPointerSession>(IDLE_SPATIAL_POINTER)
  const wheelFrame = useRef<number | null>(null)
  const wheelPan = useRef({ x: 0, y: 0 })
  const wheelZoom = useRef<{ deltaY: number; anchorX: number; anchorY: number; precision: boolean } | null>(null)
  const [panning, setPanning] = useState(false)
  const [size, setSize] = useState({ width: 1440, height: 900 })

  useImperativeHandle(forwardedRef, () => rootRef.current as HTMLDivElement)

  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof ResizeObserver === 'undefined') return
    const update = () => setSize({ width: root.clientWidth || 1, height: root.clientHeight || 1 })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => () => {
    if (wheelFrame.current !== null) cancelAnimationFrame(wheelFrame.current)
  }, [])

  useEffect(() => {
    if (!disabled) return
    pointerSession.current = endSpatialPointer()
    setPanning(false)
    onPanningChange?.(false)
  }, [disabled, onPanningChange])

  const scheduleWheel = () => {
    if (wheelFrame.current !== null) return
    wheelFrame.current = requestAnimationFrame(() => {
      wheelFrame.current = null
      const panDelta = wheelPan.current
      const zoomGesture = wheelZoom.current
      wheelPan.current = { x: 0, y: 0 }
      wheelZoom.current = null
      setCamera((current) => {
        let next = applySpatialWheelGesture(current, { deltaX: panDelta.x, deltaY: panDelta.y, zoom: false, anchorX: 0, anchorY: 0 })
        if (zoomGesture) next = applySpatialWheelGesture(next, { deltaX: 0, deltaY: zoomGesture.deltaY, zoom: true, anchorX: zoomGesture.anchorX, anchorY: zoomGesture.anchorY, precision: zoomGesture.precision })
        return next
      })
    })
  }

  const contextFor = (event: ReactPointerEvent<HTMLDivElement>): SpatialPointerContext => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { event, rect, world: spatialScreenToWorld(event.clientX, event.clientY, rect, camera) }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) { event.preventDefault(); event.stopPropagation(); return }
    if (event.button === 1) {
      event.preventDefault()
      pointerSession.current = beginSpatialPan(event.pointerId, { x: event.clientX, y: event.clientY }, camera)
      setPanning(true)
      onPanningChange?.(true)
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    onPointerDown?.(contextFor(event))
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) { event.preventDefault(); event.stopPropagation(); return }
    const context = contextFor(event)
    onPointerWorldChange?.(context.world)
    const nextCamera = advanceSpatialPan(pointerSession.current, { x: event.clientX, y: event.clientY })
    if (nextCamera) {
      setCamera(nextCamera)
      return
    }
    onPointerMove?.(context)
  }

  const finishPan = (event: ReactPointerEvent<HTMLDivElement>): boolean => {
    if (pointerSession.current.kind !== 'pan') return false
    pointerSession.current = endSpatialPointer()
    setPanning(false)
    onPanningChange?.(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    return true
  }

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (disabled) { event.stopPropagation(); return }
    const rect = event.currentTarget.getBoundingClientRect()
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1
    if (event.ctrlKey || event.metaKey) {
      const current = wheelZoom.current
      wheelZoom.current = { deltaY: (current?.deltaY ?? 0) + event.deltaY * unit, anchorX: event.clientX - rect.left, anchorY: event.clientY - rect.top, precision: event.shiftKey }
    } else {
      wheelPan.current = { x: wheelPan.current.x + event.deltaX * unit, y: wheelPan.current.y + event.deltaY * unit }
    }
    scheduleWheel()
  }

  // React onWheel 是 passive 监听，preventDefault 会被拒绝并触发控制台警告；
  // 改为原生 non-passive wheel 监听，保证缩放时能正确拦截页面滚动。
  wheelHandlerRef.current = (event: globalThis.WheelEvent) => {
    handleWheel(event as unknown as WheelEvent<HTMLDivElement>)
  }
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onWheel = (event: globalThis.WheelEvent) => wheelHandlerRef.current(event)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!onFilesDropped) return
    const files = [...event.dataTransfer.files]
    if (!files.length) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    onFilesDropped(files, spatialScreenToWorld(event.clientX, event.clientY, rect, camera))
  }

  const density = spatialDensityForSize(size)

  return <div
    ref={rootRef}
    data-testid={testId}
    data-spatial-canvas="true"
    data-spatial-density={density}
    data-camera-x={camera.x}
    data-camera-y={camera.y}
    data-camera-zoom={camera.zoom}
    data-node-count={nodeCount}
    data-edge-count={edgeCount}
    data-locked={locked || undefined}
    tabIndex={tabIndex}
    aria-busy={ariaBusy || undefined}
    className={`lcos-spatial-canvas ${className} ${panning ? 'panning' : ''}`.trim()}
    style={style}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={(event) => { if (!finishPan(event)) onPointerUp?.(contextFor(event)) }}
    onPointerCancel={(event) => { if (!finishPan(event)) onPointerCancel?.(contextFor(event)) }}
    onDragOver={(event) => { if (onFilesDropped && event.dataTransfer.types.includes('Files')) event.preventDefault() }}
    onDrop={handleDrop}
  >
    <SpatialViewport camera={camera} className={worldClassName} testId={worldTestId} style={worldStyle}>{children}</SpatialViewport>
    {overlays !== undefined && <SpatialOverlayLayer>{overlays}</SpatialOverlayLayer>}
  </div>
})
