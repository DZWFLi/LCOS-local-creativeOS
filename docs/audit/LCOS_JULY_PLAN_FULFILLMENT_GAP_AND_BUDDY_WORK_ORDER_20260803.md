# LCOS 2026 年 7 月规划兑现缺口审计与 Buddy 接管工作单

> 日期：2026-08-03  
> 审计基线：`codex/backend-hardening-20260802 @ 1a95b5c`  
> 目的：停止把“类型、表、接口、测试或静态 UI 已存在”当作“用户流程已完成”，重新建立从规划承诺到真实产品行为的逐项验收账本。

## 1. 判定规则

| 标记 | 含义 |
|---|---|
| ✅ 已兑现 | 真实用户路径、Project Truth、失败路径和恢复均成立 |
| 🟡 部分兑现 | 只有部分层或部分格式成立，不能按完整能力宣传 |
| 🟠 接口/合同已存在 | 类型、Schema、Repository、HTTP、CLI 或 MCP 单层存在，但纵向链未闭合 |
| 🔴 未兑现 | 用户路径缺失、仍为 Fixture/前端状态、硬编码或实测失败 |
| ⚫ 已被替代 | 旧规划已由更新决策覆盖，不应继续实现旧方案 |

验收原则：必须同时检查 GUI、Local Core、Bridge、Agent、持久化、失败恢复和重启；任意一层缺失，不得写“已完成”。

## 2. 本次纳入的 7 月权威规划

1. `docs/architecture/LCOS_RUN_OUTPUT_INTENT_REDESIGN_PROPOSAL_20260730.md`
2. `C:/Users/1/Desktop/OS开发/MVP重构/LCOS_MVP_to_Mainline_Roadmap_20260730.md`
3. `C:/Users/1/Desktop/OS开发/MVP重构/LCOS_MVP_V1_完整OS纵向能力_开源借鉴矩阵_v1.0.md`
4. `C:/Users/1/Desktop/OS开发/MVP重构/bridge导入/LCOS_MVP_BRIDGE_SLICES_B_E_OPTIMIZED_PLAN.md`
5. `C:/Users/1/Desktop/OS开发/MVP重构/bridge导入/LCOS_MVP_v1.2_Runtime_Context_Retry_Codex_Supplement.md`
6. `C:/Users/1/Desktop/OS开发/MVP重构/LCOS_MVP_UI改版_借鉴Weavy能力入口与空画布工作流.md`
7. `C:/Users/1/Desktop/OS开发/MVP重构/mvp UI V0.7/0.7.1/LCOS_MVP1.0_Frontend_v0.7.1_Lightweight_UI_20260730/V071_LIGHTWEIGHT_UI_INTERACTION_SPEC.md`
8. `C:/Users/1/Desktop/OS开发/大重构调整/Local_Creative_OS_新总规划_v2.0_及旧MVP能力映射.md`
9. `C:/Users/1/Desktop/OS开发/MVP1.1架构/Local_Creative_OS_统一产品与架构规划_v3.0_架构师评审版.md`
10. 仓库内 7 月 Stage/Slice Review、MVP Closure、Bridge Gate、UI Integration 和 Agent/MCP Handoff。

更新规划优先于旧 MVP 实现细节；但旧文档中仍未被明确替代的安全、持久化、恢复和可触达要求继续有效。

## 3. 已真实兑现的基础

以下能力有真实代码与测试，但仍不能据此推导整套 OS 已完成：

- Project 创建/打开、Root Scope、Workspace、Graph SQLite 持久化。
- 文件与文件夹 Import Copy、FileRecord、Initial Revision、ArtifactView。
- UTF-8 中文文件名导入；PDF/PPTX 本地只读预览能力已存在。
- ResourceDescriptor、文件/文件夹/ZIP/Link 资源导入、读取、匹配与重分析。
- ContextManifest 持久化、canonical JSON、hash。
- Canonical Run、RuntimeDispatch、RuntimeBinding、ArtifactReturn 的数据库骨架。
- revise 单文件 Draft、Accept/Reject/Retry 的部分服务与测试。
- Light Bridge Kernel 的任务存储、claim/start/submit、请求指纹与部分恢复能力。
- CLI 的 Project/Context/Manifest/部分 Run/Resource/Task 命令。
- MCP 的 Project/Context/Manifest/Run 读取同步、Resource 和 Provider Task 工具。

