import type { ObsidianVaultScanV1 } from '@local-creative-os/contracts'
import { BookOpen, CheckSquare, Search, Square, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { dismissFromBackdrop } from '../ui/dismissibleLayer'

export function ObsidianImportDialog({ scan, busy, error, onClose, onImport }: {
  readonly scan: ObsidianVaultScanV1 | null
  readonly busy: boolean
  readonly error: string | null
  readonly onClose: () => void
  readonly onImport: (relativePaths: readonly string[]) => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!scan) return
    setQuery('')
    setSelected(new Set(scan.noteCount <= 30 ? scan.notes.map((note) => note.relativePath) : []))
  }, [scan])

  const visible = useMemo(() => {
    if (!scan) return []
    const needle = query.trim().toLocaleLowerCase('zh-CN')
    if (!needle) return scan.notes
    return scan.notes.filter((note) => `${note.title} ${note.relativePath} ${note.tags.join(' ')}`.toLocaleLowerCase('zh-CN').includes(needle))
  }, [query, scan])

  if (!scan) return null
  const toggle = (path: string) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    return next
  })
  const allVisibleSelected = visible.length > 0 && visible.every((note) => selected.has(note.relativePath))
  const toggleVisible = () => setSelected((current) => {
    const next = new Set(current)
    if (allVisibleSelected) visible.forEach((note) => next.delete(note.relativePath))
    else visible.forEach((note) => next.add(note.relativePath))
    return next
  })

  return <div className="modal-backdrop" onPointerDown={(event) => dismissFromBackdrop(event, onClose, busy)}><section className="obsidian-import-dialog" role="dialog" aria-label="导入 Obsidian 笔记" data-testid="obsidian-import-dialog">
    <header><div><BookOpen size={18} /><div><h2>{scan.vaultName}</h2><p>只读扫描 · {scan.noteCount} 篇 Markdown</p></div></div><button type="button" className="dialog-close-action pressable" aria-label="关闭 Obsidian 导入" onClick={onClose}><X size={16} /><span>关闭</span></button></header>
    <div className="obsidian-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、路径或标签" /></div>
    <div className="obsidian-selection-bar"><button type="button" className="pressable" onClick={toggleVisible}>{allVisibleSelected ? <CheckSquare size={14} /> : <Square size={14} />}{allVisibleSelected ? '取消当前结果' : '选择当前结果'}</button><span>已选择 {selected.size} 篇，导入后会复制进项目，不修改 Vault。</span></div>
    <div className="obsidian-note-list">
      {visible.map((note) => <label key={note.relativePath} className={selected.has(note.relativePath) ? 'selected' : ''}><input type="checkbox" checked={selected.has(note.relativePath)} onChange={() => toggle(note.relativePath)} /><span><b>{note.title}</b><small>{note.relativePath}</small>{note.tags.length > 0 && <em>{note.tags.slice(0, 4).map((tag) => `#${tag}`).join(' ')}</em>}</span></label>)}
      {visible.length === 0 && <p className="obsidian-empty">没有匹配的笔记。</p>}
    </div>
    {scan.warnings.length > 0 && <details><summary>扫描提示</summary>{scan.warnings.map((warning) => <p key={warning}>{warning}</p>)}</details>}
    {error && <p className="import-error" role="alert">{error}</p>}
    <footer><button type="button" className="rail-secondary pressable" disabled={busy} onClick={onClose}>取消</button><button type="button" className="rail-primary pressable" disabled={busy || selected.size === 0 || selected.size > 200} onClick={() => onImport([...selected])}>{busy ? '正在导入…' : `导入 ${selected.size} 篇`}</button></footer>
  </section></div>
}
