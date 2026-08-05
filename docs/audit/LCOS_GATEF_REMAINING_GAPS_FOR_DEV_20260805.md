# LCOS Gate F 收口后仍欠清单（给开发）

> 基线：Gate F 全栈候选包已入库（`bcd7f7a` + `75565ca` + `a6aab15`），Windows 实机质量链全绿，
> 但“真实 Codex 会话闭环”未验证。这份清单按用户产品需求优先排序，不是工程问题清单。

## 一、用户明确要求过、现在仍没做/没做完（优先级最高）

1. **真实 Codex 自动接单闭环（最大缺口）**：GUI 发 Run → 看门狗 resume 真实 Codex 会话 →
   自动认领/执行/回传 → 画布出现结果 → 使用/放弃。目前只被脚本模拟验证过，真实会话一次没跑通。
2. **自然语言上下文指令**：“把第二张也加进来”“参考这些帮我改一下”→ Skill 自动执行。
   底层命令有，真实链路没通（依赖第 1 条）。
3. **waiting_input（Agent 需要你补充信息）**：Bridge 协议没有此状态，整条“Agent 有歧义时问你一次”
   的链路缺失。
4. **小错误自动修正一次**：validate-plan 失败后 Agent 应自动重读上下文、修正一次再打扰用户；
   该循环没有写进 Skill 指令。
5. **手动接单后成为首选会话 + 会话失效只新建一次**：逻辑有（Session Affinity），真实流程未验证。
6. **Agent 浏览器实时上下文 1 秒内刷新**：数据层 `afterVersion` 短轮询有，但浏览器 Agent 面板
   本身没接这个轮询，未验证“1 秒内看到新版本”。
7. **UI 术语降噪**：普通界面仍有“Local Core 连接异常”“Runtime 项目加载失败”等开发话；
   右侧仍是 WorkRail + 节点浮层 Composer + 面板并存，不是“一次只有一个上下文工作台”；
   错误人话 + 一键复制诊断未实现。
8. **多选后 Agent 自动识别 Target/Context**：UI 只有本地静态人话摘要，真实 Skill 识别未验证。
9. **一组验收场景未真实跑**：长 Prompt 端到端恢复、同项目连续 5 Run 无重复、
   从选中到发送 ≤3 个核心动作。

## 二、GPT 大盘点里的能力，Gate F 后仍欠的

| 能力 | 现在状态 | 还缺什么 |
|---|---|---|
| `.lcosproj` 日常化 | 后端已到 v14，导出/导入可用 | GUI 打开/另存入口、双击打开、Windows 关联、自动发现、live store、状态栏保存状态 |
| 批量导出工程 | CLI/API 有 | 项目管理页备份/迁移入口 |
| Run Event 时间线 | SQLite/API 有 | Activity UI：人话任务过程、去重、错误定位 |
| Runtime Recovery | recover API 有 | GUI“重新连接/继续任务”按钮和故障解释 |
| Watcher / stale | Core 有测试 | UI 外部变化提示、重新读取、冲突处理 |
| Checkpoint | 保存/历史按钮有 | 项目时间线、命名、恢复与对比 |
| Preview | 缓存/注册表基础有 | 统一右侧 Viewer、外部打开 |
| Handoff / ContextManifest | 后端 manifest 有 | “交给另一个对话”/Context Pack 导出入口 |
| 文件夹扫描与项目索引 | Core 有 | 确认页、自动分组、节点合集与布局 |
| 对话导入 Session | 无 | 按范围把对话整理成画布上的会话节点/章节锚点（新方向） |
| 托盘 Runtime Host | 脚本存在、曾修编码 | Windows 实机验收：单实例、自启动、退出、恢复、状态菜单 |
| Obsidian 连接器（第一优先） | 无 | 本地 Vault 目录扫描 + Markdown 只读导入；统一 Connector Port + 先落一个真实连接器（Eagle/IMA/收藏夹后置） |

## 三、Gate F 已补、不需要再做（防止重复开发）

- 极简 Composer：参考芯片 + 人话输入 + Agent + “结果作为新节点” + 发送，人话摘要提示。
- CommandDraft 持久化：长 Prompt 切节点/刷新/重启不丢。
- Ctrl/Cmd/Shift 多选、框选、组移动。
- Workspace Membership GUI：加入空间 / 移出空间 / 移至空间。
- 撤回任务 + 迟到结果隔离（脚本验证）。
- Context 命令与 Proposal：加/移参考、设 Target、聚焦；提案持久化 + Agent 模式卡片。
- Provider 能力门：只有可自动执行的 Agent 出现在普通列表。
- ActiveContext v14 持久化 + CAS + afterVersion（CLI/MCP 可 watch）。
- Session Affinity 表 + 看门狗零注册 resume。
- CLI/MCP 49 工具 + Skill 语义决策入口 + Core 最小 Guard。
- Process Projection 修正：只投影真实 Run，画布最多 3 个。
- 结果四按钮：使用这个版本 / 补充修改要求 / 重新执行 / 放弃这个结果。
- 质量链全绿：381 单测 + 48 架构 + 5 集成 + 32 pytest + 7 E2E + Golden Path。

## 四、验收标准（别被糊弄）

`有类型 / 有 API / 有按钮 / 有测试 / 文档写完成` 都不算完成。
只有满足以下才算：

