import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Filter,
  LayoutGrid,
  LayoutPanelLeft,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import type { NodeLayer, RunStatus, Workspace } from '../../model'

interface Props {
  workspaces: Workspace[]
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  activeId: string
  onOverview: () => void
  onChange: (id: string) => void
  onOpenCreate: () => void
  onArrangeCanvas: () => void
  onAddWorkspace: () => void
  onEditWorkspace: (id: string) => void
  onDuplicateWorkspace: (id: string) => void
  onDeleteWorkspace: (id: string) => void
  onMoveWorkspace: (id: string, direction: -1 | 1) => void
  onSaveView: (id: string) => void
  visibleLayers: NodeLayer[]
  onToggleLayer: (layer: NodeLayer) => void
  runStatus: RunStatus | null
}

export function WorkspaceDock({ workspaces, activeId, collapsed, onCollapsedChange, onOverview, onChange, onOpenCreate, onArrangeCanvas, onAddWorkspace, onEditWorkspace, onDuplicateWorkspace, onDeleteWorkspace, onMoveWorkspace, onSaveView, visibleLayers, onToggleLayer, runStatus }: Props) {
  const [menuId, setMenuId] = useState<string | null>(null)
  const dockRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (dockRef.current && !dockRef.current.contains(event.target as Node)) {
        setMenuId(null)
      }
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [])

  if (collapsed) return <aside ref={dockRef} data-testid="workspace-dock" className="workspace-dock collapsed compact-workspace-rail" aria-label="工作视角栏已收起">
    <button className="dock-expand" aria-label="展开工作视角栏" title="展开工作视角栏" onClick={() => onCollapsedChange(false)}><ChevronRight size={15} /></button>
    <div className="compact-workspace-dots" role="list" aria-label="工作视角快捷入口">{workspaces.map((item) => {
      const active = item.id === activeId
      const needsAttention = active && (runStatus === 'waiting_input' || runStatus === 'review' || runStatus === 'failed')
      return <button key={item.id} role="listitem" className={active ? 'compact-workspace-dot active' : 'compact-workspace-dot'} aria-label={`${active ? '当前工作视角：' : '切换到：'}${item.label}`} title={item.label} onClick={() => onChange(item.id)}><span className={`intent-swatch intent-${item.intent ?? 'blank'}`} />{active && <span className="compact-active-rail" aria-hidden="true" />}{needsAttention && <span className={`workspace-attention status-${runStatus}`} />}</button>
    })}</div>
    <button className="collapsed-overview" aria-label="查看项目总览" title="项目总览" onClick={onOverview}><LayoutPanelLeft size={15} /></button>
  </aside>

  return <aside ref={dockRef} data-testid="workspace-dock" className="workspace-dock">
    <div className="dock-label"><LayoutPanelLeft size={13} /> 工作视角 <span className="dock-label-actions"><button className="dock-inline-add" aria-label="新建工作视角" title="新建工作视角" onClick={onAddWorkspace}><Plus size={12} /></button><button className="dock-collapse" aria-label="收起工作视角栏" onClick={() => { setMenuId(null); onCollapsedChange(true) }}><ChevronLeft size={12} /></button></span></div>
    <button className="workspace overview" onClick={onOverview}><i />项目总览 <small>{workspaces.length}</small></button>
    <div className="workspace-list" role="list">{workspaces.map((workspace, index) => <div key={workspace.id} className="workspace-row" role="listitem">
      <button className={workspace.id === activeId ? 'workspace active' : 'workspace'} onClick={() => onChange(workspace.id)} onDoubleClick={(event) => { event.preventDefault(); onEditWorkspace(workspace.id) }} title="点击移动镜头 · 双击重命名"><span className={`intent-swatch intent-${workspace.intent ?? 'blank'}`} /><span className="workspace-name">{workspace.label}</span><small>{workspace.id === activeId ? '当前' : ''}</small></button>
      <button className="workspace-more" aria-label={`${workspace.label} 更多操作`} onClick={(event) => { event.stopPropagation(); setMenuId((current) => current === workspace.id ? null : workspace.id) }}><MoreHorizontal size={14} /></button>
      {menuId === workspace.id && <div className="workspace-menu" role="menu"><button onClick={() => { setMenuId(null); onEditWorkspace(workspace.id) }}><Pencil size={13} />重命名与意图</button><button onClick={() => { setMenuId(null); onSaveView(workspace.id) }}><Save size={13} />保存当前视角</button><button onClick={() => { setMenuId(null); onDuplicateWorkspace(workspace.id) }}><Copy size={13} />复制工作视角</button><button disabled={index === 0} onClick={() => { setMenuId(null); onMoveWorkspace(workspace.id, -1) }}><ArrowUp size={13} />上移</button><button disabled={index === workspaces.length - 1} onClick={() => { setMenuId(null); onMoveWorkspace(workspace.id, 1) }}><ArrowDown size={13} />下移</button><div className="menu-rule" /><button className="danger" disabled={workspaces.length <= 1} onClick={() => { setMenuId(null); onDeleteWorkspace(workspace.id) }}><Trash2 size={13} />删除视角</button></div>}
    </div>)}</div>
    <div className="dock-rule" />
    <div className="dock-label"><Filter size={13} /> 画布显示</div>
    <button className={visibleLayers.includes('core') ? 'workspace filter-active' : 'workspace'} onClick={() => onToggleLayer('core')}><span className="filter-check">{visibleLayers.includes('core') && <Check size={11} />}</span>内容</button>
    <button className={visibleLayers.includes('process') ? 'workspace filter-active' : 'workspace'} onClick={() => onToggleLayer('process')}><span className="filter-check">{visibleLayers.includes('process') && <Check size={11} />}</span>过程记录</button>
    <button className="workspace" onClick={onArrangeCanvas}><span className="filter-check"><LayoutGrid size={12} /></span>整理当前画布</button>
    <button className="dock-add primary" onClick={onOpenCreate}><Plus size={14} />添加内容</button>
  </aside>
}
