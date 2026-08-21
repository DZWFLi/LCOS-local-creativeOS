# MVP V1 Slice 4 Bridge 迁移研究包复核

Date: 2026-07-29
Branch: `codex/mvp-fast-build`
Review start HEAD: `f1d2474`
Status: Decision approved and used for purified baseline import; no Adapter wiring started

## 1. 任务摘要

本轮只读复核以下四份材料，并据此修订 Slice 4 的 Bridge 提纯方案：

- `E:\Codex 项目\buddy协同测试\AI_Bridge_协同现状与使用指南.md`
- `E:\Codex 项目\buddy协同测试\AI-Bridge_Migration_Research_Package_20260728_130710.zip`
- `E:\Codex 项目\buddy协同测试\Bridge迁移研究包说明.md`
- `E:\Codex 项目\buddy协同测试\AI_Bridge_当前技术进展与ContextPack评估稿.md`

研究包解压到临时审计目录：

```text
C:\Users\1\AppData\Local\Temp\lcos-bridge-migration-review-20260729
```

该目录不是 LCOS 项目内容，不进入 Git。

## 2. 结论

迁移 ZIP 不能直接作为“已脱敏、可复现的 Bridge 基线”导入 LCOS。

正确方案是：

```text
迁移包只作证据
→ 从 bridge-source 选取最小核心源码
→ 排除 Runtime、凭证、个人路由和旧执行器
→ 补齐 LCOS 所有权说明、依赖清单和安全默认值
→ 提交独立 Purified Baseline
→ 再单独批准并实现 LCOS Bridge Adapter
```

目标目录仍建议：

```text
tools/ai-bridge-runtime/
```

但导入范围比 `MVP_V1_SLICE4_BRIDGE_PURIFICATION_GATE_2026-07-29.md`
中的初版建议更窄：`workbuddy_watcher.py` 不进入首个基线，`companion/` 整体不进入。

## 3. 关键证据

### 3.1 ZIP 与说明不一致

ZIP 的 `MANIFEST.json` 共记录 163 个文件，其中：

- 63 个 `.pyc`；
- 7 个 `runtime-snapshot` 文件；
- 1 个 `companion/.token_private.json`。

而随包说明称已排除 `__pycache__`，并称只保留脱敏 MCP 配置模板。
因此该 ZIP 只能视为研究快照，不能视为安全发布包。

### 3.2 ZIP 含明文私有 Worker 凭证

`bridge-source/companion/.token_private.json` 含明文 Worker 密码。本文不记录其值。

处理要求：

- 永不导入 LCOS；
- 永不写入文档、日志、任务正文或 Git；
- 在继续使用原 headless worker 前轮换该凭证；
- 研究包本身按含敏感信息文件管理，不对外分发。

### 3.3 源码快照与当前外部目录一致

以下关键文件的 SHA-256 与 `E:\Buddy项目\ai-bridge` 当前版本一致：

- `bridge_server.py`
- `workbuddy_watcher.py`
- `app/services/tasks.py`
- `app/services/results.py`
- `app/runtime/storage.py`
- `tests/test_core_flow.py`
- `tests/test_watcher_semantics.py`

研究包可用于确认源码版本，但不能解决外部目录缺少可复现 Git 基线的问题。

### 3.4 已验证与未验证能力必须分开

材料能证明：

- Task / Session / Result / Artifact 服务分层存在；
- `running -> review -> completed` 的人工验收边界存在；
- `changed_files` 与 `artifacts` 分离；
- watcher 曾承担项目 inbox 路由；
- Route C headless worker 曾完成两次受控 E2E。

材料同时明确：

- watcher 未形成通用 Executor Adapter；
- companion 投递正文仍硬编码 proof 任务；
- headless run 不继承 WorkBuddy UI 对话历史；
- 自动后台接单不是稳定通用能力。

此外，当前仓库级规则已明确 Route C headless worker 退役。历史 E2E 只作为
行为证据，不作为 Slice 4 当前 Executor 实现。

### 3.5 Runtime 快照证明真实使用，但不是可导入真相

只读统计结果：

```text
Tasks       50
Sessions    15
Artifacts   26
Metrics     31
```

Task 状态：

```text
completed  20
review     16
running    12
assigned    1
cancelled   1
```

关联数据：

```text
44 / 50 Tasks 有 session_id
22 / 50 Tasks 有 changed_files
17 / 50 Tasks 有 artifacts
 0 / 15 Sessions 有 conversation_id
```

这些数据证明 Bridge 被真实使用过，不只是接口草图；同时也证明：

- Bridge Session 不是 WorkBuddy Conversation Resume；
- `running` / `review` 有长期积压，stale / timeout / review reconciliation 不足；
- Demo 必须使用全新、显式指定的 Disposable Runtime Root；
- 历史快照不得导入 LCOS。

Artifact 快照中发现 3 个重复 `artifact_id`，每个重复 3 次。Bridge Artifact 只能作为
Provider Run Output Record，不能成为 LCOS Artifact / Revision Truth。

### 3.6 成熟度矩阵

