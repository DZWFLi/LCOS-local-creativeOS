# Local Creative OS / AdFrame 项目总纲

> 用途：用于新的前端设计对话、Figma 交互设计、Codex 工程实现和后续产品讨论。  
> 当前阶段：从单页式 Script Review Demo，转向“先确认高保真前端原型，再推进真实前后端能力”的产品流程。  
> 核心原则：先把产品路径、视觉语言与交互状态确认，再由 Figma 完成交互细化，最后由 Codex 负责前端封装、本地 Core、MCP、插件与 AI Runtime。

---

## 1. 项目背景

最初的设想是做一个 AI Native 的创意工作流系统，帮助广告与 AIGC 创意人员管理：

- Brief
- Insight
- Creative Direction
- Script
- Storyboard / Shot List
- Reference
- Asset
- Feedback
- Decision
- Version
- Task
- Skill
- Artifact

早期方向更接近“Creative Workflow Canvas”或“AI Creative Workbench”，希望让 GPT、Codex、WorkBuddy、本地工具和外部 AI 平台进入同一套创意流程。

随后做出了一个一周 Demo：

- Day 1：静态三栏评审工作台
- Day 2：可交互的 Script Review
- Day 2.5：可复用加固
- Day 3：案例、演示路径、README、Case Study 收口

这套 Demo 已跑通：

`Brief → Script Version → Segment → Human Review / Mock AI → Decision → Compare → Codex Handoff`

但它仍然存在明显问题：

1. 入口是假定脚本已经被导入并标准化；
2. AI 是 Mock；
3. Codex Handoff 只是复制文本或 JSON；
4. 没有真实文件来源；
5. 没有从原始 Brief 到脚本生成的过程；
6. 固定三栏信息密度过高；
7. UI 更像评测后台，不像长期使用的创意工作空间；
8. 没有真正接通 MCP、插件、飞书、Notion 和本地执行。

因此，当前项目需要重新定义主干。

---

# 2. 最终产品定位

## 2.1 产品名称

工作名：

**Local Creative OS**

现有 Script Review 模块可继续使用：

**AdFrame Review**

未来可以形成：

```text
Local Creative OS
├── Project Home
├── Sources
├── Creative Workspace
├── Brief
├── Direction
├── Script
├── Review
│   └── AdFrame Review
├── Skills
├── Plugins / Connectors
├── Runs
└── Outputs
```

## 2.2 一句话定位

> 一个以 Codex 为执行内核、本地项目上下文为核心、可连接飞书、Notion、本地文件与外部创作平台的个人 Creative OS。

## 2.3 核心价值

它不试图替代所有工具，而是：

- 组织真实项目上下文；
- 接收原始 Brief 与文件；
- 让 AI 在项目上下文中持续工作；
- 管理 Script、Direction、Review、Decision 与 Artifact；
- 通过 Skill、Plugin、MCP 和 Codex 完成真实执行；
- 让结果自动回到项目，而不是靠人工复制粘贴；
- 保持数据与项目目录主要在本地；
- 让创意人员能掌控版本、决策、来源和产物。

## 2.4 与 TapNow 的关系

TapNow 最新的 Creative OS / Agentic Canvas 更新已经展示：

- Brainstorm
- Skills
- Skill Creator
- Personal Skills
- Plugins
- 飞书 / Lark
- Notion
- Google Drive
- Figma
- 项目回访
- 历史对话
- 永久记忆
- 统一素材库
- 画布生成

这说明“创意工具会走向项目、记忆、插件、Skill 与 Agent 协作”这一方向是成立的。

但本项目不是 TapNow 的本地复制版。

### TapNow 更偏向

```text
进入平台
→ 使用平台内 Canvas / Agent / Skill / Plugin
→ 在平台内完成生成与创作
```

### Local Creative OS 更偏向

```text
飞书 / Notion / GPT / 本地文件 / 浏览器 / 外部生成平台
                    ↓
            Local Creative OS
                    ↓
        项目上下文 + Skill + Runtime
                    ↓
                  Codex
                    ↓
      本地执行 / MCP / Bridge / Artifact
                    ↓
               回到项目
```

