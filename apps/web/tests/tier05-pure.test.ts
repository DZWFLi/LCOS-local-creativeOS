/**
 * Tier 0.5 波纯函数/轻组件测试：runEvents / threadModel / workflowModel / ToolResultCard。
 * 组件断言沿用项目现有约定（见 ocr-image.test.tsx）：renderToStaticMarkup 快照 DOM 结构。
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { buildRunEventWakePrompt, describeRunEvent, type LcosRunEvent } from '../src/features/workflow/runEvents'
import { branchReplyCounts, resolveBranchRoot, threadDescendants } from '../src/features/context/threadModel'
import {
  deriveWorkflowNameFromMarkdown,
  liveWorkflowSpecFromSource,
  parseWorkflowFile,
  serializeWorkflowFile,
  slugifyWorkflowName,
} from '../src/features/workflow/workflowModel'
import { ToolResultCard, toolResultStatusLabel } from '../src/features/workflow/ToolResultCard'

describe('runEvents — Run 生命周期事件契约', () => {
  it('describe 覆盖全部已知事件类型', () => {
    expect(describeRunEvent({ type: 'run-started', runId: 'r1', instruction: '整理画布' })).toBe('开始执行：整理画布')
    expect(describeRunEvent({ type: 'step-attached', stepId: 's1', viewIds: ['v1', 'v2'] })).toBe('已挂接步骤 s1（2 个视图）')
    expect(describeRunEvent({ type: 'run-completed', runId: 'r1', summary: '已生成草稿' })).toBe('执行完成：已生成草稿')
    expect(describeRunEvent({ type: 'run-failed', runId: 'r1', error: '连接中断' })).toBe('执行失败：连接中断')
    expect(describeRunEvent({ type: 'changeset-proposed', changeSetId: 'cs1', title: '改三处' })).toBe('已提交变更集：改三处')
    expect(describeRunEvent({ type: 'accept-requested', changeSetId: 'cs1' })).toBe('请求确认变更集 cs1')
    expect(describeRunEvent({ type: 'accept-succeeded', changeSetId: 'cs1' })).toBe('变更集已确认：cs1')
    expect(describeRunEvent({ type: 'accept-failed', changeSetId: 'cs1', error: '版本冲突' })).toBe('确认失败：版本冲突')
    expect(describeRunEvent({ type: 'run-waiting-input', runId: 'r1', question: '用哪个版本？' })).toBe('等待输入：用哪个版本？')
  })

  it('未知类型走 fallback 文案且不崩溃', () => {
    expect(describeRunEvent({ type: 'mystery-event' })).toBe('项目状态已更新')
    expect(describeRunEvent({ type: 'future-event', payload: { deep: true } })).toBe('项目状态已更新')
  })

  it('wake prompt：声明系统事件来源、逐行列出、允许沉默', () => {
    const prompt = buildRunEventWakePrompt([
      { type: 'run-started', runId: 'r1', instruction: '整理画布' },
      { type: 'accept-failed', changeSetId: 'cs1', error: '版本冲突' },
    ])
    expect(prompt).toContain('系统事件')
    expect(prompt).toContain('- 开始执行：整理画布')
    expect(prompt).toContain('- 确认失败：版本冲突')
    expect(prompt).toContain('保持沉默')
  })

  it('未知事件在 wake prompt 中也走 fallback', () => {
    const events: readonly LcosRunEvent[] = [{ type: 'something-new' }]
    expect(buildRunEventWakePrompt(events)).toContain('- 项目状态已更新')
  })
})

describe('threadModel — 线程分支模型', () => {
  interface Note { readonly id: string; readonly replyTo?: string }

  it('A↔B 互指不死循环：环上条目无根', () => {
    const a: Note = { id: 'a', replyTo: 'b' }
    const b: Note = { id: 'b', replyTo: 'a' }
    const byId = new Map<string, Note>([['a', a], ['b', b]])
    expect(resolveBranchRoot(a, byId)).toBeUndefined()
    expect(resolveBranchRoot(b, byId)).toBeUndefined()
    // branchReplyCounts 同样必须终止且不计数
    expect(branchReplyCounts([a, b]).size).toBe(0)
  })

  it('branchReplyCounts：按悬挂根计数；链终止于集合内顶级条目不算分支', () => {
    const top: Note = { id: 'top' } // 集合内顶级条目（无 replyTo）
    const m1: Note = { id: 'm1', replyTo: 'top' } // 链走到集合内顶级条目 → 无根
    const c1: Note = { id: 'c1', replyTo: 'root' } // root 不在集合内 → 悬挂父即根
    const c2: Note = { id: 'c2', replyTo: 'c1' } // 隔代同样归到悬挂根
    const standalone: Note = { id: 'other' } // 顶级条目自身不计
    const counts = branchReplyCounts([top, m1, c1, c2, standalone])
    expect(counts.get('root')).toBe(2)
    expect(counts.has('top')).toBe(false)
    expect(counts.has('other')).toBe(false)
  })

  it('threadDescendants：收集悬挂根下全部后代（含隔代），保持原顺序', () => {
    const c1: Note = { id: 'c1', replyTo: 'root' }
    const c2: Note = { id: 'c2', replyTo: 'c1' }
    const m1: Note = { id: 'm1', replyTo: 'top' } // top 同样不在集合内
    const list = [c1, c2, m1]
    expect(threadDescendants('root', list).map((entry) => entry.id)).toEqual(['c1', 'c2'])
    expect(threadDescendants('top', list).map((entry) => entry.id)).toEqual(['m1'])
  })
})

describe('workflowModel — SKILL.md 工作流模型', () => {
  it('parse → serialize 往返：name/description/trigger/body 保持', () => {
    const spec = {
      name: '每日整理',
      description: '每天早上整理收件箱',
      body: '# 每日整理\n\n按清单清理。',
      trigger: { schedule: '0 9 * * *', isEnabled: true },
      sourceRef: null,
    }
    const parsed = parseWorkflowFile(serializeWorkflowFile(spec))
    expect(parsed).not.toBeNull()
    expect(parsed?.name).toBe('每日整理')
    expect(parsed?.description).toBe('每天早上整理收件箱')
    expect(parsed?.body).toBe('# 每日整理\n\n按清单清理。')
    expect(parsed?.trigger).toEqual({ schedule: '0 9 * * *', isEnabled: true })
    expect(parsed?.sourceRef).toBeNull()
  })

  it('liveWorkflowSpecFromSource：sourceRef 落入 metadata.source 并在往返后保留', () => {
    const spec = liveWorkflowSpecFromSource({ name: '外部技能', source: 'skills/foo/SKILL.md' })
    expect(spec.sourceRef).toBe('skills/foo/SKILL.md')
    expect(spec.trigger).toBeNull()
    expect(spec.body).toContain('活引用')
    const parsed = parseWorkflowFile(serializeWorkflowFile(spec))
    expect(parsed?.sourceRef).toBe('skills/foo/SKILL.md')
    expect(parsed?.name).toBe('外部技能')
    expect(parsed?.body).toContain('skills/foo/SKILL.md')
  })

  it('空文本解析为 null；名称派生与 slugify', () => {
    expect(parseWorkflowFile('')).toBeNull()
    expect(deriveWorkflowNameFromMarkdown('#  章节标题 `code`\n正文')).toBe('章节标题 code')
    expect(deriveWorkflowNameFromMarkdown('')).toBeNull()
    expect(slugifyWorkflowName('Daily Cleanup!')).toBe('daily-cleanup')
    expect(slugifyWorkflowName('中文技能')).toBe('workflow')
  })
})

describe('ToolResultCard — 折叠卡 DOM 结构', () => {
  it('渲染 details/summary/pre，status class 与流式 aria-live 正确', () => {
    const html = renderToStaticMarkup(createElement(ToolResultCard, {
      snapshot: {
        toolCallId: 'tc-1',
        kind: 'run',
        status: 'running',
        command: '整理收件箱',
        workingDirectory: 'E:\\project',
        output: '正在扫描……',
        isStreaming: true,
      },
    }))
    expect(html).toContain('<details')
    expect(html).toContain('data-tool-result-kind="run"')
    expect(html).toContain('data-tool-result-status="running"')
    expect(html).toContain('lcos-tool-result-state state-running')
    expect(html).toContain('<summary')
    expect(html).toContain('<pre')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('data-tool-working-directory')
  })

  it('failed 状态渲染 diff pre；无 summary/output 时不渲染 detail pre', () => {
    const html = renderToStaticMarkup(createElement(ToolResultCard, {
      snapshot: { kind: 'shell', status: 'failed', command: 'npm test', diff: '- a\n+ b' },
    }))
    expect(html).toContain('state-failed')
    expect(html).toContain('data-tool-result-diff')
    expect((html.match(/<pre/g) ?? []).length).toBe(1)
  })

  it('expanded 展开卡片，done 状态 class 正确', () => {
    const html = renderToStaticMarkup(createElement(ToolResultCard, {
      expanded: true,
      snapshot: { kind: 'run', status: 'done', command: '整理收件箱', summary: '已完成' },
    }))
    expect(html).toContain('open=""')
    expect(html).toContain('state-done')
    expect(html).toContain('已完成')
  })

  it('GUI 收口：状态枚举不直出——running 卡片显示中文「运行中」而非英文 running', () => {
    const html = renderToStaticMarkup(createElement(ToolResultCard, {
      snapshot: { kind: 'shell', status: 'running', command: 'npm test', output: 'x' },
    }))
    expect(html).toContain('运行中')
    expect(html).not.toContain('>running<')
  })

  it('toolResultStatusLabel 四态映射：pending/running/done/failed → 中文', () => {
    expect(toolResultStatusLabel('pending')).toBe('等待中')
    expect(toolResultStatusLabel('running')).toBe('运行中')
    expect(toolResultStatusLabel('done')).toBe('完成')
    expect(toolResultStatusLabel('failed')).toBe('失败')
  })
})
