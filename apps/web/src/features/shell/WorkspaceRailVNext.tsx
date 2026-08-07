import { useEffect, useRef, useState } from 'react'
import { Crosshair, LayoutPanelLeft, Plus } from 'lucide-react'
import type { RunStatus, Workspace } from '../../model'

interface Props {
  workspaces: Workspace[]
  activeId: string | null
  runStatus: RunStatus | null
  onOverview: () => void
  onActivate: (id: string) => void
  onLocate: (id: string) => void
  onAdd: () => void
}

function miniatureSeed(workspace: Workspace, index: number) {
  const count = Math.max(1, Math.min(4, workspace.focusedViewIds.length || 2))
  return Array.from({ length: count }, (_, item) => ({
    left: 4 + ((item * 7 + index * 3) % 17),
    top: 4 + ((item * 5 + index * 4) % 17),
    width: item % 2 ? 7 : 10,
    height: item % 3 ? 6 : 8,
  }))
}

export function WorkspaceRailVNext({ workspaces, activeId, runStatus, onOverview, onActivate, onLocate, onAdd }: Props) {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const railRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (railRef.current && !railRef.current.contains(event.target as Node)) setPreviewId(null)
    }
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') setPreviewId(null) }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', esc) }
  }, [])

  const preview = previewId ? workspaces.find((workspace) => workspace.id === previewId) : null
  return <aside ref={railRef} className="vnext-workspace-rail" data-testid="workspace-dock" aria-label="工作空间">
    <button type="button" className={activeId === null ? 'vnext-rail-button active' : 'vnext-rail-button'} title="当前 Scope 总览" aria-label="当前 Scope 总览" onClick={() => { setPreviewId(null); onOverview() }}><LayoutPanelLeft size={15} /></button>
    <div className="vnext-rail-divider" />
    <div className="vnext-workspace-stack" role="list">
      {workspaces.map((workspace, index) => {
        const active = activeId === workspace.id
        const attention = active && Boolean(runStatus && ['waiting_input', 'review', 'failed'].includes(runStatus))
        return <button
          key={workspace.id}
          type="button"
          role="listitem"
          className={active ? 'vnext-workspace-mini active' : 'vnext-workspace-mini'}
          aria-label={`${active ? '当前工作空间' : '进入工作空间'}：${workspace.label}`}
          onPointerEnter={() => setPreviewId(workspace.id)}
          onFocus={() => setPreviewId(workspace.id)}
          onClick={() => { onActivate(workspace.id); onLocate(workspace.id); setPreviewId(null) }}
        >
          <span className="vnext-mini-map" aria-hidden="true">{miniatureSeed(workspace, index).map((item, i) => <i key={i} style={{ left: item.left, top: item.top, width: item.width, height: item.height }} />)}</span>
          {attention && <span className={`vnext-workspace-attention status-${runStatus}`} />}
        </button>
      })}
    </div>
    <button type="button" className="vnext-rail-button vnext-rail-add" title="新建工作空间" aria-label="新建工作空间" onClick={onAdd}><Plus size={15} /></button>
    {preview && <div className="vnext-workspace-preview" role="tooltip">
      <div className="vnext-workspace-preview-map">{miniatureSeed(preview, 2).map((item, i) => <i key={i} style={{ left: item.left * 1.8, top: item.top * 1.35, width: item.width * 1.7, height: item.height * 1.35 }} />)}</div>
      <div><strong>{preview.label}</strong><span>{preview.focusedViewIds.length || '自由'} 项 · {preview.contextPolicy === 'selection-only' ? 'Selection Context' : 'Workspace Context'}</span></div>
      <button type="button" aria-label={`仅定位 ${preview.label}`} title="仅定位 Camera" onClick={(event) => { event.stopPropagation(); onLocate(preview.id); setPreviewId(null) }}><Crosshair size={13} /></button>
    </div>}
  </aside>
}
