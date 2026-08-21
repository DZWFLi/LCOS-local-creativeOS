# LCOS MVP V1 纵向闭环执行 README

> 本文件是 `codex/mvp-fast-build` 的持续执行提醒。
>
> 每次开始开发、上下文压缩后续接、切换代理或准备提交前，先确认本文件中的
> “当前断点”和“禁止偏航”。已经完成的 Slice 不重复审计或重做。
>
> 上位指示：
> `C:\Users\1\Desktop\OS开发\MVP重构\LCOS_MVP_V1_完整OS纵向能力_开源借鉴矩阵_v1.0.md`

## 1. 唯一目标

MVP V1 不是 Local Core 骨架，也不是 Sample Project + Preview 演示。

MVP V1 冻结为：

> 完整 OS 的单项目、单用户、单 Executor、有限格式纵向切片。

最终必须证明：

```text
真实导入
→ 项目理解
→ AI 执行
→ 结果回收
→ Draft Revision
→ Accept / Retry / Reject
→ 刷新与重启恢复
→ 继续工作
```

产品价值判断：

```text
用户换 Agent，不换项目大脑。
```

## 2. 禁止偏航

- 不按旧 Stage 0–7 编号倒退开发；旧 Stage 文档只作为历史证据。
- 不把 Bridge Reality Gate 单独误判为当前总任务。
- 不把 Sample、Fixture、Mock、前端定时器或占位 UI 描述为 Runtime 真相。
- 不只完成 Project Graph、Preview 或 Handoff 就宣布 MVP 完成。
- 不为了增加格式宽度牺牲完整生命周期。
- 不同时开启多项目、多用户、多 Executor、PPT/DOCX 修改或复杂 Page Diff。
- 不让 Bridge 拥有 Project Truth、Canvas 坐标或 Current Revision 决策。
- 不让 React Flow 序列化结果成为 Project Truth。
- 不让 Watcher 自动创建 Revision、切换 Current 或接受外部变化。
- 不让 AI 返回结果直接覆盖人工 Current。
- 不在浏览器提交或信任任意绝对本机路径。
- 不复制 GPL 或 Source-Available 项目的 Production 代码。

## 3. 冻结范围

支持：

```text
单用户
单项目 Demo
单 Executor：WorkBuddy
单主要可修改类型：Markdown Script
图片 Reference
MD / TXT / Image Preview
PDF 第一页可选
```

不支持：

```text
多人协作
多 Executor
完整 Session Federation
PPT / DOCX 修改
复杂 Page Diff
浏览器扩展
自动语义搜索
完整 Delivery
复杂 Child Canvas
```

PPT / DOCX 可以识别，但必须明确显示 `previewUnsupported`，不能伪装成已支持。

## 4. 五个纵向 Slice

### Slice 1：真实输入

```text
Project
→ HTML5 Drop
→ Import Copy
→ FileRecord
→ Initial Revision
→ ArtifactView
→ Preview
→ Restart
```

要求：

