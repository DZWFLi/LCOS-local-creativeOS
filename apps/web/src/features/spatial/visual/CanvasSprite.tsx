import { useCallback, useEffect, useRef, useState } from 'react'
import { coerceGlythState, type LcosGlythState } from './glythMotion'
import { LcosGlyth } from './LcosGlyth'

/**
 * Canvas sprite — the one resident Glyth presence on a Spatial Surface.
 *
 * Design contract (2026-08-24, "可拖动的画布精灵"):
 * - ONE large floating sprite per canvas acts as the situation guide.
 * - Canvas-level interaction only (camera pan/zoom, drag, marquee, run state);
 *   it never tracks individual nodes — avatars do that.
 * - The sprite itself is draggable: the user can park it anywhere on the
 *   canvas; the position persists per surface in localStorage.
 * - Avatars are small glyths that sit ON the corner of the object being
 *   touched (selection / agent proposal / running node), like the frozen
 *   three-view reference demo.
 */

export type SpriteMood = 'idle' | 'observing' | 'working' | 'satisfied' | 'alert'

export const MOOD_STATE: Record<SpriteMood, LcosGlythState> = {
  idle: 'stable',
  observing: 'absorb',
  working: 'working',
  satisfied: 'confirm',
  alert: 'error',
}

export interface CanvasSpriteProps {
  /** Surface kind label used for the position memory key and a11y label. */
  readonly surfaceLabel: string
  /** Camera currently moving (pan / zoom). */
  readonly cameraActive?: boolean
  /** A node drag / marquee is in progress. */
  readonly interacting?: boolean
  /** Any run is executing on this surface. */
  readonly running?: boolean
  /** Any failure needs attention on this surface. */
  readonly alert?: boolean
}

const moodFor = ({ cameraActive, interacting, running, alert }: CanvasSpriteProps): SpriteMood => {
  if (alert) return 'alert'
  if (running) return 'working'
  if (interacting) return 'working'
  if (cameraActive) return 'observing'
  return 'idle'
}

export const MOOD_TEXT: Record<SpriteMood, string> = {
  idle: '待命',
  observing: '观察画布',
  working: '正在工作',
  satisfied: '已完成',
  alert: '需要处理',
}

const SPRITE_SIZE = 72
const STORAGE_KEY = 'lcos-canvas-sprite-position:'

interface SpritePosition { readonly left: number; readonly top: number }

function readStoredPosition(surfaceLabel: string): SpritePosition | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY + surfaceLabel)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SpritePosition>
    if (typeof parsed.left !== 'number' || typeof parsed.top !== 'number') return null
    return { left: parsed.left, top: parsed.top }
  } catch { return null }
}

function storePosition(surfaceLabel: string, position: SpritePosition) {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY + surfaceLabel, JSON.stringify(position)) } catch { /* storage unavailable */ }
}

