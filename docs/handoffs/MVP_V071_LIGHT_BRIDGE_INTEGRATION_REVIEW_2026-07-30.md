# LCOS MVP v0.7.1 UI 与 Light Bridge 集成交付报告

日期：2026-07-30

分支：`codex/mvp-fast-build`

实现基线：`02b7ef1 feat(runtime): complete MVP 1.0 execution loop`

## 1. 任务摘要

本轮完成两项已批准的大改：

1. 将基于 MVP 1.0 Runtime 闭环制作的 v0.7.1 Lightweight UI 增量接入主 Web；
2. 将 Light Bridge Kernel v0.1.0 提纯导入仓库，并用 Capability Gate 消除
   canonical 创建失败后自动切 Legacy 参数重发的重复任务风险。

本轮没有改变 Canonical Run、ContextManifest、ArtifactReturn、Revision、
Current、Accept/Retry/Reject 的领域语义，没有执行 LCOS Schema Migration。

## 2. 实际范围

### v0.7.1 UI

已完成：

- 删除第二套 Utility Dock / Panel；
- 使用单一 Workspace Rail 和 compact Capability Popover；
- Workspace 激活、Scope 导航和 Camera 定位解耦；
- 节点单击只选择，不再自动打开 Work Rail；
- 增加节点局部 AI / Relation / Additional View 工具条；
- 增加 zoom 大于 20% 时可见的 `?` 与 NodeInfoPopover；
- Work Rail 只保留 Composer、Run、Waiting Input、Review、Completed；
- Workspace Rail 与 Work Rail 默认折叠；
- 保留真实 Runtime、Import Copy、Preview、Link Reference、Handoff、
  Accept/Retry/Reject 接线；
- 修复 1366×768 下折叠 Workspace Rail 被基础
  `transform: translateY(-50%)` 拉出屏幕的问题。

### Light Bridge

已完成：

- 导入 clean-room Python 源码、测试、文档、示例与依赖声明；
- 排除原包 `dist/`、wheel、缓存、Runtime 数据和构建产物；
- 增加工具级 `.gitignore`；
- 保留 SQLite Task Store、幂等身份、Provider Registry、MCP/REST/CLI、
  changed files、cancel/finalize 和重启恢复；
- Local Core 增加 `auto | canonical | legacy` 合同模式；
- `auto` 在第一次 create 前调用 `health_check`；
- health 声明 `bridge-task-v0`、幂等创建和按 Run 查询时锁定 canonical；
- 显式 Legacy 模式仍可用于回滚；
- canonical 创建失败时不再切合同重发第二次 `create_task`。

未完成或未冒充完成：

- Light Bridge 没有自动启动 WorkBuddy；
- 没有正式 WorkBuddy One-shot Runner 常驻接管；
- 没有真正 Provider `waiting_input` / Conversation Resume；
- 默认 Local Core endpoint 仍是已验证旧 Bridge `127.0.0.1:8920/mcp`；
- Light Bridge `43122` 当前是已通过 canary 的可切换 Gate，不是默认执行器。

## 3. 变更流程

### 变更前

```text
v0.7 Web
→ Local Core
→ canonical create
→ 失败时 Legacy 参数重发
→ AI Bridge :8920
→ WorkBuddy
→ Result / Draft / Accept
```

### 变更后

```text
v0.7.1 Web
→ Local Core
→ health_check / Capability Gate
→ 当前进程固定 canonical 或 explicit legacy
→ 单次 create
→ Bridge
→ Result / Draft / Accept
```

Light Bridge canary：

```text
Local Core
→ Light Bridge :43122
→ Canonical Task
→ canary one-shot claim/start/result
→ Bridge restart
→ lookup by lcos_run_id
→ Local Core sync
→ ArtifactReturn.pending_review
→ Draft Revision
→ Accept
→ Current Revision
```

## 4. 修改文件

### Web

- `apps/web/package.json`
- `apps/web/src/App.tsx`
- `apps/web/src/main.tsx`
- `apps/web/src/features/canvas/CanvasNodeVisual.tsx`
- `apps/web/src/features/canvas/ProjectCanvas.tsx`
- `apps/web/src/features/canvas/NodeContextToolbar.tsx`
- `apps/web/src/features/canvas/NodeInfoPopover.tsx`
- `apps/web/src/features/shell/CapabilityPopover.tsx`
- `apps/web/src/features/workrail/WorkRail.tsx`
- `apps/web/src/features/workspace/WorkspaceDock.tsx`
- `apps/web/src/runtime/v07UiContracts.ts`
- `apps/web/src/state/workRailMode.ts`
- `apps/web/src/v071.css`
- 删除 `NodeQuickLook.tsx`
- 删除 `UtilityDock.tsx`
- 删除 `UtilityPanel.tsx`
- 对应 Web 合同测试

### Local Core

- `apps/local-core/src/bridge-mcp-client.ts`
- `apps/local-core/src/index.ts`
- `apps/local-core/tests/bridge-mcp-client.test.ts`

### Light Bridge 与验证

