import { describe, expect, it } from 'vitest'
import { GLYTH_STATES, blendGlythPose, coerceGlythState, glythPose, glythRadiusAt, glythStateDuration, sampleGlyth } from '../src/features/spatial/visual/glythMotion'

describe('LCOS Glyth liquid-capsule engine', () => {
  it('freezes the seven semantic states and retires the legacy ones', () => {
    expect(GLYTH_STATES).toEqual(['stable', 'working', 'waiting', 'error', 'confirm', 'absorb', 'output'])
    expect(coerceGlythState('focus')).toBe('working')
    expect(coerceGlythState('candidate')).toBe('working')
    expect(coerceGlythState('blocked')).toBe('error')
    expect(coerceGlythState('protected')).toBe('stable')
    expect(coerceGlythState('stable')).toBe('stable')
  })

  it('draws one closed liquid capsule with two vertical eyes inside it (golden frame, t=0)', () => {
    const frame = sampleGlyth(glythPose('stable'), 'cursor', 0)
    expect(frame.body.startsWith('M')).toBe(true)
    expect(frame.body.endsWith('Z')).toBe(true)
    expect(frame.body).toContain('C')
    const width = frame.bounds.maxX - frame.bounds.minX
    const height = frame.bounds.maxY - frame.bounds.minY
    expect(width / height).toBeGreaterThan(1.1)
    expect(frame.eyes).toHaveLength(2)
    expect(frame.eyes.every((eye) => eye.h > eye.w * 2)).toBe(true)
    expect(frame.eyes[0].x).toBeLessThan(frame.eyes[1].x)
  })

  it('wears four discrete light segments in the digital-bar language, fused with the body', () => {
    for (const state of GLYTH_STATES) {
      const frame = sampleGlyth(glythPose(state), 'cursor', .8)
      expect(frame.segments).toHaveLength(4)
      expect(frame.segments.every((segment) => segment.w > segment.h)).toBe(true)
      expect(frame.segments.every((segment) => segment.lit >= 0 && segment.lit <= 1)).toBe(true)
    }
  })

  it('sheds matrix dots from the edge only in energetic poses', () => {
    expect(sampleGlyth(glythPose('stable'), 'cursor', 1.2).dots).toHaveLength(0)
    expect(sampleGlyth(glythPose('confirm'), 'cursor', 1.2).dots).toHaveLength(0)
    for (const state of ['working', 'output', 'absorb', 'error'] as const) {
      const frame = sampleGlyth(glythPose(state), 'cursor', 1.2)
      expect(frame.dots.length).toBeGreaterThan(0)
      expect(frame.dots.length).toBeLessThanOrEqual(8)
      expect(frame.dots.every((dot) => dot.alpha >= 0 && dot.alpha <= 1)).toBe(true)
    }
  })

  it('carves a real front notch for waiting / error / absorb (profile assertion)', () => {
    for (const state of ['waiting', 'error', 'absorb'] as const) {
      const pose = glythPose(state)
      expect(pose.gapDepth).toBeGreaterThan(0)
      const front = glythRadiusAt(pose, 0, 0)
      const back = glythRadiusAt(pose, Math.PI, 0)
      expect(front).toBeLessThan(back)
    }
    expect(glythPose('stable').gapDepth).toBe(0)
  })

  it('gives each state its own morph duration instead of a fixed 0.42s', () => {
    expect(glythStateDuration('error')).toBeLessThan(glythStateDuration('stable'))
    expect(glythStateDuration('confirm')).toBeLessThan(.4)
    const durations = new Set(GLYTH_STATES.map((state) => glythStateDuration(state)))
    expect(durations.size).toBeGreaterThan(4)
  })

  it('morphs continuously between semantic states', () => {
    const from = glythPose('stable')
    const to = glythPose('error')
    const middle = blendGlythPose(from, to, .5)
    expect(middle.gapDepth).toBeGreaterThan(from.gapDepth)
    expect(middle.gapDepth).toBeLessThan(to.gapDepth)
    expect(middle.stretchX).toBeGreaterThan(from.stretchX)
    expect(middle.stretchX).toBeLessThan(to.stretchX)
    expect(middle.dotCount).toBeGreaterThan(from.dotCount)
  })

  it('moves the eyes with the gaze channel', () => {
    const pose = glythPose('stable')
    const left = sampleGlyth(pose, 'cursor', 0, { gaze: { x: -1, y: 0 } })
    const right = sampleGlyth(pose, 'cursor', 0, { gaze: { x: 1, y: 0 } })
    expect(right.eyes[0].x).toBeGreaterThan(left.eyes[0].x)
    const down = sampleGlyth(pose, 'cursor', 0, { gaze: { x: 0, y: 1 } })
    expect(down.eyes[0].y).toBeGreaterThan(left.eyes[0].y)
  })

  it('closes the eyes through the blink channel', () => {
    const pose = glythPose('stable')
    const open = sampleGlyth(pose, 'cursor', 0, { blink: 0 })
    const shut = sampleGlyth(pose, 'cursor', 0, { blink: 1 })
    expect(shut.eyes[0].h).toBeLessThan(open.eyes[0].h)
    expect(shut.eyes[0].h).toBeLessThanOrEqual(1.1)
  })

  it('stretches the output capsule along its front direction', () => {
    const frame = sampleGlyth(glythPose('output'), 'cursor', 0)
    const width = frame.bounds.maxX - frame.bounds.minX
    const height = frame.bounds.maxY - frame.bounds.minY
    expect(width / height).toBeGreaterThan(1.2)
  })
})
