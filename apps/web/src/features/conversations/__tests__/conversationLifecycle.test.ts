import { describe, expect, it } from 'vitest'
import { glythStateFromSessionPhase, sessionPhaseLabel } from '../conversationLifecycle'

describe('Conversation lifecycle → Glyth pose', () => {
  it('maps only real SessionLifecycle phases to active poses', () => {
    expect(glythStateFromSessionPhase('busy')).toBe('working')
    expect(glythStateFromSessionPhase('connecting')).toBe('working')
    expect(glythStateFromSessionPhase('waiting_input')).toBe('waiting')
    expect(glythStateFromSessionPhase('disconnected')).toBe('error')
  })

  it('keeps freshness/idle phases stable instead of inventing activity', () => {
    for (const phase of ['online', 'dormant', 'stale', undefined] as const) {
      expect(glythStateFromSessionPhase(phase)).toBe('stable')
    }
  })

  it('labels stale and disconnected as different truths', () => {
    expect(sessionPhaseLabel('stale')).toBe('信息可能过期')
    expect(sessionPhaseLabel('disconnected')).toBe('已断开')
  })
})
