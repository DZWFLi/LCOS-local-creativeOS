export const CANVAS_IDLE_HINT_MS = 30 * 60 * 1_000
export const CONTEXT_HINT_COOLDOWN_MS = 20 * 60 * 1_000
export const WORKFLOW_HINT_COOLDOWN_MS = 4 * 60 * 60 * 1_000

export type BoundaryHintKind = 'context' | 'workflow'

export interface BoundaryHintMemory {
  readonly lastContextHintAt?: number
  readonly lastContextEvidenceKey?: string
  readonly lastWorkflowHintAt?: number
  readonly lastWorkflowEvidenceKey?: string
}

function storageKey(projectId: string) {
  return `lcos:boundary-hints:${projectId}`
}

export function loadBoundaryHintMemory(projectId: string): BoundaryHintMemory {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(storageKey(projectId))
    if (!raw) return {}
    const value = JSON.parse(raw) as BoundaryHintMemory
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

export function saveBoundaryHintMemory(projectId: string, memory: BoundaryHintMemory): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(memory))
  } catch {
    // Boundary hints are presentation-only. Storage failure must not affect work.
  }
}

export function shouldShowDepositHint(args: {
  readonly kind: BoundaryHintKind
  readonly now: number
  readonly evidenceKey: string
  readonly memory: BoundaryHintMemory
  readonly sessionStartedAt?: number
}): boolean {
  if (!args.evidenceKey) return false
  const isContext = args.kind === 'context'
  const lastAt = isContext ? args.memory.lastContextHintAt : args.memory.lastWorkflowHintAt
  const lastKey = isContext ? args.memory.lastContextEvidenceKey : args.memory.lastWorkflowEvidenceKey
  const cooldown = isContext ? CONTEXT_HINT_COOLDOWN_MS : WORKFLOW_HINT_COOLDOWN_MS
  if (lastAt === undefined) {
    if (args.sessionStartedAt === undefined) return false
    return args.now - args.sessionStartedAt >= cooldown
  }
  if (args.evidenceKey === lastKey) return false
  return args.now - lastAt >= cooldown
}

export function recordDepositHint(args: {
  readonly kind: BoundaryHintKind
  readonly now: number
  readonly evidenceKey: string
  readonly memory: BoundaryHintMemory
}): BoundaryHintMemory {
  return args.kind === 'context'
    ? { ...args.memory, lastContextHintAt: args.now, lastContextEvidenceKey: args.evidenceKey }
    : { ...args.memory, lastWorkflowHintAt: args.now, lastWorkflowEvidenceKey: args.evidenceKey }
}
