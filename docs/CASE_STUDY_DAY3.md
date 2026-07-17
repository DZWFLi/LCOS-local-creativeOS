# AdFrame Script — 案例研究

> 日期：2026-07-17
> 阶段：Day 3 文档成品
> 审核：基于 `refactor/reusable-review-core` 分支实现事实

---

## 1. 问题背景

### 1.1 AIGC 广告素材的评审困境

AI 生成商业视频的门槛在 2025–2026 年大幅下降。一个创意团队可以在几小时内产出数十条脚本、分镜和视频变体，但**判断哪条能用、哪条会伤害品牌**仍然没有非专业工具解决。

常见痛点：

- **Brief 和执行脱节**。Brief 写了"禁止夸张蓝色冷气"，生成结果依然出现大面积蓝光特效。问题不是生成质量，而是**没有人把 Brief 作为评测基准逐条对照**。
- **反馈不可追溯**。客户的"不喜欢这个动作"变成口头意见，下一轮生成时被遗忘或错误翻译。
- **AI 判断缺乏置信度**。直接给出 1–10 分没有解释，没人知道分数是怎么来的、依据是什么。
- **判断结果不进入下游**。评审完的结论停留在聊天记录里，没有结构化地传给制作商或下一轮 AI 生成。

### 1.2 用户画像

**目标用户**：有广告从业经验的创意人员、品牌方内容负责人、AIGC 制作项目经理。

**场景**：收到 AI 或制作商交付的脚本/分镜后，需要综合 Brief、商业判断和 AI 辅助分析，生成明确的修改决策并交接给下游。

**关键认知**：这些用户不需要"AI 替代创意判断"。他们需要一个**不遗漏关键维度的结构化评审界面**，以及一个**把判断结果变为可执行上下文的导出机制**。

---

## 2. 产品收缩：从视频评审到脚本评审

### 2.1 最初的设想

AdFrame 最早定位"AIGC 视频成品评测台"——加载 AI 生成的广告视频，人在播放器里逐帧标注问题，最终产出评分和修改清单。

这个方向有明确的参考对象：Frame.io V4 的视频审阅面板、Dropbox Replay 的帧级反馈、DaVinci Resolve 的暗色专业工作台气质。

### 2.2 调研发现的问题

在 Day 1 前后完成的 10 项产品参考调研和 2 项生态调研（Skill 生态 + 脚本创意 Skill）中暴露出三个关键矛盾：

1. **视频成品的修改成本极高**。人物动机缺失、产品植入生硬等商业逻辑问题，到了视频成品阶段已无法低成本修正。正确的时间点是**在脚本阶段拦截这些问题**。

2. **AI 对视频的理解仍然不可靠**。多模态模型对视频中的人物动作、品牌细节和时空连续性的判断不够稳定。相比之下，结构化文本（脚本 + 分镜描述）更适合 AI 辅助分析。

3. **广告行业的工作流枢纽是脚本，而非视频成品**。Brief、创意方向、客户反馈、分镜和生成 Prompt 都在脚本阶段汇合。评审工具应该落在这个交汇点上。

### 2.3 转向决策

Day 1 Sol 审核通过后，项目从"视频评测" pivot 到"脚本评审"（见 `docs/PIVOT_SCRIPT_REVIEW.md`）。定位变为：

> 商业视频脚本 AI 协同评审台。将 Brief、人工创意判断和 AI Skill 分析统一到脚本版本中，定位商业视频脚本的问题，生成可执行的修改决策和下一轮创作上下文。

产品演进被拆为三个阶段：
- **AdFrame Script**（当前 V0）：脚本与创意评审
- **AdFrame Visual**（未来）：分镜、图片与 Prompt 评审
- **AdFrame Motion**（未来）：生成视频与成片评审

---

## 3. 案例选择：PortaSplit / The Thinker

### 3.1 为什么选这个案例

PortaSplit 来自 Codex 中持续迭代的真实 AIGC 广告创意项目（任务 `019f68b1-ed4e-71a0-bb2d-2ed537f33b14`）。项目面向欧洲租房用户，核心产品利益点是“三步自安装 + 强劲制冷”。

