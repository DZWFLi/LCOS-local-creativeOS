import type { RunReview } from '@local-creative-os/contracts'

export interface CodexDispatchSessionInput {
  readonly sessionId: string
  readonly guiActive?: boolean
}

export type CodexDispatchDecision = 'dispatch_existing' | 'spawn_new' | 'wait'

export interface CodexDispatchPlanItem {
  readonly runId: string
  readonly outputIntent: string
  readonly instruction: string
  readonly decision: CodexDispatchDecision
  readonly sessionId?: string
  readonly projectRoot?: string
  readonly reason: string
}

/**
 * Core 判断 Codex 任务的派单方式：
 * - 有可用 CLI 会话（未标 GUI 占用）→ 送进现有会话；
 * - 只有 GUI 占用会话 → 等待（不抢、也不重复开会话）；
 * - 完全没有注册会话 → 拉起新会话。
 */
export function planCodexDispatch(
  runs: readonly RunReview[],
  projectRoot: string,
  sessions: readonly CodexDispatchSessionInput[],
): readonly CodexDispatchPlanItem[] {
  const pending = runs.filter((review) =>
    review.run.provider === 'codex'
    && ['created', 'queued', 'running'].includes(review.run.status)
    && review.dispatch.status === 'bound')
  const available = sessions.find((session) => session.sessionId && !session.guiActive)
  const allBusy = sessions.length > 0 && available === undefined

  return pending.map((review) => {
    const runId = String(review.run.id)
    if (available !== undefined) {
      return {
        runId,
        outputIntent: review.run.outputIntent,
        instruction: review.run.instruction.slice(0, 200),
        decision: 'dispatch_existing' as const,
        sessionId: available.sessionId,
        reason: '已注册可用的 CLI 会话，直接派单。',
      }
    }
    if (allBusy) {
      return {
        runId,
        outputIntent: review.run.outputIntent,
        instruction: review.run.instruction.slice(0, 200),
        decision: 'wait' as const,
        reason: '项目会话正被 GUI 占用，等待空闲；不抢话也不重复开会话。',
      }
    }
    return {
      runId,
      outputIntent: review.run.outputIntent,
      instruction: review.run.instruction.slice(0, 200),
      decision: 'spawn_new' as const,
      projectRoot,
      reason: '该项目没有注册 CLI 会话，需要拉起新会话执行。',
    }
  })
}
