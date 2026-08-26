/**
 * Run 生命周期事件契约（0.5 波）。
 * 语义照抄 grok-bot 的 shared/sand-timeline-events.ts（MIT）：
 * 判别联合 + describe + 未知类型 fallback + wake prompt。
 * LCOS 化：事件类型以现有 Run / ChangeSet 语义枚举。
 * 纯函数零依赖。
 */

export type LcosRunEvent =
  | { readonly type: 'run-started'; readonly runId: string; readonly instruction: string }
  | { readonly type: 'step-attached'; readonly stepId: string; readonly viewIds: readonly string[] }
  | { readonly type: 'run-completed'; readonly runId: string; readonly summary: string }
  | { readonly type: 'run-failed'; readonly runId: string; readonly error: string }
  | { readonly type: 'changeset-proposed'; readonly changeSetId: string; readonly title: string }
  | { readonly type: 'accept-requested'; readonly changeSetId: string }
  | { readonly type: 'accept-succeeded'; readonly changeSetId: string }
  | { readonly type: 'accept-failed'; readonly changeSetId: string; readonly error: string }
  | { readonly type: 'run-waiting-input'; readonly runId: string; readonly question: string }
  /** 未知类型 fallback：允许透传任何事件而不崩溃。 */
  | { readonly type: string; readonly [key: string]: unknown }

/** 未知事件类型的兜底文案（照抄 fallbackForUnknownTimelineEvent 语义：恒返回 fallback）。 */
function fallbackForUnknownRunEvent(_event: unknown, fallback: string): string {
  return fallback
}

/**
 * 把一条 Run 事件翻译成人能读的中文文案。
 * 注意：判别联合带 string 兜底成员，窄化后字段仍是 unknown，所以统一 String() 包一层。
 */
export function describeRunEvent(event: LcosRunEvent): string {
  switch (event.type) {
    case 'run-started':
      return `开始执行：${String(event.instruction)}`
    case 'step-attached':
      return `已挂接步骤 ${String(event.stepId)}（${(event.viewIds as readonly string[] | undefined)?.length ?? 0} 个视图）`
    case 'run-completed':
      return `执行完成：${String(event.summary)}`
    case 'run-failed':
      return `执行失败：${String(event.error)}`
    case 'changeset-proposed':
      return `已提交变更集：${String(event.title)}`
    case 'accept-requested':
      return `请求确认变更集 ${String(event.changeSetId)}`
    case 'accept-succeeded':
      return `变更集已确认：${String(event.changeSetId)}`
    case 'accept-failed':
      return `确认失败：${String(event.error)}`
    case 'run-waiting-input':
      return `等待输入：${String(event.question)}`
    default:
      return fallbackForUnknownRunEvent(event, '项目状态已更新')
  }
}

export const RUN_EVENT_WAKE_CUE = '[event]'

/**
 * 把一批 Run 事件拼成一次唤醒提示（仿 grok-bot buildTimelineEventWakePrompt）：
 * 声明这是系统事件而非用户输入，逐行列出，值得回应就回，否则保持沉默。
 */
export function buildRunEventWakePrompt(events: readonly LcosRunEvent[]): string {
  const lines = events.map((event) => `- ${describeRunEvent(event)}`)
  return [
    `${RUN_EVENT_WAKE_CUE} 项目执行状态刚刚发生了变化。`,
    '这是记录在项目时间线里的系统事件，不是用户在这个应用里输入的内容，也可能是你自己刚完成的动作。',
    ...lines,
    '如果值得向用户说明，就回应；否则保持沉默也没关系。',
  ].join('\n')
}
