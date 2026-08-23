/**
 * LCOS Glyth motion engine — liquid capsule with light-segment shell.
 *
 * Design contract (frozen 2026-08-23 evening round):
 * - Body: liquid capsule (radial profile morph, Bloub-style) — soft, directional.
 * - Shell: four discrete light SEGMENTS in the same digital-bar language as
 *   LightSegment (Nothing-style), replacing the old curve strokes.
 * - Energy: when energy is high the body edge sheds a few matrix dots
 *   (ROG-style), so capsule + segment + matrix read as one fused material.
 * - Seven semantic states; per-state durations; gaze/blink are channels.
 * - `sampleGlyth` stays clock-free: freeze t → golden frame.
 */

export type LcosGlythState = 'stable' | 'working' | 'waiting' | 'error' | 'confirm' | 'absorb' | 'output'
export type LcosGlythVariant = 'balanced' | 'cursor' | 'soft'

export const GLYTH_STATES: readonly LcosGlythState[] = ['stable', 'working', 'waiting', 'error', 'confirm', 'absorb', 'output']

export interface GlythPose {
  readonly scale: number
  readonly stretchX: number
  readonly stretchY: number
  readonly open: number
  readonly shellTilt: number
  readonly eyeScale: number
  readonly eyeGap: number
  readonly energy: number
  readonly speed: number
  readonly wobble: number
  readonly gapAngle: number
  readonly gapWidth: number
  readonly gapDepth: number
  readonly lean: number
  readonly duration: number
  /** Segment shell: 0 = tight capsule-hugging, 1 = fully open digital ring. */
  readonly segmentSpread: number
  /** Matrix dots shed from the edge when energy is high. */
  readonly dotCount: number
}

export interface GlythChannels {
  /** Normalized gaze direction, each component in -1..1. Follows pointer / drag payload. */
  readonly gaze?: { readonly x: number; readonly y: number }
  /** Blink closure 0..1 (1 = fully closed). */
  readonly blink?: number
}

export interface GlythSegment {
  /** Corner-arc path (M…Q…), one per corner: TL / TR / BL / BR. */
  readonly path: string
  readonly lit: number
}

export interface GlythDot {
  readonly x: number
  readonly y: number
  readonly r: number
  readonly alpha: number
}

export interface GlythFrame {
  readonly body: string
  readonly segments: readonly GlythSegment[]
  readonly dots: readonly GlythDot[]
  readonly eyes: readonly [{ readonly x: number; readonly y: number; readonly w: number; readonly h: number }, { readonly x: number; readonly y: number; readonly w: number; readonly h: number }]
  readonly bounds: { readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number }
  readonly energy: number
}

const POSES: Record<LcosGlythState, GlythPose> = {
  stable:  { scale: 1,    stretchX: 1.18, stretchY: 1,    open: .22, shellTilt: 0,  eyeScale: 1,    eyeGap: 7.2, energy: .42, speed: .6,  wobble: .016, gapAngle: 0, gapWidth: 0,    gapDepth: 0,   lean: 0,   duration: .5,  segmentSpread: .3,  dotCount: 0 },
  working: { scale: .98,  stretchX: 1.22, stretchY: 1.02, open: .48, shellTilt: 4,  eyeScale: 1.04, eyeGap: 7.2, energy: .85, speed: 1.7, wobble: .055, gapAngle: 0, gapWidth: 0,    gapDepth: 0,   lean: 1.5, duration: .45, segmentSpread: .62, dotCount: 6 },
  waiting: { scale: .95,  stretchX: 1.16, stretchY: 1,    open: .66, shellTilt: -1, eyeScale: .74,  eyeGap: 7.6, energy: .55, speed: .4,  wobble: .012, gapAngle: 0, gapWidth: 1.15, gapDepth: .5,  lean: 1,   duration: .5,  segmentSpread: .82, dotCount: 0 },
  error:   { scale: .94,  stretchX: 1.34, stretchY: .9,   open: .78, shellTilt: 12, eyeScale: .6,   eyeGap: 8.2, energy: .9,  speed: 2.4, wobble: .07,  gapAngle: 0, gapWidth: .42,  gapDepth: .78, lean: -1,  duration: .28, segmentSpread: .95, dotCount: 8 },
  confirm: { scale: .9,   stretchX: 1.12, stretchY: .97,  open: .12, shellTilt: 0,  eyeScale: .88,  eyeGap: 7,   energy: .3,  speed: .8,  wobble: .008, gapAngle: 0, gapWidth: 0,    gapDepth: 0,   lean: 0,   duration: .36, segmentSpread: .1,  dotCount: 0 },
  absorb:  { scale: .93,  stretchX: 1.12, stretchY: .97,  open: .4,  shellTilt: -3, eyeScale: 1.06, eyeGap: 7,   energy: .72, speed: .95, wobble: .03,  gapAngle: 0, gapWidth: .8,   gapDepth: .4,  lean: 2,   duration: .42, segmentSpread: .5,  dotCount: 5 },
  output:  { scale: 1,    stretchX: 1.44, stretchY: .9,   open: .5,  shellTilt: 2,  eyeScale: 1.02, eyeGap: 7.2, energy: .85, speed: 1.3, wobble: .02,  gapAngle: 0, gapWidth: 0,    gapDepth: 0,   lean: 3.5, duration: .4,  segmentSpread: .7,  dotCount: 7 },
}

