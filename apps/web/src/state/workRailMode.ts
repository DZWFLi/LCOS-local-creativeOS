import type { ActiveRun, CanvasNode } from '../model'

export type WorkRailMode =
  | 'workspace'
  | 'selection'
  | 'multi-selection'
  | 'run'
  | 'waiting-input'
  | 'review'
  | 'completed'

interface DeriveWorkRailModeInput {
  activeRun: ActiveRun | null
  selectedNodes: CanvasNode[]
  focusNode: CanvasNode | null
  pendingNode: CanvasNode | null
}

/**
 * The rail follows the most urgent human task first, then the current selection.
 * Internal routes such as relations/context stay secondary and never become the
 * golden path for running a task.
 */
export function deriveWorkRailMode({
  activeRun,
  selectedNodes,
  focusNode,
  pendingNode,
}: DeriveWorkRailModeInput): WorkRailMode {
  if (activeRun?.status === 'waiting_input') return 'waiting-input'
  if (activeRun?.status === 'review' && pendingNode) return 'review'
  if (activeRun && ['queued', 'running', 'failed'].includes(activeRun.status)) return 'run'
  if (selectedNodes.length > 1) return 'multi-selection'
  if (focusNode || selectedNodes.length === 1) return 'selection'
  if (activeRun?.status === 'completed') return 'completed'
  return 'workspace'
}

export function isRunBusy(activeRun: ActiveRun | null): boolean {
  return Boolean(activeRun && ['queued', 'running', 'waiting_input'].includes(activeRun.status))
}
