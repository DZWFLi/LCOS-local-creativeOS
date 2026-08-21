# Runtime 能力注册表（2026-08-06）

## 目的

`tools/lcos-runtime/capabilities.json` 是 LCOS 运行时能力的**单一事实源**：
端口、健康检查、运行目录、MCP 启动器、所有权规则与生命周期顺序都在这里。
dev-launcher 已改为从注册表读取（缺省值兜底）；Gate W 的安装器/托盘/文件关联
只准读这份注册表，不允许再写一套硬编码。

## 校验

```bash
node scripts/check-capability-registry.mjs
```

校验内容：端口唯一且合法、引用的脚本/启动器存在、start/stop 顺序只引用已知服务、
ownership 非空。CI 或 Gate W 安装器应把该校验作为前置步骤。

## 服务速查

| 服务 | 端口 | 健康 | 归属 |
|---|---|---|---|
| core | 43121 | /health | Node，唯一事实源 |
| bridge | 43122 | /health | Python，任务租约/结果信封 |
| web | 5173 | — | Vite，人机界面 |
| orchestrator | — | 锁文件 %TEMP%\\lcos-orchestrator-v2.lock | 看门狗：派活/会话绑定 |
| tray | — | — | PowerShell，Runtime Host 托盘 |

## 双同步机制（明确分工，不再叠加）

- `RuntimeAutoSyncService`（Core 内 10s）：把外部 Agent 已提交的结果 ingest 进 Review
  （零点击回收的安全网）。
- 看门狗（Node）：扫描并派发新 Run、维护会话绑定与任务定向。
- 二者互补：一个收结果、一个派新活。**禁止再加第三套轮询**；修改任一机制时必须
  同时更新注册表 ownership 说明与本文档。

## Gate W 约定

安装器/托盘/文件关联需要的全部事实（端口、脚本路径、数据目录、生命周期）来自
注册表；若某项能力不在注册表中，视为未定义，禁止凭经验硬编码。
