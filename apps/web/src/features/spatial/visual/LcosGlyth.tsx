import { useEffect, useId, useRef, useState } from 'react'
import { blendGlythPose, coerceGlythState, getPointerPosition, glythPose, glythStateDuration, sampleGlyth, subscribeGlythClock, type GlythFrame, type LcosGlythState, type LcosGlythVariant } from './glythMotion'
import { useReducedSpatialMotion } from './useReducedSpatialMotion'

export type { LcosGlythState, LcosGlythVariant } from './glythMotion'

interface GlythElements {
  readonly svg: SVGSVGElement
  readonly body: SVGPathElement | null
  readonly clip: SVGPathElement | null
  readonly eyes: readonly SVGRectElement[]
  readonly segments: readonly SVGRectElement[]
  readonly dots: readonly SVGCircleElement[]
}

function renderFrame(elements: GlythElements, frame: GlythFrame) {
  const { body, clip } = elements
  if (!body || !clip) return
  body.setAttribute('d', frame.body)
  clip.setAttribute('d', frame.body)
  frame.eyes.forEach((eye, index) => {
    const node = elements.eyes[index]
    if (!node) return
    node.setAttribute('x', String(eye.x)); node.setAttribute('y', String(eye.y)); node.setAttribute('width', String(eye.w)); node.setAttribute('height', String(eye.h))
  })
  frame.segments.forEach((segment, index) => {
    const node = elements.segments[index]
    if (!node) return
    node.setAttribute('x', String(segment.x)); node.setAttribute('y', String(segment.y)); node.setAttribute('width', String(segment.w)); node.setAttribute('height', String(segment.h))
    node.setAttribute('transform', `rotate(${segment.rot} ${segment.x + segment.w / 2} ${segment.y + segment.h / 2})`)
    node.style.opacity = String(.35 + segment.lit * .6)
  })
  frame.dots.forEach((dot, index) => {
    const node = elements.dots[index]
    if (!node) return
    node.setAttribute('cx', String(dot.x)); node.setAttribute('cy', String(dot.y)); node.setAttribute('r', String(dot.r))
    node.style.opacity = String(dot.alpha)
  })
  elements.svg.style.setProperty('--glyth-energy', String(frame.energy))
}

const clampRange = (value: number, min = -1, max = 1) => Math.min(max, Math.max(min, value))

/** Gaze target from the shared pointer position; the rect is cached, not measured per frame. */
function computeGazeTarget(svg: SVGSVGElement, rectCache: { current: { x: number; y: number; w: number; at: number } | null }, seconds: number): { x: number; y: number } {
  const pointer = getPointerPosition()
  if (!pointer) return { x: 0, y: 0 }
  let rect = rectCache.current
  if (!rect || seconds - rect.at > .75) {
    const box = svg.getBoundingClientRect()
    rect = { x: box.left + box.width / 2, y: box.top + box.height / 2, w: box.width, at: seconds }
    rectCache.current = rect
  }
  const dx = pointer.x - rect.x
  const dy = pointer.y - rect.y
  const reach = Math.max(60, rect.w * 3)
  const length = Math.hypot(dx, dy)
  const scale = length > reach ? reach / length : 1
  return { x: clampRange((dx * scale) / reach), y: clampRange((dy * scale) / reach) }
}

const MAX_DOTS = 8

