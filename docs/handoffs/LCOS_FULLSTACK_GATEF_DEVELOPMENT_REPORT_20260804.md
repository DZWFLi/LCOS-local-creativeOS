# LCOS 全栈 Gate F 开发交付报告

> 日期：2026-08-04  
> 基线：`LCOS_Fullstack_Premerge_Closeout_FINAL_20260804_150749.zip`  
> 交付状态：**Gate F Development Candidate**  
> 本轮范围：完成全栈主流程收口；正式合并和 Windows 安装器按用户要求暂不强求。

---

# 1. 最终判断

本轮没有继续扩张新格式、SSE、自动布局或多 Agent 编排，而是集中修复用户主流程：

```text
选择内容
→ 输入自然语言
→ 选择真实可用 Agent
→ 发送
→ 自动接单
→ 返回待确认结果
→ 使用 / 放弃 / 再试
```

当前代码已经达到：

```text
底层合同可运行
Local Core 可构建并启动
Bridge 测试通过
全链 Golden Path 通过
核心持久化可重启恢复
Web 交互已按 Gate F 方向收口
```

仍必须在 Windows 实机补齐：

```text
真实 codex exec resume
PowerShell Watcher
完整 npm Web 质量链
浏览器真实交互 E2E
```

因此本包不是“正式可合并声明”，而是只剩实机验证和可能的小修复的开发候选包。

---

# 2. 修改后的总体流程

```mermaid
flowchart LR
  UI[Canvas / 极简 Composer]
  --> AC[Project + Workspace ActiveContext]
  AC --> PLAN[Agent Execution Plan]
  PLAN --> GUARD[Core 最小 Guard]
  GUARD --> MANIFEST[不可变 ContextManifest]
  MANIFEST --> RUN[Canonical Run]
  RUN --> DISPATCH[RuntimeDispatch]
  DISPATCH --> BRIDGE[Light Bridge]
  BRIDGE --> SESSION[Project Session Affinity]
  SESSION --> AGENT[Codex / WorkBuddy Runner]
  AGENT --> RESULT[ResultEnvelope]
  RESULT --> RETURN[ArtifactReturn]
  RETURN --> REVIEW[使用 / 放弃 / 再试]
```

职责保持：

```text
Agent / Skill：理解用户自然语言并产生计划
Core：验证对象、版本、权限、路径和生命周期
Bridge：任务、租约、Provider 状态与结果合同
Web：用户交互，不展示内部执行参数
```

---

# 3. 本轮完成内容

## 3.1 极简 Composer

修改：

```text
apps/web/src/features/canvas/SelectionComposer.tsx
apps/web/src/features/workrail/WorkRail.tsx
apps/web/src/App.tsx
```

普通用户只看到：

```text
自然语言输入
参考内容芯片
Agent
结果作为新节点
发送
```

隐藏：

```text
outputIntent
Result Policy
Target ID
Revision ID
Provider 状态细节
Runtime / Bridge 合同字段
```

只有真正可自动执行的 Provider 才进入普通 Composer。

## 3.2 CommandDraft 不丢

新增正式合同和 Schema v14 表：

```text
command_drafts
```

保存：

```text
projectId
workspaceId
composerAnchor
Prompt
Context View IDs
Agent
结果作为新节点
updatedAt
```

Web 以 250ms debounce 保存。切换节点、关闭输入层、切 Workspace、刷新或 Core 重启后可以恢复。发送成功或用户显式清空后删除。

## 3.3 Ctrl/Cmd 多选

`ProjectCanvas` 现在统一支持：

```text
Ctrl + Click
Cmd + Click
Shift + Click
Ctrl/Cmd + 框选
```

并保留多选组移动能力。

## 3.4 ActiveContext 持久化与视觉快照

原内存 `Map<projectId>` 改为 Schema v14 持久化：

```text
active_contexts
唯一键：projectId + workspaceKey
```

支持：

```text
selection order
Target
Pinned / Excluded
Viewport
Visible Nodes
节点 Artifact / Revision 身份
节点坐标与摘要
一度关系
Version CAS
afterVersion 短轮询
```

Project Overview 使用固定 Workspace Key，不污染 Project Graph 的语义版本。

## 3.5 Context Command 与 Proposal

明确用户授权的可逆操作可以通过 CAS 原子执行：