差异点：

- Local-first
- Codex-native
- 本地文件可读写
- 可连接现有工具，而不是强迫迁移
- 项目 Context 是核心
- Review 与 Decision 是一级对象
- 外部工具是 Source 或 Execution Provider
- 开源连接器越成熟，产品能力越强

---

# 3. 目标用户

第一阶段只服务：

- 个人创意策划
- 广告 / AIGC 创意人员
- 内容导演
- 脚本策划
- 小型 5–20 人创意团队中的核心创意角色

不优先服务：

- 大型企业协同
- 通用项目管理
- 数据标注团队
- 纯开发团队
- 全流程影视制片公司

---

# 4. 核心用户流程

产品必须从真实源文件开始，而不是从“脚本已经存在”开始。

```text
创建项目
→ 导入原始 Brief / PDF / DOCX / PPTX / Markdown
→ 查看源文件
→ 提取文本
→ AI 整理 Brief
→ 人工编辑与确认
→ 生成 Creative Direction
→ 选择方向
→ 生成 Script
→ 编辑 Script
→ 进入 Review
→ 形成 Decision
→ 通过 Codex / Bridge / MCP 执行
→ Artifact 返回项目
```

## 4.1 真实演示路径

以 PortaSplit 为例：

1. 用户拖入 `PortaSplit_Brief.pdf`
2. 中央显示原始 PDF
3. 用户在 Composer 输入：

```text
根据这份 Brief，整理核心卖点、目标受众、禁用项和交付要求。
```

4. AI 生成 `Brief Snapshot`
5. 用户继续输入：

```text
基于 Brief 给出 3 个 15 秒竖屏短片方向。
```

6. 生成 3 个 Creative Direction
7. 用户选择 Direction B
8. 用户输入：

```text
基于方向 B 生成一版 15 秒脚本，保持 0–6 秒缓慢拉镜。
```

9. 系统生成 Script V1
10. 用户编辑脚本
11. 进入 AdFrame Review
12. 形成 Review、Decision、Locked Elements
13. 点击 `Run with Codex`
14. Local Core 调用 Bridge / MCP
15. Codex 修改项目文件
16. Script V2 或其他 Artifact 返回项目

---

# 5. 产品信息架构

## 5.1 Project Home

核心任务：

- 创建项目
- 拖入文件创建项目
- 回到最近项目
- 查看正在运行的 Codex Task
- 查看待确认结果
- 查看最近 Artifact

不是传统 Dashboard，不强调统计数字。

## 5.2 Sources

来源对象包括：

- PDF
- DOCX
- PPTX
- Markdown
- TXT
- 飞书文档
- Notion 页面
- 浏览器网页
- 本地目录
- Google Drive
- Figma
- 外部创作平台

Sources 不是简单附件，而是一级对象。

## 5.3 Brief

由 Source 派生：

- Objective
- Audience
- Core Message
- Product Benefits
- Mandatory Elements
- Avoid
- Open Questions
- Locked Elements
- Source Provenance

## 5.4 Creative Direction

每个方向包含：

- Concept
- Core Mechanism
- Tone
- Product Role
- Audience Fit
- Platform Fit
- Risk
- Related References
- Source Brief

## 5.5 Script

包含：

- Script Version
- Segment
- Time Range
- Visual
- Action
- Audio
- On-screen Text
- Purpose
- Product Role
- Locked Elements
- Source Direction

## 5.6 Review

复用 AdFrame Review：

- Human Review
- AI Draft
- Accept / Revise / Reject
- Issue
- Business Impact
- Evidence
- Suggestion
- Keep / Modify / Remove
- Decision
- Locked Elements
- Version Compare

## 5.7 Runs

展示真实执行状态：

```text
Preparing Context
→ Queued
→ Running
→ Files Changed
→ Review
→ Artifact Ready
```

## 5.8 Outputs

