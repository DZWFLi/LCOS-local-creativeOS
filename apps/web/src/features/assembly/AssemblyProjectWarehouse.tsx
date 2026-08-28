import { useEffect, useMemo, useState } from 'react'
import { FileText, Link2, MessageCircle, Network, Search, StickyNote } from 'lucide-react'
import type { Relation, SearchHitVNext, WarehouseItemV1, WarehouseSnapshotV1 } from '@local-creative-os/contracts'
import type { LocalCoreClient } from '../../runtime/localCoreClient'

type WarehouseViewMode = 'material' | 'relation'

function itemIcon(item: WarehouseItemV1) {
  if (item.kind === 'conversation') return MessageCircle
  if (item.kind === 'note') return StickyNote
  if (item.kind === 'resource') return Link2
  return FileText
}

function provenanceLabel(item: WarehouseItemV1) {
  if (item.provenance?.origin === 'run-return') return 'Agent return'
  if (item.provenance?.origin === 'capture') return 'Capture'
  if (item.provenance?.origin === 'import') return 'Import'
  return undefined
}

/**
 * Relation View is a view projection over canonical relations, never a second graph truth.
 * Connected components are computed from the current Warehouse page only; no coordinates are persisted.
 */
function relationIslands(items: readonly WarehouseItemV1[], relations: readonly Relation[]) {
  const byId = new Map(items.map((item) => [item.entityRef.id, item] as const))
  const adjacency = new Map<string, Set<string>>()
  for (const relation of relations) {
    const source = String(relation.sourceEntityId)
    const target = String(relation.targetEntityId)
    if (!byId.has(source) || !byId.has(target)) continue
    const sourceSet = adjacency.get(source) ?? new Set<string>()
    sourceSet.add(target); adjacency.set(source, sourceSet)
    const targetSet = adjacency.get(target) ?? new Set<string>()
    targetSet.add(source); adjacency.set(target, targetSet)
  }
  const seen = new Set<string>()
  const islands: WarehouseItemV1[][] = []
  for (const item of items) {
    if (seen.has(item.entityRef.id)) continue
    const queue = [item.entityRef.id]
    const island: WarehouseItemV1[] = []
    seen.add(item.entityRef.id)
    while (queue.length) {
      const id = queue.shift()!
      const current = byId.get(id)
      if (current) island.push(current)
      for (const next of adjacency.get(id) ?? []) {
        if (seen.has(next)) continue
        seen.add(next); queue.push(next)
      }
    }
    islands.push(island)
  }
  return islands.sort((a, b) => b.length - a.length)
}

function WarehouseObject({ item, compact = false }: { readonly item: WarehouseItemV1; readonly compact?: boolean }) {
  const Icon = itemIcon(item)
  const provenance = provenanceLabel(item)
  return <article className={`assembly-warehouse-object is-${item.kind}${compact ? ' is-compact' : ''}`} data-warehouse-entity={item.entityRef.id}>
    <span className="assembly-warehouse-object-body" aria-hidden="true"><Icon size={compact ? 13 : 17}/></span>
    <span className="assembly-warehouse-object-copy"><strong>{item.title || '未命名对象'}</strong><small>{[provenance, item.usageCount > 0 ? `${item.usageCount} 处使用` : undefined].filter(Boolean).join(' · ') || item.kind}</small></span>
    {item.relationHint && item.relationHint.neighborCount > 0 ? <span className="assembly-relation-count" title={item.relationHint.topKinds.join(' · ')}>{item.relationHint.neighborCount}</span> : null}
  </article>
}

