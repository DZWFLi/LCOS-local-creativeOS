import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, X } from 'lucide-react'
import type { ProjectColorPinGroup } from './projectColorPinIndex'
import { useActiveSpatialViewport } from './ActiveSpatialViewportContext'
import { register as registerOverlay } from '../ui/overlayStack'

interface Props {
  readonly group: ProjectColorPinGroup | null
  readonly onClose: () => void
  readonly memberLabel: (viewId: string) => string
  readonly onActivateMember: (viewId: string) => void
}

export function ColorPinMembersPopover({ group, onClose, memberLabel, onActivateMember }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const overlayId = useId()
  const viewport = useActiveSpatialViewport()

  useEffect(() => {
    if (!group) return undefined
    return registerOverlay(overlayId, { kind: 'popover', element: () => rootRef.current, onEsc: onClose, dismissOnOutside: true })
  }, [group, onClose, overlayId])

  useEffect(() => {
    if (!group) return undefined
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && rootRef.current?.contains(target)) return
      if ((event.target as Element | null)?.closest?.('[data-spatial-index-owner="color-pin"]')) return
      onClose()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [group, onClose])

  if (!group || typeof document === 'undefined') return null
  const anchor = viewport?.topCenterAnchor ?? { x: window.innerWidth / 2, y: 20 }
  return createPortal(<div
    ref={rootRef}
    className="lcos-color-pin-members-popover"
    data-testid="color-pin-members-popover"
    style={{ left: anchor.x, top: anchor.y + 54, '--lcos-color-pin-tone': group.color } as React.CSSProperties}
    role="dialog"
    aria-label={`${group.label?.trim() || group.color} 成员`}
  >
    <header><span className="lcos-color-pin-members-tone"/><strong>{group.label?.trim() || 'Color Pin'}</strong><small>{group.records.length}</small><button type="button" onClick={onClose} aria-label="关闭成员列表"><X size={13}/></button></header>
    <div className="lcos-color-pin-members-list">
      {group.records.slice(0, 12).map((record) => {
        const viewId = record.membership.targetRef.kind === 'view' ? record.membership.targetRef.id : null
        const label = viewId ? memberLabel(viewId) : record.membership.targetRef.id
        return <button key={record.membership.id} type="button" disabled={!viewId} onClick={() => { if (viewId) onActivateMember(viewId) }}>
          <MapPin size={12}/><span>{label}</span>
        </button>
      })}
    </div>
  </div>, document.body)
}