管理：

- Script
- Brief
- Creative Direction
- Review Pack
- Shot List
- Prompt Pack
- PPT
- Markdown
- JSON
- Figma
- Blender
- 视频 / 图片
- 其他执行产物

---

# 6. 核心领域对象

建议保持清晰，不做“万能创意对象”式过度抽象。

```ts
type Project = {
  id: string;
  name: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

type SourceDocument = {
  id: string;
  projectId: string;
  sourceType:
    | "local-file"
    | "feishu"
    | "notion"
    | "google-drive"
    | "figma"
    | "web";
  title: string;
  originalPath?: string;
  sourceUrl?: string;
  mimeType?: string;
  syncStatus: "local" | "synced" | "stale" | "error";
};

type SourceSnapshot = {
  id: string;
  sourceDocumentId: string;
  extractedText: string;
  createdAt: string;
  version: number;
};

type BriefDocument = {
  id: string;
  projectId: string;
  sourceSnapshotIds: string[];
  objective: string;
  audience: string;
  coreMessage: string;
  productBenefits: string[];
  mandatoryElements: string[];
  avoid: string[];
  openQuestions: string[];
  lockedElements: string[];
};

type CreativeDirection = {
  id: string;
  projectId: string;
  briefId: string;
  title: string;
  concept: string;
  mechanism: string;
  productRole: string;
  tone: string;
  risks: string[];
  status: "draft" | "selected" | "rejected";
};

type ScriptDocument = {
  id: string;
  projectId: string;
  directionId: string;
  versions: ScriptVersion[];
};

type ScriptVersion = {
  id: string;
  scriptId: string;
  sourceVersionId?: string;
  label: string;
  status: "draft" | "current" | "approved" | "archived";
  segments: ScriptSegment[];
};

type ScriptSegment = {
  id: string;
  versionId: string;
  title: string;
  timeRange: string;
  visual: string;
  action: string;
  audio: string;
  onScreenText: string;
  purpose: string;
  productRole?: string;
  lockedElements: string[];
};

type Review = {
  id: string;
  projectId: string;
  versionId: string;
  segmentId: string;
  authorType: "human" | "ai";
  issue: string;
  impact: string;
  evidence: string;
  suggestion: string;
  disposition?: "accepted" | "revised" | "rejected";
};

type Decision = {
  id: string;
  projectId: string;
  versionId: string;
  segmentId?: string;
  keep: string[];
  modify: string[];
  remove: string[];
  nextGoal: string;
};

type Run = {
  id: string;
  projectId: string;
  runtime: "codex" | "bridge" | "deepseek" | "mcp";
  status:
    | "created"
    | "queued"
    | "running"
    | "review"
    | "completed"
    | "failed";
  inputObjectIds: string[];
  outputArtifactIds: string[];
};

type Artifact = {
  id: string;
  projectId: string;
  runId?: string;
  type: string;
  localPath?: string;
  sourceUrl?: string;
  createdAt: string;
};

type Connector = {
  id: string;
  type: "feishu" | "notion" | "google-drive" | "figma" | "mcp";
  status: "connected" | "disconnected" | "error";
};
```

---

# 7. 技术架构

## 7.1 前端

第一阶段：

- React
- TypeScript
- Vite

职责：

- 项目空间
- 文件与文档预览
- Composer
- Review UI
- Run 状态
- Artifact 展示
- 视觉与动效

## 7.2 Local Core

新增本地 Node.js + TypeScript 服务，仅绑定：

```text
127.0.0.1
```

建议：

```text
localhost:5173  Web UI
localhost:4318  Local Core
```

职责：

- 文件导入
- 本地项目目录管理
- PDF / DOCX / PPTX 文本提取
- AI API 调用
- Codex / Bridge 调用
- MCP 执行
- 任务状态监听
- Artifact 回收
- 本地文件写入
- Connector 同步

第一阶段不急着上 Electron。

## 7.3 本地项目目录

