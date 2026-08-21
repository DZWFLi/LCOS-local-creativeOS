# LCOS 大改后全栈与 UI 接入审计（2026-08-04）

## 结论

当前版本不是只有视觉微调。运行时主链已存在，但前端合并把若干“接口存在”误当成“产品交互完成”，并且 Process Projection 存在明确的前后端合同错位。用户观察到的二级选项纯文本、字号比例异常是真实问题；画布被压小还受到过程节点错误投影的放大影响。

审计基线：

- Branch：`codex/backend-hardening-20260802`
- HEAD：`89e4da3`
- Version：`0.7.3`
- 启动：Web `127.0.0.1:5173`、Local Core `127.0.0.1:43121`、Light Bridge `127.0.0.1:43122` 均可启动
- 浏览器 Console：本次主界面与 Selection Composer 操作未见 error / warning

## P0：施工前必须修正

### 1. Prompt 上下文 Shelf 实际没有落地

`SelectionComposer` 只收到 `linkedCount`，界面只显示“当前对象 + N 个直接关联”，没有展示具体 Context Chip，也没有添加、移除、搜索、排序入口。发送时 `App.tsx` 却直接把 `selectionContextIds` 转为真实 `contextItems`。

结果是：用户看不到 Agent 到底会读什么，但隐藏的一跳关系仍会进入 Run。这违反已经冻结的规则：“Shelf 显示什么，Agent 就只读什么；未显示的不得进入 Context”。

证据：

- `apps/web/src/features/canvas/SelectionComposer.tsx:13,89`
- `apps/web/src/App.tsx:1772-1790`
- `docs/handoffs/BACKEND_INTEGRATION_GUIDE_20260803.md` 第 2 节

建议：把当前对象、默认一跳候选与用户显式加入项全部做成可见 Chip Shelf；默认推断可以帮用户省操作，但必须显式可见、可一键移除。发送请求必须从 Shelf 的最终有序列表生成，不能另走隐藏数组。

### 2. Process Projection 前后端合同错位

Local Core 的投影项只有 `kind/id/summary/status/createdAt`，但 Web Adapter 试图读取 `runId/provider/contextViewIds/targetViewIds/outputViewIds`。当字段不存在时，Adapter 把任意投影项自己的 `id` 当成 `runId`，并把三组关系默认为空数组。

因此 Revision、Checkpoint 也会被前端包装成类似 Run 的过程节点，并显示 `Context 0 / Target 0 / Output 0`。这不是展示文案问题，而是错误的数据语义。

同时 Core 默认返回最多 100 个 Run、每个 Artifact 最近 6 个 Revision、全部 Checkpoint 和 Return；Web 又把它们全部放进 Canvas。当前样例的 5 个主要内容被 11 个过程投影包围，恢复相机缩到约 56%，直接放大了节点与字体过小问题。

证据：

- `apps/local-core/src/process-projection-service.ts:5-59`
- `apps/web/src/runtime/projectionAdapters.ts:180-204`

建议：先冻结一个真实 `ProcessProjectionV1` Contract。Canvas 只投影 Active Run、Pending Return 与少量最近关键过程（默认 0–3 个）；历史 Revision、Checkpoint、旧 Run 进入 Activity / Workbench，不进入默认 Canvas。Revision/Checkpoint 不得伪造 `runId`。

## P1：当前 UI 接入明显不合格

### 3. 二级选项确实只是原生文本 Select

范式、Agent、结果和编辑对象全部是原生 `<select><option>`。它们没有图标、状态、简短解释、目标缩略图或可扫读的菜单层级，所以看起来像一排技术配置文字。这不是 Buddy 把一个成熟组件接错了，而是合入代码本身就只实现到了原生 Select。

证据：`apps/web/src/features/canvas/SelectionComposer.tsx:133-136`。

建议：改为统一轻量 Popover Menu：

