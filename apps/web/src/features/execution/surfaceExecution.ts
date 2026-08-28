import type { ComposerResultPolicy } from '../canvas/SelectionComposer'

export interface SurfaceExecutionSubmission {
  readonly prompt: string
  readonly surface: 'context' | 'workflow' | 'conversation'
  readonly receiverId: string
  readonly referenceIds: readonly string[]
  readonly provider: string
  readonly intent: 'analyze' | 'create' | 'revise'
  readonly resultPolicy: ComposerResultPolicy
  readonly resultSlotId?: string
}

export interface SurfaceExecutionSubmissionResult {
  readonly runId?: string
}