export function CanvasSprite(props: CanvasSpriteProps) {
  const mood = moodFor(props)
  const [hovered, setHovered] = useState(false)
  const [position, setPosition] = useState<SpritePosition | null>(() => readStoredPosition(props.surfaceLabel))
  const dragRef = useRef<{ pointerId: number; grabX: number; grabY: number; baseLeft: number; baseTop: number } | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const hint = MOOD_TEXT[mood]

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const root = rootRef.current
    if (!root) return
    const parent = root.parentElement
    if (!parent) return
    const rootRect = root.getBoundingClientRect()
    const parentRect = parent.getBoundingClientRect()
    const currentLeft = rootRect.left - parentRect.left
    const currentTop = rootRect.top - parentRect.top
    dragRef.current = { pointerId: event.pointerId, grabX: event.clientX, grabY: event.clientY, baseLeft: currentLeft, baseTop: currentTop }
    root.setPointerCapture(event.pointerId)
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const parent = rootRef.current?.parentElement
    if (!parent) return
    const parentRect = parent.getBoundingClientRect()
    // 拖动边界：不许贴边——至少留出自身宽度 + 8px 边距（此处取 16px 更严）。
    // 上界先 Math.max 抬到不低于下界，避免小画布下 min/max 反转把精灵钉出画布形成白色遮挡条。
    const maxX = Math.max(16, parentRect.width - SPRITE_SIZE - 16)
    const maxY = Math.max(16, parentRect.height - SPRITE_SIZE - 16)
    const left = Math.max(16, Math.min(maxX, drag.baseLeft + event.clientX - drag.grabX))
    const top = Math.max(16, Math.min(maxY, drag.baseTop + event.clientY - drag.grabY))
    setPosition({ left, top })
    event.stopPropagation()
  }, [])

  // 脏位置兜底：localStorage 里的历史坐标若让精灵部分出界（窗口缩小 / 分辨率变化 / 旧脏值，
  // 仅容 8px 溢出容差），丢弃并回到 CSS 默认停靠位，避免半出界的白色圆盘贴在画布边缘成遮挡条。
  useEffect(() => {
    if (!position) return
    const parent = rootRef.current?.parentElement
    if (!parent) return
    const parentRect = parent.getBoundingClientRect()
    const offscreen =
      position.left < -8 ||
      position.top < -8 ||
      position.left > parentRect.width - SPRITE_SIZE + 8 ||
      position.top > parentRect.height - SPRITE_SIZE + 8
    if (offscreen) setPosition(null)
  }, [position])

  const onPointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    setPosition((current) => {
      if (current) storePosition(props.surfaceLabel, current)
      return current
    })
    event.stopPropagation()
  }, [props.surfaceLabel])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const cleanup = () => { dragRef.current = null }
    root.addEventListener('pointerup', cleanup as EventListener)
    root.addEventListener('pointercancel', cleanup as EventListener)
    return () => {
      root.removeEventListener('pointerup', cleanup as EventListener)
      root.removeEventListener('pointercancel', cleanup as EventListener)
    }
  }, [])

  return <div
    ref={rootRef}
    className={`lcos-canvas-sprite mood-${mood} ${hovered ? 'is-hovered' : ''} ${dragRef.current ? 'is-dragging' : ''}`}
    data-sprite-surface={props.surfaceLabel}
    style={position ? { left: position.left, top: position.top } : undefined}
    aria-live="polite"
    aria-label={`画布精灵：${hint}`}
    title="拖动可调整位置"
    onPointerEnter={() => setHovered(true)}
    onPointerLeave={() => setHovered(false)}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerEnd}
    onPointerCancel={onPointerEnd}
  >
    <div className="lcos-canvas-sprite-plate">
      <LcosGlyth state={MOOD_STATE[mood]} size={56} variant="soft" label={`画布精灵 ${hint}`}/>
    </div>
    {hovered && <span className="lcos-canvas-sprite-hint">{hint}</span>}
  </div>
}

/**
 * Avatar — a small glyth bound to one object (node / fence / action / proposal),
 * riding ON its corner like the reference demo (negative offset, plate under it).
 * The object renders this only when something is actually happening to it.
 */
export function GlythAvatar({ state, reason, corner = 'tr', size = 26 }: {
  readonly state: string
  readonly reason?: 'selection' | 'proposal' | 'running' | 'review'
  readonly corner?: 'tr' | 'tl'
  readonly size?: number
}) {
  const coerced = coerceGlythState(state)
  return <span className={`lcos-glyth-avatar corner-${corner} ${reason ? `reason-${reason}` : ''}`} data-glyth-reason={reason ?? 'state'} aria-hidden="true">
    <span className="lcos-glyth-avatar-plate">
      <LcosGlyth state={coerced} size={size}/>
    </span>
  </span>
}

/**
 * Camera activity: true while the camera value keeps changing (throttled off
 * after `activeWindowMs` of stillness). Feeds the sprite's observing mood.
 */
export function useCameraActivity(camera: { x: number; y: number; zoom: number }, activeWindowMs = 260): boolean {
  const [active, setActive] = useState(false)
  const timer = useRef<number>(0)
  const last = useRef(camera)
  useEffect(() => {
    const previous = last.current
    last.current = camera
    if (previous.x === camera.x && previous.y === camera.y && previous.zoom === camera.zoom) return
    setActive(true)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setActive(false), activeWindowMs)
    return () => { if (timer.current) window.clearTimeout(timer.current) }
  }, [camera, activeWindowMs])
  return active
}