```text
加入参考
移出参考
设置 Target
聚焦
```

Agent 自主扩大 Context 时使用持久化 Proposal：

```text
context_proposals
```

Proposal 跨 Core 重启恢复。

## 3.6 Agent Plan 与 Core Guard

新增：

```text
AgentPlanRequestV1
AgentExecutionPlanV1
POST /projects/:id/runs/validate-plan
```

Core 只校验：

```text
对象存在
Target / Revision 一致
create / revise / analyze 合同
风险确认
路径与版本安全
```

Skill 与 MCP 已更新为 Agent 语义决策入口。

说明：标准 Web 入口仍保留只基于显式事实的最小 fallback，避免为了“让 Codex 先规划如何调用 Codex”制造循环。完整 Agent-authored Plan 已通过 CLI/MCP/Skill 和 Core Guard 接通，真实 Codex 对话中可以使用。

## 3.7 Project Session Affinity

新增正式持久化：

```text
provider_session_bindings
唯一键：projectId + provider
```

字段包括：

```text
externalSessionId
origin
status
lastSeenAt
lastRunId
leaseOwner
leaseExpiresAt
failureCount
```

Codex Orchestrator 优先从 Core 读取首选 Session：

```text
resume preferred
→ 失败标 stale
→ resume last / create once
→ 原子更新 Binding
```

旧 `sessions.json` 只保留兼容和诊断用途，不再作为正式真相。

## 3.8 Runtime Provider 可见性

新增 Provider 能力：

```text
executionMode = automatic | manual
reason
```

Runtime Host 托管 Codex 时注入：

```text
LCOS_CODEX_AUTO_EXECUTION=1
```

普通 UI 只展示 `automatic + ready/busy` 的 Agent。手动或离线 Provider 进入 Diagnostics。

## 3.9 撤回与迟到结果

Web 已接入 Run Cancel。

现有 Core / Bridge 合同继续保证：

```text
撤回幂等
Task Lease 释放
cancelled Run 不接受 Provider 迟到结果
迟到结果不生成 Draft，不修改 Current
```

真实 Windows Runner 进程中断仍需实机验证。

## 3.10 CLI / MCP / Skill

CLI 新增或补齐：

```text
workspace-aware context
context add/remove/target
run validate-plan
provider-session get/set/clear
```

MCP Server 0.2：

```text
49 tools
ActiveContext get/watch
Context Command
Agent Plan validate
Context Proposal
Provider Session
Run cancel / review / resource tools
```

Skill 已改为：

```text
Agent 理解语义
Core 守最小边界
使用同一 ActiveContext Version
```

## 3.11 Runtime 构建修复

发现并修复一个会让干净构建后的 Local Core 无法启动的问题：

```text
@local-creative-os/domain 原本运行时导出 src/index.ts
Node 无法直接加载 TypeScript
```

现在：

```text
packages/domain/tsconfig.build.json
Domain 运行时导出 dist/index.js
Local Core 显式依赖 domain
build:local-core 先构建 domain
```

## 3.12 可复现性交付

重写 Manifest 工具：

```text
有 Git 时记录 Git 文件
无 Git 的源码包使用文件系统基线
排除 Runtime、数据库、日志、缓存、构建产物和本机 target.json
拒绝 symlink 与规范化路径冲突
```

新增机器能力 Gate：

```text
scripts/validate-gatef-capabilities.mjs
```

新增 Core 真实 HTTP / 重启 Smoke：

```text
scripts/gatef-core-smoke.mjs
```

---

# 4. 修改文件

相对原始全栈包：

```text
修改 39 个文件
新增 4 个代码/测试文件
另新增本次交付文档
```

主要模块：

```text
apps/local-core/src/
apps/local-core/tests/
apps/web/src/
apps/web/tests/
packages/contracts/
packages/domain/
packages/skills/
tools/lcos-agent/
tools/codex-orchestrator/
scripts/
```

---

# 5. 已实际执行的验证

## 5.1 TypeScript

```text
Contracts 源码严格 TypeScript 检查：PASS
Domain 源码严格 TypeScript 检查：PASS
Local Core 完整 typecheck：PASS
Domain build：PASS
Local Core build：PASS，53 个输出文件
TS / TSX 语法：212 文件，0 错误
MJS 语法：PASS
```

## 5.2 Light Bridge

