import { useEffect, useMemo, useState } from 'react'
import { Boxes, FolderPlus, Search, X } from 'lucide-react'
import type { LocalCoreClient } from '../../runtime/localCoreClient'

interface StagingItemView {
  readonly id: string
  readonly kind: string
  readonly payloadRef: string
  readonly title: string
  readonly capturedAt: string
}

interface Props {
  readonly client: LocalCoreClient
  readonly projectId: string
  readonly projects: readonly { readonly id: string; readonly label: string }[]
  readonly onClose: () => void
  readonly onCreated: (projectId: string, name: string) => void
}

function dayLabel(value: string): string {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const day = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  if (day(date) === day(today)) return '今天'
  if (day(date) === day(yesterday)) return '昨天'
  return date.toLocaleDateString()
}

export function StagingDialog({ client, projectId, projects, onClose, onCreated }: Props) {
  const [items, setItems] = useState<StagingItemView[]>([])
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [assignProjectId, setAssignProjectId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    setBusy(true)
    void client.captureStaging(7 * 24 * 60 * 60_000, { search: search || undefined, kind: kind || undefined, limit: 100 }, undefined).then((call) => {
      if (!call.result.ok) { setError(call.result.error.message); setBusy(false); return }
      setItems(call.result.value.items.map((item) => ({
        id: item.id,
        kind: item.kind,
        payloadRef: item.payloadRef,
        title: String((item.source as { title?: string })?.title ?? item.payloadRef.slice(0, 60)),
        capturedAt: item.capturedAt,
      })))
      setBusy(false)
    })
  }
  useEffect(refresh, [client, kind, search])

  const groups = useMemo(() => {
    const map = new Map<string, StagingItemView[]>()
    items.forEach((item) => {
      const label = dayLabel(item.capturedAt)
      map.set(label, [...(map.get(label) ?? []), item])
    })
    return [...map.entries()]
  }, [items])

  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  const createProject = () => {
    if (selected.length === 0) return
    setBusy(true)
    void client.createProjectFromStaging(selected).then((call) => {
      setBusy(false)
      if (!call.result.ok) { setError(call.result.error.message); return }
      onCreated(call.result.value.projectId, call.result.value.name)
      setSelected([])
      refresh()
    })
  }

  const assign = () => {
    if (selected.length === 0 || assignProjectId === '') return
    setBusy(true)
    void Promise.all(selected.map((id) => client.resolveCaptureStaging(id, assignProjectId))).then((calls) => {
      setBusy(false)
      if (calls.some((call) => !call.result.ok)) { setError('部分分配失败'); return }
      setSelected([])
      refresh()
    })
  }

  return (
    <div className="editor-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="staging-dialog" role="dialog" aria-modal="true" aria-label="最近捕获" data-testid="staging-dialog">
        <header>
          <div><Boxes size={15} /><span>最近捕获 · 暂存区</span><small>{items.length} 项未归项目</small></div>
          <button type="button" aria-label="关闭" onClick={onClose}><X size={15} /></button>
        </header>
        <div className="staging-toolbar">
          <label><Search size={12} /><input placeholder="搜索标题或来源" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="类型筛选">
            <option value="">全部类型</option>
            {['web_page', 'web_link', 'web_selection', 'clipboard_text', 'web_image', 'screenshot', 'local_file'].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <label className="staging-assign">分配
            <select value={assignProjectId} onChange={(event) => setAssignProjectId(event.target.value)} disabled={selected.length === 0}>
              <option value="">选择项目</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}
            </select>
            <button type="button" disabled={selected.length === 0 || assignProjectId === '' || busy} onClick={assign}>分配选中</button>
          </label>
        </div>
        {error && <p className="staging-error">{error}</p>}
        <div className="staging-groups">
          {groups.map(([label, group]) => (
            <section key={label}>
              <h4>{label} · {group.length}</h4>
              <ul>
                {group.map((item) => (
                  <li key={item.id} className={selected.includes(item.id) ? 'selected' : ''}>
                    <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} aria-label={`选择 ${item.title}`} />
                    <div><strong>{item.title}</strong><span>{item.kind} · {new Date(item.capturedAt).toLocaleTimeString()}</span></div>
                    {item.payloadRef.startsWith('http') && <button type="button" title="打开来源" onClick={() => window.open(item.payloadRef, '_blank', 'noopener,noreferrer')}>打开</button>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {groups.length === 0 && !busy && <p className="staging-empty">暂存区为空。</p>}
        </div>
        <footer>
          <button type="button" className="primary-action" disabled={selected.length === 0 || busy} onClick={createProject}><FolderPlus size={13} />用选中的 {selected.length} 项创建项目</button>
          <button type="button" className="secondary-action" onClick={refresh} disabled={busy}>{busy ? '刷新中…' : '刷新'}</button>
        </footer>
      </section>
    </div>
  )
}
