import { Braces, ChevronUp, Code2, FileText } from 'lucide-react'

interface ExportDrawerProps {
  open: boolean
  onToggle: () => void
}

export function ExportDrawer({ open, onToggle }: ExportDrawerProps) {
  return (
    <section className={`export-drawer${open ? ' is-open' : ''}`}>
      <button className="drawer-handle" type="button" onClick={onToggle} aria-expanded={open}>
        <span>Context / Export</span><ChevronUp className={open ? 'is-rotated' : ''} size={16} />
      </button>
      <div className="drawer-content">
        <button type="button"><FileText size={18} /><span><strong>导出 Markdown</strong><small>当前评测上下文</small></span></button>
        <button type="button"><Braces size={18} /><span><strong>导出 JSON</strong><small>统一结构化数据</small></span></button>
        <button type="button"><Code2 size={18} /><span><strong>复制 Codex Handoff</strong><small>复制结构化评测上下文</small></span></button>
      </div>
    </section>
  )
}
