# AdFrame Script：视频脚本、创意逻辑与分镜 Skill 调研

日期：2026-07-16  
范围：RedSkill 本地索引、GitHub 原始仓库与公开 `SKILL.md`。  
原则：本轮只检索和筛选，不安装第三方 Skill，不执行未知脚本。

## 结论

目前没有一套现成 Skill 能直接承担 AdFrame Script 的“商业脚本评审内核”。现成能力大多偏向脚本生成、分镜生成或端到端视频制作，缺少以下关键环节：

- 以 Brief 为评审基准；
- 区分问题、商业影响、文本证据和修改建议；
- 保留人工判断与 AI 原始意见；
- 对人物动机、产品植入和平台语感进行商业判断；
- 输出可回写脚本版本的修改决策。

因此最合适的路线不是安装一个“大导演 Agent”，而是：

1. 拆解 3 个高相关 RedSkill 的规则；
2. 借用 GitHub 项目的方法与流程门槛；
3. 为 AdFrame 自建 5 个小型、同一输出协议的 Review Skill。

## RedSkill 候选

### P0：值得先审文件，不直接安装

#### `20260716 / tvc-director`

- 相关性：最高。
- 覆盖：产品简报、创意、分镜、三锚点、定格、动态化、剪辑、客户提案。
- 可借：Brief 到创意再到分镜的阶段划分；TVC 的锚点与提案结构。
- 风险：描述像端到端生产总控，范围可能远超 V0；需要检查是否把审查与生成混在一起。

#### `404design-skill-0002 / 创意 TVC 广告导演提示词`

- 相关性：很高。
- 覆盖：商业视频提示词、TVC 脚本、产品广告创意、中英双语分镜、诊断与优化。
- 可借：品类适配、去模板化诊断、脚本到提示词的交接字段。
- 风险：明显偏 Seedance 2.0 与提示词生产；不能让模型供应商规则反过来定义脚本评审标准。

#### `zdd-0001 / ScriptBreakdown`

- 相关性：高。
- 覆盖：剧情点、人物/道具/场景、节奏意图、节拍、预算气口、时长。
- 可借：脚本段落拆解、段落节拍、Shot 准备、结构化 `script-breakdown.md`。
- 风险：更接近制片拆解，不包含品牌目标、产品利益点与客户反馈。

### P1：只借局部规则

#### `story-to-seedance-director / story director`

- 可借：复杂段落是否需要故事板；角色、场景、声音、风格和前后段连续性约束；不得擅自改写未批准故事。
- 适合：未来 `Prompt Readiness` 和 `Shot Continuity`。
- 不适合：当前 V0 直接安装，体量过大且生成链路过深。

#### `da-tong-ai-ban-script-converter / script-Skill`

- 可借：镜头编号、景别、时长、画面、对白、音效、运镜的标准 Shot 字段。
- 适合：脚本通过评审后的 Shot List 导出。
- 不适合：判断商业创意是否成立。

#### `idea2shot-terrence.w / idea2shot`

- 可借：把模糊洞察拆成三个差异化、可拍摄方向。
- 适合：Creative Direction 阶段或被否方向重开。
- 不适合：作为脚本评审器。

#### `afa-creative`

- 可借：广告角度、Hook 变体、A/B 测试和创意疲劳。
- 适合：社媒短视频 Recipe。
- 风险：DTC 导向明显，不应直接套到品牌 TVC 与 KOL/KOC。

### P2：本轮不采用

- `generator1.0 / scriptgenerator`：偏通用短视频生成，缺少评审与决策留痕。
- `chik-bili-storyboard / bili-storyboard`：适合教程和 B 站录屏脚本，商业广告判断不足。
- `motion-director`：偏图片、镜头和动效生产，离脚本评审太远。
- `video-workshop` 类九 Agent 工厂：架构与当前一周 Demo 不匹配。

## GitHub 方法参考

### HeyGen Hyperframes：先锁策略，再谈视觉

可直接吸收的机制：

