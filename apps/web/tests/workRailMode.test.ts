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

describe('v0.6 phase 2 adaptive Work Rail', () => {
  it('prioritizes a human decision and returned result over node selection', () => {
    expect(deriveWorkRailMode({ activeRun: run('waiting_input'), selectedNodes: [node], focusNode: node, pendingNode: null })).toBe('waiting-input')
    expect(deriveWorkRailMode({ activeRun: run('review'), selectedNodes: [node], focusNode: node, pendingNode: node })).toBe('review')
  })

  it('automatically shows running state after sending and selection after acceptance', () => {
    expect(deriveWorkRailMode({ activeRun: run('running'), selectedNodes: [node], focusNode: null, pendingNode: null })).toBe('run')
    expect(deriveWorkRailMode({ activeRun: run('completed'), selectedNodes: [node], focusNode: null, pendingNode: node })).toBe('selection')
  })

  it('uses selection and workspace summary when there is no urgent task', () => {
    expect(deriveWorkRailMode({ activeRun: null, selectedNodes: [node, { ...node, id: 'feedback' }], focusNode: null, pendingNode: null })).toBe('multi-selection')
    expect(deriveWorkRailMode({ activeRun: null, selectedNodes: [], focusNode: null, pendingNode: null })).toBe('workspace')
  })

  it('only blocks sending while an active execution is not yet reviewable', () => {
    expect(isRunBusy(run('queued'))).toBe(true)
    expect(isRunBusy(run('waiting_input'))).toBe(true)
    expect(isRunBusy(run('review'))).toBe(false)
    expect(isRunBusy(run('completed'))).toBe(false)
  })
})
