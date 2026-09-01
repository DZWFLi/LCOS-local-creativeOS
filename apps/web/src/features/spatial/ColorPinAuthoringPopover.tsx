import { useEffect, useId, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import type { SpatialMarkerTargetRefV0 } from '@local-creative-os/contracts'
import { X } from 'lucide-react'
import { collectSpatialOverlayOccupiedRects } from '../ui/spatialOverlayEnvironment'
import { resolveSpatialOverlayPlacement, spatialOverlayRectFromDomRect } from '../ui/spatialOverlayPlacement'
import { register as registerOverlay } from '../ui/overlayStack'
import { colorPinRecordsForTarget, useProjectColorPinRuntime } from './ProjectColorPinContext'

export const COLOR_PIN_AUTHORING_PRESETS = ['#5A8CFF', '#43B581', '#E4A63A', '#E96A5F', '#9B74D6', '#35AFC7'] as const

interface Props {
  readonly open: boolean
  readonly targetRef: SpatialMarkerTargetRefV0
  readonly anchorRef: RefObject<Element | null>
  readonly onClose: () => void
}

/** Compact authoring layer. Exact palette/material polish remains Phase D. */
export function ColorPinAuthoringPopover({ open, targetRef, anchorRef, onClose }: Props) {
  const runtime = useProjectColorPinRuntime()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const overlayId = useId()
  const records = useMemo(() => runtime ? colorPinRecordsForTarget(runtime.records, targetRef) : [], [runtime, targetRef.id, targetRef.kind])
  const activeIds = new Set(records.map((record) => record.definition.id))
  const existingDefinitions = runtime?.snapshot.definitions ?? []
  const candidateDefinitions = existingDefinitions.filter((definition) => !activeIds.has(definition.id))
  const activeColors = new Set(existingDefinitions.map((definition) => definition.color.toUpperCase()))
  const newColors = COLOR_PIN_AUTHORING_PRESETS.filter((color) => !activeColors.has(color.toUpperCase()))

  useEffect(() => {
    if (!open) return undefined
    return registerOverlay(overlayId, {
      kind: 'popover',
      element: () => rootRef.current,
      onEsc: onClose,
      dismissOnOutside: true,
    })
  }, [onClose, open, overlayId])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target && rootRef.current?.contains(target)) return
      if (target && anchorRef.current?.contains(target)) return
      onClose()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [anchorRef, onClose, open])

  if (!open || !runtime || typeof document === 'undefined' || !anchorRef.current) return null
  const targetBounds = spatialOverlayRectFromDomRect(anchorRef.current.getBoundingClientRect())
  const viewport = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
  const placement = resolveSpatialOverlayPlacement({
    targetBounds,
    overlaySize: { width: 220, height: records.length > 0 ? 150 : 116 },
    viewport,
    occupiedRects: collectSpatialOverlayOccupiedRects(viewport, rootRef.current),
    preferredSide: 'right',
    gap: 12,
  })

  const remove = async (membershipId: string) => { await runtime.removeMembership(membershipId) }
  const assignExisting = async (colorPinId: string) => { await runtime.assign({ targetRef, colorPinId }) }
  const assignNew = async (color: string) => { await runtime.assign({ targetRef, color }) }

  return createPortal(<div
    ref={rootRef}
    className="lcos-color-pin-authoring-popover"
    data-testid="color-pin-authoring-popover"
    style={{ left: placement.left, top: placement.top }}
    role="dialog"
    aria-label="Color Pin"
  >
    <header><strong>Pin</strong><button type="button" onClick={onClose} aria-label="关闭 Color Pin"><X size={13}/></button></header>
    {records.length > 0 ? <div className="lcos-color-pin-authoring-row" aria-label="已标记颜色">
      {records.map((record) => <button
        key={record.membership.id}
        type="button"
        className="lcos-color-pin-swatch is-active"
        style={{ '--lcos-color-pin-tone': record.definition.color } as React.CSSProperties}
        title={`移除 ${record.definition.label?.trim() || record.definition.color}`}
        aria-label={`移除 ${record.definition.label?.trim() || record.definition.color}`}
        onClick={() => { void remove(record.membership.id) }}
      />)}
    </div> : null}
    {candidateDefinitions.length > 0 ? <div className="lcos-color-pin-authoring-section">
      <small>项目已有</small>
      <div className="lcos-color-pin-authoring-row">
        {candidateDefinitions.slice(0, 8).map((definition) => <button
          key={definition.id}
          type="button"
          className="lcos-color-pin-swatch"
          style={{ '--lcos-color-pin-tone': definition.color } as React.CSSProperties}
          title={definition.label?.trim() || definition.color}
          aria-label={`添加 ${definition.label?.trim() || definition.color}`}
          onClick={() => { void assignExisting(definition.id) }}
        />)}
      </div>
    </div> : null}
    <div className="lcos-color-pin-authoring-section">
      <small>新颜色</small>
      <div className="lcos-color-pin-authoring-row">
        {newColors.slice(0, 6).map((color) => <button
          key={color}
          type="button"
          className="lcos-color-pin-swatch"
          style={{ '--lcos-color-pin-tone': color } as React.CSSProperties}
          title={`添加 ${color}`}
          aria-label={`添加 ${color}`}
          onClick={() => { void assignNew(color) }}
        />)}
      </div>
    </div>
  </div>, document.body)
}