选择真实案例而非虚构案例的原因：

- **评审逻辑经得起推敲**。Issue / Impact / Evidence / Suggestion 来自真实制作迭代中实际遇到的问题，不是臆想的"最佳实践"。
- **从迭代历史提炼判断规则**。故事板 V2 的九宫格连续安装被客户反馈"看起来复杂"→ 拆成三个独立广告切镜。这个决策链条就是 AdFrame 想展现的工作流。
- **Demo 叙事完整**。石膏像角色（思考者被热到无法思考） + 反差喜剧 + 产品自然解决问题，构成一个 15 秒可读的广告叙事。

### 3.2 迭代历史（三版脚本）

| 版本 | 标题 | 关键变化 | 来源 |
|------|------|---------|------|
| Script V1 | 冰块自救初稿 | 雕像吃冰块解暑。建立首个完整创意快照。 | 初始创意 |
| Script V2 | 热感动作修改稿 | 客户反馈"冰块缺乏来源"，改为用人物自身热感动作（扇风、扯衣领）。 | `decision-v1`（client） |
| Script V3 | 制作交接候选稿 | 强化热感动机、产品安装拆成三镜头、锁定尾帧物理关系。 | `decision-v2`（ai-assisted） |

每版之间的 `sourceVersionId`、`decisionId` 和 `feedbackIds` 形成完整追溯链。这正是 AdFrame 想证明的核心能力：**版本不是一个文件，而是一条带有决策历史的演化路径**。

### 3.3 评审数据的来源边界

当前 Demo 中的评审逻辑与修改依据来源于：

- **PortaSplit 真实迭代记录**（见 `docs/PORTASPLIT_REVIEW_LOGIC.md`）——安装过程复杂、蓝色气流争议、尾帧主次关系
- **行业通用评审维度映射**——Brief Alignment、Character Motivation、Product Communication、Brand Fit、Visual Effect 五个类别对应真实广告评审中的常见问题类型

项目问题、客户反馈方向和创意取舍来自真实迭代；Mock AI 文本、时间戳、处置状态和界面记录是为演示闭环整理的结构化数据。项目不声称拥有真实用户行为、点击率、转化率或模型准确率。

---

## 4. 闭环：Brief → Script → Review → AI → Decision → Handoff

### 4.1 数据流

```
Brief Snapshot (传播目标 / 受众 / 平台 / 格式)
  │
  ├─→ Creative Direction (方向 / 洞见 / 机制 / 产品角色 / 弧线)
  │
  └─→ Script Version (5 段 × 画面 / 动作 / 字幕 / Product Role / Locked Elements)
        │
        ├─→ Human Review Card
        │     Issue → Business Impact → Evidence → Suggestion → Status (Open→Accepted→Resolved) → Decision Action (Keep/Modify/Remove)
        │
        ├─→ AI Skill Draft
        │     Skill Finding → Original Text → Human Revision → Disposition (Accepted/Revised/Rejected)
        │
        └─→ Decision
              Keep / Modify / Remove 清单 + Next Version Goal
                │
                └─→ Export / Codex Handoff
                      Markdown Review → JSON Handoff Payload → 复制 Codex Task
```

### 4.2 每一步的设计原则

**Brief 先行**。所有评审（人工和 AI）都以 Brief 为基准。Objective、Audience、Platform、Locked Elements 作为不可变约束贯穿整个评审过程。

**人机意见独立保存**。AI 分析不直接覆盖人工判断。`aiDraft.originalText` 和 `aiDraft.humanRevision` 并存，`disposition` 记录人对 AI 建议的处置（Accepted / Revised / Rejected）。这个设计来自 Argilla 和 Label Studio 的人机协同模式——差异本身就是未来的训练数据。

**决策是有后果的**。五个段落的评审结果被汇总为 Keep / Modify / Remove 三个行动清单 + Next Version Goal。决策不是"评分"，而是"下一步做什么"。

