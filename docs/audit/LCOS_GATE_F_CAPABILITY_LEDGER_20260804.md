# LCOS Gate F 能力台账

> 日期：2026-08-04  
> 状态：Development Candidate  
> 目的：锁定 Contracts、Local Core、Web、CLI、MCP、Skill 与测试之间的真实能力，避免界面和 Skill 宣传尚未落地的功能。

## 1. 主链路

```mermaid
flowchart LR
  UI[Canvas / Composer] --> AC[ActiveContext]
  AC --> PLAN[Agent Plan]
  PLAN --> GUARD[Core Guard]
  GUARD --> RUN[Canonical Run]
  RUN --> BRIDGE[Light Bridge]
  BRIDGE --> PROVIDER[Codex / WorkBuddy]
  PROVIDER --> RETURN[ArtifactReturn]
  RETURN --> REVIEW[使用 / 放弃 / 再试]
```

## 2. 机器检查结果

执行：

```text
node scripts/validate-gatef-capabilities.mjs
```

当前检查项：

| ID | 能力 | Contracts | Core | Web | CLI/MCP/Skill | 自动检查 |
|---|---|---:|---:|---:|---:|---:|
| GF-COMPOSER-01 | Composer 只暴露 Prompt、Agent、新节点 | — | — | ✅ | — | ✅ |
| GF-DRAFT-01 | CommandDraft 持久化 | ✅ | ✅ | ✅ | — | ✅ |
| GF-CONTEXT-01 | Project + Workspace ActiveContext 持久化 | ✅ | ✅ | ✅ | ✅ | ✅ |
| GF-PLAN-01 | Agent Plan 合同 + Core Guard | ✅ | ✅ | ✅ API | ✅ | ✅ |
| GF-SESSION-01 | Project + Provider Session Affinity | ✅ | ✅ | 诊断层 | ✅ | ✅ |
| GF-CONTEXT-COMMAND-01 | 明确授权的 Context 原子操作 | ✅ | ✅ | ✅ | ✅ | ✅ |
| GF-CANCEL-01 | Web → Core 撤回 | ✅ | ✅ | ✅ | ✅ | ✅ |
| GF-SELECTION-01 | Ctrl/Cmd/Shift 多选 | — | — | ✅ | — | ✅ |

## 3. Runtime 能力

| 能力 | Local Core | Light Bridge | 自动化证据 | 结论 |
|---|---:|---:|---:|---|
| revise + Draft Revision | ✅ | ✅ | Golden Path | 可用 |
| create + 1–5 文件 | ✅ | ✅ | Golden Path 2 文件 | 可用 |
| analyze + 0 文件 | ✅ | ✅ | Golden Path | 可用 |
| Accept / Reject / Retry | ✅ | ✅ | revise Accept | 可用 |
| cancel / late result guard | ✅ | ✅ | cancel event + Core guard | 基础可用 |
| Provider Task Lease / Heartbeat | 读取与恢复 | ✅ | Bridge 32 tests | 可用 |
| Codex claim-by-id | ✅ | ✅ | 脚本 Agent Golden Path | 合同可用 |
| 真实 `codex exec resume` | 绑定合同已接 | Watcher 已改 | 未在本环境实测 | 待 Windows 实机 |
| Project Session Affinity | ✅ Schema v14 | session_id 合同 | Core Smoke | 后端可用，真实 CLI 待验 |

## 4. 普通 UI 的 Provider 显示规则

普通 Composer 只显示：

```text
executionMode = automatic
且 availability = ready / busy
```

Runtime Host 托管 Codex 时设置：

```text
LCOS_CODEX_AUTO_EXECUTION=1
```

未被 Runtime Host 托管的 Provider 保留在 Diagnostics，普通用户不会看到一个必然失败的选项。

## 5. 仍未宣称完成的能力

```text
真实 Windows Codex Session 连续复用
PowerShell Watcher 实机恢复
完整 npm Web build / Vitest / Playwright
浏览器连续交互录屏
WorkBuddy 自动接单 E2E
正式 Windows 安装器
```

这些项目不得在 README、Skill 或普通 UI 中写成已完成。
