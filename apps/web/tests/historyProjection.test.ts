import type { Checkpoint, HandoffRecord } from '@local-creative-os/contracts'
import { describe, expect, it } from 'vitest'

import { adaptContextSnapshotEntries, adaptHandoffProjections } from '../src/features/surfaces/historyProjection'

const NOW = '2026-08-08T00:00:00.000Z'

function checkpoint(id: string, label: string, refs: unknown, createdAt = NOW): Checkpoint {
  return {
    id: id as Checkpoint['id'],
    projectId: 'disposable-mvp-sample' as Checkpoint['projectId'],
    scopeId: 'scope-root' as Checkpoint['scopeId'],
    label,
    snapshotJson: refs as Checkpoint['snapshotJson'],
    createdAt,
  }
}

const refs = {
  schemaVersion: 1 as const,
  savedAt: NOW,
  workspaceId: 'ws-main',
  scopeId: 'scope-root',
  focusedViewIds: ['view-a', 'view-b'],
  artifactIds: ['art-a', 'art-b', 'art-c'],
  relationIds: ['rel-1'],
  noteIds: ['note-1'],
  runIds: ['run-1'],
}

describe('adaptContextSnapshotEntries', () => {
  it('maps snapshots to history entries and marks the latest as current', () => {
    const entries = adaptContextSnapshotEntries([
      checkpoint('ctx-snap-1', '需求定稿', refs, '2026-08-07T00:00:00.000Z'),
      checkpoint('ctx-snap-2', '方案 A', { ...refs, artifactIds: ['art-b'] }, '2026-08-08T00:00:00.000Z'),
    ])
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      id: 'ctx-snap-1',
      label: '需求定稿',
      current: false,
      objectIds: ['view-a', 'view-b'],
      createdAt: '2026-08-07T00:00:00.000Z',
    })
    expect(entries[1]).toMatchObject({ id: 'ctx-snap-2', current: true })
  })

  it('summarizes object/relation/note/run counts from snapshot refs', () => {
    const [entry] = adaptContextSnapshotEntries([checkpoint('ctx-snap-1', '基线', refs)])
    expect(entry.summary).toContain('3 个对象')
    expect(entry.summary).toContain('1 个关系')
    expect(entry.summary).toContain('1 条备注')
    expect(entry.summary).toContain('1 个 Run')
  })

  it('falls back to artifact ids when focused views are absent', () => {
    const [entry] = adaptContextSnapshotEntries([checkpoint('ctx-snap-1', '无视图', { ...refs, focusedViewIds: [] })])
    expect(entry.objectIds).toEqual(['art-a', 'art-b', 'art-c'])
  })

  it('flags unparseable snapshot json instead of crashing', () => {
    const [entry] = adaptContextSnapshotEntries([checkpoint('ctx-snap-1', '坏快照', { nope: true })])
    expect(entry.objectIds).toEqual([])
    expect(entry.summary).toContain('不可解析')
  })
})

describe('adaptHandoffProjections', () => {
  it('maps provider fields and title to the ribbon projection', () => {
    const records: HandoffRecord[] = [{
      id: 'handoff-1',
      projectId: 'disposable-mvp-sample' as HandoffRecord['projectId'],
      title: 'Codex → Buddy',
      resumeMode: 'standard-handoff',
      fromProvider: 'Codex',
      toProvider: 'WorkBuddy',
      decisions: [],
      openQuestions: [],
      nextActions: ['跑通 golden path'],
      artifactRefs: [],
      messageRefs: [],
      createdAt: NOW,
      updatedAt: NOW,
    }]
    expect(adaptHandoffProjections(records)).toEqual([{
      id: 'handoff-1',
      from: 'Codex',
      to: 'WorkBuddy',
      label: 'Codex → Buddy',
    }])
  })

  it('defaults unknown providers to Agent/Next', () => {
    const records: HandoffRecord[] = [{
      id: 'handoff-2',
      projectId: 'disposable-mvp-sample' as HandoffRecord['projectId'],
      title: '无提供方',
      resumeMode: 'native-resume',
      decisions: [],
      openQuestions: [],
      nextActions: [],
      artifactRefs: [],
      messageRefs: [],
      createdAt: NOW,
      updatedAt: NOW,
    }]
    expect(adaptHandoffProjections(records)).toEqual([{ id: 'handoff-2', from: 'Agent', to: 'Next', label: '无提供方' }])
  })
})
