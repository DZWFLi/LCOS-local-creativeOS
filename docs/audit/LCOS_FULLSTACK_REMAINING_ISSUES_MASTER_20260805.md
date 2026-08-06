# LCOS 全栈包剩余问题总账（给开发）

> 日期：2026-08-05
> 输入包：`LCOS_Fullstack_GateF_Final_Closeout_20260805.zip`（已入库提交 `6280398`）
> 实机验收：`docs/audit/LCOS_GATEF_CLOSEOUT_WINDOWS_VERIFICATION_20260805.md`
> 能力缺口：`docs/audit/LCOS_GATEF_REMAINING_GAPS_FOR_DEV_20260805.md`
> 本文件是上述两份的总账，开发只需读这一份 + P0 项目描述即可开工。

## 0. 总体判断

Gate F Final Closeout 候选包通过 Windows 实机质量链与真实 Codex 核心场景
（A 新会话 / B 会话复用 / E waiting_input 已真实跑通），**但仍有两类问题**：

```text
A 类：验收中发现、开发必须修（MCP 真实会话、看门狗架构）
B 类：功能做了但真实闭环未跑满 / 用户视角缺口仍存在
```

任何“接口有 / 按钮有 / 测试有 / 文档写完成”都不能算完成，见 §7 验收口径。

## 0.1 第一优先：MCP 完全完善（做任何新功能之前）

**用户决定：做 P0 对话导入之前，开发必须先修好 MCP。** MCP 是 Agent 与 LCOS 的正式
通道；对话导入要靠 Skill/MCP/CLI 驱动，MCP 不完善等于地基没打。

已定位的高置信根因线索（2026-08-05 实测）：

```text
1. MCP command 写死 fnm multishell 临时 node.exe（process.execPath），
   shell 清理后路径失效 → 服务器起不来 → 真实会话静默无工具；
2. 遗留 ai_bridge（http://127.0.0.1:8920/mcp）仍启用在 config.toml，已不可达；
3. 现有验证停在配置层，真实会话级验收缺失。
```

完整排查与修复指引见：

```text
docs/audit/LCOS_MCP_COMPLETION_HELP_20260805.md
```

“MCP 完全完善”包含**架构解耦**：三张 MCP 面（老 ai_bridge 8920 / Light Bridge 43122/mcp /
local-creative-os stdio）收敛为唯一一张，Bridge 只留 REST，工具按角色命名空间分组。
设计见：

```text
docs/architecture/LCOS_MCP_BRIDGE_DECOUPLING_DESIGN_20260805.md
```

还包含**全新机器可部署**：LCOS 单包承担老 bridge 与自身全部功能，干净电脑一条命令
引导完成，全程无 ai_bridge / 8920 / sessions.json 手工编辑 / fnm shim 依赖
（同文档 §8）。

## 0.2 大轮验收后状态总览（2026-08-05 实机证据）

> 证据来源：`docs/audit/LCOS_GATEF_PLUS_BIG_ROUND_WINDOWS_ACCEPTANCE_20260805.md`

