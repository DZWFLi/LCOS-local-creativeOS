import { FolderOpen, History, Import, Inbox, MessageCircle, MoreHorizontal, Search } from 'lucide-react'
import type { RunStatus } from '../../model'
import type { SaveStatus } from '../../runtime/runtimeBridge'

interface Props {
  projectLabel: string
  scopeLabel: string
  saveStatus: SaveStatus
  runStatus: RunStatus | null
  onOpenProjectDrive: () => void
  onImport: () => void
  onGlobalChat: () => void
  onHistory: () => void
  onSearch?: () => void
  onMore?: () => void
  pendingCount?: number
  onPending?: () => void
}

export function ProjectStripVNext({ projectLabel, scopeLabel, saveStatus, runStatus, onOpenProjectDrive, onImport, onGlobalChat, onHistory, onSearch, onMore, pendingCount, onPending }: Props) {
  return <header className="vnext-project-strip" data-testid="vnext-project-strip">
    <div className="vnext-project-identity">
      <button type="button" className="vnext-brand-dot" aria-label="项目列表" title="项目列表" onClick={onOpenProjectDrive}><FolderOpen size={15} /></button>
      <button type="button" className="vnext-project-name" onClick={onOpenProjectDrive} title="打开项目列表"><strong>{projectLabel}</strong><span>{scopeLabel}</span></button>
    </div>
    <div className="vnext-project-state" aria-label="项目状态">
      <span className={`vnext-save-dot state-${saveStatus}`} title={`保存状态：${saveStatus}`} />
      {runStatus && <span className={`vnext-run-dot status-${runStatus}`} title={`Run：${runStatus}`} />}
    </div>
    <nav className="vnext-project-actions" aria-label="项目操作">
      <button type="button" aria-label="搜索" title="搜索" onClick={onSearch}><Search size={15} /></button>
      <button type="button" aria-label="导入" title="导入" onClick={onImport}><Import size={15} /></button>
      <button type="button" aria-label="全局 Agent 对话" title="全局 Agent 对话" onClick={onGlobalChat}><MessageCircle size={15} /></button>
      {onPending && <button type="button" className="vnext-pending-entry" aria-label="待确认" title={`待确认 · ${pendingCount ?? 0} 项`} onClick={onPending}><Inbox size={15} />{(pendingCount ?? 0) > 0 && <b className="vnext-pending-badge">{pendingCount}</b>}</button>}
      <button type="button" aria-label="对话记录" title="对话记录" onClick={onHistory}><History size={15} /></button>
      <button type="button" aria-label="更多" title="更多" onClick={onMore}><MoreHorizontal size={15} /></button>
    </nav>
  </header>
}