- 范式：图标 + “分析 / 创建 / 修改” + 一行结果解释；
- Agent：头像/图标 + 名称 + `自动/需手动接取/离线` 状态，不直接把英文 `manual` 暴露给用户；
- 结果：自然语言表达“仅回答 / 新建内容 / 生成草稿版本”；
- 编辑对象：节点缩略图 + 标题 + 当前 Revision，并支持搜索当前选择与 Workspace 内容。

### 4. 字号与缩放比例失衡

Composer 固定宽 `520px`，并使用 `scale(1 / zoom)` 抵消画布缩放；因此画布在 56% 时，节点跟着变小，但 Composer 仍保持约 520×229 屏幕像素。它会显得像一块巨大面板压在一群微小节点上。

与此同时，Composer 标签和 Select 使用 8–9px 字号，输入文字 12px。实测 Select 文字约 9px，已低于正常可读界面应使用的最低正文尺度。

证据：

- `apps/web/src/features/canvas/SelectionComposer.tsx:83`
- `apps/web/src/porcelain-studio.css:2581-2583,2693,2787`

建议：不要继续单点调字号。应先修过程节点投影与初始相机，再统一三档屏幕空间排版：正文不低于 12px、交互选项建议 12–13px、辅助信息 10–11px；Composer 使用 `clamp()` 的响应式宽度和最大高度，允许内部渐进披露，避免与画布节点形成 3–4 倍视觉体量差。

### 5. 初始画布信息密度和相机恢复不合格

样例打开后内容集中在左上区域，大量空白留在右下；过程节点主导边界后，主内容卡片被缩小到难读。当前默认状态不符合“当前 Workspace 5–8 个主内容节点、Process 0–3 个”的冻结密度。

建议：相机 Fit 只以 Workspace 主内容和活跃过程为边界；历史过程不参与 Fit。恢复旧相机时还应检测投影集合变化，避免新投影节点把旧视图永久压缩。

### 6. 历史 Prompt 的只读语义不完整

“基于此版本继续”会把历史 Prompt 直接写入当前可编辑 Composer。它不会修改历史数据，但视觉上没有先呈现只读来源、再明确复制为新指令的分界，容易让用户误以为正在编辑原记录。

建议：历史 Prompt 在 Workbench 保持只读；点击“基于此版本继续”后生成一份带来源标识的新草稿输入，并明确提示“将创建新 Draft，不修改历史”。

## 后端与执行状态

- Canonical Run、ContextManifest、Dispatch、Binding、Artifact Return 等主结构存在。
- Provider 能力接口真实返回 WorkBuddy / Codex，但当前均为 `executionMode: pull`，UI 正确地没有宣称 Ready；现状仍是 `manual`，不是零点击自动执行。
- WorkBuddy `sessionBinding=false`，Codex `sessionBinding=true`；不能把两者宣传为相同的连续会话能力。
- Bridge 与 Core 能启动，但“Run 发出后无需去 Agent 端接取”的完整体验仍未成立。

## 质量门结果

运行：`npm run check:fast`

- lint：完成，有多项 warning；其中 `App.tsx` 有多个 hooks 依赖警告和未使用的上下文/布局函数，说明大合并后仍有未接通代码。
- typecheck：Web、Local Core、Domain、Contracts 通过。
- Web tests：30 files / 126 tests 通过。
- Local Core tests：43 files 通过、1 file 失败；224/225 tests 通过。
- 失败项：`tests/lcosproj-service.test.ts` 的最近项目排序测试，期望 `disposable-mvp-sample` 排首位，实际为 `project-older`。
- 因 test 阶段失败，architecture 与 build 未由本次 `check:fast` 继续执行，不能宣称全链通过。

## 推荐施工顺序