const VARIANTS: Record<LcosGlythVariant, { readonly baseW: number; readonly baseH: number; readonly softness: number; readonly shellLen: number }> = {
  balanced: { baseW: 22, baseH: 17.5, softness: .5, shellLen: 13 },
  cursor: { baseW: 24, baseH: 17, softness: .42, shellLen: 12 },
  soft: { baseW: 22, baseH: 18, softness: .8, shellLen: 14 },
}

const RADIAL_COUNT = 24
const TWO_PI = Math.PI * 2

const mix = (a: number, b: number, amount: number) => a + (b - a) * amount
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
export const easeOutQuint = (value: number) => 1 - Math.pow(1 - clamp(value), 5)

/** Legacy states map onto the frozen seven on load; the mapping is never written back. */
export function coerceGlythState(raw: string): LcosGlythState {
  if ((GLYTH_STATES as readonly string[]).includes(raw)) return raw as LcosGlythState
  if (raw === 'focus' || raw === 'candidate') return 'working'
  if (raw === 'blocked') return 'error'
  return 'stable'
}

export function glythPose(state: LcosGlythState): GlythPose { return POSES[state] }

export function glythStateDuration(state: LcosGlythState): number { return POSES[state].duration }

export function blendGlythPose(from: GlythPose, to: GlythPose, amount: number): GlythPose {
  const t = easeOutQuint(amount)
  const gapAngle = to.gapDepth > from.gapDepth ? to.gapAngle : from.gapAngle
  return {
    scale: mix(from.scale, to.scale, t), stretchX: mix(from.stretchX, to.stretchX, t), stretchY: mix(from.stretchY, to.stretchY, t),
    open: mix(from.open, to.open, t), shellTilt: mix(from.shellTilt, to.shellTilt, t),
    eyeScale: mix(from.eyeScale, to.eyeScale, t), eyeGap: mix(from.eyeGap, to.eyeGap, t),
    energy: mix(from.energy, to.energy, t), speed: mix(from.speed, to.speed, t),
    wobble: mix(from.wobble, to.wobble, t),
    gapAngle, gapWidth: mix(from.gapWidth, to.gapWidth, t), gapDepth: mix(from.gapDepth, to.gapDepth, t),
    lean: mix(from.lean, to.lean, t), duration: mix(from.duration, to.duration, t),
    segmentSpread: mix(from.segmentSpread, to.segmentSpread, t), dotCount: Math.round(mix(from.dotCount, to.dotCount, t)),
  }
}

const smoothstep = (u: number) => u * u * (3 - 2 * u)

/** Angular distance wrapped to [0, π]. */
function angularDistance(a: number, b: number): number {
  const diff = Math.abs(((a - b) % TWO_PI + TWO_PI) % TWO_PI)
  return diff > Math.PI ? TWO_PI - diff : diff
}

/**
 * Radial profile of the body at `angle` (0 = front / +x). Exported so golden-frame
 * tests can assert the notch (waiting / error / absorb) numerically.
 */
export function glythRadiusAt(pose: GlythPose, angle: number, timeSeconds: number): number {
  const flow = pose.speed * 2.1
  const organic = 1 + pose.wobble * Math.sin(3 * angle + timeSeconds * flow) + pose.wobble * .6 * Math.sin(5 * angle - timeSeconds * flow * 1.7)
  const breath = 1 + pose.energy * .035 * Math.sin(timeSeconds * Math.PI * pose.speed)
  let notch = 1
  if (pose.gapDepth > 0 && pose.gapWidth > 0) {
    const half = pose.gapWidth / 2
    const distance = angularDistance(angle, pose.gapAngle)
    if (distance < half) notch = 1 - pose.gapDepth * smoothstep(1 - distance / half)
  }
  return organic * breath * notch
}

