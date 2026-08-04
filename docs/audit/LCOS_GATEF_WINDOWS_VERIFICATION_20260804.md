# LCOS Gate F 实机验证报告（Windows）

> 日期：2026-08-04 ｜ 分支：`codex/backend-hardening-20260802`（worktree：`.worktrees/mvp-fast-build`）
> 包：`LCOS_Fullstack_GateF_Development_Candidate_20260804.zip`（SHA-256 `E40CB9…F2`，与 .sha256 一致）
> 验证人：Codex（T）

## 1. 结论

Gate F 全栈候选包已作为 MVP 最新版本入库（`bcd7f7a`），并完成 Windows 实机全量验证。
GPT 环境无法跑的部分（npm 质量链、浏览器 E2E、真实 Core 启动）本次全部跑通；
过程中发现并修复 5 类实机问题（见 §4）。**当前基线通过，但真实 `codex exec resume`
会话接单 E2E 仍需要用户配合开一个 CLI 会话才能最终盖章（见 §6）。**

## 2. 入库

```text
bcd7f7a  feat(gatef): integrate LCOS Fullstack Gate F candidate 20260804 as latest MVP version
         56 files changed, 3721 insertions(+), 860 deletions(-)
75565ca  fix(gatef): real-machine verification fixes（11 个文件，见 §4）
```

入库方式：zip 树整体覆盖 MVP worktree（本地运行产物目录不受影响），逐文件哈希比对确认
40 个内容差异 + 8 个新增与 Gate F 报告一致，无意外删除；`git diff --check` 干净。

## 3. 验证链结果（全部在 Windows 实机执行）

| 检查 | 命令 | 结果 |
|---|---|---|
| 依赖 | `npm ci` | PASS（92 包，按新 lockfile） |
| Manifest | `npm run audit:manifest:verify` | PASS（618 个源文件，重新生成后） |
| Gate F 能力门 | `npm run check:gatef-capabilities` | PASS 8/8 |
| Lint | `npm run lint` | PASS（仅存量 warning） |
| Typecheck | `npm run typecheck` | PASS（web/local-core/domain/contracts） |
| 单测 | `npm run test` | PASS 381/381（web 130 + local-core 242 + domain 5 + contracts 4） |
| 架构 | `npm run test:architecture` | PASS 48/48 |
| 集成 | `npm run test:integration` | PASS 5/5 |
| 构建 | `npm run build` + `npm run build:local-core` | PASS（web 1.2MB chunk 仅体积警告） |
| Web smoke | `npm run smoke` | PASS |
| Bridge | pytest（venv） | PASS 32/32 |
| Core 真实 HTTP | `node scripts/gatef-core-smoke.mjs` | PASS 9/9（schemaVersion 14、CAS、短轮询、Draft、Proposal、Session、Plan Guard） |
| 全链 Golden Path | `npm run test:golden:full` | PASS（revise/analyze/create/cancel/codex claim-by-id/checkpoint/重启恢复） |
| 浏览器 E2E | `npm run test:e2e`（Playwright） | PASS 7/7 |
| C3 Agent Surface 探针 | `node tests/e2e/agent-surface-probe.mjs` | PASS（提案→卡片→接受→同步 v3） |
| 单点/双击探针 | `node tests/e2e/single-click-probe.mjs` | PASS（1366×768 与 agent 视图；选中/Composer/version=4/Workbench 均正常） |
| 统一终检 | `npm run check:fast` | PASS |

## 4. 实机发现并修复的问题（定向修复，未扩张功能）

1. **web typecheck 失败**：Gate F 新增的 `validateAgentPlan`/CommandDraft/ProviderSession/cancel
   客户端方法没有补进 `apps/web/tests/runtimeBridge.test.ts` 的 mock。
   修复：补齐 8 个方法。
2. **ActiveContext `afterVersion` 回归**：后端/CLI/MCP 都支持短轮询，但 Gate F 重写
   `localCoreClient.ts` 时把 web 客户端参数丢了，`agentContextSurface.test.ts` 因此失败。
   修复：恢复 `activeContext(projectId, workspaceId?, afterVersion?, signal?)` 并更新调用点。
