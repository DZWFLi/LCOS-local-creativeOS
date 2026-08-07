import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Crosshair, History, LayoutPanelLeft, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import type { RunStatus, Workspace } from '../../model'

interface Props {
  workspaces: Workspace[]
  activeId: string | null
  runStatus: RunStatus | null
  onOverview: () => void
  onActivate: (id: string) => void
  onLocate: (id: string) => void
  onAdd: () => void
  onEdit?: (id: string) => void
  onDuplicate?: (id: string) => void
  onDelete?: (id: string) => void
  onSaveState?: (id: string) => void
  onOpenStates?: (id: string) => void
  onMove?: (id: string, direction: -1 | 1) => void
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

export function WorkspaceRailVNext({ workspaces, activeId, runStatus, onOverview, onActivate, onLocate, onAdd, onEdit, onDuplicate, onDelete, onSaveState, onOpenStates, onMove }: Props) {
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const railRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (railRef.current && !railRef.current.contains(event.target as Node)) { setPreviewId(null); setMenuFor(null) }
    }
    const esc = (event: KeyboardEvent) => { if (event.key === 'Escape') { setPreviewId(null); setMenuFor(null) } }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', esc) }
  }, [])

  const preview = previewId ? workspaces.find((workspace) => workspace.id === previewId) : null
  return <aside ref={railRef} className="vnext-workspace-rail" data-testid="workspace-dock" aria-label="工作空间">
    <button type="button" className={activeId === null ? 'vnext-rail-button active' : 'vnext-rail-button'} title="当前 Scope 总览" aria-label="当前 Scope 总览" onClick={() => { setPreviewId(null); setMenuFor(null); onOverview() }}><LayoutPanelLeft size={15} /></button>
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
          onClick={() => { onActivate(workspace.id); onLocate(workspace.id); setPreviewId(null); setMenuFor(null) }}
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
      {(onEdit || onDuplicate || onDelete || onSaveState || onOpenStates || onMove) && <button type="button" aria-label={`${preview.label} 更多操作`} title="更多操作" onClick={(event) => { event.stopPropagation(); setMenuFor((current) => current === preview.id ? null : preview.id) }}><MoreHorizontal size={13} /></button>}
      {menuFor === preview.id && <div className="vnext-workspace-menu" role="menu" onClick={(event) => event.stopPropagation()}>
        {onEdit && <button onClick={() => { onEdit(preview.id); setMenuFor(null) }}><Pencil size={12} />重命名与意图</button>}
        {onDuplicate && <button onClick={() => { onDuplicate(preview.id); setMenuFor(null) }}><Copy size={12} />复制工作空间</button>}
        {onSaveState && <button onClick={() => { onSaveState(preview.id); setMenuFor(null) }}><History size={12} />保存当前工作现场</button>}
        {onOpenStates && <button onClick={() => { onOpenStates(preview.id); setMenuFor(null) }}><History size={12} />工作现场历史</button>}
        {onMove && <><div className="menu-rule" /><button disabled={workspaces.findIndex((item) => item.id === preview.id) <= 0} onClick={() => { onMove(preview.id, -1); setMenuFor(null) }}><ArrowUp size={12} />上移</button><button disabled={workspaces.findIndex((item) => item.id === preview.id) >= workspaces.length - 1} onClick={() => { onMove(preview.id, 1); setMenuFor(null) }}><ArrowDown size={12} />下移</button></>}
        {onDelete && <><div className="menu-rule" /><button className="danger" disabled={workspaces.length <= 1} onClick={() => { onDelete(preview.id); setMenuFor(null) }}><Trash2 size={12} />删除工作空间</button></>}
      </div>}
    </div>}
  </aside>
}
