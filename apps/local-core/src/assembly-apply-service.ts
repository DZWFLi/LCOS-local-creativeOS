/**
 * F6 P0-B4（20260828）：Semantic Drop 统一 apply 通道。
 *
 * 本服务不拥有任何 mutation——只做「sourceRef+targetRef → 既有 canonical 服务」的路由：
 * - capture → project          ：CaptureSpaceService.materializeToProject（幂等/事务/import batch）
 * - artifactView → workspace   ：metadata.addWorkspaceMembers（Phase 0/1 canonical membership）
 * - 任意 → conversation        ：conversation_context relation（复用 Relation truth + ChangeSet）
 * unsupported 的组合明确返回（skill=0.15 只读裁定；context/workflow target 待交互形态冻结后接
 * presentation membership，不在本批猜实现）。
 */
import { randomUUID } from 'node:crypto'
import type {
  AssemblyApplyItemResultV1,
  AssemblyApplyRequestV1,
  AssemblyApplyResultV1,
  AssemblySourceRefV1,
  AssemblyTargetRefV1,
} from '@local-creative-os/contracts'
import type { Relation, RelationId, ProjectId } from '@local-creative-os/domain'
import type { SqliteMetadataRepository } from './metadata-repository.js'
import type { ConversationImportService } from './conversation-import-service.js'
import type { MutationSafetyService } from './mutation-safety-service.js'
import type { CaptureSpaceService } from './capture-space-service.js'

function relationEntityKindFor(ref: AssemblySourceRefV1 | AssemblyTargetRefV1): 'artifact' | 'view' | 'scope' | 'workspace' | undefined {
  if (ref.kind === 'artifactView') return 'view'
  if (ref.kind === 'context' || ref.kind === 'workflow' || ref.kind === 'scene' || ref.kind === 'collection') return 'scope'
  if (ref.kind === 'conversation') return 'artifact' // conversation 的 canonical 端点是 conversationArtifactId
  return undefined
}

export class AssemblyApplyService {
  constructor(
    private readonly metadata: SqliteMetadataRepository,
    private readonly captureSpace: CaptureSpaceService | undefined,
    private readonly mutationSafety: MutationSafetyService | undefined,
    private readonly conversations: ConversationImportService | undefined,
  ) {}

  async apply(request: AssemblyApplyRequestV1): Promise<AssemblyApplyResultV1> {
    if (request.schemaVersion !== 1) throw new Error('AssemblyApplyRequest schemaVersion must be 1.')
    const projectId = request.projectId
    if (this.metadata.getProject(projectId) === undefined) throw new Error('Project not found.')

    const results: AssemblyApplyItemResultV1[] = []
    for (const sourceRef of request.sourceRefs) {
      results.push(await this.#applyOne(projectId, sourceRef, request.targetRef))
    }
    return {
      schemaVersion: 1,
      projectId,
      results,
      allApplied: results.length > 0 && results.every((result) => result.status === 'applied' || result.status === 'skipped'),
    }
  }

  async #applyOne(projectId: string, sourceRef: AssemblySourceRefV1, targetRef: AssemblyTargetRefV1): Promise<AssemblyApplyItemResultV1> {
    const unsupported = (message: string): AssemblyApplyItemResultV1 => ({
      sourceRef,
      status: 'skipped',
      channel: 'unsupported',
      message,
    })

    // ---- 通道 1：capture → project（materialize 既有事务）----
    if (sourceRef.kind === 'capture') {
      if (targetRef.kind !== 'project') {
        return unsupported('Capture sources can only materialize into a project target.')
      }
      if (this.captureSpace === undefined) return unsupported('Capture space service is not configured.')
      try {
        const materialized = await this.captureSpace.materializeToProject([sourceRef.id], targetRef.id)
        const item = materialized.items[0]
        if (item === undefined) return unsupported('Materialize returned no items.')
        return { sourceRef, status: 'applied', channel: 'capture-materialize', message: `artifact ${item.artifactId}` }
      } catch (error: unknown) {
        return { sourceRef, status: 'failed', channel: 'error', message: error instanceof Error ? error.message : String(error) }
      }
    }

    // ---- 通道 2：artifactView → workspace（canonical membership；context/workflow/scene target 待交互形态冻结后接 presentation membership，本批明确 unsupported）----
    if (sourceRef.kind === 'artifactView' && targetRef.kind === 'workspace') {
      const view = this.metadata.getArtifactView(sourceRef.id)
      if (view === undefined) return { sourceRef, status: 'failed', channel: 'error', message: 'Artifact view not found.' }
      if (String(this.metadata.getArtifact(String(view.artifactId))?.projectId ?? '') !== projectId) {
        return { sourceRef, status: 'failed', channel: 'error', message: 'Artifact view belongs to another project.' }
      }
      if (String(this.metadata.getWorkspace(targetRef.id)?.projectId ?? '') !== projectId) {
        return { sourceRef, status: 'failed', channel: 'error', message: 'Workspace belongs to another project.' }
      }
      const members = this.metadata.listWorkspaceMembers(targetRef.id as never)
      if (members.some((member) => String(member.artifactViewId) === sourceRef.id)) {
        return { sourceRef, status: 'skipped', channel: 'already-member', message: 'Already a member of this workspace.' }
      }
      try {
        this.metadata.addWorkspaceMembers(targetRef.id as never, [sourceRef.id as never], 'user', new Date().toISOString())
        return { sourceRef, status: 'applied', channel: 'workspace-membership', message: 'Added to workspace.' }
      } catch (error: unknown) {
        return { sourceRef, status: 'failed', channel: 'error', message: error instanceof Error ? error.message : String(error) }
      }
    }

    // ---- 通道 3：conversation target（conversation_context relation，复用 Relation truth）----
    if (targetRef.kind === 'conversation') {
      return this.#applyConversationContext(projectId, sourceRef, targetRef)
    }

    // ---- 其余组合：明确 unsupported ----
    if (sourceRef.kind === 'skill') return unsupported('Skills are read-only in v0.15 (usage-binding deferred to 0.2).')
    if (sourceRef.kind === 'conversation' || sourceRef.kind === 'resource' || sourceRef.kind === 'context' || sourceRef.kind === 'workflow' || sourceRef.kind === 'scene' || sourceRef.kind === 'collection') {
      if (targetRef.kind === 'workspace' || targetRef.kind === 'project') return unsupported(`Source kind '${sourceRef.kind}' cannot become canvas membership directly.`)
      return unsupported(`Source kind '${sourceRef.kind}' to '${targetRef.kind}' is not wired in this batch.`)
    }
    return unsupported(`Unsupported combination: ${sourceRef.kind} -> ${targetRef.kind}.`)
  }

