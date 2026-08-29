import type { ProjectId } from '@local-creative-os/domain'
import { deriveAvailableActions, executionItemNeedsAttention } from '@local-creative-os/contracts'
import type { ExecutionItemCapabilities, ExecutionItemV1 } from '@local-creative-os/contracts'

import type { SqliteMetadataRepository } from './metadata-repository.js'

/**
 * ExecutionItemV1 读模型（S1）：从 canonical Run/ArtifactReturn 数据投影统一执行读模型。
 * 单一来源 Core——本 service 禁止 import bridge-rest-client（S1 gate 红线）。
 * availableActions 由 DEFAULT_CAPABILITIES × run 状态纯推导，不查 Bridge 副本。
 */

/** 当前 Core 声明的控制能力（= S0 census controlOperations 支持矩阵；gate 逐项对照）。 */
export const EXECUTION_ITEM_DEFAULT_CAPABILITIES: ExecutionItemCapabilities = {
  pause: false,
  resume: false,
  cancel: true,
  retry: true,
  answerInput: true,
}

/** 投影上限：Execution Stack 一页足够；不做分页（真实需要时 EXTEND）。 */
const MAX_ITEMS = 50

export class ExecutionItemService {
  constructor(private readonly repository: SqliteMetadataRepository) {}

  project(projectId: ProjectId): readonly ExecutionItemV1[] {
    const runs = this.repository.getProjectRuns(projectId, MAX_ITEMS)
    return runs.map((run) => {
      const returns = this.repository.getArtifactReturns(run.id)
      const firstReturn = returns.at(-1)
      return {
        schemaVersion: 1,
        kind: 'run',
        id: `execution-${String(run.id)}`,
        runId: String(run.id),
        targetRef: run.targetArtifactId === undefined ? null : { kind: 'artifact', artifactId: String(run.targetArtifactId) },
        label: run.shortSummary ?? run.instruction.slice(0, 80),
        state: run.status,
        progress: null,
        needsAttention: executionItemNeedsAttention(run.status),
        availableActions: deriveAvailableActions(run.status, EXECUTION_ITEM_DEFAULT_CAPABILITIES),
        resultRef: firstReturn === undefined ? null : String(firstReturn.targetArtifactId),
        proposalRef: null,
        provider: run.provider,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      }
    })
  }
}
