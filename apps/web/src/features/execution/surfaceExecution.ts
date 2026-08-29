import type { ComposerResultPolicy } from '../canvas/SelectionComposer'
import type { CanvasNode } from '../../model'

export interface SharedComposerCommandState {
  readonly nodes: readonly CanvasNode[]
  readonly selectionIds: readonly string[]
  readonly referenceIds: readonly string[]
  readonly receiverId: string | null
  readonly prompt: string
  readonly provider: string
  readonly intent: 'analyze' | 'create' | 'revise'
  readonly resultPolicy: ComposerResultPolicy
  readonly referencePickActive: boolean
  readonly onPromptChange: (value: string) => void
  readonly onProviderChange: (value: string) => void
  readonly onIntentChange: (value: 'analyze' | 'create' | 'revise') => void
  readonly onResultPolicyChange: (value: ComposerResultPolicy) => void
  readonly onReceiverChange: (value: string | null) => void
  readonly onToggleReference: (id: string) => void
  readonly onMoveReference: (id: string, delta: -1 | 1) => void
  readonly onStartReferencePick: () => void
  readonly onFinishReferencePick: () => void
}

export interface SurfaceExecutionSubmission {
  readonly prompt: string
  readonly surface: 'context' | 'workflow' | 'conversation'
  readonly selectionIds: readonly string[]
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