- `tools/light-bridge-kernel/`
- `scripts/light-bridge-canary.mjs`
- `docs/audit/MVP_V071_LIGHT_BRIDGE_PRECHANGE_PLAN_2026-07-30.md`
- 本报告

## 5. 测试结果

### Frontend 定向

```text
Web tests:      27 files / 108 tests PASS
Web typecheck:  PASS
Web build:      PASS
```

### Local Core 定向

```text
bridge-mcp-client: 4 tests PASS
Local Core typecheck: PASS
```

覆盖：

- Legacy Result 缺失 `lcos_run_id` 的持久化 Binding 兼容；
- 显式错误 Run ID 拒绝；
- Capability Gate 锁定 canonical 且失败不重发；
- 显式 Legacy 模式不做 capability probe。

### Light Bridge

```text
pytest:       11/11 PASS
compileall:   PASS
wheel build:  PASS
```

wheel 只在临时目录由当前源码重新构建用于验证，没有提交或使用原包预构建 wheel。

非阻塞 warning：

- FastAPI TestClient 提示未来改用 httpx2；
- setuptools 提示未来使用 SPDX license string。

### Root 质量链

```text
npm run check:fast        PASS
npm run test:integration  PASS
npm run test:architecture PASS
npm run check             PASS
git diff --check          PASS
```

统计：

```text
Web:          108 tests
Local Core:   121 tests
Domain:         5 tests
Contracts:      4 tests
Architecture:  27 tests
Integration:    5 tests
```

Lint 没有 error；保留现有和 v0.7.1 包带入的 Hook dependency / unused-function
warning，没有为隐藏真实 Diff 批量清理 App 历史代码。

## 6. Light Bridge Canary 证据

结果：

```text
bridgeVersion:       0.1.0
contractVersion:     bridge-task-v0
Run:                 run-463e2bee-1281-4d35-b724-ae7c89e8cc09
Task:                task-b88b70ec-b29d-5c1d-bc93-6655780f1c71
Recovered Task:      task-b88b70ec-b29d-5c1d-bc93-6655780f1c71
ArtifactReturn:       return-c7de9b4287e15d3756c2f14c87db38d16aa8b6d9d585adf0059a6057862b6084
Return status:        adopted
Current Revision:     revision-return-c7de9b4287e15d3756c2f14c87db38d16aa8b6d9d585adf0059a6057862b6084
```

临时证据根目录：

```text
C:\Users\1\AppData\Local\Temp\lcos-light-bridge-canary-wayGpv
```

该 canary 使用受控 Runner 模拟 Provider 文件写入，只证明 Task Plane 到 LCOS
Artifact 生命周期的合同兼容；它不是正式 WorkBuddy 自动执行证据。

## 7. 浏览器验收

环境：

```text
URL: http://127.0.0.1:5173/
Browser: Codex In-app Browser
Viewports: 1440×900, 1366×768
Data: Local Core Runtime
```

通过：

- 页面标题与 URL 正确；
- 主 App 非空，无 Vite/React 错误层；
- Console 0 error / 0 warning；
- 节点单击后 selected=true；
- NodeContextToolbar 数量为 1；
- Work Rail 点击前后均保持 `work-rail compact`；
- NodeInfoPopover 可打开；
- Workspace 激活前后 Scope 保持 `scope-mvp-root`；
- Camera transform 保持
  `translate3d(120px, 80px, 0px) scale(0.82)`；
- 1366×768 无横向溢出；
- 修复后 Workspace Rail rect 为 `top=54, left=10, width=48`；
- 1440×900 无横向溢出，Work Rail 保持 48px compact。

未自动验证：

- 浏览器原生 zoom 125%；
- 真实文件拖入；
- 用户手工完整 Run；
- Light Bridge 对正式 WorkBuddy 的自动唤醒。

## 8. 数据、Schema 与安全

- LCOS SQLite schema 不变；
- 不执行 migration；
- 不修改 Artifact/Revision/Accept Domain；
- 不修改根 npm 依赖或 lockfile；
- Light Bridge Runtime Root 必须显式设置且位于 Project 外；
- 两个输入包均未发现 Token、Password、Private Key、`.env` 或用户 Runtime Snapshot；
- Local Core 与 Light Bridge 继续只允许 loopback。

## 9. 风险与下一步

最大剩余风险：

```text
Light Bridge Task Plane 已可用
≠
WorkBuddy 已会自动 claim 和执行
```

建议下一步单独完成正式 Runner Gate：

1. 冻结 WorkBuddy One-shot Runner 启动入口；
2. 真实 WorkBuddy claim/start/write/submit；
3. 验证 Bridge 与 Local Core 双重重启；
4. 通过后将 launcher 与默认 endpoint 切到 `43122`；
5. 未通过则继续使用 `8920`，不影响本次 UI 和 Capability Gate。

## 10. 回滚

- 整体 revert 本次提交即可恢复 `02b7ef1`；
- LCOS Schema 与 Project 数据无需回滚；
- 默认 Bridge 未切换，因此旧真实 E2E 路径仍可使用；
- Light Bridge 使用独立 Runtime Root，删除其临时 Runtime 不影响 Project Truth；
- 不应删除旧 Bridge 或历史任务来完成回滚。