```text
projects/
└── portasplit-thinker/
    ├── project.json
    ├── sources/
    │   └── original-brief.pdf
    ├── snapshots/
    │   └── brief-source-v1.json
    ├── documents/
    │   ├── brief-v1.md
    │   ├── direction-b.md
    │   └── script-v1.md
    ├── reviews/
    │   └── script-v1-review.json
    ├── runs/
    │   └── run-20260717.json
    └── artifacts/
        └── script-v2.md
```

优点：

- Codex 可直接访问
- Git 可管理版本
- 文件可手工查看
- 不依赖数据库
- 与 Bridge / Context Pack 兼容

第一阶段全局项目索引可用 `index.json`，后续再考虑 SQLite。

## 7.4 AI 分工

### DeepSeek API

用于：

- 对话
- Brief 整理
- Creative Direction
- Script 生成
- 文本分析

### Codex / Bridge

用于：

- 读写项目目录
- 调用 Skill
- 运行脚本
- 修改文件
- 生成 Artifact
- 执行 MCP
- 回写项目

建议边界：

```text
DeepSeek：对话、分析、文本生成
Codex：项目操作、文件落盘、Skill 与 MCP 执行
```

## 7.5 Adapter 结构

```ts
interface ReviewRepository {
  loadProject(projectId: string): Promise<ProjectState | null>;
  saveProject(state: ProjectState): Promise<void>;
  resetProject(projectId: string): Promise<void>;
}

interface ReviewEvaluator {
  evaluate(input: EvaluationInput): Promise<EvaluationResult>;
}

interface ExecutionRuntime {
  createTask(input: HandoffInput): Promise<ExecutionTask>;
}

interface SourceConnector {
  importSource(input: SourceInput): Promise<SourceDocument>;
  sync(sourceId: string): Promise<SourceSnapshot>;
}
```

当前实现可分别为：

- LocalStorageReviewRepository
- MockReviewEvaluator
- CopyOnlyCodexRuntime

未来替换为：

- LocalFileReviewRepository
- DeepSeekReviewEvaluator
- CodexCLIRuntime
- BridgeRuntime
- FeishuConnector
- NotionConnector
- MCPConnector

---

# 8. 飞书与 Notion 的定位

## 8.1 飞书

飞书是业务入口：

- 客户 Brief
- 团队讨论
- 客户反馈
- Review 文档
- 最终交付
- 消息与任务通知

目标流程：

```text
读取飞书文档 / 消息摘要
→ 转成项目 Context
→ 绑定 Brief / Feedback / Deliverable
→ Codex 处理
→ 写回飞书或发送通知
```

## 8.2 Notion

Notion 是个人知识库：

- 品牌资料
- 历史案例
- 创意模板
- 行业研究
- Reference
- Skill 方法论
- 脚本案例库
- Prompt 模板

目标流程：

```text
当前 Brief
+
Notion 品牌语气规范
+
历史案例
+
Locked Elements
→ 生成 Context Pack
```

## 8.3 单一状态源

避免：

```text
飞书一版
Notion 一版
本地 Markdown 一版
最后共同研究“最终版2”
```

建议：

> 本地项目目录是状态源，飞书与 Notion 是外部来源与同步目标。

记录：

```text
source_type
source_url
source_id
last_synced_at
local_snapshot
sync_direction
```

---

# 9. Skill / Plugin / MCP

## 9.1 Skill

Skill 不应只是文件夹，而应可发现、可筛选、可调用。

用户通过 Composer 调用：

```text
/整理Brief
/生成创意方向
/脚本评审
/拆分镜头
/生成Prompt Pack
/导出飞书
```

Skill 面板应按：

- 当前阶段推荐
- 最近使用
- 项目级
- 用户级
- 全部 Skill

每次只注入选中的 Skill，不一次加载全部 Skill。

## 9.2 Plugin / Connector

包括：

- 飞书
- Notion
- 本地文件
- Google Drive
- Figma
- 浏览器
- TapNow
- Lovart
- 外部生成平台
- MCP Server

## 9.3 MCP

