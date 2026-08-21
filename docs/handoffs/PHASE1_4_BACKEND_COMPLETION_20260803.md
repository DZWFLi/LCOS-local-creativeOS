# Phase 1–4 后端补完 Handoff（v12）

> 日期：2026-08-03
> 分支：`codex/backend-hardening-20260802`
> Commits：`55414a5`（Phase 0/1 契约+Membership+Proposal）、`e25cfc9`（本批 v12 后端补完）
> 依据：`docs/design/LCOS_PRODUCTION_INTERACTION_CONSOLIDATION_CONSTRUCTION_PLAN_20260803.md`

## 变更摘要

本批完成后端剩余可施工项（Phase 1–4 Buddy 责任），全部 additive 迁移 v12：

1. **Revision Compare**：`GET /projects/:id/revisions/compare?base&head`，文本类文件给行级 diff，非文本给元数据对比；`GET /artifacts/:id/revisions` 列表。
2. **Artifact Inspect（含溯源）**：`GET /artifacts/:id` 返回 Artifact + Revision 列表 + 每个 Revision 的来源 Run（Prompt/Provider）。
3. **Context/Target 控制面**：`GET /projects/:id/artifacts/search?q=`；ActiveContext 增加 `targetArtifactId/targetRevisionId`（PUT 透传 + 投影 `targetArtifact`）；CLI `selection get / context search|add|remove / target set|clear`。
4. **Workspace State（替代孤立 Checkpoint 的产品语义）**：`POST/GET /workspaces/:id/states` + `/states/:id/restore`；快照含成员、固定 Revision、Viewport/Camera、Intent、关联 Run；底层复用 Checkpoints 表（v12 加 `workspace_id` 列）。
5. **Process Projection**：`GET /projects/:id/process-projection`，从既有 Run/Return/Revision/Checkpoint 投影过程节点，不建平行真相。
6. **Session Summary / Handoff**：新表 `session_summaries` + `POST/GET /projects/:id/session-summaries`（标题、摘要、runIds、handoffRef）。
7. **Source/Managed 边界（DZ-RUN-11）**：`artifacts.managed`（v12 列，`.link.md` 自动非受管）；revise 目标必须是受管 Artifact，外部 Reference 直接拒绝。
8. **零点击自动回收**：`RuntimeAutoSyncService`（默认 10s 轮询非终态 Run → sync/ingest），Core 启动即启用，`LCOS_AUTO_SYNC_MS` 可调。
9. **CLI 补齐**：artifact inspect、revision list/compare、process projection、workspace save-state/restore-state、session summarize/list、context/target 命令。

## 修改文件

- `packages/domain/src/index.ts`：`Artifact.managed?`、`Checkpoint.workspaceId?`、`SessionSummary`
- `apps/local-core/src/metadata-repository.ts`：v12 迁移（managed、checkpoint.workspace_id、session_summaries）、listRunsNeedingSync、workspace states、session CRUD
- `apps/local-core/src/runtime-revision-compare-service.ts`（新）、`workspace-state-service.ts`（新）、`process-projection-service.ts`（新）、`runtime-auto-sync-service.ts`（新）
- `apps/local-core/src/active-context-store.ts`：target 字段 + 投影
- `apps/local-core/src/runtime-application-service.ts`：managed Guard
- `apps/local-core/src/server.ts`：8 组新路由
- `apps/local-core/src/index.ts`：AutoSync 启动
- `apps/web/src/runtime/localCoreClient.ts`：10 个新方法 + ActiveContext target 字段
- `tools/lcos-agent/cli.mjs`：15 个新命令
- 测试：v12 迁移/managed/workspace state/session、HTTP 全路由、managed Guard、schemaVersion 12

## Schema 变化

`PRAGMA user_version` 11 → 12（additive）：`artifacts.managed`、`checkpoints.workspace_id`、`session_summaries`。

## 真实测试命令与结果

- `npx vitest run apps/local-core/tests apps/web/tests tests/architecture tests/integration`：78 文件 / 385 全绿
- `npm run typecheck` 4/4；lint 仅存量 warning
- 真实冒烟（独立 Core+Bridge、中文项目）：`PHASE0_SMOKE_OK`
  - search（中文 q）=1；artifact detail revisions=1；revision list=1；compare changed=False/content=True
  - projection kinds=revision；workspace state save/list/restore 200；session save/list=1；target set 投影正确

## GUI 证据

无（UI 由前端接手；web client 接口全部就绪）。

