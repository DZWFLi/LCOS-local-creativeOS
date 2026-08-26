/**
 * 搜索块级引用消费链 — formatChunkAnchorLabel 纯函数测试。
 * 锚点契约来源：packages/contracts/src/search.ts 的 SearchHitV0.chunkAnchor
 * （'section:风险' / 'pdf:p3' / 'pdf:p3-p5' / 'chunk:2-4' 等）。
 */
import { describe, expect, it } from 'vitest'

import { formatChunkAnchorLabel } from '../src/features/project/ProjectToolsDialog'

describe('formatChunkAnchorLabel — 块级锚点翻译', () => {
  it('section 前缀翻译为「§ 章节名」', () => {
    expect(formatChunkAnchorLabel('section:风险')).toBe('§ 风险')
    expect(formatChunkAnchorLabel('section:市场分析')).toBe('§ 市场分析')
  })

  it('pdf 单页锚点翻译为「第 N 页」', () => {
    expect(formatChunkAnchorLabel('pdf:p3')).toBe('第 3 页')
    expect(formatChunkAnchorLabel('pdf:p12')).toBe('第 12 页')
  })

  it('pdf 页范围锚点翻译为「第 A-B 页」', () => {
    expect(formatChunkAnchorLabel('pdf:p3-p5')).toBe('第 3-5 页')
    expect(formatChunkAnchorLabel('pdf:p10-p20')).toBe('第 10-20 页')
  })

  it('空串原样返回', () => {
    expect(formatChunkAnchorLabel('')).toBe('')
  })

  it('chunk 段落窗口锚点翻译为「第 N 段」/「第 A-B 段」', () => {
    expect(formatChunkAnchorLabel('chunk:2-4')).toBe('第 2-4 段')
    expect(formatChunkAnchorLabel('chunk:1')).toBe('第 1 段')
  })

  it('未知格式原样返回', () => {
    expect(formatChunkAnchorLabel('time:00:01:20')).toBe('time:00:01:20')
    expect(formatChunkAnchorLabel('paragraph:abc')).toBe('paragraph:abc')
  })

  it('畸形前缀不当翻译，原样返回', () => {
    // 'section:' 章节名为空；'pdf:3' 缺 p；'pdf:p3-p' 缺终点页码 —— 均按未知格式处理
    expect(formatChunkAnchorLabel('section:')).toBe('section:')
    expect(formatChunkAnchorLabel('pdf:3')).toBe('pdf:3')
    expect(formatChunkAnchorLabel('pdf:p3-p')).toBe('pdf:p3-p')
  })
})
