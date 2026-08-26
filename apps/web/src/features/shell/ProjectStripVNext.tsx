import { FolderOpen, History, Import, Inbox, Layers3, MoreHorizontal, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import type { RunStatus } from '../../model'
import type { SaveStatus } from '../../runtime/runtimeBridge'

interface Props {
  projectLabel: string
  scopeLabel: string
  saveStatus: SaveStatus
  runStatus: RunStatus | null
  showWorkRailActions?: boolean
  /** RECEIVER-1 会话承接 Chip 插槽：挂在状态区右侧（Work Identity 常驻入口）。 */
  receiverSlot?: ReactNode
  onOpenProjectDrive: () => void
  onImport: () => void
  onHistory: () => void
  onSearch?: () => void
  onMore?: () => void
  pendingCount?: number
  onPending?: () => void
  onRevealFolder?: () => void
}

/**
 * 债5：保存状态如实播报。'unsaved' 表示尚未成功保存（保存失败后的重试窗口也在其中），
 * 不等于“保存失败”——失败详情由 App 的 notice 通知承担；'idle' 是桥的初始占位值
 * （App 实际不会产生），与 unsaved 同归“未保存”，绝不虚报“已保存”。
 */
export function saveStatusCopy(status: SaveStatus): string {
  if (status === 'saving') return '正在保存'
  if (status === 'saved') return '已保存'
  return '未保存'
}

export function ProjectStripVNext({ projectLabel, scopeLabel, saveStatus, runStatus, showWorkRailActions = true, receiverSlot, onOpenProjectDrive, onImport, onHistory, onSearch, onMore, pendingCount, onPending, onRevealFolder }: Props) {
  return <header className="vnext-project-strip" data-testid="vnext-project-strip">
    <div className="vnext-project-identity">
      <button type="button" className="vnext-brand-lockup" aria-label="打开项目列表" title="项目列表" onClick={onOpenProjectDrive}><Layers3 size={16}/><span>LCOS</span></button>
      {/* 长项目名截断由 CSS（max-width + ellipsis）承担，title 携带完整名保证可看见全名。 */}
      <button type="button" className="vnext-project-name" onClick={onOpenProjectDrive} title="打开项目列表"><strong title={projectLabel}>{projectLabel}</strong><span>{scopeLabel}</span></button>
      {onRevealFolder && <button type="button" className="vnext-project-reveal" aria-label="在资源管理器中打开项目目录" title="在资源管理器中打开项目目录" onClick={onRevealFolder}><FolderOpen size={15} /></button>}
    </div>
    <div className="vnext-project-state" aria-label="项目状态">
      <span className={`vnext-save-dot state-${saveStatus}`} title={`保存状态：${saveStatusCopy(saveStatus)}`} />
      <span className="vnext-save-copy">{saveStatusCopy(saveStatus)}</span>
      {runStatus && <span className={`vnext-run-dot status-${runStatus}`} title={`Run：${runStatus}`} />}
    </div>
    {receiverSlot}
    <nav className="vnext-project-actions" aria-label="项目操作">
      <button type="button" aria-label="搜索" title="搜索" onClick={onSearch}><Search size={15} /></button>
      <button type="button" aria-label="导入" title="导入" onClick={onImport}><Import size={15} /></button>
      {showWorkRailActions && onPending ? <button type="button" className={`vnext-pending-entry ${(pendingCount ?? 0) > 0 ? 'has-items' : ''}`} aria-label={`待确认 ${pendingCount ?? 0} 项`} title={`待确认 · ${pendingCount ?? 0} 项`} onClick={onPending}><Inbox size={15} /><span>{(pendingCount ?? 0) > 0 ? `${pendingCount} 待确认` : '待确认'}</span></button> : null}
      <button type="button" aria-label="对话记录" title="对话记录" onClick={onHistory}><History size={15} /></button>
      <button type="button" aria-label="更多" title="更多" onClick={onMore}><MoreHorizontal size={15} /></button>
    </nav>
  </header>
}
