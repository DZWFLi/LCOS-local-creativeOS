# LCOS Fullstack — 项目归档说明

归档日期：2026-08-05
项目阶段：Gate F Final Closeout + P0 对话导入设计（未合并主线）
当前分支：`codex/backend-hardening-20260802`
归档 HEAD：`a0ee8ec`

## 项目定位

Local Creative OS：不制作内容，只负责看、判断、派活、追踪、归档。本包是
“OS 管项目、Bridge 管执行、GUI 管会话、文件系统管内容”的全栈候选源码。

主链：

```text
Canvas/Composer → ActiveContext → LCOS Skill → AgentExecutionPlan
→ Local Core Guard → Run + ContextManifest → Light Bridge Task Lease
→ Runtime Host/Watchdog → codex exec resume → Result/waiting_input → Review
```

## 包内容

- `apps/web`：App Shell、Canvas、Composer、Agent 浏览器上下文、Inspector
- `apps/local-core`：Project/Workspace、SQLite、Import、Runtime、Connector、CLI/MCP 后端
- `packages/domain|contracts|skills|ui`
- `tools/light-bridge-kernel`、`tools/lcos-agent`（CLI + MCP）、`tools/codex-orchestrator`
- `scripts`、`tests`、`docs`（含 P0 项目描述与剩余问题总账）
- `OS项目文档`（PRD / UI Spec / 决策稿）

## 本地恢复

```powershell
npm ci
npm run dev:stack     # 或按 README 分别启动
npm run dev:open
```

质量检查：

```powershell
npm run lint
npm run typecheck
npm run test
npm run test:architecture
npm run build
```

## 归档策略

ZIP 保留源码、锁文件、文档、静态资产、测试夹具与当前提交信息。

为减少体积，以下可重建/运行时目录不进入 ZIP：

- `node_modules/`：`npm ci` 可恢复
- `dist/`、`build/`：`npm run build` 可恢复
- `.git/`：以提交号 `a0ee8ec` 为准，ZIP 内提供 BUILD_INFO
- `.codex-runtime/`、`.dev-launcher/`、`test-results/`、SQLite/DB、日志、缓存、凭证

## 注意事项

- 当前候选不代表正式合并主线，也不包含 Windows 安装器；
- MCP 真实会话加载与看门狗异步化是开发 P0 硬债（见总账 A1/A2）；
- 对话 Session 导入为 P0 新需求，设计已定稿、0 行实现（见独立项目描述）；
- 归档 SHA-256 见随包 `.sha256` 文件与根目录 `MANIFEST.sha256`。
