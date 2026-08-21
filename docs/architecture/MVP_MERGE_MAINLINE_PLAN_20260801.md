# LCOS MVP 合并主线方案（v1.0 · 供 GPT 评审）

> 日期：2026-08-01
> 作者：Codex（Local Creative OS 开发线）
> 目的：自包含说明当前 MVP 状态与"合并主线前"的七个功能标准，以及分片实施计划；请评审者重点看第 5 节方案与第 8 节开放问题。

---

## 1. 项目背景（30 秒版）

Local Creative OS（LCOS）是一个本地运行的个人创意项目操作系统：用户在一个持续存在的 Project Canvas 上看资料、写判断、给 Agent 派活，并把 AI 修改过的文件与版本自动收回项目。

一句话价值主张：**用户换 Agent，不换项目大脑。**

当前阶段：MVP V1 纵向闭环已真实跑通（单项目、单用户、单执行器 WorkBuddy、Markdown/图片等有限格式），正在收口并准备合并主线。

## 2. 当前已具备的真实能力

| 能力 | 状态 |
|---|---|
| SQLite Project Truth（schema v6，可迁移、可恢复） | ✅ 真实 |
| Import Copy（拖入文件 → FileRecord → Revision → View → Preview） | ✅ MD/TXT/PNG/JPG/JPEG/WEBP |
| ContextManifestV0（从 Project Truth 构建，不可变） | ✅ |
| Canonical Run + RuntimeDispatch + RuntimeBinding | ✅ |
| Light Bridge 0.2.0（提纯内核，REST/MCP/CLI，claim/start/submit，幂等，重启恢复） | ✅ |
| 真实执行闭环：WorkBuddy 改文件 → changed_files → Draft Revision → Accept/Reject/Retry | ✅ 有真实 E2E 证据 |
| LCOS 自有 stdio MCP + CLI + Agent Skill | ✅ 基础版 |
| Agent 内置浏览器打开同一 Canvas（`?agent=1&project=<id>`）+ ActiveContext 投影 | ✅ 基础版 |
| 飞书链接节点（`.link.md`）生成 | ✅ |
| 正式 Project Create（用户建自己的真实项目） | ✅ 近期补完 |
| Runtime Source Gate（禁静默回退 Fixture） | ✅ 近期补完 |
| E2E（含真实建项目、重启恢复、缺失项目显式报错） | ✅ 6/6 |

已知边界（有意不做的）：真实 `waiting_input`、Watcher 自动观察、PPT/DOCX 修改、多执行器（当前只有 WorkBuddy）、飞书正文授权读取、SSE 实时推送。

## 3. 合并主线前的新标准（需求方 2026-08-01 定义）

1. **工作流常用文件都能正常上画布**（不只是 MD/图片）。
2. **右侧栏 = 动态 Project Workbench（结构化工作台）**：不是 Storyboard 分镜工具，而是按当前上下文变形的管理面板。
3. **Agent 内置浏览器打开 LCOS = tldraw/Cowart 式实时上下文**：画布成为 Agent 可实时读取的视觉上下文。
4. **Run 执行者可选：Buddy 或 Codex**。
5. **CLI 让两侧 Agent 直接管理画布**（读取、选择、移动、备注等）。
6. **画布免发送自动成为本地 Agent 的上下文**（Agent 通过 MCP/CLI 直接读，不靠用户复制粘贴）。
7. **Codex 主动接单唤醒**（用户在 LCOS 点 Run 后，Codex 能自动或半自动领取任务执行）。
8. 以上功能稳定、可验证后，才合并主线。

## 4. 前期讨论已冻结的设计原则

以下结论来自需求方与开发方此前对三个开源项目（Codex Storyboard、Cowart、tldraw）的分析，应作为本方案的硬约束：

1. **借思想，不借壳**：Storyboard 的本质不是分镜，而是"把复杂创作任务转换成 Agent 和人都能共同操作的结构化工作状态"（结构化对象 / 当前工作焦点 / 人机共同维护的工作队列 / 可视化的 Agent 控制面）。LCOS 右侧栏应做 **Project Workbench**，Storyboard 只是未来视频领域的投影。
2. **不制造第二张 Canvas Truth**：Agent 浏览器与 MCP 读取同一份 Project Truth；不引入 tldraw 作为新的画布真相源。
3. **"实时"有三种含义，只做前两种**：① Agent 随时可读画布状态；② 画布变化即时同步到 Agent 的 Context；③ Agent 执行中用户改画布就改任务——③ 不做（破坏 Run 可复现性）。
4. **Agent 的"实时"不等于持续观察**：画布持续更新 + Agent 下次调工具取最新快照 + 用户明确发起后读取。
5. **ActiveContext 是瞬时工作态，ContextManifest 是 Run 的持久化真相**：重启后恢复的是 Manifest 与 Project Truth，不承诺恢复瞬时选区。
6. **Canonical Run 语义纯净**：LCOS 保存 Run；Bridge `task_id` 只是外部映射；`review` 只是 UI 展示阶段，不进入 Canonical Run 状态枚举。
7. **双执行器不改变 LCOS 边界**：执行器通过 Provider Port 接入；谁执行不影响 Project Truth、Artifact、Revision 与 Current 语义。

