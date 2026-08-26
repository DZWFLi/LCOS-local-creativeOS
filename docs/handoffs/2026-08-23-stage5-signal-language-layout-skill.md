# LCOS Stage 5 施工交接：Spatial Signal Language + Layout Brain Skill

## 任务摘要

基于 `6600940`，完成最后施工阶段：统一空间信号语言的使用边界，并创建 canonical `lcos-workspace-steward` Skill。

## 实际范围

- Context / Workflow 组件 header 统一使用 Light Segment 表达边界与焦点，Glyph 保留为小型语义出现物。
- 没有给所有组件添加 glow、全屏点阵或 Idle 高频动画。
- 新增 `packages/skills/lcos-workspace-steward/SKILL.md` 与 intent contract reference。
- 将 Skill 加入 `packages/skills/managed-skills.json` 和 `packages/skills/index.md`。
- Skill 只输出声明式空间意图，要求 deterministic geometry → SurfaceOps → Ghost Preview → Keep / Revert。
- Skill 不输出像素、HTML、React、CSS，不覆盖 pinned layout，不修改 Project Truth。

## Sol 复核纠正

- 原 Skill 把 `place beside`、`collapse inactive`、`restore arrangement` 等非冻结词汇写进 canonical 输出集合，已移除。
- 七个冻结 Layout Brain 意图不再被描述成全部已接通：v0.1 可执行映射只有 `preserve`、`cluster`、`sequence`、`suggest region`；其余意图缺少通用 SurfaceOp 时必须停在 Proposal / blocked。
- 显式 User / Agent Selection 高于 workspace fallback，但二者都只是当前 Presentation 候选，不成为 Project Truth membership。

## 修改文件

- `apps/web/src/features/spatial/components/ContextComponentRenderers.tsx`
- `apps/web/src/features/spatial/components/WorkflowComponentRenderers.tsx`
- `packages/skills/lcos-workspace-steward/SKILL.md`
- `packages/skills/lcos-workspace-steward/references/intent-contract.md`
- `packages/skills/managed-skills.json`
- `packages/skills/index.md`
- `docs/handoffs/2026-08-23-stage5-signal-language-layout-skill.md`

## 定向检查

- Web typecheck：通过
- 定向测试：8/8 通过
- `git diff --check`：通过
- `node scripts/validate-lcos-skills.mjs`：通过，8 个 managed skills
- 通用 `skill-creator quick_validate.py`：未通过，原因是它只接受旧版 frontmatter 白名单；本仓库 `packages/skills/SKILL_SPEC.md` 明确要求并已验证 `role/version/estimatedTokens/readOrder` 扩展字段，因此不改 canonical 规范迁就旧 validator。

## Stage 5 后统一验收

现在才进入施工地图规定的集中验收：lint → typecheck → unit → build → spatial validators → desktop doctor → browser Golden Path → Windows Desktop smoke。完整结果必须区分 inherited B 类失败、真实回归和环境阻塞。

## 回滚

回滚本阶段提交即可；Skill canonical source 与前四阶段代码均可独立恢复。
