# R3.1-A Closeout 更新流程交接（2026-08-14）

> 本文记录「从 Closeout patch 收到 → 合并 → 修测试 → 修导航 → 重启验证」的完整更新流程，供后续接手者按同样流程更新/回滚。

## 1. 更新来源与校验

- Patch：`LCOS-R3.1A-CLOSEOUT-PROJECT-ENTITY-CONTEXT-WORKFLOW.patch`
- SHA256：`830f7f2c98b94df5d7def519e199e036254cce23d511e8710707ec43f4c2f887`（与随附校验文件一致）
- Notes：`LCOS_R3.1A_CLOSEOUT_NOTES_20260814.md`（冻结模型、兼容性 debt、A Gate 清单）
- 决策稿（随 patch 落地）：`docs/decisions/R31A_PROJECT_ENTITY_SURFACE_MODEL_20260814.md`

## 2. 合并流程（按序执行）

1. `git apply --check` 预检 → 3 处冲突（基线差异）：
   - `apps/web/src/state/projectPresentationMembership.ts`
   - `apps/web/tests/guiR31aProjectNodeFoundation.test.ts`
   - `docs/OPEN_DEBTS.md`
2. 其余全部干净应用：`git apply --exclude=<上述3文件> <patch>`
3. 手工合并 3 处冲突（见下节）。

### 手工合并明细

- **projectPresentationMembership.ts**：保留本地跨 Scope 修复的 `currentView` 写法，叠加 Closeout 的 `memberEntityRefs` 全链路（load/append/remove 返回实体引用；新增 `uniquePresentationEntityRefs` / `appendProjectPresentationEntityRefs` / `removeProjectPresentationEntityRefs`；`persistenceScopeId`；capability 支持 `custom`）。删除/新增必须成对：成员函数签名一旦变化，所有调用点（App、semanticRightDrop、entities）同步编译校验。
- **guiR31aProjectNodeFoundation.test.ts**：两行断言改为 `createContextFromMembersDirect(viewIds, undefined, entityRefs)` / `createWorkflowFromMembersDirect(viewIds, undefined, entityRefs)`。
- **OPEN_DEBTS.md**：P0-R31A 区块整体替换为 Closeout 冻结模型描述 + 6 项明确未关闭的 Core integrity debt。

## 3. 旧契约测试按新模型修订（4 处，均为模型变更导致的预期失效，非回归）

| 测试文件 | 旧断言 | 新断言 |
| --- | --- | --- |
| `v06Phase3Contract.test.ts` | Collection 创建子画布/克隆成员 | Collection = aggregate Entity + exact membership，不克隆不导航 |
| `v07Integration.test.ts` | Workspace 激活与 Scope 导航完全无关 | `changeWorkspace` 不动 Scope/Camera；`openWorkspaceScene` 恢复 Scope/Camera；`locateWorkspace` 只动 Camera |
| `guiR31aProjectNodeFoundation.test.ts` | projection 块含 `nodes,` | `nodes: projectPresentationNodes` |
| `guiR3DirectManipulation.test.ts` | `onClick={() => props.onOpenContextView...` | `onClick={()=>props.onOpenContextView?.(...`（格式化） |

## 4. Core 修复（patch 自带代码在严格模式下的编译问题）

- `apps/local-core/src/metadata-repository.ts` `delete_workspace` 分支：`projectId` 可为 `string | undefined`，给 Presentation 清理加 `if (projectId)` 守卫（与 `#assertMutationProjectExists` 语义一致）。

## 5. 本机验证结果（全量）

- Web typecheck ✓ / local-core typecheck ✓
- Web vitest（排除 3 个环境级 e2e spec）：195 files / 944 tests PASS
- local-core vitest：80 files / 394 tests PASS
- Web `vite build` ✓ / local-core `tsc` 构建 ✓
- 开发栈重启：`npm run dev:stack`（vite 5173 / local-core 43121 / bridge）

## 6. 本轮真机发现并修复的两个 GUI 问题

### 6.1 侧栏视图单击失效（Rail 指针捕获劫持 click）

- 症状：点任何侧栏视图都没反应，进不了视图。
- 根因：左键拖拽手势在 `pointerdown` 立即 `setPointerCapture`，后续 `click` 被重定向到容器，按钮 `onClick` 不触发。
- 修复（`WorkspaceRailVNext.tsx`）：按下时不捕获；`moveLeftDrag` 超过 4px 阈值后才捕获。单击恢复、拖拽不受影响。

### 6.2 空视图后回不到主画布（底栏「主画布」不退出 Workspace 场景）

- 症状：点进空工作空间/Context 后，点底栏「主画布」仍停在空画布。
- 根因：底栏主画布走 `enterScope(rootScopeId)`，`nextScopeId === scopeId` 提前返回，只 `setActiveSurface('arrange')`，未清 `workspaceId`。
- 修复（`App.tsx enterScope`）：回到当前 Scope 的分支同时 `setWorkspaceId(null)` + `setActiveWorkflowId(null)` + `setLayoutPreview(null)`；非提前返回路径也补清 `activeWorkflowId`。
- 真机复现验证：空工作空间 → 底栏主画布（节点 0 → 64，active 清空）✓；Context 视图 → 底栏主画布 ✓。

## 7. 尚未提交（等待用户确认后提交）

当前工作区共 42 个变更项（30 修改 + 12 新增），全部未 commit。建议提交顺序：

1. `feat(web+core): merge R3.1-A Closeout Project Entity / Context / Workflow`
2. `fix(web): rail click capture hijack + bottom-dock main canvas scene exit`

## 8. 待办（真实浏览器 A Gate，需用户手测）

1. 底部「上下文」→ Context Graph（点状关联图）→ 点 Context 点 → Signal Track / Mind Map
2. 底部「工作流」→ Workflow Graph（有向行动网络）→ 点 Workflow → 具体 Workflow Canvas
3. 同一 Project 对象同时出现在主画布 / Context / Workflow，无需先进入物理 Scope
4. 右键投送普通 View / Collection / Context / Workflow / Workspace；reload 后 exact membership 保持
5. Workspace 节点出现在 Context / Workflow，点击打开同一保存场景
6. 从选择创建 Collection：不进子画布、不克隆成员
7. Rail 新 UX 不受影响：左键排序 / 左甩删除 / 右键投送 / 改名

## 9. 回滚

- 未提交前：`git checkout -- <文件>` 或丢弃工作区即可整体还原（无 schema migration，`memberEntityRefs` 为可选字段，旧数据兼容）。
- 已提交后：按第 7 节两个 commit 逐个 revert；Core debt 与模型变更记录见 `docs/OPEN_DEBTS.md` P0-R31A / P0-R31A4。