- Canvas Drop 是 Import Copy。
- Local Core 写入 `<Project Root>\imports\`。
- Browser 只传文件内容和不透明业务标识，不传目标绝对路径。
- Temporary / Importing / Persisted / Failed 状态明确。
- External Source Binding 继续使用 Trusted Selection + opaque `selectionId`。
- 删除 ArtifactView 不删除 Artifact。

### Slice 2：项目理解

```text
Reference
→ Feedback
→ Decision
→ Revision
→ ContextManifestV0
→ Handoff
```

要求：

- Reference 继续使用 Artifact + Revision + View + Relation + Note。
- Feedback 不能只是一段散文，至少表达来源、Change Request、Keep/Locked 和状态。
- Decision / Checkpoint 进入 Project Truth。
- ContextManifestV0 从 Project Truth 稳定构建，不读 Fixture。
- 同一份 Manifest 同时服务人工 Handoff 与 RuntimeInputPack。

### Slice 3：文件演化

```text
Manual Refresh / Minimal Watch
→ current / stale / missing / unreadable
→ Adopt External Change
→ New Revision
```

要求：

- P0 是手动 Refresh 必须真实成立。
- Watcher 是 P1；引入前必须完成 Chokidar 独立依赖和 Windows 行为审计。
- Watcher 只产生 Observation。
- Adopt External Change 必须是用户动作，并创建新 Revision。
- Current Revision 始终只有一个。

### Slice 4：AI 执行

```text
ContextManifestV0
→ RuntimeInputPack
→ Canonical LCOS Run
→ Bridge Adapter
→ WorkBuddy
→ RunEvent / afterSeq
→ changed_files
```

要求：

- Canonical Run 由 LCOS 保存，Bridge `task_id` 只是外部映射。
- 一个真实 Executor：WorkBuddy。
- Retry 创建新 Run，旧 Run 不改回 `running`。
- Run、事件游标和外部映射可以恢复。
- `changed_files` 必须是结构化、稳定且经过 Path Guard 验证的证据。
- Bridge 不直接决定 Artifact、Revision 或 Current。

#### Slice 4 开工前的 Bridge 提纯硬门

到达 Slice 4 后必须暂停，与 Dz 讨论并批准 Bridge 导入方案；不得直接连接或修改
当前外部 Bridge 工作目录。

外部来源：

```text
E:\Buddy项目\ai-bridge
```

该目录当前不能直接作为 LCOS 的可复现依赖或 Git 基线。进入 AI 执行开发前必须：

```text
原始 Bridge 代码包只读审计
→ 识别真正的 Runtime / Task / Result / Watcher 源码
→ 剔除运行数据、缓存、临时回传、个人配置和重复说明材料
→ 检查 Key / Token / Cookie / 本机绝对路径和敏感日志
→ 检查许可证与第三方来源
→ 提纯为最小、可测试、可复现的 Bridge 代码包
→ 确认在 LCOS 当前 Git 树中的目标目录和所有权边界
→ 先提交独立的“原始提纯基线”Commit
→ 再讨论并批准 LCOS Adapter / Run 接线
```

未经 Dz 再次确认，不得：

- 把整个外部 Bridge 目录复制进 LCOS；
- 把外部 Bridge 的 Runtime 数据或任务历史提交进 LCOS；
- 启动正式 Bridge 接线；
- 修改 Canonical Run、ArtifactReturn 或 Current Revision 语义；
- 把 Bridge `task_id` 当成 LCOS `runId`；
- 将 Watcher inbox 路由描述成 LCOS 文件 Watcher。

提纯基线 Commit 与后续 Adapter 接线 Commit 必须分开，确保可以独立审计和回滚。

### Slice 5：结果回收

```text
changed_files
→ Staging
→ ArtifactReturn.pending_review
→ Path Guard / Resolver
→ Draft Revision
→ Accept / Retry / Reject
→ Restart
```

最低真实路径：

```text
script-current.md
→ WorkBuddy
→ outputs/script-draft-<runId>.md
→ Draft Revision
→ 用户 Accept
→ Current 指针更新
```

要求：

- MVP 不覆盖源文件，先创建新输出文件。
- 执行完成不等于用户接受。
- Accept 后 Draft 才能成为 Current，旧 Current 变为 Superseded。
- Reject 保留历史证据，但不能成为 Current。
- Retry 创建新 Run，并通过 `retryOf` 引用旧 Run。
- 刷新和 Local Core 重启后 Run、Return 与 Revision 关系必须恢复。

## 5. 当前断点

分支与基线：

```text
branch: codex/mvp-fast-build
MVP 1.0 Runtime UI closure base HEAD: d374628
```

已完成，不重复：

- 回退错误的 Runtime Source Gate。
- Slice 1 的 Canvas Drop → Import Copy 主链。
- Local Core 项目内 `imports` 安全写入。
- FileRecord / Artifact / Initial Revision / ArtifactView 原子登记。
- MD / TXT / PNG / JPG / JPEG / WEBP Import Copy。
- Import Copy 按 `projectId + importRequestId` 隔离幂等身份。
- 不兼容重放返回 `409 CONFLICT`。
- Browser 路径字段拒绝。
- Import Copy 定向 Local Core 测试 `40/40` 通过。

新增完成，不重复：

- Slice 2 Runtime Reference / Feedback Relation 投影。
- ContextManifestV0 确定性 Builder。
- Project Truth → Handoff Preview / Copy / Download。
- Slice 3 手动 Refresh 状态链。
- 显式 Adopt External Change → New Revision。
- 旧 Revision Superseded、Current 指针和跟随 View 更新。

当前完成：

```text
MVP 1.0：v0.7 UI → Canonical Run → Bridge / WorkBuddy → Draft Return
→ Accept / Reject / Retry → Restart Recovery 已接通
```

下一步唯一动作：

1. 复核 `docs/handoffs/MVP_AGENT_CONTEXT_BRIDGE_V1_MERGE_GATE_20260730.md`。
2. 等待 Dz 明确要求后提交；不得自动 Push。
3. 后续再讨论并回主开发线，不在本分支擅自开始新规划。

2026-07-30 新增完成，不重复：

- Light Bridge 升级到 `0.2.0 / bridge-task-v1 / bridge-result-v1`。
- Local Core 默认使用 `127.0.0.1:43122/mcp`，并以 capabilities 选择 V1，
  不做失败后的 Legacy 双发。
- 真实 Canary 已完成 `Run → claim → start → result → Bridge Restart →
  ArtifactReturn → Accept`。
- 新增 LCOS Agent CLI、stdio Project MCP 与 `lcos-project-context` Skill。
- Agent 可主动 claim/start/submit Light Bridge pull Task。
- 新增 ActiveContext API；Canvas 的 Workspace、选择、Pin/Exclude 投影给 MCP。
- `?agent=1&project=<id>` 在 Agent 内置浏览器显示同一 Canvas 和 Agent Context
  Surface，不建立第二套 Canvas Truth。
- 飞书 URL 生成 `.link.md` Artifact；显式选入 Context 时进入不可变
  ContextManifest。
- 历史 `scope-root` / `scope-mvp-root` 漂移在 Web Runtime 投影层兼容归一，
  不执行 Schema Migration。
- 定向质量结果：Typecheck PASS；相关 Vitest `33/33`；Bridge Pytest `26/26`；
  Web/Local Core Lint 无 error；浏览器控制台无 error/warn。

已完成，不重复：

- 四份 Bridge 迁移材料与 v1.2 Runtime / Context / Retry 补充规范复核。
- 提纯的无状态 Bridge Core 位于 `tools/ai-bridge-runtime/`。
- Runtime Root 改为显式配置，服务只允许 `127.0.0.1`。
- 凭证、Runtime 快照、watcher、companion、Route C、用户 Skills / Memory 已排除。
- Bridge Core 与 Adapter 接线保持分离。
- Slice A Canonical Run / RuntimeDispatch / RuntimeBinding / ArtifactReturn
  Schema v6 与最小 Repository。
- Slice B `bridge-task-v0` / `bridge-result-v0` 合同。
- `lcos_run_id + idempotency_key + request_fingerprint` 原子幂等创建。
- `get_task_by_lcos_run_id` 重启恢复查询。
- Bridge capabilities / contract version 与结构化错误。
- 脱敏 TaskEnvelope / ResultEnvelope Fixture。
- Slice B.5 真实 WorkBuddy `assigned → running → review`。
- RuntimeInputPack 只读、唯一 Staging 输出和 ResultEnvelopeV0 回传验证。
- Slice C 不可变 RuntimeInputPack 物化。
- Local Core → Bridge MCP loopback Adapter。
- RuntimeDispatch `dispatching / bound / recovery_required` 状态落库。
- `get_task_by_lcos_run_id` 优先恢复与 RuntimeBinding 持久化。
- Provider 状态显式同步，`review / timeout` 不进入 Canonical Run。
- Slice D1 Fake ResultEnvelope 通过同一安全 Ingestion。
- Result 双层合同、四级 realpath / junction Path Guard 与内容 Hash。
- FileRecord + Draft Revision + ArtifactReturn 原子、幂等落库。
- Base Revision 过期可由 Current 与 `baseRevisionId` 重算。
- 取消后迟到 Result 只保留 Evidence，不创建 Draft。
- Slice D2 真实 WorkBuddy `assigned → running → review`。
- 真实 ResultEnvelope 已生成 Pending Return / Draft 并通过重启恢复。
- Slice E0 Generic Mutation / Snapshot Save / Artifact PUT Current Guard。
- Slice E1 Accept CAS 原子推进 Draft → Current、Current → Superseded。
- Slice E2 Reject 保留 Draft Evidence，ArtifactReturn → rejected。
- Slice E3 Retry 创建新 Canonical Run / RuntimeDispatch，并写入 `retryOfRunId`。
- Run Review 聚合读取与 versioned capability 投影。
- `review` 只作为 UI presentation phase，不进入 Canonical Run。
- v0.7 App Shell 已选择性接入并保留现有 Canvas / Work Rail。
- Runtime UI 已真实创建 Canonical Run，不再使用定时器模拟。
- RuntimeDispatch / RuntimeBinding / provider 状态在浏览器刷新和 Local Core 重启后恢复。
- WorkBuddy `changed_files` 已摄取为 Pending ArtifactReturn + Draft Revision。
- Accept / Reject / Retry UI 已接入正式 Domain API。
- Accept 后 Primary ArtifactView 跟随新的 Current Revision；
  `explicit_additional` View 继续固定到指定 Revision。
- 真实 E2E `run-d190abd4-d23a-4872-98c4-bd8a06bb9216` 已完成：
  WorkBuddy review → Draft → Accept → Bridge completed。

## 6. ContextManifestV0 最低字段

```text
schemaVersion
builderVersion
project
target
currentRevision
feedback
lockedElements
references
requestedOutput
orderedItems
truncationMetadata
renderedManifestHash
```

边界：

- 不含绝对本机路径。
- 不含 Provider 专属字段。
- 从 Project Truth 构建。
- 可持久化或稳定重建。
- 同时服务人工 Handoff 和 RuntimeInputPack。

## 7. Revision 冻结规则

```text
Artifact.currentRevisionId
= 唯一 Current Truth
```

MVP V1 生命周期：

```text
Initial Import Revision
Manual Draft
AI Returned Draft
Accept
Reject
Adopt External Change
```

状态表达：

```text
ArtifactRevision: Draft / Current / Superseded
ArtifactReturn: Pending Review / Adopted / Rejected
```

若当前 Domain 状态枚举不足，先写 Decision 与影响说明，再做最小扩展；不得在 Web
复制另一套 Revision 语义。

## 8. 开源采用与许可证

可以直接依赖或使用公开 API：

```text
xyflow / React Flow
Zustand
ELK.js
PDF.js
Motion
LangGraph.js
PocketFlow
TanStack Query（按需求后置）
```

只允许研究模式，禁止复制 Production 代码：

```text
ComfyUI / ComfyUI Frontend
n8n
Dify
ReactBits
```

只研究公开行为与调用合同：

```text
LibTV Skills
```

LCOS 必须自研：

```text
Project / Scope / Workspace Domain
Artifact ≠ ArtifactView
ArtifactRevision
ContextManifest / ContextSnapshot
ArtifactReturn
Current Revision Policy
External File Identity
Path Guard
Safe Write
Accept / Retry / Reject
```

## 9. 每个功能的 Decision 记录

每个功能实现或交付文档必须写：

```text
Decision

