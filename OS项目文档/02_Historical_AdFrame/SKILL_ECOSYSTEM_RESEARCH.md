# AdFrame Skill / 评审生态调研

> 调研日期：2026-07-16。目标不是寻找 UI 模板，而是拆解可进入 AdFrame 的“商业 AIGC 素材创意评审”机制。技术项目仅引用官方 GitHub 仓库或官方文档；Reddit 只作为未经验证的行业问题信号。

## 结论先行

AdFrame 最值得组合的不是一个现成项目，而是四类机制：

1. **时间证据层**：评论必须锚定 `assetVersion + shot + startTime + endTime`，来自 OpenVidReview / Label Studio。
2. **领域判断层**：先给 Brief 与规则，再输出结构化 Issue，不从“万能评分”开始，来自 OpenAI Evals / DeepEval。
3. **人机校准层**：AI 生成分析草稿，人确认、改写或拒绝；这些差异以后成为评测集，来自 Argilla / Label Studio。
4. **决策留痕层**：问题状态与最终动作分开：`Open / Accepted / Resolved` 管问题，`Keep / Modify / Remove` 管创意决定；来自 CVAT 的 QA 流程与 Promptfoo 的回归用例思想。

因此 Day2 应继续坚持 Review Card，而非 0–100 分。最小数据结构建议在现有字段外补充：`assetVersionId`、`shotId`、`evidence.start/end`、`authorType (human|ai)`、`briefSnapshotId`、`decisionAction`。分数与 confidence 即使存在，也只能是辅助元数据。

## 8 个高相关参考

### 1. OpenVidReview — 时间码反馈与剪辑交接

- 官方仓库：https://github.com/davidguva/OpenVidReview
- 可借鉴机制：视频时间点评论、颜色标签、EDL 导出。它证明 Review Card 的 Evidence 不应只是字符串，而应是可跳转、可导出的时间证据。
- 对 AdFrame：**Review Card / Evidence**。建议 Evidence 同时存结构化时间与显示文本，点击卡片直接 seek；未来导出可映射到剪辑交接清单。
- 不可照搬：它是通用视频批注工具，没有 Brief、商业影响、创意建议与人机协同语义；也不能把颜色标签等同于创意分类。
- License / 活跃度：仓库页面未见明确许可证，默认视为“不可复制代码，仅参考机制”；约 131 stars、11 forks，README 明示 WIP，活跃度与生产成熟度偏低。

### 2. Label Studio — AI 预标注 + 人工修订

- 官方仓库：https://github.com/HumanSignal/label-studio
- 可借鉴机制：可配置标注模板、视频 TimelineLabels、模型 prediction 与人工 annotation 并存、对比不同 annotations。2026 年仍有新 release，视频片段拖拽与 annotation comparison 均在持续维护。
- 对 AdFrame：**AI Analysis → Review Card**。AI 先生成候选 Issue；人工保留原建议、修订后的 Issue、接受/拒绝动作，形成可追溯差异。
- 不可照搬：Label Studio 面向训练数据标注，任务颗粒度和配置语言太重；AdFrame 不能退化成“给视频打标签”，必须保留 `impact` 和 `suggestion` 的商业判断。
- License / 活跃度：Apache-2.0；约 3.5k forks，官方 release 在 2026 年仍更新，活跃。

### 3. CVAT — Reviewer / QA / Issue 的责任分层

- 官方仓库：https://github.com/cvat-ai/cvat
- 可借鉴机制：任务分配、review workflow、quality assurance、issue comments，以及 AI-assisted labeling 与人工 QA 的边界。
- 对 AdFrame：**Review Card 状态 / Decision**。把“发现问题”和“批准最终创意动作”拆成两层；状态流转要有操作者与时间，而不是只改一个 badge。
- 不可照搬：其标注者—审核者层级适合大规模数据生产，广告小团队不需要复杂组织权限、工单和质量统计。
- License / 活跃度：社区核心 MIT（部分依赖/资产可能另有许可）；约 3.7k forks、持续 PR 与 issue，官方称自 2018 年持续维护，活跃。

### 4. Argilla — 领域专家反馈成为可复用数据

