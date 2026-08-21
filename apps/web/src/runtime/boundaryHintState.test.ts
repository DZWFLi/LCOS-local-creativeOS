import { describe, expect, it } from 'vitest'
import { CONTEXT_HINT_COOLDOWN_MS, WORKFLOW_HINT_COOLDOWN_MS, recordDepositHint, shouldShowDepositHint } from './boundaryHintState'

describe('boundaryHintState', () => {
  it('waits 20m before the first useful Context deposit, then requires new evidence plus cooldown', () => {
    expect(shouldShowDepositHint({ kind: 'context', now: 10, evidenceKey: 'a', memory: {}, sessionStartedAt: 0 })).toBe(false)
    expect(shouldShowDepositHint({ kind: 'context', now: CONTEXT_HINT_COOLDOWN_MS + 1, evidenceKey: 'a', memory: {}, sessionStartedAt: 0 })).toBe(true)
    const memory = recordDepositHint({ kind: 'context', now: CONTEXT_HINT_COOLDOWN_MS + 1, evidenceKey: 'a', memory: {} })
    expect(shouldShowDepositHint({ kind: 'context', now: 2 * CONTEXT_HINT_COOLDOWN_MS + 2, evidenceKey: 'a', memory })).toBe(false)
    expect(shouldShowDepositHint({ kind: 'context', now: 2 * CONTEXT_HINT_COOLDOWN_MS, evidenceKey: 'b', memory })).toBe(false)
    expect(shouldShowDepositHint({ kind: 'context', now: 2 * CONTEXT_HINT_COOLDOWN_MS + 2, evidenceKey: 'b', memory })).toBe(true)
  })

  it('waits four hours before the first Workflow hint and then uses the same cooldown', () => {
    expect(shouldShowDepositHint({ kind: 'workflow', now: WORKFLOW_HINT_COOLDOWN_MS - 1, evidenceKey: 'a', memory: {}, sessionStartedAt: 0 })).toBe(false)
    expect(shouldShowDepositHint({ kind: 'workflow', now: WORKFLOW_HINT_COOLDOWN_MS + 1, evidenceKey: 'a', memory: {}, sessionStartedAt: 0 })).toBe(true)
    const memory = recordDepositHint({ kind: 'workflow', now: 50, evidenceKey: 'a', memory: {} })
    expect(shouldShowDepositHint({ kind: 'workflow', now: 50 + WORKFLOW_HINT_COOLDOWN_MS - 1, evidenceKey: 'b', memory })).toBe(false)
    expect(shouldShowDepositHint({ kind: 'workflow', now: 50 + WORKFLOW_HINT_COOLDOWN_MS + 1, evidenceKey: 'b', memory })).toBe(true)
  })
})
