# LCOS Stage 2 施工交接：Workflow Real Components

## 任务摘要

基于 Stage 1 提交 `cdf8d5d`，执行施工地图 Stage 2 的空间组件部分，不跨入 Stage 3 Web Workbench 实现，也不修改 Executor、Bridge 或 Run Schema。

## 实际范围

- Workflow Step adapter：注册为真实 renderer，继续保持 adapter-only，避免伪造步骤。
- Review / ChangeSet：真实 Review presentation renderer。
- Checkpoint：真实 checkpoint presentation renderer。
- Workbench Frame：只提供外框与 Input / Agent / Output slot 视觉，不实现内部工具。
- Workflow Graph：沿用现有 Graph Lens 与 runOverlay，不新增第二套 Workflow Truth。

## 数据边界

- renderer 只读取既有 `SurfaceElement.binding`。
- Workflow Step 仍绑定真实 `stepId`，不把 Material 转换成 Step。
- Review / Checkpoint / Workbench 仍是 Surface projection；删除不会删除项目实体。
- Active Path 继续由既有 `runOverlay` 表达，没有新增持久化状态。

## 定向检查

- Web typecheck：通过
- `apps/web/tests/surfaceComponentFoundation.test.ts`：修正 Stage 2 catalog 断言后通过
- `git diff --check`：通过

完整浏览器、全栈 build、Golden Path 延后 Stage 5 统一验收。

## 未完成 / 下一步

- Stage 3 才实现 Web Workbench Routine Tabs、Quick Note 和 Agent Tool slots。
- Review 的真实 ChangeSet 操作仍由已有 runtime/domain 能力提供，本阶段没有伪造 Keep / Revert。
- Layout Brain、Signal Language、Agent Composer 留在后续阶段。

## 回滚

回滚本阶段提交即可，不触碰 Stage 1 提交和 Project Truth。
