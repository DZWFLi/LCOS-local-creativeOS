# LCOS Phase Snapshot · 0.1 Desktop + Capture + Skill V4.3 Baseline

日期：2026-08-18  
阶段代号：PASS9

## 当前唯一基线

`LCOS_FULLSTACK_DESKTOP_CAPTURE_SKILL_V43_BASELINE_PASS9_20260818`

它继承并收拢：

```text
S10 产品化
→ PASS8 Desktop + Capture standalone baseline
→ Skill Runtime V4.3 inheritance upgrade
```

从此不再要求 Codex 合历史 PASS patch 或 Skill patch。

## 0.1 主链冻结

```text
Capture Float / Browser / Clipboard
↓
Capture Space
↓
Semantic Drop
↓
Project Main Canvas
↓
Saved Context
↓
Workflow
↓
Project Context → Managed Run
↓
Proposal / Revision / Handoff / Continuity
```

## Skill 分工冻结

- `lcos-project-curator`：长期 Saved Context / Workflow / Presentation / Capture curation。
- `lcos-project-context`：当前任务 ActiveContext / ContextManifest / AgentExecutionPlan / Run。
- `lcos-executor-run`：executor turn。
- backend/frontend/workbuddy：系统维护专项，不和业务 Curator 重叠。
- Skill Author：Simple/Indexed Skill + user/managed install boundary。

## 0.1 不做

- 真实本地项目文件自动整理。`filesystem_organize` 只保留 plan-only route。
- 新的 FileOrganization database/journal。
- 第二套 Presentation organizer。
- Curator 自动创建 Managed Run。
- 把 Saved Context 和 ActiveContext 合并。
- 为了 Skill 文案补不存在的 shell workaround。

## 当前下一步

1. Windows 新工作树 `baseline:bootstrap`；
2. `test:architecture` + full baseline Gate；
3. Capability census 只把 READY 能力接入 Agent CLI/MCP；
4. Context/Workflow GUI 做最后视觉/交互真机验收；
5. 最后恢复 Windows installer make。
