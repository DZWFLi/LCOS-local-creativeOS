import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { nodeDisplayModeLabel, nodeMeta, runStatusLabel } from '../src/model'

describe('v0.5.3 surface calibration guards', () => {
  it('uses Chinese labels for user-facing node, run and density semantics', () => {
    expect(Object.values(nodeMeta).map((item) => item.label)).toEqual([
      '内容',
      '当前内容',
      'AI 结果',
      '内容集合',
      '执行记录',
      '确认记录',
      '文本',
    ])
    expect(runStatusLabel.waiting_input).toBe('等待确认')
    expect(nodeDisplayModeLabel).toEqual({ compact: '紧凑', standard: '标准', expanded: '展开' })
  })

  it('keeps generated and decision materials while adding a real compact rail and pending zone', () => {
    const surface = readFileSync(new URL('../src/surface.css', import.meta.url), 'utf8')
    expect(surface).toContain('.artifact-generated-material')
    expect(surface).toContain('.decision-material')
    expect(surface).toContain('.compact-workspace-rail')
    expect(surface).toContain('.pending-return-zone')
    expect(surface).toContain('.density-options')
    expect(surface).toContain('.app-shell.v061 .canvas-node .resize-handle')
  })
})