LCOS Function:
要解决的具体产品能力

Open-source Evidence:
- 项目
- [SRC-*]
- 本机 exact path

Adoption Mode:
- direct dependency
- clean-room pattern
- behavior-only
- LCOS self-build

What We Borrow:
具体借什么

What We Do Not Borrow:
哪些 Domain / Lifecycle 不采用

Implementation:
LCOS 文件与边界

Tests:
Architecture / Integration / E2E

License:
许可证与隔离处理
```

不能只写“参考 ComfyUI / n8n / 最佳实践”。

## 10. 开发与测试节奏

当前采用 Dz 批准的“大版本集中测试”节奏：

```text
连续完成同一纵向 Slice
→ 静态检查
→ 仅在风险会扩散时跑定向测试
→ 小而可审查的提交
→ 五个 Slice 完成后集中质量链和浏览器验收
```

开发期间：

- 不在每个小改后运行完整 `check:fast`。
- UI 小改优先留给阶段末手工浏览器验收。
- 后端安全边界只跑相关测试文件。
- 不用“暂未跑全套测试”冒充“已通过”。

MVP V1 最终集中验收：

```text
lint
→ typecheck
→ unit
→ build
→ integration
→ architecture
→ Core Golden Path E2E
→ Restart Recovery
→ 手工浏览器验收
```

## 11. 最终完成线

只有下面这条链真实完成，MVP V1 才能宣布完成：

```text
用户拖入真实 Markdown 脚本与图片
→ Runtime 持久化并生成 Preview
→ 绑定 Reference / Feedback / Decision
→ 从 Project Truth 生成 ContextManifestV0
→ WorkBuddy 修改脚本
→ changed_files 回收到 Draft Revision
→ 用户 Accept / Retry / Reject
→ 浏览器刷新和 Local Core 重启
→ Project、Run、Return、Revision 和 Current 关系完整恢复
```

任何一步如果仍是 Fixture、Mock、占位、手工复制或未验证，必须明确标记，不能宣布
完整纵向 MVP 已完成。

## 12. 上下文压缩后的固定续接格式

压缩摘要必须至少写：

```text
仓库 / worktree:
branch / HEAD:
worktree 是否干净:

总任务:
按 MVP_V1_EXECUTION_README.md 完成五个纵向 Slice。

已完成且不要重做:
- ...

当前 Slice:
- ...

正在修改:
- ...

已运行的定向测试:
- ...

尚未运行的集中测试:
- ...

下一步唯一动作:
- ...

禁止误入:
- 不返回旧 Stage 编号
- 不重复已完成审计
- 不把 Fixture 当 Runtime
- 未与 Dz 商量前不导入或接线 Bridge
```
