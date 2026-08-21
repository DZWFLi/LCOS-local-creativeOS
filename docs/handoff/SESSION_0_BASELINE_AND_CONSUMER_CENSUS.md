# Session 0 Handoff｜真实工程基线 Gate + Consumer Census

## Goal

确认 `B-CLOSED-CONVERGENCE`（2026-08-16 包）在真实开发环境的工程红线，并建立 0.1 施工需要接实 / 清理的 consumer 清单。

## Baseline

- branch: `codex/r1-vision-merge-20260812`（worktree：`.worktrees/mvp-fast-build`）
- HEAD: `9569d59` feat(runtime): harden project realtime synchronization
- dirty files before: 收敛包选择性合入未提交（38 modified + 26 untracked，含 B5/B6/收敛代码与文档）
- dirty files after: 与本 Session 开始时一致（Session 0 为只读审计 + Gate，未改业务代码；仅新增本交付文档）

## 全工程 Gate 真实结果

| Command | Result | Evidence |
|---|---|---|
| `npm ci` | PASS | 103 packages / 17s；npm audit：2 vulnerabilities（1 moderate + 1 high） |
| `npm run lint` | PASS | exit 0；仅 warning（web/local-core 大量 unused-vars、react-hooks 等，无 error） |
| `npm run typecheck` | PASS | web + local-core + domain + contracts 全绿 |
| `npm run test` | **FAIL** | web：5 files / 7 tests failed（448 passed）；local-core 86/423 PASS；domain 10 PASS；contracts 6 PASS |
| `npm run test:architecture` | PASS | 20 files / 104 tests |
| `npm run test:integration` | PASS | 1 file / 5 tests |
| `npm run build` | PASS | vite build 成功；仅 chunk >500kB 提示 |
| `npm run test:e2e` | **FAIL** | 5 passed / 12 failed（2.0m） |

## 红线明细（具体到 test / file / route）

### A. 旧 UI 源码契约测试 vs 收敛后界面（7/7 web 失败）

均为「旧契约测试断言已收敛掉的 UI」：

1. `apps/web/tests/productInterfaceFoundation.test.ts` › keeps primary shell and destination controls accessible by name and state
2. `apps/web/tests/v06Phase21Hotfix.test.ts` › focuses the inline selection composer first and the global rail otherwise
3. `apps/web/tests/v06RunConfirmation.test.ts` › launches runs directly from selected context without a technical confirmation page
4. `apps/web/tests/v06RunConfirmation.test.ts` › shows only user decisions and hides internal run parameters
5. `apps/web/tests/v06RunConfirmation.test.ts` › keeps the right rail as workspace/canvas global context
6. `apps/web/tests/v07Integration.test.ts` › keeps canonical Runtime capability gates and imports the v0.7.1 density layer
7. `apps/web/tests/workflowNoSkillRuntime.test.ts` › keeps Selection and Agent as the only start actions

代表例：收敛补丁 §4.3 已删除 Workflow 常驻「交给 Agent」入口，但 `workflowNoSkillRuntime.test.ts` 仍断言源码包含 `onStart?.('agent')`。这些是「B 阶段收敛改 UI，但旧契约测试未同步」造成的红线，不是新运行时回归。

### B. Playwright E2E harness 两处基础设施红线

1. `playwright.config.ts` webServer 只起 `npm run dev:web`（5173）。仅 `tests/e2e/golden-path.spec.ts` 自行 spawn Local Core；`interaction-foundation / new-scene-semantic-drop / scene-creation-semantic / vnext-phase4` 依赖 43121，runner 未起 → `connect ECONNREFUSED 127.0.0.1:43121` + `[data-node-id] >= N` waitForFunction 超时。
2. `golden-path.spec.ts` 自身 3 处失败：`page.goto(..., { waitUntil: 'networkidle' })` 永不满足——R17 `streamProjectEvents` 常驻连接使网络永不 idle → 30s test timeout（112 / 140 / 182 行）。
3. 连带债务：`npm run build` 根命令只构建 web，`apps/local-core/dist/index.js` 停在今天 01:19（早于 B5/B6 合入），E2E spawn 的是旧 dist。

## Consumer Census