**导出是可执行的**。Markdown 用于文档交流、JSON Handoff 用于程序化交接（`task_type: "commercial_script_revision"` 直接对接到 Codex 创作任务）、剪贴板复制用于快速上下文传递。

---

## 5. 关键交互设计

### 5.1 版本切换 + 段落联动

选择 Script V1/V2/V3 时：
- 评审卡按 `versionId` 过滤，不显示其他版本的评审
- AI 草稿按 `versionId + segmentId` 查找，无匹配则显示 fallback
- 决策按 `versionId` 查找
- 若当前选中的段落在新版本中不存在，自动回落到首个段落

### 5.2 评审卡状态流转

```
Open → Accepted → Resolved → Open (循环)
Rejected → Open (重置)
```

- 状态流转通过单个按钮循环切换，不弹窗、不分步
- `decisionAction`（Keep/Modify/Remove）独立于流转状态，底部三个 toggle 按钮
- 所有状态变更自动触发 Decision 汇总更新和 localStorage 写入

### 5.3 AI 分析面板

- 顶部显示 Mock Skill 状态（Confidence + Disposition）
- Skill Finding 卡片：Skill 名 + 结构化发现
- AI Original（只读）和 Human Revision（可编辑）并排
- Accept / Revise / Reject 三个处置按钮

### 5.4 版本对比

- 点击 Compare 按钮后，Canvas 顶部展开 Source / Current 双栏对比
- 仅显示 `beatName` 和 `action` 字段（最关键的创意差异）
- Source 版本不存在时显示空状态

### 5.5 Demo 重置

- 顶栏"恢复演示数据"按钮 → 确认对话框 → 恢复至 Script V2 / PRODUCT SETUP / Human Review
- 重置清除所有 localStorage 数据（新版 + 旧版 key），写入 seed
- 确认框支持背景点击关闭和取消

---

## 6. 两个旧技术原型来源

### 6.1 原型 A：Bridge / WorkBuddy 协作闭环

**来源**：此前完成的 AI Bridge / WorkBuddy 协作原型。

**性质**：验证 Project、Task、Session、Artifact 和 Context 如何在 Codex 与本地执行环境之间传递。

**对 AdFrame 的影响**：

1. Review 不能停留在页面里，必须能被组装成下一轮任务上下文。

2. Project Context、执行 Task 与返回 Artifact 应该分开，避免把产品本身做成一个大而全的 Agent。

3. Codex Handoff 因此被设计为结构化出口，而不是假装当前 Demo 已经接入真实执行 Runtime。

### 6.2 原型 B：Visual Skill Console

**来源**：此前用于解决 Codex Skill 数量过多、选择和组合不便的 Visual Skill Console 原型。

**性质**：把磁盘中的 Skill 转成人能理解的能力卡片、固定 Recipe 与调用记录。

**对 AdFrame 的影响**：

1. AI 分析按 Brief Alignment、Product Communication、Platform Fit 等 Skill 呈现，而不是暴露模型节点和变量。

2. 当前 V0 只展示固定评审 Recipe，不做自由工作流编辑器，避免让创意人员兼职搭低代码节点。

3. AI Original 与 Human Revision 并存，使 Skill 是判断辅助而非终审。

PortaSplit 项目则提供内容与广告判断来源：冰块道具为何被否、热感动作如何克制、安装步骤为何不能拍成教程、产品揭示和物理关系如何锁定。技术原型负责“如何组织与交接”，真实项目负责“应该判断什么”。

---

## 7. AdFrame 作为 Local Creative OS Review Module

### 7.1 核心命题

AdFrame 不是要做另一个 SaaS 产品，而是在探索一个更基础的假设：

> **创意的"操作系统"需要评审模块。** 就像开发者用 PR Review 工具审代码，创意人员需要一个结构化的"把 Brief 变成 Checkpoint"的工具来审商业视频脚本。

这个模块应该满足五个约束：

