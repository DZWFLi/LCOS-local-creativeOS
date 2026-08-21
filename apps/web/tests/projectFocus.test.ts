import { describe, expect, it } from 'vitest'
import { resolveProjectFocusLocations, searchProjectFocusEntries } from '../src/state/projectFocus'

describe('project focus locations', () => {
  it('ranks current/exact locations first and keeps partial coverage explicit', () => {
    const result = resolveProjectFocusLocations({
      focusViewIds: ['a', 'b'],
      candidates: [
        { key: 'context:c', kind: 'context', label: 'C', memberViewIds: ['a'] },
        { key: 'workspace:w', kind: 'workspace', label: 'W', memberViewIds: ['a', 'b'] },
        { key: 'canvas:root', kind: 'canvas', label: '主画布', memberViewIds: ['a', 'b'], active: true },
      ],
    })
    expect(result.map((item) => item.key)).toEqual(['canvas:root', 'workspace:w', 'context:c'])
    expect(result[0]?.exact).toBe(true)
    expect(result[2]?.matchedCount).toBe(1)
    expect(result[2]?.totalCount).toBe(2)
  })

  it('matches aggregate entity refs without pretending they are artifact views', () => {
    const result = resolveProjectFocusLocations({
      focusViewIds: [],
      focusEntityRefs: [{ type: 'workspace', id: 'w1' }],
      candidates: [
        { key: 'context:c', kind: 'context', label: 'C', memberViewIds: [], memberEntityRefs: [{ type: 'workspace', id: 'w1' }] },
      ],
    })
    expect(result).toHaveLength(1)
    expect(result[0]?.matchedEntityRefs).toEqual([{ type: 'workspace', id: 'w1' }])
  })
})


describe('searchProjectFocusEntries', () => {
  it('searches Project entities as well as file-like views', () => {
    const result = searchProjectFocusEntries([
      { key: 'scope:c1', title: '供应商上下文', kind: 'Context', sourceIds: ['scope:c1'] },
      { key: 'workspace:w1', title: 'Supplier Brief', kind: 'Workspace', sourceIds: ['workspace:w1'] },
    ], 'context')
    expect(result.map((entry) => entry.key)).toEqual(['scope:c1'])
  })
})
