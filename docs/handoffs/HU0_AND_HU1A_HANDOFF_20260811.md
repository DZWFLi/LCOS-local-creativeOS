# HU-0 Audit Pin + HU-1A Receipt & Prevalidation Handoff

> 日期：2026-08-11
> 施工包：LCOS_HUABU_CODE_LEVEL_EXPLOITATION_PACK_20260811（00_MASTER + 02_HU1 + 09 切片）
> 分支：`research/huabu-gap-audit-20260811`

---

## Session 0｜Audit Pin

- LCOS HEAD：`21a754d`（freeze）+ 本轮新提交
- pre-Huabu tag：`pre-huabu-audit-2026-08-11`（已推送 GitHub：DZWFLi/LCOS-local-creativeOS）
- Huabu SHA：`2d3618b559576cbdd0fe2a58a7b200a84a6f4d09`（2026-08-11 14:57:57 +0800），记录于 [HUABU_AUDIT_SOURCE_SHA.txt](../provenance/HUABU_AUDIT_SOURCE_SHA.txt)
- Huabu 本地参考：`E:\Codex 项目\huabu-reference\Huabu-current`（浅克隆 depth 1，1537 文件完整当前树；完整历史克隆在本机网络超时，当前树足够审计）
- `.research/` 已加入 gitignore（协议 §9）；因网络原因 .research/huabu 未建成，以外部参考目录替代并在 SHA 文件中注明

## Session 1｜HU-1A Receipt + Prevalidation

### Repo census

- `apps/local-core/src/curation-command-service.ts`：`#receipts = new Map()`（内存），applyPatch 边做边 fail
- `apps/local-core/src/metadata-repository.ts`：已有 BEGIN IMMEDIATE / CAS / MutationBatch

### Huabu mechanism referenced

- 持久 receipt（operationId 幂等跨重启）
- 执行前完整 prevalidation（"先读完所有 target、先验证所有 clientRef、先验证 relation endpoint、先验证 presentation version，任何失败 0 mutation"）

### LCOS-native design decision

- 不引入 Promise mutex / sidecar 文件：receipt 落 SQLite（`curation_operation_receipts` v30），热缓存 Map 仅提速
- 预验证做在 Application layer（CurationCommandService），不新开事务层（composite transaction 属 Session 2/HU-1B）

### Files changed

- `apps/local-core/src/metadata-repository.ts`（v30 migration + saveCurationReceipt/getCurationReceipt）
- `apps/local-core/src/curation-command-service.ts`（DB 幂等 + 全量预验证 + receipt 落库）
- `apps/local-core/tests/curation-receipt.test.ts`（新增 5 用例）
- `apps/local-core/tests/curation-command.test.ts`（1 个既有断言更新：CAS 冲突现在在 validate 阶段拦截、completedSteps 为空——即 0 mutation 新语义）
- `docs/provenance/HUABU_AUDIT_SOURCE_SHA.txt`、`.gitignore`（.research/）

### Contracts changed

- 无契约变更（沿用 `CurationPatchReceiptV0`；receipt_json 原样持久化）

### Migration

- SQLite user_version 29 → 30：`curation_operation_receipts` + project/created_at 索引

### Persistence semantics

- receipt 跨重启稳定：同 operationId 重试返回同一 receipt（成功与失败都持久化）
- 失败的 receipt 也落库：同 operationId 修正输入后重试不会重新执行（防重复 mutation）

### Concurrency semantics

- 预验证读取当前状态（presentation version / entity 存在性）；执行路径沿用现有单写语义（CAS）

### Failure semantics

- 预验证失败 = 0 mutation（createText/relation/presentation 都不执行）
- 执行期失败语义不变（Session 2 的 composite transaction 负责消除半套 mutation）

### Real acceptance

- 5 个新测试全过：跨重启幂等（重试不重复建节点）、重复 clientRef 0 mutation、未知 relation 端点 0 mutation、stale presentation 0 mutation、失败 receipt 持久化
- Core 全量：68 文件 / 335 用例全过

### Restart/reload evidence

- 测试 1：新 repository + 新 service 实例（模拟重启）重放同 operationId → 返回同一 receipt，节点数保持 1

### Negative tests

- duplicate clientRef / missing relation endpoint / stale presentation version / bad scope 全部走预验证失败路径

### Architecture tests

- 本轮未加架构测试（Session 9 统一跑）

### Explicitly NOT copied from Huabu

- 无整文件复制；机制语义（幂等 receipt、read-before-write 精神）为 LCOS SQLite 原生实现

### Explicitly NOT implemented

- ❌ Composite transaction（text FS + DB 原子性）→ Session 2（HU-1B）
- ❌ ChangeSet / inverse delta / safe revert → Session 2
- ❌ Reorganize remove hard delete → Session 2
- ❌ ReadSet（HU-2）→ Session 4

### Commit

见 git log（本轮提交将包含 HU-0 + HU-1A）。

