import { Bot, FilePlus2, FolderInput, Layers3, LayoutGrid, Network, Sparkles, SquarePlus } from 'lucide-react'
import type { ComponentType } from 'react'

export type SurfaceContextMenuAction =
  | 'create-content'
  | 'import'
  | 'create-scene'
  | 'reorganize'
  | 'summon-agent'
  | 'review-deposits'
  | 'create-context'
  | 'create-workflow'

export interface SurfaceContextMenuItem {
  readonly action: SurfaceContextMenuAction
  readonly label: string
  readonly hint?: string
  readonly disabled?: boolean
  readonly dividerBefore?: boolean
}

const ICONS: Record<SurfaceContextMenuAction, ComponentType<{ size?: number }>> = {
  'create-content': FilePlus2,
  import: FolderInput,
  'create-scene': SquarePlus,
  reorganize: LayoutGrid,
  'summon-agent': Bot,
  'review-deposits': Sparkles,
  'create-context': Layers3,
  'create-workflow': Network,
}

export function SurfaceContextMenu({ x, y, title, items, onAction, onClose }: {
  readonly x: number
  readonly y: number
  readonly title: string
  readonly items: readonly SurfaceContextMenuItem[]
  readonly onAction: (action: SurfaceContextMenuAction) => void
  readonly onClose: () => void
}) {
  // host 的 onPointerDown 会关闭菜单；必须阻止 pointerdown 冒泡，否则点击永远落在
  // 已卸载的按钮上（S2「从选择沉淀上下文」静默失败的根因）。
  return <div className="lcos-surface-context-menu" role="menu" aria-label={`${title}空白处操作`} style={{ left: x, top: y }} data-native-context-menu="true" onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
    <header><span>{title}</span><small>空白处</small></header>
    {items.map((item) => {
      const Icon = ICONS[item.action]
      return <button key={item.action} type="button" className={item.dividerBefore ? 'with-divider' : undefined} disabled={item.disabled} onClick={() => { onAction(item.action); onClose() }}>
        <Icon size={14}/><span><strong>{item.label}</strong>{item.hint ? <small>{item.hint}</small> : null}</span>
      </button>
    })}
  </div>
}
