import { FileText, Link2, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { CanvasNode } from '../../model'

const tools = ['页面总结', '两页比较', '临时待办', '文案版本对比'] as const

/** Lightweight in-surface workbench over real Project View references. */
export function WebWorkbench({ pages, onOpenPage }: {
  readonly pages: readonly CanvasNode[]
  readonly onOpenPage?: (id: string) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(pages[0]?.id ?? null)
  const [note, setNote] = useState('')
  const active = useMemo(() => pages.find((page) => page.id === activeId) ?? pages[0], [activeId, pages])
  return <div className="lcos-web-workbench" data-testid="web-workbench">
    <header><div><strong>网页工作台</strong><small>项目页面、临时笔记和 Agent 工具入口</small></div><span>{pages.length} 项</span></header>
    {pages.length ? <>
      <nav aria-label="当前工作页面">{pages.slice(0, 8).map((page) => <button type="button" key={page.id} className={page.id === active?.id ? 'active' : ''} onClick={() => setActiveId(page.id)}>{page.title}</button>)}</nav>
      <section className="lcos-web-workbench-pages"><div className="lcos-web-workbench-page"><span>当前项目对象</span><strong>{active?.title}</strong><small>{active?.subtitle || active?.sourceKind || 'Linked Project View'}</small></div><button type="button" className="lcos-web-workbench-open" disabled={!active || !onOpenPage} onClick={() => active && onOpenPage?.(active.id)}><Link2 size={13}/>打开对象</button></section>
    </> : <div className="lcos-web-workbench-empty">把网页或文档对象拖进 Workbench；这里只保存稳定引用。</div>}
    <label className="lcos-web-workbench-note"><span><FileText size={13}/>Quick Note <small>临时，不写入 Project</small></span><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="记下一条临时判断…" rows={3}/></label>
    <section className="lcos-web-workbench-tools"><header><span><Sparkles size={13}/>Agent Tool slots</span><small>等待真实 Agent Tool Runtime</small></header><div>{tools.map((tool) => <button type="button" key={tool} disabled title="当前 Runtime 尚未接通">{tool}</button>)}</div></section>
  </div>
}
