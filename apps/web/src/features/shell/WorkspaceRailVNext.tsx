import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Crosshair, LayoutPanelLeft, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
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
  const count = Math.max(2, Math.min(6, workspace.focusedViewIds.length || 3))
  const bounds = workspace.frameBounds
  const salt = Math.abs(Math.round((bounds?.x ?? index * 19) + (bounds?.y ?? index * 11)))
  return Array.from({ length: count }, (_, item) => ({
    left: 3 + ((item * 7 + salt) % 18),
    top: 3 + ((item * 5 + salt * 2) % 18),
    width: item % 2 ? 6 : 9,
    height: item % 3 ? 5 : 7,
  }))
}

export function WorkspaceRailVNext({ workspaces, activeId, runStatus, onOverview, onActivate, onLocate, onAdd, onEdit, onDuplicate, onDelete, onMove }: Props) {
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

  const preview = useMemo(() => previewId ? workspaces.find((workspace) => workspace.id === previewId) ?? null : null, [previewId, workspaces])
  return <aside ref={railRef} className="vnext-workspace-rail lcos-workspace-rail" data-testid="workspace-dock" aria-label="工作空间">
    <div className="lcos-rail-primary">
      <button type="button" className={activeId === null ? 'vnext-rail-button active' : 'vnext-rail-button'} title="当前 Scope 总览" aria-label="当前 Scope 总览" onClick={() => { setPreviewId(null); setMenuFor(null); onOverview() }}><LayoutPanelLeft size={15}/></button>
      <div className="vnext-rail-divider"/>
      <div className="vnext-workspace-stack" role="list">
        {workspaces.map((workspace, index) => {
          const active = activeId === workspace.id
          const attention = active && Boolean(runStatus && ['waiting_input', 'review', 'failed'].includes(runStatus))
          return <div className="lcos-workspace-rail-item" key={workspace.id} onPointerEnter={() => setPreviewId(workspace.id)} onPointerLeave={() => { if (menuFor !== workspace.id) setPreviewId((current) => current === workspace.id ? null : current) }}>
            <button type="button" role="listitem" className={active ? 'vnext-workspace-mini active' : 'vnext-workspace-mini'} aria-label={`${active ? '当前工作空间' : '进入工作空间'}：${workspace.label}`} onFocus={() => setPreviewId(workspace.id)} onClick={() => { onActivate(workspace.id); onLocate(workspace.id); setPreviewId(null); setMenuFor(null) }}>
              <span className="vnext-mini-map" aria-hidden="true">{miniatureSeed(workspace, index).map((item, i) => <i key={i} style={{ left:item.left, top:item.top, width:item.width, height:item.height }}/>)}</span>
              {attention && <span className={`vnext-workspace-attention status-${runStatus}`}/>} 
            </button>
          </div>
        })}
      </div>
    </div>
    <div className="lcos-rail-footer"><button type="button" className="vnext-rail-button vnext-rail-add" title="新建工作空间" aria-label="新建工作空间" onClick={onAdd}><Plus size={15}/></button></div>

    {preview && <div className="vnext-workspace-preview lcos-workspace-preview" role="dialog" aria-label={`${preview.label} 工作空间`} onPointerEnter={() => setPreviewId(preview.id)} onPointerLeave={() => { if (menuFor !== preview.id) setPreviewId(null) }}>
      <div className="vnext-workspace-preview-map">{miniatureSeed(preview, 2).map((item, i) => <i key={i} style={{ left:item.left*2.15, top:item.top*1.65, width:item.width*2, height:item.height*1.55 }}/>)}</div>
      <div className="lcos-workspace-preview-copy"><strong>{preview.label}</strong><span>{preview.focusedViewIds.length || '自由'} 项 · {preview.contextPolicy === 'selection-only' ? 'Selection' : 'Workspace'} Context</span></div>
      <button type="button" aria-label={`仅定位 ${preview.label}`} title="定位 Camera" onClick={(event) => { event.stopPropagation(); onLocate(preview.id); setPreviewId(null) }}><Crosshair size={13}/></button>
      {(onEdit || onDuplicate || onDelete || onMove) && <button type="button" aria-label={`${preview.label} 更多操作`} title="更多操作" onClick={(event) => { event.stopPropagation(); setMenuFor((current) => current === preview.id ? null : preview.id) }}><MoreHorizontal size={13}/></button>}
      {menuFor === preview.id && <div className="vnext-workspace-menu" role="menu" onClick={(event) => event.stopPropagation()}>
        {onEdit && <button onClick={() => { onEdit(preview.id); setMenuFor(null) }}><Pencil size={12}/>重命名与意图</button>}
        {onDuplicate && <button onClick={() => { onDuplicate(preview.id); setMenuFor(null) }}><Copy size={12}/>复制 Workspace</button>}
        {onMove && <><div className="menu-rule"/><button disabled={workspaces.findIndex((item) => item.id === preview.id) <= 0} onClick={() => { onMove(preview.id,-1); setMenuFor(null) }}><ArrowUp size={12}/>上移</button><button disabled={workspaces.findIndex((item) => item.id === preview.id) >= workspaces.length-1} onClick={() => { onMove(preview.id,1); setMenuFor(null) }}><ArrowDown size={12}/>下移</button></>}
        {onDelete && <><div className="menu-rule"/><button className="danger" disabled={workspaces.length <= 1} onClick={() => { onDelete(preview.id); setMenuFor(null) }}><Trash2 size={12}/>删除 Workspace</button></>}
      </div>}
    </div>}
  </aside>
}