- 官方仓库：https://github.com/argilla-io/argilla
- 可借鉴机制：AI 工程师与 domain expert 协作；人工策展与 AI feedback 合并，记录 response、suggestion、metadata 与多人反馈。
- 对 AdFrame：**Creative Review / AI Analysis**。广告人的修改不能覆盖 AI 原稿；应保存 `aiDraft`、`humanRevision`、`disposition`，以后可按 Brand Fit、Product Communication 等类别沉淀案例。
- 不可照搬：不要在 Day2 引入数据集管理、多人共识算法或训练闭环；当前只需把未来可学习的数据留对。
- License / 活跃度：Apache-2.0；官方仓库持续维护，属于成熟的人类反馈基础设施。采用前仍应检查具体目标版本与托管功能边界。

### 5. OpenAI Evals — 先定义领域 rubric，再让模型判断

- 官方仓库：https://github.com/openai/evals
- 官方方法：https://github.com/openai/evals/blob/main/docs/build-eval.md
- 可借鉴机制：评测需方向明确、专家可判断、具备高质量参考答案或完整 rubric；模型评分器本身还要用人工标签做 meta-eval。
- 对 AdFrame：**Context / AI Analysis**。把 Objective、Audience、Platform、Format 与品牌约束作为每次分析的 Brief Snapshot；每个 category 对应一份具体判断规则和正反例，而不是只给维度名。
- 不可照搬：Evals 的准确率、battle、数字 score 适合模型回归测试，不适合直接成为广告客户的评审语言；AdFrame 前台优先输出 Issue / Impact / Evidence / Suggestion。
- License / 活跃度：MIT；约 18.9k stars、3k forks，官方仓库当前可见 691 commits，活跃且方法成熟。

### 6. DeepEval / G-Eval — 判断步骤与理由可检查

- 官方仓库：https://github.com/confident-ai/deepeval
- 可借鉴机制：自定义 criteria、evaluation steps、rubric、threshold 与 explanation；支持多模态评测及 prompt alignment。
- 对 AdFrame：**AI Analysis**。每个 Creative Skill 应显式写 `context required → checks → evidence rule → output schema → abstain condition`。例如 Product Communication 先检查需求触发，再检查产品出现是否有因果依据，最后才生成 Issue。
- 不可照搬：通用 LLM-as-judge 指标容易制造伪精确；其 0–1 / 内部评分尺度曾引发官方 issue 讨论，更说明不应把分数暴露为产品核心。
- License / 活跃度：Apache-2.0；官方仓库 2026 年仍覆盖多模态、MCP 与自定义指标，活跃。

### 7. Promptfoo — 用例矩阵与回归，而不是单次“AI 看法”

- 官方仓库：https://github.com/promptfoo/promptfoo
- 可借鉴机制：prompt × provider × test case 的矩阵、`llm-rubric`、自定义断言和逐步扩充反馈用例池。
- 对 AdFrame：**AI Analysis 的内部验证 / Context**。未来接 GPT、Claude、Gemini Vision 时，用同一组已有人类结论的素材与 Brief 比较：是否找到同一证据、是否遗漏高风险问题、建议是否可执行。
- 不可照搬：矩阵 dashboard 和 pass rate 属于内部模型选择工具，不是创意人员的主工作台；Day2 不应接 API 或展示模型排行榜。
- License / 活跃度：MIT；官方仓库持续维护、支持多供应商。落地时需再核对当期版本中云端功能与 OSS 边界。

### 8. FiftyOne — 失败样本切片与版本比较

- 官方仓库：https://github.com/voxel51/fiftyone
- 可借鉴机制：同时浏览样本、标签和模型 predictions；按 failure mode / edge case 筛选；把模型评估连接回具体视觉样本，而不是只看汇总指标。
- 对 AdFrame：**Context / Decision**。未来可以按 `category + platform + audience + decisionAction + version` 找相似历史卡片；V2 是否解决 V1 的“动机不足”应成为版本比较，而非两个孤立资产。
- 不可照搬：embedding、模型 zoo、数据集质量 dashboard 对当前 Demo 过重；不能让数据科学术语压过广告创意语言。
- License / 活跃度：Apache-2.0；约 10.7k stars、766 forks，官方文档与示例持续维护，活跃。

## 社区信号：只当问题线索，不当证据

Reddit 公开帖子中反复出现三个信号：AI 把瓶颈从“制作”迁移到了“筛选与 QC”；品牌包装文字、颜色、logo 等细节需要 AI 专项复核；Brief 质量与反馈闭环比工具数量更重要。可参考：

