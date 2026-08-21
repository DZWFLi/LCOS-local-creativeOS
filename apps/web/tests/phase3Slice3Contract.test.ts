import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const flow = readFileSync(new URL('../src/features/surfaces/ContextFlowSurface.tsx', import.meta.url), 'utf8')
const trackState = readFileSync(new URL('../src/state/presentationTrackState.ts', import.meta.url), 'utf8')
const contracts = readFileSync(new URL('../../../packages/contracts/src/presentations.ts', import.meta.url), 'utf8')

describe('Phase 3 Slice 3 — Signal Track contract', () => {
  it('persists track segments through the committed context presentation state', () => {
    expect(contracts).toContain('trackSegments?: ContextTrackSegmentV0[]')
    expect(contracts).toContain('ContextTrackSegmentV0')
    expect(trackState).toContain('state.trackSegments')
    expect(trackState).toContain('getPresentationBridge(projectId, scopeId, \'context\')')
  })

  it('renders segment tools for collapse/reorder/split/merge/add/remove', () => {
    expect(flow).toContain('lcos-signal-segment-tools')
    expect(flow).toContain('toggleTrackSegmentCollapsed')
    expect(flow).toContain('reorderTrackSegment')
    expect(flow).toContain('splitTrackSegment')
    expect(flow).toContain('mergeTrackSegments')
    expect(flow).toContain('addTrackSegmentMembers')
    expect(flow).toContain('removeTrackSegmentMember')
  })

  it('hides collapsed segment members and keeps density mechanical', () => {
    expect(flow).toContain('placement.collapsed')
    expect(flow).toContain('is-collapsed')
    expect(flow).toContain('trackSegmentDensity(segment)')
  })
})
