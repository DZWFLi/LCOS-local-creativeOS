import { useEffect, useMemo, useState } from 'react'
import { File, FileText, Image, Link2, MessageSquareText, Search, X } from 'lucide-react'
import type { CaptureSpacePayloadPreviewV1, CaptureStagingItemV0 } from '@local-creative-os/contracts'
import type { LocalCoreClient } from '../../runtime/localCoreClient'

const PREVIEW_LIMIT = 80

type PreviewMap = Readonly<Record<string, CaptureSpacePayloadPreviewV1 | null>>

function sourceText(item: CaptureStagingItemV0): string {
  const source = item.source as Record<string, unknown>
  return [source.title, source.pageTitle, source.url, source.pageUrl, source.sourceUrl, item.kind]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
}

function captureTitle(item: CaptureStagingItemV0, preview?: CaptureSpacePayloadPreviewV1 | null): string {
  const source = item.source as Record<string, unknown>
  const explicit = [source.title, source.pageTitle].find((value): value is string => typeof value === 'string' && value.trim().length > 0)
  if (explicit) return explicit.trim()
  if (preview?.type === 'url' && preview.url) {
    try { return new URL(preview.url).hostname }
    catch { return preview.url }
  }
  if (preview?.type === 'local_path' && preview.path) return preview.path.split(/[\\/]/).filter(Boolean).at(-1) ?? '本地文件'
  if (preview?.type === 'text' && preview.text) return preview.text.replace(/\s+/g, ' ').trim().slice(0, 54) || '文字片段'
  if (item.kind.includes('image') || item.kind === 'screenshot') return '图片素材'
  if (item.kind.includes('selection')) return '网页选区'
  if (item.kind.includes('conversation')) return '对话快照'
  return '未命名素材'
}

function captureKindLabel(input: CaptureStagingItemV0 | string): string {
  const kind = typeof input === 'string' ? input : input.kind
  switch (kind) {
    case 'web_image':
    case 'clipboard_image':
    case 'screenshot': return '图片'
    case 'web_page': return '网页'
    case 'web_link': return '链接'
    case 'web_selection': return '网页选区'
    case 'clipboard_text': return '文字'
    case 'conversation_snapshot': return '对话'
    case 'local_file': return '文件'
    default: return kind
  }
}

