import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Boxes, RefreshCw, Sparkles } from 'lucide-react'
import type { CaptureSpacePayloadPreviewV1, CaptureSpacePresentationV1, CaptureSpaceSnapshotV1 } from '@local-creative-os/contracts'
import type { Camera, CanvasNode, ProjectPackage, WorkspaceFrameVM } from '../../model'
import type { LocalCoreClient } from '../../runtime/localCoreClient'
import { ProjectCanvas } from '../canvas/ProjectCanvas'
import { placeNewNodesIncrementally } from '../canvas/canvasGeometry'

interface Props {
  readonly client: LocalCoreClient
  readonly projects: readonly ProjectPackage[]
  readonly onClose: () => void
  readonly onOpenProject?: (projectId: string) => void
  readonly onNotice?: (message: string) => void
}

function captureTitle(item: CaptureSpaceSnapshotV1['items'][number]): string {
  const source = item.source as { title?: string; url?: string }
  if (typeof source.title === 'string' && source.title.trim()) return source.title.trim()
  if (item.payloadRef.startsWith('http')) {
    try { return new URL(item.payloadRef).hostname } catch { return item.payloadRef.slice(0, 72) }
  }
  return item.payloadRef.split(/[\\/]/).at(-1) || item.kind
}

function nodeKind(item: CaptureSpaceSnapshotV1['items'][number]): CanvasNode['kind'] {
  if (item.kind === 'clipboard_text' || item.kind === 'web_selection' || item.kind === 'conversation_snapshot') return 'note'
  return 'source'
}

function nodeFrom(item: CaptureSpaceSnapshotV1['items'][number], view: CaptureSpacePresentationV1['views'][number] | undefined, preview?: CaptureSpacePayloadPreviewV1): CanvasNode {
  const title = captureTitle(item)
  const subtitle = item.suggestedProjects[0]?.reason || item.kind.replaceAll('_', ' ')
  return {
    id: item.id,
    kind: nodeKind(item),
    title,
    subtitle,
    x: view?.x ?? 0,
    y: view?.y ?? 0,
    width: view?.width ?? 224,
    height: view?.height ?? 148,
    displayMode: view?.collapsed ? 'compact' : 'standard',
    positionLocked: view?.fixed,
    sourceKind: item.kind,
    createdAt: item.capturedAt,
    ...(preview?.type === 'text' ? { previewText: preview.text, noteBody: preview.text } : {}),
    ...(preview?.type === 'image' && preview.dataUrl ? { previewDataUrl: preview.dataUrl, previewMimeType: preview.dataUrl.slice(5, preview.dataUrl.indexOf(';')) } : {}),
    ...(preview?.type === 'url' && preview.url ? { observedPath: preview.url } : {}),
    ...(preview?.type === 'local_path' && preview.path ? { observedPath: preview.path } : {}),
  }
}

function presentationFrom(nodes: readonly CanvasNode[], current: CaptureSpacePresentationV1): Omit<CaptureSpacePresentationV1, 'version' | 'updatedAt'> {
  const byId = new Map(current.views.map((view) => [view.captureId, view]))
  return {
    schemaVersion: 1,
    views: nodes.map((node) => ({
      captureId: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      ...(node.displayMode === 'compact' ? { collapsed: true } : {}),
      ...(node.positionLocked ? { fixed: true } : {}),
      ...(byId.get(node.id)?.fixed && !node.positionLocked ? { fixed: false } : {}),
    })),
    regions: current.regions,
  }
}