| Interface | Consumer | Classification |
|---|---|---|
| `continuityResume` | App.tsx:979（项目打开恢复）、ProjectToolsDialog.tsx:68 | real consumer |
| `continuityResolve` | 仅 CLI `lcos continuity resolve` | internal-only（无 Web GUI consumer） |
| `continuityBind` | 仅 CLI / route | internal-only |
| `continuityAttach` | 仅 CLI / route；未进入真实 Codex 执行链 | **missing consumer（S1 目标）** |
| `continuityReturn` | 仅 CLI / route | internal-only |
| SessionSummary / Handoff producer | continuity-runtime-service.intakeReturn → createContinuityReturnRecord；routes/handoffs | real producer（Core） |
| SessionSummary / Handoff GUI | ContextHistoryRail 接收 `handoffs`，但 App.tsx:5382 固定 `handoffs: []` | **broken consumer（S2 目标）** |
| ContextSnapshot create / compare | compareContextSnapshots（App.tsx:2801） | real consumer |
| ContextSnapshot branch | Core route 存在；GUI 用 `branchContextHistoryToWorkbench`（App.tsx:2749）前端本地重建，未调 `branchContextSnapshot` | **double truth path（S3 目标）** |
| `prepareRevisionWorkflow()` | 仅 client 定义 + route | **missing consumer（S7 目标）** |
| `proposeContextChange()` | 仅 client 定义 + route | **missing consumer（S5 目标）** |
| `SurfaceAgentNode` | CanvasSceneHost（Context/Workflow）→ `requestSurfaceAgentRun`（App.tsx:4685）→ proposeRun → startRunFrom | launcher-like：无 continuity session、reply 不回 Node、邻域=Selection 或整个 Context/Workflow presentation（**S4 目标**） |
| Import / Upload provenance | `observedPath` 全链路存在；无 ImportBatchRef / batchId | **missing（S6 目标）** |
| Boundary hint | boundaryHintState（localStorage 启发式）+ App.tsx:576/599 候选推导；Workflow 反射按 `length >= 2` 判断（App.tsx:626） | heuristic-only，无 ContextDepositEvaluator / WorkflowPatternEvaluator，未接 Utility Model（**S8 目标**） |
| `setAttentionIntent` | 无 Web 调用点 | internal-only / debug |
| `dismissContinuityCandidate` | 无 Web 调用点 | internal-only / debug |
| `validateAgentPlan` | CLI `lcos run validate-plan` → `/projects/:id/runs/validate-plan` | CLI consumer；Web client 方法无调用点 |
| `streamPresentation` / `streamActiveContext` / `streamProjectPresentations` | 无 consumer | legacy（可 deprecate / remove） |
| `streamProjectEvents` | projectRealtime.ts:90 | real consumer（正式路径） |
| `openLcosprojUpload` | App.tsx:5334、ProjectToolsDialog.tsx:115 | real consumer |
| `exportLcosproj` / `inspectLcosproj` / `openLcosproj(filePath)` | 无 Web GUI 调用点；CLI / installer / file-association | keep（CLI / installer 用途） |
| `artifactSearch` | 无 Web GUI 调用点；CLI `lcos context search` 直连 route | keep（CLI 用途） |
| `affinityResolve` | 无 Web 调用点；CLI `lcos affinity resolve` 直连 route | keep（CLI / internal） |

## Acceptance checklist

- [x] 完整工程 Gate 有真实结果（含两个 FAIL 及其明细）
- [x] Consumer census 完成，每个目标接口标出 real / missing / legacy / internal-only
- [x] 任一红项记录到具体 test / file / route（见上）
- [x] 未引用「173/173 static PASS」充当真机证据
- [x] 未开始任何正式 C 功能

## Remaining debt discovered in this Session

1. 7 个 web 旧契约测试未同步收敛后 UI（红线 A）。
2. E2E runner 不启动 Local Core + `networkidle` 与 R17 SSE 互斥 + local-core dist 陈旧（红线 B）。
3. npm audit：1 high + 1 moderate。
4. 收敛包合入本身仍未提交（Session 0 基线即 dirty state）。

## Explicitly not done

- 未修任何红线（Session 0 为 Gate + Census）。
- 未跑 lint 的 warning 清理。
- 未进 Session 1。

## Session 1 是否可直接施工

**否，需先解决以下前置，否则会污染后续链：**

1. 把 B-CLOSED-CONVERGENCE 选择性合入作为基线提交（当前全在 dirty state）。
2. 将红线 A 的 7 个旧契约测试对齐「0.1 冻结产品原则」（改测试，不改已冻结 UI）。
3. 修 E2E harness（runner 统一 spawn Local Core；`networkidle` → 显式 readiness；root build 补 build local-core 或 e2e 前 `build:local-core`）。
4. npm audit 处置决定。

## Risk / rollback point

- 回滚点：HEAD `9569d59`（未提交的合入内容即当前 dirty diff）。
- 风险：在未提交基线上继续 S1，会把「收敛合入」与「S1 改造」混在一个 diff 里，失去可审查边界。

## Verdict

**PARTIAL**

## 后续更新（同日完成四个前置）

Session 0 的四个前置已按序完成并各自收成小提交：

1. 基线提交：`9d8c187`（B-CLOSED-CONVERGENCE 选择性合入 + B6 真机修复）+ `bd255c4`（本 Session 0 文档）。
2. 旧契约测试对齐冻结原则：`628204b`。web 全量 99 文件 / 455 用例 PASS。
3. E2E harness 修复 + 收敛后 UI 契约同步：`8444497`。共享 Local Core spawn/kill（workers:1）、`networkidle`→`domcontentloaded`、e2e 前 `build:local-core`；底部停留带 staging 确认已退役并改锁 dock 语义投送目标。E2E 17/17 PASS。
4. npm audit 处置：`248d593`。nanoid 3.3.18 + postcss 8.5.26（仅传递依赖），0 vulnerabilities。

全链复验：`npm ci`（0 vulnerabilities）/ lint / typecheck / test / test:architecture / test:integration / build / test:e2e 全部 PASS。

Session 1（Codex Continuity 真 Harness 主链）现在可按原计划直接施工。