| 原问题 | 状态 | 说明 |
|---|---|---|
| A1 MCP 真实会话加载 | ✅ 已解决 | 根因=本机 `models.json` DeepSeek 条目 `supports_search_tool=true` 触发动态工具发现，第三方 provider 不支持 tool_search 导致 MCP 静默隐藏；改为 `false` 后真实 `codex exec` 可见 64 个 LCOS 工具，且只读调用 `list_lcos_projects` 真实返回 Core 数据（2026-08-06 实机证据，详见验收报告 7.1）。桌面 App 需重启生效；`lcos-executor` enabled=false 为角色分流设计 |
| A2 看门狗同步阻塞 | ✅ 已解决 | Node 异步看门狗：跨项目并发 2、同项目串行、超时/进程树/重试/冷却；smoke + 真实 5 Run 验证 |
| A3 run.started 10s 语义 | 🟡 未复测 | 真实事件链正常；语义文档未更新 |
| A4 相机常量集中 | 🟡 未做 | 本轮未触碰 |
| B1 连续 5 Run | ✅ 已解决 | 同一项目 5 个真实 Run，会话 `019fd215` 全程未跳 |
| B2 revise/create 变体 | ✅ 已解决 | 真实 create 两文件 + 真实 revise Draft，均接受收口 |
| B3 running 撤回进程树 | 🟡 部分 | 排队中取消通过；运行中取消未实测 |
| B4 浏览器 1s 同步 | 🟡 部分 | Agent 面板版本同步可见（v812/v819）；无逐毫秒测量 |
| B5 Obsidian UI 点选 | 🟡 部分 | smoke 覆盖；原生目录选择仍无法 headless |
| B6 长 Prompt 端到端恢复 | ✅ 已测 | 2790 字 analyze 完成；强杀 Core 重启后 Run/会话绑定不丢 |
| B7 选中到发送 ≤3 动作 | ✅ 已测 | 3 步实测；顺带修复 Composer 发 Run 400（requestedProvider=auto 未被 Core 接受） |
| 对话 Session 导入 | ✅ 已实现 | L0-L3 + GUI 入口 + 案例样本，smoke 全过；Agent 驱动仍依赖 MCP 关闭 A1 |
| 自然语言上下文指令 | 🟡 部分 | Skill/CLI/REST 全链真实可用；MCP 工具面已通（64 工具可见），真实指令闭环待复测 |
| waiting_input | ✅ 已解决 | 提问→回答→同会话续跑→completed，真实复测通过 |
| 小错误自动修正一次 | 🟡 部分 | 架构/Skill 合同过；真实触发未复测 |
| 会话首选/失效只新建一次 | ✅ 基本解决 | 5 Run 同会话；`sessionInvalid` 标记疑似误报，待开发确认 |
| UI 术语降噪/右侧单工作台 | 🟡 部分 | 术语继续降噪；右侧单工作台未完成 |
| 多选 Target/Context 识别 | 🟡 未复测 | 真实 Skill 识别未验证 |
| `.lcosproj` 日常化 | 🟡 部分 | GUI 入口（打开/导出/备份/会话绑定）+ 浏览器 smoke 已过；Windows 文件关联仍 Gate W |
| 批量导出工程 | ✅ 已解决 | export-all + 项目工具入口 |
| Run Event Activity UI | 🟡 入口已加 | Activity/Recovery/stale 入口已补，未手工验收 |
| Runtime Recovery GUI | 🟡 入口已加 | 未手工验收 |
| Watcher / stale UI | 🟡 入口已加 | 未手工验收 |
| Checkpoint 项目时间线 | 🟡 部分 | WorkspaceStates 已有；时间线/对比未做 |
| Preview 统一 Viewer/外部打开 | 🟡 部分 | PreviewSurface 有；外部打开缺 |
| Handoff Context Pack | 🟡 部分 | Markdown 导出有；文件级 zip 包缺 |
| 文件夹扫描确认页/自动分组 | 🟡 部分 | 创建流程有；确认页/分组预览未手工验收 |
| 托盘 Runtime Host 生命周期 | 🟡 部分 | 托盘在跑；全生命周期未测 |
| Eagle/Obsidian/IMA/收藏夹 | 🟡 部分 | Obsidian 只读完成；其余无 |
| tldraw 读层 | ✅ 大幅补强 | Snapshot + 视口外 Cluster + recentChanges + SVG Observation + screenshotRef |
| tldraw 信号层 | 🟡 部分 | afterVersion + Agent 面板同步已验；无 SSE |
| tldraw 写层 | ✅ 大幅补强 | select/focus/move/viewport/relation/workspace/preview 已实现并过 MCP E2E |
| tldraw 闭环层 | 🟡 部分 | 真实 5 Run 闭环成立；MCP 工具面已通，真实 MCP 驱动 Run 待复测 |
| 全新机器单命令部署 | 🟡 部分 | bootstrap npm.cmd 坑已修、本机通过；干净 VM 未跑 |
| L3 真实 Ollama / native sqlite-vec | ❌ 网络受阻 | 安装包 1.49GB、本机网络 100–200KB/s；下载脚本就绪；C 盘仅 3GB，模型建议放 E 盘；BLOB fallback 工作 |

## 1. A 类：开发必须修（验收遗留）

