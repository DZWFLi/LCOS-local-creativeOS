# AdFrame Script：脚本对象与文件边界

日期：2026-07-16  
案例依据：PortaSplit「思考者」15 秒 AIGC 商业短片及其实际修改、分镜、提示词和制作商交接过程。

## 一句话结论

AdFrame V0 中的“脚本”不是一个文件，而是一组围绕同一创意版本产生、但用途不同的文件。产品必须区分：

1. **评审的源对象**：Brief、Creative Direction、Master Script；
2. **脚本内部结构**：Script Segment；
3. **脚本通过后的派生产物**：Shot List、Storyboard、Prompt Pack、Vendor Brief；
4. **不能写回脚本正文的判断记录**：Feedback、Review Card、Decision、Change Log。

V0 的主评审对象只锁定为 **Master Script Version + Script Segments**。其他文件作为上下文、证据或派生产物挂接，不与脚本混成一篇长文。

## 真实项目中已经出现的文件

### 1. `creative-brief.md`｜创意简报

回答“这支片必须解决什么”。

PortaSplit 对应内容：

- 项目目标：15 秒竖屏 AIGC 商业短片；
- 受众与场景：欧洲租房用户、现代欧洲客厅；
- 产品利益点：`3-step self-install`、`Simple setup. Powerful cooling.`；
- 强制信息：三步安装、室内外机关系；
- 禁用项：传统分体空调对比、复杂工具、夸张蓝色冷气；
- 交付要求：客户脚本、分镜、生成与制作商执行材料。

要求：Brief 是评审基准，不随脚本润色被悄悄改写。任何修改都应单独版本化或记录来源。

### 2. `creative-direction.md`｜创意方向 / Treatment

回答“用什么创意机制表达产品”。

PortaSplit 对应逻辑：

> 热到无法思考 → 自己扇风、扯长袍仍无效 → 发现 PortaSplit → 三步安装 → 恢复沉思。

建议字段：

- directionTitle；
- coreInsight；
- creativeMechanism；
- productRole；
- storyArc；
- visualTone；
- adoptedReason / rejectedReason。

要求：它不是逐秒脚本，也不是提示词。评审脚本时需要用它判断每段是否仍服务同一个创意机制。

### 3. `script-vN.md`｜客户可读主脚本（Master Script）

这是 AdFrame V0 的核心对象。回答“观众在 15 秒内看到和听到什么”。

PortaSplit 已经出现的典型版本：

- V1：冰块自救；
- V2：客户反馈后改为扇风、扯长袍；
- V3：优化人物比例、动作方式、安装三切镜及尾帧状态。

一份主脚本至少包含：

- 创意概述；
- 总时长与画幅；
- 分段时间；
- 每段的画面；
- 人物动作；
- 台词 / VO / Super；
- 产品信息；
- 段落目的。

要求：客户能看懂，不能塞满模型负面词、身体比例锁定、生成器语法等技术内容。

### 4. `script-segments.json`｜结构化脚本段落

这是 Master Script 在产品中的结构化表示，不是额外让用户维护的一份独立稿件。

建议字段：

```ts
type ScriptSegment = {
  id: string
  versionId: string
  order: number
  timeStart: number
  timeEnd: number
  beatName: string
  purpose: string
  visual: string
  action: string
  dialogue?: string
  voiceover?: string
  super?: string
  productRole?: string
  lockedElements: string[]
  status: 'draft' | 'reviewing' | 'accepted' | 'revised'
}
```

要求：Review Card 必须绑定 `versionId + segmentId`，不能只挂在整个项目上。

### 5. `shot-list-vN.md`｜镜头表 / 制作分镜脚本

回答“脚本如何变成可拍、可生成的镜头”。

PortaSplit 对应内容：

- 前 0–6 秒持续拉镜：极近特写到完整空间；
- 6 秒后切固定机位；
- 三步安装分别采用宽景、中景、产品特写；
- 尾帧回到完整 Hero Shot。

