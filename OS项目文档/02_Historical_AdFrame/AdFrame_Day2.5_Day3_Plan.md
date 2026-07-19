# AdFrame Script Review
## Day 2.5 可复用加固与 Day 3 推进计划

> 项目定位：面向商业视频脚本的 AI 协同评审工作台。  
> 当前目标：在不破坏现有 Demo 的前提下，将 Day 1、Day 2 的成果整理为未来 Local Creative OS 可直接复用的 Review Module，并完成 Day 3 的演示包装、案例补强与作品集叙事。

---

# 一、当前阶段判断

AdFrame Day 1、Day 2 已经完成了从静态工作台到可交互商业脚本评审闭环的转变。

当前主链路为：

```text
Brief / Creative Direction
→ Script Version
→ Script Segment
→ Human Review / Mock AI Draft
→ Accept / Revise / Reject
→ Decision
→ Source / Current Compare
→ Markdown / JSON / Codex Handoff
```

当前成果已经具备未来作为 Local Creative OS 中独立 Review Module 的基础，尤其是：

- Brief Snapshot
- Script Version
- Script Segment
- Locked Elements
- Human Review
- AI Draft
- Decision
- Source Compare
- Codex Handoff
- localStorage 持久化

下一步不应重做产品形态，也不应现在迁移到 TapNow / Kimi 风格，而应先进行一次克制的“可复用加固”。

核心原则：

> 改内脏，不改脸。

---

# 二、为什么需要 Day 2.5

当前 Demo 已经能正常演示，但仍可能存在以下潜在耦合：

- PortaSplit 案例数据与组件绑定
- 组件直接操作 localStorage
- Mock AI 结果直接写在界面逻辑中
- Codex Handoff 只是临时字符串拼接
- 本地数据缺少 schemaVersion
- Demo Reset 尚未形成稳定机制

如果现在不整理，未来嵌入 Local Creative OS 时会出现：

- 更换数据来源需要重写组件
- 接入真实 AI API 时需要改 UI
- 接入 Codex CLI / Bridge 时需要重写导出逻辑
- localStorage 字段变化导致页面白屏
- 第二案例加入后数据继续堆进组件

因此建议增加一个半天至一天的 Day 2.5，只处理代码边界与可复用性。

---

# 三、Git 与版本冻结

在任何重构前先完成：

```text
1. 确认工作区干净
2. 提交当前 Day 2 稳定版本
3. Push 到远程仓库
4. 创建 Tag：v0.2-script-review
5. 创建分支：refactor/reusable-review-core
```

建议提交信息：

```text
chore: freeze AdFrame v0.2 script review demo
```

重构完成后建议提交：

```text
refactor: extract reusable script review core
```

主分支必须始终保留一个可正常演示的版本。

---

# 四、Day 2.5 必须完成的六项加固

## 4.1 抽离 Demo 案例数据

PortaSplit、The Thinker、具体客户反馈、脚本文案不能继续存在于组件内部。

建议目录：

```text
src/
├── demo/
│   ├── projects/
│   │   ├── portasplit.ts
│   │   └── matchNight.ts
│   └── seed.ts
```

组件只接收：

```text
project
scriptVersion
segment
reviews
decision
```

目标：未来更换本地数据库、飞书、Notion 或 Creative OS 项目源时，Review UI 不需要重写。

---

## 4.2 整理最小领域模型

建议保留以下对象：