  /** conversation_context relation：source=conversation artifact 端点，target=实体端点（施工单 §13 P0-D4 方向）。 */
  #applyConversationContext(projectId: string, sourceRef: AssemblySourceRefV1, targetRef: AssemblyTargetRefV1): AssemblyApplyItemResultV1 {
    if (this.mutationSafety === undefined) {
      return { sourceRef, status: 'skipped', channel: 'unsupported', message: 'Relation mutation service is not configured.' }
    }
    const connected = this.metadata.getConnectedConversation(projectId, targetRef.id)
    if (connected === undefined) {
      return { sourceRef, status: 'failed', channel: 'error', message: 'Connected conversation not found.' }
    }
    // conversation 的 canonical artifact 端点：linked session 的 conversationArtifactId；未 link = fail-close。
    if (connected.conversationSessionId === undefined) {
      return { sourceRef, status: 'failed', channel: 'error', message: 'Conversation has no linked session (fail-close).' }
    }
    const session = this.conversations?.getProjection(projectId, connected.conversationSessionId)?.session
    const conversationArtifactId = session?.conversationArtifactId
    if (conversationArtifactId === undefined) {
      return { sourceRef, status: 'failed', channel: 'error', message: 'Conversation session has no artifact endpoint.' }
    }
    // target 实体解析：本方法只处理 view/artifact 型 source（relation 端点）。
    if (sourceRef.kind !== 'artifactView') {
      return { sourceRef, status: 'skipped', channel: 'unsupported', message: 'Only artifact-view sources bind to conversations in this batch.' }
    }
    const view = this.metadata.getArtifactView(sourceRef.id)
    if (view === undefined) return { sourceRef, status: 'failed', channel: 'error', message: 'Artifact view not found.' }
    if (String(this.metadata.getArtifact(String(view.artifactId))?.projectId ?? '') !== projectId) {
      return { sourceRef, status: 'failed', channel: 'error', message: 'Artifact view belongs to another project.' }
    }
    const targetEntityKind = relationEntityKindFor(sourceRef)
    if (targetEntityKind === undefined) return { sourceRef, status: 'skipped', channel: 'unsupported', message: 'Source has no relation endpoint kind.' }
    // 幂等：同 conversation→view 的 conversation_context 已存在 = skipped。
    const existing = this.metadata.getRelations(projectId).find((relation) =>
      relation.kind === 'conversation_context'
      && String(relation.sourceEntityId) === String(conversationArtifactId)
      && String(relation.targetEntityId) === sourceRef.id)
    if (existing !== undefined) {
      return { sourceRef, status: 'skipped', channel: 'already-member', message: 'conversation_context binding already exists.' }
    }
    const now = new Date().toISOString()
    const relation: Relation = {
      id: `relation-assembly-${randomUUID()}` as RelationId,
      projectId: projectId as ProjectId,
      sourceEntityType: 'artifact',
      sourceEntityId: conversationArtifactId,
      targetEntityType: targetEntityKind,
      targetEntityId: sourceRef.id,
      kind: 'conversation_context',
      createdAt: now,
      updatedAt: now,
    }
    try {
      const changeSet = this.mutationSafety.upsertRelation({ projectId, relation })
      return { sourceRef, status: 'applied', channel: 'relation', message: `conversation_context bound (changeset ${changeSet.id}).` }
    } catch (error: unknown) {
      return { sourceRef, status: 'failed', channel: 'error', message: error instanceof Error ? error.message : String(error) }
    }
  }
}