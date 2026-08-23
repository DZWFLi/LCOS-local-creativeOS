import { describe, expect, it } from 'vitest'
import { blendGlythPose, glythPose, sampleGlyth } from '../src/features/spatial/visual/glythMotion'

describe('LCOS Glyth motion sampler', () => {
  it('keeps one recognizable near-square core with two vertical eyes', () => {
    const frame = sampleGlyth(glythPose('stable'), 'cursor', 0)
    expect(frame.core.width / frame.core.height).toBeGreaterThan(1)
    expect(frame.core.width / frame.core.height).toBeLessThan(1.45)
    expect(frame.eyes).toHaveLength(2)
    expect(frame.eyes.every((eye) => eye.height > eye.width * 2)).toBe(true)
  })

  it('uses four open shell segments instead of a closed decorative frame', () => {
    const frame = sampleGlyth(glythPose('working'), 'cursor', 1.2)
    expect(frame.shells).toHaveLength(4)
    expect(frame.shells.every((path) => path.startsWith('M') && path.includes('Q'))).toBe(true)
  })

  it('morphs continuously between semantic states', () => {
    const from = glythPose('stable')
    const to = glythPose('blocked')
    const middle = blendGlythPose(from, to, .5)
    expect(middle.open).toBeGreaterThan(from.open)
    expect(middle.open).toBeLessThan(to.open)
    expect(middle.energy).toBeGreaterThan(from.energy)
  })
})
