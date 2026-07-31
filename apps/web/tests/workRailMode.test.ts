import { describe, expect, it } from 'vitest'
import type { ActiveRun, CanvasNode } from '../src/model'
import { deriveWorkRailMode, isRunBusy } from '../src/state/workRailMode'

const node: CanvasNode = { id: 'proposal', kind: 'working', title: '提案', subtitle: '', x: 0, y: 0, width: 264, height: 190 }
const run = (status: ActiveRun['status']): ActiveRun => ({
  id: 'RUN-101',
  status,
  command: '调整构图',
  targetIds: ['proposal'],
  contextIds: ['feedback'],
  processNodeId: 'run-node',
  reviewStatus: status === 'review' ? 'pending' : status === 'completed' ? 'accepted' : 'idle',
  changedFiles: [],
  createdAt: '2026-07-22T00:00:00.000Z',
})

describe('v0.7.1 execution-only Work Rail', () => {
  it('prioritizes human decisions and returned results', () => {
    expect(deriveWorkRailMode({ activeRun: run('waiting_input'), pendingNode: null })).toBe('waiting-input')
    expect(deriveWorkRailMode({ activeRun: run('review'), pendingNode: node })).toBe('review')
  })

  it('keeps execution states in the Work Rail and ignores ordinary selection', () => {
    expect(deriveWorkRailMode({ activeRun: run('running'), pendingNode: null })).toBe('run')
    expect(deriveWorkRailMode({ activeRun: run('completed'), pendingNode: node })).toBe('completed')
    expect(deriveWorkRailMode({ activeRun: null, pendingNode: null })).toBe('workspace')
    expect(deriveWorkRailMode({ activeRun: null, pendingNode: null })).toBe('workspace')
  })

  it('only blocks sending while an active execution is not yet reviewable', () => {
    expect(isRunBusy(run('queued'))).toBe(true)
    expect(isRunBusy(run('waiting_input'))).toBe(true)
    expect(isRunBusy(run('review'))).toBe(false)
    expect(isRunBusy(run('completed'))).toBe(false)
  })
})
