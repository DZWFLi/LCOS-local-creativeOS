# LCOS P0 项目描述：本地 Agent 对话记录导入 Canvas

> 日期：2026-08-05
> 状态：设计定稿，等待开发施工（0 行实现代码）
> 关联设计：`docs/audit/LCOS_GATEF_REMAINING_GAPS_FOR_DEV_20260805.md`（轻量导入设计小节）
> 给开发的一句话：**不要先烧 token 把对话压缩成章节再导入。对话按原始时间线零成本入库，章节/决策是视图派生和用户钉选。**

## 1. 项目定位

把本地 Agent 的对话导出（Codex jsonl、ChatGPT/Claude 导出、或用户手动粘贴）导入 LCOS
Project，在画布上生成可管理节点：会话节点、章节锚点、消息节点、决策节点。导入后这些
节点可以搜索、可以加入 Workspace / ActiveContext、可以随 `.lcosproj` 导出、刷新重启
可恢复。

### 用户价值（Dz 原话口径）

- “工作流里能用到的文件都能放在画布上，右侧栏能进行编辑”；
- “和本地 agent 的聊天记录导入画布，形成可管理节点”；
- “不想导入前先消耗 token 像压缩上下文一样把记录变成章节格式”；
- 对话本质只有时间线性，章节/决策是**呈现形态**，不是导入成本；
- 单真相 + 多视图切换：大纲（幕布式树）↔ 思维导图/图谱（Obsidian 点状）↔ 画布，
  改一处全变、层级一致、无额外规则冲突；
- 布局模式（自由画布 ↔ Windows 桌面式网格吸附）只是摆放方式，不改变逻辑关系。

### 非目标（不要做）

- 不做全量对话压缩/总结管线（禁止“导入=先调模型”）；L2 按需小标注是唯一允许的模型调用；
- 不做云端同步、不做跨设备服务；
- 不抓取私有正文、不把“存在文件引用”伪装成“已读内容”；
- 不替换 React Flow / tldraw 画布，不新建第二张 Project Truth。

## 2. 技术路线（已定稿，见审计文档）

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

用户把时间线上的消息手动“钉选/升级”为决策节点 = 免费且高信噪比的结构化方式，
优先级高于任何 AI 自动切章。

## 3. 数据模型（Local Core SQLite）

当前 `metadata-repository.ts` 的 `schemaVersion` 为 **15**，本功能升级到 **16**，
必须带 migration（AGENTS 硬性规则：schemaVersion 与 migration 必须存在）。

### 新增表（建议）

```text
conversation_sessions
  id / project_id / provider / source_kind (codex|chatgpt|claude|manual)
  source_path / title / message_count / status / origin_meta_json
  imported_at / created_at / updated_at

conversation_messages
  id / session_id / seq / role / content_text / created_at
  tool_calls_json / file_refs_json / parent_id
  pinned_as_decision INTEGER / decision_title / decision_summary
  annotation_status (none|requested|done|failed) / annotated_at

conversation_sections
  id / session_id / seq / kind (turn|instruction|decision_cluster)
  title / start_seq / end_seq / derived_at / locked_by_user INTEGER

conversation_messages_fts  (FTS5 virtual table + 同步触发器)
```

### 复用既有表/服务

- `artifacts / artifact_views / workspaces / workspace_memberships`：会话节点、
  章节锚点、决策节点都落到既有 Artifact/View 类型，不新建平行节点体系；
- `file-records`：消息里的文件引用若命中项目根内文件 → 查找/复用既有文件 Artifact
  并建 relation；外部路径只存文本引用，不自动复制（安全边界，同 Obsidian 连接器）；
- `session_summaries`：保留；它是“人/Agent 写摘要”，与原始消息共存，不互相替代；
- `active_contexts / context_manifests / run_input_requests`：会话节点进入
  ActiveContext 后按既有 Context 冻结 / Run 机制工作。

## 4. Core 接入点（apps/local-core）

实现位置：`apps/local-core/src/server.ts`（HTTP 路由）+ `apps/local-core/src/metadata-repository.ts`
（表与仓储）+ 新增 `conversation-import-service.ts`（解析与派生，纯本地）。

