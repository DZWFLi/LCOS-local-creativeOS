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

/**
 * 任务三第二刀（20260826，huabu ExecuteConflict 同构）：
 * Agent 写已有 text content 时的 CAS 拒绝两态。
 * - `not-read`：本次 session 从未 full-read 过该 artifact——必须先 read 再写，
 *   原样重试恒失败（write guard 只认 server 侧 readSet lease，模型不能手带）。
 * - `stale`：读到过的 revision 已被并发写更新——重读、reconcile、再发。
 */
export type CurationWriteConflictReasonV1 = 'not-read' | 'stale'

export interface CurationWriteConflictV1 {
  readonly artifactId: string
  readonly viewId?: string
  readonly reason: CurationWriteConflictReasonV1
  /** Agent 读到过的 revision；`not-read` 时缺失。 */
  readonly expectedRevisionId?: string
  /** 仓库当前 revision；artifact 无 current revision 时缺失。 */
  readonly currentRevisionId?: string
  /** 给模型的下一步指令（huabu buildConflictHint 直译）。 */
  readonly hint: string
}

/** huabu canvas-write.ts buildConflictHint 同构：拼一句模型可执行的指令。 */
export function buildCurationConflictHintV1(conflicts: readonly CurationWriteConflictV1[]): string {
  const parts: string[] = []
  if (conflicts.some((conflict) => conflict.reason === 'not-read')) {
    parts.push('Read before write: read the conflicted node(s) first, then re-issue. Retrying as-is fails again.')
  }
  if (conflicts.some((conflict) => conflict.reason === 'stale')) {
    parts.push('Node(s) changed since your last read — re-read, reconcile, then re-issue.')
  }
  return parts.join(' ')
}

/**
 * updateText（修订已有受管 text）的结果：成功 or 被 CAS guard 拒绝。
 * 拒绝时永远带结构化 conflicts + conflictHint；无 sessionId（GUI 直编）不设防，恒 applied。
 */
export type CurationTextUpdateOutcomeV1 =
  | {
      readonly outcome: 'applied'
      readonly artifactId: string
      readonly viewId: string
      readonly revisionId: string
      readonly legacyMigrated: boolean
    }
  | {
      readonly outcome: 'rejected'
      readonly conflicts: readonly CurationWriteConflictV1[]
      readonly conflictHint: string
    }