```ts
type Project = {
  id: string;
  name: string;
  brief: BriefSnapshot;
  versions: ScriptVersion[];
};

type BriefSnapshot = {
  objective: string;
  audience: string;
  platform: string;
  format: string;
  productMessages: string[];
  lockedElements: string[];
};

type ScriptVersion = {
  id: string;
  projectId: string;
  label: string;
  sourceVersionId?: string;
  status: "draft" | "current" | "approved" | "archived";
  segments: ScriptSegment[];
};

type ScriptSegment = {
  id: string;
  versionId: string;
  title: string;
  timeRange: string;
  purpose: string;
  productRole?: string;
  lockedElements: string[];
  content: SegmentContent;
};

type SegmentContent = {
  visual: string;
  action?: string;
  dialogue?: string;
  subtitle?: string;
};

type Review = {
  id: string;
  projectId: string;
  versionId: string;
  segmentId: string;
  authorType: "human" | "ai";
  category: string;
  issue: string;
  impact: string;
  evidence?: string;
  suggestion: string;
  status: "open" | "accepted" | "resolved";
  decisionAction?: "keep" | "modify" | "remove";
  disposition?: "accepted" | "revised" | "rejected";
};

type AIDraft = {
  id: string;
  projectId: string;
  versionId: string;
  segmentId: string;
  evaluatorId: string;
  originalText: string;
  humanRevision?: string;
  disposition?: "accepted" | "revised" | "rejected";
};

type Decision = {
  id: string;
  projectId: string;
  versionId: string;
  segmentId: string;
  keep: string[];
  modify: string[];
  remove: string[];
  unresolvedQuestions?: string[];
  nextGoal: string;
};
```

注意：

- 暂时只服务 Script Review。
- 不要泛化为图片、视频、PPT、3D 的万能对象。
- 不要建立复杂泛型或插件系统。

---

## 4.3 建立 Storage Repository

业务组件不得直接调用：

```ts
localStorage.setItem(...)
localStorage.getItem(...)
```

定义：

```ts
export interface ReviewRepository {
  loadProject(projectId: string): Promise<ProjectState | null>;
  saveProject(state: ProjectState): Promise<void>;
  resetProject(projectId: string): Promise<ProjectState>;
}
```

当前实现：

```text
LocalStorageReviewRepository
```

未来可替换：

```text
LocalFileReviewRepository
SQLiteReviewRepository
CreativeOSReviewRepository
```

目标：存储方式变化时，Review 页面不需要改动。

---

## 4.4 把 AI Mock 包成 Evaluator Provider

定义：

```ts
export interface ReviewEvaluator {
  id: string;
  name: string;
  evaluate(input: EvaluationInput): Promise<EvaluationResult>;
}
```

当前实现：

```text
MockReviewEvaluator
```

未来实现：

```text
OpenAIReviewEvaluator
CodexReviewEvaluator
LocalSkillEvaluator
BridgeReviewEvaluator
```

UI 只负责：

```text
选择 Evaluator
→ 运行
→ 展示 AI Draft
→ 人工 Accept / Revise / Reject
```

不要让组件直接读取固定 Mock 结果。

---

## 4.5 把 Codex Handoff 独立成 Execution Runtime

定义：

```ts
export interface ExecutionRuntime {
  createTask(input: HandoffInput): Promise<ExecutionTask>;
}
```

当前实现：

```text
CopyOnlyCodexRuntime
```

当前能力：

- 生成结构化任务
- 复制文本
- 下载 JSON

未来实现：

```text
CodexCLIRuntime
BridgeRuntime
WorkBuddyRuntime
```

目标：未来接入 Codex CLI 或 Bridge 时，不修改 Review Workspace。

---

## 4.6 增加 schemaVersion 与 Demo Reset

本地保存格式：

```ts
{
  schemaVersion: 1,
  projectId: "portasplit-thinker",
  updatedAt: "2026-07-16T19:25:00+08:00",
  data: {}
}
```

读取时：

```text
schemaVersion 相同
→ 正常读取

schemaVersion 不兼容
→ 安全迁移或恢复默认 Demo 数据
```

必须增加：

```text
恢复演示数据
```

Reset 后应恢复：

- Script V1 / V2 / V3
- Review Cards
- AI Draft
- Decision
- 当前选中版本与段落

---

# 五、建议目录结构

