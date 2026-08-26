import { createHash, randomUUID } from 'node:crypto'
import type {
  MutationChangeItemV1,
  MutationChangeSetV1,
  MutationRelationSnapshotV1,
  ProjectEventOrigin,
} from '@local-creative-os/contracts'
import type { Relation } from '@local-creative-os/domain'
import type { SqliteMetadataRepository } from './metadata-repository.js'
import { PresentationApplicationService } from './presentation-application-service.js'
import type { ProjectEventHub } from './project-events/project-event-hub.js'

export interface RevertResultV1 {
  readonly revertable: boolean
  readonly reason?: 'TOUCHED_STATE_CHANGED_AFTER_APPLY' | 'FORWARD_STATE_UNAVAILABLE'
  readonly changeSetId: string
}

function relationSnapshot(relation: Relation): MutationRelationSnapshotV1 {
  return {
    sourceEntityType: String(relation.sourceEntityType),
    sourceEntityId: String(relation.sourceEntityId),
    targetEntityType: String(relation.targetEntityType),
    targetEntityId: String(relation.targetEntityId),
    kind: relation.kind,
    ...(relation.origin === undefined ? {} : { origin: relation.origin }),
    ...(relation.createdBy === undefined ? {} : { createdBy: relation.createdBy }),
    ...(relation.evidenceRefs === undefined ? {} : { evidenceRefs: relation.evidenceRefs }),
    ...(relation.confidence === undefined ? {} : { confidence: relation.confidence }),
  }
}

function relationFingerprint(value: MutationRelationSnapshotV1): string {
  return `relation:${createHash('sha256').update(JSON.stringify({
    sourceEntityType: value.sourceEntityType,
    sourceEntityId: value.sourceEntityId,
    targetEntityType: value.targetEntityType,
    targetEntityId: value.targetEntityId,
    kind: value.kind,
    origin: value.origin ?? null,
    createdBy: value.createdBy ?? null,
    evidenceRefs: value.evidenceRefs ?? null,
    confidence: value.confidence ?? null,
  })).digest('hex')}`
}

