import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { RunEvent } from '@local-creative-os/contracts'
import type { ActiveRun } from '../src/model'
import { buildRunOutline } from '../src/features/workflow/RunOutlineProvider'
import { RunOutlinePanel } from '../src/features/workflow/RunOutlinePanel'

function runFixture(overrides: Partial<ActiveRun> = {}): ActiveRun {
  return {
    id: 'run-1',
    status: 'running',
    command: '把第二页的图表改成柱状图',
    targetIds: [],
    contextIds: [],
    processNodeId: 'node-1',
    reviewStatus: 'idle',
    changedFiles: [],
    createdAt: '2026-08-25T12:00:00.000Z',
    ...overrides,
  }
}

/** 事件 fixture：id/runId 是 brand 类型，参数层收裸字符串、内部统一 cast。 */
type RunEventOverrides = Partial<Omit<RunEvent, 'id' | 'runId'>> & { readonly id?: string; readonly runId?: string }

function eventFixture(overrides: RunEventOverrides = {}): RunEvent {
  const { id, runId, ...rest } = overrides
  return {
    id: (id ?? 'ev-1') as RunEvent['id'],
    runId: (runId ?? 'run-1') as RunEvent['runId'],
    sequence: 1,
    type: 'run.started',
    occurredAt: '2026-08-25T12:00:01.000Z',
    payload: {},
    ...rest,
  }
}

describe('RUN-OUTLINE buildRunOutline 投影', () => {
  it('instruction 条目：run.status → 条目状态映射（failed/running/completed/queued/cancelled）', () => {
    expect(buildRunOutline(runFixture({ status: 'running' }))[0]).toMatchObject({ kind: 'instruction', label: '把第二页的图表改成柱状图', status: 'running' })
    expect(buildRunOutline(runFixture({ status: 'failed' }))[0].status).toBe('failed')
    expect(buildRunOutline(runFixture({ status: 'completed' }))[0].status).toBe('done')
    expect(buildRunOutline(runFixture({ status: 'queued' }))[0].status).toBe('pending')
    expect(buildRunOutline(runFixture({ status: 'cancelled' }))[0].status).toBe('info')
  })

  it('waiting_input / review 暂停态：instruction pending + 等待徽标', () => {
    const waiting = buildRunOutline(runFixture({ status: 'waiting_input' }))[0]
    expect(waiting.status).toBe('pending')
    expect(waiting.badge).toBe('等待确认')
    const review = buildRunOutline(runFixture({ status: 'review' }))[0]
    expect(review.status).toBe('pending')
    expect(review.badge).toBe('结果待确认')
  })

  it('event 条目：消费 describeRunEvent 中文文案；failed/completed 事件带状态，未知类型走兜底', () => {
    const events = buildRunOutline(runFixture(), [], [
      eventFixture({ id: 'ev-1', type: 'run.started', sequence: 1 }),
      eventFixture({ id: 'ev-2', type: 'run.waiting_input', sequence: 2, payload: { question: '要保留原图例吗？' } }),
      eventFixture({ id: 'ev-3', type: 'run.completed', sequence: 3 }),
      eventFixture({ id: 'ev-4', type: 'run.failed', sequence: 4 }),
      eventFixture({ id: 'ev-5', type: 'run.queued', sequence: 5 }),
    ]).filter((item) => item.kind === 'event')
    expect(events.map((item) => item.status)).toEqual(['info', 'info', 'done', 'failed', 'info'])
    expect(events[0].label).toBe('开始执行：把第二页的图表改成柱状图')
    expect(events[1].label).toBe('等待输入：要保留原图例吗？')
    expect(events[4].label).toBe('项目状态已更新')
  })

  it('event 条目：过滤其他 Run 的事件', () => {
    const events = buildRunOutline(runFixture(), [], [
      eventFixture({ id: 'ev-1', runId: 'other-run' }),
      eventFixture({ id: 'ev-2', sequence: 2 }),
    ]).filter((item) => item.kind === 'event')
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('event:ev-2')
  })

  it('result 条目：providerError 优先（failed），否则 resultSummary（done），执行中不产出', () => {
    expect(buildRunOutline(runFixture({ status: 'failed', providerError: 'provider 超时' })).at(-1)).toMatchObject({ kind: 'result', status: 'failed', label: 'provider 超时' })
    expect(buildRunOutline(runFixture({ status: 'completed', resultSummary: '已生成 3 页修订' })).at(-1)).toMatchObject({ kind: 'result', status: 'done', label: '已生成 3 页修订' })
    expect(buildRunOutline(runFixture()).some((item) => item.kind === 'result')).toBe(false)
  })

  it('step 条目：步骤链投影（status/viewIds 透传，位于 instruction 与 event 之间）', () => {
    const items = buildRunOutline(runFixture(), [
      { id: 's1', label: '读取材料', status: 'done', viewIds: ['v1', 'v2'] },
      { id: 's2', label: '改写图表', status: 'running' },
    ])
    expect(items.map((item) => item.kind)).toEqual(['instruction', 'step', 'step'])
    expect(items[1]).toMatchObject({ label: '读取材料', status: 'done', viewIds: ['v1', 'v2'] })
    expect(items[2]).toMatchObject({ label: '改写图表', status: 'running' })
  })
})

