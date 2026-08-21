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
  readonly evidenceRefs?: readonly { readonly kind: 'artifact' | 'resource' | 'conversation' | 'file'; readonly id: string; readonly label?: string }[]
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

/** B5：Change Set 是 technical audit / undo contract，不是新的 Project Domain Entity。 */
export interface MutationRelationSnapshotV1 {
  readonly sourceEntityType: string
  readonly sourceEntityId: string
  readonly targetEntityType: string
  readonly targetEntityId: string
  readonly kind: string
  readonly origin?: string
  readonly createdBy?: string
  readonly evidenceRefs?: readonly { readonly kind: 'artifact' | 'resource' | 'conversation' | 'file'; readonly id: string; readonly label?: string }[]
  readonly confidence?: number
}

export type MutationChangeItemV1 =
  | {
      readonly type: 'presentation_state'
      readonly presentationId: string
      readonly beforeVersion: number
      readonly afterVersion: number
      readonly inverse: {
        readonly type: 'restore_presentation_state'
        readonly presentationId: string
        readonly targetVersion: number
        readonly stateSnapshot: unknown
      }
      /** 新 ChangeSet 会保存 forward snapshot，旧 ChangeSet 缺失时只支持安全撤销、不承诺重做。 */
      readonly forward?: {
        readonly type: 'restore_presentation_state'
        readonly presentationId: string
        readonly stateSnapshot: unknown
      }
      readonly touchedKeys: readonly string[]
      readonly appliedFingerprint: string
    }
  | {
      /** Relation 原先不存在，本次创建。 */
      readonly type: 'relation_upsert'
      readonly relationId: string
      readonly inverse: { readonly type: 'delete_relation'; readonly relationId: string }
      readonly forward?: { readonly type: 'restore_relation'; readonly relationId: string; readonly relation: MutationRelationSnapshotV1 }
      readonly appliedFingerprint: string
    }
  | {
      /** Relation 原先存在，本次修改。 */
      readonly type: 'relation_update'
      readonly relationId: string
      readonly inverse: { readonly type: 'restore_relation'; readonly relationId: string; readonly relation: MutationRelationSnapshotV1 }
      readonly forward: { readonly type: 'restore_relation'; readonly relationId: string; readonly relation: MutationRelationSnapshotV1 }
      readonly beforeFingerprint: string
      readonly appliedFingerprint: string
    }
  | {
      readonly type: 'relation_delete'
      readonly relationId: string
      readonly inverse: {
        readonly type: 'restore_relation'
        readonly relationId: string
        readonly relation: MutationRelationSnapshotV1
      }
      readonly forward?: { readonly type: 'delete_relation'; readonly relationId: string }
      readonly appliedFingerprint: string
    }

export interface MutationChangeSetV1 {
  readonly schemaVersion: 1
  readonly id: string
  readonly projectId: string
  readonly operationId: string
  readonly actorKind: 'agent' | 'web' | 'core'
  readonly actorId?: string
  readonly changes: readonly MutationChangeItemV1[]
  readonly status: 'applied' | 'reverted'
  readonly createdAt: string
  readonly revertedAt?: string
  readonly reappliedAt?: string
}
