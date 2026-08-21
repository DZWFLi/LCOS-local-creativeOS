# HU-1B Handoff｜Composite Mutation + Reorganize Safety

> 日期：2026-08-11
> 施工包：02_HU1_MUTATION_SAFETY_CHANGE_REVIEW.md（§9-§14）

---

## Completed

1. **Mutation Change Sets**（§9-§10）：`mutation_change_sets` 表（v31）；`MutationChangeSetV1`（changes/inverse/touchedKeys/appliedFingerprint/status）；Change Item 三型（presentation_state / relation_upsert / relation_delete——relation_delete 带完整关系快照用于恢复）。
2. **Safe Revert**（§11）：`MutationSafetyService.revert` 先做 fingerprint 检查（presentation 当前 version ≠ applied 后 version → blocked；relation 存在性不符 → blocked），全部安全才执行 inverse；任何 stale 返回 `TOUCHED_STATE_CHANGED_AFTER_APPLY`，绝不覆盖用户后来修改。
3. **Reorganize 移除 Artifact hard delete**（§12）：broad apply 不再执行 `deleteArtifact`；`artifactDeleteCandidates` 保留为 preview 提示（destructive 标记仍在），真正删除需用户显式独立动作（后续接独立 endpoint）。
4. **Reorganize rollback 走 ChangeSet**（§13）：apply 时 presentation/relations 全部记入同一 ChangeSet（change_set_id 关联 proposal，v32）；rollback 调 safe revert，stale 时整体 blocked（不是半回滚）。

## Huabu mechanism referenced

- expected revision 冲突 → nothing written（对应 fingerprint 检查）
- inverse delta + touched fields fingerprint + 当前状态安全才 revert

## LCOS-native design decision

- 不用 Promise mutex / sidecar 文件：全部落 SQLite（change set 是 technical audit 表，不是 Domain Entity）
- Artifact hard delete 从 Reorganize 移除：与 Doctrine"destructive 必须单独确认"一致

## Files changed

- `packages/contracts/src/curation-patch.ts`（MutationChangeItemV1 / MutationChangeSetV1）
- `packages/contracts/src/reorganize.ts`（changeSetId 可选字段）
- `apps/local-core/src/mutation-safety-service.ts`（新增）
- `apps/local-core/src/metadata-repository.ts`（v31 change sets + v32 change_set_id 列 + CRUD）
- `apps/local-core/src/reorganize-service.ts`（apply 去硬删除 + change set 记录 + safe rollback）
- `apps/local-core/src/compose.ts`（装配 MutationSafetyService）
- `apps/local-core/tests/reorganize-service.test.ts`（7 用例：新增 destructive 不删、stale blocked、change set restore）

## Contracts changed

- `MutationChangeItemV1` / `MutationChangeSetV1`（新增）
- `ReorganizeProposalV0.changeSetId?`（新增可选）

## Migration

- SQLite user_version 30 → 32（v31 change sets；v32 reorganize_proposals.change_set_id）

## Persistence semantics

- ChangeSet 与 receipt 一样跨重启持久；rollback 依据持久化 fingerprint

## Concurrency semantics

- fingerprint = 对象当前版本/存在性；rollback 前重读，不一致即拒绝

## Failure semantics

- stale → 返回 `TOUCHED_STATE_CHANGED_AFTER_APPLY`，不执行任何 inverse
- proposal 状态保持 applied（不假装回滚成功）

## Real acceptance

- reorganize 7 用例 + curation-receipt 5 用例全过
- Core 全量：68 文件 / 337 用例全过

## Negative tests

- apply 后用户再改 presentation → rollback blocked
- destructive candidates 不导致 artifact 删除（artifact 仍存在）

## Explicitly NOT copied from Huabu

- 无文件复制；语义用 SQLite transaction/CAS 原生实现

## Explicitly NOT implemented

- ❌ Text FS staging（Session 3 / HU-1C）
- ❌ 独立 Artifact delete endpoint（后续接，当前仅从 broad apply 移除）
- ❌ 前端 Reorganize Ghost 显示"建议删除需单独确认"（GUI II）

## Commit

见 git log。