describe('RUN-OUTLINE RunOutlinePanel 静态渲染', () => {
  it('面板结构：状态横幅 chip + 条目行 data-kind/data-status + 行级 aria', () => {
    const items = buildRunOutline(runFixture({ status: 'running' }), [], [eventFixture({ type: 'run.started' })])
    const html = renderToStaticMarkup(<RunOutlinePanel status="running" items={items} />)
    expect(html).toContain('data-testid="run-outline"')
    expect(html).toContain('data-run-status="running"')
    expect(html).toContain('class="lcos-run-outline-state state-running"')
    expect(html).toContain('data-kind="instruction"')
    expect(html).toContain('data-kind="event"')
    expect(html).toContain('class="lcos-run-outline-mark status-running"')
    expect(html).toContain('class="lcos-run-outline-mark status-info"')
    expect(html).toContain('role="list"')
    expect(html).toContain('role="listitem"')
    expect(html).toContain('aria-hidden="true"')
  })

  it('面板：waiting_input 暂停徽标 + pending 空心行', () => {
    const items = buildRunOutline(runFixture({ status: 'waiting_input' }), [], [
      eventFixture({ type: 'run.waiting_input', payload: { question: '要保留原图例吗？' } }),
    ])
    const html = renderToStaticMarkup(<RunOutlinePanel status="waiting_input" items={items} />)
    expect(html).toContain('class="lcos-run-outline-state state-waiting_input"')
    expect(html).toContain('class="lcos-run-outline-mark status-pending"')
    expect(html).toContain('lcos-run-outline-badge')
    expect(html).toContain('等待确认')
  })

  it('面板：completed Run 打勾行 + result 条目 + 可展开 detail', () => {
    const items = buildRunOutline(runFixture({ status: 'completed', resultSummary: '已生成 3 页修订' }), [], [
      eventFixture({ type: 'run.started' }),
      eventFixture({ id: 'ev-2', type: 'run.completed', sequence: 2 }),
    ])
    const html = renderToStaticMarkup(<RunOutlinePanel status="completed" items={items} />)
    expect(html).toContain('class="lcos-run-outline-mark status-done"')
    expect(html).toContain('data-kind="result"')
    expect(html).toContain('已生成 3 页修订')
    expect(html).toContain('<details class="lcos-run-outline-item-detail"')
    expect(html).toContain('class="lcos-run-outline-state state-completed"')
  })

  it('面板：failed Run 标红行与 error 状态 chip', () => {
    const items = buildRunOutline(runFixture({ status: 'failed', providerError: 'boom' }))
    const html = renderToStaticMarkup(<RunOutlinePanel status="failed" items={items} />)
    expect(html).toContain('class="lcos-run-outline-mark status-failed"')
    expect(html).toContain('class="lcos-run-outline-state state-failed"')
  })

  it('进度摘要：已发生的事件计入已完成（事件每来一条 +1）', () => {
    const items = buildRunOutline(runFixture({ status: 'running' }), [], [
      eventFixture({ id: 'ev-1', type: 'run.started', sequence: 1 }),
      eventFixture({ id: 'ev-2', type: 'run.review_ready', sequence: 2 }),
    ])
    const html = renderToStaticMarkup(<RunOutlinePanel status="running" items={items} />)
    expect(html).toContain('data-testid="run-outline-progress"')
    expect(html).toContain('2/3')
  })

  it('空态：无条目时显示空态文案、不渲染列表', () => {
    const html = renderToStaticMarkup(<RunOutlinePanel status="running" items={[]} />)
    expect(html).toContain('任务开始后，这里会显示执行进度。')
    expect(html).not.toContain('role="listitem"')
    expect(html).not.toContain('data-testid="run-outline-progress"')
  })
})