export function CaptureSpace({ client, projects, onClose, onOpenProject, onNotice }: Props) {
  const [snapshot, setSnapshot] = useState<CaptureSpaceSnapshotV1 | null>(null)
  const [nodes, setNodes] = useState<CanvasNode[]>([])
  const [camera, setCamera] = useState<Camera>({ x: 72, y: 52, zoom: 1 })
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const previews = useRef(new Map<string, CaptureSpacePayloadPreviewV1>())
  const saveVersion = useRef(0)
  const placementPersistKey = useRef('')

  const applySnapshot = useCallback((next: CaptureSpaceSnapshotV1) => {
    setSnapshot(next)
    saveVersion.current = next.presentation.version
    const presentationById = new Map(next.presentation.views.map((view) => [view.captureId, view]))
    const existing = next.items.filter((item) => presentationById.has(item.id)).map((item) => nodeFrom(item, presentationById.get(item.id), previews.current.get(item.id)))
    const newcomers = next.items.filter((item) => !presentationById.has(item.id)).map((item) => nodeFrom(item, undefined, previews.current.get(item.id)))
    const placements = placeNewNodesIncrementally(existing, newcomers, { x: 120, y: 120 }, 24)
    const placed = newcomers.map((node, index) => ({ ...node, ...(placements[index] ?? { x: 120 + index * 24, y: 120 + index * 24 }) }))
    setNodes([...existing, ...placed])
  }, [])

  const refresh = useCallback(async () => {
    setBusy(true)
    const call = await client.captureSpace().catch(() => null)
    setBusy(false)
    if (!call || !call.result.ok) {
      onNotice?.(call && !call.result.ok ? `Capture Space 读取失败：${call.result.error.message}` : 'Capture Space 暂时无法读取')
      return
    }
    applySnapshot(call.result.value)
    const pendingPreviewIds = call.result.value.items.filter((item) => !previews.current.has(item.id)).slice(0, 36).map((item) => item.id)
    if (!pendingPreviewIds.length) return
    const results = await Promise.all(pendingPreviewIds.map(async (id) => {
      const preview = await client.captureSpacePreview(id).catch(() => null)
      return preview?.result.ok ? preview.result.value : null
    }))
    let changed = false
    results.forEach((preview) => { if (preview) { previews.current.set(preview.captureId, preview); changed = true } })
    if (changed) applySnapshot(call.result.value)
  }, [applySnapshot, client, onNotice])

  useEffect(() => { void refresh() }, [refresh])

  // 新 Capture 只摆新节点、绝不动旧节点；第一次增量摆位后立即写入系统级 Presentation，
  // 否则用户还没碰画布就 reload，会看见新节点重新洗牌。
  useEffect(() => {
    if (!snapshot || nodes.length === 0) return
    const persisted = new Set(snapshot.presentation.views.map((view) => view.captureId))
    const missing = nodes.filter((node) => !persisted.has(node.id))
    if (!missing.length) return
    const key = `${snapshot.presentation.version}:${missing.map((node) => node.id).sort().join(',')}`
    if (placementPersistKey.current === key) return
    placementPersistKey.current = key
    void client.saveCaptureSpacePresentation(presentationFrom(nodes, snapshot.presentation), saveVersion.current).then((call) => {
      if (!call.result.ok) {
        placementPersistKey.current = ''
        onNotice?.(`Capture 新材料摆位保存失败：${call.result.error.message}`)
        return
      }
      const saved = call.result.value
      saveVersion.current = saved.version
      setSnapshot((current) => current ? { ...current, presentation: saved } : current)
    }).catch(() => { placementPersistKey.current = '' })
  }, [client, nodes, onNotice, snapshot])

  const frames = useMemo<WorkspaceFrameVM[]>(() => (snapshot?.presentation.regions ?? []).map((region) => ({
    workspaceId: region.id,
    label: region.label,
    scopeId: 'capture-space',
    memberViewIds: [...region.captureIds],
    bounds: { x: region.x, y: region.y, width: region.width, height: region.height },
    active: false,
  })), [snapshot?.presentation.regions])

  const persist = useCallback(async () => {
    if (!snapshot) return
    const call = await client.saveCaptureSpacePresentation(presentationFrom(nodes, snapshot.presentation), saveVersion.current).catch(() => null)
    if (!call || !call.result.ok) {
      onNotice?.(call && !call.result.ok ? `Capture 画布保存失败：${call.result.error.message}` : 'Capture 画布保存失败')
      return
    }
    const saved = call.result.value
    saveVersion.current = saved.version
    setSnapshot((current) => current ? { ...current, presentation: saved } : current)
  }, [client, nodes, onNotice, snapshot])

  const organize = useCallback(async () => {
    setBusy(true)
    const call = await client.organizeCaptureSpace().catch(() => null)
    setBusy(false)
    if (!call || !call.result.ok) {
      onNotice?.(call && !call.result.ok ? `智能整理失败：${call.result.error.message}` : '智能整理暂不可用')
      return
    }
    onNotice?.(call.result.value.summary)
    await refresh()
  }, [client, onNotice, refresh])

  const materialize = useCallback(async (projectId: string, ids: readonly string[]) => {
    if (!ids.length) return
    setBusy(true)
    const call = await client.materializeCaptureToProject(ids, projectId).catch(() => null)
    setBusy(false)
    if (!call || !call.result.ok) {
      onNotice?.(call && !call.result.ok ? `放入项目失败：${call.result.error.message}` : '放入项目失败')
      return
    }
    const project = projects.find((item) => item.id === projectId)
    onNotice?.(`已把 ${call.result.value.imported} 项放入「${project?.label ?? projectId}」主画布`)
    setSelectedIds([])
    await refresh()
  }, [client, onNotice, projects, refresh])

  const select = (id: string, additive = false) => setSelectedIds((current) => additive ? (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]) : [id])
  const marquee = (ids: string[], additive: boolean) => setSelectedIds((current) => additive ? [...new Set([...current, ...ids])] : ids)

  return <main className="capture-space-shell porcelain-studio-v2 lcos-reconstructed" data-testid="capture-space">
    <header className="capture-space-header">
      <button type="button" className="capture-space-back" onClick={onClose}><ArrowLeft size={15}/>项目</button>
      <div className="capture-space-title"><Boxes size={17}/><div><strong>Capture Space</strong><span>项目之前 · {snapshot?.pendingCount ?? 0} 项</span></div></div>
      <div className="capture-space-actions">
        <button type="button" onClick={() => void organize()} disabled={busy || !nodes.length}><Sparkles size={14}/>智能整理</button>
        <button type="button" onClick={() => void refresh()} disabled={busy}><RefreshCw size={14}/>{busy ? '处理中' : '刷新'}</button>
      </div>
    </header>
    <aside className="capture-project-targets" aria-label="项目投送目标">
      <span>放入项目</span>
      {projects.map((project) => <button
        key={project.id}
        type="button"
        data-project-view-drop-target={project.id}
        data-project-view-drop-label={project.label}
        title={`Semantic Drop 到 ${project.label}`}
        onDoubleClick={() => onOpenProject?.(project.id)}
      ><b>{project.label.slice(0, 1)}</b><em>{project.label}</em></button>)}
    </aside>
    <section className="capture-space-canvas">
      <ProjectCanvas
        surfaceMode="capture"
        nodes={nodes}
        setNodes={setNodes}
        edges={[]}
        setEdges={() => {}}
        camera={camera}
        setCamera={setCamera}
        selectedId={selectedIds[0] ?? null}
        selectedIds={selectedIds}
        selectedEdgeId={selectedEdgeId}
        setSelectedEdgeId={setSelectedEdgeId}
        pendingId={null}
        runId="capture-space"
        runStatus={null}
        spaceHeld={false}
        workspaceFrames={frames}
        workspaceMemberNodes={nodes}
        onSelect={select}
        onClearSelection={() => setSelectedIds([])}
        onMarqueeSelect={marquee}
        onSelectEdge={setSelectedEdgeId}
        onDoubleClick={() => {}}
        onDetails={() => {}}
        onCreateNodeFromAnchor={() => {}}
        onFilesDropped={() => onNotice?.('本地文件请先拖到 Capture 悬浮窗，随后会自动出现在这里')}
        onExternalTextDrop={() => onNotice?.('网页/Agent 文字请使用 Capture 或 Semantic Drop 收入')}
        onArrangeSelection={() => void organize()}
        onCopySelection={() => {}}
        onDuplicateSelection={() => {}}
        onCreateScopeFromSelection={() => {}}
        onDeleteSelection={() => {}}
        onPointerWorldChange={() => {}}
        onSpaceCreate={() => {}}
        onReorganize={() => void organize()}
        onDirectProjectViewDrop={(projectId, ids) => void materialize(projectId, ids)}
        onPresentationCommit={() => void persist()}
      />
    </section>
  </main>
}