```text
src/
├── app/
│   └── App.tsx
│
├── features/
│   └── script-review/
│       ├── components/
│       ├── model/
│       │   ├── types.ts
│       │   └── reducer.ts
│       ├── services/
│       │   ├── reviewEngine.ts
│       │   ├── contextBuilder.ts
│       │   └── exporters.ts
│       └── ScriptReviewWorkspace.tsx
│
├── infrastructure/
│   ├── storage/
│   │   └── localStorageReviewRepository.ts
│   ├── evaluators/
│   │   └── mockReviewEvaluator.ts
│   └── runtimes/
│       └── copyOnlyCodexRuntime.ts
│
├── demo/
│   ├── projects/
│   │   ├── portasplit.ts
│   │   └── matchNight.ts
│   └── seed.ts
│
└── shared/
    ├── components/
    └── styles/
```

边界必须明确：

```text
Review 业务逻辑
≠ 浏览器存储
≠ AI Evaluator
≠ Codex Runtime
≠ Demo 案例数据
```

---

# 六、Day 2.5 明确不做

本阶段禁止：

- 改三栏布局
- 改为 TapNow / Kimi UI
- 增加项目首页
- 增加路由
- 增加登录
- 接入飞书或 Notion
- 接入真实 Codex CLI
- 接入真实 AI API
- 增加插件市场
- 增加自由 Workflow
- 把 Script Review 泛化成所有创意资产
- 引入 Redux、Zustand 或新 UI 框架

TapNow × Kimi 风格应在未来 Local Creative OS 的 App Shell 层完成，而不是现在重做 Review Workspace。

---

# 七、Day 2.5 验收清单

```text
□ V1 / V2 / V3 切换正常
□ Script Segment 切换正常
□ Review 按 versionId + segmentId 隔离
□ AI Draft Accept / Revise / Reject 正常
□ Decision 按版本和段落隔离
□ Source / Current Compare 正常
□ localStorage 刷新恢复正常
□ schemaVersion 已生效
□ Reset Demo 正常
□ Markdown 导出正常
□ JSON 导出正常
□ Codex Handoff 正常
□ npm run lint 通过
□ npm run build 通过
□ 浏览器 Console 无错误
□ 1366×768 布局无变化
□ 1024×768 布局无变化
```

---

# 八、给 Codex 的 Day 2.5 总任务

```markdown
请先阅读项目规则、Day 1 审核报告和 Day 2 审核报告。

任务：对 AdFrame Script Review 做一次“可复用加固”。

目标：
让当前 Script Review 未来可以作为 Local Creative OS 的独立 Review Module 使用。

本任务只允许调整代码结构和依赖边界。
用户可见界面、文案和现有交互不得发生明显变化。

执行前：
1. 确认工作区干净
2. 确认当前版本已提交并 Push
3. 创建 Git Tag：v0.2-script-review
4. 创建分支：refactor/reusable-review-core

必须完成：

1. Demo 数据抽离
- PortaSplit 数据不得保留在组件中
- 放入 src/demo/projects
- 组件只通过 props 或领域状态读取数据

2. 领域模型整理
至少包含：
- Project
- BriefSnapshot
- ScriptVersion
- ScriptSegment
- Review
- AIDraft
- Decision
- Artifact / Handoff

3. Storage Repository
- 定义 ReviewRepository 接口
- 当前实现为 LocalStorageReviewRepository
- 业务组件不得直接调用 localStorage

4. Evaluator Provider
- 定义 ReviewEvaluator 接口
- 当前实现为 MockReviewEvaluator
- 组件不得直接读取固定 AI 结果

5. Execution Runtime
- 定义 ExecutionRuntime 接口
- 当前实现为 CopyOnlyCodexRuntime
- 保持现有 Codex Handoff 导出和复制能力

6. 数据版本
- localStorage 数据增加 schemaVersion
- 遇到不兼容版本时安全重置
- 不允许页面白屏

7. Demo Reset
- 增加“恢复演示数据”能力
- 重置后恢复所有 Script、Review、AI Draft 和 Decision

限制：
- 不新增依赖
- 不增加后端
- 不增加路由
- 不增加真实 API
- 不连接飞书、Notion 或 Codex CLI
- 不修改视觉风格
- 不重构无关 CSS
- 不改变现有导出格式，除非为补充 schemaVersion 所必需
- 单次修改尽量控制在 15 个文件以内

验收：
1. V1 / V2 / V3 切换正常
2. Review 按 versionId + segmentId 隔离
3. AI Draft Accept / Revise / Reject 正常
4. localStorage 刷新恢复正常
5. Reset Demo 正常
6. Markdown / JSON / Codex Handoff 正常
7. npm run lint 通过
8. npm run build 通过
9. 浏览器 Console 无错误
10. 1366×768 和 1024×768 布局无变化

完成后报告：
- 领域模型
- Adapter 接口
- 修改文件
- 回归结果
- 未来接入 Creative OS 时可直接复用的目录
- 尚未处理的耦合点
```

