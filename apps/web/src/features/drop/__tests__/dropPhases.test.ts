import { describe, expect, it } from 'vitest'
import {
  DROP_PHASE_NEAR_PX,
  advanceDropPhase,
  isApproaching,
  isCommit,
  isReceptive,
  proximityPhase,
  type DropPhase,
  type DropProximityInput,
} from '../dropPhases'
import { DROP_ACCEPT_HOLD_MS, DROP_COMMIT_HOLD_MS, DROP_SETTLE_OUT_MS } from '../useSemanticDropFeedback'

/**
 * Drop 五阶段状态机契约测试（Wave D-2 · Grammar §14/§15 + tldraw hinting 协议）。
 *
 * 环境说明：本项目 vitest 走 node 环境（无 jsdom，仓内先例见
 * src/features/ui/__tests__/ObjectOrbit.test.tsx 头注释）——useSemanticDropFeedback
 * 的 React 渲染级时间线无法在此驱动，本文件以纯函数全表断言 + 时间线时长常量
 * 契约（与 ui-primitives.css 既有动画时长一一对应，禁散写魔数）收口。
 */

const HIT_AND_NEAR: DropProximityInput = { hitTarget: true, nearLegalTarget: true }
const HIT_ONLY: DropProximityInput = { hitTarget: true, nearLegalTarget: false }
const NEAR_ONLY: DropProximityInput = { hitTarget: false, nearLegalTarget: true }
const MISS_ALL: DropProximityInput = { hitTarget: false, nearLegalTarget: false }

describe('proximityPhase 真值表（hitTarget × nearLegalTarget 四组合）', () => {
  it('命中且接近 → receptive（命中优先，§14 第 2 阶段）', () => {
    expect(proximityPhase(HIT_AND_NEAR)).toBe('receptive')
  })

  it('命中不接近 → receptive', () => {
    expect(proximityPhase(HIT_ONLY)).toBe('receptive')
  })

  it('未命中但接近 → approaching（§14 第 1 阶段，不弹文案不变真实状态）', () => {
    expect(proximityPhase(NEAR_ONLY)).toBe('approaching')
  })

  it('未命中不接近 → idle', () => {
    expect(proximityPhase(MISS_ALL)).toBe('idle')
  })
})

describe('isReceptive / isApproaching / isCommit 判定 helper', () => {
  it('isReceptive 只看 hitTarget（命中即接收）', () => {
    expect(isReceptive(HIT_AND_NEAR)).toBe(true)
    expect(isReceptive(HIT_ONLY)).toBe(true)
    expect(isReceptive(NEAR_ONLY)).toBe(false)
    expect(isReceptive(MISS_ALL)).toBe(false)
  })

  it('isApproaching 只在未命中且接近时为真（接近≠接收）', () => {
    expect(isApproaching(NEAR_ONLY)).toBe(true)
    expect(isApproaching(HIT_AND_NEAR)).toBe(false)
    expect(isApproaching(HIT_ONLY)).toBe(false)
    expect(isApproaching(MISS_ALL)).toBe(false)
  })

  it('isCommit：commit/settle 为真，其余四阶段为假', () => {
    const phases: DropPhase[] = ['idle', 'approaching', 'receptive', 'accept', 'commit', 'settle']
    expect(phases.filter(isCommit)).toEqual(['commit', 'settle'])
  })
})

describe('advanceDropPhase committed 推进链（accept→commit→settle 单向、settle 停留）', () => {
  it('accept + committed → commit（松手后 proximity 不再参与）', () => {
    expect(advanceDropPhase('accept', MISS_ALL, true)).toBe('commit')
    expect(advanceDropPhase('accept', HIT_ONLY, true)).toBe('commit')
  })

  it('commit + committed → settle', () => {
    expect(advanceDropPhase('commit', MISS_ALL, true)).toBe('settle')
  })

  it('settle + committed → settle（停留，不溢出）', () => {
    expect(advanceDropPhase('settle', MISS_ALL, true)).toBe('settle')
  })

  it('连续推进整链：accept → commit → settle → settle（时间线复用同一函数）', () => {
    let phase: DropPhase = 'accept'
    phase = advanceDropPhase(phase, MISS_ALL, true)
    expect(phase).toBe('commit')
    phase = advanceDropPhase(phase, MISS_ALL, true)
    expect(phase).toBe('settle')
    phase = advanceDropPhase(phase, MISS_ALL, true)
    expect(phase).toBe('settle')
  })

  it('committed 只接管 accept/commit 两档：idle/approaching/receptive 原地停留（时间线唯一入口是 accept）', () => {
    expect(advanceDropPhase('idle', MISS_ALL, true)).toBe('idle')
    expect(advanceDropPhase('approaching', HIT_ONLY, true)).toBe('approaching')
    expect(advanceDropPhase('receptive', MISS_ALL, true)).toBe('receptive')
  })
})