## 4. 未兑现或只兑现一半的规划总表

### A. GUI、Canvas 与用户可触达性

| ID | 7 月承诺 | 当前证据 | 状态 | 必须补完 |
|---|---|---|---|---|
| UI-01 | 单击选择、双击打开主要内容 | 当前双击只处理 `opensScopeId`；PDF/PPTX 要 `? → 只读预览 → Modal` | 🔴 | 单击只选中/轻详情；双击文件进入右侧中部 Preview；Scope 双击进入子画布 |
| UI-02 | Inspector 为对象专用工作台 | 当前 WorkRail 主要是 Run/Composer，预览仍独立 Modal | 🔴 | 右栏拆成对象头、Preview/Edit/Compare/Review 中部、Agent Composer 底部 |
| UI-03 | 所有文件预览统一入口 | 图片/文本卡片、PDF/PPTX Modal 分散，DOCX 等无统一 Viewer Host | 🟡 | `ArtifactViewerRegistry`，图片/文本/PDF/PPTX/DOCX/音视频/Link/Fallback 统一只读入口 |
| UI-04 | 未来 Script/Storyboard 编辑器与预览共用工作区 | 尚无 Editor Host/Registry | 🔴 | 预留 `ArtifactEditorRegistry`，编辑只能产生 Working/Draft Revision |
| UI-05 | Canvas、Inspector、Agent Panel 共用 ActiveContext | Web 有 Selection，Core 有 ActiveContext PUT，但 Web 未写回 Selection | 🟠 | Selection debounce 写入 Core；三处订阅同一投影；重启恢复 |
| UI-06 | 关键功能可见、不是寻宝 | Import、Resource、Handoff、Preview、Run Review 多数藏在二级入口/特定状态 | 🔴 | 建立显性入口、能力地图、空状态引导和命令面板可发现性 |
| UI-07 | 真实 Checkpoint | GUI 按钮只 `setNotice('检查点已创建')`，未调用 Core | 🔴 | 调用正式 Checkpoint API，保存 Revision/Run/Canvas Snapshot 并可恢复 |
| UI-08 | Reference/Feedback/Decision 可真实操作 | Note/Context 基础存在，Change/Keep/Anchor、Decision 检索/写入不完整 | 🟡 | 结构化 Feedback/Decision 最小 UI、CLI 与 Context 投影 |
| UI-09 | 最小 Diff / Compare | ReviewSurface 仍以卡片式 before/after 为主，通用文本/结构 Diff 不完整 | 🟡 | 先完成 Markdown/text Diff；其他格式明确能力边界 |
| UI-10 | 失败入口可恢复 | Bridge 离线后仅产生 `recovery_required`，用户缺少清楚的一键启动/恢复路径 | 🔴 | 明确服务状态、恢复派发和不丢 Run 的 UI |

### B. Run Output Intent 与结果生命周期