export function AssemblyProjectWarehouse({ client, projectId, onNotice }: {
  readonly client: LocalCoreClient
  readonly projectId: string | null
  readonly onNotice?: (message: string) => void
}) {
  const [mode, setMode] = useState<WarehouseViewMode>('material')
  const [query, setQuery] = useState('')
  const [snapshot, setSnapshot] = useState<WarehouseSnapshotV1 | null>(null)
  const [relations, setRelations] = useState<readonly Relation[]>([])
  const [searchHits, setSearchHits] = useState<readonly SearchHitVNext[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!projectId) { setSnapshot(null); setRelations([]); setSearchHits([]); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setBusy(true)
      const normalized = query.trim()
      void Promise.all([
        client.warehouse(projectId, { limit: 200 }, controller.signal).catch(() => null),
        client.relations(projectId, controller.signal).catch(() => null),
        normalized ? client.projectSearch(projectId, normalized, { limit: 120, types: ['artifact', 'resource', 'note', 'conversation', 'file'] }, controller.signal).catch(() => null) : Promise.resolve(null),
      ]).then(([warehouseCall, relationCall, searchCall]) => {
        if (controller.signal.aborted) return
        setBusy(false)
        if (!warehouseCall?.result.ok) {
          onNotice?.(warehouseCall && !warehouseCall.result.ok ? `Warehouse 加载失败：${warehouseCall.result.error.message}` : 'Warehouse 加载失败')
          return
        }
        setSnapshot(warehouseCall.result.value)
        setRelations(relationCall?.result.ok ? relationCall.result.value : [])
        setSearchHits(searchCall?.result.ok ? searchCall.result.value.hits : [])
      })
    }, 140)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [client, onNotice, projectId, query])

  const visibleItems = useMemo(() => {
    const items = snapshot?.items ?? []
    const normalized = query.trim().toLocaleLowerCase('en-US')
    if (!normalized) return items
    const rank = new Map<string, number>()
    searchHits.forEach((hit, index) => rank.set(hit.entityRef?.id ?? hit.entityId, index))
    const matched = items.filter((item) => rank.has(item.entityRef.id) || item.title.toLocaleLowerCase('en-US').includes(normalized))
    return [...matched].sort((left, right) => (rank.get(left.entityRef.id) ?? 10_000) - (rank.get(right.entityRef.id) ?? 10_000))
  }, [query, searchHits, snapshot?.items])

  const relationSeedItems = useMemo(() => {
    const all = snapshot?.items ?? []
    if (!query.trim()) return all
    const seedIds = new Set(visibleItems.map((item) => item.entityRef.id))
    if (seedIds.size === 0) return []
    const expanded = new Set(seedIds)
    for (const relation of relations) {
      const source = String(relation.sourceEntityId), target = String(relation.targetEntityId)
      if (seedIds.has(source)) expanded.add(target)
      if (seedIds.has(target)) expanded.add(source)
    }
    return all.filter((item) => expanded.has(item.entityRef.id))
  }, [query, relations, snapshot?.items, visibleItems])

  const islands = useMemo(() => relationIslands(relationSeedItems, relations), [relationSeedItems, relations])
  if (!projectId) return <div className="assembly-source-empty"><strong>先选择 Target Project</strong><span>Project Warehouse 依附项目真相，不在前端制造临时仓库。</span></div>

  return <div className="assembly-project-source" data-warehouse-view={mode}>
    <div className="assembly-source-toolbar">
      <label><Search size={13}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索项目材料" aria-label="搜索项目 Warehouse"/></label>
      <div className="assembly-view-toggle" role="group" aria-label="Warehouse 视图">
        <button type="button" className={mode === 'material' ? 'is-active' : ''} onClick={() => setMode('material')}>素材</button>
        <button type="button" className={mode === 'relation' ? 'is-active' : ''} onClick={() => setMode('relation')}>关系</button>
      </div>
    </div>
    <div className="assembly-source-status"><span>{busy ? '正在读取 Project Truth…' : query.trim() ? `${visibleItems.length} 项相关 · ${snapshot?.totalApprox ?? 0} 项总计` : `${snapshot?.totalApprox ?? 0} 项`}</span><small>当前 Warehouse 只显示 Core 已投影的 canonical 对象；缺失类型不会由 GUI 猜出来。</small></div>

    {mode === 'material' ? <div className="assembly-warehouse-material" aria-label="Project Warehouse 素材视图">
      {visibleItems.map((item) => <WarehouseObject key={`${item.kind}:${item.entityRef.id}`} item={item}/>) }
      {!busy && visibleItems.length === 0 ? <div className="assembly-source-empty"><strong>没有匹配材料</strong><span>换个关键词，或从 Capture 带入新材料。</span></div> : null}
    </div> : <div className="assembly-warehouse-relations" aria-label="Project Warehouse 关系视图">
      {islands.map((island, index) => <section className="assembly-relation-island" key={`${island[0]?.entityRef.id ?? index}`} data-island-size={island.length}>
        <header><Network size={12}/><span>{island.length > 1 ? `${island.length} 个相关对象` : '独立对象'}</span></header>
        <div>{island.map((item) => <WarehouseObject key={`${item.kind}:${item.entityRef.id}`} item={item} compact/>)}</div>
      </section>)}
      {!busy && islands.length === 0 ? <div className="assembly-source-empty"><strong>还没有关系岛</strong><span>关系视图只投影真实 Relation，不根据标题偷偷编关系。</span></div> : null}
    </div>}
  </div>
}