MCP 不再只是复制 JSON。

真正流程：

```text
用户点击 Run with Codex
→ Local Core 调用 Bridge create_task
→ UI 显示 queued / running / review
→ Codex / WorkBuddy 生成文件
→ Bridge 返回 Artifact
→ Artifact 自动进入项目 Output
```

复制 Markdown / JSON 只保留为 Debug / Manual Fallback。

---

# 10. 当前 AdFrame Review 模块

当前已完成能力：

- Script V1 / V2 / V3
- Segment
- Purpose
- Product Role
- Locked Elements
- Human Review
- AI Draft
- Accept / Revise / Reject
- Keep / Modify / Remove
- Decision
- Source / Current Compare
- localStorage
- Markdown / JSON / Codex Handoff
- Reset Demo
- Evaluator Adapter
- Repository
- Runtime Adapter
- schemaVersion

这些能力应保留为：

```text
features/review/
```

当前旧版固定三栏 App Shell 不作为主产品架构继续发展。

---

# 11. 前端产品流程

当前决定：

> 先确认前端高保真原型，再进入 Figma 交互状态，最后由 Codex 完成前后端封装。

## 11.1 阶段一：Image2 / Image Generation

目标：

- 确认视觉语言
- 确认页面结构
- 确认空间感
- 确认组件比例
- 确认信息密度
- 确认材质与光影

先生成：

1. Project Home
2. Import & Sources
3. Brief Workspace
4. Creative Direction Canvas
5. Script Editing
6. Review + Codex Run

## 11.2 阶段二：Figma

完成：

- 页面状态
- Drawer 开合
- Inspector 出现 / 关闭
- Composer 状态
- `@` Context
- `/` Skill
- Plugin
- File import
- AI streaming
- Review annotation
- Codex Run
- Artifact Return
- 错误态
- 空状态
- Loading
- Motion Spec

## 11.3 阶段三：Codex

Codex 负责：

- 前端组件封装
- 设计系统实现
- Local Core
- 文件导入
- DeepSeek API
- Codex / Bridge
- MCP
- Connector
- 项目目录
- Artifact 回收
- 前后端集成

---

# 12. UI 视觉方向

当前偏好：

> TapNow 的空间层级 + Kimi 的轻操作 + 飞书文档的阅读体验 + 少量液态金属微交互。

风格命名：

**Soft Editorial Creative OS**

## 12.1 视觉关键词

- 明亮暖白
- 冷灰表面
- 少量浅蓝与薰衣草环境光
- 大留白
- 高级文档感
- 轻空间感
- 细边框
- 柔和阴影
- 克制玻璃
- 少量液态金属关键控件
- 高可读性
- 非传统 SaaS Dashboard

## 12.2 液态金属使用范围

只用于少数关键操作：

- Send
- Add
- Run with Codex
- Create Script
- Active state

禁止所有按钮都发光或金属化。

## 12.3 不要出现

- 永久三栏
- 密集 Dashboard
- 大量小卡片
- 满屏星点
- 赛博朋克
- Web3
- 电竞 UI
- 过度玻璃
- 过度霓虹
- 小字号
- 低对比度
- 每个按钮都发光
- 传统后台表格感

---

# 13. UI 结构

## 顶部

```text
Sources / Brief / Direction / Script / Review / Output
```

这些是模式，不是永久并排栏。

## 左侧

可收起 Source Drawer：

- 原始文件
- 飞书
- Notion
- Reference
- 版本
- Artifact

## 中央

主工作区：

- PDF / DOCX / PPTX
- Brief
- Direction
- Script
- Review
- Output

## 右侧

按需 Inspector：

- 来源
- 版本
- Locked Elements
- 关联 Review
- 文件路径
- Skill
- Run 设置

## 底部

统一 Composer：

```text
+ 文件
@ 项目对象
/ Skill
Plugin
模型
Run with Codex
```

---

# 14. 动效原则

动效必须解释状态，而不是装饰。

## 页面级