| # | 问题 | 现状 | 要求 |
|---|---|---|---|
| A1 | **MCP 未进真实 Codex 会话** | ✅ 已关闭：根因=`models.json` DeepSeek 条目 `supports_search_tool=true` + `tool_mode=null` 触发动态工具发现，第三方 provider 不支持 tool_search 导致 MCP 静默隐藏（GitHub #31750/#36382 同款）；修复=备份后将该字段改为 `false`。实机验证：真实 `codex exec` 会话可见 64 个 `mcp__local_creative_os__*` 工具，只读调用 `list_lcos_projects` 真实返回 Core 数据（2026-08-06）。桌面 App 重启/新会话后生效；回滚=恢复 `models.json.bak-20260806-mcpfix` | 已完成；剩余：桌面 App 重启后复测一次（`supports_search_tool=false` 校验已并入 `scripts/install-lcos-codex-mcp.mjs`） |
| A2 | **看门狗单线程同步等待 runner** | runner 已强制退出（不再阻塞主循环），但主循环仍是单线程同步等待，架构脆弱（本轮已实际卡死一次） | 改异步 / 加超时护栏：一个 runner 卡住不得阻塞后续 Run；加回归测试覆盖“runner 不退出”场景 |
| A3 | **`run.started` 依赖 10s 自动同步** | 极短任务可能跳过 started 事件（UI 不依赖事件，可接受，但语义不稳） | 明确事件语义或缩短窗口；至少写文档说明 |
| A4 | **相机可见性常量分散** | 本轮已把过程/投影节点排除出相机判定，但“主内容最少可见比例”建议作为 UI 常量集中管理 | 集中常量 + 单测覆盖 |

## 2. B 类：真实闭环未跑满（不许称完成）

| # | 场景 | 现状 |
|---|---|---|
| B1 | 连续 5 Run 无重复、同一 Session 不乱跳 | 只完成 4 个真实 Run（1 spawn + 2 resume + 1 waiting_input resume） |
| B2 | revise / create 真实变体 | 未跑（只有 analyze 与 waiting_input 续跑） |
| B3 | 真实“运行中撤回进程树”（G） | 未实测（cancel API 对排队 Run 有效，Golden Path 覆盖 cancel 事件） |
| B4 | 浏览器 1 秒内实时上下文（H） | 探针验证版本实时递增（v345→v372，afterVersion 长轮询在跑），未做逐毫秒测量 |
| B5 | Obsidian UI 点选（I） | smoke/单测覆盖 readOnly + sourceUnchanged；原生目录选择器无法 headless，未走 UI 点选 |
| B6 | 长 Prompt 端到端恢复 | 未真实跑 |
| B7 | 从选中到发送 ≤3 个核心动作 | 未真实跑 |

## 3. C 类：用户视角功能缺口（Gate F 后仍欠）

| 能力 | 现状 | 还缺什么 |
|---|---|---|
| **对话 Session 导入** | 无（P0 新需求） | 见 `docs/product/LCOS_P0_CONVERSATION_IMPORT_PROJECT_BRIEF_20260805.md`（单独项目描述） |
| 自然语言上下文指令 | 底层命令有，真实链路未通 | 依赖 A1 类真实接单闭环；“把第二张也加进来”这类指令要 Skill 真实执行 |
| waiting_input | 协议/UI/一次真实问答已通 | 常态化：多场景复测、UI 人话展示、回答幂等 |
| 小错误自动修正一次 | Skill 白名单有（8 类结构化错误） | 真实触发一次并验证“修正后不打扰用户” |
| 手动接单后成为首选会话 + 会话失效只新建一次 | Session Affinity 逻辑有 | 真实流程未验证（失效→新建一次→绑定正确） |
| Agent 浏览器实时上下文 1s | 数据层 afterVersion 有，面板接入轮询 | 面板端逐毫秒复测 + 断线重连场景 |
| UI 术语降噪 / 右侧单工作台 | 只做了基础降噪 | 普通界面仍可能出开发话；“一次只有一个上下文工作台”未实现 |
| 多选后 Agent 自动识别 Target/Context | UI 只有本地静态人话摘要 | 真实 Skill 识别未验证 |
| `.lcosproj` 日常化 | 后端 v14 导出/导入可用 | GUI 打开/另存入口、双击打开、Windows 文件关联、自动发现、live store、状态栏保存状态 |
| 批量导出工程 | CLI/API 有 | 项目管理页备份/迁移入口 |
| Run Event 时间线 | SQLite/API 有 | Activity UI：人话任务过程、去重、错误定位 |
| Runtime Recovery | recover API 有 | GUI“重新连接/继续任务”按钮与故障解释 |
| Watcher / stale | Core 有测试 | UI 外部变化提示、重新读取、冲突处理 |
| Checkpoint | 保存/历史按钮有 | 项目时间线、命名、恢复与对比 |
| Preview | 缓存/注册表基础有 | 统一右侧 Viewer、外部打开 |
| Handoff / ContextManifest | 后端 manifest 有 | “交给另一个对话”/Context Pack 导出入口 |
| 文件夹扫描与项目索引 | Core 有 | 确认页、自动分组、节点合集与布局 |
| 托盘 Runtime Host | 脚本存在、曾修编码 | Windows 实机验收：单实例、自启动、退出、恢复、状态菜单 |
| Eagle/Obsidian/IMA/收藏夹连接器 | Obsidian 只读已做，其余无 | 统一资源连接器（远期；Obsidian 先按只读验收） |