function formatCapturedAt(value: string): string {
  const time = new Date(value)
  if (Number.isNaN(time.getTime())) return value
  const today = new Date()
  const sameDay = time.toDateString() === today.toDateString()
  return sameDay
    ? time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : time.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function KindIcon({ item }: { readonly item: CaptureStagingItemV0 }) {
  if (item.kind.includes('image') || item.kind === 'screenshot') return <Image size={18} />
  if (item.kind.includes('web_')) return <Link2 size={18} />
  if (item.kind.includes('conversation')) return <MessageSquareText size={18} />
  if (item.kind.includes('text') || item.kind.includes('selection')) return <FileText size={18} />
  return <File size={18} />
}

function CapturePreview({ item, preview }: { readonly item: CaptureStagingItemV0; readonly preview?: CaptureSpacePayloadPreviewV1 | null }) {
  if (preview?.type === 'image' && preview.dataUrl) {
    return <img className="capture-material-image" src={preview.dataUrl} alt="" draggable={false} />
  }
  if (preview?.type === 'text' && preview.text) {
    return <div className="capture-material-text"><p>{preview.text}</p></div>
  }
  if (preview?.type === 'url' && preview.url) {
    let host = preview.url
    try { host = new URL(preview.url).hostname }
    catch { /* keep raw url */ }
    return <div className="capture-material-link"><Link2 size={24}/><strong>{host}</strong><span>{preview.url}</span></div>
  }
  if (preview?.type === 'local_path' && preview.path) {
    return <div className="capture-material-file"><File size={28}/><strong>{preview.path.split(/[\\/]/).filter(Boolean).at(-1) ?? preview.path}</strong><span>{preview.path}</span></div>
  }
  return <div className="capture-material-fallback"><KindIcon item={item}/><span>{captureKindLabel(item)}</span></div>
}

export function CaptureMaterialFlow({ client, items, selectedIds, onSelectedIdsChange, busy = false }: {
  readonly client: LocalCoreClient
  readonly items: readonly CaptureStagingItemV0[]
  readonly selectedIds: readonly string[]
  readonly onSelectedIdsChange: (ids: string[]) => void
  readonly busy?: boolean
}) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const [previews, setPreviews] = useState<PreviewMap>({})

  const kinds = useMemo(() => [...new Set(items.map((item) => item.kind))].sort(), [items])
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items.filter((item) => {
      if (kind !== 'all' && item.kind !== kind) return false
      if (!needle) return true
      const preview = previews[item.id]
      const previewText = preview?.type === 'text' ? preview.text ?? '' : preview?.type === 'url' ? preview.url ?? '' : preview?.type === 'local_path' ? preview.path ?? '' : ''
      return `${sourceText(item)} ${previewText}`.toLowerCase().includes(needle)
    })
  }, [items, kind, previews, query])

  useEffect(() => {
    const missing = items.slice(0, PREVIEW_LIMIT).filter((item) => previews[item.id] === undefined)
    if (!missing.length) return
    let cancelled = false
    void Promise.all(missing.map(async (item) => {
      const call = await client.captureSpacePreview(item.id).catch(() => null)
      return [item.id, call?.result.ok ? call.result.value : null] as const
    })).then((rows) => {
      if (cancelled) return
      setPreviews((current) => ({ ...current, ...Object.fromEntries(rows) }))
    })
    return () => { cancelled = true }
  }, [client, items, previews])

  const selected = new Set(selectedIds)
  const toggle = (id: string, additive: boolean) => {
    if (!additive) {
      onSelectedIdsChange(selected.has(id) && selectedIds.length === 1 ? [] : [id])
      return
    }
    onSelectedIdsChange(selected.has(id) ? selectedIds.filter((value) => value !== id) : [...selectedIds, id])
  }

  return <section className="capture-material-source" aria-label="Capture 素材流">
    <div className="capture-material-toolbar">
      <label className="capture-material-search"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 Capture" aria-label="搜索 Capture"/>{query && <button type="button" aria-label="清空搜索" onClick={() => setQuery('')}><X size={13}/></button>}</label>
      <div className="capture-material-kinds" aria-label="素材类型筛选">
        <button type="button" className={kind === 'all' ? 'is-active' : ''} onClick={() => setKind('all')}>全部</button>
        {kinds.slice(0, 6).map((value) => <button key={value} type="button" className={kind === value ? 'is-active' : ''} onClick={() => setKind(value)}>{captureKindLabel(value)}</button>)}
      </div>
      <span className="capture-material-count">{filtered.length} 项</span>
    </div>

    {filtered.length > 0 ? <div className="capture-material-masonry" aria-busy={busy || undefined}>
      {filtered.map((item) => {
        const isSelected = selected.has(item.id)
        const preview = previews[item.id]
        const dragIds = isSelected && selectedIds.length > 0 ? selectedIds : [item.id]
        return <article
          key={item.id}
          className={`capture-material-item${isSelected ? ' is-selected' : ''}`}
          data-capture-id={item.id}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'copy'
            event.dataTransfer.setData('application/x-lcos-capture-ids', JSON.stringify(dragIds))
            event.dataTransfer.setData('text/plain', dragIds.join(','))
          }}
          onClick={(event) => toggle(item.id, event.metaKey || event.ctrlKey || event.shiftKey)}
          tabIndex={0}
          role="option"
          aria-selected={isSelected}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(item.id, event.metaKey || event.ctrlKey || event.shiftKey) } }}
        >
          <div className="capture-material-body"><CapturePreview item={item} preview={preview}/></div>
          <footer className="capture-material-meta">
            <strong>{captureTitle(item, preview)}</strong>
            <span>{captureKindLabel(item)} · {formatCapturedAt(item.capturedAt)}</span>
          </footer>
        </article>
      })}
    </div> : <div className="capture-material-empty"><strong>{items.length ? '没有匹配的 Capture' : 'Capture 还是空的'}</strong><span>{items.length ? '换个关键词或类型。' : '网页、图片、文字和文件会先落在这里，再由你决定送去哪里。'}</span></div>}
  </section>
}
