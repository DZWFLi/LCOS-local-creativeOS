# LCOS Gate F 收口后仍欠清单（给开发）

> 基线：Gate F 全栈候选包已入库（`bcd7f7a` + `75565ca` + `a6aab15`），Windows 实机质量链全绿，
> 但“真实 Codex 会话闭环”未验证。这份清单按用户产品需求优先排序，不是工程问题清单。

## 〇、最高优先级：对话记录导入 Canvas（2026-08-05 用户拍板 P0）

**需求**：把用户与本地 Agent 的聊天/对话记录（指定范围）导入 LCOS 画布，形成可管理的节点，
与“文件夹导入”一起解决项目开场“画布上该放什么”的问题。

**状态**：0 代码、0 接口，未开发。

### 输入样本（已具备，无需用户再提供）

- 本机 `~/.codex/sessions/**/*.jsonl` 就是真实 Codex 会话原始记录（含 MVP 大对话，144MB），
  可截取片段并脱敏后作为开发样本；
- 注意：`creative-project-sample`（美的）是**文件/素材项目样本**，用于验证“文件夹→画布→.lcosproj”，
  不是对话记录样本；两者不要混淆。

### 画布形态（用户给的方向，先做形态探索/原型对比再定）

1. **幕布式树状大纲**：会话按章节/层级展开为可折叠大纲；
2. **Obsidian 式点/图谱**：关键决策、文件、结论作为节点，关系可视化；
3. **会话节点 + 章节锚点**：一个会话一个节点，展开为“需求/方案/执行/结论”章节，
   章节挂关键决策、涉及文件、未完成事项；
4. **复用/改造“节点集合”能力**：把会话章节映射到现有节点集合/工作空间机制，不另起一套平行模型。

### 实现方式建议（单真相 + 视图切换 + 布局模式）

核心不是“做四种界面”，而是**一份数据、多种画法**（幕布原理：大纲与思维导图是同一层级的两种画法）：

1. **单真相**：对话导入生成的是普通节点集合（会话节点 → 章节 → 决策/文件引用/待办），
   层级就是父子关系，文件引用直接复用现有文件节点，不复制文件、不新建“对话专属存储”；
2. **视图 = 渲染器**：大纲、思维导图、图谱、画布都读同一份数据；切换视图只是换画法，
   改层级任何视图同步变（“大家一起变”），因此没有两份数据要同步、天然不冲突；
3. **布局模式与数据分离**：自由画布 / 网格吸附（Windows 桌面图标自动排列式）都是“摆放方式”，
   不是数据结构。逻辑关系（章节/父子/决策）不变；自由模式存手摆坐标，
   网格模式按层级即时排列（可拖拽换位），两种模式可随时切换互不覆盖；
4. 避免的坑：不要把导入做成静态快照/截图，也不要每个视图各存一份副本。

### 轻量导入设计（线性原始 → 视图派生，不烧 token）

对话本质是时间线，章节/决策是**呈现形态**，不是导入成本。分层设计：

```text
L0 原始入库（零 token）：jsonl 纯解析 → 消息/工具调用/文件引用按时间序进 SQLite
   + FTS5 全文索引；文件引用复用现有文件节点；导入=解析，不调模型
L1 结构派生（零 token）：规则切章（回合边界/新指令出现/文件引用密度/超长消息分段）
   → 章节只是分组视图，不存为新真相
L2 按需小标注（极省）：仅当用户要看“章节标题/关键决策”时，让本地 Agent 跑一次
   小任务（每章 5 字标题 + 决策 3 条），存为轻量标注；不做全量压缩
L3 语义索引（后置可选）：本地 embedding（Ollama/llama.cpp/bge-small）→ sqlite-vec
   存向量，FTS5 + 向量混合检索；异步后台建索引，不阻塞导入
```

用户把时间线上的消息手动“钉选/升级”为决策节点 = 免费且高信噪比的结构化方式。

### 可借鉴的开源项目（GitHub 实证）

```text
loregraph                  直接读 Claude Code JSONL / aider 历史建记忆图谱（零依赖 Rust）——格式解析照抄
llmchat-knowledge-converter ChatGPT/Claude 导出 → Obsidian 可消费图谱 + FTS + embedding——转换管线照抄
basic-memory               Markdown + MCP + SQLite 实体/观察/关系图——本地存储骨架照抄
sovereign-brain            SQLite + sqlite-vec + Ollama embedding，typed/weighted edges——语义层照抄
sqlite-memory（sqliteai）   SQLite 扩展：FTS5 + 向量混合检索 + 本地 embedding（llama.cpp）——检索层照抄
sqlite-vec（asg017）        纯 C 零依赖的 SQLite 向量扩展（vec0 虚拟表 + KNN）——L3 的具体存储件
localmind                  Ollama + 单 SQLite 文件：BM25 + 向量 + 图三重混合召回——整体检索组合最接近本方案
Graphiti（FalkorDB）        时间感知知识图谱，边带时间与来源——只抄“边带时间”思想，不抄重架构
lcm-core                   SQLite 消息库 + FTS5 + 多级压缩——压缩思想按需取用
```

结论：不新建“对话压缩管线”，采用“原始时间线入库 + 规则/视图派生 + 按需小标注 +
可选本地语义索引”，全部本地、增量、可导出。

### 待定项（需要原型回答）

- 导入粒度：整段 / 章节 / 消息；
- 附件与工具调用是否保留；
- 隐私与脱敏策略；
- 导入后是否可继续作为 Agent 上下文、可导出 `.lcosproj`、可恢复。

### 验收

指定范围对话导入 → 画布生成可管理节点（按选定形态）→ 可继续工作 / 可导出工程文件 →
刷新与重启可恢复。

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
| Eagle/Obsidian/IMA/收藏夹连接器 | 无 | 统一资源连接器（远期） |

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

## 五、附：离 tldraw 式实时交互的开发差距（对照）

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