describe('未 committed：accept/commit/settle 不被 proximity 拉回（防闪回）', () => {
  it('accept + 接近 → 仍 accept（等 onDrop 确认，不闪回 approaching）', () => {
    expect(advanceDropPhase('accept', NEAR_ONLY, false)).toBe('accept')
  })

  it('accept + 全空 → 仍 accept', () => {
    expect(advanceDropPhase('accept', MISS_ALL, false)).toBe('accept')
  })

  it('commit + 全空 → 仍 commit', () => {
    expect(advanceDropPhase('commit', MISS_ALL, false)).toBe('commit')
  })

  it('settle + 命中 → 仍 settle（不回 receptive）', () => {
    expect(advanceDropPhase('settle', HIT_ONLY, false)).toBe('settle')
  })
})

describe('松手未命中回 idle（tldraw：松手/取消清空；HUD 零侵入）', () => {
  it('receptive + 全空 → idle', () => {
    expect(advanceDropPhase('receptive', MISS_ALL, false)).toBe('idle')
  })

  it('approaching + 全空 → idle', () => {
    expect(advanceDropPhase('approaching', MISS_ALL, false)).toBe('idle')
  })

  it('idle + 全空 → idle（幂等）', () => {
    expect(advanceDropPhase('idle', MISS_ALL, false)).toBe('idle')
  })

  it('手势进行中空间子阶段可双向流动：idle→approaching→receptive→approaching', () => {
    let phase: DropPhase = 'idle'
    phase = advanceDropPhase(phase, NEAR_ONLY, false)
    expect(phase).toBe('approaching')
    phase = advanceDropPhase(phase, HIT_ONLY, false)
    expect(phase).toBe('receptive')
    phase = advanceDropPhase(phase, NEAR_ONLY, false)
    expect(phase).toBe('approaching')
  })
})

describe('阈值与时间线时长契约（禁散写魔数：与 ui-primitives.css 一一对应）', () => {
  it('DROP_PHASE_NEAR_PX 为正数（接近判定阈值）', () => {
    expect(DROP_PHASE_NEAR_PX).toBeGreaterThan(0)
    expect(Number.isFinite(DROP_PHASE_NEAR_PX)).toBe(true)
  })

  it('accept 停留 230ms ≥ accept 段光扫 220ms（ui-primitives.css 667 行 sweep）', () => {
    expect(DROP_ACCEPT_HOLD_MS).toBe(230)
    expect(DROP_ACCEPT_HOLD_MS).toBeGreaterThanOrEqual(220)
  })

  it('commit 停留 280ms = 光扫 250ms + delay 30ms（ui-primitives.css 672-673 行）', () => {
    expect(DROP_COMMIT_HOLD_MS).toBe(250 + 30)
  })

  it('settle 停留 260ms = settle-out 淡出（ui-primitives.css 695 行 --lcos-ui-slow）', () => {
    expect(DROP_SETTLE_OUT_MS).toBe(260)
  })

  it('整条 accept→idle 时间线 770ms ≤ 800ms（§15 short settle：说完话即退场）', () => {
    expect(DROP_ACCEPT_HOLD_MS + DROP_COMMIT_HOLD_MS + DROP_SETTLE_OUT_MS).toBe(770)
    expect(DROP_ACCEPT_HOLD_MS + DROP_COMMIT_HOLD_MS + DROP_SETTLE_OUT_MS).toBeLessThanOrEqual(800)
  })
})