export function LcosGlyth({ state = 'stable', variant = 'cursor', size = 24, className = '', label, animated = true }: {
  readonly state?: LcosGlythState
  readonly variant?: LcosGlythVariant
  readonly size?: number
  readonly className?: string
  readonly label?: string
  readonly animated?: boolean
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const elementsRef = useRef<GlythElements | null>(null)
  const transitionRef = useRef({ from: glythPose(coerceGlythState(state)), to: glythPose(coerceGlythState(state)), startedAt: 0, state: coerceGlythState(state) })
  const gazeRef = useRef({ x: 0, y: 0 })
  const rectCacheRef = useRef<{ x: number; y: number; w: number; at: number } | null>(null)
  const blinkRef = useRef({ nextAt: 2.5, start: -1 })
  const lastSecondsRef = useRef(0)
  const visibleRef = useRef(true)
  const reducedMotion = useReducedSpatialMotion()
  const clipId = useId()
  const [displayState, setDisplayState] = useState<LcosGlythState>(() => coerceGlythState(state))

  useEffect(() => {
    const node = svgRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => { visibleRef.current = Boolean(entry?.isIntersecting) }, { rootMargin: '80px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    elementsRef.current = {
      svg,
      body: svg.querySelector<SVGPathElement>('[data-glyth-body]'),
      clip: svg.querySelector<SVGPathElement>('[data-glyth-clip]'),
      eyes: [...svg.querySelectorAll<SVGRectElement>('[data-glyth-eye]')],
      segments: [...svg.querySelectorAll<SVGRectElement>('[data-glyth-segment]')],
      dots: [...svg.querySelectorAll<SVGCircleElement>('[data-glyth-dot]')],
    }
  }, [])

  /** `confirm` is transient by contract: it plays once, then settles back to a persistent stable body. */
  useEffect(() => {
    const next = coerceGlythState(state)
    setDisplayState(next)
    if (next !== 'confirm') return
    const holdMs = (glythStateDuration('confirm') + .45) * 1000
    const timer = window.setTimeout(() => setDisplayState('stable'), holdMs)
    return () => window.clearTimeout(timer)
  }, [state])

  useEffect(() => {
    const current = transitionRef.current
    if (current.state === displayState) return
    const now = performance.now() / 1000
    const progress = Math.min(1, Math.max(0, (now - current.startedAt) / Math.max(.01, current.to.duration)))
    current.from = blendGlythPose(current.from, current.to, progress)
    current.to = glythPose(displayState)
    current.startedAt = now
    current.state = displayState
  }, [displayState])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const paint = (seconds: number) => {
      const elements = elementsRef.current
      if (!visibleRef.current || !elements || !elements.body || !elements.clip || elements.eyes.length !== 2 || elements.segments.length !== 4) return
      const dt = Math.min(.2, Math.max(0, seconds - (lastSecondsRef.current || seconds)))
      lastSecondsRef.current = seconds
      const still = reducedMotion || !animated
      const current = transitionRef.current
      const pose = still ? current.to : blendGlythPose(current.from, current.to, (seconds - current.startedAt) / Math.max(.01, current.to.duration))

      const target = computeGazeTarget(svg, rectCacheRef, seconds)
      const gazeEase = still ? 1 : Math.min(1, dt * 9)
      gazeRef.current.x += (target.x - gazeRef.current.x) * gazeEase
      gazeRef.current.y += (target.y - gazeRef.current.y) * gazeEase

      let blink = 0
      if (!still) {
        const timeline = blinkRef.current
        if (timeline.start < 0 && seconds >= timeline.nextAt) {
          timeline.start = seconds
          timeline.nextAt = seconds + 3 + Math.random() * 4
        }
        if (timeline.start >= 0) {
          const phase = (seconds - timeline.start) / .14
          if (phase >= 1) timeline.start = -1
          else blink = Math.sin(Math.PI * phase)
        }
      }

      renderFrame(elements, sampleGlyth(pose, variant, still ? 0 : seconds, { gaze: gazeRef.current, blink }))
    }
    paint(performance.now() / 1000)
    if (reducedMotion || !animated) return
    return subscribeGlythClock(paint)
  }, [animated, reducedMotion, variant])

  return <svg ref={svgRef} className={`lcos-glyth state-${displayState} variant-${variant} ${reducedMotion ? 'is-reduced-motion' : ''} ${className}`.trim()} data-glyth-state={displayState} viewBox="0 0 100 100" width={size} height={size} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
    <defs><clipPath id={clipId}><path data-glyth-clip="clip"/></clipPath></defs>
    <g className="lcos-glyth-dots">
      {Array.from({ length: MAX_DOTS }, (_, index) => <circle key={index} data-glyth-dot={index} r="0"/>)}
    </g>
    <g className="lcos-glyth-shells">
      {Array.from({ length: 4 }, (_, index) => <rect key={index} data-glyth-segment={index} rx="1.4"/>)}
    </g>
    <path data-glyth-body="body" className="lcos-glyth-core" fill="currentColor"/>
    <g className="lcos-glyth-eyes" fill="currentColor" clipPath={`url(#${clipId})`}><rect data-glyth-eye="left" rx="2.2"/><rect data-glyth-eye="right" rx="2.2"/></g>
  </svg>
}