| ID | 7 月承诺 | 当前证据 | 状态 | 必须补完 |
|---|---|---|---|---|
| RUN-01 | `create / revise / analyze` 成为真实产品语义 | Domain/Schema/API 有字段；Web 不传，Core 默认 `revise` | 🟠 | Run Composer 显式选择/推荐 Intent，确认页展示实际合同 |
| RUN-02 | analyze 允许零文件 | Result Ingestion 明确拒绝非 revise；真实“分析 PDF”被建成 revise | 🔴 | 结构化分析结果进入 Run Activity/Event；零文件正常完成 |
| RUN-03 | create 支持 1–N 新 Artifact | Adapter 仍只预声明一个 Markdown；Ingestion 只接受恰好一个文件 | 🔴 | Return Group、多 changed files、逐项接纳/全部接纳 |
| RUN-04 | revise 绑定唯一 Target + Base Revision | Run 持有 Target/Revision，部分 Guard 存在 | 🟡 | GUI 消歧、格式能力 Gate、真实 Bridge E2E、Current 不被绕过 |
| RUN-05 | Provider 不直接覆盖源文件 | staging 隔离成立 | ✅ | 保持；不要把“物理新 Draft 文件”显示成“新 Artifact” |
| RUN-06 | Adapter 按 Workflow/Format 选择 | `runtime-adapter.ts` 硬编码 `script-draft-*.md`、`markdown_script_revision` | 🔴 | Adapter Registry：Intent × Workflow × MIME/Kind × Provider Capability |
| RUN-07 | expectedOutputs 反映真实任务 | 永远一个 `text/markdown` 输出 | 🔴 | create/revise/analyze 分别构建输出合同；不支持格式派发前拒绝 |
| RUN-08 | ResultEnvelope 支持 created/modified/零文件 | Bridge 合同有部分字段；LCOS ingestion 仍 revise-only | 🟠 | 完成三种 Intent 的验证与归位 |
| RUN-09 | Retry = New Run，Context 规则明确 | New Run/retryOf 基础存在 | 🟡 | 用户修改指令时重建 Manifest；纯重试可复用；浏览器真实链验收 |
| RUN-10 | RunEvent/Activity 可恢复 | 类型接口存在，缺少正式 durable RunEvent 存储与 CLI events | 🔴 | Event 表/Repository/API/CLI/GUI Activity；不要以 provider status 代替 |
| RUN-11 | waiting_input 是真实中断恢复 | GUI 有 Fixture/展示状态，Bridge/Agent 正式问答恢复未闭合 | 🔴 | 冲突/歧义写入 canonical waiting_input；回答后恢复同一 Run 或明确新 Run |
| RUN-12 | Generic Mutation 不能绕过 Accept | 历史审计已登记 P0；通用 Artifact PUT 风险未确认正式封死 | 🟠 | Accept 前完成 Domain Guard 并加入架构测试 |

### C. Runtime Host、Bridge 与执行可用性

| ID | 7 月承诺 | 当前证据 | 状态 | 必须补完 |
|---|---|---|---|---|
| RT-01 | LCOS 创建 Run 后 Bridge 可用 | Launcher 只启动 Web/Core；实测 43122 无监听，Run 派发 `BRIDGE_UNAVAILABLE` | 🔴 | Launcher/Runtime Host 管理 Core、Bridge、Web |
| RT-02 | 关闭 GUI 后后台仍可执行 | 当前关闭 App 窗口设计会结束 dev stack | 🔴 | Runtime Host 与 GUI 生命周期分离 |
| RT-03 | 无 CMD 窗口、成熟后台体验 | npm/cmd 日志和生命周期仍可暴露窗口 | 🔴 | 隐藏子进程、结构化日志、无控制台 Runtime Host |
| RT-04 | 托盘可唤起、看状态、退出 | 没有桌面托盘宿主 | 🔴 | 托盘：打开、状态、诊断、重启、完全退出；技术选型须单独批准 |
| RT-05 | Bridge 崩溃可恢复 | Adapter 有 recover；没有常驻 Supervisor 自动健康管理 | 🟡 | 有限退避重启、版本/能力握手、崩溃循环保护 |
| RT-06 | Bridge 唯一正式写路径 | Light Bridge 已接，但旧 MCP/兼容路径仍需系统盘点 | 🟡 | 列出并封闭所有 Legacy 写路径，只保留只读迁移窗口 |
| RT-07 | Capabilities Handshake | Bridge 有 doctor/capabilities 证据，GUI/Adapter 派发前未完整使用 | 🟠 | 启动与每次关键派发前验证 contract/version/workflow/output capabilities |
| RT-08 | WorkBuddy 主动取件 | CLI/MCP 有 claim/start/submit；零点击唤醒未稳定证明 | 🟡 | 明确正式 Executor，任务从 assigned→running→submit 的真实 E2E |
| RT-09 | Provider Task 与 Canonical Run 分离 | 表和 Adapter 基础成立 | ✅ | 保持；UI 只显示投影，不把 assigned/review 塞入 Run enum |
| RT-10 | Bridge 重启与 LCOS 重启恢复 | 单元/集成基础存在，用户真实 Run 未通过 | 🟡 | 用真实 Project、真实 Bridge、真实 Agent 做 Restart Recovery |