- 每一步形成 Artifact，并作为下一步的门槛；
- 在 Storyboard 前锁定视频类型、时长、格式、核心信息、叙事弧与受众；
- 分镜按“信息 → 叙事弧 → 服务叙事的 beats → 每个 beat 的手段 → 品牌修饰”生成；
- `STORYBOARD.md` 与 `SCRIPT.md` 必须经确认后才能进入制作。

对 AdFrame 的启发：AI Analysis 运行前必须读取 Brief Snapshot；脚本未完成 Brief Alignment 时，不给出镜头美化建议。

来源：https://github.com/heygen-com/hyperframes/blob/main/skills/website-to-hyperframes/SKILL.md

### Video Script Developer：Hook—Story—Lesson—Landing

可借：短内容的结构化 beat、通过成功样例提取节奏与表达模式、脚本开发前补齐必要问题。

对 AdFrame 的启发：社媒短视频 Recipe 可检查 Hook、故事推进、信息收益和落点，而不是只检查“前三秒够不够炸”。

来源：https://gist.github.com/alexknowshtml/6a1e4d336a6d51c6231bd6bd9a3f0d17

### ViMax：只借角色分工，不借整套系统

可借：Director、Screenwriter、Producer、Generator 之间的职责边界；脚本、故事板、角色与参考资产分别管理；连续性验证独立存在。

不采用：端到端自主生成、多 Agent 调度与完整视频生产运行时。它解决的是自动生产，AdFrame V0 解决的是人机协同评审。

来源：https://github.com/HKUDS/ViMax

### browser-use/video-use：决策门槛优先于执行

可借：先理解与确认，再执行，再迭代并保留状态；只在需要做判断的位置深入查看素材。

对 AdFrame 的启发：AI Skill 只提出 Draft，Accept / Revise / Reject 后才进入 Decision 与 Codex Handoff。

来源：https://github.com/browser-use/video-use/blob/main/SKILL.md

## 建议自建的 AdFrame Review Skills

### 1. `brief-alignment-review`

检查目标、受众、平台、时长、强制信息、禁用项与 Locked Elements 是否在脚本中有明确落点。

### 2. `commercial-logic-review`

检查“用户情境 → 需求触发 → 产品出现 → 利益证明 → 记忆落点”的因果链。重点识别漂亮但不卖货、产品硬塞、卖点无证据。

### 3. `character-motivation-dialogue-review`

检查角色为什么行动、台词是否像真人、角色关系是否支撑信息、KOL/KOC 植入是否可信。

### 4. `shot-structure-review`

检查每段的镜头目的、景别/动作/信息是否过载、节拍与时长、转场因果，以及是否已具备拆 Shot 条件。

### 5. `prompt-readiness-handoff`

在脚本决策完成后，提取 Keep / Modify / Remove、角色与场景连续性、动作拆分、镜头约束和预期输出，生成 Codex 或生成平台任务包。

## 统一输出协议

所有 Review Skill 都应输出同一种 Review Card，避免各 Skill 各说各话：

```json
{
  "skillId": "commercial-logic-review",
  "segmentId": "segment-03",
  "category": "product_communication",
  "issue": "人物从炎热状态直接进入安装行为，需求触发不足",
  "businessImpact": "产品出现像强行植入，安装简单的利益点缺少因果依据",
  "evidenceText": "06–09s：雕像突然起身并开始安装 PortaSplit",
  "suggestion": "在起身前加入克制的热感动作，并让产品出现成为解决动作",
  "keep": ["石膏像角色设定", "持续拉镜"],
  "decisionAction": "modify",
  "confidence": "medium"
}
```

置信度只作为辅助，不做 0–100 假精确评分。

## 下一步

1. 仅下载并人工审阅 `tvc-director`、`创意 TVC 广告导演提示词`、`ScriptBreakdown` 的 `SKILL.md` 与引用文件；不运行脚本。
2. 将其中有效规则映射到上述 5 个 AdFrame Skill，不照搬端到端流程。
3. V0 前端先展示 3 个可选 Skill：Brief Alignment、Commercial Logic、Character Motivation。
4. Shot Structure 与 Prompt Readiness 作为通过脚本评审后的下一步，不抢占当前 Review 主界面。
