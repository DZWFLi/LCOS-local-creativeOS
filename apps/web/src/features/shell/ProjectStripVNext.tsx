import { FolderOpen, History, Import, Inbox, Layers3, MoreHorizontal, Search } from 'lucide-react'
import type { RunStatus } from '../../model'
import type { SaveStatus } from '../../runtime/runtimeBridge'

interface Props {
  projectLabel: string
  scopeLabel: string
  saveStatus: SaveStatus
  runStatus: RunStatus | null
  showWorkRailActions?: boolean
  onOpenProjectDrive: () => void
  onImport: () => void
  onHistory: () => void
  onSearch?: () => void
  onMore?: () => void
  pendingCount?: number
  onPending?: () => void
  onRevealFolder?: () => void
}

export function ProjectStripVNext({ projectLabel, scopeLabel, saveStatus, runStatus, showWorkRailActions = true, onOpenProjectDrive, onImport, onHistory, onSearch, onMore, pendingCount, onPending, onRevealFolder }: Props) {
  return <header className="vnext-project-strip" data-testid="vnext-project-strip">
    <div className="vnext-project-identity">
      <button type="button" className="vnext-brand-lockup" aria-label="打开项目列表" title="项目列表" onClick={onOpenProjectDrive}><Layers3 size={16}/><span>LCOS</span></button>
      <button type="button" className="vnext-project-name" onClick={onOpenProjectDrive} title="打开项目列表"><strong>{projectLabel}</strong><span>{scopeLabel}</span></button>
      {onRevealFolder && <button type="button" className="vnext-project-reveal" aria-label="在资源管理器中打开项目目录" title="在资源管理器中打开项目目录" onClick={onRevealFolder}><FolderOpen size={15} /></button>}
    </div>
    <div className="vnext-project-state" aria-label="项目状态">
      <span className={`vnext-save-dot state-${saveStatus}`} title={`保存状态：${saveStatus}`} />
      <span className="vnext-save-copy">{saveStatus === 'saving' ? '正在保存' : saveStatus === 'unsaved' ? '保存失败' : '已保存'}</span>
      {runStatus && <span className={`vnext-run-dot status-${runStatus}`} title={`Run：${runStatus}`} />}
    </div>
    <nav className="vnext-project-actions" aria-label="项目操作">
      <button type="button" aria-label="搜索" title="搜索" onClick={onSearch}><Search size={15} /></button>
      <button type="button" aria-label="导入" title="导入" onClick={onImport}><Import size={15} /></button>
      {showWorkRailActions && onPending ? <button type="button" className={`vnext-pending-entry ${(pendingCount ?? 0) > 0 ? 'has-items' : ''}`} aria-label={`待确认 ${pendingCount ?? 0} 项`} title={`待确认 · ${pendingCount ?? 0} 项`} onClick={onPending}><Inbox size={15} /><span>{(pendingCount ?? 0) > 0 ? `${pendingCount} 待确认` : '待确认'}</span></button> : null}
      <button type="button" aria-label="对话记录" title="对话记录" onClick={onHistory}><History size={15} /></button>
      <button type="button" aria-label="更多" title="更多" onClick={onMore}><MoreHorizontal size={15} /></button>
    </nav>
  </header>
}
