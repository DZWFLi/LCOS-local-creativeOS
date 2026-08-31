import type { PointerEvent as ReactPointerEvent } from 'react'
import { DROP_PHASE_NEAR_PX, advanceDropPhase } from '../drop/dropPhases'
import type { DropPhase, DropProximityInput } from '../drop/dropPhases'

export const NEW_SCENE_DROP_TARGET_ID = 'workspace:new-scene'
export const ARRANGE_SURFACE_DROP_TARGET_ID = 'surface:arrange'
export const CONTEXT_GRAPH_SURFACE_DROP_TARGET_ID = 'surface:context-graph'
export const CONTEXT_SURFACE_DROP_TARGET_ID = 'surface:context'
export const WORKFLOW_GRAPH_SURFACE_DROP_TARGET_ID = 'surface:workflow-graph'
export const WORKFLOW_SURFACE_DROP_TARGET_ID = 'surface:workflow'

export type SemanticDropTrigger = 'secondary-pointer' | 'modifier-primary' | 'handle-primary' | 'direct-primary'

export interface DropTargetHit {
  id: string
  label: string
  element: HTMLElement
}

function eventTargetElement<T extends HTMLElement>(event: ReactPointerEvent<T>): Element | null {
  return event.target instanceof Element ? event.target : null
}

/**
 * Semantic Drop is the interaction; right-drag is only its fastest trigger.
 *
 * Supported triggers:
 * - secondary mouse button drag (default / fastest)
 * - Alt/Option + primary drag (browser/trackpad fallback)
 * - primary drag from an element marked with `data-semantic-drop-handle`
 */
export function semanticDropTriggerFromPointer<T extends HTMLElement>(event: ReactPointerEvent<T>): SemanticDropTrigger | null {
  if (event.button === 2) return 'secondary-pointer'
  if (event.button !== 0) return null
  if (eventTargetElement(event)?.closest('[data-semantic-drop-handle]')) return 'handle-primary'
  if (event.altKey) return 'modifier-primary'
  return null
}

export function isSemanticDropPointer<T extends HTMLElement>(event: ReactPointerEvent<T>): boolean {
  return semanticDropTriggerFromPointer(event) !== null
}

function targetAt(clientX: number, clientY: number): DropTargetHit | null {
  const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-project-view-drop-target]') ?? null
  const id = element?.dataset.projectViewDropTarget
  if (!element || !id) return null
  return { id, label: element.dataset.projectViewDropLabel ?? '目标空间', element }
}

function expectedButtonsMask(trigger: SemanticDropTrigger): number {
  return trigger === 'secondary-pointer' ? 2 : 1
}

/**
 * Approaching 判定：指针是否进入任一合法 drop target 包围盒外扩 DROP_PHASE_NEAR_PX 内。
 * 只服务反馈相位（tldraw hint 协议：进行中每帧重算），不改命中判定本体 targetAt。
 */
function nearDropTarget(clientX: number, clientY: number): boolean {
  const targets = document.querySelectorAll<HTMLElement>('[data-project-view-drop-target]')
  for (const target of targets) {
    const rect = target.getBoundingClientRect()
    if (rect.width <= 0 && rect.height <= 0) continue
    const nearestX = Math.max(rect.left, Math.min(clientX, rect.right))
    const nearestY = Math.max(rect.top, Math.min(clientY, rect.bottom))
    if (Math.hypot(clientX - nearestX, clientY - nearestY) <= DROP_PHASE_NEAR_PX) return true
  }
  return false
}

/**
 * Shared transient Semantic Drop for non-main-canvas renderers.
 *
 * Source objects never move. The gesture only projects the same Project Entity
 * into another Surface/Entity target. Trigger detection is deliberately kept
 * here so callers do not hard-code "right click = semantic operation".
 *
 * onPhase 是 Wave D-2 最小钩子：告诉调用者当前五阶段（走近/接收/接受/提交/稳定），
 * 用于驱动 dropPhases 反馈层。不改变既有拖拽/命中/意图链行为。
 */
