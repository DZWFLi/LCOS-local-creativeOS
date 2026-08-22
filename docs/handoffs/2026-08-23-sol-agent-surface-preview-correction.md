# Sol 复核纠偏：Agent Surface 真实预览链

## 任务摘要

修正 Stage 4 中“有 Composer 界面、无生产调用”的假接通。Agent 现在与人共用 Surface Catalog / Intent / Ops，先产生非持久 Ghost Preview，用户选择 Keep 后才写入 Presentation。

## 变更前

```text
静态 Composer
  -> 空 targetIds
  -> 空 onPreview / onApply
  -> 无任何生产路径
```

## 变更后

```text
Context / Workflow 当前 Selection
  -> SurfaceIntent
  -> Catalog 能力校验
  -> SurfaceOps batch validation
  -> 确定性位置的 Ghost Preview
  -> Keep: 写入 Presentation SurfaceElements
  -> Revert: 丢弃预览，不改任何真实状态
```

## 用户操作变化

- Context / Workflow 右上角增加轻量 Agent 组织入口。
- 无选择时不能预览。
- 预览以虚线 Ghost 显示，不拦截 pointer，不进入 Project Truth。
- 只显示当前已真实接通的 Catalog 能力。
- Workbench / Review 等未接通能力不出现在菜单中。

## 影响模块

- `AgentSurfaceComposer`
- `SurfaceComponentProposalLayer`
- `ContextSpaceSurface`
- `WorkflowSurface`
- Spatial component CSS
- Foundation behavior tests

## 数据与 Schema

无 Schema 变更。Ghost 只存在 React 内存中；Keep 复用现有 Presentation SurfaceElement 持久链。

## 验收条件

- Preview 前 SurfaceElements 不变。
- Revert 后无持久变更。
- Keep 只接受整批通过校验的 Ops。
- 预览不提供移动、缩放或删除 chrome。
- Project Truth、Selection、Camera 不被 Composer 重置。

## 风险与未验证

- 当前只接通已批准的 Region / Context Structure / Evolution Intent。
- Workbench Runtime、Review ChangeSet、Checkpoint restore 仍未接通。
- 真实浏览器手感与窄窗响应式尚待统一验收。

## 回滚

单独 revert 本批 commit。未新增 Core / Bridge / Schema 依赖。