### D. CLI、MCP 与 Agent Product Surface

| ID | 7 月承诺 | 当前证据 | 状态 | 必须补完 |
|---|---|---|---|---|
| CLI-01 | CLI 覆盖正式 P0 产品入口 | 当前覆盖 Project、部分 Context/Run/Resource/Task | 🟡 | 对照 v3.0 P0 命令逐项补齐 |
| CLI-02 | doctor/capabilities | `npm run bridge -- doctor` 存在，但 `lcos doctor/capabilities` 不存在 | 🔴 | 统一 LCOS 入口输出 Core/Bridge/Provider/Contract 状态 |
| CLI-03 | project current/inspect | 只有 list/open/create/show | 🟡 | current、inspect、稳定 `--json` |
| CLI-04 | Artifact/Revision inspect/compare | 缺失 | 🔴 | inspect、history、compare、accept/reject |
| CLI-05 | Feedback/Decision list/write | 缺失 | 🔴 | 最小读写命令和结构化错误 |
| CLI-06 | Run events/cancel | list/create/dispatch/recover/show/sync 有；events/cancel 缺失 | 🟡 | events、cancel、退出码、dry-run |
| CLI-07 | Checkpoint/Preview | 缺失 | 🔴 | 创建/查看 Checkpoint；请求/读取 Preview |
| CLI-08 | GUI 等价的 Canvas 空间操作 | 不应全部强行 CLI 化，但当前无明确边界表 | 🟠 | 冻结哪些为 GUI-only、哪些为 Agent 必须操作，避免“CLI 全覆盖”误报 |
| MCP-01 | Agent 能创建完整 Run | MCP 只能 build manifest、list/get/sync Run，不能 create/dispatch/review | 🔴 | MCP 使用同一 Application Service 暴露必要 Run 工具 |
| MCP-02 | Agent 读取 GUI 实时选择 | MCP 能 GET，但 Web 未 PUT Selection | 🔴 | 先修 ActiveContext 写回，再验 MCP 真实读取 |
| MCP-03 | Agent 查看/确认 Revision | 缺少 compare/accept/reject MCP | 🔴 | 与 CLI/API 共用合同，保留人工审批边界 |
| MCP-04 | Skill 与 MCP 与当前代码同步 | Skill 宣传 OutputIntent 等能力，但真实 Adapter 未兑现 | 🔴 | 每次能力变更同步 Skill；加入“声明—工具—E2E”一致性检查 |

### E. Project Truth、文件与 Preview

| ID | 7 月承诺 | 当前证据 | 状态 | 必须补完 |
|---|---|---|---|---|
| DATA-01 | 真实项目打开、目录文件形成节点 | 当前已实现扫描确认与 Import Existing | ✅ | 补真实大目录上限/进度/取消体验验收 |
| DATA-02 | 常用文件导入不是样子接口 | MD/TXT/图片/DOCX/PDF/PPTX 可持久化；部分理解/预览缺口 | 🟡 | 格式能力表、失败原因、Fallback，不把 unsupported 写成 failed import |
| DATA-03 | Preview Worker/Cache 与 UI 统一 | Worker/Record 基础存在；新 PDF/PPTX 使用独立读取/Viewer 路径 | 🟡 | Viewer Host 与 Preview Cache 责任边界统一，不复制 Truth |
| DATA-04 | DOCX/更多文件只读预览 | DOCX 能导入但没有正式预览 | 🔴 | Viewer Registry 后逐格式加入只读 Viewer；无编辑承诺 |
| DATA-05 | Watcher/外部变化 | FileObservation 可手动检查；常驻 Watcher 未实现 | 🔴 | 规划并批准后实现；missing/stale/conflict 进入 UI/Run Guard |
| DATA-06 | Safe Write | Accept 更新 Current Pointer，仍不等于可靠写回原用户文件 | 🟡 | 继续默认 Draft/Revision；覆盖源文件另走预览、确认、hash、回滚协议 |
| DATA-07 | 删除 View 不删 Artifact | 架构测试已覆盖 | ✅ | 保持 |
| DATA-08 | Project/Run/Revision 不落 localStorage | Runtime 主路径大体成立；Fixture/前端 ActiveRun 状态仍并存 | 🟡 | 清理真实项目中的前端计时器/Fixture Run 分支，明确 QA-only |

