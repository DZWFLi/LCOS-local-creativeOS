import { describe, expect, it } from 'vitest'
import { outlineHue, outlineRows, parseOutline, parseOutlineLoose, serializeOutline } from '../src/features/canvas/outlineTree'

describe('outline tree (mind-map text node data layer)', () => {
  it('parses indentation into a hierarchy (spaces, tabs and bullets)', () => {
    const tree = parseOutline([
      '项目上下文',
      '  - 客户限制 #硬约束',
      '\t\t必须保留 30%',
      '  视觉参考',
      '    门框构图',
    ].join('\n'))
    expect(tree).toHaveLength(1)
    const root = tree[0]!
    expect(root.text).toBe('项目上下文')
    expect(root.children).toHaveLength(2)
    expect(root.children[0]!.text).toBe('客户限制')
    expect(root.children[0]!.tags).toEqual(['硬约束'])
    expect(root.children[0]!.children[0]!.text).toBe('必须保留 30%')
    expect(root.children[1]!.children[0]!.text).toBe('门框构图')
    expect(root.children[0]!.depth).toBe(1)
    expect(root.children[0]!.children[0]!.depth).toBe(2)
  })

  it('round-trips serialize → parse without loss', () => {
    const tree = parseOutline('根\n  子A #tag1\n    孙\n  子B')
    const text = serializeOutline(tree)
    const reparsed = parseOutline(text)
    expect(reparsed).toHaveLength(1)
    expect(reparsed[0]!.children).toHaveLength(2)
    expect(reparsed[0]!.children[0]!.tags).toEqual(['tag1'])
    expect(reparsed[0]!.children[0]!.children[0]!.text).toBe('孙')
    expect(serializeOutline(reparsed)).toBe(text)
  })

  it('drops blank lines and pure-tag lines gracefully', () => {
    const tree = parseOutline('\n  \n#只是标签\n真实行')
    expect(tree).toHaveLength(1)
    expect(tree[0]!.text).toBe('真实行')
  })

  it('supports multiple roots as independent branches', () => {
    const tree = parseOutline('分支一\n  叶\n分支二\n  叶')
    expect(tree).toHaveLength(2)
    expect(tree.every((root) => root.children.length === 1)).toBe(true)
  })

  it('flattens into layout rows with parent linkage and depth', () => {
    const rows = outlineRows(parseOutline('A\n  B\n    C\n  D'))
    expect(rows.map((row) => row.node.text)).toEqual(['A', 'B', 'C', 'D'])
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 2, 1])
    expect(rows[1]!.parentId).toBe(rows[0]!.node.id)
    expect(rows[0]!.hasChildren).toBe(true)
    expect(rows[2]!.hasChildren).toBe(false)
  })

  it('maps branches to one of six deterministic hues (tag first, text fallback)', () => {
    const a = parseOutline('同一分支 #alpha\n  x')[0]!
    const a2 = parseOutline('不同文本 #alpha')[0]!
    const b = parseOutline('另一分支 #beta')[0]!
    expect(outlineHue(a)).toBe(outlineHue(a2))
    expect([262, 210, 168, 36, 12, 320]).toContain(outlineHue(a))
    expect([262, 210, 168, 36, 12, 320]).toContain(outlineHue(b))
  })

  it('loose parsing degrades flat prose to single-line roots (agent output tolerance)', () => {
    const tree = parseOutlineLoose('第一行结论\n第二行结论')
    expect(tree).toHaveLength(2)
    expect(tree.every((node) => node.children.length === 0 && node.depth === 0)).toBe(true)
  })

  it('keeps outline text as the single source of truth (no hidden state)', () => {
    const first = parseOutline('标题\n  甲\n  乙')
    const second = parseOutline(serializeOutline(first))
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
  })
})