```text
用户能自然找到入口并完整用完
或 Agent 能通过 Skill 自动调用并得到可恢复结果
刷新和重启后还在
出错能恢复，错误是人话
```

Codex 必须是第一个真实通过全部 P0/P1 场景的本地 Agent；
不允许用模拟 Agent、脚本 claim 或“CLI 命令存在”代替真实浏览器上下文与自动执行闭环。

## 五、已确认的产品默认值与新增要求（2026-08-05 用户拍板）

执行原则：**让本地 Agent 多介入，减少用户的束缚和决策层**。

### 产品默认值（已确认，直接采用）

1. waiting_input：允许自由文本 + 可选选项；不自动超时取消，只提示“仍在等待”。
2. 自动修正：只自动修正一次，只处理白名单结构化错误。
3. screenshotRef：按需当前视口截图，仅作 Observation 补充，不进 Canvas Truth。
4. Windows：文件关联 / 托盘 / 安装器归 Gate W，本轮不阻塞。

### 连接器优先级（已确认）

第一优先 = **Obsidian**（本地 Vault 目录 + Markdown，先做只读统一 Connector Port + 一个真实连接器）；
Eagle / IMA / 浏览器收藏夹后置。

### 新增要求：开源 Skill 借鉴研究

开发方需要调研当前开源、可借鉴的本地 Agent Skill 实现（例如 tldraw agent-template、
Anthropic 官方/社区 Skill 仓库、主流 Codex/Claude Skills 集合），产出一份《可借鉴清单》：

```text
每项包含：来源 / 能力 / LCOS 可借鉴点 / 落地建议
宗旨：减少用户束缚和决策层（用户说得越少，Agent 接管越多）
```

并从中选择 1–2 项直接改进 LCOS 的 `lcos-project-context` Skill，作为本轮交付之一。

### 对话导入样本（已备好）

真实创意项目样本已整理并完成导入/导出实证：

```text
样本目录：C:\Users\1\Desktop\LCOS_DevSupport_20260805\creative-project-sample
内容：brief.md / script.md / README.md / notes.json（预置 5 节点 + 2 Workspace + 4 关系）/ refs/ 3 张图
导入：已导入 LCOS 画布（8 个 Artifact / 8 个 View）
导出：creative-project-sample.lcosproj（schemaVersion 14，可再次打开恢复）
来源：美的项目（Core Crew 冰箱篇三维预演线），由真实对话 019fcfe0 整理
```

## 六、附：离 tldraw 式实时交互的开发差距（对照）

> 参考：MVP 对话中 GPT 原判断——“LCOS 已经有 tldraw 式 Agent Canvas 的数据入口，
> 但还没有观察—行动循环”。下表为其后 Gate F 入库并实机验证后的更新状态。

| 能力 | 当时判断 | Gate F 后现状 |
|---|---|---|
| 用户选择同步到 Core | 已有 | ✅ 更完整：v14 持久化 + CAS + 250ms debounce |
| Agent 读取 ActiveContext | 已有 | ✅ 加了 `afterVersion` watch（CLI/MCP），数据层可达 1 秒内 |
| Run 冻结 ContextManifest | 已有 | ✅ |
| Agent 专用浏览器视图 | 已有基础 | ✅ 基础增强：同步徽章/提案卡片/待办/Run 锁（探针验证） |
| 自动唤起/接单 Codex | 正在补 | 🟡 看门狗零注册 resume 已实现，真实会话闭环未跑通 |
| 全局 LCOS Skill | 已安装 | ✅ |
| 视口内结构化快照 | 未完整实现 | 🟡 大半完成：viewport/可见节点/坐标摘要/关系已有；缺视口外 Cluster 摘要与近期操作 |
| 画布截图上下文 | 未实现 | ❌ 没做（无 screenshotRef） |
| 实时 Canvas Event Stream | 未实现 | ❌ 没做；目前用 afterVersion 短轮询替代（拍板可接受，SSE 后置） |
| Agent Typed Canvas Actions | 未实现 | 🟡 部分：加/移参考、设 Target、聚焦、提案、发 Run 已通；move_view/create_relation/select/加进 Workspace/open_preview 没有 |
| Agent 移动视口并再次观察 | 未实现 | ❌ 没做 |
| 连续画布协作循环 | 未实现 | ❌ 没验证（依赖真实闭环） |

### 四层量化

```text
第 1 层 读（Agent 能读懂画布）      ≈ 70%  差视口外摘要、近期操作、截图
第 2 层 信号（画布变化通知）        ≈ 40%  有 afterVersion 轮询，无事件流，浏览器面板未接入
第 3 层 写（Agent 能操作画布）      ≈ 40%  只读 + 少量上下文命令；几何动作全无
第 4 层 闭环（观察→行动→再观察）   ≈ 10%  真实 Codex 会话一次没跑通
```

### 最短补法（按顺序）

1. 真实 Codex 接单闭环跑通（第 4 层地基）；
2. Canvas Context Snapshot 补视口外摘要 + 截图引用（第 1 层补齐）；
3. Typed Canvas Actions 先做 `focus_views / select_views / move_view` 三个安全几何动作（第 3 层破冰）。

这三样完成后，tldraw 式协作主循环成立，其余为增强。