1. **本地运行**。不需要云服务、账号或后端。localStorage 持久化，关闭浏览器后数据仍在。
2. **不替代创意判断**。评审工具放大人的判断，不替代它。AI 只提供草稿（Draft），人做决定（Decision）。
3. **输出可执行上下文**。评审结论不是文档，而是下一轮创作的输入参数（Keep/Modify/Remove + Next Version Goal）。
4. **与生成工具解耦**。不绑定某个 AI 模型或视频生成平台。Handoff 是一个标准化的 JSON payload，可以对接 Codex、ComfyUI、Runway 或人工制作商。
5. **版本链可追溯**。每版脚本知道它从哪来（sourceVersionId）、为什么改（changeReason）、依据什么决定（decisionId）、解决了哪些反馈（feedbackIds）。

### 7.2 未来架构构想

```
AdFrame (Local Creative OS)
│
├── AdFrame Script (当前 V0)
│   评审层：Brief → Script → Review → AI Draft → Decision
│   导出层：Markdown / JSON / Codex Handoff
│
├── AdFrame Visual (规划中)
│   评审层：分镜 Image → Prompt → Visual Review → Shot List
│   导出层：Prompt Pack / Vendor Brief / ComfyUI Workflow
│
├── AdFrame Motion (规划中)
│   评审层：视频成品 → Frame Review → Motion Consistency
│   导出层：EDL / 剪辑交接清单 / 重生成 Brief
│
└── 共享基础设施
    - 统一评审卡协议（Issue/Impact/Evidence/Suggestion/DecisionAction）
    - Schema 版本化 localStorage 存储
    - Creative Skill 插件接口（每个 Skill 输入 Brief + 素材，输出标准化 Review Card）
```

### 7.3 技术不做什么

这一架构有意回避了以下方向，不是因为它们不对，而是因为它们会让 Demo 变成 SaaS 产品：

- **不接真实 AI API**。当前 V0 使用 Mock Skill 数据。接 API 会引入 token 成本、网络依赖和模型选择复杂度。Demo 的目标是证明交互闭环，不是跑分。
- **不做多人协作**。PR Review 工具的多用户模式对广告小团队过重。当前 Demo 选择"一个人完整的评审到导出流程"。
- **不做自由 Recipe Builder**。固定"品牌产品短片" Recipe，不引入 Workflow 编辑器。目标用户需要的是结构化的检查清单，不是灵活配置的白板。
- **不绑平台**。不绑定某个视频生成平台或模型供应商。Handoff payload 是标准 JSON。

---

## 8. 文档与工程状态

| 文档 | 用途 | 状态 |
|------|------|------|
| `README.md` | 项目说明（招聘作品集可读） | Day 3 完成 |
| `CASE_STUDY_DAY3.md` | 本文档，完整案例研究 | Day 3 完成 |
| `docs/PRODUCT.md` | 产品定位与核心流程 | Day 1 冻结 |
| `docs/PIVOT_SCRIPT_REVIEW.md` | 从视频评审到脚本评审的转向说明 | Day 2 完成 |
| `docs/PORTASPLIT_REVIEW_LOGIC.md` | PortaSplit 真实迭代记录与评审逻辑 | Day 2 完成 |
| `docs/IMPLEMENTATION_SPEC.md` | Day 1 实现规格 | Day 1 冻结 |
| `docs/DAY1_SOL_REVIEW.md` | Day 1 Sol 审核报告 | Day 1 冻结 |
| `docs/DAY2_BUDDY_REVIEW.md` | Day 2 Buddy 审查报告 | Day 2 完成 |
| `docs/DAY2_5_BUDDY_REVIEW.md` | Day 2.5 Buddy 审查报告 | Day 2.5 完成 |
| `docs/PROGRESS.md` | 项目进展与里程碑 | 持续更新 |
| `AGENTS.md` | 项目规则（依赖、范围、UI、Git 安全） | Day 1 冻结 |

工程验证（截至 Day 3）：
- `npm run lint`：0 errors, 0 warnings（12 文件，103 规则）
- `npm run build`：成功，产物 224.50 KB JS + 16.77 KB CSS（gzip: 71.75 + 3.74 KB）
- 1366×768 和 1024×768 视觉验证通过，无横向溢出