### F. Golden Path、恢复与诚实验收

| ID | 7 月承诺 | 当前证据 | 状态 | 必须补完 |
|---|---|---|---|---|
| QA-01 | 完整浏览器 Golden Path | 自动测试多为 Node/API；真实浏览器未贯穿 Bridge/Agent/Review/Restart | 🔴 | Playwright + 真实 Local Core/Bridge/可控 Provider，录制证据 |
| QA-02 | Bridge 不在线不假装执行 | 当前能显示派发待恢复，但开始按钮仍允许在 Bridge 离线时创建 Run | 🟡 | 发送前健康 Gate；允许保存为未派发 Run，但文案必须明确 |
| QA-03 | Fixture 不静默接管 Runtime | 诊断/模式边界有所改善，App 仍保留大量 Fixture 状态机 | 🟡 | Runtime 项目彻底禁止 Fixture timer 推进和假 review |
| QA-04 | Restart Recovery | 数据层测试存在 | 🟡 | GUI+Core+Bridge+Agent 实际重启链 |
| QA-05 | missing/stale/unreadable/preview failure/migration failure | 分散测试存在，统一用户路径不完整 | 🟡 | 汇总失败矩阵并做浏览器可见验证 |
| QA-06 | 宣传与真实能力一致 | 多份 Handoff 把单层存在写成完成，导致重复误判 | 🔴 | 建立 Capability Ledger，发布/交接必须链接真实 E2E 证据 |

## 5. 已被新规划替代、不得继续照旧实现

- 旧的“所有 Run 都修改一个已知 Markdown 文件”被 Output Intent 方案替代。
- 旧的“一个 Run 只返回一个 created 文件”被 Return Group / create-revise-analyze 方案替代。
- 旧的“独立 Preview Modal 是主预览入口”被右侧 Artifact Workbench 方案替代。
- 旧的“关闭浏览器即关闭所有服务”被后台 Runtime Host 方案替代。
- 旧的“用户必须自己理解 Target/Context 内部逻辑”被自然语言摘要与渐进披露替代。
- 旧的“Bridge/CLI/MCP 各自维护能力文案”被统一 Capability Ledger 与 Application Service 复用替代。

## 6. 本轮新增并冻结的前端任务

### 6.1 单击/双击

```text
单击文件节点
→ 只选中
→ 显示轻量详情与快捷操作

双击文件节点
→ 展开右侧栏
→ 中部显示 Preview

双击 Scope/集合
→ 进入子画布
```

### 6.2 右侧 Artifact Workbench

```text
顶部：当前对象、Revision、状态
中部：Preview / Edit / Compare / Review / Run
底部：Agent Composer、Target、Context、执行操作
```

- 先迁移所有只读 Preview；不在这轮伪造编辑能力。
- 预留 Viewer/Editor Registry；Editor 保存只能进入 Working/Draft Revision。
- Run 状态临时接管中部，结束后返回当前对象。

## 7. 本轮新增并冻结的 Runtime Host 任务

```text
LCOS Runtime Host
├─ Local Core :43121
├─ Light Bridge :43122
├─ Web :5173
└─ Tray / Diagnostics
```

- Launcher 启动 Core、Bridge、Web，并做版本/能力握手。
- 关闭 GUI 不停止 Core/Bridge。
- Core/Bridge 无 CMD 窗口；日志写文件。
- Supervisor 有限退避重启，禁止无限崩溃循环。
- 托盘提供打开、状态、诊断、重启、完全退出。
- 正在运行的 Run 退出前确认。
- 托盘属于新增桌面宿主，先输出 ADR/技术选型，不得用临时 PowerShell 脚本冒充生产实现。