---

# 九、Day 3 总目标

Day 3 不再扩展底层能力，重点是：

> 让 Demo 在三分钟内被看懂、被记住，并清晰体现广告行业经验、AI 协同评审逻辑与未来 Local Creative OS 的演进方向。

Day 3 只推进以下四个方向：

1. 演示数据重置与稳定性
2. PortaSplit 案例叙事精修
3. 零新交互的 Match Night 第二案例
4. 三分钟 Demo 与作品集表达

---

# 十、Day 3.1：演示数据与状态稳定

必须完成：

- 提供明确的“恢复演示数据”入口
- Reset 前增加二次确认
- Reset 后回到预设演示起点
- 页面刷新后演示状态可恢复
- 演示前可以一键清理用户残留操作
- 所有 Toast / Loading / Copy 成功反馈正常

建议预设演示起点：

```text
项目：PortaSplit / The Thinker
版本：Script V2
段落：PRODUCT SETUP
Tab：Human Review
状态：存在一个 Open Review 和一个待处理 AI Draft
```

---

# 十一、Day 3.2：精修 PortaSplit 案例内容

需要让招聘方看到这不是虚构数据，而是来源于真实广告脚本迭代经验。

建议重点段落：

```text
HOOK
HEAT SETUP
PRODUCT SETUP
COOLING PAYOFF
END CARD
```

核心问题应围绕：

- 人物热感动机是否建立
- 石膏像为什么起身安装
- 产品揭示是否过早
- 0–6 秒镜头节奏是否被保留
- 人物动作是否过多
- 产品卖点是否自然进入叙事
- Locked Elements 是否跨版本继承

建议预置一条完整演示链：

```text
AI Draft：
产品出现前缺少明确的需求触发。

Human Revision：
问题不只是需求触发不足，而是角色从“热”到“起身安装”的行为转折太突然。
需要先建立可读的热感动作，再进入安装行为。

Decision：
Keep：石膏像角色设定、0–6 秒持续拉镜
Modify：热感动作、起身动机、产品出现因果
Remove：同时扇风、扯衣领、后仰的多重动作
Next Goal：让观众在产品出现前明确理解角色为什么需要 PortaSplit
```

---

# 十二、Day 3.3：加入 Match Night 第二案例

第二案例只允许新增数据，不允许新增交互。

案例名称：

```text
AI ECOMASTER / Match Night
```

建议脚本结构：

```text
01 MATCH HOOK
02 MIKE REACTION
03 LUCAS EXPLAINS
04 APP PROOF
05 ENERGY SAVING PAYOFF
```

评审重点：

- Mike 的惊讶是否自然
- Lucas 的解释是否像角色说话
- 产品卖点是否硬塞
- APP 镜头是否承担证据作用
- 30% 节能信息是否进入剧情逻辑
- 内容是否仍像社媒情景剧，而不是品牌口播