interface BodyPoint { readonly x: number; readonly y: number }

function bodyOutline(pose: GlythPose, variant: LcosGlythVariant, timeSeconds: number, gazeX: number): BodyPoint[] {
  const skin = VARIANTS[variant]
  const n = 2.6 + skin.softness * 2.2
  const gazeLean = gazeX * 1.6
  const points: BodyPoint[] = []
  for (let index = 0; index < RADIAL_COUNT; index += 1) {
    const angle = (index / RADIAL_COUNT) * TWO_PI
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const sx = Math.sign(cos) * Math.pow(Math.abs(cos), 2 / n)
    const sy = Math.sign(sin) * Math.pow(Math.abs(sin), 2 / n)
    const radius = glythRadiusAt(pose, angle, timeSeconds)
    points.push({
      x: 50 + pose.lean + gazeLean + skin.baseW * sx * pose.stretchX * pose.scale * radius,
      y: 50 + skin.baseH * sy * pose.stretchY * pose.scale * radius,
    })
  }
  return points
}

/** Closed Catmull-Rom spline through the radial samples → one liquid contour path. */
function closedSplinePath(points: readonly BodyPoint[]): string {
  const count = points.length
  const at = (index: number) => points[(index + count) % count]
  let path = `M${at(0).x.toFixed(2)} ${at(0).y.toFixed(2)}`
  for (let index = 0; index < count; index += 1) {
    const p0 = at(index - 1)
    const p1 = at(index)
    const p2 = at(index + 1)
    const p3 = at(index + 2)
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    path += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return `${path} Z`
}

const n2 = (value: number) => Number(value.toFixed(2))

/**
 * Segment shell: four asymmetric CORNER ARCS (TL/TR/BL/BR corner brackets),
 * matching the frozen three-view reference geometry. `spread` pushes them off
 * the body; waiting hides the front (TR) arc = open mouth; error tears the
 * diagonal arcs. `lit` carries the energy pulse so they breathe with the body.
 */
function segmentShell(pose: GlythPose, variant: LcosGlythVariant, timeSeconds: number, bounds: { minX: number; minY: number; maxX: number; maxY: number }): GlythSegment[] {
  const skin = VARIANTS[variant]
  const sp = 2.5 + pose.segmentSpread * 9 + pose.open * 3
  const len = skin.shellLen * (1 + pose.segmentSpread * .25)
  const tilt = pose.shellTilt
  const breath = .5 + .5 * Math.sin(timeSeconds * Math.PI * pose.speed)
  const lit = clamp(.45 + pose.energy * .4 + breath * .15)
  const minX = bounds.minX, maxX = bounds.maxX, minY = bounds.minY, maxY = bounds.maxY
  // Corner brackets hugging each corner; asymmetric: top arcs shorter, tilt twists TR/BR.
  const arcs = [
    // TL: from left edge going up to top
    `M${n2(minX - sp)} ${n2(minY + len)} Q${n2(minX - sp)} ${n2(minY - sp)} ${n2(minX + len * .7)} ${n2(minY - sp)}`,
    // TR: from top going right — hidden in waiting (front gap)
    `M${n2(maxX - len * .7)} ${n2(minY - sp - tilt * .08)} Q${n2(maxX + sp)} ${n2(minY - sp + tilt * .12)} ${n2(maxX + sp)} ${n2(minY + len - tilt * .08)}`,
    // BL: from bottom going left
    `M${n2(minX - sp)} ${n2(maxY - len)} Q${n2(minX - sp)} ${n2(maxY + sp)} ${n2(minX + len * .7)} ${n2(maxY + sp)}`,
    // BR: from right edge going down
    `M${n2(maxX + sp)} ${n2(maxY - len + tilt * .08)} Q${n2(maxX + sp)} ${n2(maxY + sp - tilt * .12)} ${n2(maxX - len * .7)} ${n2(maxY + sp)}`,
  ]
  return arcs.map((path, index) => ({
    path,
    // waiting: hide TR (front) = clear opening. error: dim the TL+BR diagonal.
    lit: n2(pose.gapDepth > 0 && pose.gapWidth > 1 && index === 1
      ? 0
      : pose.gapDepth > .6 && (index === 0 || index === 3)
        ? lit * .18
        : lit),
  }))
}

/** Matrix dots shed from the capsule edge when the pose carries energy. */
function shedDots(pose: GlythPose, timeSeconds: number, outline: readonly BodyPoint[]): GlythDot[] {
  if (pose.dotCount <= 0) return []
  const dots: GlythDot[] = []
  const step = Math.max(1, Math.floor(RADIAL_COUNT / pose.dotCount))
  for (let index = 0; index < pose.dotCount; index += 1) {
    const anchor = outline[(index * step + 3) % RADIAL_COUNT]
    const phase = (timeSeconds * pose.speed * 1.4 + index * .37) % 1
    const travel = 2.5 + phase * 5.5
    const alpha = clamp(1 - phase) * .8
    dots.push({ x: n2(anchor.x + (anchor.x - 50) * .08 * travel), y: n2(anchor.y + (anchor.y - 50) * .08 * travel), r: n2(1.1 + phase * .7), alpha: n2(alpha) })
  }
  return dots
}

export function sampleGlyth(pose: GlythPose, variant: LcosGlythVariant, timeSeconds: number, channels: GlythChannels = {}): GlythFrame {
  const gaze = channels.gaze ?? { x: 0, y: 0 }
  const blink = clamp(channels.blink ?? 0)
  const outline = bodyOutline(pose, variant, timeSeconds, clamp(gaze.x, -1, 1))
  const body = closedSplinePath(outline)

  const xs = outline.map((point) => point.x)
  const ys = outline.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const bounds = { minX: n2(minX), minY: n2(minY), maxX: n2(maxX), maxY: n2(maxY) }

  const gazeOffsetX = clamp(gaze.x, -1, 1) * 4.2
  const gazeOffsetY = clamp(gaze.y, -1, 1) * 3.2
  const eyeWidth = 3.6 * pose.eyeScale
  const eyeHeight = Math.max(1, 12.5 * pose.eyeScale * (1 - blink))
  const eyeCenterX = 50 + pose.lean + gazeOffsetX
  const eyeCenterY = 50 + gazeOffsetY
  const eyes = [
    { x: n2(eyeCenterX - pose.eyeGap - eyeWidth / 2), y: n2(eyeCenterY - eyeHeight / 2), w: n2(eyeWidth), h: n2(eyeHeight) },
    { x: n2(eyeCenterX + pose.eyeGap - eyeWidth / 2), y: n2(eyeCenterY - eyeHeight / 2), w: n2(eyeWidth), h: n2(eyeHeight) },
  ] as const

  return {
    body,
    segments: segmentShell(pose, variant, timeSeconds, { minX, minY, maxX, maxY }),
    dots: shedDots(pose, timeSeconds, outline),
    eyes,
    bounds,
    energy: clamp(pose.energy, .2, 1),
  }
}

type ClockSubscriber = (seconds: number) => void
const subscribers = new Set<ClockSubscriber>()
let animationFrame = 0
let lastFrame = 0

function tick(now: number) {
  animationFrame = requestAnimationFrame(tick)
  if (document.visibilityState !== 'visible' || now - lastFrame < 32) return
  lastFrame = now
  const seconds = now / 1000
  subscribers.forEach((subscriber) => subscriber(seconds))
}

export function subscribeGlythClock(subscriber: ClockSubscriber): () => void {
  subscribers.add(subscriber)
  if (!animationFrame) animationFrame = requestAnimationFrame(tick)
  return () => {
    subscribers.delete(subscriber)
    if (!subscribers.size && animationFrame) { cancelAnimationFrame(animationFrame); animationFrame = 0; lastFrame = 0 }
  }
}

/** One shared pointer tracker: N glyth instances never install N window listeners. */
export interface PointerPosition { readonly x: number; readonly y: number }

const pointerListeners = new Set<(position: PointerPosition) => void>()
let pointerPosition: PointerPosition | null = null
let pointerListenerAttached = false

function handlePointerMove(event: PointerEvent) {
  pointerPosition = { x: event.clientX, y: event.clientY }
  pointerListeners.forEach((listener) => listener(pointerPosition as PointerPosition))
}

export function subscribePointerPosition(listener: (position: PointerPosition) => void): () => void {
  if (!pointerListenerAttached && typeof window !== 'undefined') {
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    pointerListenerAttached = true
  }
  pointerListeners.add(listener)
  return () => {
    pointerListeners.delete(listener)
    if (!pointerListeners.size && pointerListenerAttached && typeof window !== 'undefined') {
      window.removeEventListener('pointermove', handlePointerMove)
      pointerListenerAttached = false
    }
  }
}

/** Null until the pointer actually moves: a cold UI must not stare at the top-left corner. */
export function getPointerPosition(): PointerPosition | null { return pointerPosition }