## 3.1 重点：已开发但没有入口 / 半入口的能力（完整盘点）

> 口径：后端 / CLI / MCP 已有能力，但 GUI 没有入口或只有半入口。开发补齐入口时
> 以此表为准，避免“能力其实能用，用户却找不到”的隐形浪费。
> 入口现状经 `apps/web/src` 全量检索确认，2026-08-05。

| 能力 | 后端/CLI/MCP 现状 | GUI 入口现状 | 建议最小入口 |
|---|---|---|---|
| `.lcosproj` 导出/另存/打开 | POST `/projects/:id/export-lcosproj`、`/lcosproj/open`，CLI `project export / open-file` | 🔴 无（`localCoreClient` 有方法，UI 无引用） | 项目页“导出工程 / 打开工程”；双击与 Windows 文件关联归 Gate W |
| 批量导出工程 | POST `/lcosproj/export-all`，CLI `project export-all` | 🔴 无 | 项目管理页“备份 / 迁移”按钮 |
| Run Event 时间线 | GET `/runs/:id/events`，CLI `run events` | 🔴 无 | Activity 面板：人话任务过程、去重、错误定位 |
| Runtime Recovery | POST `/runs/:id/recover`，CLI `run recover` | 🔴 无（App 只把 failed 映射成状态，没有按钮） | Run 失败/卡住时“重新连接 / 继续任务”按钮 + 人话解释 |
| Provider Session 查看/绑定 | GET/PUT/DELETE `/provider-sessions`，CLI `provider-session get/set/clear` | 🔴 无（此前要手动改 sessions.json） | 设置/诊断页：查看首选会话、绑定、失效重建 |
| Artifact 搜索 | GET `/projects/:id/artifacts/search` | 🔴 无 UI 引用 | 画布搜索框 / 命令菜单搜索节点 |
| Codex Dispatch Plan 预览 | POST `/runtime/codex-dispatch-plan` | 🔴 无 | 派单前调试信息（用哪个会话/看门狗计划），低优先级 |
| 会话摘要列表/管理 | GET/POST `/session-summaries`，CLI `session summarize/list` | 🟡 部分：画布有 `session-summary-*` 节点渲染；无管理（重命名/删除）入口 | Inspector 内编辑/删除会话摘要 |
| 文件夹扫描确认页/自动分组 | POST `/project-roots/inspect` + 创建时 `importExisting` | 🟡 部分：创建流程有；确认页/分组预览/节点合集缺 | 导入确认对话框：文件数/类型预览、是否自动分组 |
| Watcher / stale 冲突处理 | FileObservationService + 相关 API（Core 有测试） | 🟡 部分：预览缓存有 | UI 外部变化提示 + 重新读取/冲突处理 |
| Checkpoint 时间线 | workspace states API + CLI `save-state / restore-state` | 🟡 部分：WorkspaceDock 保存/历史按钮有 | 项目时间线、命名、恢复与对比 |
| Preview 统一 Viewer/外部打开 | preview-cache + renderer registry | 🟡 部分：PreviewSurface 右侧栏有 | 统一查看器 + “外部打开”按钮 |
| Handoff Context Pack | context-manifests v0 + HandoffDialog | 🟡 部分：HandoffDialog 可复制/下载 Markdown；缺文件级 Context Pack | Context Pack（zip）导出入口 |
| Obsidian 连接器 | CLI/MCP + ObsidianImportDialog | 🟡 有入口，但原生目录选择无法 headless，真实 UI 点选未验收 | 实机点选验收一次（readOnly 已由 smoke 覆盖） |
| 资源理解/重分析 | resource descriptor/reanalyze API | 🟢 ResourceDetailDialog 有重分析按钮 | 无需新增 |
| Universal Resource Import（URL/上传/归档） | resource-upload-sessions / import-url | 🟢 CapabilityPopover → Universal Import 面板有 | 无需新增 |
| Workspace 状态保存/恢复 | workspace states API | 🟢 WorkspaceDock 有 | 无需新增 |
| CommandDraft / Context Proposal / ActiveContext | API + CLI + MCP | 🟢 Composer / Agent 模式卡片有 | 无需新增 |

