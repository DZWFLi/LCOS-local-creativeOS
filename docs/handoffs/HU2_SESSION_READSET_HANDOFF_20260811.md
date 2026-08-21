# HU-2 Handoff｜Session Read-Before-Write

## Status
COMPLETE（Remaining debt: NONE）

## Completion Audit（对照 03_HU2 §15）

1. [x] **SessionReadSet module** — `apps/local-core/src/session-read-set.ts`；LRU（max 200 sessions / 500 leases）；测试 `hu2-session-read.test.ts`
2. [x] **full-read-only lease** — `routes/curation.ts:57-73`：`readMode='full'` 且结果/节点均未截断才 `recordFullRead`；search/snippet/preview 不记录
3. [x] **CLI --session** — `curation-query.mjs`（`lcos node read --session S --full`）+ `curation-command.mjs`（`lcos node update-text --session S`）
4. [x] **Agent update requires lease** — `routes/curation.ts:180`：无 lease → 409 `NO_READ_CURRENT_REVISION`（含 artifactId/currentRevisionId/reread 指引）；不自动帮读
5. [x] **stale error clear** — `routes/curation.ts:185`：lease rev ≠ current → 409 `STALE_ARTIFACT_REVISION`（含 leased/current/指引）
6. [x] **restart reread** — 测试 6：重启后 lease 丢失 → 409 NO_READ → reread full → 成功
7. [x] **GUI direct edit CAS** — 用户直编不带 sessionId 走 `reviseManagedTextArtifact` 内部 `commitManagedTextRevision` base-revision CAS（乐观并发）
8. [x] **search/preview negative tests** — 测试 2/3：未 full read / preview 模式 → 拒绝

## Discovered Debt（本次追问/审计发现并修复）

- **Previous claim**：无（Session 首次审计）
- **Missing item**：`commitManagedTextRevision` 只更新 `artifacts.current_revision_id`，不更新 `artifact_views.revision_id` → view 永远指向最初 revision → readViews 返回旧 revision → lease 恒 stale
- **Why missed**：revise 语义只关注 artifact 层，view 指针未纳入变更面
- **Fix**：`metadata-repository.ts` commit 事务内同步 `UPDATE artifact_views SET revision_id=? WHERE artifact_id=?`
- **Regression evidence**：hu2 测试 4/5（external edit stale / reread heal）修复前失败、修复后全过；全量 348 通过

## Repo census / behavior before / Huabu references / LCOS-native decisions

- before：Agent update 只依赖 revise 内部 base check，无"先 full read"门槛；view revision 指针分裂
- Huabu：expected revision 冲突 → nothing written（ADAPT：用 LCOS ArtifactRevision 表达，lease 为 ephemeral LRU，重启丢是特性）
- LCOS-native：不造 AgentDocumentVersion、不落 DB（Context relevance ≠ write authorization，复用 §11）

## Files changed

- `apps/local-core/src/session-read-set.ts`（新增）
- `apps/local-core/src/routes/curation.ts`（read lease + update 校验）
- `apps/local-core/src/server.ts` / `compose.ts`（注入）
- `apps/local-core/src/metadata-repository.ts`（view revision 跟随 current）
- `tools/lcos-agent/commands/curation-query.mjs` / `curation-command.mjs`（--session/--full）
- `apps/local-core/tests/hu2-session-read.test.ts`（新增 6 用例）

## Failure semantics

- 无 lease → 409 NO_READ（不自动帮读）
- stale lease → 409 STALE（不覆盖用户修改）
- restart → lease 消失 → 必须重读

## Restart / reload evidence

- 测试 6：真实 server 重启（同 DB 新实例）→ 旧 lease 拒绝 → reread heal

## Real acceptance evidence

- 6 个 HTTP 全链路用例全过；全量 core 70 文件 / 348 用例全过

## Explicitly NOT implemented

- 持久化 lease（协议明确 ephemeral）
- 跨 session lease 共享（不允许）

## Remaining debt
NONE

## Commit

见 git log。

