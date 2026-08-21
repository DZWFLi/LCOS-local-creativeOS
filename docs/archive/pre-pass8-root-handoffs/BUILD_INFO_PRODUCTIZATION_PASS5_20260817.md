# LCOS Fullstack Productization PASS5 · 2026-08-17

## 结论

本轮基于 `PRODUCTIZATION_S4_S10_AUDIT_20260817.md` 对上传全栈包实施 S2 遗债修复与 S4–S10 产品化补洞。

当前结论：

- **S2 遗债：已修源代码 + 新增 browser regression E2E，待完整环境跑。**
- **S4：代码闭合。**
- **S5：代码闭合。审计所说“Proposal 链完全缺失”已过时，仓库已有 ContextProposalStore/MCP/Web 底座，本轮接实 local Agent producer。**
- **S6：代码闭合，新增 durable ImportBatchRef truth。**
- **S7：代码闭合，Feedback 仅作为 Agent Result → Revision Upgrade。**
- **S8：代码闭合，新增低频 fail-closed Boundary Evaluator。**
- **S9：代码/决策闭合，建立 legacy/internal census + CLI snapshot commands。**
- **S10：Release Gate 已建立，但当前上传切片无法执行 full gate / real Codex harness，不能宣布 Release PASS。**

## S2｜Context 创建持久化遗债

根因：`appendExactPresentationMembers(...)` 使用 stale React `nodes` closure 过滤刚刚通过 Core 创建的 Context view/container。新 Context 尚未进入浏览器闭包，因此 presentation mutation 把它错误排除，表现为菜单动作成功但 Context Graph 无 dot。

修复：

- 浏览器不再用 stale local closure 拒绝 freshly persisted view id；
- Core 继续负责 ID truth/validation；
- 新增 `tests/e2e/context-create-from-selection.spec.ts`：创建 → 切 Context → reload → 仍存在。

## S4｜SurfaceAgentNode 真局部 Agent

- Context / Workflow only；主画布不恢复 Agent Node；
- 每个 local anchor 持有稳定 session id；
- submit 进入真实 Run / Continuity 主链；
- Run 冻结当前 Context/Workflow selection 作为 context artifacts；
- UI 展示 status / reply summary / error；
- 支持 read/poll run review；
- Context Agent prompt 明确使用 Context Proposal MCP，不直接 apply Context command；
- “刚导入这一批”走 durable ImportBatchRef MCP，不猜时间戳。

## S5｜Context Agent → Proposal Producer

已有可复用底座：

- `ContextProposalStore`
- Context proposal Core routes
- MCP `propose_lcos_context_change`
- Web Proposal review surface

本轮：

- Context local Agent 被约束为 proposal producer；
- Review affordance 收成 Keep / Modify / Reject；
- Modify 不改写旧 Proposal truth，而是让 Agent 重读 ActiveContext 并创建新 Proposal。

## S6｜ImportBatchRef

新增 authoritative durable batch truth：

- contracts：`ImportBatchRefV1` / status / source kind / record request；
- metadata schema migration **v36**：`import_batches`；
- Core：record/get/latest/list routes；
- Web client；
- file drop / directory / archive import 统一记录 batch；
- Capture direct project path 同样记录 batch；
- MCP：`get_lcos_latest_import_batch` / `get_lcos_import_batch`；
- Skill 明确禁止 Agent 用时间戳猜“刚导入这一批”；
- idempotent retry + conflict test。

## S7｜Feedback / ChangeSet → Revision Upgrade

- 新 `RevisionUpgradeDialog`；
- 只有 accepted/completed Agent result 才出现入口；
- 人工普通文件编辑不获得这条入口；
- 用户反馈创建 managed Feedback artifact；
- 调用现成 `prepareRevisionWorkflow`；
- 新 Run 带 feedback/decision/change context 进入下一轮 Revision。

## S8｜Boundary AI Evaluator

新增：

- `BoundaryEvaluatorRequest/Result` contract；
- Local Core utility-model evaluator；
- Context / Workflow 两套 judgement criteria；
- confidence threshold；
- timeout / provider unavailable 均 fail closed；
- 不落 Project Truth；
- GUI 仍保留 cooldown + new evidence 门，仅通过门后做一次低频 evaluator；
- evaluator false 时保持沉默。

## S9｜Legacy / Internal-only 收口

新增 `docs/handoff/SESSION_9_LEGACY_INTERNAL_CENSUS.md`。

关键决定：

- Web realtime authority = `streamProjectEvents`；旧 streams 只留 compatibility；
- GUI Agent plan = `proposeRun`；`validateAgentPlan` 保持 CLI/Agent explicit；
- full graph PUT 只保留 bootstrap/import/recovery/test；
- bridge-task-v1 authoritative；v0 只读/测试兼容；
- IntelligenceProviderService authoritative；旧 alias 仅 compatibility；
- **0.1 不新增 `runs.session_id` 第二份 session truth**；session identity 继续由 SessionContextRef/Continuity 管理；
- CLI 新增 snapshot list/create/compare/branch authoritative commands。

## S10｜Golden Project E2E + Release Gate

新增：

- `scripts/productization-s10-release-gate.mjs`
- `npm run check:0.1:deterministic`
- `npm run check:0.1:release`
- `docs/handoff/SESSION_10_GOLDEN_PROJECT_RELEASE_GATE.md`
- `docs/handoff/SESSION_10_REAL_HARNESS_EVIDENCE_TEMPLATE.md`

Deterministic gate 依次执行：

1. lint
2. typecheck
3. unit/contract tests
4. architecture tests
5. integration tests
6. Local Core build
7. Web production build
8. browser E2E
9. full deterministic golden path

Release mode 额外强制：

- real provider = Codex；
- real provider process；
- no scripted/mock worker；
- evidence bind 当前 Git HEAD；
- Project / Session / 2 Runs / Context Proposal / ArtifactReturn / Feedback / Summary / Handoff 均有可追溯 ID；
- Continuity resume PASS；
- Golden user story PASS。

existing scripted full golden 只作为 deterministic foundation，不被冒充成真实产品验收。

## 当前可执行验证

由于上传包没有 `node_modules`，无法运行真实 workspace typecheck/test/build/E2E。

本环境已验证：

- changed TS/TSX syntax transpile：**24 / 24 PASS**；
- `tools/lcos-agent/cli.mjs`：`node --check` PASS；
- `tools/lcos-agent/mcp-server.mjs`：`node --check` PASS；
- `scripts/productization-s10-release-gate.mjs`：`node --check` PASS；
- `apps/web/src/interaction-system.css`：PostCSS parse PASS；
- `package.json`：JSON parse PASS。

另外实际启动过：

```bash
npm run check:0.1:deterministic
```

结果按预期在第一项 `lint` 即停止：`oxlint: not found`（exit 127），与当前上传包缺少 `node_modules` 一致。Gate 本身能正常启动并正确 fail-fast。

这些只证明 source syntax / structure，没有资格替代完整工程 Gate。

## 当前真正缺的东西

不是继续写 S4–S9 功能，而是完整工程运行条件：

1. 带 `node_modules` / 可联网 `npm ci` 的真实 monorepo worktree；
2. 可运行的真实 `codex` provider process / Harness；
3. fresh real-harness evidence，绑定应用 PASS5 后的当前 Git HEAD。

因此 S10 当前 Verdict：**UNREACHABLE IN UPLOADED SLICE**。

下一步 Codex 只需执行 `CODEX_MINIMAL_SUPPLEMENT_REQUEST_S10_20260817.md`，无需重新设计前述功能。
