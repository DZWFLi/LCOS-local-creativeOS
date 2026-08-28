/**
 * F6 P0-B4 + follow-up（20260828 补充冻结）：Semantic Drop 统一 apply 通道。
 *
 * 本服务不拥有任何 mutation——只做「sourceRef+targetRef → 既有 canonical 服务」的路由：
 * - capture → project/surface    ：CaptureSpaceService.materializeToProject（幂等：同 project
 *   已 resolved 且带产物回链 → 复用既有产物，capture→surface 两步链可安全重试）
 * - artifactView → main/context/workflow ：CurationCommandService.applyPatch——presentation
 *   membership，ChangeSet-backed（presentation_state + restore_presentation_state 全量快照 inverse）。
 *   Main = root scope 的 context 投影（presentation:context:<rootId>），不是 active Workspace 的别名。
 *   placement 并入同一 patch（undo 连 membership+投影一起撤，补充冻结 §7）。
 * - artifactView → workspace/scene ：MutationSafetyService.addWorkspaceMember——working-set
 *   membership 进 ChangeSet（workspace_membership_add，原子复合事务）。
 *   scene 与 workspace 同通道（scene.id 即 workspaceId）。
 * - 任意 → conversation          ：conversation_context relation（复用 Relation truth + ChangeSet）。
 * aggregate ref（context/workflow/scene/collection）作为 source 的 presentation 成员
 * （memberEntityRefs 通道）与 skill（只读裁定）明确 unsupported，不猜实现。
 */
import { randomUUID } from 'node:crypto'
import type {
  AssemblyApplyItemResultV1,
  AssemblyApplyRequestV1,
  AssemblyApplyResultV1,
  AssemblySourceRefV1,
  AssemblyTargetRefV1,
  PresentationStateV0,
} from '@local-creative-os/contracts'
import type { Relation, RelationId, ProjectId } from '@local-creative-os/domain'
import type { SqliteMetadataRepository } from './metadata-repository.js'
import type { ConversationImportService } from './conversation-import-service.js'
import type { MutationSafetyService } from './mutation-safety-service.js'
import type { CaptureSpaceService } from './capture-space-service.js'
import type { CurationCommandService } from './curation-command-service.js'
import type { PresentationApplicationService } from './presentation-application-service.js'

function relationEntityKindFor(ref: AssemblySourceRefV1 | AssemblyTargetRefV1): 'artifact' | 'view' | 'scope' | 'workspace' | undefined {
  if (ref.kind === 'artifactView') return 'view'
  if (ref.kind === 'context' || ref.kind === 'workflow' || ref.kind === 'scene' || ref.kind === 'collection') return 'scope'
  if (ref.kind === 'conversation') return 'artifact' // conversation 的 canonical 端点是 conversationArtifactId
  return undefined
}

/** Drop 落点（补充冻结 §6：placement 可选、与 semantic membership 分层）。 */
type Placement = { readonly x: number; readonly y: number }

type ArtifactViewSourceRef = AssemblySourceRefV1 & { readonly kind: 'artifactView' }

export class AssemblyApplyService {
  constructor(
    private readonly metadata: SqliteMetadataRepository,
    private readonly captureSpace: CaptureSpaceService | undefined,
    private readonly mutationSafety: MutationSafetyService | undefined,
    private readonly conversations: ConversationImportService | undefined,
    private readonly curationCommand: CurationCommandService | undefined,
    private readonly presentations: PresentationApplicationService | undefined,
  ) {}

