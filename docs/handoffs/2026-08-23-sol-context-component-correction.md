# Sol 复核纠偏：Context 真实组件适配

## 任务摘要

复核 Luna Stage 1–5 产出，撤回未接通却暴露为可用的能力，并将 Context 的 Structure / Evolution / Relationship / Context Pack 从静态装饰占位改为真实 Project 数据适配。

## 实际范围

- Surface renderer 获得只读的 nodes / edges / hierarchy / history 与选择、打开回调。
- 正确读取 `binding.projectViewIds`，不再只读标量 ID。
- Structure 读取真实层级；Evolution 读取真实历史；Relationship 读取真实 Edge；Context Pack 读取明确选择。
- Context Pack 无选择时禁止创建，避免空包被误认为有效 Context。
- Workflow 复用 Context Pack 时传入实际选择和材料；Review / Checkpoint / Workbench 仍保持 `planned`。
- 修复 Context / Workflow 组件 Header 的列布局回归。

## 变更流程

```text
用户 / Agent 意图
  -> 明确选择或当前 Context
  -> SurfaceElement 仅保存 identity binding
  -> renderer 从当前 Project projection 读数据
  -> 展示真实内容 / 关系 / 历史
  -> 交互回到原有选择、打开和来源定位
```

Project Truth、Canonical Canvas 坐标、Saved Context 成员关系均未修改。

## GUI 语义

- Functional Body 显示真实标题、摘要、关系和时间。
- Light Segment 只表达局部边界 / 当前关注。
- Glyph 只做语义标点，不承担内容、不拦截 pointer / drop。
- 没有数据时显示诚实空态，不伪造“主线 / 原因 / 下一步”。

## 验证

- Web TypeScript：PASS。
- `surfaceComponentFoundation.test.ts`：9/9 PASS，新增真实 binding / 节点 / 关系渲染断言。
- Spatial Component Foundation 静态门禁：22/22 PASS。
- `git diff --check`：无格式错误（仅 Windows 换行预警）。

## 未完成 / 风险

- Review 尚无 ChangeSet / Keep / Revert 真实 contract，不可开放。
- Checkpoint 尚无 durable checkpoint identity / restore callback，不可开放。
- Workbench 的 Routine Tabs / Quick Note / Agent Tools 仍是原型状态，尚未接入项目 runtime，不可开放。
- 本轮尚未做真实浏览器 GUI 手操验收。

## 回滚

本批只改变 Presentation adapter、Catalog 暴露条件与 CSS；可通过单独 revert 本批 commit 回退，不涉及 Schema 或 Project Truth 迁移。
