# LCOS Gate F 最终收口开发报告
## 真实 Codex 闭环、waiting_input、Canvas Context 与 Obsidian 连接器

> 日期：2026-08-05
> 输入基线：`LCOS_Fullstack_Support_20260805_7cdf8c3.zip`
> 原始 Git HEAD：`7cdf8c3e4d19c024d6dc302fc3c486ef277424d5`
> 当前性质：全栈收口候选源码，不代表已经正式合并主线，也不包含 Windows 安装器。

---

# 0. 最终判断

这轮没有替换 React Flow、没有用键鼠自动化操纵 Codex Desktop、没有用 `failed/retry` 假扮 `waiting_input`，也没有继续让看门狗猜“最近会话”。

收口后的主链是：

```mermaid
flowchart LR
    UI["Canvas / Composer"] --> CTX["Project + Workspace ActiveContext"]
    CTX --> SKILL["Codex LCOS Skill"]
    SKILL --> PLAN["AgentExecutionPlan"]
    PLAN --> CORE["Local Core 最小 Guard"]
    CORE --> RUN["Run + ContextManifest"]
    RUN --> BRIDGE["Light Bridge Task Lease"]
    BRIDGE --> HOST["Runtime Host / Watchdog"]
    HOST --> CODEX["codex exec 精确 resume"]
    CODEX --> RESULT["Result / waiting_input"]
    RESULT --> REVIEW["使用 / 放弃 / 再试一次"]
```

当前可定义为：

```text
Gate F Final Closeout Candidate
```

不是：

```text
正式合并完成
Windows 正式软件发布
真实 Windows 复测已自动替用户跑完
```

---

# 1. 本轮真正解决的内容

## 1.1 真实 `waiting_input`

Bridge、Core、CLI/MCP 和 Web 使用同一条正式链：

```text
Agent 提交 waiting_input ResultEnvelope
→ Bridge 保存 InputRequest 并释放 Task Lease
→ Core 保存 run_input_requests，Run 进入 waiting_input
→ UI 显示人话问题、可选项和自由文本
→ 用户回答
→ 同一个 Bridge Task 重新 queued
→ 同一个 Project Session 被 resume
→ Agent 继续原 Run
```

规则：

```text
允许自由文本 + 可选项
不自动超时取消
重复回答幂等
不同回答产生冲突
回答后不能被旧 waiting_input 结果重新打开
```

额外修复了一个安全缺口：`requestId` 现在有严格字符合同，证据文件名使用 SHA-256 派生，不允许通过请求 ID 形成路径越界。

## 1.2 一次自动修正

LCOS Skill 只对以下结构化、可逆错误自动修正一次：

```text
ACTIVE_CONTEXT_CONFLICT
STALE_GRAPH_VERSION
TARGET_NOT_FOUND
REVISION_NOT_FOUND
TARGET_REQUIRED
TARGET_FORBIDDEN
CONTEXT_ITEM_NOT_FOUND
PROVIDER_SESSION_STALE
```

第二次仍失败，才以人话询问或创建真实 `waiting_input`。删除、覆盖、权限扩大、路径越界和未批准 Skill 不允许静默修正。

## 1.3 Codex Session Affinity 与自动接单加固

根据支持包中的真实 Windows 证据，删除了错误的“扫描最新 JSONL / 最近会话”策略。

正式策略：

```text
projectId + provider
→ preferred externalSessionId
```

Codex 调用使用：

```text
有绑定：codex exec --json -C <project> resume <session-id> "..."
无绑定：codex exec --json -C <project> --skip-git-repo-check "..."
```

看门狗只保存 Codex 进程真实返回的 Session ID。

新增 Runner 收口判断：

```text
Codex 进程退出 0
≠
任务已经完成闭环
```

Runner 还会读取 Bridge Task 状态，只有观察到：

```text
waiting_input / review / completed / failed / cancelled / timeout
```

才把本轮视为形成可恢复结果。

普通执行失败不会把首选 Session 随便标成失效并疯狂拉新。只有输出明确表明 Session 不存在、关闭或无法恢复时，才允许新建一次。

## 1.4 Codex Skill 与 MCP 正式安装

Launcher 启动前会：

```text
安装 / 校验完整 LCOS Skill 包
安装 / 校验 local-creative-os MCP
```

Skill 安装器复制：

```text
SKILL.md
references/natural-language-examples.md
references/structured-error-repair.md
```

并使用整棵 Skill 的 Hash 做幂等校验。

MCP 安装器通过真实 Codex CLI 合同：

```text
codex mcp add
codex mcp get --json
```

它会备份配置；只自动修复可以确认是旧 LCOS 的同名 MCP，不覆盖无关配置。

## 1.5 Agent Browser 的实时上下文读链

Agent 页面接入现有 `afterVersion` 短轮询：

```text
Web 选择变化
→ 250ms 左右批量写 Core
→ Agent 页面以 afterVersion 等待新版本
→ 最迟约 1 秒读取新 CanvasContextSnapshot
```

断线后重新连接，Running Run 仍使用创建时冻结的 ContextManifest，不跟着实时选区漂移。

## 1.6 安全 Canvas Typed Actions

CLI/MCP 新增并接入正式 Core 写路径：