建议预置问题：

```text
Issue：
Lucas 的台词过度承担产品说明，角色关系变成品牌讲解员与提问工具人。

Business Impact：
社媒情景剧的自然感下降，观众更容易识别为硬广告。

Suggestion：
让 Mike 先通过真实反应建立问题，Lucas 只解释一个核心利益点，APP 负责补充证据。
```

新增第二案例的验收条件：

- 复用所有现有组件
- 不增加字段
- 不增加新 Tab
- 不修改 Review 逻辑
- 不修改导出逻辑
- 只增加 seed data 和项目切换入口

如果需要结构性改动，则取消第二案例。

---

# 十三、Day 3.4：锁定三分钟演示路径

建议演示控制在 2 分 30 秒至 3 分钟。

## 0:00–0:25 项目背景

说明：

- AI 视频生成越来越快
- 真实广告项目的瓶颈逐渐变成脚本判断、反馈管理与上下文回流
- AdFrame 从脚本 Review 切入

## 0:25–0:55 查看项目上下文

展示：

- Brief Snapshot
- Creative Direction
- Script V2
- PRODUCT SETUP
- Purpose
- Product Role
- Locked Elements

## 0:55–1:30 AI Draft 与人工修订

操作：

- 打开 AI Analysis
- 查看 AI Draft
- 点击 Revise
- 补充商业影响与人物动机判断
- 保存人工修订

## 1:30–2:00 Decision

展示：

- Keep
- Modify
- Remove
- Next Goal
- Source / Current Compare

## 2:00–2:30 Codex Handoff

展示：

- 导出结构化 Context
- 复制 Codex Task
- 说明未来可由 Codex CLI / Bridge 直接执行

## 2:30–3:00 产品演进

说明：

- 当前是 Review Module
- 未来嵌入 Local Creative OS
- 飞书作为业务来源
- Notion 作为知识源
- Codex 作为执行内核
- 外部生成平台作为 Provider

---

# 十四、Day 3.5：作品集表达

作品集建议包含以下页面：

## 1. 问题背景

```text
生成能力增加后，真正的成本转向：
- 判断什么可用
- 为什么修改
- 哪些内容不能动
- 如何把反馈带入下一轮
```

## 2. 产品收缩过程

```text
通用 Creative OS
→ AIGC 视频评测
→ 商业视频脚本 Review
```

重点解释：

- 为什么缩小范围
- 为什么先做脚本
- 为什么 AI 只做 Draft
- 为什么 Decision 比总分更重要

## 3. 核心业务闭环

```text
Brief
→ Script
→ Human Review
→ AI Draft
→ Decision
→ Handoff
```

## 4. 关键交互

- Script Version
- Segment Review
- Locked Elements
- Accept / Revise / Reject
- Source Compare
- Codex Handoff

## 5. 技术原型来源

- Visual Skill Console
- Bridge / WorkBuddy
- AdFrame Script Review

## 6. 竞品变化与战略判断

TapNow Creative OS 的更新验证了：

- Skill
- Plugin
- Project Memory
- External Sources
- Creative Canvas

自己的产品选择：

- 不放弃通用 Creative OS
- 以 TapNow 作为参照
- 继续深挖本地部署、Codex Native、开放连接、个人掌控
- AdFrame 作为第一个 Review Module

## 7. 后续架构

```text
Local Creative OS
├── Projects
├── Sources
├── Skills
├── Workflow
├── Codex Runtime
├── Artifacts & Memory
└── Review
    └── AdFrame Script Review
```

---

# 十五、Day 3 不做清单

- 不接真实 AI API
- 不接飞书
- 不接 Notion
- 不接 Codex CLI
- 不接 Bridge
- 不做 TapNow 风格 UI 改版
- 不做画布
- 不做插件市场
- 不做多人协作
- 不做完整项目首页
- 不做视频评测
- 不做移动端
- 不新增复杂评分体系

