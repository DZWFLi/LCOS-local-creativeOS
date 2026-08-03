import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crosshair,
  LayoutPanelLeft,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import type { RunStatus, Workspace } from '../../model'

interface Props {
  workspaces: Workspace[]
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  activeId: string | null
  capabilitiesOpen: boolean
  onOpenCapabilities: () => void
  onOverview: () => void
  onChange: (id: string) => void
  onLocate: (id: string) => void
  onAddWorkspace: () => void
  onEditWorkspace: (id: string) => void
  onDuplicateWorkspace: (id: string) => void
  onDeleteWorkspace: (id: string) => void
  onMoveWorkspace: (id: string, direction: -1 | 1) => void
  onSaveWorkspaceState: (id: string) => void
  onOpenWorkspaceStates: (id: string) => void
  runStatus: RunStatus | null
}

export function WorkspaceDock({ workspaces, activeId, collapsed, onCollapsedChange, capabilitiesOpen, onOpenCapabilities, onOverview, onChange, onLocate, onAddWorkspace, onEditWorkspace, onDuplicateWorkspace, onDeleteWorkspace, onMoveWorkspace, onSaveWorkspaceState, onOpenWorkspaceStates, runStatus }: Props) {
  const [menuId, setMenuId] = useState<string | null>(null)
  const dockRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (dockRef.current && !dockRef.current.contains(event.target as Node)) setMenuId(null)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [])

  if (collapsed) return <aside ref={dockRef} data-testid="workspace-dock" className="workspace-dock collapsed compact-workspace-rail" aria-label="工作空间栏">
    <button className={capabilitiesOpen ? 'capability-launcher active pressable' : 'capability-launcher pressable'} aria-label="打开快捷能力" title="添加与工作流" onClick={onOpenCapabilities}><Sparkles size={14} /></button>
    <button className="dock-expand pressable" aria-label="展开工作空间栏" title="展开工作空间栏" onClick={() => onCollapsedChange(false)}><ChevronRight size={14} /></button>
    <button className={activeId === null ? 'collapsed-overview active pressable' : 'collapsed-overview pressable'} aria-label="当前画布总览" title="当前画布总览" onClick={onOverview}><LayoutPanelLeft size={14} /></button>
    <div className="compact-workspace-dots" role="list" aria-label="当前画布的工作空间">{workspaces.map((item) => {
      const active = item.id === activeId
      const needsAttention = active && (runStatus === 'waiting_input' || runStatus === 'review' || runStatus === 'failed')
      return <button key={item.id} role="listitem" className={active ? 'compact-workspace-dot active pressable' : 'compact-workspace-dot pressable'} aria-label={`${active ? '当前工作空间：' : '激活工作空间：'}${item.label}`} title={item.label} onClick={() => onChange(item.id)}><span className={`intent-swatch intent-${item.intent ?? 'blank'}`} />{active && <span className="compact-active-rail" aria-hidden="true" />}{needsAttention && <span className={`workspace-attention status-${runStatus}`} />}</button>
    })}</div>
  </aside>

  return <aside ref={dockRef} data-testid="workspace-dock" className="workspace-dock">
    <button className="capability-launcher-wide pressable" onClick={onOpenCapabilities}><Sparkles size={13} />添加与工作流</button>
    <div className="dock-label"><LayoutPanelLeft size={12} /> 工作空间 <span className="dock-label-actions"><button className="dock-inline-add pressable" aria-label="新建工作空间" title="新建工作空间" onClick={onAddWorkspace}><Plus size={12} /></button><button className="dock-collapse pressable" aria-label="收起工作空间栏" onClick={() => { setMenuId(null); onCollapsedChange(true) }}><ChevronLeft size={12} /></button></span></div>
    <button data-testid="project-overview" className={activeId === null ? 'workspace overview active pressable' : 'workspace overview pressable'} onClick={onOverview}><i />当前画布总览 <small>{workspaces.length}</small></button>
    <div className="workspace-list" role="list">{workspaces.map((workspace, index) => <div key={workspace.id} className="workspace-row" role="listitem">
      <button data-testid={`workspace-${workspace.id}`} className={workspace.id === activeId ? 'workspace active pressable' : 'workspace pressable'} onClick={() => onChange(workspace.id)} onDoubleClick={(event) => { event.preventDefault(); onEditWorkspace(workspace.id) }} title="点击激活 · 双击重命名"><span className={`intent-swatch intent-${workspace.intent ?? 'blank'}`} /><span className="workspace-name">{workspace.label}</span></button>
      <button data-testid={`workspace-locate-${workspace.id}`} className="workspace-locate pressable" aria-label={`定位 ${workspace.label}`} title={`定位 ${workspace.label}`} onClick={(event) => { event.stopPropagation(); onLocate(workspace.id) }}><Crosshair size={12} /></button>
      <button className="workspace-more pressable" aria-label={`${workspace.label} 更多操作`} onClick={(event) => { event.stopPropagation(); setMenuId((current) => current === workspace.id ? null : workspace.id) }}><MoreHorizontal size={13} /></button>
      {menuId === workspace.id && <div className="workspace-menu" role="menu"><button onClick={() => { setMenuId(null); onEditWorkspace(workspace.id) }}><Pencil size={13} />重命名与意图</button><button onClick={() => { setMenuId(null); onLocate(workspace.id) }}><Crosshair size={13} />定位</button><button onClick={() => { setMenuId(null); onDuplicateWorkspace(workspace.id) }}><Copy size={13} />复制工作空间</button><button onClick={() => { setMenuId(null); onSaveWorkspaceState(workspace.id) }}><History size={13} />保存当前工作现场</button><button onClick={() => { setMenuId(null); onOpenWorkspaceStates(workspace.id) }}><History size={13} />工作现场历史</button><button disabled={index === 0} onClick={() => { setMenuId(null); onMoveWorkspace(workspace.id, -1) }}><ArrowUp size={13} />上移</button><button disabled={index === workspaces.length - 1} onClick={() => { setMenuId(null); onMoveWorkspace(workspace.id, 1) }}><ArrowDown size={13} />下移</button><div className="menu-rule" /><button className="danger" disabled={workspaces.length <= 1} onClick={() => { setMenuId(null); onDeleteWorkspace(workspace.id) }}><Trash2 size={13} />删除工作空间</button></div>}
    </div>)}</div>
  </aside>
}
