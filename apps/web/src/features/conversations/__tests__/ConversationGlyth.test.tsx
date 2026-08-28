import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  computeGlythFrame,
  conversationActivityScore,
  conversationGlythStateFromRecent,
  ConversationGlyth,
  DORMANT_THRESHOLD,
  type ConversationGlythInput,
} from '../ConversationGlyth'

/**
 * ConversationGlyth 契约测试（批七收口 C-2，Grammar Baseline v0.15 §8 / §8.3）。
 *
 * 环境说明：本项目 vitest 走 node 环境（无 jsdom）——与 ObjectOrbit.test.tsx 同一先例：
 * - 三个纯函数直接数值断言（衰减公式已按实现冻结：Math.exp(-hoursSince / 24)，
 *   24h → e⁻¹ ≈ 0.368，DORMANT_THRESHOLD 0.5 在 24·ln2 ≈ 16.6h 处到达）；
 * - 组件用 renderToStaticMarkup 断言静态结构（初始帧是 SSR 安全的静态快照，
 *   动画时钟只在客户端 useEffect 里订阅）。
 */

const NOW = Date.parse('2026-08-27T10:00:00.000Z')
const HOUR_MS = 3_600_000

function isoAgo(hours: number): string {
  return new Date(NOW - hours * HOUR_MS).toISOString()
}

const BASE: ConversationGlythInput = { id: 'conv-test-1', title: '需求讨论·第三轮' }

describe('conversationActivityScore（§8.3 Activity Decay，公式按实现冻结）', () => {
  it('无任何时间戳 → 中性 0.5（不造假活跃度）', () => {
    expect(conversationActivityScore(BASE, NOW)).toBe(0.5)
  })

  it('lastRunAt = now → 1（±ε）', () => {
    expect(conversationActivityScore({ ...BASE, lastRunAt: new Date(NOW).toISOString() }, NOW)).toBeCloseTo(1, 10)
  })

  it('lastRunAt = 24h 前 → Math.exp(-1) ≈ 0.3679（指数衰减时间常数，不是半衰期 0.5）', () => {
    const score = conversationActivityScore({ ...BASE, lastRunAt: isoAgo(24) }, NOW)
    expect(score).toBeCloseTo(Math.exp(-1), 10)
    expect(score).toBeCloseTo(0.3679, 3)
  })

  it('多时间戳取最近者：lastOpenedAt 比 lastRunAt 更近时，以 lastOpenedAt 为准', () => {
    const score = conversationActivityScore(
      { ...BASE, lastRunAt: isoAgo(48), lastOpenedAt: isoAgo(6) },
      NOW,
    )
    expect(score).toBeCloseTo(Math.exp(-6 / 24), 10)
    expect(score).not.toBeCloseTo(Math.exp(-48 / 24), 5)
  })

  it('DORMANT_THRESHOLD = 0.5 的到达点 ≈ 16.6h（24·ln2）：交叉点两侧数值钉死', () => {
    expect(DORMANT_THRESHOLD).toBe(0.5)
    const crossoverHours = 24 * Math.LN2
    expect(conversationActivityScore({ ...BASE, updatedAt: isoAgo(crossoverHours - 0.01) }, NOW)).toBeGreaterThan(0.5)
    expect(conversationActivityScore({ ...BASE, updatedAt: isoAgo(crossoverHours + 0.01) }, NOW)).toBeLessThan(0.5)
  })
})

describe('conversationGlythStateFromRecent（Activity 不能推断 Lifecycle）', () => {
  it('无论 lastRunAt 多近都保持 stable；working 只能来自 SessionLifecycle', () => {
    expect(conversationGlythStateFromRecent({ ...BASE, lastRunAt: isoAgo(1 / 60) }, NOW)).toBe('stable')
    expect(conversationGlythStateFromRecent({ ...BASE, lastRunAt: isoAgo(48) }, NOW)).toBe('stable')
    expect(conversationGlythStateFromRecent(BASE, NOW)).toBe('stable')
  })
})

describe('computeGlythFrame（纯函数：bloub 引擎静态帧）', () => {
  it('返回 BotFrame：bodyPath 非空字符串、eyes 数组 ≥ 1（§8.2 四通道的身体载体）', () => {
    const frame = computeGlythFrame('stable')
    expect(typeof frame.bodyPath).toBe('string')
    expect(frame.bodyPath.length).toBeGreaterThan(0)
    expect(Array.isArray(frame.eyes)).toBe(true)
    expect(frame.eyes.length).toBeGreaterThanOrEqual(1)
  })

  it('同参数两次调用结果一致（纯函数，SSR 安全）', () => {
    expect(computeGlythFrame('working')).toEqual(computeGlythFrame('working'))
  })
})

describe('ConversationGlyth 组件渲染（node 环境 renderToStaticMarkup 先例）', () => {
  it('最小 props：渲染 svg.lcos-conversation-glyth，data-glyth-state 存在（stable）', () => {
    const html = renderToStaticMarkup(<ConversationGlyth conversation={BASE} />)
    expect(html).toMatch(/<svg[^>]*lcos-conversation-glyth/)
    expect(html).toContain('data-glyth-state="stable"')
    expect(html).toContain('data-conversation-id="conv-test-1"')
    // 无时间戳 → activityScore 恰为 0.5，dormant 判定是严格小于：不落 is-dormant
    expect(html).not.toContain('is-dormant')
  })

  it('lastRunAt 近期仍保持 stable；显式 state 才能表达 working lifecycle', () => {
    const recent = renderToStaticMarkup(
      <ConversationGlyth conversation={{ ...BASE, lastRunAt: new Date(Date.now() - 5 * 60_000).toISOString() }} />,
    )
    expect(recent).toContain('data-glyth-state="stable"')
    const busy = renderToStaticMarkup(<ConversationGlyth conversation={BASE} state="working" />)
    expect(busy).toContain('data-glyth-state="working"')
  })

  it('长期 dormant（updatedAt 24h 前，score ≈ 0.368 < 0.5）→ is-dormant 低饱和安静态', () => {
    const html = renderToStaticMarkup(
      <ConversationGlyth conversation={{ ...BASE, updatedAt: new Date(Date.now() - 24 * HOUR_MS).toISOString() }} />,
    )
    expect(html).toContain('is-dormant')
    expect(html).toContain('data-glyth-state="stable"')
  })
})
