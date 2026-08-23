import { CheckSquare, FileText, Link2, ListChecks, Sparkles, Square } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { CanvasNode } from '../../model'

/**
 * Real tool slots (2026-08-24):
 * - 页面总结 works offline: a deterministic local digest of the active page.
 * - 临时待办 is a session-local checklist (never written to Project Truth).
 * - 两页比较 / 文案版本对比 stay disabled until the artifact revision API
 *   lands; kept visible as honest capability slots, not fake buttons.
 */

interface TodoItem { readonly id: number; readonly text: string; readonly done: boolean }

export function WebWorkbench({ pages, onOpenPage }: {
  readonly pages: readonly CanvasNode[]
  readonly onOpenPage?: (id: string) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(pages[0]?.id ?? null)
  const [note, setNote] = useState('')
  const [summary, setSummary] = useState<string | null>(null)
  const [todos, setTodos] = useState<readonly TodoItem[]>([])
  const [todoDraft, setTodoDraft] = useState('')
  const active = useMemo(() => pages.find((page) => page.id === activeId) ?? pages[0], [activeId, pages])

  const summarizeActive = () => {
    if (!active) return
    const lines = [
      active.title,
      `  - 类型 ${active.kind}`,
      ...(active.subtitle ? [`  - 摘要 ${active.subtitle}`] : []),
      ...(active.sourceKind ? [`  - 来源 ${active.sourceKind}`] : []),
      ...(active.noteBody ? active.noteBody.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 4).map((line) => `  - 正文 ${line}`) : []),
    ]
    setSummary(lines.join('\n'))
  }

  const addTodo = () => {
    const text = todoDraft.trim()
    if (!text) return
    setTodos((current) => [...current, { id: Date.now(), text, done: false }])
    setTodoDraft('')
  }

  return <div className="lcos-web-workbench" data-testid="web-workbench">
    <header><div><strong>网页工作台</strong><small>项目页面、临时笔记和 Agent 工具入口</small></div><span>{pages.length} 项</span></header>
    {pages.length ? <>
      <nav aria-label="当前工作页面">{pages.slice(0, 8).map((page) => <button type="button" key={page.id} className={page.id === active?.id ? 'active' : ''} onClick={() => setActiveId(page.id)}>{page.title}</button>)}</nav>
      <section className="lcos-web-workbench-pages"><div className="lcos-web-workbench-page"><span>当前项目对象</span><strong>{active?.title}</strong><small>{active?.subtitle || active?.sourceKind || 'Linked Project View'}</small></div><button type="button" className="lcos-web-workbench-open" disabled={!active || !onOpenPage} onClick={() => active && onOpenPage?.(active.id)}><Link2 size={13}/>打开对象</button></section>
    </> : <div className="lcos-web-workbench-empty">把网页或文档对象拖进 Workbench；这里只保存稳定引用。</div>}
    <label className="lcos-web-workbench-note"><span><FileText size={13}/>Quick Note <small>临时，不写入 Project</small></span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="记下一条临时判断…" rows={3}/></label>
    <section className="lcos-web-workbench-tools">
      <header><span><Sparkles size={13}/>Agent Tool slots</span><small>页面总结与临时待办已可用</small></header>
      <div className="lcos-web-workbench-tool-grid">
        <button type="button" className="lcos-web-workbench-tool" disabled={!active} title="对当前对象生成本地摘要（离线可用）" onClick={summarizeActive}>页面总结</button>
        <button type="button" className="lcos-web-workbench-tool" disabled title="需要 Core artifact revision API（已知债，下轮接入）">两页比较</button>
        <button type="button" className="lcos-web-workbench-tool" disabled title="需要 Core artifact revision API（已知债，下轮接入）">文案版本对比</button>
      </div>
      {summary !== null && <div className="lcos-web-workbench-tool-result" data-testid="web-workbench-summary"><span><FileText size={12}/>页面总结 · 本地</span><pre>{summary}</pre></div>}
      <div className="lcos-web-workbench-todos" data-testid="web-workbench-todos">
        <div className="lcos-web-workbench-todo-input">
          <ListChecks size={13}/>
          <input value={todoDraft} onChange={(event) => setTodoDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addTodo() }} placeholder="加一条临时待办，回车保存（仅本会话）"/>
          <button type="button" onClick={addTodo} disabled={!todoDraft.trim()}>添加</button>
        </div>
        {todos.length > 0 && <ul>{todos.map((todo) => <li key={todo.id} className={todo.done ? 'is-done' : ''}>
          <button type="button" aria-label={todo.done ? '标记未完成' : '标记完成'} onClick={() => setTodos((current) => current.map((item) => item.id === todo.id ? { ...item, done: !item.done } : item))}>{todo.done ? <CheckSquare size={13}/> : <Square size={13}/>}</button>
          <span>{todo.text}</span>
          <button type="button" aria-label="删除待办" className="is-remove" onClick={() => setTodos((current) => current.filter((item) => item.id !== todo.id))}>×</button>
        </li>)}</ul>}
      </div>
    </section>
  </div>
}