## 5. 分片实施计划（Slice A–F）

### Slice A：执行者选择（Buddy / Codex）

- **目标**：Run 创建时可指定执行者 `workbuddy | codex`；UI 可选择；Binding 持久化执行者身份。
- **现状**：RuntimeAdapter 固定接 WorkBuddy；RuntimeBinding 已有 provider 概念但无选择入口。
- **方案**：
  1. `CreateRuntimeRunInput` 增加 `executor` 字段（默认 `workbuddy`）。
  2. Local Core 在 RuntimeDispatch/Binding 落库时记录 executor；Light Bridge 侧通过 `--provider` 参数路由（已支持 provider-agnostic claim）。
  3. Web RunConfirmDialog 增加执行者选择；Work Rail 显示当前执行者。
  4. Codex 作为执行者的"任务如何被领取"由 Slice C 提供；本片只保证"能创建、能记录、能路由"。
- **修改模块**：contracts、runtime-application-service、runtime-adapter、server、web RunConfirmDialog/WorkRail、测试。
- **验收**：创建 Run 带 executor 落库并恢复；不同 executor 的 Run 在 UI 可区分；typecheck/unit/E2E 绿。
- **风险**：低。不改 Canonical Run 状态机，不改 Schema（复用 RuntimeBinding.provider）。

### Slice B：CLI / MCP 画布管理

- **目标**：Codex 与 Buddy 通过 CLI/MCP 直接读画布、选节点、移动 View、写备注；写操作过安全边界。
- **现状**：lcos CLI 与 MCP 已有 claim/start/submit/get、ActiveContext 读取；无画布写操作。
- **方案**：
  1. Local Core 增加最小画布操作接口（复用现有 mutation API）：`canvas/get`（快照）、`canvas/select`（ActiveContext）、`canvas/move`（ArtifactView 坐标）、`canvas/note`（文件/视图备注）。
  2. MCP 增加 4 个薄委托工具；CLI 增加 `lcos canvas get/select/move/note` 子命令；更新 `lcos-project-context` Skill。
  3. 安全：写操作只允许 View/Note/Selection 层，不允许直接改 Artifact/Revision/Current；全部走既有 Path Guard 与项目边界。
- **验收**：真实 MCP E2E（调用 → Local Core 状态变化 → 再次读取一致）；CLI 集成测试；越权写被拒绝。
- **风险**：中。写操作与 Web 并发编辑冲突 → 沿用 mutation 版本号（STALE_GRAPH_VERSION 409）机制。

### Slice C：Codex 主动接单唤醒

- **目标**：用户点 Run 后，Codex 能自动/半自动领取并执行任务，不需要用户去 Agent 对话里喊"接任务"。
- **现状**：WorkBuddy 侧有 watcher/Automation 拉取；Codex 侧没有常驻执行器；MCP claim→start→submit 链路已真实跑通（人工触发）。
- **方案（选型，需评审）**：
  - **C1（推荐起步）**：`lcos-agent watch` 常驻 CLI 守护——轮询 Light Bridge 的 queued 任务，按 executor=codex 过滤，自动 claim 后调用 Codex CLI（`codex exec`）执行任务，完成后 submit_result。
  - **C2**：Codex 桌面 Automation（定时检查 + 唤醒会话）——适合提醒用户确认，不适合无人值守执行。
  - **C3**：事件订阅/长轮询 + 系统/飞书通知——作为补充提示层。
  - 建议 C1 为主、C2/C3 为提示辅助。
- **关键链路**：LCOS 点 Run → Canonical Run → Light Bridge queued task → `lcos-agent watch` claim → Codex 读取 MCP 上下文与 TaskEnvelope → 修改项目文件 → submit_result → LCOS 回收 Draft → Accept/Reject/Retry。
- **风险**：高（涉及"Agent 自己醒过来"）。要点：执行器失活/心跳恢复；Codex 并发与 WorkBuddy 的取件冲突（Write Lease 目前 Alpha 只有单写 Run）；`codex exec` 运行时的目录与授权边界；禁止 Codex 未经 LCOS 回收直接覆盖 Current。

### Slice D：右侧 Project Workbench（结构化工作台）

- **目标**：右侧栏按上下文动态变形，统一管理项目状态、选中对象、Context Set、Run 与返回结果。
- **现状**：右侧为 WorkRail + Inspector；数据（ActiveContext、RunReview、ArtifactReturn）已存在，但没有统一工作台状态模型。
- **方案**：
  1. 定义 Workbench 五态：项目总览（未选中）/ 文件（选中单个）/ Context Set（多选）/ Run 进行中 / 结果返回（Pending Review）。
  2. 全部数据来自现有 API，**不新建数据库、不引入 Storyboard 领域模型**；Storyboard 只留投影接口。
  3. UI：改造现有 WorkRail 区域；每个状态展示对应操作（版本/引用/备注、Context 增删、执行者、取消、Accept/Retry/Reject）。
