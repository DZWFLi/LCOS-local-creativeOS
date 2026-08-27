import { FolderOpen, History, Import, Inbox, Layers3, MoreHorizontal, Search, Sparkles } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Menu } from '@base-ui/react/menu'
import type { MenuRootActions } from '@base-ui/react/menu'
import type { RunStatus } from '../../model'
import type { SaveStatus } from '../../runtime/runtimeBridge'
import { register as registerOverlay } from '../ui/overlayStack'

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
 * A-3b 顶条入口审计（Apple Donor Map §6.1 四步原则）：
 * - 保留一级：Project identity（brand / 项目名）、Search（§6.1 保留候选明示）、
 *   待确认（badge 承载的 run-blocking 全局注意态，点击直达 WorkRail 复核，
 *   属「真正必要的 global action」；narrow collab 布局本就只保留它与搜索）、
 *   Receiver 镜像（receiverSlot，独立组件不动）、保存/Run 状态点（被动镜像）、⋯ overflow。
 * - 降级进 More（完成态但一级资格不足；非删除代码，每项保留原 onClick）：
 *   导入（add 流属 WorkspaceDock「添加与工作流」，一级重复）；
 *   对话记录（与 ReceiverChip 的 onOpenArchive 打开同一 ConversationContextDialog，
 *   且 sidecar 布局早已 display:none 该按钮——布局系统已判其非一级必需）；
 *   打开项目目录（低频项目工具，Apple 心智属 menu 不属 toolbar）；
 *   快捷能力（原 ⋯ 的 CapabilityPopover，WorkspaceDock 已有常驻 launcher）。
 * More menu：Base UI Menu 行为（Esc / outside / focus-return / 方向键 / item press 关闭），
 * open 250ms / close 150ms（--lcos-dur-menu-*），玻璃 token --lcos-mat-popover-*，
 * 并注册 overlayStack 供全局浮层裁决（grok-bot Donor Map A1 三路关闭收口）。
 */
const MORE_MENU_LAYER_ID = 'vnext-strip-more-menu'

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
  const moreActions = useRef<MenuRootActions | null>(null)
  const morePopup = useRef<HTMLDivElement | null>(null)
  const unregisterMore = useRef<(() => void) | null>(null)

  // A-3b：More menu 挂 overlayStack（kind=menu）。Base UI 自带三路关闭
  // （Esc=escape-key / outside=outside-press / item press + finalFocus 回 trigger），
  // 此注册让全局 Esc / outside 裁决（未来接线方调 esc() / handleOutsidePress()）
  // 也能一次收掉这一层；onEsc 走 actionsRef.close()，走完整关闭动画。
  const handleMoreOpenChange = (open: boolean): void => {
    unregisterMore.current?.()
    unregisterMore.current = null
    if (!open) return
    unregisterMore.current = registerOverlay(MORE_MENU_LAYER_ID, {
      kind: 'menu',
      element: () => morePopup.current,
      onEsc: () => moreActions.current?.close(),
      dismissOnOutside: true,
    })
  }

  // 卸载兜底：浮层层注册绝不越过组件生命周期。
  useEffect(() => () => { unregisterMore.current?.() }, [])

  return <header className="vnext-project-strip" data-testid="vnext-project-strip">
    <div className="vnext-project-identity">
      <button type="button" className="vnext-brand-lockup" aria-label="打开项目列表" title="项目列表" onClick={onOpenProjectDrive}><Layers3 size={16}/><span>LCOS</span></button>
      {/* 长项目名截断由 CSS（max-width + ellipsis）承担，title 携带完整名保证可看见全名。 */}
      <button type="button" className="vnext-project-name" onClick={onOpenProjectDrive} title="打开项目列表"><strong title={projectLabel}>{projectLabel}</strong><span>{scopeLabel}</span></button>
    </div>
    <div className="vnext-project-state" aria-label="项目状态">
      <span className={`vnext-save-dot state-${saveStatus}`} title={`保存状态：${saveStatusCopy(saveStatus)}`} />
      <span className="vnext-save-copy">{saveStatusCopy(saveStatus)}</span>
      {runStatus && <span className={`vnext-run-dot status-${runStatus}`} title={`Run：${runStatus}`} />}
    </div>
    {receiverSlot}
    <nav className="vnext-project-actions" aria-label="项目操作">
      <button type="button" aria-label="搜索" title="搜索" onClick={onSearch}><Search size={15} /></button>
      {showWorkRailActions && onPending ? <button type="button" className={`vnext-pending-entry ${(pendingCount ?? 0) > 0 ? 'has-items' : ''}`} aria-label={`待确认 ${pendingCount ?? 0} 项`} title={`待确认 · ${pendingCount ?? 0} 项`} onClick={onPending}><Inbox size={15} /><span>{(pendingCount ?? 0) > 0 ? `${pendingCount} 待确认` : '待确认'}</span></button> : null}
      {/* A-3b：⋯ overflow menu——被降级入口收编于此（保留原 onClick）。 */}
      <Menu.Root actionsRef={moreActions} onOpenChange={handleMoreOpenChange}>
        <Menu.Trigger className="vnext-strip-more-trigger" aria-label="更多" title="更多"><MoreHorizontal size={15} /></Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner className="vnext-strip-more-positioner" side="bottom" align="end" sideOffset={6}>
            <Menu.Popup ref={morePopup} className="vnext-strip-more-menu">
              <Menu.Item className="vnext-strip-more-item" onClick={onImport}><Import size={15} /><span>导入</span></Menu.Item>
              <Menu.Item className="vnext-strip-more-item" aria-label="对话记录" onClick={onHistory}><History size={15} /><span>对话记录</span></Menu.Item>
              {onRevealFolder ? <Menu.Item className="vnext-strip-more-item" onClick={onRevealFolder}><FolderOpen size={15} /><span>打开项目目录</span></Menu.Item> : null}
              {onMore ? <>
                <div className="vnext-strip-more-separator" />
                <Menu.Item className="vnext-strip-more-item" onClick={onMore}><Sparkles size={15} /><span>快捷能力</span></Menu.Item>
              </> : null}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </nav>
  </header>
}