大 jsonl（实测可达 80MB+）必须走**分片上传**，照抄现有
`resource-upload-sessions` 三段式（POST create → PUT files/chunks → POST complete），
不允许一次 multipart 硬吞大文件。

### 建议新增 REST 端点

```text
POST /projects/:projectId/conversation-import-sessions                 # 建导入会话
PUT  /projects/:projectId/conversation-import-sessions/:sessionId/chunks  # 追加分片
POST /projects/:projectId/conversation-import-sessions/:sessionId/complete # L0 解析 + L1 派生
GET  /projects/:projectId/conversations                                # 会话列表
GET  /projects/:projectId/conversations/:conversationId                # 投影：章节+决策+消息
GET  /projects/:projectId/conversations/:conversationId/messages       # 分页消息
GET  /projects/:projectId/conversations/search?q=                      # FTS5（L3 后混合向量）
POST /projects/:projectId/conversations/:conversationId/sections/refresh  # L1 规则重派生
POST /projects/:projectId/conversations/:conversationId/messages/:messageId/pin  # 升级决策
POST /projects/:projectId/conversations/:conversationId/annotate       # L2 按需小标注
POST /projects/:projectId/conversations/:conversationId/export         # 导出子集 / .lcosproj
```

### 接口语义约束

- `complete` 返回：会话节点、章节节点、消息统计、命中项目内文件的 relation 列表；
- 首次导入由 Core 生成默认坐标（复用现有 import position 语义）；用户移动后走既有
  Graph Mutation + CAS，不直接改 React State 或 SQLite；
- 浏览器/Agent 永远不提交绝对路径；导入路径走现有 trusted picker 语义；
- `sections/refresh` 不得覆盖 `locked_by_user=1` 的章节；
- 所有端点保持 loopback only、结构化错误（`{ok:false, error:{code,message}}`）；
- 导出必须是真实可恢复的子集（jsonl 切片 + 标注 + 决策），不是静态快照。

## 5. MCP 接入点（tools/lcos-agent/mcp-server.mjs）

当前 MCP 共 **58 个工具**，全部是 `tool(name, description, schema, required)` 注册的
薄委托（`coreRequest` / `bridgeRequest`），不直接读 SQLite。新增工具必须沿用该模式。

### 建议新增工具

```text
import_lcos_conversation          # 用户给出 jsonl/导出路径/原始文本 → 建会话+分片+complete
list_lcos_conversations           # 项目会话列表
get_lcos_conversation             # 会话投影（章节+决策+消息）
search_lcos_conversation          # FTS5 搜索
pin_lcos_conversation_message     # 钉选为决策节点（含 title/summary 可选）
refresh_lcos_conversation_sections# 触发 L1 规则重派生
annotate_lcos_conversation        # L2 小标注；仅当用户显式要求
```

### 约束

- 禁止绕过 Draft Review / Artifact Return / Accept 生命周期；
- 文件路径参数只接受：项目内路径、或用户显式给出的本地导出路径；
- 导入完成后返回画布可读摘要，不允许 Agent 自己“总结一遍”再入库。

## 6. Skill 接入点（packages/skills/lcos-project-context/SKILL.md）

新增章节 `Conversation import`：

```text
1. 用户给出对话导出（jsonl / json / 本地路径 / 手动粘贴）
2. 询问导入范围（整段 / 按章节 / 只导入选中消息）——一次一问，不啰嗦
3. 调 MCP import_lcos_conversation
4. 完成后向用户展示：会话节点、章节锚点、可钉选消息、命中文件 relation
5. 只有用户说“给我整理标题/关键决策”时才调 annotate（一次小任务/章）
```

禁止写进 Skill：

```text
“导入前先生成章节总结” → 违规（烧 token）
“文件引用 = 已读内容”   → 违规（引用是引用，正文是正文）
```

同步更新 `references/natural-language-examples.md`，至少补 2 个自然语言例子：

```text
“把我刚才这个对话导进项目里” → import + 展示章节
“把第 12 条消息钉成决策”      → pin + 更新 Inspector
```

## 7. CLI 接入点（tools/lcos-agent/cli.mjs）

新增 `conversation` 命令组，风格对齐现有 `group/action + --option`：

