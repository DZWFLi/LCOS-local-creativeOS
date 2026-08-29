import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ArrowLeft, Check, PackageOpen, RefreshCw } from 'lucide-react'
import type { CaptureSpaceSnapshotV1, WarehouseItemV1 } from '@local-creative-os/contracts'
import type { ProjectPackage } from '../../model'
import type { LocalCoreClient } from '../../runtime/localCoreClient'
import { ProjectGlyphMark } from '../project/ProjectGlyphMark'
import { CaptureMaterialFlow } from '../capture/CaptureMaterialFlow'
import { AssemblyProjectWarehouse } from './AssemblyProjectWarehouse'
import { AssemblySkillSource } from './AssemblySkillSource'

function tintHue(projectId: string): number {
  let hash = 0
  for (const char of projectId) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return 210 + (Math.abs(hash) % 105)
}

export function AssemblyCaptureWorkspace({ client, projects, onClose, onOpenProject, onNotice, referenceSet }: {
  readonly client: LocalCoreClient
  readonly projects: readonly ProjectPackage[]
  readonly onClose: () => void
  readonly onOpenProject?: (projectId: string) => void
  readonly onNotice?: (message: string) => void
  readonly referenceSet?: {
    readonly projectId: string
    readonly ids: readonly string[]
    readonly resolveWarehouseReferenceId: (item: WarehouseItemV1) => string | null
    readonly onToggle: (id: string) => void
  }
}) {
  const [snapshot, setSnapshot] = useState<CaptureSpaceSnapshotV1 | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [targetProjectId, setTargetProjectId] = useState<string | null>(projects[0]?.id ?? null)
  const [busy, setBusy] = useState(false)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [sourceTab, setSourceTab] = useState<'project' | 'capture' | 'sources' | 'skills'>('capture')

  const refresh = useCallback(async () => {
    setBusy(true)
    const call = await client.captureSpace().catch(() => null)
    setBusy(false)
    if (!call?.result.ok) {
      onNotice?.(call && !call.result.ok ? `Capture 加载失败：${call.result.error.message}` : 'Capture 加载失败')
      return
    }
    setSnapshot(call.result.value)
    const pending = new Set(call.result.value.items.map((item) => item.id))
    setSelectedIds((current) => current.filter((id) => pending.has(id)))
  }, [client, onNotice])

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    if (targetProjectId && projects.some((project) => project.id === targetProjectId)) return
    setTargetProjectId(projects[0]?.id ?? null)
  }, [projects, targetProjectId])

  const targetProject = useMemo(() => projects.find((project) => project.id === targetProjectId) ?? null, [projects, targetProjectId])

  const materialize = useCallback(async (projectId: string, ids: readonly string[]) => {
    if (!ids.length) return
    setBusy(true)
    const call = await client.materializeCaptureToProject(ids, projectId).catch(() => null)
    setBusy(false)
    if (!call || !call.result.ok) {
      onNotice?.(call && !call.result.ok ? `装配失败：${call.result.error.message}` : '装配失败')
      return
    }
    const project = projects.find((item) => item.id === projectId)
    onNotice?.(`已把 ${call.result.value.imported} 项装配到「${project?.label ?? projectId}」`)
    setSelectedIds([])
    await refresh()
  }, [client, onNotice, projects, refresh])

  const acceptDrop = (projectId: string, raw: string) => {
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string')) return
      void materialize(projectId, parsed)
    } catch { /* not an LCOS capture drag */ }
  }

  return <main className="assembly-workspace lcos-reconstructed" data-testid="assembly-capture-workspace">
    <header className="assembly-workspace-header">
      <button type="button" className="assembly-back" onClick={onClose}><ArrowLeft size={15}/>项目</button>
      <div className="assembly-heading"><strong>装配台</strong><span>Capture · {snapshot?.pendingCount ?? 0} 项待整理</span></div>
      <button type="button" className="assembly-refresh" onClick={() => void refresh()} disabled={busy}><RefreshCw size={14}/>{busy ? '处理中' : '刷新'}</button>
    </header>

    <div className="assembly-workspace-body">
      <aside className="assembly-target-scene" aria-label="装配目标">
        <div className="assembly-pane-kicker"><span>当前目标</span><strong>装配到哪里</strong></div>
        <div className="assembly-target-list">
          {projects.map((project) => {
            const active = project.id === targetProjectId
            const receiving = project.id === dropTarget
            return <button
              type="button"
              key={project.id}
              className={`assembly-project-target${active ? ' is-active' : ''}${receiving ? ' is-receiving' : ''}`}
              style={{ '--project-portal-hue': tintHue(project.id) } as CSSProperties}
              data-project-view-drop-target={project.id}
              onClick={() => setTargetProjectId(project.id)}
              onDoubleClick={() => onOpenProject?.(project.id)}
              onDragEnter={(event) => { if (event.dataTransfer.types.includes('application/x-lcos-capture-ids')) { event.preventDefault(); setDropTarget(project.id) } }}
              onDragOver={(event) => { if (event.dataTransfer.types.includes('application/x-lcos-capture-ids')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' } }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget((current) => current === project.id ? null : current) }}
              onDrop={(event) => { event.preventDefault(); setDropTarget(null); acceptDrop(project.id, event.dataTransfer.getData('application/x-lcos-capture-ids')) }}
            >
              <ProjectGlyphMark label={`${project.label} project mark`} variantSeed={project.id} size={48}/>
              <span><strong>{project.label}</strong><small>{active ? '当前目标' : '双击打开项目'}</small></span>
              {active && <Check size={14} className="assembly-target-check"/>}
            </button>
          })}
        </div>
        {targetProject ? <div className="assembly-target-summary">
          <span>当前目标</span><strong>{targetProject.label}</strong><small>材料装配到这里后会成为项目内容，原始来源仍会保留。</small>
          {sourceTab === 'capture' ? <button type="button" disabled={!selectedIds.length || busy} onClick={() => void materialize(targetProject.id, selectedIds)}><PackageOpen size={14}/>装配选中 {selectedIds.length || ''}</button> : <small className="assembly-target-contract-note">当前来源先用于浏览；可以直接拖入的内容会按落点决定怎么使用。</small>}
        </div> : <div className="assembly-target-empty"><strong>还没有装配目标</strong><span>先创建或打开一个项目，再把 Capture 材料装配进去。</span></div>}
      </aside>

      <section className="assembly-source-bay">
        <div className="assembly-source-head">
          <div><span>SOURCE BAY</span><strong>{sourceTab === 'project' ? 'Project' : sourceTab === 'capture' ? 'Capture' : sourceTab === 'sources' ? 'Sources' : 'Skills'}</strong></div>
          <nav aria-label="装配来源">
            {(['project', 'capture', 'sources', 'skills'] as const).map((tab) => <button key={tab} type="button" className={sourceTab === tab ? 'is-active' : ''} onClick={() => setSourceTab(tab)}>{tab === 'project' ? 'Project' : tab === 'capture' ? 'Capture' : tab === 'sources' ? 'Sources' : 'Skills'}</button>)}
          </nav>
        </div>
        {sourceTab === 'project' ? <AssemblyProjectWarehouse client={client} projectId={targetProjectId} onNotice={onNotice} {...(targetProjectId === referenceSet?.projectId ? { referenceIds: referenceSet.ids, resolveReferenceId: referenceSet.resolveWarehouseReferenceId, onToggleReference: referenceSet.onToggle } : {})}/> : null}
        {sourceTab === 'capture' ? <CaptureMaterialFlow client={client} items={snapshot?.items ?? []} selectedIds={selectedIds} onSelectedIdsChange={setSelectedIds} busy={busy}/> : null}
        {sourceTab === 'sources' ? <div className="assembly-source-empty is-provider"><strong>还没有连接外部来源</strong><span>之后会直接浏览和搜索各来源自己的内容；这里不会拿项目里的已有材料冒充 Pinterest / Behance / Are.na。</span></div> : null}
        {sourceTab === 'skills' ? <AssemblySkillSource client={client} projectId={targetProjectId} onNotice={onNotice}/> : null}
      </section>
    </div>
  </main>
}