1. 先修 `ProcessProjectionV1` 合同与 Canvas 投影范围，恢复正常相机和节点尺度。
2. 实现真实可见的 Context Shelf，并保证请求只使用 Shelf 列表。
3. 将四个原生 Select 替换为统一的轻量 Popover Menu，完成中文状态语义。
4. 统一 Composer、节点、Work Rail 的屏幕空间字号与密度 Token。
5. 修复 `.lcosproj` 最近项目排序测试，并清理高风险 hooks warning。
6. 再做一次真实 Golden Path：选择上下文 → 修改目标 → Run → 手动接取提示 → Return → Review → Accept → 重启恢复。

## 历史红区 / 黄区欠账归并

以下清单由 `LCOS_CAPABILITY_LEDGER.md`、`LCOS_JULY_PLAN_FULFILLMENT_GAP_AND_BUDDY_WORK_ORDER_20260803.md`、`DZ_REQUIREMENTS_FIX_MATRIX_20260803.md` 与当前源码交叉复核而来。旧台账不能直接当现状：其中 ActiveContext、Viewer Host、Workspace State、Launcher、Watcher、Run Event、Intent/Result Ingestion 等多项后来已经实现；施工时必须更新台账，不能重复造一遍。

### A. 已有批准方向，可直接纳入本轮施工的黄区

| 编号 | 施工事项 | 当前判断 | 本轮必须达到 |
|---|---|---|---|
| Y-01 | Context Shelf 与 ActiveContext 统一 | Core 已有，GUI 未完成 | 所见即所得；增删、搜索、排序、默认推断均可见；刷新恢复 |
| Y-02 | Process / Activity 投影收敛 | Core/Web 合同错位 | 正式 Contract；Canvas 默认 0–3 个活跃过程；历史进入 Activity |
| Y-03 | Composer 二级菜单与视觉尺度 | 原生 Select、8–9px | 轻量 Popover、中文状态、目标缩略图、统一字号 Token |
| Y-04 | 失败与恢复入口 | API 有 `recoverRuntimeRun`，GUI 可发现性不足 | Bridge 离线、dispatch failure、recovery_required 均有明确影响、下一步和一键恢复 |
| Y-05 | Revision / Compare / Feedback / Decision | Revision 基础较完整；结构化 Feedback/Decision 与通用 Diff 仍不完整 | 最小文本 Diff；Feedback/Decision 能成为真实 Context 与审计证据 |
| Y-06 | CLI/MCP 补齐 | Project/Context/Run 已覆盖一部分 | Artifact/Revision inspect+compare、Feedback/Decision、Checkpoint/Preview；冻结 GUI-only 边界 |
| Y-07 | Capability Handshake 消费 | Bridge 能返回能力，UI/Adapter 使用不足 | 派发前验证 Provider、Contract、Intent、格式与输出能力；unsupported 发送前阻止 |
| Y-08 | `.lcosproj` 工程恢复 | 主路径已实现，最近项目排序测试失败，P3 迁移未完 | 修复目录排序；验证相对路径+hash 重绑定；明确跨机器迁移边界 |
| Y-09 | Preview 统一收口 | Viewer Host 已有；DOCX/部分格式仍 fallback，Cache 路径未完全统一 | 所有文件走统一 Viewer Registry；支持/降级/外部打开状态诚实一致 |
| Y-10 | Fixture 与 Runtime 清理 | App 仍保留 Fixture Run 计时状态机 | 正式项目禁止 Fixture 静默接管；Fixture 只留明确 QA 入口 |
| Y-11 | 功能可发现性 | 入口仍分散 | 空状态、上下文菜单和轻量命令入口覆盖 Import、Preview、Run、Review、Recovery |
| Y-12 | 真实用户路径验收 | 单元测试多，浏览器完整链仍缺 | 新建/打开项目到拿到可接受结果不超过 5 个主要决策步骤；三种 Intent 各跑一条 |

### B. 红区：纳入总施工，但必须先交变更协议再编码

这些不是“以后忘掉”，而是进入相应 Slice 前先输出变更前后流程、数据流、Schema/文件影响、风险、验收和回滚，并等待批准。