对话 Session 导入整体为 🔴 无（P0 新需求），输入样本随包提供：

```text
docs/testing/fixtures/conversation-import-sample/session-p0-slice.jsonl（854KB 真实切片）
```

## 4. D 类：离 tldraw 式实时交互的差距（量化）

```text
第 1 层 读（Agent 能读懂画布）      ≈ 70%  差视口外 Cluster 摘要、近期操作、screenshotRef
第 2 层 信号（画布变化通知）        ≈ 40%  有 afterVersion 轮询，无事件流；浏览器面板接入基础有
第 3 层 写（Agent 能操作画布）      ≈ 40%  已有 select/focus/move_view、Context/Target/Workspace；
                                          缺 create_relation、加进 Workspace、open_preview、移动视口
第 4 层 闭环（观察→行动→再观察）   ≈ 10%  真实 Codex 会话闭环刚起步（A/B/E 已通）
```

最短补法（按顺序）：

```text
1. A2 修通后（A1 已于 2026-08-06 关闭），把真实 MCP 接单闭环稳定跑满 5 Run（B1/B2）
2. Canvas Context Snapshot 补视口外摘要 + screenshotRef（第 1 层补齐）
3. Typed Canvas Actions 补 create_relation / 加进 Workspace / open_preview（第 3 层扩展）
```

## 5. E 类：已收口、不要重复开发

- 极简 Composer（参考芯片 + 人话输入 + Agent + 结果节点 + 发送）
- CommandDraft 持久化（切节点/刷新/重启不丢）
- 多选、框选、组移动
- Workspace Membership GUI（加入/移出/移至）
- 撤回任务 + 迟到结果隔离
- Context 命令与 Proposal（加/移参考、设 Target、聚焦、提案持久化）
- Provider 能力门
- ActiveContext v14 持久化 + CAS + afterVersion
- Session Affinity 表 + 看门狗零注册 resume
- CLI/MCP 49→58 工具 + Skill 语义决策入口 + Core 最小 Guard
- Process Projection（只投影真实 Run，画布最多 3 个）
- 结果四按钮（使用/补充要求/重新执行/放弃）
- waiting_input 全链路（协议 + UI + 一次真实问答）
- Obsidian 只读连接器
- 质量链全绿基线（387 单测 + 57 架构 + 5 集成 + 35 pytest + 7 E2E + Golden Path）

## 6. 开发优先级建议

```text
P0-1  MCP 完全完善（A1 已关闭；解耦 + 全新机器单命令部署；指引见
       LCOS_MCP_COMPLETION_HELP_20260805.md 与 LCOS_MCP_BRIDGE_DECOUPLING_DESIGN）——最高优先
P0-2  A2：看门狗异步化 + 超时护栏
P0-3  B1/B2：真实连续 5 Run + revise/create 变体跑满
P0-4  对话 Session 导入 Phase 0（前置条件：P0-1 已过；见独立项目描述）
P1    B4 逐毫秒 / B3 真实撤回 / C 类 UI 入口（.lcosproj 日常化、Activity、Recovery）
P2    L3 语义索引 / 事件流（SSE）/ 其余连接器 / 安装器（Gate W）
```

不要在 P0-1~P0-3 修通前继续堆新架构（SSE、向量库、更多连接器、自动布局）；
对话导入的开工闸门是 P0-1 MCP 完全完善。

## 7. 验收口径（别被糊弄）

```text
用户能自然找到入口并完整用完
或 Agent 能通过 Skill 自动调用并得到可恢复结果
刷新和重启后还在
出错能恢复，错误是人话
```

Codex 必须是第一个真实通过全部 P0/P1 场景的本地 Agent；不允许用模拟 Agent、
脚本 claim 或“CLI 命令存在”代替真实浏览器上下文与自动执行闭环。接口、按钮、
Fixture 和类型测试不能算真实完成；未逐项复测前禁止宣称整体收口或可并入主干。

## 8. 复跑入口（开发自查）

```powershell
npm run audit:manifest:verify
npm run check:fast
npm run smoke:gatef-closeout
npm run test:golden:full
npm run test:e2e        # 先 npm run dev:stop
npm run dev:open
node tests/e2e/closeout-diag.mjs
node tests/e2e/single-click-probe.mjs
```
