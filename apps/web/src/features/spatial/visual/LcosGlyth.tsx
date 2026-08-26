import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { NOTIF_BLUE, type DotRender } from './bloub/decor'
import { createGlythEngine, GLYTH_TO_BLOUB, glythStateDuration, pointerToLook, type BotEngine, type BotFrame, type Look } from './glythBloub'
import { coerceGlythState, getPointerPosition, subscribeGlythClock, type LcosGlythState } from './glythMotion'
import { useReducedSpatialMotion } from './useReducedSpatialMotion'

export type { LcosGlythState } from './glythMotion'

/** 引擎比例：viewBox 100×100、原点平移到 (50,50)；彗尾/环最大 1.4×30=42 < 50。 */
const GLYTH_SCALE = 30
/** 点位池上限：bloub 各状态最多 4 个点（burst 粒子），过渡叠加 ≤ 6，留余量。 */
const MAX_DOTS = 8
/** 弧线池上限：comet 4 条彗尾，过渡叠加留余量。 */
const MAX_ARCS = 8
const MAX_EYES = 2

/** 一个点位槽：普通圆点与带形状的点（alert 的 "!" 圆点是一个泪滴 path）二选一显示。 */
interface DotSlot {
  readonly circle: SVGCircleElement
  readonly path: SVGPathElement
}

/** 一条弧线槽：渐变（含 3 个 stop）+ 被身体遮挡的 back 段 + 盖在身体前的 front 段。 */
interface ArcSlot {
  readonly gradient: SVGLinearGradientElement
  readonly stops: readonly SVGStopElement[]
  readonly back: SVGPathElement
  readonly front: SVGPathElement
}

interface GlythElements {
  readonly svg: SVGSVGElement
  readonly body: SVGPathElement
  readonly eyes: readonly SVGPathElement[]
  readonly dotsBehind: readonly DotSlot[]
  readonly dotsFront: readonly DotSlot[]
  readonly arcs: readonly ArcSlot[]
  readonly notch: SVGCircleElement
  readonly notif: SVGCircleElement
}

const show = (node: SVGElement) => { node.style.display = '' }
const hide = (node: SVGElement) => { node.style.display = 'none' }

function paintDotSlots(slots: readonly DotSlot[], dots: readonly DotRender[], scale: number) {
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index]!
    const dot = dots[index]
    if (!dot) { hide(slot.circle); hide(slot.path); continue }
    if (dot.d) {
      // 形状点：d 以球半径为单位、以原点为中心，用 translate/rotate/scale 摆位
      slot.path.setAttribute('d', dot.d)
      slot.path.setAttribute('transform', `translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${scale})`)
      slot.path.style.opacity = String(dot.opacity)
      hide(slot.circle)
      show(slot.path)
    } else {
      slot.circle.setAttribute('cx', String(dot.x))
      slot.circle.setAttribute('cy', String(dot.y))
      slot.circle.setAttribute('r', String(dot.r))
      slot.circle.style.opacity = String(dot.opacity)
      hide(slot.path)
      show(slot.circle)
    }
  }
}

function clearDotSlots(slots: readonly DotSlot[]) {
  for (const slot of slots) { hide(slot.circle); hide(slot.path) }
}

/**
 * 每帧把 BotFrame 写进 DOM。渲染顺序即 bloub 的遮挡语义：
 * 后层点（dotsBehind）→ 弧 back 段 → 身体 → 双眼 → 前层点 → 弧 front 段 →
 * 缺口（身体色圆盘）→ 通知徽章（蓝）。
 */
