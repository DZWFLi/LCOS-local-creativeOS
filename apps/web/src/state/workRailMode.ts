import type { ActiveRun, CanvasNode } from '../model'

export type WorkRailMode =
  | 'workspace'
  | 'run'
  | 'waiting-input'
  | 'review'
  | 'completed'

interface DeriveWorkRailModeInput {
  activeRun: ActiveRun | null
  pendingNode: CanvasNode | null
}

/**
 * The rail follows execution state only. Ordinary node selection stays on the
 * Canvas through the local toolbar and node information popover.
 */
export function deriveWorkRailMode({ activeRun, pendingNode }: DeriveWorkRailModeInput): WorkRailMode {
  if (activeRun?.status === 'waiting_input') return 'waiting-input'
  if (activeRun?.status === 'review' && pendingNode) return 'review'
  if (activeRun && ['queued', 'running', 'failed', 'cancelled'].includes(activeRun.status)) return 'run'
  if (activeRun?.status === 'completed') return 'completed'
  return 'workspace'
}

export function isRunBusy(activeRun: ActiveRun | null): boolean {
  return Boolean(activeRun && ['queued', 'running', 'waiting_input'].includes(activeRun.status))
}
