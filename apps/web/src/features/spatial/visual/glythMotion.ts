export type LcosGlythState = 'stable' | 'focus' | 'working' | 'waiting' | 'blocked' | 'protected' | 'candidate'
export type LcosGlythVariant = 'balanced' | 'cursor' | 'soft'

export interface GlythPose {
  readonly open: number
  readonly lean: number
  readonly stretch: number
  readonly coreScale: number
  readonly eyeScale: number
  readonly shellTilt: number
  readonly energy: number
  readonly speed: number
}

export interface GlythFrame {
  readonly core: { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly radius: number }
  readonly eyes: readonly [{ readonly x: number; readonly y: number; readonly width: number; readonly height: number }, { readonly x: number; readonly y: number; readonly width: number; readonly height: number }]
  readonly shells: readonly [string, string, string, string]
  readonly energy: number
}

const POSES: Record<LcosGlythState, GlythPose> = {
  stable: { open: .22, lean: 0, stretch: 1, coreScale: 1, eyeScale: 1, shellTilt: 0, energy: .46, speed: .65 },
  focus: { open: .32, lean: 3.5, stretch: 1.04, coreScale: 1.02, eyeScale: 1.08, shellTilt: 2, energy: .72, speed: .9 },
  working: { open: .48, lean: 5, stretch: 1.13, coreScale: .96, eyeScale: 1.02, shellTilt: 4, energy: .82, speed: 1.65 },
  waiting: { open: .66, lean: 1.5, stretch: 1.01, coreScale: .94, eyeScale: .72, shellTilt: -1, energy: .64, speed: .45 },
  blocked: { open: .78, lean: -1, stretch: .92, coreScale: .9, eyeScale: .55, shellTilt: 14, energy: .88, speed: .25 },
  protected: { open: .12, lean: 0, stretch: .98, coreScale: .96, eyeScale: .86, shellTilt: 0, energy: .62, speed: .35 },
  candidate: { open: .4, lean: 2.5, stretch: 1.06, coreScale: .98, eyeScale: 1, shellTilt: -3, energy: .68, speed: .8 },
}

const VARIANTS: Record<LcosGlythVariant, { readonly bodyWidth: number; readonly bodyHeight: number; readonly shellLength: number; readonly softness: number }> = {
  balanced: { bodyWidth: 42, bodyHeight: 37, shellLength: 20, softness: .5 },
  cursor: { bodyWidth: 45, bodyHeight: 37, shellLength: 18, softness: .42 },
  soft: { bodyWidth: 42, bodyHeight: 38, shellLength: 22, softness: .78 },
}

const mix = (a: number, b: number, amount: number) => a + (b - a) * amount
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
export const easeOutQuint = (value: number) => 1 - Math.pow(1 - clamp(value), 5)

export function blendGlythPose(from: GlythPose, to: GlythPose, amount: number): GlythPose {
  const t = easeOutQuint(amount)
  return {
    open: mix(from.open, to.open, t), lean: mix(from.lean, to.lean, t), stretch: mix(from.stretch, to.stretch, t),
    coreScale: mix(from.coreScale, to.coreScale, t), eyeScale: mix(from.eyeScale, to.eyeScale, t),
    shellTilt: mix(from.shellTilt, to.shellTilt, t), energy: mix(from.energy, to.energy, t), speed: mix(from.speed, to.speed, t),
  }
}

export function glythPose(state: LcosGlythState): GlythPose { return POSES[state] }

const n = (value: number) => Number(value.toFixed(2))

export function sampleGlyth(pose: GlythPose, variant: LcosGlythVariant, timeSeconds: number): GlythFrame {
  const skin = VARIANTS[variant]
  const breath = Math.sin(timeSeconds * Math.PI * pose.speed) * (1.15 + skin.softness * 1.25) * pose.energy
  const width = skin.bodyWidth * pose.stretch * pose.coreScale + breath * .45
  const height = skin.bodyHeight * pose.coreScale + breath * .3
  const cx = 50 + pose.lean + breath * .08
  const cy = 50 + breath * .12
  const radius = 9.5 + skin.softness * 2.5 + breath * .06
  const eyeWidth = 3.6 * pose.eyeScale
  const eyeHeight = 12.5 * pose.eyeScale
  const eyeGap = 7.2 + pose.lean * .08
  const eyeY = cy - eyeHeight / 2
  const spread = 4.5 + pose.open * 11 + breath * .12
  const half = skin.shellLength / 2
  const curve = 2.2 + skin.softness * 3.2
  const tilt = pose.shellTilt
  const topY = cy - height / 2 - spread
  const bottomY = cy + height / 2 + spread
  const leftX = cx - width / 2 - spread
  const rightX = cx + width / 2 + spread
  const shells = [
    `M${n(cx - half - tilt * .12)} ${n(topY + tilt * .08)} Q${n(cx)} ${n(topY - curve)} ${n(cx + half + tilt * .12)} ${n(topY - tilt * .08)}`,
    `M${n(rightX - tilt * .08)} ${n(cy - half - tilt * .12)} Q${n(rightX + curve)} ${n(cy)} ${n(rightX + tilt * .08)} ${n(cy + half + tilt * .12)}`,
    `M${n(cx + half + tilt * .12)} ${n(bottomY - tilt * .08)} Q${n(cx)} ${n(bottomY + curve)} ${n(cx - half - tilt * .12)} ${n(bottomY + tilt * .08)}`,
    `M${n(leftX + tilt * .08)} ${n(cy + half + tilt * .12)} Q${n(leftX - curve)} ${n(cy)} ${n(leftX - tilt * .08)} ${n(cy - half - tilt * .12)}`,
  ] as const
  return {
    core: { x: n(cx - width / 2), y: n(cy - height / 2), width: n(width), height: n(height), radius: n(radius) },
    eyes: [
      { x: n(cx - eyeGap - eyeWidth / 2), y: n(eyeY), width: n(eyeWidth), height: n(eyeHeight) },
      { x: n(cx + eyeGap - eyeWidth / 2), y: n(eyeY), width: n(eyeWidth), height: n(eyeHeight) },
    ],
    shells, energy: clamp(pose.energy + breath * .015, .2, 1),
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