- Project → Workspace：项目卡自然展开
- Mode 切换：淡入 + 轻位移
- Source Drawer：推入
- Inspector：从选中对象附近滑出

## Composer

- 聚焦扩展
- `@` / `/` / Plugin 浮层
- 文件变成 Context Chip
- 发送后进入 Run 状态

## Codex Run

```text
Preparing Context
→ Running Skill
→ Files Changed
→ Artifact Ready
```

## Artifact Return

Artifact 从 Run 区域进入 Output，并有明确落位动画。

## 动效时间

- 微交互：120–180ms
- Drawer / 浮层：180–240ms
- 页面 / Mode：220–320ms
- 支持 `prefers-reduced-motion`

---

# 15. 六个核心页面

## 15.1 Project Home

- Continue creating
- 大 Composer
- Import Brief
- Create from Feishu
- Connect Notion
- Open Local Project
- Recent Projects
- Codex Activity

## 15.2 Import & Sources

- 文件拖入
- PDF / DOCX / PPTX / Markdown
- Feishu / Notion
- Source Drawer
- File Inspector
- 提取任务

## 15.3 Brief Workspace

- 原文件预览
- Brief Snapshot
- 来源页码
- AI Suggestion
- 编辑与确认
- Locked Elements

## 15.4 Creative Direction Canvas

- 多方向卡片
- Brief → Direction 来源关系
- Reference
- 选择方向
- Create Script

## 15.5 Script Editing

- 文档式 Script
- Version Drawer
- Contextual Toolbar
- AI Rewrite
- Compare
- Save as New Version

## 15.6 Review + Codex Run

- 行级 Review Marker
- 浮动 Review Panel
- Human / AI
- Decision
- Run with Codex
- Files Changed
- Artifact Returned

---

# 16. 当前开发优先级

## 先做

1. 前端高保真视觉图
2. 页面信息架构
3. Figma 可交互状态
4. Motion Spec
5. 设计验收
6. 新 App Shell
7. Local Core
8. 文件导入
9. DeepSeek
10. Codex / Bridge / MCP
11. Review Module 接回
12. 飞书 / Notion Connector

## 暂时不做

- 完整自由节点画布
- 多人权限
- SaaS 账号
- 云数据库
- Electron
- 模型市场
- 插件商店
- 多 Agent 编排
- 全格式一口气支持
- 移动端
- 企业级协作

---

# 17. 前端设计对话的关键任务

新的前端设计对话应围绕：

1. 视觉语言是否成立
2. 项目首页是否足够轻
3. Source Drawer 是否合理
4. 文档阅读是否舒服
5. Composer 是否能成为统一入口
6. Creative Canvas 是否有空间感但不过度自由
7. Review 是否从永久三栏变成行级批注
8. Codex Run 是否能让人看懂真实执行
9. Artifact Return 是否有明确落位
10. TapNow、Kimi、飞书文档与液态金属风格如何融合
11. 动效是否解释状态
12. 1366×768 下是否仍然好用

---

# 18. 需要保留的产品原则

1. 源文件是一等对象。
2. 本地项目目录是状态源。
3. AI 输出不能覆盖人工判断。
4. Review 与 Decision 分离。
5. Locked Elements 必须跨版本保留。
6. Codex 必须真实执行，而不是只生成 Handoff 文本。
7. MCP 必须成为执行路径，而不是文案。
8. 飞书是业务入口，Notion 是知识库。
9. Skill 按需注入。
10. UI 先确认，再工程实现。
11. 作品集 Demo 与真实产品原型可以并行，但不能互相冒充。
12. 当前 AdFrame Review 是模块，不是整个产品。

---

# 19. 当前阶段一句话

> 当前项目已从“单页式 Script Review Demo”升级为“本地优先、以 Codex 为执行内核、从原始 Brief 到 Script、Review 与 Artifact 的个人 Creative OS”；下一步先完成高保真前端视觉与 Figma 交互，再由 Codex 推进真实前后端、MCP、Skill、插件和连接器。
