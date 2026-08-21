# Phase 0/1 Handoff：Contracts 冻结 + Workspace Membership 真相 + Run Proposal

> 日期：2026-08-03
> 分支：`codex/backend-hardening-20260802`
> 基线：`f3c6af2` → 合并红区树（`015d1d2`）→ 本批 `55414a5`
> 依据：`docs/design/LCOS_PRODUCTION_INTERACTION_CONSOLIDATION_CONSTRUCTION_PLAN_20260803.md` Phase 0/1

## 变更摘要

按施工计划 Phase 0/1（Buddy 主）完成后端与接口层：

1. **红区树合并**：`codex/redzone-20260803`（RunEvent v10、run cancel、托盘 v1、picker 中文修复、Host 自愈）已并入 mvp 主线，无冲突。
2. **Contracts 冻结**：`CreateRunProposal / RunProposalResult / RuntimeProviderStatus / WorkspaceMembership` 进入 `packages/contracts`，领域类型只存 `packages/domain`（禁复制）。
3. **Workspace Membership 真相（v11 迁移）**：新增 `workspace_memberships` 表（多对多、UNIQUE、view 级联删除），仓库 add/remove/move/list + 项目级查询；HTTP CRUD + CLI + MCP 对齐。
4. **Run Proposal 服务（6.2）**：确定性规则版 `proposeRun`——意图推断、Result Policy 默认值、一行可见摘要、歧义最小提问；无歧义 0 问题。
5. **Domain Guard（6.3）**：analyze/create 携带修改目标直接拒绝；revise 结果去向只允许 per-target Draft；analyze/create 的 Result Policy 白名单；`resultPolicy` 持久化到 Run（v11 加列）。
6. **Provider 状态（7.3/7.2 Gate）**：Bridge kernel 补 `get_capabilities` MCP 工具；`GET /runtime/providers` 返回 workbuddy/codex/auto 状态，零点击 executor 未证明前一律 `manual`（不假装 Ready）。
7. **前端接口对齐**：web client 新增 `workspaceMemberships / addWorkspaceMembers / removeWorkspaceMember / moveWorkspaceMember / proposeRun / runtimeProviders`，类型直接引 contracts。

## 修改文件

- `packages/domain/src/index.ts`：`WorkspaceMembership`、`WorkspaceMembershipSource`、`RunResultPolicy`、`Run.resultPolicy?`
- `packages/contracts/src/index.ts`：Proposal/Provider/Membership 契约 + re-export
- `apps/local-core/src/metadata-repository.ts`：v11 迁移（memberships + runs.result_policy）、Membership CRUD、run 读写 resultPolicy
- `apps/local-core/src/runtime-proposal-service.ts`（新增）：确定性 Proposal
- `apps/local-core/src/runtime-adapter.ts` / `bridge-mcp-client.ts`：`getCapabilities`、`providersStatus`
- `apps/local-core/src/runtime-application-service.ts`：`resultPolicy` 入参 + 持久化 + intent/target/resultPolicy Guard + `providers()`
- `apps/local-core/src/server.ts`：`POST /projects/:id/runs/propose`、memberships CRUD 路由、`GET /runtime/providers`
- `tools/light-bridge-kernel/src/lcos_bridge/transport/http_api.py`：`get_capabilities` 工具
- `apps/web/src/runtime/localCoreClient.ts`：六个新方法
- `tools/lcos-agent/cli.mjs` / `mcp-server.mjs`：workspace list/add/remove/move、run propose、providers + 对应 MCP 工具
- 测试：membership 迁移/去重/移动/级联、proposal 6 例、HTTP 三契约、应用 Guard/持久化；schemaVersion 断言 10→11

## Contract / Schema 变化

- `PRAGMA user_version` 10 → 11（additive）：`workspace_memberships` + `runs.result_policy`
- 无破坏性变更；legacy 链（v1–v6）仍止于 v8
- `focused_node_ids` 保持“焦点”语义，**未**迁入 Membership（见 Deviations）

## 用户步骤前后对比

```text
Before: 节点归属只有前端 workspaceIds 派生值；Run 只能手填 intent/target；Provider 状态不可读
After:  Workspace 成员有单一真相 API；发送前可 propose 一行摘要并纠正；Provider 可用性发送前可见
```

## 真实测试命令与结果

- `npx vitest run apps/local-core/tests apps/web/tests tests/architecture tests/integration`：78 文件 / 382 全绿
- `npm run typecheck`：4/4 全绿；lint 仅存量 warning
- 真实冒烟（独立端口 Core+Bridge，中文项目名）：`PHASE0_SMOKE_OK`
  - propose → `intent=analyze`，摘要“将参考 1 项，由 Auto 分析并直接回复。”
  - members add=1 / list=1 / remove 200
  - providers → workbuddy:manual, codex:manual, auto:manual

## GUI 证据

无（UI 视觉细化由前端接手；web client 接口已就绪）。

## CLI/MCP 证据

- CLI：`lcos workspace list/add/remove/move`、`lcos run propose`、`lcos providers`（已实现，随冒烟链走同一 HTTP 契约）
- MCP：`list_lcos_workspace_members / add_lcos_workspace_members / remove_lcos_workspace_member / move_lcos_workspace_member / propose_lcos_run / list_lcos_runtime_providers`

