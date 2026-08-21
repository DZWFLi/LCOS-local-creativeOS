import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * HU-3B §10/§11 契约边界：
 * - presentationEdges 只包含 presentation-created（context-temp:*）边；
 * - edge-cut hidden ids 是 renderer-transient（会话级），绝不写 Core；
 * - Outline / MindMap 共享同一个 hierarchy 仓库。
 */
describe('HU-3B presentation transient contract', () => {
  const draft = readFileSync(join(import.meta.dirname, '..', 'src', 'state', 'presentationDraftState.ts'), 'utf8')
  const flow = readFileSync(join(import.meta.dirname, '..', 'src', 'features', 'surfaces', 'ContextFlowSurface.tsx'), 'utf8')
  const outline = readFileSync(join(import.meta.dirname, '..', 'src', 'features', 'surfaces', 'OutlineSurface.tsx'), 'utf8')
  const mind = readFileSync(join(import.meta.dirname, '..', 'src', 'features', 'surfaces', 'ContextTreeSurface.tsx'), 'utf8')

  it('persists only presentation-created edges via the isPresentationCreatedEdge predicate', () => {
    expect(draft).toContain('export const isPresentationCreatedEdge')
    expect(draft).toMatch(/filter\(isPresentationCreatedEdge\)/)
  })

  it('keeps Signal Track child local geometry renderer-transient (never mirrored to Core)', () => {
    // R2：Signal Track 的展开子项局部位置是会话级 ref，不写入 Core/Presentation。
    expect(flow).toContain('beginChildDrag')
    expect(flow).toMatch(/childDrag\.current/)
    expect(flow).not.toContain('bridge.patch')
    expect(flow).not.toContain('mirror(')
    // 持久化的只有 trackSegments（段结构），折叠是 Presentation 状态。
    expect(flow).toContain('toggleTrackSegmentCollapsed')
  })

  it('shares one hierarchy repository between Outline and Mind Map (HU-3 §9)', () => {
    expect(outline).toContain("'context-hierarchy'")
    expect(mind).toContain("'context-hierarchy'")
  })
})