export function beginSemanticDrop<T extends HTMLElement>(
  event: ReactPointerEvent<T>,
  sourceIds: readonly string[],
  onDrop?: (targetViewId: string, sourceIds: readonly string[]) => void,
  onPhase?: (phase: DropPhase, hit: DropTargetHit | null) => void,
): boolean {
  const explicitTrigger = semanticDropTriggerFromPointer(event)
  const trigger: SemanticDropTrigger | null = explicitTrigger ?? (event.button === 0 ? 'direct-primary' : null)
  if (!trigger || !onDrop || sourceIds.length === 0) return false

  const directPrimary = trigger === 'direct-primary'
  if (!directPrimary) {
    if (trigger !== 'secondary-pointer') event.preventDefault()
    event.stopPropagation()
  }

  const pointerId = event.pointerId
  const sourceElement = event.currentTarget
  const startX = event.clientX
  const startY = event.clientY
  const buttonMask = expectedButtonsMask(trigger)
  const sourceSurface = sourceElement.closest<HTMLElement>('[data-spatial-canvas="true"]')
  let moved = false
  let hovered: HTMLElement | null = null
  let ghost: HTMLDivElement | null = null
  let phase: DropPhase = 'idle'
  const emitPhase = (next: DropPhase, hit: DropTargetHit | null): void => {
    if (next === phase) return
    phase = next
    onPhase?.(next, hit)
  }

  if (!directPrimary && trigger !== 'secondary-pointer') {
    try { sourceElement.setPointerCapture(pointerId) } catch { /* browser may own capture */ }
    sourceElement.classList.add('is-semantic-drop-source')
    sourceElement.dataset.semanticDropTrigger = trigger
  }

  const guardMenu = (menuEvent: Event) => menuEvent.preventDefault()
  let menuGuardInstalled = false
  let menuGuardCleanupTimer: number | null = null
  const installMenuGuard = () => {
    if (trigger !== 'secondary-pointer' || menuGuardInstalled) return
    menuGuardInstalled = true
    window.addEventListener('contextmenu', guardMenu, true)
  }

  const clearHover = () => {
    hovered?.classList.remove('is-direct-drop-target')
    hovered = null
  }
  const ensureGhost = () => {
    if (ghost) return ghost
    ghost = document.createElement('div')
    ghost.className = 'lcos-drop-ghost lcos-projection-drop-ghost lcos-semantic-drop-ghost'
    ghost.dataset.semanticDropTrigger = trigger
    ghost.setAttribute('aria-hidden', 'true')
    ghost.innerHTML = `<span>⇢</span><strong>${sourceIds.length}</strong><small>Semantic Drop</small>`
    document.body.appendChild(ghost)
    return ghost
  }
  const updateHover = (hit: DropTargetHit | null) => {
    if (!hit) { clearHover(); return }
    if (hovered !== hit.element) {
      clearHover()
      hit.element.classList.add('is-direct-drop-target')
      hovered = hit.element
    }
    if (ghost) {
      const label = ghost.querySelector('small')
      if (label) label.textContent = `加入 ${hit.label}`
    }
  }
  const cleanup = () => {
    clearHover()
    ghost?.remove()
    ghost = null
    sourceElement.classList.remove('is-semantic-drop-source')
    delete sourceElement.dataset.semanticDropTrigger
    try { if (sourceElement.hasPointerCapture(pointerId)) sourceElement.releasePointerCapture(pointerId) } catch { /* already released */ }
    window.removeEventListener('pointermove', move, true)
    window.removeEventListener('pointerup', finish, true)
    window.removeEventListener('pointercancel', cancel, true)
    window.removeEventListener('keydown', cancelWithEscape, true)
    if (menuGuardInstalled) {
      // Chrome/Edge may dispatch contextmenu after pointerup. Keep the drag-only guard alive
      // briefly so right-drag never falls through into the management menu.
      if (menuGuardCleanupTimer !== null) window.clearTimeout(menuGuardCleanupTimer)
      menuGuardCleanupTimer = window.setTimeout(() => {
        window.removeEventListener('contextmenu', guardMenu, true)
        menuGuardInstalled = false
        menuGuardCleanupTimer = null
      }, 300)
    }
  }
  const move = (pointerEvent: PointerEvent) => {
    if (pointerEvent.pointerId !== pointerId) return
    // If the browser/OS steals the pressed button, cancel instead of committing
    // a stale Semantic Drop. This is especially important for Edge mouse gestures.
    if (pointerEvent.pointerType === 'mouse' && (pointerEvent.buttons & buttonMask) === 0) {
      emitPhase('idle', null)
      cleanup()
      return
    }
    if (!moved && Math.hypot(pointerEvent.clientX - startX, pointerEvent.clientY - startY) > 4) {
      moved = true
      if (trigger === 'secondary-pointer') {
        try { sourceElement.setPointerCapture(pointerId) } catch { /* browser may own capture */ }
        sourceElement.classList.add('is-semantic-drop-source')
        sourceElement.dataset.semanticDropTrigger = trigger
      }
      installMenuGuard()
    }
    if (!moved) return
    const rawHit = targetAt(pointerEvent.clientX, pointerEvent.clientY)
    const hit = rawHit && rawHit.element !== sourceSurface ? rawHit : null
    if (directPrimary && !hit) {
      emitPhase('idle', null)
      clearHover()
      ghost?.remove()
      ghost = null
      return
    }
    pointerEvent.preventDefault()
    if (directPrimary) {
      sourceElement.classList.add('is-semantic-drop-source')
      sourceElement.dataset.semanticDropTrigger = trigger
    }
    const nextGhost = ensureGhost()
    nextGhost.style.left = `${pointerEvent.clientX}px`
    nextGhost.style.top = `${pointerEvent.clientY}px`
    updateHover(hit)
    const proximity: DropProximityInput = {
      hitTarget: hit !== null,
      nearLegalTarget: hit !== null ? false : nearDropTarget(pointerEvent.clientX, pointerEvent.clientY),
    }
    emitPhase(advanceDropPhase(phase, proximity, false), hit)
  }
  const finish = (pointerEvent: PointerEvent) => {
    if (pointerEvent.pointerId !== pointerId) return
    const rawHit = moved ? targetAt(pointerEvent.clientX, pointerEvent.clientY) : null
    const hit = rawHit && rawHit.element !== sourceSurface ? rawHit : null
    if (hit && directPrimary) pointerEvent.preventDefault()
    cleanup()
    if (hit) {
      emitPhase('accept', hit)
      onDrop(hit.id, sourceIds)
    } else {
      emitPhase('idle', null)
    }
  }
  const cancel = (pointerEvent: PointerEvent) => {
    if (pointerEvent.pointerId !== pointerId) return
    emitPhase('idle', null)
    cleanup()
  }
  const cancelWithEscape = (keyboardEvent: KeyboardEvent) => {
    if (keyboardEvent.key !== 'Escape') return
    keyboardEvent.preventDefault()
    emitPhase('idle', null)
    cleanup()
  }

  window.addEventListener('pointermove', move, true)
  window.addEventListener('pointerup', finish, true)
  window.addEventListener('pointercancel', cancel, true)
  window.addEventListener('keydown', cancelWithEscape, true)
  return !directPrimary
}