function renderFrame(elements: GlythElements, frame: BotFrame, scale: number) {
  elements.body.setAttribute('d', frame.bodyPath)
  elements.body.style.opacity = String(frame.bodyAlpha)

  for (let index = 0; index < elements.eyes.length; index += 1) {
    const node = elements.eyes[index]!
    const eye = frame.eyes[index]
    if (!eye) { hide(node); continue }
    node.setAttribute('d', eye.d)
    node.setAttribute('transform', eye.matrix)
    node.style.opacity = String(eye.alpha)
    show(node)
  }

  // dotsBehind 是帧级标志：同一帧的所有点只会在身体的一侧
  if (frame.dotsBehind) {
    paintDotSlots(elements.dotsBehind, frame.dots, scale)
    clearDotSlots(elements.dotsFront)
  } else {
    paintDotSlots(elements.dotsFront, frame.dots, scale)
    clearDotSlots(elements.dotsBehind)
  }

  for (let index = 0; index < elements.arcs.length; index += 1) {
    const slot = elements.arcs[index]!
    const arc = frame.arcs[index]
    if (!arc) { hide(slot.back); hide(slot.front); continue }
    slot.gradient.setAttribute('x1', String(arc.grad.x1))
    slot.gradient.setAttribute('y1', String(arc.grad.y1))
    slot.gradient.setAttribute('x2', String(arc.grad.x2))
    slot.gradient.setAttribute('y2', String(arc.grad.y2))
    const lastStop = arc.grad.stops[arc.grad.stops.length - 1] ?? '#fff'
    for (let s = 0; s < slot.stops.length; s += 1) {
      slot.stops[s]!.setAttribute('stop-color', arc.grad.stops[s] ?? lastStop)
    }
    if (arc.back) {
      slot.back.setAttribute('d', arc.back)
      slot.back.setAttribute('stroke-width', String(arc.width))
      slot.back.style.opacity = String(arc.opacity)
      show(slot.back)
    } else hide(slot.back)
    if (arc.front) {
      slot.front.setAttribute('d', arc.front)
      slot.front.setAttribute('stroke-width', String(arc.width))
      slot.front.style.opacity = String(arc.opacity)
      show(slot.front)
    } else hide(slot.front)
  }

  // 缺口：身体色圆盘盖住徽章周围的身体轮廓，让蓝点坐在一个干净的凹座里
  if (frame.notch) {
    elements.notch.setAttribute('cx', String(frame.notch.x))
    elements.notch.setAttribute('cy', String(frame.notch.y))
    elements.notch.setAttribute('r', String(frame.notch.r))
    show(elements.notch)
  } else hide(elements.notch)

  if (frame.notif) {
    elements.notif.setAttribute('cx', String(frame.notif.x))
    elements.notif.setAttribute('cy', String(frame.notif.y))
    elements.notif.setAttribute('r', String(frame.notif.r))
    show(elements.notif)
  } else hide(elements.notif)
}

/**
 * 指针注视目标：矩形缓存 0.75s（不逐帧测量），reach = max(60, 宽×3) 截断归一化。
 * 无指针（尚未移动过）返回 null——引擎会回到状态自带注视 + wander 漂移。
 */
function computeLook(svg: SVGSVGElement, rectCache: { current: { x: number; y: number; w: number; at: number } | null }, seconds: number): Look | null {
  const pointer = getPointerPosition()
  if (!pointer) return null
  let rect = rectCache.current
  if (!rect || seconds - rect.at > .75) {
    const box = svg.getBoundingClientRect()
    // 未布局/被隐藏的空矩形：没有可aim的中心，当作无指针处理
    if (box.width === 0 && box.height === 0) return null
    rect = { x: box.left + box.width / 2, y: box.top + box.height / 2, w: box.width, at: seconds }
    rectCache.current = rect
  }
  return pointerToLook(pointer, rect, Math.max(60, rect.w * 3))
}

