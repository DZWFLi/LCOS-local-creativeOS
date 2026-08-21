# R3.1-A Closeout Patch 合并交接（2026-08-14）

## 来源与校验

- Patch：`LCOS-R3.1A-CLOSEOUT-PROJECT-ENTITY-CONTEXT-WORKFLOW.patch`
- SHA256 核对：`830f7f2c98b94df5d7def519e199e036254cce23d511e8710707ec43f4c2f887` 与随附校验文件一致 ✓
- 基线声明：R3.1A3 + A3.1（Context/Signal stage visibility）

## 合并结果

### 干净应用（26 个文件 + 新增模块）

- `apps/local-core`：metadata-repository、presentation-application-service、presentation-persistence 测试
- `apps/web`：App、contextMerge、ScopeCreateDialog、Context/Workflow 各 Surface、ProjectionSurfaces、SurfaceObject、runtimeBridge、canvasScopes、presentationViewState、main、新 `r31a-closeout.css`、新 `WorkflowGraphSurface`、新 `semanticRightDrop`、新 `features/entities/`
- `packages/contracts`：presentations（`memberEntityRefs` / `PresentationEntityRefV0`）
- 新测试：`guiR31aCloseout.test.ts`、`contextMerge.test.ts`、`projectPresentationMembership.test.ts` 增量、`guiR31aProjectNodeFoundation.test.ts` 断言更新
- 决策稿：`docs/decisions/R31A_PROJECT_ENTITY_SURFACE_MODEL_20260814.md`

### 手工合并（3 处基线冲突）

1. `projectPresentationMembership.ts`：保留本地跨 Scope 修复的 `currentView` 变量风格，叠加 closeout 的 `memberEntityRefs` 全链路（load/append/remove + 新增 `append/removeProjectPresentationEntityRefs`、`uniquePresentationEntityRefs`、`persistenceScopeId`、capability 含 `custom`）。
2. `guiR31aProjectNodeFoundation.test.ts`：两行断言更新为 `createContextFromMembersDirect(viewIds, undefined, entityRefs)` / `createWorkflowFromMembersDirect(...)`。
3. `docs/OPEN_DEBTS.md`：P0-R31A 区块替换为 closeout 冻结模型 + 明确未关闭的 Core integrity debt（delete_scope 原子事务、destructive merge/split、containerViewId 兼容 carrier 等）。

### 旧契约测试按新模型修订（4 处，均为模型变更导致的预期失效）

- `v06Phase3Contract.test.ts`：Collection 从「创建子画布」改为「aggregate Entity + exact membership，不克隆不导航」。
- `v07Integration.test.ts`：Workspace 场景语义更新——`changeWorkspace` 仍不跨 Scope/不动 Camera；`openWorkspaceScene` 负责恢复 Scope/Camera；`locateWorkspace` 只动 Camera。
- `guiR31aProjectNodeFoundation.test.ts`：projection 块断言改为 `nodes: projectPresentationNodes`。
- `guiR3DirectManipulation.test.ts`：Context dot 点击断言匹配新格式化 `onClick={()=>props.onOpenContextView...}`。

### Core 修复

- `metadata-repository.ts` `delete_workspace` 分支：`projectId` 在严格模式下可为 `string | undefined`，加 `if (projectId)` 守卫（与既有 `#assertMutationProjectExists` 语义一致），Presentation 清理只在该项目存在时执行。

## 验证结果（本机全量）

- Web typecheck ✓ / local-core typecheck ✓ / contracts+domain 依赖构建 ✓
- Web vitest（排除 3 个环境级 e2e spec）：195 files / 944 tests PASS（含新增 closeout 契约）
- local-core vitest：80 files / 394 tests PASS
- Web `vite build` ✓ / local-core `tsc` 构建 ✓
- 开发栈已重启（dev-stack：vite 5173 + local-core 43121 + bridge），真实浏览器加载验证：
  - rail 9 项、主画布正常、底栏「上下文 / 工作流」在位
  - 404 均为 presentation 首次 NOT_FOUND → 自动播种的正常流程

## 真实浏览器 A Gate（开发侧未替用户代验，等待手测）

1. 底部「上下文」→ Context Graph（点状关联图），点 Context 点 → Signal Track / Mind Map
2. 底部「工作流」→ Workflow Graph（有向行动网络），点 Workflow → 具体 Workflow Canvas
3. 同一 Project 对象可同时出现在主画布 / Context / Workflow，无需先进入物理 Scope
4. 右键投送普通 View / Collection / Context / Workflow / Workspace 到允许目标；reload 后 exact membership 保持
5. Workspace 节点可出现在 Context / Workflow，点击打开同一保存场景
6. 从选择创建 Collection：不进入子画布、不克隆成员
7. Rail 新 UX 不受影响：左键排序 / 左甩删除 / 右键投送 / 改名

## 风险 / 回滚

- 回滚：`git revert` 本合并 + 手工合并三文件可整体还原；无 schema migration（`memberEntityRefs` 为可选字段，旧数据兼容）。
- 已知 debt 见 OPEN_DEBTS P0-R31A「明确仍未关闭的 Core integrity debt」6 项，不伪装成 A 已完成。