## 未完成 / 阻塞

- **waiting_input（阻塞）**：Bridge kernel 协议无 waiting_input 状态，无法在不扩展 kernel 的情况下做真实问答恢复；需要先扩展 Bridge 协议（状态 + ask/answer）并批准，再施工。
- `.lcosproj` 工程文件（DZ-PROJ-08~11）：需先 ADR 定真相与迁移路径（施工文档 16.7 步骤 1），未做。
- Provider 零点击真 executor E2E：未证明，状态保持 `manual`。
- 模型版 Proposal：当前确定性规则，契约已就绪。
- Revision “基于此版本继续”（GUI 动作）与 Compare 渲染：前端。

## Dz Requirements Covered

| Requirement ID | 状态 | 真实实现 | GUI 证据 | Core/CLI/MCP 证据 | E2E | 未完成 |
|---|---|---|---|---|---|---|
| DZ-REV-01 | 真实完成 | Artifact Inspect 含 Run/Prompt 溯源 | — | HTTP+CLI+冒烟 | 冒烟 | GUI 展示 |
| DZ-REV-02 | 真实完成 | 溯源只读，无原地编辑 | — | 同上 | — | “继续”按钮（UI） |
| DZ-REV-03 | 施工中 | 版本列表/Compare 后端 | — | 同上 | 冒烟 | 完整 GUI 链 |
| DZ-REV-05 | 真实完成 | Process Projection 摘要节点 | — | HTTP+冒烟 | 冒烟 | Canvas 渲染（UI） |
| DZ-REV-06 | 施工中 | Projection 含状态/时间/摘要 | — | 同上 | — | LOD 展示（UI） |
| DZ-REV-07 | 真实完成 | Session Summary 持久化+Handoff 引用 | — | HTTP+CLI+冒烟 | 冒烟 | GUI 入口 |
| DZ-REV-08 | 施工中 | 溯源字段已备 | — | Inspect | — | Canvas LOD（UI） |
| DZ-REV-10 | 真实完成 | 前批 Viewer Registry 统一 | — | — | 探针 | — |
| DZ-WS-08 | 真实完成 | Workspace State 快照（成员/Revision/视口/Run） | — | HTTP+CLI+冒烟 | 冒烟 | 恢复后 UI 落位 |
| DZ-WS-09 | 真实完成 | 检查点产品语义合并为现场/里程碑 | — | 同上 | 冒烟 | UI 文案 |
| DZ-RUN-11 | 真实完成 | managed 边界 + revise 拒绝外部 Reference | — | Guard 测试+HTTP | 测试 | UI 提示 |
| DZ-RUN-12/13/14/18 | 真实完成（确定性） | 前批 Proposal | — | 测试+冒烟 | 冒烟 | 模型版 |
| DZ-AGENT-02 | 施工中 | CLI 覆盖 revision/session/workspace/context | — | CLI | 冒烟 | 剩余动词 |
| DZ-AGENT-05 | 施工中 | Canvas/Workspace/版本控制面后端就绪 | — | HTTP/CLI | 冒烟 | MCP canvas 写工具 |
| DZ-AGENT-10 | 施工中 | AutoSync 自动回收 | — | 服务+测试 | 冒烟 | 零点击 executor |
| DZ-RT-05 | 阻塞 | 零点击需要真 executor | — | — | — | 外部依赖 |
| DZ-RT-08 | 真实完成 | Changed Files 归位链（前批） | — | Golden Path | 真实链 | — |

## Dz Requirements Not Touched

- DZ-PROJ-08~11（.lcosproj，需 ADR）
- DZ-DATA-*（格式/预览视觉）
- DZ-WS-04/06/10~15（自动归属/缩放/直接操作 UI）
- DZ-RUN-01~08/15~17（Composer/Shelf UI）
- DZ-AGENT-03/04/06~08（Skill 一致性/零点击/浏览器上下文）
- DZ-UX-*（全部 UI）

## Deviations Requiring Approval

1. **waiting_input 标阻塞**：Bridge 协议无此状态；不造假实现，需协议扩展批准。
2. **`.lcosproj` 未动**：按文档 16.7 必须先 ADR 定“工程文件 vs 全局库”真相，未获批前不施工。
3. **focused_node_ids 仍不迁移为成员**（沿用上批偏差 1）。
4. **Provider 保持 manual**（沿用上批偏差 2）。

---

_Codex 2026-08-03，385 测试全绿 + 真实冒烟。_