| 编号 | 红区事项 | 当前证据与边界 | 开工 Gate |
|---|---|---|---|
| R-01 | 真实 `waiting_input` 中断/回答/恢复 | Canonical 状态存在；前端仍有 Fixture 计时模拟；Bridge 正式问答协议未闭合 | 先冻结同一 Run 恢复还是新 Run、消息合同、幂等与重启恢复 |
| R-02 | Safe Write / 覆盖真实用户文件 | 当前正确地默认 Draft/Revision；尚非生产级写回协议 | 必须有预览确认、base hash、冲突→waiting_input、备份/回滚、单写租约 |
| R-03 | Bridge 唯一写路径与 Legacy 封闭 | Light Bridge 已是主路径，但旧 MCP/兼容写入口未完成系统证明 | 列出全部写入口；迁移期只读；架构测试禁止绕过 Canonical Run/Accept |
| R-04 | Generic Mutation 绕过 Accept 防护复核 | 当前 Repository 已在 `metadata-repository.ts:2428-2429` 拒绝通用修改 `currentRevisionId`，比旧台账进展更好 | 补 API/架构回归测试，确认所有路由均无法绕过；未验证前不能关闭 P0 |
| R-05 | 零点击 Executor / WorkBuddy 主动执行 | AutoSync、claim/start/submit 存在，但 Provider 仍诚实标记 manual/pull | 真实 Executor E2E：创建→自动接取→执行→submit→回收；失败/重启/重复调度均可控 |
| R-06 | 桌面托盘与正式 Runtime Host 产品化 | PowerShell 托盘方案已有，人工 UX 与发行边界未冻结 | 先确认宿主技术、安装/升级/退出、日志、权限；不得顺手引入 Electron/Tauri |
| R-07 | 工程文件跨机器迁移 | `.lcosproj` 本机路径恢复已部分成立 | 冻结工程包携带内容、缺失文件重绑定、hash 冲突、隐私脱敏和 schemaVersion |

### C. 明确不进入核心施工，除非重新批准

- 网页 iframe 嵌套预览：受 CSP、登录态和安全边界影响；核心只保证 Link 节点可识别、可注入 Context、可外部打开。
- 多 Agent 自由编排、多人协作、云端同步、PPT/PDF 编辑、全功能 DCC。
- 自动覆盖人工 Current、自动把外部变更归因给最近 Run、把 Bridge Artifact 当成 LCOS Project Truth。

### D. 更新后的施工批次

1. **Batch 1 — 语义止血**：Y-01、Y-02、Y-03、`.lcosproj` 失败测试；同时给 R-04 补保护性测试。
2. **Batch 2 — 真实操作闭环**：Y-04、Y-05、Y-07、Y-09、Y-10、Y-11。
3. **Batch 3 — Agent 等价操作面**：Y-06，并让 CLI/MCP/Skill 声明由同一能力表生成或校验。
4. **Batch 4 — 集中验收**：Y-12，覆盖 analyze 零文件、create 多 Return、revise 同 Artifact Draft、Accept/Reject/Retry、Checkpoint 与重启恢复。
5. **Batch 5 — 红区专项**：按 Dz 单独批准依次处理 R-01、R-03、R-05；R-02、R-06、R-07 各自独立 ADR/Slice，不与 UI 修补混在一个提交。

### E. 施工完成定义

- 不能再用“接口存在”“按钮能点”“测试有断言”标记真实完成。
- 每项至少满足：GUI 可操作 → Core 真相持久化 → CLI/MCP 等价或明确 GUI-only → 刷新/重启恢复 → 错误路径可理解 → 有真实证据。
- Capability Ledger 每项只能标记：未做、施工中、真实完成、阻塞、经 Dz 批准被替代。
- 红区未经批准只交方案和保护性测试，不顺手实现。

## 本轮范围与回滚

本轮只做审计和运行验证，没有修改 Domain、Schema、Bridge、UI 实现或用户数据。删除本文件即可回滚本轮仓库变更。