  async apply(request: AssemblyApplyRequestV1): Promise<AssemblyApplyResultV1> {
    if (request.schemaVersion !== 1) throw new Error('AssemblyApplyRequest schemaVersion must be 1.')
    const projectId = request.projectId
    if (this.metadata.getProject(projectId) === undefined) throw new Error('Project not found.')

    const results: AssemblyApplyItemResultV1[] = []
    for (const sourceRef of request.sourceRefs) {
      results.push(await this.#applyOne(projectId, sourceRef, request.targetRef, request.placementBySource?.[sourceRef.id]))
    }
    const changeSetIds = results.map((result) => result.changeSetId).filter((id): id is string => id !== undefined)
    return {
      schemaVersion: 1,
      projectId,
      results,
      allApplied: results.length > 0 && results.every((result) => result.status === 'applied' || result.status === 'skipped'),
      ...(changeSetIds.length === 1 ? { changeSetId: changeSetIds[0] } : {}),
    }
  }

  async #applyOne(projectId: string, sourceRef: AssemblySourceRefV1, targetRef: AssemblyTargetRefV1, placement: Placement | undefined): Promise<AssemblyApplyItemResultV1> {
    const unsupported = (message: string): AssemblyApplyItemResultV1 => ({
      sourceRef,
      status: 'skipped',
      channel: 'unsupported',
      message,
    })

    // ---- 通道 1：capture source（幂等 materialize；→ project 直达或 → surface 先物化再入会）----
    if (sourceRef.kind === 'capture') {
      if (targetRef.kind === 'project') {
        if (this.captureSpace === undefined) return unsupported('Capture space service is not configured.')
        try {
          const materialized = await this.captureSpace.materializeToProject([sourceRef.id], targetRef.id)
          const item = materialized.items[0]
          if (item === undefined) return unsupported('Materialize returned no items.')
          if (item.reused === true) {
            return { sourceRef, status: 'skipped', channel: 'already-member', message: `Already materialized as artifact ${item.artifactId} (idempotent reuse).`, memberViewId: item.viewId }
          }
          return { sourceRef, status: 'applied', channel: 'capture-materialize', message: `artifact ${item.artifactId}`, memberViewId: item.viewId }
        } catch (error: unknown) {
          return { sourceRef, status: 'failed', channel: 'error', message: error instanceof Error ? error.message : String(error) }
        }
      }
      if (targetRef.kind === 'main' || targetRef.kind === 'context' || targetRef.kind === 'workflow' || targetRef.kind === 'workspace' || targetRef.kind === 'scene') {
        // staging → materialize once（幂等）→ surface membership；两步链失败后重试安全（产物回链复用）。
        if (this.captureSpace === undefined) return unsupported('Capture space service is not configured.')
        let materializedViewId: string | undefined
        try {
          const materialized = await this.captureSpace.materializeToProject([sourceRef.id], projectId)
          const item = materialized.items[0]
          materializedViewId = item?.viewId
          if (materializedViewId === undefined) return unsupported('Materialize returned no items.')
        } catch (error: unknown) {
          return { sourceRef, status: 'failed', channel: 'error', message: error instanceof Error ? error.message : String(error) }
        }
        const memberRef = { kind: 'artifactView', id: materializedViewId } as const
        const memberResult = (targetRef.kind === 'workspace' || targetRef.kind === 'scene')
          ? this.#applyWorkspaceMembership(projectId, memberRef, targetRef, placement)
          : await this.#applySurfaceMembership(projectId, memberRef, targetRef, placement)
        return { ...memberResult, sourceRef }
      }
      return unsupported('Capture sources can only materialize into a project or a project surface.')
    }

    // ---- 通道 2：artifactView → workspace/scene（working-set membership，ChangeSet-backed）----
    if (sourceRef.kind === 'artifactView' && (targetRef.kind === 'workspace' || targetRef.kind === 'scene')) {
      return this.#applyWorkspaceMembership(projectId, sourceRef, targetRef, placement)
    }

    // ---- 通道 3：artifactView → main/context/workflow（presentation membership，ChangeSet-backed）----
    if (sourceRef.kind === 'artifactView' && (targetRef.kind === 'main' || targetRef.kind === 'context' || targetRef.kind === 'workflow')) {
      return this.#applySurfaceMembership(projectId, sourceRef, targetRef, placement)
    }

    // ---- 通道 4：conversation target（conversation_context relation，复用 Relation truth）----
    if (targetRef.kind === 'conversation') {
      return this.#applyConversationContext(projectId, sourceRef, targetRef)
    }

    // ---- 其余组合：明确 unsupported ----
    if (sourceRef.kind === 'skill') return unsupported('Skills are read-only in v0.15 (usage-binding deferred to 0.2).')
    if (sourceRef.kind === 'context' || sourceRef.kind === 'workflow' || sourceRef.kind === 'scene' || sourceRef.kind === 'collection') {
      return unsupported(`Aggregate source '${sourceRef.kind}' presentation membership (memberEntityRefs) is not wired in this batch.`)
    }
    if (sourceRef.kind === 'conversation' || sourceRef.kind === 'resource') {
      if (targetRef.kind === 'workspace' || targetRef.kind === 'project' || targetRef.kind === 'main') return unsupported(`Source kind '${sourceRef.kind}' cannot become canvas membership directly.`)
      return unsupported(`Source kind '${sourceRef.kind}' to '${targetRef.kind}' is not wired in this batch.`)
    }
    return unsupported(`Unsupported combination: ${sourceRef.kind} -> ${targetRef.kind}.`)
  }

