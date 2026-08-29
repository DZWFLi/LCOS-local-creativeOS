/**
 * R2-D pointer grammar. These helpers are deliberately Presentation-only:
 * they classify input intent but never mutate Selection/Relation/Mapping truth.
 */
export type LcosPointerState =
  | 'normal'
  | 'selection'
  | 'reference-pick'
  | 'relation-drag'
  | 'semantic-drop'
  | 'pan-open-hand'
  | 'pan-closed-hand'
  | 'resize'
  | 'zoom-navigation'

export interface PointerModifierInput {
  readonly shiftKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
}

/** Multi-selection is Shift-only. Ctrl/Cmd is reserved for this-run Reference. */
export function additiveSelectionModifier(input: PointerModifierInput): boolean {
  return input.shiftKey
}

/** Ctrl/Cmd means this-run Reference; Shift wins as explicit multi-selection. */
export function referencePickModifier(input: PointerModifierInput): boolean {
  return !input.shiftKey && (input.ctrlKey || input.metaKey)
}

const CONVERSATION_GLYTH_DROP_PREFIX = 'conversation-glyth:'

export function conversationGlythDropTarget(conversationSessionId: string): string {
  return `${CONVERSATION_GLYTH_DROP_PREFIX}${encodeURIComponent(conversationSessionId)}`
}

export function conversationSessionFromDropTarget(targetId: string): string | null {
  if (!targetId.startsWith(CONVERSATION_GLYTH_DROP_PREFIX)) return null
  const encoded = targetId.slice(CONVERSATION_GLYTH_DROP_PREFIX.length)
  if (!encoded) return null
  try { return decodeURIComponent(encoded) } catch { return null }
}