---

# 十六、Day 3 验收清单

```text
□ Reset Demo 可用
□ 演示起点固定
□ PortaSplit 案例内容完整
□ AI Draft → Revise → Decision 闭环顺畅
□ Codex Handoff 内容可读
□ Match Night 仅通过数据层加入
□ 两个案例不会串数据
□ 三分钟演示路径已排练
□ README 已更新
□ Case Study 文案已完成
□ npm run lint 通过
□ npm run build 通过
□ 浏览器 Console 无错误
□ 1366×768 适合录屏
□ 1024×768 无横向溢出
□ main 分支可演示
□ Git Tag 与提交记录清晰
```

---

# 十七、给 Codex 的 Day 3 总控任务

```markdown
请先阅读项目规则、Day 1 / Day 2 审核报告，以及 Day 2.5 可复用加固结果。

任务：完成 AdFrame Script Review 的 Day 3 演示包装。

目标：
让招聘方在三分钟内理解这是一个面向商业视频脚本的 AI 协同评审工具，并看见广告经验、人工判断、AI Draft、Decision 和 Codex Handoff 的完整闭环。

本日只允许：
1. 演示数据重置与稳定
2. 精修 PortaSplit 演示数据
3. 在不新增交互的前提下增加 Match Night 案例
4. 整理三分钟演示路径
5. 更新 README 和作品集叙述

必须完成：

1. Reset Demo
- 增加明确入口
- 二次确认
- 恢复预设版本、段落、Review、AI Draft 和 Decision
- Reset 后回到固定演示起点

2. PortaSplit 案例精修
- 确保 Brief、Purpose、Product Role 和 Locked Elements 清晰
- 预置一条完整 AI Draft → Human Revision → Decision 链路
- 文案体现人物动机、产品揭示和广告逻辑

3. Match Night 第二案例
- 只新增数据和项目切换
- 不增加字段、组件或评审逻辑
- 复用现有导出和 Handoff
- 如果需要结构性改动，取消本项

4. 演示路径
- 在 docs 中新增 DEMO_SCRIPT_DAY3.md
- 控制在三分钟
- 明确每一步点击、展示内容和讲解文案

5. 作品集内容
- 更新 README
- 写明问题、收缩过程、核心闭环、关键交互、技术来源和未来架构
- 明确 AdFrame 是未来 Local Creative OS 的 Review Module

限制：
- 不接真实 API
- 不接飞书、Notion、Codex CLI 或 Bridge
- 不改整体视觉方向
- 不做 TapNow / Kimi 风格重构
- 不新增依赖
- 不增加视频评测
- 不增加移动端
- 不增加项目管理能力

验收：
1. Reset Demo 正常
2. 两个项目数据隔离
3. 现有 Review、AI Draft、Decision、Compare、Export、Handoff 均正常
4. npm run lint 通过
5. npm run build 通过
6. 浏览器 Console 无错误
7. 1366×768 可录屏
8. 1024×768 无溢出
9. 三分钟演示脚本完整
10. README 与作品集叙述完成

完成后报告：
- 新增案例数据
- 演示路径
- 修改文件
- 自动与人工 QA
- 仍存在的演示风险
- 建议录屏前操作清单
```

---

# 十八、最终策略

短期：

> 完成 AdFrame Script Review，服务岗位投递与作品集展示。

长期：

> 将 AdFrame 作为 Local Creative OS 的 Review Module，连接本地项目、飞书、Notion、Skill、Codex Runtime 和外部生成平台。

视觉策略：

> 未来 App Shell 可采用 TapNow 的空间感、Kimi 的轻操作和 Codex 的执行透明度；当前 Review Workspace 保持高可读、平直、专业的评审界面。

产品底层原则：

> 本地项目上下文是状态源，Codex 是执行内核，外部平台是 Context Source 或 Execution Provider。
