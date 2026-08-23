import { useEffect, useRef } from 'react'
import { blendGlythPose, glythPose, sampleGlyth, subscribeGlythClock, type GlythFrame, type LcosGlythState, type LcosGlythVariant } from './glythMotion'
import { useReducedSpatialMotion } from './useReducedSpatialMotion'

export type { LcosGlythState, LcosGlythVariant } from './glythMotion'

function renderFrame(svg: SVGSVGElement, frame: GlythFrame) {
  const core = svg.querySelector<SVGRectElement>('[data-glyth-core]')
  const eyes = svg.querySelectorAll<SVGRectElement>('[data-glyth-eye]')
  const shells = svg.querySelectorAll<SVGPathElement>('[data-glyth-shell]')
  if (!core || eyes.length !== 2 || shells.length !== 4) return
  core.setAttribute('x', String(frame.core.x)); core.setAttribute('y', String(frame.core.y)); core.setAttribute('width', String(frame.core.width)); core.setAttribute('height', String(frame.core.height)); core.setAttribute('rx', String(frame.core.radius))
  frame.eyes.forEach((eye, index) => { const node = eyes[index]; node?.setAttribute('x', String(eye.x)); node?.setAttribute('y', String(eye.y)); node?.setAttribute('width', String(eye.width)); node?.setAttribute('height', String(eye.height)) })
  frame.shells.forEach((path, index) => shells[index]?.setAttribute('d', path))
  svg.style.setProperty('--glyth-energy', String(frame.energy))
  svg.style.setProperty('--glyth-shell-opacity', String(.28 + frame.energy * .56))
}

export function LcosGlyth({ state = 'stable', variant = 'cursor', size = 24, className = '', label, animated = true }: {
  readonly state?: LcosGlythState
  readonly variant?: LcosGlythVariant
  readonly size?: number
  readonly className?: string
  readonly label?: string
  readonly animated?: boolean
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const transition = useRef({ from: glythPose(state), to: glythPose(state), startedAt: 0, state })
  const visible = useRef(true)
  const reducedMotion = useReducedSpatialMotion()

  useEffect(() => {
    const node = svgRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => { visible.current = Boolean(entry?.isIntersecting) }, { rootMargin: '80px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const current = transition.current
    if (current.state === state) return
    const now = performance.now() / 1000
    const progress = Math.min(1, Math.max(0, (now - current.startedAt) / .42))
    current.from = blendGlythPose(current.from, current.to, progress)
    current.to = glythPose(state)
    current.startedAt = now
    current.state = state
  }, [state])

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const paint = (seconds: number) => {
      if (!visible.current) return
      const current = transition.current
      const pose = reducedMotion || !animated
        ? current.to
        : blendGlythPose(current.from, current.to, (seconds - current.startedAt) / .42)
      renderFrame(svg, sampleGlyth(pose, variant, reducedMotion || !animated ? 0 : seconds))
    }
    paint(performance.now() / 1000)
    if (reducedMotion || !animated) return
    return subscribeGlythClock(paint)
  }, [animated, reducedMotion, variant])

  return <svg ref={svgRef} className={`lcos-glyth state-${state} variant-${variant} ${reducedMotion ? 'is-reduced-motion' : ''} ${className}`.trim()} data-glyth-state={state} viewBox="0 0 100 100" width={size} height={size} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
    <g className="lcos-glyth-shells" fill="none" stroke="currentColor" strokeLinecap="round">
      <path data-glyth-shell="top"/><path data-glyth-shell="right"/><path data-glyth-shell="bottom"/><path data-glyth-shell="left"/>
    </g>
    <rect data-glyth-core className="lcos-glyth-core" fill="currentColor"/>
    <g className="lcos-glyth-eyes" fill="currentColor"><rect data-glyth-eye="left" rx="2.2"/><rect data-glyth-eye="right" rx="2.2"/></g>
  </svg>
}