export function LcosGlyth({ state = 'stable', size = 24, className = '', label, animated = true }: {
  readonly state?: LcosGlythState
  readonly size?: number
  readonly className?: string
  readonly label?: string
  readonly animated?: boolean
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const engineRef = useRef<BotEngine | null>(null)
  if (!engineRef.current) engineRef.current = createGlythEngine(GLYTH_SCALE)
  const elementsRef = useRef<GlythElements | null>(null)
  const rectCacheRef = useRef<{ x: number; y: number; w: number; at: number } | null>(null)
  const visibleRef = useRef(true)
  const reducedMotion = useReducedSpatialMotion()
  const uid = useId()
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
    const dotSlotsOf = (group: Element | null): DotSlot[] => {
      if (!group) return []
      const circles = [...group.querySelectorAll<SVGCircleElement>('[data-glyth-dot-circle]')]
      const paths = [...group.querySelectorAll<SVGPathElement>('[data-glyth-dot-path]')]
      return circles.map((circle, index) => ({ circle, path: paths[index]! }))
    }
    const gradients = [...svg.querySelectorAll<SVGLinearGradientElement>('linearGradient')]
    const backs = [...svg.querySelectorAll<SVGPathElement>('[data-glyth-arc-back]')]
    const fronts = [...svg.querySelectorAll<SVGPathElement>('[data-glyth-arc-front]')]
    elementsRef.current = {
      svg,
      body: svg.querySelector<SVGPathElement>('[data-glyth-body]')!,
      eyes: [...svg.querySelectorAll<SVGPathElement>('[data-glyth-eye]')],
      dotsBehind: dotSlotsOf(svg.querySelector('[data-glyth-dots="behind"]')),
      dotsFront: dotSlotsOf(svg.querySelector('[data-glyth-dots="front"]')),
      arcs: gradients.map((gradient, index) => ({
        gradient,
        stops: [...gradient.querySelectorAll<SVGStopElement>('stop')],
        back: backs[index]!,
        front: fronts[index]!,
      })),
      notch: svg.querySelector<SVGCircleElement>('[data-glyth-notch]')!,
      notif: svg.querySelector<SVGCircleElement>('[data-glyth-notif]')!,
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

  // 状态切换交给引擎：setState 带时间戳，中途切换会冻结当前复合 pose 保证连续
  useEffect(() => {
    engineRef.current?.setState(GLYTH_TO_BLOUB[displayState], performance.now() / 1000)
  }, [displayState])

  useEffect(() => {
    const svg = svgRef.current
    const engine = engineRef.current
    if (!svg || !engine) return
    const still = reducedMotion || !animated
    const paint = (seconds: number) => {
      const elements = elementsRef.current
      if (!elements || !visibleRef.current) return
      // 指针注视：每帧重设目标，引擎自带 LOOK_MORPH 惯性；无指针时传 null 回到状态注视
      engine.setLook(computeLook(svg, rectCacheRef, seconds), seconds)
      // 静止模式只采样一次，且取形态时长之后的一帧——落在目标态自身的姿态上
      const frame = engine.sample(seconds + (still ? glythStateDuration(displayState) : 0))
      renderFrame(elements, frame, GLYTH_SCALE)
    }
    paint(performance.now() / 1000)
    if (still) return
    return subscribeGlythClock(paint)
  }, [animated, reducedMotion, displayState])

  return <svg ref={svgRef} className={`lcos-glyth state-${displayState}${reducedMotion ? ' is-reduced-motion' : ''}${className ? ` ${className}` : ''}`} data-glyth-state={displayState} viewBox="0 0 100 100" width={size} height={size} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
    <defs>
      {Array.from({ length: MAX_ARCS }, (_, index) => <linearGradient key={index} id={`${uid}-arc${index}`} gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#fff"/><stop offset=".5" stopColor="#fff"/><stop offset="1" stopColor="#fff"/></linearGradient>)}
    </defs>
    <g transform="translate(50 50)">
      <g className="lcos-glyth-dots is-behind" data-glyth-dots="behind">
        {Array.from({ length: MAX_DOTS }, (_, index) => <Fragment key={index}><circle data-glyth-dot-circle={index}/><path data-glyth-dot-path={index}/></Fragment>)}
      </g>
      <g className="lcos-glyth-arcs-back">
        {Array.from({ length: MAX_ARCS }, (_, index) => <path key={index} data-glyth-arc-back={index} stroke={`url(#${uid}-arc${index})`}/>)}
      </g>
      <path data-glyth-body="body" className="lcos-glyth-core"/>
      <g className="lcos-glyth-eyes">
        {Array.from({ length: MAX_EYES }, (_, index) => <path key={index} data-glyth-eye={index}/>)}
      </g>
      <g className="lcos-glyth-dots" data-glyth-dots="front">
        {Array.from({ length: MAX_DOTS }, (_, index) => <Fragment key={index}><circle data-glyth-dot-circle={index}/><path data-glyth-dot-path={index}/></Fragment>)}
      </g>
      <g className="lcos-glyth-arcs-front">
        {Array.from({ length: MAX_ARCS }, (_, index) => <path key={index} data-glyth-arc-front={index} stroke={`url(#${uid}-arc${index})`}/>)}
      </g>
      <circle className="lcos-glyth-notch" data-glyth-notch="notch"/>
      <circle className="lcos-glyth-notif" data-glyth-notif="notif" fill={NOTIF_BLUE}/>
    </g>
  </svg>
}
