# Packaged Utility Process Environment Fix — 2026-08-23

## 任务摘要

修复 Windows 正式打包版启动时 `Codex skill setup failed with code 9`，以及 `LCOS.exe: bad option: --type=utility` 等连续报错。

## 根因

Desktop Runtime 通过 Electron `utilityProcess.fork()` 启动 Local Core、Codex Orchestrator 和一次性 Skill/MCP 安装器，但子进程环境显式设置或继承了 `ELECTRON_RUN_AS_NODE=1`。Electron 已经会以 Node Utility Process 方式启动这些脚本；该环境变量反而让打包后的 `LCOS.exe` 把 Electron 注入的 Chromium Utility 参数当作 Node CLI 参数解析，最终以 code 9 退出。

## 变更流程

```text
变更前
utilityProcess.fork
  -> ELECTRON_RUN_AS_NODE=1
  -> packaged LCOS.exe parses Chromium flags as Node flags
  -> skill setup / orchestrator exits with code 9

变更后
utilityProcess.fork
  -> utilityEnvironment() copies required environment
  -> removes ELECTRON_RUN_AS_NODE
  -> Electron NodeService starts the JS entrypoint normally
  -> Local Core / Orchestrator / installers remain alive or complete normally
```

## 实际范围

- 对全部三个 `utilityProcess.fork()` 入口统一净化环境。
- 增加架构回归测试，禁止重新显式注入该变量，并确保所有 fork 入口使用统一 helper。
- 不改 Project Truth、Workspace/Canvas、Bridge contract、数据库或用户交互。

## 修改文件

- `apps/desktop/src/runtime-supervisor.mjs`
- `tests/architecture/runtime-host-entrypoints.test.ts`
- `docs/handoffs/2026-08-23-packaged-utility-process-env-fix.md`

## 验证结果

- 定向架构测试：6/6 PASS。
- Desktop doctor：PASS。
- `desktop:package`：PASS，Electron Forge 生成 Windows x64 正式目录。
- 真实打包版启动：PASS。
- Codex Skill 刷新分支：8 个 LCOS Skills 安装完成，未产生新的 `bad option`。
- Local Core `127.0.0.1:43121/health`：HTTP 200。
- Bridge `127.0.0.1:43122/health`：HTTP 200。

## 风险与未完成

- 本轮只验证了本次崩溃涉及的正式包启动链，未宣称完成完整 Golden Path 或 GUI 全量验收。
- `codex-setup.log` 和 `orchestrator.log` 会保留修复前历史错误；判断回归时必须按时间戳区分，不能把旧日志误判为新失败。

## 回滚

回滚本提交即可恢复原行为；无 Schema、Project 数据或用户文件迁移。
