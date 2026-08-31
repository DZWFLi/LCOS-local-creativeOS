export type DialogOwnerTier = 'editor' | 'surface' | 'child' | 'blocking'

export const DIALOG_OWNER_PRIORITY: Readonly<Record<DialogOwnerTier, number>> = {
  editor: 10,
  surface: 20,
  child: 30,
  blocking: 40,
}

export interface DialogOwnerCandidate {
  readonly id: string
  readonly tier: DialogOwnerTier
  readonly open: boolean
}

/**
 * Pick exactly one dominant dialog/modal owner.
 *
 * Lower layers stay in application state; they are simply not rendered while a
 * more specific child/blocking layer owns the transient interaction. When the
 * top owner closes, the previous layer can resume without duplicating state.
 * Ties are resolved by candidate order, so callers can express local causality
 * without inventing a second global overlay store.
 */
export function dominantDialogOwner(candidates: readonly DialogOwnerCandidate[]): string | null {
  let winner: DialogOwnerCandidate | null = null
  let winnerPriority = -1
  for (const candidate of candidates) {
    if (!candidate.open) continue
    const priority = DIALOG_OWNER_PRIORITY[candidate.tier]
    if (priority < winnerPriority) continue
    winner = candidate
    winnerPriority = priority
  }
  return winner?.id ?? null
}