## 8. Dz 的开发习惯与执行纪律（合并版）

来源：`C:/Users/1/Desktop/OS开发/Dz_个人开发协作习惯与阶段节奏_v1.0.md`。

1. 先真假、再持久化、再可触达、再纵向闭环、再恢复、再体验、最后重构。
2. 讨论不等于实施；只执行已批准 Stage/Slice。
3. 大改必须独立 worktree/branch，不动主开发 worktree，不自动 push，不重写历史。
4. 不能把后端 API、Schema、类型、Mock、Fixture、按钮壳或测试替身写成产品完成。
5. 小片快速推进、相关测试即可；大版本收口必须集中完成完整质量链与真实浏览器验收。
6. 已通过且未受影响的测试不重复跑；但不能把未运行写成 PASS。
7. 用户反馈要修同类根因，不只修截图里的单一文件或单一按钮。
8. 每次提交同时交付启动方式、启动后测试步骤、未完成、风险与回滚。
9. 上下文压缩后续接当前任务，不回退旧 Stage、不重做已完成工作。
10. UI、Core、Bridge、CLI、MCP、Skill 必须形成同一条真实链；任何一端没接不算完成。
11. Runtime 失败不得静默切 Fixture；AI 结果不得自动覆盖 Current。
12. Buddy 正式项目任务通过 Bridge 回传；飞书只负责唤醒/异常；Codex 以真实 diff、文件和测试验收。
13. 任务必须维持小而可审查的提交；不把多个高风险语义重构塞进一个不可回滚提交。
14. 重大变更先给前后流程、数据流、影响模块、成本、风险、验收和回滚。
15. 这次整改禁止继续采用“MVP 凑合做法”；但仍要逐 Slice，不能一次大爆炸重写。

## 9. Buddy 执行工作单

### 9.1 总目标

基于本审计重新核验 7 月规划兑现状态，并按依赖顺序完成未兑现的关键纵向能力，使 LCOS 不再以单层存在冒充产品完成。

### 9.2 执行顺序

#### Slice A：现实账本与保护性测试

- 复核本表每一项代码证据，修正误判。
- 新建版本化 `Capability Ledger`，记录 GUI/Core/Bridge/CLI/MCP/Skill/E2E 六列状态。
- 先写失败测试锁定：Web 未 PUT ActiveContext、analyze 被默认 revise、Adapter 硬编码 Markdown、Bridge 离线仍进入派发、Checkpoint 假按钮。
- 不在这一片修改 Schema。

#### Slice B：Run Intent 真正落地

- 完成 create/revise/analyze 真实行为。
- Web 明确 Intent；analyze 零文件；create 多 Return；revise 同 Artifact Draft。
- 引入 Adapter Registry，删除通用路径对 Markdown 的硬编码。
- unsupported 在派发前失败。
- 完成 Result Ingestion、Return Group、Review 投影和相应测试。

#### Slice C：Runtime Host 与 Bridge 常驻

- Launcher/Host 同时管理 Core、Bridge、Web。
- 关闭 GUI 不停止 Core/Bridge；无 CMD 窗口；健康检查、有限恢复、日志与诊断。
- 先交 ADR 决定托盘宿主，再实现托盘；不要引入 Electron/Tauri 或新增大依赖而不先获批。

#### Slice D：ActiveContext、CLI、MCP 对齐

- Web Selection 写回 Core。
- CLI 补齐经确认的 P0 命令与稳定 JSON/退出码/dry-run。
- MCP 补齐必要 Run、Revision、Review 工具。
- Skill 文案必须只声明真实 E2E 已通过能力。

#### Slice E：右侧 Artifact Workbench

- 实现单击/双击冻结交互。
- Preview 移入右侧中部，建立 Viewer Registry。
- WorkRail 与对象 Workbench 共用 ActiveContext。
- 保留未来 Script/Storyboard Editor Host 接口，不实现假编辑器。

#### Slice F：完整 Golden Path 与发布纠偏

