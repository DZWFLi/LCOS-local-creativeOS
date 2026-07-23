import { describe, expect, it } from 'vitest'
import { createWorkspaceRecord, duplicateWorkspaceRecord, moveWorkspaceRecord, removeWorkspaceRecord, toggleWorkspaceLayer, updateWorkspaceRecord } from '../src/state/workspaceState'

const now = '2026-07-21T00:00:00.000Z'
const base = createWorkspaceRecord({ id: 'a', label: '客户原始需求', intent: null, camera: { x: 0, y: 0, zoom: 1 }, visibleLayers: ['core', 'process'], now })

describe('workspace interaction foundation', () => {
  it('creates a freely named workspace with optional intent', () => {
    expect(base.label).toBe('客户原始需求')
    expect(base.intent).toBeNull()
  })

  it('renames and changes intent without changing content rules', () => {
    const [updated] = updateWorkspaceRecord([base], 'a', { label: 'Thinker 创意探索', intent: 'explore' }, 'later')
    expect(updated.label).toBe('Thinker 创意探索')
    expect(updated.intent).toBe('explore')
    expect(updated.visibleLayers).toEqual(['core', 'process'])
  })

  it('duplicates only the semantic view record', () => {
    const result = duplicateWorkspaceRecord([base], 'a', 'b', 'later')
    expect(result.workspaces).toHaveLength(2)
    expect(result.duplicate?.label).toContain('副本')
    expect(result.duplicate?.camera).not.toBe(base.camera)
  })

  it('moves, filters, and deletes workspaces predictably', () => {
    const second = { ...base, id: 'b', label: 'B' }
    expect(moveWorkspaceRecord([base, second], 'b', -1).map((item) => item.id)).toEqual(['b', 'a'])
    expect(toggleWorkspaceLayer([base, second], 'a', 'process', 'later')[0].visibleLayers).toEqual(['core'])
    expect(removeWorkspaceRecord([base, second], 'a').map((item) => item.id)).toEqual(['b'])
    expect(removeWorkspaceRecord([base], 'a')).toHaveLength(1)
  })
})
