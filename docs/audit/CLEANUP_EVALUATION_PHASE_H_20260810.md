# Cleanup 评估（Phase H13，只评估不删）

新路径（Curator + CLI + Search + Presentation persistence）已稳定，评估以下 legacy 依赖是否可以删除。

## 候选清单

| Legacy | 位置 | 使用面 | 测试 | 结论 |
|---|---|---|---|---|
| prototypeStorage（production 依赖） | `apps/web/src/state/prototypeStorage.ts` | 非 runtime 模式保存；runtime 模式仍写 catalog | fixture 测试 | **保留**（fixture/QA 仍用；runtime 分支已隔离） |
| WorkspaceIntent behavioral dependency | `model.ts` / workspace 编辑器 | intent 标签 | 少 | **保留**（无真实使用证据；删需 repo-wide 审计） |
| NodeKind heuristic | `runtimeBridge.ts`（process/note/decision filter） | graph diff 过滤 | 有 | **保留**（删除会改变 mutation 语义，需 Golden 证明） |
| surfaceModel title regex | `CanvasNodeVisual.tsx`（feedback/反馈/change/keep） | 节点形态 | visualFamily 已优先 | **部分可删**：feedback 分支尚无机械来源，暂留（TODO 已在 C8 标注） |
| resolveWorkflowView process heuristic | `capabilityViewResolver.ts` | workflow 空态 | 有 | **保留**（workflow 无成员时 fallback） |
| legacy lcos-project-context | `packages/skills/lcos-project-context` | 普通项目会话 | 有 | **保留**（与 curator 触发互斥，各有职责） |

## 删除前置条件（全部满足才删）

```text
repo-wide usage 证明无引用
相关测试移除/更新
Golden Case 覆盖替代路径
```

当前均不满足 → 本 Phase 不删除任何 legacy。每个保留项已有关联的 DEPRECATED_BEHAVIORAL_HINT 或文档标注。
