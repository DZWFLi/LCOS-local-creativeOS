import { useEffect, useMemo, useRef, useState } from 'react'
import { Boxes, File, FileText, Link2, LoaderCircle, MessageCircle, Search, Workflow, X } from 'lucide-react'
import type { SearchHitVNext } from '@local-creative-os/contracts'
import type { ProjectPackage } from '../../model'
import type { LocalCoreClient } from '../../runtime/localCoreClient'
import { searchProjectFocusEntries, type ProjectFocusSearchEntry } from '../../state/projectFocus'
import { ConversationGlyth } from '../conversations/ConversationGlyth'
import { LcosIcon } from '../ui/LcosIcon'
import { dismissFromBackdrop } from '../ui/dismissibleLayer'

type SearchLensItem = {
  readonly key: string
  readonly title: string
  readonly kind: string
  readonly sourceIds?: readonly string[]
  readonly artifactId?: string
  readonly snippet?: string
  readonly chunkAnchor?: string
  readonly source?: string
  readonly score?: number
  readonly conversationId?: string
  readonly matchReason?: SearchHitVNext['matchReason']
  readonly matchModality?: SearchHitVNext['matchModality']
  readonly locationCount?: number
}

function anchorLabel(anchor: string): string {
  if (anchor.startsWith('section:')) {
    const section = anchor.slice('section:'.length)
    return section ? `§ ${section}` : anchor
  }
  const pdf = /^pdf:p(\d+)(?:-p(\d+))?$/.exec(anchor)
  if (pdf) return pdf[2] === undefined ? `第 ${pdf[1]} 页` : `第 ${pdf[1]}-${pdf[2]} 页`
  const chunk = /^chunk:(\d+)(?:-(\d+))?$/.exec(anchor)
  if (chunk) return chunk[2] === undefined ? `第 ${chunk[1]} 段` : `第 ${chunk[1]}-${chunk[2]} 段`
  return anchor
}

function humanKind(kind: string): string {
  if (/conversation/i.test(kind)) return '对话'
  if (/context/i.test(kind)) return '上下文'
  if (/workflow/i.test(kind)) return '工作流'
  if (/resource|link|web/i.test(kind)) return '来源'
  if (/note|markdown|text/i.test(kind)) return '文本'
  if (/file/i.test(kind)) return '文件'
  return '项目对象'
}

function resultFromRemote(hit: SearchHitVNext): SearchLensItem {
  return {
    key: `${hit.entityType}:${hit.entityId}`,
    title: hit.title,
    kind: hit.entityType,
    ...(hit.entityRef?.viewId || hit.viewId ? { sourceIds: [hit.entityRef?.viewId ?? hit.viewId!] } : {}),
    ...(hit.entityType === 'artifact' ? { artifactId: hit.entityId } : {}),
    ...(hit.entityType === 'conversation' ? { conversationId: hit.entityId } : {}),
    snippet: hit.snippet,
    chunkAnchor: hit.chunkAnchor,
    source: hit.source,
    score: hit.score,
    matchReason: hit.matchReason,
    matchModality: hit.matchModality,
    locationCount: hit.locationCount,
  }
}

function matchReasonLabel(item: SearchLensItem): string | undefined {
  switch (item.matchReason) {
    case 'title': return '名字最接近你输入的内容'
    case 'body': return item.chunkAnchor ? `在${anchorLabel(item.chunkAnchor)}找到了相关内容` : '正文里找到了相关内容'
    case 'ocr': return '这张图上有相关文字'
    case 'semantic': return '内容意思很接近'
    case 'visual': return '画面内容很接近'
    case 'source': return '它来自你输入的来源'
    case 'relation': return '它和一个直接命中的内容关系很近'
    case 'metadata': return '名称或已有描述很接近'
    default: return undefined
  }
}

function hasClearBestMatch(results: readonly SearchLensItem[]): boolean {
  const first = results[0]?.score
  if (first === undefined) return false
  const second = results[1]?.score
  if (second === undefined) return true
  if (first <= second) return false
  return first >= second * 1.15 || first - second >= 0.15
}

