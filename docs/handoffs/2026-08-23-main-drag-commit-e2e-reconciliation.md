# Main 拖动提交与 E2E 契约对账

## 任务摘要

对齐 Scene 实体化后的 Main E2E 前提，并修复节点拖动只停留在 RAF Preview、偶发不写回 Project Presentation 的真实回归。

## 变更流程

```text
旧：pointer move → RAF preview → 只有 pointerup 时 RAF 尚未执行才 setNodes
新：pointer move → RAF preview → completed drag 在 pointerup 无条件提交最终 world position
```

## 实际范围

- Main 单节点与多选组拖动最终位置稳定写回，pinned/manual 标记保持。
- Interaction E2E 进入明确的 ArtifactView 工作现场，不再把 Project 根画布的 Scene / Collection 实体当文件验证。
- 双击断言对齐只读 Immersive Reader；Workbench 不再被伪装成默认阅读器。
- Scene Drop 测试对齐“根画布保留 Scene 实体、进入 Scene 是显式动作”。

## 修改文件

- `apps/web/src/features/canvas/ProjectCanvas.tsx`
- `tests/e2e/interaction-foundation.spec.ts`
- `tests/e2e/new-scene-semantic-drop.spec.ts`
- `tests/e2e/scene-creation-semantic.spec.ts`

## 验证

- Interaction Foundation + New Scene Semantic Drop：6/6 通过。
- Context / Handoff / Phase4 定向组：5 通过、1 条因样例无关系边按既有条件跳过。
- Scene Creation 单测在上一轮定向执行通过。

## 风险与回滚

- 风险集中在拖动松手时的最终提交；语义 Drop 分支仍在该逻辑之前返回，不会误写原节点位置。
- 回滚本提交可恢复旧行为，但会重新引入一帧时序导致的拖动丢保存。

