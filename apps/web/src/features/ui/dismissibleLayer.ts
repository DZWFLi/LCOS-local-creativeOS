import type { PointerEvent as ReactPointerEvent } from 'react'

/**
 * Shared dismissal contract for non-blocking modal layers.
 * Only the backdrop itself dismisses; pointer activity inside the dialog is ignored.
 */
export function dismissFromBackdrop(
  event: ReactPointerEvent<HTMLElement>,
  onDismiss: () => void,
  disabled = false,
): void {
  if (disabled || event.target !== event.currentTarget) return
  event.preventDefault()
  event.stopPropagation()
  onDismiss()
}