function SearchIdentity({ item }: { readonly item: SearchLensItem }) {
  if (/conversation/i.test(item.kind)) {
    return <span className="project-search-identity is-conversation"><ConversationGlyth conversation={{ id: item.conversationId ?? item.key, title: item.title }} size={34} animated={false}/></span>
  }
  if (/context/i.test(item.kind)) return <span className="project-search-identity"><LcosIcon shape="petal" icon={Boxes} size={34} tone="identity"/></span>
  if (/workflow/i.test(item.kind)) return <span className="project-search-identity"><LcosIcon shape="squircle" icon={Workflow} size={34} tone="identity"/></span>
  if (/resource|link|web/i.test(item.kind)) return <span className="project-search-identity"><LcosIcon shape="leaf" icon={Link2} size={34} tone="identity"/></span>
  if (/note|markdown|text/i.test(item.kind)) return <span className="project-search-identity"><LcosIcon shape="paper" icon={FileText} size={34} tone="identity"/></span>
  if (/file/i.test(item.kind)) return <span className="project-search-identity"><LcosIcon shape="paper" icon={File} size={34} tone="identity"/></span>
  return <span className="project-search-identity"><LcosIcon shape="pebble" icon={FileText} size={34} tone="identity"/></span>
}

export function ProjectSearchLens({ open, initialQuery = '', project, client, onClose, onSelectArtifact, onSelectSourceIds, searchEntries = [], onNotice }: {
  readonly open: boolean
  readonly initialQuery?: string
  readonly project: ProjectPackage
  readonly client: LocalCoreClient
  readonly onClose: () => void
  readonly onSelectArtifact: (artifactId: string) => void
  readonly onSelectSourceIds?: (sourceIds: readonly string[], title: string) => void
  readonly searchEntries?: readonly ProjectFocusSearchEntry[]
  readonly onNotice: (message: string) => void
}) {
  const [query, setQuery] = useState('')
  const [remote, setRemote] = useState<SearchLensItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const requestSeq = useRef(0)

  useEffect(() => {
    if (!open) return
    setQuery(initialQuery)
    setRemote([])
    setError(null)
    setActiveIndex(0)
  }, [initialQuery, open, project.id])

  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', close, true)
    return () => window.removeEventListener('keydown', close, true)
  }, [onClose, open])

  useEffect(() => {
    if (!open) return
    const normalized = query.trim()
    if (!normalized) { setRemote([]); setLoading(false); setError(null); return }
    const seq = ++requestSeq.current
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLoading(true)
      void client.projectSearch(project.id, normalized, { limit: 28, types: ['artifact', 'resource', 'note', 'conversation', 'file'] }, controller.signal)
        .then((call) => {
          if (seq !== requestSeq.current) return
          if (!call.result.ok) { setError(call.result.error.message); setRemote([]); return }
          setError(null)
          setRemote(call.result.value.hits.map(resultFromRemote))
        })
        .catch((cause) => {
          if (seq !== requestSeq.current || controller.signal.aborted) return
          setError(cause instanceof Error ? cause.message : '搜索暂不可用')
          setRemote([])
        })
        .finally(() => { if (seq === requestSeq.current) setLoading(false) })
    }, 150)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [client, open, project.id, query])

  const local = useMemo<SearchLensItem[]>(() => {
    const normalized = query.trim()
    if (!normalized) return []
    return searchProjectFocusEntries(searchEntries, normalized).slice(0, 12).map((entry) => ({
      key: entry.key,
      title: entry.title,
      kind: entry.kind,
      sourceIds: entry.sourceIds,
    }))
  }, [query, searchEntries])

  const results = useMemo(() => {
    const seen = new Set<string>()
    const merged: SearchLensItem[] = []
    for (const item of [...local, ...remote]) {
      const identity = item.sourceIds?.[0] ? `view:${item.sourceIds[0]}` : item.artifactId ? `artifact:${item.artifactId}` : item.key
      if (seen.has(identity)) continue
      seen.add(identity)
      merged.push(item)
      if (merged.length >= 24) break
    }
    return merged
  }, [local, remote])

  useEffect(() => { setActiveIndex((current) => Math.max(0, Math.min(current, Math.max(0, results.length - 1)))) }, [results.length])

  const clearBestMatch = hasClearBestMatch(results)

  if (!open) return null

  const openResult = (item: SearchLensItem) => {
    if (item.sourceIds?.length && onSelectSourceIds) {
      onSelectSourceIds(item.sourceIds, item.title)
      if (item.chunkAnchor) onNotice(`已定位「${item.title}」· ${anchorLabel(item.chunkAnchor)}`)
      onClose()
      return
    }
    if (item.artifactId) {
      onSelectArtifact(item.artifactId)
      if (item.chunkAnchor) onNotice(`已定位「${item.title}」· ${anchorLabel(item.chunkAnchor)}`)
      onClose()
      return
    }
    onNotice(item.chunkAnchor
      ? `找到了「${item.title}」· ${anchorLabel(item.chunkAnchor)}，它现在还没放在画布上。`
      : `找到了「${item.title}」，它现在还没放在画布上。`)
  }

  return <div className="project-search-lens-backdrop" role="presentation" onPointerDown={(event) => dismissFromBackdrop(event, onClose, false)}>
    <section className="project-search-lens" role="dialog" aria-modal="true" aria-label={`搜索 ${project.label}`} data-testid="project-search-lens">
      <div className="project-search-input-row">
        <Search size={17}/>
        <input
          autoFocus
          value={query}
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }}
          placeholder="找项目里的任何东西"
          aria-label="搜索当前项目"
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => Math.max(0, Math.min(results.length - 1, index + 1))) }
            if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)) }
            if (event.key === 'Enter' && results[activeIndex]) { event.preventDefault(); openResult(results[activeIndex]) }
          }}
        />
        {loading ? <LoaderCircle size={15} className="project-search-spinner" aria-label="搜索中"/> : query ? <button type="button" aria-label="清空搜索" onClick={() => setQuery('')}><X size={14}/></button> : <kbd>Esc</kbd>}
      </div>

      <div className="project-search-results" role="listbox" aria-label="搜索结果">
        {!query.trim() && <div className="project-search-idle"><MessageCircle size={18}/><strong>找项目里的任何东西</strong><span>记得一句话、一个名字、某段对话，直接输入就行。</span></div>}
        {query.trim() && results.map((item, index) => <button
          type="button"
          key={item.key}
          className={`project-search-result${index === activeIndex ? ' is-active' : ''}`}
          role="option"
          aria-selected={index === activeIndex}
          onMouseMove={() => setActiveIndex(index)}
          onClick={() => openResult(item)}
        >
          <SearchIdentity item={item}/>
          <span className="project-search-result-copy">
            {index === 0 && clearBestMatch ? <small><em>最可能是这个</em></small> : null}
            <strong>{item.title}</strong>
            <small><b>{humanKind(item.kind)}</b>{matchReasonLabel(item) && <em>{matchReasonLabel(item)}</em>}{item.chunkAnchor && item.matchReason !== 'body' && <em>{anchorLabel(item.chunkAnchor)}</em>}{item.locationCount !== undefined && item.locationCount > 0 ? <span>在 {item.locationCount} 个地方用过</span> : null}</small>
            {item.snippet && <p>{item.snippet}</p>}
          </span>
        </button>)}
        {query.trim() && !loading && results.length === 0 && !error && <div className="project-search-empty"><strong>没找到</strong><span>换一种说法试试。</span></div>}
        {error && <div className="project-search-error"><strong>现在没法搜索</strong><span>项目内容没有丢，重新试一次就行。</span></div>}
      </div>
    </section>
  </div>
}