function stateFingerprint(value: unknown): string {
  return `state:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

/**
 * B5 Mutation Safety：统一 ChangeSet + Safe Undo/Redo。
 *
 * 纪律：
 * - ChangeSet 是 technical audit，不是 Project Domain Entity。
 * - Undo/Redo 只在 touched state 仍与预期一致时执行，绝不覆盖用户后续修改。
 * - 新 Relation mutation 与 ChangeSet 尽量在同一 SQLite transaction 内完成。
 * - ProjectEventHub 只广播已提交结果，不成为第二份 Truth。
 */
export class MutationSafetyService {
  readonly #metadata: SqliteMetadataRepository
  readonly #presentations: PresentationApplicationService
  readonly #events: ProjectEventHub | undefined

  constructor(metadata: SqliteMetadataRepository, presentations: PresentationApplicationService, events?: ProjectEventHub) {
    this.#metadata = metadata
    this.#presentations = presentations
    this.#events = events
  }

  record(input: {
    readonly projectId: string
    readonly operationId: string
    readonly actorKind: MutationChangeSetV1['actorKind']
    readonly actorId?: string
    readonly changes: readonly MutationChangeItemV1[]
    readonly origin?: ProjectEventOrigin
  }): MutationChangeSetV1 {
    const value = this.#buildChangeSet(input)
    this.#metadata.createMutationChangeSet(value)
    this.#publishChangeSet(value, input.origin)
    return value
  }

  get(changeSetId: string): MutationChangeSetV1 | undefined {
    return this.#metadata.getMutationChangeSet(changeSetId)
  }

  list(projectId: string, limit = 50): readonly MutationChangeSetV1[] {
    return this.#metadata.listMutationChangeSets(projectId, limit)
  }

  /** Direct Relation create/update. Produces one atomic ChangeSet. */
  upsertRelation(input: {
    readonly projectId: string
    readonly relation: Relation
    readonly operationId?: string
    readonly actorKind?: MutationChangeSetV1['actorKind']
    readonly actorId?: string
    readonly origin?: ProjectEventOrigin
  }): MutationChangeSetV1 {
    const existing = this.#metadata.getRelation(String(input.relation.id))
    const after = relationSnapshot(input.relation)
    const operationId = input.operationId ?? input.origin?.operationId ?? `relation-${randomUUID()}`
    const change: MutationChangeItemV1 = existing === undefined
      ? {
          type: 'relation_upsert',
          relationId: String(input.relation.id),
          inverse: { type: 'delete_relation', relationId: String(input.relation.id) },
          forward: { type: 'restore_relation', relationId: String(input.relation.id), relation: after },
          appliedFingerprint: relationFingerprint(after),
        }
      : {
          type: 'relation_update',
          relationId: String(input.relation.id),
          inverse: { type: 'restore_relation', relationId: String(input.relation.id), relation: relationSnapshot(existing) },
          forward: { type: 'restore_relation', relationId: String(input.relation.id), relation: after },
          beforeFingerprint: relationFingerprint(relationSnapshot(existing)),
          appliedFingerprint: relationFingerprint(after),
        }
    const changeSet = this.#buildChangeSet({
      projectId: input.projectId,
      operationId,
      actorKind: input.actorKind ?? 'web',
      ...(input.actorId === undefined ? {} : { actorId: input.actorId }),
      changes: [change],
    })
    this.#metadata.runCurationMutation({ projectId: input.projectId, relationUpserts: [input.relation], changeSet })
    this.#publishRelation(input.projectId, String(input.relation.id), 'upserted', input.origin)
    this.#publishChangeSet(changeSet, input.origin)
    return changeSet
  }

  /** Direct Relation delete. Produces one atomic ChangeSet. */
  deleteRelation(input: {
    readonly projectId: string
    readonly relationId: string
    readonly operationId?: string
    readonly actorKind?: MutationChangeSetV1['actorKind']
    readonly actorId?: string
    readonly origin?: ProjectEventOrigin
  }): MutationChangeSetV1 {
    const existing = this.#metadata.getRelation(input.relationId)
    if (existing === undefined || String(existing.projectId) !== input.projectId) throw new Error('Relation not found.')
    const before = relationSnapshot(existing)
    const operationId = input.operationId ?? input.origin?.operationId ?? `relation-${randomUUID()}`
    const change: MutationChangeItemV1 = {
      type: 'relation_delete',
      relationId: input.relationId,
      inverse: { type: 'restore_relation', relationId: input.relationId, relation: before },
      forward: { type: 'delete_relation', relationId: input.relationId },
      appliedFingerprint: 'relation:absent',
    }
    const changeSet = this.#buildChangeSet({
      projectId: input.projectId,
      operationId,
      actorKind: input.actorKind ?? 'web',
      ...(input.actorId === undefined ? {} : { actorId: input.actorId }),
      changes: [change],
    })
    this.#metadata.runCurationMutation({ projectId: input.projectId, relationDeletes: [input.relationId], changeSet })
    this.#publishRelation(input.projectId, input.relationId, 'deleted', input.origin)
    this.#publishChangeSet(changeSet, input.origin)
    return changeSet
  }

  revert(changeSetId: string, origin?: ProjectEventOrigin): RevertResultV1 {
    const changeSet = this.#metadata.getMutationChangeSet(changeSetId)
    if (changeSet === undefined) throw new Error('Change set not found.')
    if (changeSet.status !== 'applied') return { revertable: false, changeSetId }

    // 1. 全部 touched state 必须仍等于本 ChangeSet apply 后的状态。
    for (const change of changeSet.changes) {
      if (change.type === 'presentation_state') {
        const current = this.#presentations.get(changeSet.projectId, change.presentationId)
        if (current === undefined || current.version !== change.afterVersion) {
          return { revertable: false, reason: 'TOUCHED_STATE_CHANGED_AFTER_APPLY', changeSetId }
        }
      } else if (change.type === 'relation_upsert' || change.type === 'relation_update') {
        const current = this.#metadata.getRelation(change.relationId)
        if (current === undefined) return { revertable: false, reason: 'TOUCHED_STATE_CHANGED_AFTER_APPLY', changeSetId }
        // 旧 HU-1B ChangeSet 使用 relation:<id>:applied，仅能做到 existence guard。
        if (!change.appliedFingerprint.endsWith(':applied') && relationFingerprint(relationSnapshot(current)) !== change.appliedFingerprint) {
          return { revertable: false, reason: 'TOUCHED_STATE_CHANGED_AFTER_APPLY', changeSetId }
        }
      } else if (change.type === 'relation_delete') {
        if (this.#metadata.getRelation(change.relationId) !== undefined) {
          return { revertable: false, reason: 'TOUCHED_STATE_CHANGED_AFTER_APPLY', changeSetId }
        }
      } else if (change.type === 'artifact_text_update') {
        // 撤销修订：current 必须仍指向 agent 写入的 after 修订（之后有人写过则阻断，绝不覆盖新工作）。
        const current = this.#metadata.getArtifact(change.artifactId)
        if (current === undefined || current.currentRevisionId === undefined || String(current.currentRevisionId) !== change.afterRevisionId) {
          return { revertable: false, reason: 'TOUCHED_STATE_CHANGED_AFTER_APPLY', changeSetId }
        }
      } else if (change.type === 'artifact_text_create') {
        // 撤销创建：节点还在 AND 正文仍是创建时那版（被人编辑过则阻断——防误删用户后续工作）。
        const current = this.#metadata.getArtifact(change.artifactId)
        if (current === undefined || current.currentRevisionId === undefined) {
          return { revertable: false, reason: 'TOUCHED_STATE_CHANGED_AFTER_APPLY', changeSetId }
        }
        const revision = this.#metadata.getArtifactRevision(String(current.currentRevisionId))
        if (revision === undefined || String(revision.contentHash) !== change.createdContentHash) {
          return { revertable: false, reason: 'TOUCHED_STATE_CHANGED_AFTER_APPLY', changeSetId }
        }
      }
    }

    // 2. 全部安全后才执行 inverse。
    for (const change of changeSet.changes) {
      if (change.type === 'presentation_state') {
        const current = this.#presentations.get(changeSet.projectId, change.presentationId)
        if (current !== undefined) {
          this.#presentations.save(changeSet.projectId, {
            presentationId: change.presentationId,
            scopeId: current.scopeId,
            capability: current.capability,
            renderer: current.renderer,
            state: change.inverse.stateSnapshot as never,
            expectedVersion: current.version,
            updatedBy: changeSet.actorKind === 'web' ? 'web' : 'agent',
          })
        }
      } else if (change.type === 'relation_upsert') {
        this.#metadata.deleteRelation(change.relationId)
        this.#publishRelation(changeSet.projectId, change.relationId, 'deleted', origin)
      } else if (change.type === 'relation_update' || change.type === 'relation_delete') {
        this.#restoreRelation(changeSet.projectId, change.relationId, change.inverse.relation)
        this.#publishRelation(changeSet.projectId, change.relationId, 'restored', origin)
      } else if (change.type === 'artifact_text_update') {
        this.#metadata.restoreArtifactCurrentRevision({
          artifactId: change.artifactId,
          targetRevisionId: change.inverse.targetRevisionId,
          expectedCurrentRevisionId: change.afterRevisionId,
        })
        this.#publishArtifact(changeSet.projectId, change.artifactId, 'restored', origin)
      } else if (change.type === 'artifact_text_create') {
        this.#metadata.deleteArtifact(change.artifactId)
        this.#publishArtifact(changeSet.projectId, change.artifactId, 'deleted', origin)
      }
    }

    this.#metadata.markChangeSetReverted(changeSetId, new Date().toISOString())
    const updated = this.#metadata.getMutationChangeSet(changeSetId) ?? changeSet
    this.#publishChangeSet(updated, origin)
    return { revertable: true, changeSetId }
  }

  /** Safe redo. Legacy ChangeSets without forward snapshots remain undo-only. */
  reapply(changeSetId: string, origin?: ProjectEventOrigin): RevertResultV1 {
    const changeSet = this.#metadata.getMutationChangeSet(changeSetId)
    if (changeSet === undefined) throw new Error('Change set not found.')
    if (changeSet.status !== 'reverted') return { revertable: false, changeSetId }

    for (const change of changeSet.changes) {
      if (change.type === 'presentation_state') {
        if (change.forward === undefined) return { revertable: false, reason: 'FORWARD_STATE_UNAVAILABLE', changeSetId }
        const current = this.#presentations.get(changeSet.projectId, change.presentationId)
        if (current === undefined || stateFingerprint(current.state) !== stateFingerprint(change.inverse.stateSnapshot)) {
          return { revertable: false, reason: 'TOUCHED_STATE_CHANGED_AFTER_APPLY', changeSetId }
        }
      } else if (change.type === 'relation_upsert') {
        if (change.forward === undefined) return { revertable: false, reason: 'FORWARD_STATE_UNAVAILABLE', changeSetId }
        if (this.#metadata.getRelation(change.relationId) !== undefined) return { revertable: false, reason: 'TOUCHED_STATE_CHANGED_AFTER_APPLY', changeSetId }
      } else if (change.type === 'relation_update') {
        const current = this.#metadata.getRelation(change.relationId)
        if (current === undefined || relationFingerprint(relationSnapshot(current)) !== change.beforeFingerprint) {
          return { revertable: false, reason: 'TOUCHED_STATE_CHANGED_AFTER_APPLY', changeSetId }
        }
      } else if (change.type === 'relation_delete') {
        const current = this.#metadata.getRelation(change.relationId)
        if (current === undefined || relationFingerprint(relationSnapshot(current)) !== relationFingerprint(change.inverse.relation)) {
          return { revertable: false, reason: 'TOUCHED_STATE_CHANGED_AFTER_APPLY', changeSetId }
        }
      } else if (change.type === 'artifact_text_update') {
        // 重做修订：current 必须仍停在撤销后的 before 修订（期间有人写过则阻断）。
        const current = this.#metadata.getArtifact(change.artifactId)
        if (current === undefined || current.currentRevisionId === undefined || String(current.currentRevisionId) !== change.beforeRevisionId) {
          return { revertable: false, reason: 'TOUCHED_STATE_CHANGED_AFTER_APPLY', changeSetId }
        }
      } else if (change.type === 'artifact_text_create') {
        // undo-only：创建的重做需全量复合重建，V0 不承诺。
        return { revertable: false, reason: 'FORWARD_STATE_UNAVAILABLE', changeSetId }
      }
    }

    for (const change of changeSet.changes) {
      if (change.type === 'presentation_state') {
        const current = this.#presentations.get(changeSet.projectId, change.presentationId)!
        this.#presentations.save(changeSet.projectId, {
          presentationId: change.presentationId,
          scopeId: current.scopeId,
          capability: current.capability,
          renderer: current.renderer,
          state: change.forward!.stateSnapshot as never,
          expectedVersion: current.version,
          updatedBy: changeSet.actorKind === 'web' ? 'web' : 'agent',
        })
      } else if (change.type === 'relation_upsert') {
        this.#restoreRelation(changeSet.projectId, change.relationId, change.forward!.relation)
        this.#publishRelation(changeSet.projectId, change.relationId, 'upserted', origin)
      } else if (change.type === 'relation_update') {
        this.#restoreRelation(changeSet.projectId, change.relationId, change.forward.relation)
        this.#publishRelation(changeSet.projectId, change.relationId, 'upserted', origin)
      } else if (change.type === 'relation_delete') {
        this.#metadata.deleteRelation(change.relationId)
        this.#publishRelation(changeSet.projectId, change.relationId, 'deleted', origin)
      } else if (change.type === 'artifact_text_update') {
        this.#metadata.restoreArtifactCurrentRevision({
          artifactId: change.artifactId,
          targetRevisionId: change.forward.targetRevisionId,
          expectedCurrentRevisionId: change.beforeRevisionId,
        })
        this.#publishArtifact(changeSet.projectId, change.artifactId, 'restored', origin)
      }
    }

    this.#metadata.markChangeSetApplied(changeSetId)
    const updated = this.#metadata.getMutationChangeSet(changeSetId) ?? changeSet
    this.#publishChangeSet(updated, origin)
    return { revertable: true, changeSetId }
  }

  #buildChangeSet(input: {
    readonly projectId: string
    readonly operationId: string
    readonly actorKind: MutationChangeSetV1['actorKind']
    readonly actorId?: string
    readonly changes: readonly MutationChangeItemV1[]
  }): MutationChangeSetV1 {
    const now = new Date().toISOString()
    return {
      schemaVersion: 1,
      id: `changeset-${randomUUID()}`,
      projectId: input.projectId,
      operationId: input.operationId,
      actorKind: input.actorKind,
      ...(input.actorId === undefined ? {} : { actorId: input.actorId }),
      changes: input.changes,
      status: 'applied',
      createdAt: now,
    }
  }

  #restoreRelation(projectId: string, relationId: string, value: MutationRelationSnapshotV1): void {
    const now = new Date().toISOString()
    this.#metadata.upsertRelation({
      id: relationId as never,
      projectId: projectId as never,
      sourceEntityType: value.sourceEntityType as never,
      sourceEntityId: value.sourceEntityId,
      targetEntityType: value.targetEntityType as never,
      targetEntityId: value.targetEntityId,
      kind: value.kind,
      createdAt: now,
      updatedAt: now,
      ...(value.origin === undefined ? {} : { origin: value.origin as never }),
      ...(value.createdBy === undefined ? {} : { createdBy: value.createdBy }),
      ...(value.evidenceRefs === undefined ? {} : { evidenceRefs: value.evidenceRefs }),
      ...(value.confidence === undefined ? {} : { confidence: value.confidence }),
    })
  }

  #publishChangeSet(changeSet: MutationChangeSetV1, origin?: ProjectEventOrigin): void {
    this.#events?.publish(changeSet.projectId, {
      channel: 'mutation',
      type: 'change_set.changed',
      ...(origin === undefined ? {} : { origin }),
      payload: { changeSetId: changeSet.id, status: changeSet.status, operationId: changeSet.operationId },
    })
  }

  #publishRelation(projectId: string, relationId: string, action: 'upserted' | 'deleted' | 'restored', origin?: ProjectEventOrigin): void {
    this.#events?.publish(projectId, {
      channel: 'mutation',
      type: 'relation.changed',
      ...(origin === undefined ? {} : { origin }),
      entityRefs: [`relation:${relationId}`],
      payload: { relationId, action },
    })
  }
  #publishArtifact(projectId: string, artifactId: string, action: 'restored' | 'deleted', origin?: ProjectEventOrigin): void {
    this.#events?.publish(projectId, {
      channel: 'artifact',
      type: 'artifact.changed',
      ...(origin === undefined ? {} : { origin }),
      entityRefs: [`artifact:${artifactId}`],
      payload: { artifactId, action },
    })
  }
}
