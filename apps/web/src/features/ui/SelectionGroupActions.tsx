import { useEffect, useId, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Ellipsis } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Menu } from '@base-ui/react/menu'
import type { MenuRootActions } from '@base-ui/react/menu'
import { register as registerOverlay } from './overlayStack'

export interface SelectionGroupAction {
  readonly id: string
  readonly label: string
  readonly hint?: string
  readonly icon?: LucideIcon
  readonly onClick: () => void
  readonly dividerBefore?: boolean
  readonly danger?: boolean
  readonly disabled?: boolean
}

interface Props {
  readonly x: number
  readonly y: number
  readonly count: number
  readonly selectionKey: string
  readonly actions: readonly SelectionGroupAction[]
}

/**
 * Multi-selection action owner.
 *
 * A Selection is a transient spatial session, not a Project object, so group actions
 * deliberately do not reuse ObjectOrbit. The Selection Field exposes one compact
 * screen-space action notch; low-frequency group operations live in a Base UI menu.
 * No Project truth is created by this component.
 */
export function SelectionGroupActions({ x, y, count, selectionKey, actions }: Props) {
  const actionsRef = useRef<MenuRootActions | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)
  const unregisterRef = useRef<(() => void) | null>(null)
  const overlayId = useId()

  const handleOpenChange = (open: boolean) => {
    unregisterRef.current?.()
    unregisterRef.current = null
    if (!open) return
    unregisterRef.current = registerOverlay(overlayId, {
      kind: 'menu',
      element: () => popupRef.current,
      onEsc: () => actionsRef.current?.close(),
      dismissOnOutside: true,
    })
  }

  useEffect(() => {
    // Any Selection membership change starts a new transient session, even when the
    // count stays identical. Never leave the previous group's menu alive.
    actionsRef.current?.close()
  }, [selectionKey])

  useEffect(() => () => { unregisterRef.current?.() }, [])

  if (count < 2 || actions.length === 0) return null

  const quickIds = new Set(['selection-focus', 'selection-reorganize', 'selection-colony'])
  const quickActions = actions.filter((action) => quickIds.has(action.id))
  const layoutActions = actions.filter((action) => action.id.startsWith('selection-align-') || action.id.startsWith('selection-distribute-'))
  const managementActions = actions.filter((action) => !quickIds.has(action.id) && !action.id.startsWith('selection-align-') && !action.id.startsWith('selection-distribute-'))

  const renderItem = (action: SelectionGroupAction, compact = false) => {
    const Icon = action.icon
    return <Menu.Item
      key={action.id}
      className={`${compact ? 'is-compact ' : ''}${action.dividerBefore && !compact ? 'with-divider ' : ''}${action.danger ? 'danger' : ''}`.trim() || undefined}
      disabled={action.disabled}
      data-selection-group-action={action.id}
      onClick={action.onClick}
    >
      {Icon ? <Icon size={compact ? 13 : 14} aria-hidden="true" /> : <span className="lcos-selection-group-menu-dot" aria-hidden="true" />}
      <span><strong>{action.label}</strong>{!compact && action.hint ? <small>{action.hint}</small> : null}</span>
    </Menu.Item>
  }

  const triggerStyle = { left: x, top: y } as CSSProperties
  return <div
    className="lcos-selection-group-actions"
    data-testid="selection-group-actions"
    style={triggerStyle}
    onPointerDown={(event) => event.stopPropagation()}
    onContextMenu={(event) => event.preventDefault()}
  >
    <Menu.Root actionsRef={actionsRef} onOpenChange={handleOpenChange}>
      <Menu.Trigger
        className="lcos-selection-group-trigger"
        data-testid="selection-group-actions-trigger"
        aria-label={`${count} 项选择的操作`}
        title={`${count} 项选择 · 操作`}
      >
        <Ellipsis size={16} aria-hidden="true" />
        <small>{count}</small>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="lcos-selection-group-positioner" side="bottom" align="start" sideOffset={7}>
          <Menu.Popup
            ref={popupRef}
            className="lcos-selection-group-menu"
            data-testid="selection-group-menu"
            aria-label={`${count} 项选择的操作`}
          >
            <header><strong>{count} 项选择</strong><small>当前 Selection</small></header>
            {quickActions.length > 0 && <div className="lcos-selection-group-quick" aria-label="Selection 快捷动作">{quickActions.map((action) => renderItem(action, true))}</div>}
            {layoutActions.length > 0 && <section className="lcos-selection-layout-section" aria-label="Selection 对齐与分布"><small>对齐与分布</small><div className="lcos-selection-layout-grid">{layoutActions.map((action) => renderItem(action, true))}</div></section>}
            {managementActions.length > 0 && <div className="lcos-selection-management-list">{managementActions.map((action) => renderItem(action))}</div>}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </div>
}
