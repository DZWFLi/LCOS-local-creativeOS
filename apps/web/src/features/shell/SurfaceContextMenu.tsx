import { Bot, CopyPlus, Crosshair, Eye, FilePlus2, FolderInput, Layers3, LayoutGrid, MapPin, Network, Paperclip, Sparkles, SquarePlus, Trash2 } from 'lucide-react'
import type { ComponentType } from 'react'
import { useEffect, useId, useRef } from 'react'
import { register as registerOverlay } from '../ui/overlayStack'

export type SurfaceContextMenuAction =
  | 'create-content'
  | 'import'
  | 'create-scene'
  | 'reorganize'
  | 'summon-agent'
  | 'review-deposits'
  | 'create-context'
  | 'create-workflow'
  | 'open'
  | 'focus'
  | 'pin'
  | 'unpin'
  | 'add-reference'
  | 'remove-reference'
  | 'duplicate-view'
  | 'remove-projection'

export interface SurfaceContextMenuItem {
  readonly action: SurfaceContextMenuAction
  readonly label: string
  readonly hint?: string
  readonly disabled?: boolean
  readonly dividerBefore?: boolean
  readonly danger?: boolean
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
  open: Eye,
  focus: Crosshair,
  pin: MapPin,
  unpin: MapPin,
  'add-reference': Paperclip,
  'remove-reference': Paperclip,
  'duplicate-view': CopyPlus,
  'remove-projection': Trash2,
}

export function SurfaceContextMenu({ x, y, title, contextLabel = '空白处', items, onAction, onClose }: {
  readonly x: number
  readonly y: number
  readonly title: string
  readonly contextLabel?: string
  readonly items: readonly SurfaceContextMenuItem[]
  readonly onAction: (action: SurfaceContextMenuAction) => void
  readonly onClose: () => void
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const overlayId = useId()

  useEffect(() => registerOverlay(overlayId, {
    kind: 'menu',
    element: () => rootRef.current,
    onEsc: onClose,
    dismissOnOutside: true,
  }), [onClose, overlayId])

  // host 的 onPointerDown 会关闭菜单；必须阻止 pointerdown 冒泡，否则点击永远落在
  // 已卸载的按钮上（S2「从选择沉淀上下文」静默失败的根因）。
  return <div ref={rootRef} className="lcos-surface-context-menu" role="menu" aria-label={`${title}${contextLabel}操作`} style={{ left: x, top: y }} data-native-context-menu="true" data-context-menu-scope={contextLabel} onPointerDown={(event) => event.stopPropagation()} onContextMenu={(event) => event.preventDefault()}>
    <header><span>{title}</span><small>{contextLabel}</small></header>
    {items.map((item) => {
      const Icon = ICONS[item.action]
      const className = [item.dividerBefore ? 'with-divider' : '', item.danger ? 'danger' : ''].filter(Boolean).join(' ') || undefined
      return <button key={item.action} type="button" className={className} disabled={item.disabled} data-context-menu-action={item.action} onClick={() => { onAction(item.action); onClose() }}>
        <Icon size={14}/><span><strong>{item.label}</strong>{item.hint ? <small>{item.hint}</small> : null}</span>
      </button>
    })}
  </div>
}