  /** workspace/scene 的 working-set membership：MutationSafetyService envelope（ChangeSet + 原子复合事务）。 */
  #applyWorkspaceMembership(projectId: string, sourceRef: ArtifactViewSourceRef, targetRef: Extract<AssemblyTargetRefV1, { readonly kind: 'workspace' | 'scene' }>, placement: Placement | undefined): AssemblyApplyItemResultV1 {
    const view = this.metadata.getArtifactView(sourceRef.id)
    if (view === undefined) return { sourceRef, status: 'failed', channel: 'error', message: 'Artifact view not found.' }
    if (String(this.metadata.getArtifact(String(view.artifactId))?.projectId ?? '') !== projectId) {
      return { sourceRef, status: 'failed', channel: 'error', message: 'Artifact view belongs to another project.' }
    }
    const workspaceId = targetRef.id
    if (String(this.metadata.getWorkspace(workspaceId)?.projectId ?? '') !== projectId) {
      return { sourceRef, status: 'failed', channel: 'error', message: 'Workspace belongs to another project.' }
    }
    if (this.mutationSafety === undefined) {
      return { sourceRef, status: 'skipped', channel: 'unsupported', message: 'Mutation safety service is not configured.' }
    }
    try {
      const changeSet = this.mutationSafety.addWorkspaceMember({ projectId, workspaceId, viewId: sourceRef.id, actorKind: 'web' })
      const placementApplied = placement !== undefined && this.#applyPlacementOnly(projectId, `presentation:custom:workspace:${workspaceId}`, sourceRef.id, placement)
      if (changeSet === undefined) {
        return { sourceRef, status: 'skipped', channel: 'already-member', message: 'Already a member of this workspace.', memberViewId: sourceRef.id, ...(placementApplied ? { placementApplied } : {}) }
      }
      return { sourceRef, status: 'applied', channel: 'workspace-membership', message: 'Added to workspace (ChangeSet-backed).', memberViewId: sourceRef.id, changeSetId: changeSet.id, ...(placement !== undefined ? { placementApplied } : {}) }
    } catch (error: unknown) {
      return { sourceRef, status: 'failed', channel: 'error', message: error instanceof Error ? error.message : String(error) }
    }
  }

  /** main/context/workflow 的 presentation membership：scaffold（缺失时）+ curation patch（ChangeSet）。 */
  async #applySurfaceMembership(projectId: string, sourceRef: ArtifactViewSourceRef, targetRef: Extract<AssemblyTargetRefV1, { readonly kind: 'main' | 'context' | 'workflow' }>, placement: Placement | undefined): Promise<AssemblyApplyItemResultV1> {
    if (this.curationCommand === undefined || this.presentations === undefined) {
      return { sourceRef, status: 'skipped', channel: 'unsupported', message: 'Presentation membership services are not configured.' }
    }
    const view = this.metadata.getArtifactView(sourceRef.id)
    if (view === undefined) return { sourceRef, status: 'failed', channel: 'error', message: 'Artifact view not found.' }
    if (String(this.metadata.getArtifact(String(view.artifactId))?.projectId ?? '') !== projectId) {
      return { sourceRef, status: 'failed', channel: 'error', message: 'Artifact view belongs to another project.' }
    }

    // target scope 解析：main = root scope；context/workflow 按 kind 校验（cross-project fail-close）。
    const scopes = this.metadata.getScopes(projectId)
    let scope: ReturnType<typeof scopes.find> | undefined
    if (targetRef.kind === 'main') {
      scope = scopes.find((item) => item.kind === 'root')
    } else {
      scope = scopes.find((item) => String(item.id) === targetRef.id)
    }
    if (scope === undefined) {
      return { sourceRef, status: 'failed', channel: 'error', message: targetRef.kind === 'main' ? 'Project has no root scope.' : `Target ${targetRef.kind} scope not found in this project.` }
    }
    if (targetRef.kind === 'context' && scope.kind !== 'context' && scope.kind !== 'root') {
      return { sourceRef, status: 'failed', channel: 'error', message: `Target scope '${String(scope.id)}' is not a context scope.` }
    }
    if (targetRef.kind === 'workflow' && scope.kind !== 'workflow' && scope.kind !== 'root') {
      return { sourceRef, status: 'failed', channel: 'error', message: `Target scope '${String(scope.id)}' is not a workflow scope.` }
    }
    const scopeId = String(scope.id)

    // presentation 身份规则（与前端 presentationIdFor 同构）：main/context → context；workflow → workflow。
    const capability: 'context' | 'workflow' = targetRef.kind === 'workflow' ? 'workflow' : 'context'
    const presentationId = `presentation:${capability}:${scopeId}`
    const renderer = targetRef.kind === 'main' ? 'arrange' : targetRef.kind === 'workflow' ? 'workflow' : 'context-space'

    // scaffold：缺失时以空态创建（version 0，与前端 bridge 同行为）；空 scaffold 无 semantic 变更。
    let presentation = this.presentations.get(projectId, presentationId)
    if (presentation === undefined) {
      const empty: PresentationStateV0 = {
        memberViewIds: [], hiddenViewIds: [], positions: {},
        hierarchy: { parentByViewId: {}, orderByParent: {} },
        presentationEdges: [], pinnedViewIds: [], emphasisByViewId: {},
      }
      try {
        presentation = this.presentations.save(projectId, { presentationId, scopeId, capability, renderer, state: empty, expectedVersion: 0, updatedBy: 'web' })
      } catch {
        presentation = this.presentations.get(projectId, presentationId)
        if (presentation === undefined) {
          return { sourceRef, status: 'failed', channel: 'error', message: `Failed to scaffold presentation ${presentationId}.` }
        }
      }
    }

    // membership（+ 新成员初始 placement）经 curation patch 提交：ChangeSet + CAS + 幂等 receipt。
    for (let attempt = 0; attempt < 2; attempt++) {
      const current = this.presentations.get(projectId, presentationId)
      if (current === undefined) return { sourceRef, status: 'failed', channel: 'error', message: 'Presentation disappeared mid-apply.' }
      // already-member：幂等 skip；带 placement 时纯位置更新（无 semantic ChangeSet，补充冻结 §7）。
      if (current.state.memberViewIds.includes(sourceRef.id)) {
        const placementApplied = placement !== undefined && this.#applyPlacementOnly(projectId, presentationId, sourceRef.id, placement)
        return { sourceRef, status: 'skipped', channel: 'already-member', message: `Already a member of ${targetRef.kind} presentation.`, presentationId, memberViewId: sourceRef.id, ...(placementApplied ? { placementApplied } : {}) }
      }
      const receipt = await this.curationCommand.applyPatch(projectId, {
        schemaVersion: 0,
        projectId,
        scopeId,
        createTexts: [],
        relations: [],
        presentation: {
          presentationId,
          expectedVersion: current.version,
          addMembers: [{ entityType: 'view', entityId: sourceRef.id }],
          ...(placement === undefined ? {} : { setPositions: { [sourceRef.id]: placement } }),
        },
        actorKind: 'web',
      })
      if (receipt.applied) {
        return {
          sourceRef, status: 'applied', channel: 'presentation-membership',
          message: `Added to ${targetRef.kind} presentation${placement === undefined ? '' : ' (placement committed)'}.`,
          presentationId, memberViewId: sourceRef.id,
          ...(receipt.changeSetId === undefined ? {} : { changeSetId: receipt.changeSetId }),
          ...(placement !== undefined ? { placementApplied: true } : {}),
        }
      }
      const error = receipt.failedStep?.error ?? 'unknown'
      if (!error.includes('STALE_PRESENTATION_VERSION')) {
        return { sourceRef, status: 'failed', channel: 'error', message: `Curation patch failed: ${error}` }
      }
      // STALE：一次重试（重读版本再提交；连续冲突交还前端按 409 语义处理）。
    }
    return { sourceRef, status: 'failed', channel: 'error', message: 'STALE_PRESENTATION_VERSION: concurrent presentation writes, retry rejected.' }
  }

  /** 纯位置更新（无 semantic ChangeSet）：already-member 的 move/focus 通道。 */
  #applyPlacementOnly(projectId: string, presentationId: string, viewId: string, placement: Placement): boolean {
    if (this.presentations === undefined) return false
    const current = this.presentations.get(projectId, presentationId)
    if (current === undefined) return false
    try {
      this.presentations.save(projectId, {
        presentationId,
        scopeId: current.scopeId,
        capability: current.capability,
        renderer: current.renderer,
        state: { ...current.state, positions: { ...current.state.positions, [viewId]: placement } },
        expectedVersion: current.version,
        updatedBy: 'web',
      })
      return true
    } catch {
      return false // CAS 冲突：纯位置失败不阻塞 membership 结果，前端可重试
    }
  }

  /** conversation_context relation：source=conversation artifact 端点，target=实体端点（施工单 §13 P0-D4 方向）。 */
  #applyConversationContext(projectId: string, sourceRef: AssemblySourceRefV1, targetRef: Extract<AssemblyTargetRefV1, { readonly kind: 'conversation' }>): AssemblyApplyItemResultV1 {
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
      return { sourceRef, status: 'applied', channel: 'relation', message: `conversation_context bound (changeset ${changeSet.id}).`, changeSetId: changeSet.id }
    } catch (error: unknown) {
      return { sourceRef, status: 'failed', channel: 'error', message: error instanceof Error ? error.message : String(error) }
    }
  }
}