## 未完成

- Context Composer / Shelf 前端（Phase 2，UI 接手）
- Provider 零点击 executor 真实 E2E（未证明，状态保持 manual）
- `.lcosproj` 工程文件（DZ-PROJ-08~11，未做）
- Revision Compare 数据、Session Summary、Workspace State 快照（Phase 4）
- 模型版 Proposal（当前为确定性规则）

## 风险与回滚

- Membership 为纯新增表；回滚 reverts 后旧代码忽略新表即可
- `runs.result_policy` 为 nullable 列，旧读路径不受影响
- 不自动 Push；本批独立提交，可按需 revert `55414a5`

## Dz Requirements Covered

| Requirement ID | 状态 | 真实实现 | GUI 证据 | Core/CLI/MCP 证据 | E2E | 未完成 |
|---|---|---|---|---|---|---|
| DZ-CORE-06 | 施工中 | 单一真相迁移/Guard/真实错误 | — | 单元+冒烟 | HTTP 真实链 | 浏览器链 |
| DZ-PROJ-01 | 真实完成 | picker Base64 中文修复（前批） | 无（需人工） | 单元+冒烟 | 路径 round-trip | 人工确认 |
| DZ-WS-01 | 真实完成 | workspace_memberships 正交多对多 | — | Repository/HTTP/CLI/MCP | 冒烟+测试 | UI 消费 |
| DZ-WS-02 | 真实完成 | add API（多 view 批量） | — | 同上 | 同上 | UI 入口 |
| DZ-WS-03 | 真实完成 | remove/move/list 全链 | — | 同上 | 同上 | UI 入口 |
| DZ-WS-05 | 施工中 | 成员真相完成；Context Set 产品语义 | — | 同上 | 同上 | Workspace 范围 UI |
| DZ-WS-07 | 真实完成 | UNIQUE(workspace,view) 多对多 | — | 测试 | 测试 | — |
| DZ-RUN-09 | 真实完成 | 三 Intent 显式必填+平等 | — | 既有+Guard 测试 | 冒烟 | — |
| DZ-RUN-10 | 真实完成 | analyze/create 禁 Target；revise 只 Draft | — | Guard 测试 | 测试 | — |
| DZ-RUN-11 | 施工中 | Proposal 拒绝 Reference 目标 | — | 测试 | 测试 | Source/Managed 字段 |
| DZ-RUN-12 | 真实完成 | proposeRun 一行摘要+用户可纠正 | — | 单元+HTTP | 冒烟 | 模型版 |
| DZ-RUN-13 | 真实完成 | 歧义 0/1 问 | — | 单元 | 测试 | — |
| DZ-RUN-14 | 真实完成 | contextItems/editTargets 分离契约 | — | 契约+测试 | 冒烟 | — |
| DZ-RUN-18 | 施工中 | 确定性归纳；模型未接 | — | 单元 | 冒烟 | 模型判断源 |
| DZ-AGENT-01 | 施工中 | Project/Workspace/Run/Proposal MCP | — | MCP 工具 | HTTP 冒烟 | Canvas/Revision 全套 |
| DZ-AGENT-02 | 施工中 | CLI 核心动词对齐 | — | CLI 命令 | HTTP 冒烟 | 剩余动词 |
| DZ-AGENT-09 | 真实完成 | 同一 Contracts/Domain | — | 类型共享 | — | — |
| DZ-RT-01 | 真实完成 | Launcher 三服务（前批） | 实测 | — | 冒烟 | — |
| DZ-RT-10 | 真实完成 | 签名清扫不杀非 LCOS（前批） | — | 实测 | — | — |
| DZ-REV-04 | 真实完成 | Draft+Accept 永写新版本（前批） | — | Golden Path | 真实链 | — |
| DZ-DEV-10 | 真实完成 | 小提交/不 Push | — | git log | — | — |

## Dz Requirements Not Touched

- DZ-PROJ-02~07（导入/目录/五步流程——部分依赖 UI）
- DZ-PROJ-08~11（.lcosproj 工程文件）
- DZ-DATA-01~13（格式/预览视觉）
- DZ-WS-04/06/08~15（自动归属/缩放/直接操作）
- DZ-RUN-01~08/15~17（Composer/Shelf/右栏）
- DZ-REV-01~03/05~11（版本溯源/过程投影）
- DZ-AGENT-03~08/10（Skill 一致性/零点击/浏览器上下文）
- DZ-RT-02~09（托盘 UX/Harness 细节）
- DZ-UX-01~08（UI 可发现性）
- DZ-DEV-01~09（流程习惯）

## Deviations Requiring Approval

1. **focused_node_ids 未迁入 Membership**：按 5.3 语义“焦点≠成员”，避免把历史焦点冒充成员关系；如需把旧数据按 `added_by='user'` 迁入，需 Dz 批准后补一次性迁移。
2. **Provider 一律 manual**：零点击 executor E2E 未证明，按 7.2 不显示 Ready；批准口径 = 未证明前保持 manual。
3. **Propose 为确定性规则**：6.2 允许无模型时确定性兜底；模型版后续替换判断源，契约不变。

---

_Codex 2026-08-03，结论基于 382 测试全绿 + 真实冒烟。_