3. **local-core 单测在干净克隆必挂**：`@local-creative-os/domain` 运行时改为导出 dist，
   但 `npm test` 不先构建 domain（GPT 环境有 dist、我们没有）。
   修复：`apps/local-core/package.json` 增加 `pretest` 先构建 domain。
4. **迁移链 v3/v5 老库升级到 v14 失败**：Gate F 把迁移调度从“老链”改成逐级链后暴露——
   `#migrate_006_from_v5` 建 `runs` 引用 `workspaces` 却没建它；v3/v5 测试 fixture
   是残缺旧库，真实旧库本来有这些表。
   修复：`#migrate_006_from_v5` 补 `CREATE TABLE IF NOT EXISTS workspaces`；
   两个 fixture 补齐真实 v3/v5 schema；构造器迁移失败时关闭 DB 句柄（治 Windows EBUSY）。
5. **.lcosproj 版本停在 13**：测试期望 14，但 `LCOSPROJ_SCHEMA_VERSION = 13` 且 v14 四张新表
   （active_contexts/context_proposals/command_drafts/provider_session_bindings）不在导出/导入清单。
   修复：版本升 14，四张表加入 `PROJECT_TRUTH_TABLES` 与 `PROJECT_TRUTH_DELETE_SQL`。
6. **E2E 自 Core 鉴权后失效**：`9804806` 加了 Bearer 鉴权后，Playwright 直连种子请求没带 token、
   Vite 代理也不注入（环境变量缺失），GPT 环境没跑所以没发现。
   修复：E2E 自洽固定 token（core 进程 + 种子请求 + Vite 代理一致）。
7. **E2E U5 用了已移除的 Base64 目录导入**：Core 返回 410 并指向
   `resource-upload-sessions`。修复：用例改为 建会话 → PUT 文件 → complete 三段式。
8. **MANIFEST.sha256 与仓库不一致**：包内 manifest 引用了 zip 未携带的 `OS项目文档/*`。
   修复：按实际仓库树重新生成（618 文件）并通过校验。

## 5. 浏览器/运行时证据

- 真实浏览器（headless Chromium）验证 `?agent=codex` 同步徽章、提案接受卡片、Run 快照锁定；
- 单点节点在普通视图与 agent 视图均正常（`.selected`、SelectionComposer、ActiveContext v4），
  双击打开 Workbench 正常——此前用户反馈的“单点不行”在当前版本未复现；
- Golden Path 全链含 Core 重启恢复，结果与证据目录见 `scripts/full-golden-path.mjs` 输出。

## 6. 诚实遗留

1. **真实 Codex CLI 会话接单 E2E 未盖章**：当前验证中 Codex 场景是
   `claim-by-id` 真实合同链路（脚本模拟 Agent），不是 Windows 上真实
   `codex exec resume` 会话。需要用户开一个项目目录 CLI 会话 → 起看门狗 →
   GUI 发 Run → 确认会话收到提示并完成认领/执行/提交。
2. **WorkBuddy 不在普通 UI 宣传**（Gate F 边界，保持）。
3. **waiting_input 未做**（Bridge 协议无此状态，属红区）。
4. 单击时 console 可能出现一次 409：CAS 设计内的正常竞态，App 已处理
   （冲突态→重拉→synced），Chrome 对 4xx 的默认 console 记录不属于错误。
5. lint 仍有存量 warning（未使用的变量/依赖数组），非本次范围。
6. `dev:open` 前台不返回（launcher 常驻），但栈与浏览器已正常拉起；
   用 `npm run dev:status` 确认即可。

## 7. 复跑方式

```powershell
cd "E:\Codex 项目\OS开发\.worktrees\mvp-fast-build"
npm ci
npm run audit:manifest:verify
npm run check:gatef-capabilities
npm run check:fast
npm run smoke
npm run test:golden:full
npm run test:e2e          # 需先 npm run dev:stop 保证端口空闲
npm run dev:open
node tests/e2e/agent-surface-probe.mjs
node tests/e2e/single-click-probe.mjs
```

## 8. 回滚

- `bcd7f7a`（包入库）与 `75565ca`（修复）均为独立提交，可 `git revert` 或
  `git reset --hard 75565ca~2`（分支内，未推送）；
- 未修改任何用户真实数据库；Golden Path / E2E 全部使用临时目录。

