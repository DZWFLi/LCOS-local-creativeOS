/**
 * Note presentation memory — session-local presentation overrides for text nodes.
 *
 * noteLayout / noteTags / noteOutline are presentation-only (the body itself
 * remains the text artifact content). Core's PresentationStateV0 does not yet
 * carry them, so they live in this module-level memory keyed by view id and
 * are merged back into runtime note projections. Session-scoped by design;
 * graduating into the durable Presentation contract is tracked as known debt
 * for the next Core schema round.
 */

export interface NotePresentation {
  readonly noteLayout?: 'text' | 'mindmap'
  readonly noteTags?: readonly string[]
  readonly noteOutline?: string
  /** Mindmap auto-sync flag: agent refreshes the outline when the scene changes. */
  readonly noteAutoSync?: boolean
}

const memory = new Map<string, NotePresentation>()

export function rememberNotePresentation(viewId: string, patch: NotePresentation): void {
  const current = memory.get(viewId) ?? {}
  memory.set(viewId, { ...current, ...patch })
}

export function recallNotePresentation(viewId: string): NotePresentation {
  return memory.get(viewId) ?? {}
}

export function forgetNotePresentation(viewId: string): void {
  memory.delete(viewId)
}