- **验收**：五态切换 E2E；与 Inspector 边界明确（Canvas 管关系 / Inspector 管对象详情 / Workbench 管批量与执行）。
- **风险**：中。避免做成"第二个 Inspector"；信息密度遵守既有 UI 冻结规则。

### Slice E：工作流常用文件覆盖补全

- **目标**：PPT、PDF、视频等需求方工作流实际使用的文件能上画布，且有明确预览或降级。
- **现状**：MD/TXT/图片完整；PPT 可识别但 `previewUnsupported`；PDF 第一页可选未做；视频只保存路径/封面/元数据。
- **方案**：按真实使用频率排序——PPT 缩略图/首页、PDF 第一页预览、视频封面与元数据节点；不支持的能力一律显示明确降级标签，不伪装。
- **验收**：各格式导入/预览/降级路径 E2E；无 `previewUnsupported` 伪装。
- **风险**：中。Windows 转换链（PPT→PDF→图片）稳定性是已知风险点，需 Spike。

### Slice F：实时上下文（tldraw 式体验）

- **目标**：Agent 内置浏览器里，画布选择与上下文变化即时可见（可读取级实时）。
- **现状**：`?agent=1` 打开同一 Canvas + ActiveContext 投影；更新为 150ms debounce 写入 + 3s 轮询。
- **方案**：
  1. ActiveContext 增加版本号与变更事件（轻量 SSE 或版本轮询，二选一由评审决定）。
  2. Agent Browser 的 Context Surface 实时刷新（选择、Pin/Exclude、视口）。
  3. 明确不做"执行中改画布自动改任务"。
- **验收**：浏览器 E2E：选择节点 → Agent Context Surface 即时更新；版本号单调递增；刷新后从 Project Truth 恢复。
- **风险**：中。SSE 生命周期与 Local Core 重启恢复；多 Agent 同时读同一 ActiveContext 的一致性。

## 6. 依赖与顺序

```text
A 执行者选择 ──→ C Codex 主动接单唤醒
B CLI/MCP 画布管理 ──→ D 右侧 Workbench
                   ──→ F 实时上下文
E 文件覆盖补全（独立，可并行）
```

建议实施顺序：**A → B → C → D → F → E**（E 可随时插入并行）。

## 7. 测试与验收策略

- 沿用"大版本集中测试"节奏：连续完成同一 Slice → 静态检查 → 定向测试 → 小提交 → 合并前集中质量链。
- 合并前全链：lint → typecheck → unit → build → integration → architecture → E2E → Restart Recovery → 手工浏览器验收。
- 诚实条款：任何 Fixture / Mock / 占位 / 未验证能力必须明确标注，不得宣布完成。
- 每个 Slice 交付：修改文件清单、真实测试结果、风险、回滚说明。

## 8. 开放问题（请评审重点回答）

1. **Codex 主动接单的选型**：C1（`lcos-agent watch` 常驻守护 + `codex exec`）、C2（桌面 Automation 提醒）、C3（事件通知）——哪个组合在"可靠、简单、不越权"上最优？常驻守护的失活/心跳如何最小化实现？
2. **Codex 作为执行者的协议**：直接复用 Light Bridge 的 claim/start/submit 是否足够？Codex 执行时读写项目文件的安全边界（Path Guard 已有）还需要什么？
3. **双执行者并发**：Write Lease 当前 Alpha 只有"单写 Run"。Codex 与 WorkBuddy 同时在线后，是否需要先实现正式 Write Lease，还是保持单写 + 409 冲突即可？
4. **Workbench 与 Inspector 边界**：五态 Workbench 与现有 Inspector（对象详情/关系）如何避免功能重叠？是否有更优的信息架构？
5. **实时性的实现**：ActiveContext 变更用 SSE 还是版本号轮询？考虑 Local Core 重启、多 Agent 并发读取与实现成本。
6. **飞书正文注入**：仍缺授权读取，建议继续后置到合并之后，还是合并前需要最小授权方案？
7. **文件覆盖**：PPT/PDF 预览的 Windows 转换链成本高，建议"首页缩略图 + 明确降级"作为合并前标准是否可接受？
8. **executor 字段归属**：建议 Canonical Run 不新增字段，执行者只存在于 RuntimeBinding——是否同意？（保持 Run 状态机纯净）

## 9. 合并主线最终验收口径

以下全部满足才合并：

- 七个标准（第 3 节）全部真实可用并有验证证据；
- 全质量链与 E2E 绿；手工浏览器验收通过；
- 无双真相：画布/Project Truth 仍只有一份；
- 无未标注 Fixture/Mock；
- 所有高风险操作有日志、确认与回滚路径。

---

_Codex 2026-08-01 生成，供评审与决策使用。_
