# LCOS MVP Continuation Session Handoff

日期：2026-07-30  
Branch：`codex/mvp-fast-build`  
已提交基线：`9eebc87 feat(agent): complete MCP and light bridge merge gate`

## 1. 本 Session 目标

继续完成 MVP 主干合并前收口，不重复已经完成的 Agent Context / Light Bridge
提纯与 Runtime 生命周期开发。

当前优先级：

```text
验收 WorkBuddy MCP 改动
→ 修复遗留测试
→ 真实 LCOS MCP Pull E2E
→ 自包含 Golden Path / Browser E2E
→ 清理测试产物
→ 完整质量链
→ 主干合并评审
```

自动唤醒 Agent 尚未获批实现。本轮只验证 Agent 被调用后可以通过 LCOS MCP 主动
`claim → start → submit → get`，不得偷偷引入 Watcher、常驻 Worker 或自动 Accept。

## 2. 已完成，不要重做

- LCOS 自有 CLI、stdio MCP、Agent Browser URL、ActiveContext。
- Light Bridge Kernel v0.2.0 clean-room 基线。
- Bridge V1 `create / revise / analyze`、SQLite Task Store、REST / MCP / CLI。
- Runtime `Run → Dispatch → Binding → ArtifactReturn → Accept / Reject / Retry`。
- 飞书 Link Reference `.link.md` 元数据与 ContextManifest 注入。
- Commit `9eebc87` 中的 MCP/Bridge/Agent Context merge gate。
- WorkBuddy Task `task_98c07da7` 已 `submit_result`，当前 Bridge 状态 `review`。

## 3. 当前未提交改动

WorkBuddy 交付：

- `packages/skills/lcos-project-context/SKILL.md`
- `tools/lcos-agent/mcp-server.mjs`
- `tools/lcos-agent/.mcp.json.example`
- `tools/lcos-agent/README.md`
- `docs/handoffs/WORKBUDDY_LCOS_SKILL_MCP_FULL_TEST_REVIEW_20260730.md`

Codex 后续收口：

- `apps/web/tests/v07Integration.test.ts`
- `scripts/lcos-mcp-bridge-e2e.mjs`
- `package.json`
- `playwright.config.ts`
- `scripts/phase25-golden-path.mjs`
- `.gitignore`

不要提交 `test-results/`、`.codex-runtime/`、数据库、运行日志或截图。

## 4. 已取得的真实证据

### LCOS MCP Pull E2E

命令：

```powershell
$env:LCOS_LIGHT_BRIDGE_PYTHON=
  "C:\Users\1\.workbuddy\binaries\python\versions\3.13.12\python.exe"
npm run test:lcos-mcp-e2e
```

结果：PASS。

真实状态链：

```text
claim_lcos_task → claimed
start_lcos_task → running
submit_lcos_result → providerStatus=review
get_lcos_task → same taskId
get_lcos_task_by_run → same taskId
```

证据任务：

```text
taskId: task-d25f7ed0-5c65-52cf-bdf4-24a6e3733349
lcosRunId: run-mcp-e2e
Bridge: 0.2.0
```

### Web Tests

`113 / 113` PASS。

原失败是 `v07Integration.test.ts` 仍在 `App.tsx` 中查找已迁移到
`v07UiContracts.ts` 的 Link Reference 合同。测试已改为检查真实所有者。

### Phase 2.5 Golden Path

`npm run test:e2e:golden`：PASS。

脚本现在在 43121 没有现有 Local Core 时使用临时数据库自启动 Core，并在结束后
回收进程与临时目录。

## 5. 当前精确断点

`npm run test:e2e`：2 PASS / 2 FAIL。

失败不是连接问题。页面和 Runtime App Shell 均已加载，但测试仍等待旧选择器：

```text
.runtime-badge
```

v0.7 UI 已移除该元素。需要将浏览器 E2E 改为验证当前真实 Runtime 身份，例如：

- `[data-testid="creative-os-app"]` 存在；
- 当前项目为 Runtime Catalog 项目；
- 顶栏保存状态 / Agent Context / Runtime 数据节点中至少一个稳定身份；
- 不得只通过 Fixture 文案或旧 CSS class 判断。

两个失败用例：

1. `Browser loads Runtime data from SQLite via Proxy`
2. `Restart Local Core → reload page → data persists`

不要增加假的 `.runtime-badge` 只为让旧测试通过。

## 6. 后续执行要求

1. 修复 Playwright 断言，使其对应 v0.7 当前真实 UI。
2. 重跑：

```text
npm run test:e2e
npm run test:e2e:golden
npm run test:lcos-mcp-e2e
npm run lint
npm run typecheck
npm run test
npm run build
npm run smoke
npm run test:integration
npm run test:architecture
npm run check
git diff --check
```

3. 检查并清理生成的 `test-results/` 状态，不删除用户文件。
4. 更新 WorkBuddy 测试报告，使其包含真实 MCP Pull E2E 与最新 Browser E2E。
5. 输出新的合并前审核报告，但不要自动 Commit / Push / Merge。

## 7. 明确未完成

- Agent 自动唤醒 / 常驻 Worker；
- Cowart/tldraw 级 Scene Snapshot、增量事件和双向 Canvas 操作；
- 飞书私有正文授权读取；
- 正式任意 Project 创建入口；
- MCP Pull E2E 之外的真实长期 WorkBuddy Automation。

这些不得在本收口任务中自行扩大实现。

## 8. 回滚

- MCP 六工具可独立回退到 `9eebc87`。
- 自包含测试脚本和 Playwright `webServer` 配置可独立回退。
- 所有新测试使用临时 Bridge/Core Runtime，不写入正式 Project Truth。
