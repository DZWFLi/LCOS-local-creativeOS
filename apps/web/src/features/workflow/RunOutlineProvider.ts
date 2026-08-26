/**
 * Run 过程大纲纯数据层（第一梯队 ④）。
 * 条目分类参考 grok-bot conversation-outline-provider（MIT）的五类结构
 * （user / thinking / assistant-text / send-message / tool-call →
 * LCOS 化为 instruction / step / tool / event / result）。
 * 差异：grok-bot 用外部 store + useSyncExternalStore；LCOS 的 Run 数据全在 React state，
 * 这里退化为纯投影函数 buildRunOutline(run, steps, events)，面板只读消费。
 * 纯函数零副作用。
 */

import type { RunEvent } from '@local-creative-os/contracts'
import { runStatusLabel, type ActiveRun } from '../../model'
import { describeRunEvent, type LcosRunEvent } from './runEvents'

export type RunOutlineItemKind = 'instruction' | 'step' | 'tool' | 'event' | 'result'
export type RunOutlineItemStatus = 'pending' | 'running' | 'done' | 'failed' | 'info'

export interface RunOutlineItem {
  /** 条目稳定 id（React key + 后续节点定位锚点）。 */
  readonly id: string
  readonly kind: RunOutlineItemKind
  readonly label: string
  readonly status: RunOutlineItemStatus
  /** 可展开详情（时间戳 / 错误全文等），缺省不渲染展开区。 */
  readonly detail?: string
  /** 关联的 presentation view id（步骤材料；定位到节点留后续）。 */
  readonly viewIds?: readonly string[]
  /** 行内徽标：waiting_input / review 等暂停态提示。 */
  readonly badge?: string
}

/**
 * 步骤链投影输入。0.1 的 Run 尚未与 Workflow 步骤链关联
 * （ActiveRun 无 step 字段，查 model.ts 确认），调用方传空数组即可；
 * 关联方式出现后由调用方把步骤链映射进来，本层不改。
 */
export interface RunOutlineStep {
  readonly id: string
  readonly label: string
  readonly status: RunOutlineItemStatus
  readonly detail?: string
  readonly viewIds?: readonly string[]
}

/** run.status → instruction 条目状态：终态定格，暂停态 pending（徽标另算），cancelled 中性。 */
function instructionStatus(run: ActiveRun): RunOutlineItemStatus {
  switch (run.status) {
    case 'failed': return 'failed'
    case 'running': return 'running'
    case 'completed': return 'done'
    case 'queued':
    case 'waiting_input':
    case 'review': return 'pending'
    default: return 'info' // cancelled：已撤回按中性记录
  }
}

/** instruction 条目徽标：暂停态（等待输入 / 待确认）追加提示文案，其余不加。 */
function instructionBadge(run: ActiveRun): string | undefined {
  return run.status === 'waiting_input' || run.status === 'review' ? runStatusLabel[run.status] : undefined
}

/** 事件条目状态：failed 事件标红、completed 事件打勾，其余历史事实按中性记录。 */
function eventStatus(type: RunEvent['type']): RunOutlineItemStatus {
  if (type === 'run.failed') return 'failed'
  if (type === 'run.completed') return 'done'
  return 'info'
}

/** contract RunEvent payload → 字符串字段（payload 是 JsonValue，只认对象键）。 */
function payloadText(event: RunEvent, key: string): string | undefined {
  const payload = event.payload
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return undefined
  const value = (payload as Record<string, unknown>)[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** contract RunEvent（点号类型）→ LcosRunEvent（横线类型），交给 describeRunEvent 出中文文案。 */
function toLcosRunEvent(event: RunEvent, run: ActiveRun): LcosRunEvent {
  const runId = String(event.runId)
  switch (event.type) {
    case 'run.started': return { type: 'run-started', runId, instruction: payloadText(event, 'instruction') ?? run.command }
    case 'run.waiting_input': return { type: 'run-waiting-input', runId, question: payloadText(event, 'question') ?? run.inputRequest?.question ?? '' }
    case 'run.completed': return { type: 'run-completed', runId, summary: payloadText(event, 'summary') ?? run.resultSummary ?? '' }
    case 'run.failed': return { type: 'run-failed', runId, error: payloadText(event, 'error') ?? run.providerError ?? '' }
    default: return { type: event.type, runId } // 未知类型走 describeRunEvent 兜底文案
  }
}

/** 事件时间戳（与 WorkRail RunActivity 同格式）；无效时间不产出 detail。 */
function eventDetail(event: RunEvent): string | undefined {
  const time = new Date(String(event.occurredAt))
  return Number.isNaN(time.getTime()) ? undefined : time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/**
 * 把 Run + 步骤链 + RunEvent 序列投影成大纲条目。
 * 顺序：instruction（用户指令）→ step（步骤链）→ event（事件流水）→ result（结果/错误）。
 * 0.1 无独立工具调用数据源，tool 类条目暂不产出（类型保留，面板可渲染）。
 */
export function buildRunOutline(
  run: ActiveRun,
  steps: readonly RunOutlineStep[] = [],
  events: readonly RunEvent[] = [],
): RunOutlineItem[] {
  const items: RunOutlineItem[] = []
  const badge = instructionBadge(run)
  items.push({
    id: `${run.id}:instruction`,
    kind: 'instruction',
    label: run.command,
    status: instructionStatus(run),
    ...(badge === undefined ? {} : { badge }),
  })
  for (const step of steps) {
    items.push({
      id: `step:${step.id}`,
      kind: 'step',
      label: step.label,
      status: step.status,
      ...(step.detail === undefined ? {} : { detail: step.detail }),
      ...(step.viewIds === undefined || step.viewIds.length === 0 ? {} : { viewIds: step.viewIds }),
    })
  }
  for (const event of events) {
    if (String(event.runId) !== String(run.id)) continue // 只投影本 Run 的事件
    const detail = eventDetail(event)
    items.push({
      id: `event:${String(event.id)}`,
      kind: 'event',
      label: describeRunEvent(toLcosRunEvent(event, run)),
      status: eventStatus(event.type),
      ...(detail === undefined ? {} : { detail }),
    })
  }
  if (run.providerError !== undefined && run.providerError.length > 0) {
    items.push({ id: `${run.id}:result`, kind: 'result', label: run.providerError, status: 'failed', detail: run.providerError })
  } else if (run.resultSummary !== undefined && run.resultSummary.length > 0) {
    items.push({ id: `${run.id}:result`, kind: 'result', label: run.resultSummary, status: 'done', detail: run.resultSummary })
  }
  return items
}