| 能力 | 判断 | LCOS 采用结论 |
|---|---|---|
| Task 生命周期 | 可用 | 保留 Provider 状态机 |
| `changed_files` | 可用 | 仅作回传证据，后续经 Path Guard |
| Artifact 记录 | 部分可用 | 不映射为 LCOS Artifact Truth |
| Session 元数据 | 部分可用 | 仅保存外部 Session ID |
| Conversation Resume | 未成立 | MVP 不宣传 |
| `waiting_input` | 未成立 | MVP 不伪造；可保留 LCOS 枚举但不实现行为 |
| watcher inbox 路由 | 可用的历史能力 | 不进入首个基线 |
| 自动执行 | 半自动 / 路径已变化 | 不宣称无人值守 |
| JSON Runtime | 可用但简陋 | 不合并 LCOS SQLite |
| stale / timeout 清理 | 不足 | Demo 使用干净 Runtime |
| LCOS Artifact Return | 未接 | 后续 Adapter / Result Ingestion 实现 |
| 可复现安装 | 不足 | 提纯基线补依赖声明 |
| 安全打包 | 原包不合格 | 严格 denylist，凭证必须轮换 |

## 4. 修订后的提纯范围

### 4.1 首个 Purified Baseline 应包含

```text
tools/ai-bridge-runtime/
├── README.md
├── SECURITY.md
├── OWNERSHIP.md
├── pyproject.toml 或 requirements.txt
├── bridge_server.py
├── capability_registry.example.json
├── app/
│   ├── legacy/
│   ├── models/
│   ├── repositories/
│   ├── runtime/
│   ├── schemas/
│   ├── services/
│   └── validators/
├── docs/protocols/
│   ├── task-protocol.md
│   ├── result-protocol.md
│   ├── session-protocol.md
│   ├── artifact-protocol.md
│   ├── context-protocol.md
│   └── dispatch-protocol.md
└── tests/
    └── test_core_flow.py
```

导入时必须：

- 将 Runtime Root 改成显式配置，不能默认写入用户 Home；
- 默认只绑定 `127.0.0.1`；
- capability registry 只保留无个人路径的示例；
- 写明 Bridge `task_id` 不是 LCOS `runId`；
- 写明该目录是外部执行服务源码，不拥有 LCOS Project Truth；
- 补齐最小 Python 依赖声明，使测试环境可复现；
- 保留原始源码来源与本次净化规则。

### 4.2 首个基线明确不包含

```text
runtime-snapshot/
runtime/migrations/
companion/
workbuddy_watcher.py
watcher_config.json
watcher_protocol.md
start_bridge.bat
start_workbuddy_watcher.bat
test_auto.py
bridge_response_*.txt
app/web/
scripts/build_tech_docx.py
skills/
MEMORY.md
AGENTS.md
mcp.sanitized.json
个人派单模板与示例任务
个人绝对路径配置
__pycache__/
*.pyc
任何 Token / Key / Cookie / Password
```

理由：

- Runtime snapshot 是历史状态，不是源码；
- companion 是已退役 Route C 的 POC Adapter，且含凭证和硬编码任务；
- watcher 是 inbox 路由器，不是 LCOS 文件 Watcher，也不是当前获批 Executor；
- Skills、Memory、用户级 AGENTS 属于操作者环境，不属于产品 Runtime；
- Bridge Console 与启动脚本不是 Slice 4 最小执行闭环所必需；
- migration 和历史数据导入会把外部 Bridge 状态带入 LCOS，越过本轮边界。

### 4.3 Watcher 的后续处理

`workbuddy_watcher.py` 不删除其历史价值，但首个基线只记录其行为证据。

只有满足以下条件后，才单独讨论是否重写为 Adapter 插件：

- 当前正式 WorkBuddy Executor 路径已确认；
- `project_id` 与 LCOS Project 身份映射已冻结；
- background-enabled 必须显式开启；
- 不把 claim / inbox 路由当作 Canonical Run 已开始；
- 有取消、超时、并发和孤儿进程策略；
- 有独立测试，不依赖导入 `bridge_server.py` 才能检查 watcher 语义。

## 5. Context Pack 与 LCOS 的关系

不把 `.workbuddy/context/manifest.json` 作为第二套 Project Truth，也不把研究稿的
Context Pack 文件结构原样复制进 LCOS。

冻结映射：

```text
LCOS Project Truth
→ ContextManifestV0
→ RuntimeInputPack
→ Bridge task.context
→ WorkBuddy 按 refs / read_first 渐进读取
```

职责：

- `ContextManifestV0`：LCOS 的稳定、可重建项目理解快照；
- `RuntimeInputPack`：本次 Run 的最小执行输入；
- Bridge `context`：只承载运行所需摘要、引用、约束和验收标准；
- WorkBuddy：保留临时推理和内部拆解，不回写为 LCOS Project Truth。

建议的 RuntimeInputPack 最小投影：

```text
schemaVersion
runId
contextManifestId
inputFiles[{entityId, absolutePath, readOnly:true}]
expectedOutputs[{absolutePath, mode:create_new_file}]
contextFilePath
```

其中本机路径不能出现在浏览器请求或 `ContextManifestV0`。必要的绝对路径只能由
Local Core / Bridge Adapter 在受信任边界内解析，并必须经过 Project Path Guard。

