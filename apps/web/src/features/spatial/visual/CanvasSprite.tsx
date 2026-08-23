import { useEffect, useMemo, useRef, useState } from 'react'
import { coerceGlythState, subscribePointerPosition, type LcosGlythState } from './glythMotion'
import { LcosGlyth } from './LcosGlyth'

/**
 * Canvas sprite — the one resident Glyth presence on a Spatial Surface.
 *
 * Design contract (2026-08-23, "分身的画布精灵"):
 * - ONE large floating sprite per canvas acts as the situation guide.
 * - Canvas-level interaction only (camera pan/zoom, drag, marquee, run state);
 *   it never tracks individual nodes — avatars do that.
 * - Avatars are small glyths that live on the object being touched (selection /
 *   agent proposal / running node). They are rendered by the object itself.
 */

export type SpriteMood = 'idle' | 'observing' | 'working' | 'satisfied' | 'alert'

const MOOD_STATE: Record<SpriteMood, LcosGlythState> = {
  idle: 'stable',
  observing: 'absorb',
  working: 'working',
  satisfied: 'confirm',
  alert: 'error',
}

export interface CanvasSpriteProps {
  /** Surface kind label shown under the sprite. */
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

const MOOD_TEXT: Record<SpriteMood, string> = {
  idle: '待命',
  observing: '观察画布',
  working: '正在工作',
  satisfied: '已完成',
  alert: '需要处理',
}

export function CanvasSprite(props: CanvasSpriteProps) {
  const mood = moodFor(props)
  const [hovered, setHovered] = useState(false)
  const hint = useMemo(() => MOOD_TEXT[mood], [mood])

  return <div
    className={`lcos-canvas-sprite mood-${mood} ${hovered ? 'is-hovered' : ''}`}
    data-sprite-surface={props.surfaceLabel}
    aria-live="polite"
    aria-label={`画布精灵：${hint}`}
    onPointerEnter={() => setHovered(true)}
    onPointerLeave={() => setHovered(false)}
  >
    <LcosGlyth state={MOOD_STATE[mood]} size={56} variant="soft" label={`画布精灵 ${hint}`}/>
    {hovered && <span className="lcos-canvas-sprite-hint">{hint}</span>}
  </div>
}

/**
 * Avatar — a small glyth bound to one object (node / fence / action / proposal).
 * The object itself renders this when something is happening to it:
 * selection, agent proposal, or an active run. Nothing else shows a glyth.
 */
export function GlythAvatar({ state, reason, size = 22 }: {
  readonly state: string
  readonly reason?: 'selection' | 'proposal' | 'running' | 'review'
  readonly size?: number
}) {
  const coerced = coerceGlythState(state)
  return <span className={`lcos-glyth-avatar ${reason ? `reason-${reason}` : ''}`} data-glyth-reason={reason ?? 'state'} aria-hidden="true">
    <LcosGlyth state={coerced} size={size}/>
  </span>
}

/**
 * Convenience hook powering camera-reactive sprite positioning data.
 * The sprite floats in screen space near the canvas corner; this hook only
 * exposes whether the camera is currently in motion (throttled).
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

/** Pointer proximity in screen space — lets the sprite glance at the cursor when idle. */
export function usePointerNearby(enabled: boolean): boolean {
  const [nearby, setNearby] = useState(false)
  useEffect(() => {
    if (!enabled) return
    return subscribePointerPosition(() => setNearby(true))
  }, [enabled])
  return nearby
}