```powershell
npm run lcos -- conversation import <project-id> <jsonl-path> [--title "会话名"] [--scope <workspace-id>]
npm run lcos -- conversation list <project-id>
npm run lcos -- conversation show <conversation-id>
npm run lcos -- conversation search <project-id> "关键词"
npm run lcos -- conversation pin <conversation-id> <message-id> [--title "决策"] [--summary "..."]
npm run lcos -- conversation sections <conversation-id> [--refresh]
```

所有命令走 `coreRequest`，禁止 CLI 直读 SQLite。

## 8. Web/UI 接入点（apps/web）

### 导入入口

- 命令菜单 / 拖拽 jsonl / 文件选择，复用现有 Import Copy 的 trusted picker +
  upload session 流程；
- 导入完成后画布自动出现会话节点（不打断当前 Workspace 相机，沿用现有 fit/可见性规则）。

### 节点形态（沿用既有类型体系，不只靠颜色）

```text
会话节点  = Source / Original（文件图标 + 会话元信息）
章节锚点  = 派生分组（折叠态，默认不占密度预算）
消息节点  = Source 子节点（默认折叠，展开显示正文）
决策节点  = 用户钉选消息 → Decision / Checkpoint（形态/图标/边框区分）
```

### 视图切换（单真相多视图）

```text
时间线（默认） 线性消息流
大纲           幕布式树：会话 → 章节 → 决策/消息，层级一致
图谱           Obsidian 式点状：消息/文件/决策关联
画布           现有自由画布
```

切换只是同一份数据的投影，**改一处全变，无额外规则**。

### 布局模式

- 自由画布 ↔ 网格吸附（Windows 桌面式）两种模式；
- 只是摆放方式：自由画布记录自由坐标，网格模式按层级即时排列（可拖拽换位）；
- 切换互不覆盖；自动排布先预览后确认，不覆盖用户稳定锚点（AGENTS 性能规则）；
- 布局写入 debounce 300–800ms 批量保存。

### Inspector / 右侧栏

- 会话节点 Inspector 呈现“章节 → 关键决策 / 涉及文件 / 待办”聚合形态；
- 待办来源：消息中用户明确指令且无后续完成证据的消息（L1 规则候选，后置）；
- 会话节点可加入 ActiveContext，复用 ContextManifest / Run 冻结机制。

## 9. 借鉴的开源项目（GitHub 已实证存在）

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

## 10. 施工阶段与验收

### Phase 0（最小原型，先做）

```text
单 jsonl 导入 → L0 原始入库 + L1 规则章节 → 画布会话节点 + 时间线/大纲两视图
+ FTS5 搜索
```

验收：80MB 量级 jsonl 可导入不卡死；重启后节点/视图/搜索可恢复；导入过程零模型调用
（日志可证）；命中项目内文件的引用生成 relation。

### Phase 1

```text
钉选决策 + Inspector“章节/决策/涉及文件/待办”聚合 + L2 按需小标注 + 网格吸附布局
```

验收：用户一句话即可钉选决策；切视图全变；自由/网格切换不破坏关系；标注只在用户
要求时发生，且可审计。

### Phase 2（后置可选）

```text
L3 本地 embedding + FTS5 混合检索（sqlite-vec + Ollama/llama.cpp），后台异步
```

验收：不阻塞导入；索引可重建；检索结果带来源与原文可追溯。

### 总验收口径（沿用项目规则）

```text
用户能自然找到入口并完整用完
或 Agent 能通过 Skill 自动调用并得到可恢复结果
刷新和重启后还在
出错能恢复，错误是人话
```

Codex 必须是第一个真实通过全部 P0 场景的本地 Agent；不允许用模拟 Agent、脚本 claim
或“CLI 命令存在”代替真实闭环。接口、按钮、Fixture 和类型测试不能算真实完成。

## 11. 硬性边界（AGENTS 规则摘录）

- 一个 Project 一张持续存在的 Project Canvas；导入不新建第二张真相；
- 原始文件默认链接、不移动；外部路径不自动复制；SQLite 不存大 BLOB；
- AI 修改默认保存为新版本；删除 ArtifactView 不删除 Artifact；
- 只绑定 127.0.0.1；不引入遥测；不提交凭证；
- 不为了“未来通用”创建复杂泛型平台；migration 必须存在；
- 每阶段交付必须给修改文件、命令与真实结果、新增测试、未通过项与回滚点。