- https://www.reddit.com/r/content_marketing/comments/1s6w3sy/we_brought_ai_tools_into_our_agency_workflow_6/
- https://www.reddit.com/r/SaaS/comments/1s4wh8r/we_replaced_our_ad_creative_agency_with_an_ai/

这些内容是用户自述，可能含推广、幸存者偏差甚至协同营销痕迹，不能引用其中的成本、效率数字作为产品论据。能安全吸收的只有方法假设：在 Context 增加 `AI usage policy / brand locked elements`；在 AI Reliability Skill 中检查包装文字、logo、产品色、边缘和动作连续性；最终仍由人做 Decision。

## RedSkill 商店检索结果

根据本机既有安装记录，RedSkill CLI 位于 `C:\Users\1\.redskill`，版本为 `0.1.0`。当前 PowerShell 包装器只暴露 `install/list`，但官方 Python CLI 支持 `search`；本轮已实际检索 `video / image / creative / prompt / evaluation / review`。

商店没有直接匹配“素材评测”或“evaluation”的成品 Skill，但发现五个值得拆解、暂不建议直接安装进 Demo 的相邻能力：

1. `afa-creative`（DTC 创意生产与测试引擎）：包含广告角度矩阵、Hook 变体、A/B 测试和创意疲劳。可借鉴“同一素材按商业假设组织测试”，但 DTC 投放逻辑不能直接替代品牌 TVC / KOL / KOC 的 Creative Review。
2. `skill-hahadu-02`（video-analyzer）：Whisper 转录、按台词分镜、关键帧提取与结构化视频分析。可作为未来 Evidence 预处理层，但不能替代广告人的 Issue / Impact 判断。
3. `video-workshop`：包含帧间连续性审查与质量审核角色。可研究它如何描述连续性规则，但其九 Agent 全流程远超 AdFrame 一周 Demo 范围。
4. `vibe-creating-prompt`：强调保留明确台词、旁白、音乐和硬约束。可借鉴 `mustKeep` 的 Prompt 交接方式；它也明确不适合功能演示与工业执行单，边界意识值得保留。
5. `yuyile-ai-video-prompt`：把脚本、节拍和图片参考绑定为秒级动作与硬约束。适合未来把 Decision 转成下一轮生成 Brief，但不属于当前评审层。

检索结论：RedSkill 生态更强于“生成、提示词与流水线”，真正以商业影响为核心的 Creative Review Skill 仍是空位。这恰好支持 AdFrame 的差异化，但不构成安装上述 Skill 的理由。任何第三方 Skill 在引入前仍需单独检查真实 `SKILL.md`、脚本权限、依赖和许可证。

## 小红书 / X 的访问限制

- RedSkill 是由小红书提供的 Skill 商店，不等于“小红书帖子搜索”。当前仍无 TikHub/XHS 或小红书检索工具，因此不能声称已在小红书站内检索帖子，也没有伪造笔记。
- 普通网页搜索对小红书内容覆盖不完整且经常缺失正文、作者与发布时间，不足以做可审计调研。后续若提供具体笔记 URL 或已登录检索入口，再做定向验证。
- X 的公开网页索引对相关讨论召回较差，本轮没有找到足够可验证、且比官方项目文档更有价值的公开内容，因此未将 X 帖子列为正式参考。

## 对 AdFrame Skill 的直接建议

不要先做一个“大而全 Creative Review Skill”。建议拆成六个领域 Skill，每个 Skill 使用相同契约：

```yaml
name: product-communication
requires:
  - objective
  - audience
  - platform
  - format
  - asset_version
checks:
  - need_trigger_is_established
  - product_appearance_has_causal_basis
  - product_benefit_is_legible
evidence_rule: every_issue_must_reference_shot_and_time_range
output:
  - category
  - issue
  - impact
  - evidence
  - suggestion
  - confidence
abstain_when:
  - brief_missing
  - evidence_not_visible_or_audible
human_action:
  - accept
  - revise
  - reject
```

六个 Skill 的顺序保持商业判断优先：Concept Fit → Brand Fit → Product Communication → Platform Fit → Visual Execution → AI Reliability。编排器只负责加载 Brief、逐项运行、合并重复 Issue 和生成 Decision 草稿；它不能自行把多个维度压成总分。

Day2 的成功标准应是：用户能在 5 秒内看出这不是视频播放器；每张卡都回答“哪里有问题、为何影响商业目标、证据在哪里、怎么改”；刷新后状态保留。AI API、评分、跨模型比较都留到后续。
