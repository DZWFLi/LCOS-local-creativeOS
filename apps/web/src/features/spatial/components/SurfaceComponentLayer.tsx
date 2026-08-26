import { useEffect, useState } from 'react'
import type { SurfaceBounds, SurfaceElement, SurfaceKind } from '../model/surfaceElementTypes'
import { applySurfaceOps, type SurfaceOp } from '../model/surfaceOps'
import { resolveSurfaceComponent } from './surfaceComponentRegistry'
import { SurfaceFrame } from './SurfaceFrame'
import type { SurfaceComponentRenderContext, SurfaceComponentRenderProps } from './surfaceComponentTypes'
import { applySourceChainEdit } from '../model/sourceChainOps'
import { MAIN_CANVAS_GRID_STEP } from '../../canvas/canvasVisualGeometry'

/** 画布组件网格吸附:与主画布同一格点步长,松手落点就近收敛(拖动过程保持连续跟手)。 */
const snapToGrid = (value: number): number => Math.round(value / MAIN_CANVAS_GRID_STEP) * MAIN_CANVAS_GRID_STEP

export function SurfaceComponentLayer({ surface, elements, zoom, renderContext, lensFocusId, selectionIds, onSelectElement, onElementsChange }: {
  readonly surface: SurfaceKind
  readonly elements: readonly SurfaceElement[]
  readonly zoom: number
  readonly renderContext?: SurfaceComponentRenderContext
  /** lens 三键聚焦的组件 id(短暂高亮脉冲反馈,由 ContextSpaceSurface 的 focusLens 设置)。 */
  readonly lensFocusId?: string | null
  /** §4.13.2-G-2 画布多选:外部受控选中集(组件随框选/Shift·Ctrl 点选进多选);不传则退回内部单选(主画布等旧调用方)。 */
  readonly selectionIds?: readonly string[]
  /** 受控模式下的选中变化通知(additive 语义与节点点选一致:Shift/Ctrl 切换、普通点击单选重置)。 */
  readonly onSelectElement?: (id: string, additive: boolean) => void
  readonly onElementsChange: (elements: SurfaceElement[]) => void
}) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null)
  // G-2 受控/非受控双模式:调用方传 selectionIds 即多选受控;否则保持旧的单选行为。
  // 哨兵 const 保证闭包内也能安全窄化(selectionIds 为可选 prop,别名布尔无法跨闭包窄化)。
  const controlledSelection: readonly string[] | null = selectionIds ?? null
  const isSelected = (id: string) => controlledSelection ? controlledSelection.includes(id) : internalSelectedId === id
  const [alignmentGuide, setAlignmentGuide] = useState<{ readonly x?: number; readonly y?: number } | null>(null)
  const [overlapId, setOverlapId] = useState<string | null>(null)
  const visible = elements.filter((element) => element.surface === surface)
  useEffect(() => { if (internalSelectedId && !visible.some((element) => element.id === internalSelectedId)) setInternalSelectedId(null) }, [internalSelectedId, visible])

  const commit = (op: SurfaceOp) => onElementsChange(applySurfaceOps(elements, [op]))
  const commitBounds = (element: SurfaceElement, bounds: SurfaceBounds, kind: 'move' | 'resize') => {
    // 松手格点吸附(仅位置,尺寸保持用户精确值);resize 携带完整落点——west/north 边拖拽会改变原点。
    const x = snapToGrid(bounds.x)
    const y = snapToGrid(bounds.y)
    // G-2 组件整组移动:受控多选下拖动的是选中组件之一时,松手整组按同一位移落位
    // (锚点格点收敛,组员保持相对偏移不重复吸附——与主画布组拖动同款语义)。
    if (kind === 'move' && controlledSelection && controlledSelection.length > 1 && controlledSelection.includes(element.id)) {
      const dx = x - element.bounds.x
      const dy = y - element.bounds.y
      const ops = visible
        .filter((item) => controlledSelection.includes(item.id))
        .map((item) => item.id === element.id
          ? { type: 'move' as const, elementId: item.id, x, y }
          : { type: 'move' as const, elementId: item.id, x: item.bounds.x + dx, y: item.bounds.y + dy })
      onElementsChange(applySurfaceOps(elements, ops))
      return
    }
    commit(kind === 'move'
      ? { type: 'move', elementId: element.id, x, y }
      : { type: 'resize', elementId: element.id, x, y, w: bounds.w, h: bounds.h })
  }
  // B-4：拖拽碰撞提示——拖拽中的组件与其它组件重叠 ≥30% 面积时给虚线视觉提示，不强制阻止放置。
  const OVERLAP_RATIO = 0.3
  const detectOverlap = (elementId: string, bounds: SurfaceBounds) => {
    const area = bounds.w * bounds.h
    if (area <= 0) { setOverlapId(null); return }
    const hit = visible.some((other) => {
      if (other.id === elementId) return false
      const b = other.bounds
      const iw = Math.max(0, Math.min(bounds.x + bounds.w, b.x + b.w) - Math.max(bounds.x, b.x))
      const ih = Math.max(0, Math.min(bounds.y + bounds.h, b.y + b.h) - Math.max(bounds.y, b.y))
      return iw * ih / area >= OVERLAP_RATIO
    }) ? elementId : null
    setOverlapId((current) => current === hit ? current : hit)
  }
  const previewAlignment = (element: SurfaceElement, bounds: SurfaceBounds | null, kind: 'move' | 'resize') => {
    if (!bounds || kind !== 'move') { setAlignmentGuide(null); setOverlapId(null); return }
    detectOverlap(element.id, bounds)
    const threshold = 6 / Math.max(.05, zoom)
    const ownX = [bounds.x, bounds.x + bounds.w / 2, bounds.x + bounds.w]
    const ownY = [bounds.y, bounds.y + bounds.h / 2, bounds.y + bounds.h]
    let bestX: { value: number; distance: number } | null = null
    let bestY: { value: number; distance: number } | null = null
    for (const other of visible) {
      if (other.id === element.id) continue
      for (const value of [other.bounds.x, other.bounds.x + other.bounds.w / 2, other.bounds.x + other.bounds.w]) {
        const distance = Math.min(...ownX.map((candidate) => Math.abs(candidate - value)))
        if (distance <= threshold && (!bestX || distance < bestX.distance)) bestX = { value, distance }
      }
      for (const value of [other.bounds.y, other.bounds.y + other.bounds.h / 2, other.bounds.y + other.bounds.h]) {
        const distance = Math.min(...ownY.map((candidate) => Math.abs(candidate - value)))
        if (distance <= threshold && (!bestY || distance < bestY.distance)) bestY = { value, distance }
      }
    }
    const next = bestX || bestY ? { ...(bestX ? { x: bestX.value } : {}), ...(bestY ? { y: bestY.value } : {}) } : null
    setAlignmentGuide((current) => current?.x === next?.x && current?.y === next?.y ? current : next)
  }

  return <div className="lcos-surface-component-layer" data-surface-component-layer={surface}>
    {alignmentGuide?.x !== undefined && <i className="lcos-alignment-guide axis-x" style={{ left: alignmentGuide.x }}/>} {/* x guide */}
    {alignmentGuide?.y !== undefined && <i className="lcos-alignment-guide axis-y" style={{ top: alignmentGuide.y }}/>} {/* y guide */}
    {visible.map((element) => {
      const definition = resolveSurfaceComponent(element.type)
      const Renderer = definition.renderer
      const editSourceChain = (edit: Parameters<NonNullable<SurfaceComponentRenderProps['onSourceChainEdit']>>[0]) => {
        onElementsChange(applySourceChainEdit(elements, element.id, edit))
      }
      return <SurfaceFrame
        key={element.id}
        element={element}
        definition={definition}
        zoom={zoom}
        selected={isSelected(element.id)}
        overlap={overlapId === element.id}
        lensFocus={lensFocusId === element.id}
        onSelect={(additive) => {
          // G-2:受控模式把选中变化交还调用方(支持 Shift/Ctrl 加选);内部模式维持旧单选。
          if (controlledSelection) onSelectElement?.(element.id, additive)
          else setInternalSelectedId(element.id)
        }}
        onBoundsCommit={(bounds, kind) => commitBounds(element, bounds, kind)}
        onBoundsPreview={(bounds, kind) => previewAlignment(element, bounds, kind)}
        onPresentationChange={(presentation) => onElementsChange(elements.map((item) => item.id === element.id ? { ...item, presentation } : item))}
        onRemove={() => commit({ type: 'remove-projection', elementId: element.id })}
      >
        <Renderer element={element} selected={isSelected(element.id)} context={renderContext} onSourceChainEdit={editSourceChain}/>
      </SurfaceFrame>
    })}
  </div>
}