建议字段：

- shotId；
- relatedSegmentId；
- duration；
- shotPurpose；
- framing；
- cameraMovement；
- subjectAction；
- productState；
- continuityIn / continuityOut；
- referenceIds。

要求：Shot List 是脚本评审通过后的派生产物。不能用镜头术语修补尚未成立的人物动机与产品逻辑。

### 6. `storyboard-vN.pdf` / `storyboard-frames/`｜分镜图与画面证据

回答“镜头视觉上大致长什么样”。

PortaSplit 项目真实产物包括：

- 两张九宫格；
- 九宫格拆出的单帧；
- 尾帧 Hero Shot；
- 安装动作抽帧参考板；
- 定调图与官方产品结构图。

要求：分镜图是脚本/Shot 的视觉附件，不是脚本正文。半成品必须标注“参考动作、景别或构图，以文字要求和官方产品结构为准”。

### 7. `prompt-pack-vN.md`｜生成提示词包

回答“如何把已确认的脚本与镜头交给具体生成工具”。

PortaSplit 提示词实际包含：

- 空间、人物、产品和光线参考优先级；
- 人物比例与身份一致性；
- 扇风、拉衣领等动作路径；
- 室内机、外机、冷媒管的物理关系；
- 每格 / 每镜的生成描述；
- 负面约束。

要求：Prompt Pack 必须注明目标平台或模型、输入参考、适用脚本版本和适用 Shot。模型专属规则不能反向污染客户脚本。

### 8. `continuity-bible.md`｜连续性与 Locked Elements

回答“跨镜头和跨版本绝对不能漂什么”。

PortaSplit 对应内容：

- 同一尊原创男性石膏雕塑；
- 同一古希腊长袍与成年男性比例；
- 雕塑不直视产品；
- 同一客厅、石座、玻璃门、光线；
- 室内机始终在室内，外机原本藏于室内机后方；
- 冷媒管连接关系真实；
- 尾帧门关闭、挡风板开启、外机在阳台。

要求：这是跨 Segment / Shot 的约束集合，适合被 Prompt Skill 读取，不应在每个段落里重复粘贴成长作文。

### 9. `review-log.json`｜Feedback 与 Review Card

回答“哪里有问题、为什么影响商业表达”。

PortaSplit 中已经出现的真实反馈：

- 冰块出现不自然，改为人物自身的热感动作；
- 扇风像查看手掌，拉衣领像整理衣服；
- 人物比例在不同格漂移；
- 产品过近、过大、抢主角；
- 安装过程拆太细，反而显得复杂；
- 外机凭空出现，物理关系不成立；
- 尾帧先作为独立 Hero Shot 锁定。

Review Card 字段：

```ts
type ReviewCard = {
  id: string
  versionId: string
  segmentId?: string
  shotId?: string
  category: string
  issue: string
  businessImpact: string
  evidenceText: string
  suggestion: string
  authorType: 'human' | 'ai'
  status: 'open' | 'accepted' | 'resolved' | 'rejected'
  decisionAction: 'keep' | 'modify' | 'remove'
}
```

要求：AI 原始意见、人工修订和最终处置必须分别保留；Review 不直接覆盖脚本正文。

### 10. `decision-vN.md`｜版本决策与下一轮任务

回答“这一轮究竟改什么、不改什么”。

建议结构：

- acceptedIssues；
- rejectedIssues；
- keep；
- modify；
- remove；
- nextVersionGoal；
- unresolvedQuestions；
- decisionSource。

PortaSplit 示例：

```text
Keep：石膏像角色、0–6 秒持续拉镜、产品第 6 秒完整露出。
Modify：热感动作、人物比例、安装镜头数量、外机出现逻辑。
Remove：冰块、复杂连续安装教学、明显蓝色气流。
Next Goal：形成可交给制作商的三步安装脚本与稳定尾帧。
```

### 11. `vendor-production-brief.md`｜制作商交接文件