- 真实项目、真实文件、真实 Bridge、真实 Agent、真实 changed files、Review、Accept/Retry/Reject、Checkpoint、重启恢复。
- 至少覆盖 create、revise、analyze 各一条。
- 输出浏览器证据、Runtime/Bridge 证据、数据库恢复证据。
- 更新 README、用户手册、CLI/MCP/Skill 与 Capability Ledger；删除夸大完成表述。

### 9.3 硬约束

- 不修改主 worktree；当前执行 worktree 为 `E:/Codex 项目/OS开发/.worktrees/mvp-fast-build`。
- 不自动 push、不重写历史、不覆盖用户文件、不直接修改 Current。
- Schema、桌面托盘宿主、Watcher、Safe Write 继续按红区单独提案和批准。
- 不用 Fixture、Fake Provider 或静态按钮作为最终验收。
- 不把“单元测试通过”当作“真实 WorkBuddy E2E 通过”。
- 每个 Slice 单独提交、单独 Handoff；先完成依赖项再进入下一片。
- 任何规划冲突、修改文件数量异常或需要新依赖时停止并请求决定。

### 9.4 验收条件

1. Capability Ledger 中所有“已完成”均有真实代码路径和 E2E 证据。
2. 分析 PDF 不生成 Draft 文件，能零 changed files 完成并展示分析结果。
3. revise 不新增 Artifact，只产生同 Artifact Draft Revision；Accept 前 Current 不变。
4. create 可以不选旧 Target，并能返回至少两个新 Artifact。
5. 双击文件在右侧中部预览；所有 Viewer 使用统一 Host。
6. Launcher 启动后 Core/Bridge 均在线；关闭 GUI 后仍在线；完全退出才停止。
7. GUI Selection 能被 CLI/MCP 立即读取。
8. Checkpoint 按钮写入 Project Truth，重启后存在。
9. Bridge 离线时 Run 明确停在“未派发/待恢复”，不显示为 Agent 执行失败。
10. 完整 Golden Path 在真实浏览器中通过，且 Core/Bridge 重启后恢复。

## 10. 本次审计已确认的真实失败样本

- Run：`run-84682e18-ef33-4bd3-a5dc-d0b3bef503c9`
- 用户指令：分析一个 PDF。
- 实际：Web 未传 Intent，Core 默认 `revise`；Adapter 生成 Markdown Draft 合同。
- 派发：Bridge 43122 未启动，Dispatch=`recovery_required`，错误=`BRIDGE_UNAVAILABLE`。
- 没有 RuntimeBinding、没有 ArtifactReturn、WorkBuddy 未接到任务。

这个样本必须保留为回归测试，不得只修文案或手动启动 Bridge 后宣称解决。

## 11. 执行与停止条件

Buddy 应先完成 Slice A 的复核、Capability Ledger 和保护性测试，然后在同一任务中继续推进已经有冻结方案、且不需要新增红区决策的代码工作，包括：

- Web Selection → ActiveContext 写回；
- CLI/MCP 明确缺口补齐；
- 单击/双击与右侧 Artifact Workbench；
- Viewer Registry 与现有只读预览迁移；
- Bridge 离线 Gate 与真实错误呈现；
- Launcher 同时启动/监管现有 Core、Bridge、Web 的无控制台基础 Host（不包含未经批准的新桌面壳依赖）；
- 依据既有 Output Intent 冻结稿删除 `revise` 默认误判和通用 Markdown 硬编码，能在现有 Schema 内完成的部分直接推进。

只有遇到以下情形才停止并通过 Bridge 请求决定：

- 必须新增或破坏性修改 Schema；
- 必须引入 Electron/Tauri/WinUI 或其他桌面宿主与新依赖；
- 必须实现 Watcher 或真实源文件覆盖；
- 既有规划互相冲突，无法按优先级解析；
- 修改范围明显超出本工作单或不能保证回滚。

每完成一个可独立验收的 Slice，做小提交和 Handoff；不要等到最后才一次提交。完成或触发停止条件后通过 Bridge 回传真实 changed_files、Commit、测试和未完成项。