```text
pytest：32 / 32 PASS
compileall：PASS
```

## 5.3 Gate F 能力检查

```text
GF-COMPOSER-01 PASS
GF-DRAFT-01 PASS
GF-CONTEXT-01 PASS
GF-PLAN-01 PASS
GF-SESSION-01 PASS
GF-CONTEXT-COMMAND-01 PASS
GF-CANCEL-01 PASS
GF-SELECTION-01 PASS
```

## 5.4 Core 真实 Smoke

结果：

```json
{
  "schemaVersion": 14,
  "apiAuth": true,
  "activeContextPersistence": true,
  "activeContextCas": true,
  "activeContextShortPoll": true,
  "commandDraftPersistence": true,
  "contextProposalPersistence": true,
  "providerSessionAffinity": true,
  "agentPlanGuard": true
}
```

## 5.5 CLI / MCP

```text
CLI help：PASS
MCP JSON-RPC tools/list：PASS
Tool count：49
关键 Gate F 工具存在：PASS
```

## 5.6 Full Golden Path

真实启动：

```text
Light Bridge
Local Core
真实 SQLite
真实项目文件
```

结果：

```text
revise → Draft → Accept：PASS
analyze → zero files：PASS
create → two files / Return Group：PASS
cancel event：PASS
codex provider claim-by-id：PASS
checkpoint：PASS
Core restart recovery：PASS
```

最终：

```text
=== GOLDEN PATH PASS ===
```

重要说明：Golden Path 的 Agent 是测试脚本，Codex 场景验证的是真实 Provider 合同和 claim-by-id，不是 Windows 上真实 `codex exec resume`。

---

# 6. 当前环境无法诚实完成的验证

由于执行环境没有可用 npm Registry DNS，无法安装 Web 的 React、Vite、Vitest 和 Playwright 依赖，因此本轮没有宣称完成：

```text
完整 npm lint
完整 Web semantic typecheck
Vite production build
Web Vitest
Architecture / Integration Vitest
Playwright 浏览器 E2E
```

已用以下检查降低风险：

```text
全部 TS/TSX Parse
Local Core 完整 Typecheck / Build
静态 Capability Gate
真实 Core HTTP Smoke
Golden Path
```

此外，当前环境不是 Windows，也没有 PowerShell 和真实 Codex CLI 会话，因此没有宣称：

```text
watch.ps1 真实运行通过
codex exec resume 连续 Session 复用通过
Running cancel 真实终止 Windows Runner 进程树
托盘 / Runtime Host Windows 生命周期通过
```

这些项目已写入实机清单。

---

# 7. 实机启动和测试

Windows 开发运行：

```powershell
npm ci
npm run audit:manifest:verify
npm run check:gatef-capabilities
npm run dev:open
npm run dev:status
```

安装 Codex Skill：

```powershell
npm run lcos:install-skill
```

完整测试见：

```text
docs/testing/GATEF_REAL_MACHINE_TEST_CHECKLIST_20260804.md
```

---

# 8. 已知边界

```text
1. 正式 Git 合并未执行。
2. Windows 安装器和隐藏命令行产品化按用户要求后置。
3. 真实 Codex CLI 自动 resume 仍需 Windows 实机验证。
4. WorkBuddy 自动执行未通过 Gate F，不在普通 UI 宣传。
5. SSE 后置，当前使用 versioned poll。
6. Relation 自动规划、布局和分组后置。
7. GUI 的视觉细节仍可继续整理，但主流程字段已经降噪。
8. Web 直发流程使用显式事实的最小 fallback；Agent-authored 语义计划主要通过 Codex Skill/MCP 进入。
```

---

# 9. 回滚

本包没有修改用户真实数据库，也没有附带 Runtime 数据。

Schema v14 为向前迁移，涉及：

```text
active_contexts
context_proposals
command_drafts
provider_session_bindings
```

正式合并前应在真实数据库副本运行 Migration / Restart / Rollback 验证。不要直接拿唯一工作库祭天，数据库对此类仪式通常并不感激。

---

# 10. 下一步唯一建议

停止继续增加功能，只跑实机清单：

```text
Windows npm 全质量链
真实浏览器交互
真实 Codex Session 复用
cancel / restart / session invalidation
```

实机出现问题时只做定向修复；全部通过后再决定是否合并主线。
