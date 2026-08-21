import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * GUI-2 §5：NodeInfoPopover 工程噪音收敛 —— 空字段不常显，
 * Revision ID 等工程字段后置到 Developer 折叠区。
 */
describe('NodeInfoPopover engineering-noise contract (GUI-2)', () => {
  const source = readFileSync(new URL('../src/features/canvas/NodeInfoPopover.tsx', import.meta.url), 'utf8')

  it('renders revision only when the node actually has one', () => {
    expect(source).toContain('hasRevision && <div')
    expect(source).toContain('revisionCount > 0')
  })

  it('renders Preview only when a status exists and is not not-generated', () => {
    expect(source).toContain('hasPreview && <div')
    expect(source).toContain("node.previewStatus !== 'not-generated'")
    expect(source).not.toContain("node.previewStatus ?? 'not-generated'")
  })

  it('renders 流程 only when a parent run exists', () => {
    expect(source).toContain('node.parentRunId && <div')
  })

  it('moves engineering fields into a collapsed Developer section', () => {
    expect(source).toContain('details className="node-info-developer"')
    expect(source).toContain('<summary>Developer / 工程字段</summary>')
    expect(source).toContain('<dt>Revision ID</dt>')
    expect(source).toContain('<dt>Content Hash</dt>')
  })
})