`ContextManifestV0` 必须不可变，Markdown Handoff 只能由 Manifest 渲染。Provider、
Bridge Task/Session、Runtime Root、Staging 和绝对路径都不得进入 Manifest。

## 5.1 Canonical Run / Provider 状态冻结

依据：

```text
C:\Users\1\Desktop\OS开发\MVP重构\bridge导入\
LCOS_MVP_v1.2_Runtime_Context_Retry_Codex_Supplement.md
```

正式边界：

```text
LCOS canonical Run
≠
Bridge Task / Provider Status
```

Provider `review` 表示执行完成：

```text
LCOS Run = completed
ArtifactReturn = pending_review
```

`assigned / review / timeout / retrying` 不进入 LCOS Run 状态。Bridge 的旧
`retrying` 仅是 Provider 兼容细节；用户 Retry 必须创建新 LCOS Run，并记录
`retryOfRunId`。

一旦开始 Bridge Stretch，RuntimeDispatch / Outbox、`idempotencyKey=runId` 和启动
恢复是 P0。当前 Bridge 尚不支持按 `context.lcos_run_id` 幂等创建，也没有
`get_task_by_lcos_run_id`，因此在补齐其中一个合同前不得宣称 Dispatch Crash
Recovery 已成立。

## 6. 变更前后流程

### 变更前认知

```text
复制 Bridge 核心 + watcher
→ 放入 tools/
→ 后续接 LCOS Adapter
```

### 修订后流程

```text
迁移包仅作证据
→ 轮换泄露的 Worker 凭证
→ 仅提纯无状态 Bridge Core
→ 补依赖、所有权、安全默认值
→ 独立 Baseline Commit
→ 冻结 RuntimeInputPack / Run Mapping
→ 另行批准 Adapter Commit
→ 最后才评估正式 Executor 路由
```

用户可见流程本轮无变化；数据库和 Schema 本轮无变化。

## 7. LCOS / Bridge 边界

LCOS 拥有：

- Canonical `lcosRunId`
- ContextManifestV0 / RuntimeInputPack
- Run、RunEvent、afterSeq 和外部映射持久化
- Project Path Guard
- ArtifactReturn
- Draft Revision
- Accept / Retry / Reject / Current

Bridge 拥有：

- 外部 `task_id`
- create / claim / start / submit-result / review 原语
- Executor 路由所需的临时状态
- 结构化 `changed_files` / `artifacts` 回传

不得借入：

- Bridge runtime JSON 作为 LCOS Project Truth；
- `task_id` 充当 `lcosRunId`；
- Bridge 自动接受 Revision；
- Bridge 或 watcher 直接切换 Current；
- 外部任务历史作为 LCOS 初始数据。

## 8. 测试与证据

本轮只读运行：

```text
python -m unittest tests.test_core_flow -v
```

结果：6/6 PASS。

另运行：

```text
python -m unittest tests.test_watcher_semantics -v
```

结果：未通过加载，环境缺少 `mcp` 包；测试因 `workbuddy_watcher.py -> bridge_server.py`
的导入耦合而在收集阶段失败。未安装新依赖。

这进一步支持首个提纯基线不带 watcher，并要求补齐可复现依赖声明。

未运行 LCOS 全量质量链；本轮没有产品代码变更。

## 9. 风险

- ZIP 已包含明文凭证，继续分发存在安全风险；
- 外部 Bridge 没有明确许可证文件；
- 外部 Bridge 目录不是稳定 Git 基线；
- 依赖未声明，无法保证新机器可复现；
- `changed_files` 使用绝对路径，与 LCOS 安全边界存在语义差异；
- 历史 Route C E2E 容易被误述为当前正式 Executor；
- Context Pack 若独立持久化项目事实，会与 LCOS Project Truth 漂移。

## 10. 回滚

本轮只新增审计文档。删除该文档即可回滚；未复制 Bridge 源码，未修改外部 Bridge，
未改 Schema，未启动 Bridge，未接 WorkBuddy。

## 11. 已批准的基线动作

Dz 已批准：

```text
按本文 4.1 / 4.2 范围
→ 创建 tools/ai-bridge-runtime/
→ 导入并净化无状态 Bridge Core
→ 补 README / SECURITY / OWNERSHIP / 依赖声明
→ 跑 core focused tests
→ 单独提交 Purified Baseline
→ 停止
```

## 12. 下一批准点

本次批准不自动包含：

- LCOS Canonical Run Schema；
- Adapter 接线；
- WorkBuddy Executor 启动；
- watcher；
- runtime snapshot 导入；
- Artifact Return / Accept / Retry / Reject 实现。

下一步必须先输出 Runtime / Dispatch / Retry 影响说明，尤其确认：

- 当前 LCOS Schema 与 Supplement 建议表是否重复；
- Bridge 采用 `lcos_run_id` 幂等创建，还是提供恢复查询；
- Provider 状态映射；
- RuntimeInputPack 的受信任路径物化；
- Result Ingestion 幂等键；
- Retry New Run；
- 不实现假的 `waiting_input` 或 Conversation Resume。