回答“外部制作方按什么执行、以什么为准”。

实际项目中已经形成飞书制作需求文档，包含：

- 客户可读脚本；
- 9 条脚本格；
- 对应分镜单帧；
- 安装动作抽帧；
- 产品结构参考；
- 半成品使用说明；
- 尾帧与制冷效果要求。

要求：这是多个已确认对象的组装输出，不是新的真相源。内容冲突时按 Brief、Approved Script、Decision、官方产品结构的顺序处理。

## 什么才算“脚本版本”

一次版本保存必须是完整快照，而不是只把最新 textarea 覆盖旧文本。

```ts
type ScriptVersion = {
  id: string
  projectId: string
  versionLabel: string
  title: string
  summary: string
  sourceVersionId?: string
  changeReason: string
  feedbackIds: string[]
  decisionId?: string
  segments: ScriptSegment[]
  status: 'draft' | 'current' | 'client_review' | 'approved' | 'rejected' | 'archived'
  createdAt: string
}
```

关键规则：

- V2 必须知道它从 V1 来，为什么改；
- Review 必须仍能回到被评的旧版本；
- “当前采用”与“客户已确认”不是同一个状态；
- Shot List、Prompt Pack 必须标记来源 Script Version；
- 脚本修改后，系统应提示哪些派生产物可能失效，而不是默默继续沿用。

## V0 开发边界

### 本轮必须进入产品

1. Brief Snapshot；
2. Creative Direction 摘要；
3. Script V1 / V2 / V3；
4. 结构化 Script Segments；
5. 段落级 Human Review；
6. 段落级 Mock AI Skill Draft；
7. Accept / Revise / Reject；
8. Keep / Modify / Remove；
9. Decision 与 Next Version Goal；
10. Markdown / JSON / Codex Handoff 导出。

### 只展示关联，不做编辑器

- Shot List；
- Storyboard 缩略图；
- Prompt Pack；
- Continuity Bible；
- Vendor Brief。

可以显示“由 Script V2 派生”“可能已过期”，但 V0 不做完整分镜和 Prompt 编辑。

### 暂时不做

- 视频成片评测；
- 真正 AI API；
- 自动重写整篇脚本；
- 字符级 Diff；
- 多人协作与权限；
- 通用富文本编辑器；
- 自由 Workflow Builder。

## 页面信息结构调整建议

### 左栏：Versions & Segments

- Script V1 / V2 / V3；
- Current / Client Review / Approved；
- 当前版本下的段落列表；
- 每段 Review 数量和状态。

### 中栏：Script Canvas

顶部显示 Brief Snapshot 与 Creative Direction 摘要。正文以段落卡呈现：

- 时间；
- beatName；
- purpose；
- visual；
- action；
- dialogue / VO / super；
- productRole；
- lockedElements。

### 右栏：Review → AI Draft → Decision

- Review 只针对当前版本、当前段落；
- AI Skill 输出 Review Card，不直接重写；
- Decision 汇总当前版本已接受的问题；
- 创建下一版本时才应用修改任务。

### 底部：Derived Outputs & Export

- Script Review Markdown；
- Decision JSON；
- Codex Handoff；
- Shot List / Prompt Pack / Vendor Brief 的来源版本与新鲜度状态。

## V0 最关键的演示链路

```text
打开 PortaSplit Script V1
→ 读取 Brief 与创意方向
→ 选中“热感建立”段落
→ 人工指出冰块道具缺乏来源
→ AI Skill 补充人物动机与画面行为判断
→ Accept 并将 Decision 设为 Modify
→ 保留角色、拉镜和产品揭示
→ 生成 V2 修改任务：改为扇风与拉衣领
→ 对比 V1 / V2
→ 导出 Codex Handoff
```

这条路径能同时证明：广告判断、脚本版本、AI 协同、决策留痕和后续生产交接。它比“给脚本打 82 分”更像真实商业创意工作。
