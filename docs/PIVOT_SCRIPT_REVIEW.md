# AdFrame Script Review — V0 转向说明

## 定位

商业视频脚本 AI 协同评审台。

将 Brief、人工创意判断和 AI Skill 分析统一到脚本版本中，定位商业视频脚本的问题，生成可执行的修改决策和下一轮创作上下文。

## 为什么从视频评测切到脚本评审

- 更贴近真实广告工作：Brief、人物动机、产品植入、台词、Shot、客户反馈和生成 Prompt 都在脚本阶段汇合。
- 修改成本更低：商业逻辑问题在进入图片/视频生成前解决。
- AI 判断更稳定：输入是结构化文本与明确 Brief，不需要先识别视频再反推创意意图。
- 更自然复用项目上下文、Skill Console、版本、Handoff 与 Codex Task 原型。

## V0 对象

- Brief Snapshot
- Script Version
- Script Segment / Shot
- Visual / Action / Dialogue / Prompt
- Human Review Card
- AI Skill Draft
- Decision
- Export / Codex Handoff

## 当前闭环

```text
选择 Script V1/V2/V3
→ 选择脚本段落
→ 编辑画面、动作、台词与 Prompt
→ 添加人工 Review Card
→ 查看 Mock AI Skill 发现
→ Accept / Revise / Reject
→ Keep / Modify / Remove
→ V1 / 当前版对比
→ 导出 Markdown / JSON / Codex Handoff
```

## 当前限制

- 不接真实 AI API。
- 不实现视频播放器、时间码或多模态识别。
- 不做复杂字符 Diff。
- 不做多人协作和权限。
- 不做自由 Recipe Builder。
- 第二个 Match Night 案例尚未加入。

## 产品演进

- `AdFrame Script`：脚本与创意评审（当前 V0）。
- `AdFrame Visual`：分镜、图片与 Prompt 评审。
- `AdFrame Motion`：生成视频与成片评审。
