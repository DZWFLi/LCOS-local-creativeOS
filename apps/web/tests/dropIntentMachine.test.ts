import { describe, expect, it } from 'vitest'
import {
  advanceDropIntent,
  completeDropDwell,
  DROP_INTENT_TOKENS,
  dropDwellAnchorAt,
  idleDropIntent,
} from '../src/features/drop/dropIntentMachine'

const bounds = { left: 100, right: 1100, top: 50, bottom: 750 }

describe('drop intent machine', () => {
  it('keeps the outer edge-scroll band free from Drop dwell', () => {
    // 70px from the left edge: inside 96px edge-scroll, outside 44px dwell.
    expect(dropDwellAnchorAt({ x: 170, y: 400 }, bounds)).toBeNull()
    expect(advanceDropIntent(idleDropIntent(), { x: 170, y: 400 }, bounds, 0).status).toBe('idle')
  })

  it('starts dwell only in the inner left or bottom band', () => {
    expect(dropDwellAnchorAt({ x: 130, y: 400 }, bounds)).toBe('left')
    expect(dropDwellAnchorAt({ x: 600, y: 725 }, bounds)).toBe('bottom')

    const next = advanceDropIntent(idleDropIntent(), { x: 130, y: 400 }, bounds, 10)
    expect(next).toMatchObject({ status: 'dwell', anchor: 'left', startedAt: 10 })
  })

  it('preserves dwell for small pointer drift and restarts it after the dwell radius', () => {
    const started = advanceDropIntent(idleDropIntent(), { x: 130, y: 400 }, bounds, 10)
    const stable = advanceDropIntent(started, { x: 136, y: 404 }, bounds, 200)
    expect(stable).toEqual(started)

    const moved = advanceDropIntent(started, { x: 141, y: 400 }, bounds, 200)
    expect(moved).toMatchObject({ status: 'dwell', anchor: 'left', startedAt: 200 })
  })

  it('does not enter preview before 520ms and does after the threshold', () => {
    const started = advanceDropIntent(idleDropIntent(), { x: 130, y: 400 }, bounds, 100)
    expect(completeDropDwell(started, 100 + DROP_INTENT_TOKENS.dwellMs - 1).status).toBe('dwell')
    expect(completeDropDwell(started, 100 + DROP_INTENT_TOKENS.dwellMs)).toEqual({ status: 'preview', anchor: 'left' })
  })

  it('keeps preview while carried inside the outer edge band or over the destination sheet', () => {
    const preview = { status: 'preview', anchor: 'left' } as const
    expect(advanceDropIntent(preview, { x: 180, y: 400 }, bounds, 1000).status).toBe('preview')
    expect(advanceDropIntent(preview, { x: 205, y: 400 }, bounds, 1000).status).toBe('preview')
    expect(advanceDropIntent(preview, { x: 400, y: 400 }, bounds, 1000, true).status).toBe('preview')
    expect(advanceDropIntent(preview, { x: 400, y: 400 }, bounds, 1000, false).status).toBe('idle')
  })
})
