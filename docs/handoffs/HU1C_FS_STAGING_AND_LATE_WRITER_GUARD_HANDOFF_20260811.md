# HU-1C Handoff｜FS Staging + Orphan Sweep + Late Writer Guard

> 日期：2026-08-11
> 施工包：02_HU1_MUTATION_SAFETY_CHANGE_REVIEW.md（§6/§15/§16 T1-T5）

---

## Completed

1. **Text FS staged revision**（§6）：`createTextArtifact` 改为：写 `.creative-os/staging/<id>.md` → `registerTextArtifactComposite`（fileRecord+artifact+revision+view+workspace membership 一个 BEGIN IMMEDIATE 事务）→ atomic rename 到 `.creative-os/notes/<id>.md`。DB 失败 → 删 staged（不留半套）；rename 失败（罕见）→ 文件留 staging，启动 sweep 归位。
2. **Startup orphan sweep**（§6）：`sweepStagedTextFiles(projectRoot)` 只处理 LCOS staging 命名空间：DB 已提交未归位 → rename 到 notes；无 DB 引用 → 删除。Core 启动时对所有项目执行一次。
3. **Late writer / tombstone guard**（§15）：`assertEntityAlive(projectId, entityType, entityId, contentHash?)`（artifact 带 hash 校验 / note / conversation）；`SemanticIndexService.indexEntity` 提交前调用——entity 已删/已变 → 丢弃结果，不 resurrect。

## Huabu mechanism referenced

- 丢弃"node 已删后到达的晚异步写"
- staged file → commit → finalize / cleanup

## LCOS-native design decision

- 不引入文件锁：staged 文件是 unique immutable path，rename 即 commit 边界
- sweep 只清 LCOS 自己命名空间（.creative-os/staging），绝不扫描删除用户文件

## Files changed

- `apps/local-core/src/metadata-repository.ts`（registerTextArtifactComposite / assertEntityAlive / sweepStagedTextFiles）
- `apps/local-core/src/text-artifact-service.ts`（staged 写入 + rename + DB 失败清理）
- `apps/local-core/src/semantic-index-service.ts`（indexEntity late writer guard）
- `apps/local-core/src/server.ts`（启动 sweep）
- `apps/local-core/tests/hu1c-staging.test.ts`（5 用例）
- `apps/local-core/tests/semantic-search.test.ts`（2 个实体改用真实 note id 适配 guard）

## Contracts changed

- 无（repository/service 内部语义）

## Persistence semantics

- DB 是 Truth；staged 文件是未提交暂存；rename 后才是最终 immutable path

## Failure semantics

- DB 失败 → staged 清理，0 orphan
- rename 失败 → 文件在 staging，sweep 按 DB 引用归位
- late writer → 结果丢弃（indexed=false）

## Real acceptance

- hu1c-staging 5 用例全过（成功路径/DB 失败无 orphan/sweep 删除与归位/guard 拒绝已删与未知类型/semantic 不 resurrect）
- Core 全量：69 文件 / 342 用例全过

## Restart/reload evidence

- 启动 sweep 在 server.start 执行（幂等）；测试 3 模拟"DB 已提交但文件未归位"→ sweep 恢复

## Negative tests

- workspace FK 失败 → 无 orphan 文件
- 已删 artifact 的语义索引提交 → 被丢弃

## Explicitly NOT copied from Huabu

- 无文件复制；语义用 SQLite 事务 + immutable path 原生实现

## Explicitly NOT implemented

- ❌ derived commit guard 全面接入（preview worker 等后续切片/Phase I 补全；semantic 已接）
- ❌ Capture async enrichment 的后台任务（当前 capture 是同步路径）

## Commit

见 git log。

