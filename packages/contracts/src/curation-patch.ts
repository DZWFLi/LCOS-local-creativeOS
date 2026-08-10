/**
 * CurationPatch V0 — Phase E. A minimal batch write for the Curator skill:
 * create texts, add relations with provenance, patch one Presentation with CAS.
 * clientRef lets one patch reference newly created objects.
 * V0 does not promise FS+SQLite global ACID; each step returns a receipt.
 */

export interface CurationPatchTargetRefV0 {
  readonly clientRef?: string
  readonly entityType?: 'artifact' | 'view' | 'workspace'
  readonly entityId?: string
}

export interface CurationPatchCreateTextV0 {
  readonly clientRef: string
  readonly title?: string
  readonly body: string
}

export interface CurationPatchRelationV0 {
  readonly from: CurationPatchTargetRefV0
  readonly to: CurationPatchTargetRefV0
  readonly label?: string
  readonly kind?: string
  readonly origin?: 'user' | 'agent' | 'system'
  readonly createdBy?: string
  readonly confidence?: number
}

export interface CurationPatchPresentationV0 {
  readonly presentationId: string
  readonly expectedVersion: number
  readonly addMembers?: readonly CurationPatchTargetRefV0[]
  readonly removeMembers?: readonly string[]
  readonly setRenderer?: string
  readonly setHierarchy?: { readonly parentByViewId: Record<string, string | null>; readonly orderByParent: Record<string, string[]> }
  readonly addPresentationEdges?: readonly { readonly id: string; readonly from: CurationPatchTargetRefV0; readonly to: CurationPatchTargetRefV0; readonly label?: string }[]
  readonly removePresentationEdges?: readonly string[]
  readonly setEmphasis?: Readonly<Record<string, 'primary' | 'normal' | 'secondary' | 'muted'>>
  readonly pin?: readonly string[]
  readonly unpin?: readonly string[]
}

export interface CurationPatchV0 {
  readonly schemaVersion: 0
  readonly operationId?: string
  readonly projectId: string
  readonly scopeId: string
  readonly createTexts: readonly CurationPatchCreateTextV0[]
  readonly relations: readonly CurationPatchRelationV0[]
  readonly presentation?: CurationPatchPresentationV0
}

export interface CurationPatchStepReceiptV0 {
  readonly step: 'createText' | 'relation' | 'presentation'
  readonly clientRef?: string
  readonly artifactId?: string
  readonly viewId?: string
  readonly revisionId?: string
  readonly relationId?: string
}

export interface CurationPatchReceiptV0 {
  readonly schemaVersion: 0
  readonly operationId: string
  readonly applied: boolean
  readonly completedSteps: readonly CurationPatchStepReceiptV0[]
  readonly failedStep?: { readonly step: string; readonly error: string }
  readonly createdAt: string
}