```text
select_lcos_views
focus_lcos_views
move_lcos_view
```

还保留：

```text
加入 / 移出 Context
设置 Target
Context Proposal
Workspace Membership
```

移动 View 走 Graph Mutation + CAS，不直接改 React State 或 SQLite。

## 1.7 Obsidian 只读连接器

新增统一 `ResourceConnectorPort` 与 Connector Capability Registry，并落地首个真实连接器：

```text
Obsidian local Vault
Markdown
read_only
scan + selective import
no sync
```

行为：

```text
用户明确选择 Vault
→ Core 原生目录选择器
→ 只读扫描 Markdown
→ 显示标题、路径、标签与双链摘要
→ 用户勾选笔记
→ 复制到 LCOS Project
```

不会修改、删除、重命名或同步 Vault 文件；跳过 `.obsidian`、`.git`、隐藏目录、符号链接和超限文件。Core API 不把 Vault 绝对路径返回给 Web/Agent。

CLI/MCP 新增：

```text
connector list
obsidian scan / import
list_lcos_connectors
scan_lcos_obsidian_vault
import_lcos_obsidian_notes
```

## 1.8 UI 降噪

进一步把普通界面的：

```text
Local Core
Runtime Draft
Runtime Run
Runtime FileRecord
Runtime Revision
```

转换为：

```text
本地项目服务
待确认结果
Agent 任务
已导入文件
已保存版本
```

错误默认显示“发生了什么、内容是否保留、下一步怎么做”，技术原文放在复制诊断信息中。

这轮没有重画完整 UI，也没有把右侧所有历史面板彻底合成一个组件。那是视觉与信息架构继续收口，不应被伪装成已经完成。

---

# 2. 合同与数据变化

## Local Core Schema

```text
v14 → v15
```

新增：

```text
run_input_requests
```

既有并继续使用：

```text
active_contexts
context_proposals
command_drafts
provider_session_bindings
run_events
```

`.lcosproj` 文件格式仍保持原版本，不因为应用级 waiting_input 状态随意升级项目交换格式。

## Light Bridge Schema

```text
v3 → v4
```

增加：

```text
input_request_json
input_response_json
WAITING_INPUT
answer_input
```

---

# 3. 验证结果

本环境实际执行并通过：

```text
Contracts / Domain TypeScript 编译
Local Core TypeScript 编译
218 个 TS / TSX 文件语法检查
全部 MJS node --check

Local Core Schema v15 + HTTP Smoke
ActiveContext Persistence / CAS / afterVersion
CommandDraft / Context Proposal / Session Binding
Agent Plan Guard
Connector Port + Obsidian HTTP 扫描与导入
Obsidian 源 Vault Hash 不变

Light Bridge pytest：35 / 35
Light Bridge compileall
Gate F closeout static checks
Gate F capability checks：8 / 8
MCP tools/list：58 tools，新工具齐全
Skill 安装器：首次安装 + 幂等校验
MCP 安装器：首次安装 + 幂等校验（Fake Codex CLI 合同测试）
Codex Runner：新会话 / 精确 resume 参数与 Session ID 解析
Codex Runner：Bridge review 闭环状态确认
```

当前环境未能重新执行：

```text
完整 npm ci
Web tsc / Vite build
Vitest 全量单测
Playwright 浏览器 E2E
PowerShell Watchdog
真实 Windows codex.exe
```

原因是当前容器无法获得完整前端依赖，也没有 Windows / PowerShell / 用户 Codex 登录环境。原始支持包说明基线 Windows 质量链全绿，但本轮修改仍必须按新清单在 Windows 再跑一次，不能借旧成绩给新代码发毕业证。

---

# 4. 仍明确后置或未完成

```text
正式 Git 主线合并
Windows 安装器 / 文件关联 / 自动更新
严格单进程桌面壳
WorkBuddy 同等级真实闭环
整张或当前视口 screenshotRef
Relation / 自动布局 / 自动分组的广泛 Agent 写操作
对话 Session 导入
Eagle / IMA / 收藏夹连接器
完整右侧工作台视觉重构
```

`screenshotRef` 没有用 DOM 抓取或假截图糊弄。它应在真实浏览器渲染环境中按需实现为 Observation 补充，不能替代结构化 Canvas Snapshot。

---

# 5. Windows 最终复测入口

先看：

```text
docs/testing/GATEF_REAL_MACHINE_TEST_CHECKLIST_20260805.md
```

随包提供无 Runtime 数据的安全测试项目：

```text
docs/testing/fixtures/gatef-disposable-project/
```

它包含：

```text
1 个 Markdown
2 张 PNG
1 个 JSON
1 个 YAML Skill-like resource
```

可用于 analyze、revise、create、waiting_input、cancel、restart 和连续 Session 复用测试。

---

# 6. 合并建议

这份包适合作为：

```text
Gate F 最终 Windows 实机验证候选
```

通过 Windows 清单后，再决定是否合并主线。

不要在实测前继续加入 SSE、向量库、更多连接器、自动布局或正式安装器。现在最值钱的是把一个项目连续跑 5 次、同一个 Session 不乱跳、用户遇到歧义能回答一次、结果能稳定回画布。软件终于走到该证明自己会工作，而不是继续写简历的阶段。
