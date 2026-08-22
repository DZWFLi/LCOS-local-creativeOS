# LCOS Stage 1 施工交接：Context Real Components

## 任务摘要

基于 `feat/spatial-component-foundation@798e647`，只执行施工地图 Stage 1：让 Context 的四个空间组件成为真实可创建的 Presentation renderer。

## 实际范围

- Structure Map（结构）
- Evolution（演进）
- Relationship Field（关系场）
- Context Pack

没有进入 Workflow、Agent Composer、Receiver、Web Workbench 或 Layout Brain。

## 变更流程

```text
Context 组件入口
  → Registry 解析真实 renderer
  → SurfaceFrame 负责移动/缩放/选中
  → Renderer 只读取 binding，表达当前 Presentation
  → SurfaceOps 保存 SurfaceElement
  → Project Truth 保持不变
```

## 修改文件

- `apps/web/src/features/spatial/components/ContextComponentRenderers.tsx`
- `apps/web/src/features/spatial/components/surfaceComponentRegistry.tsx`
- `apps/web/src/features/spatial/model/surfaceComponentCatalog.ts`
- `apps/web/src/spatial-components.css`
- `apps/web/tests/surfaceComponentFoundation.test.ts`

## 数据与边界

- 四个组件由 `SurfaceComponentShelf` 进入创建列表。
- 绑定仍使用现有 `projectViewIds`，不复制实体、不创建第二份 Project Truth。
- 删除仍是 `remove-projection`，不会删除项目对象。
- 组件仍由现有 `SurfaceFrame` 承担位移、缩放、选中和 reduced-motion 约束。

## 定向检查

- `npm run typecheck --workspace @local-creative-os/web`：通过
- `npx vitest run apps/web/tests/surfaceComponentFoundation.test.ts --reporter=dot`：7/7 通过

按用户要求，完整 Golden Path、真实浏览器视觉验收、全栈 build/test 延后到 Stage 5 统一执行，本阶段没有虚报这些结果。

## 未完成 / 下一步

- 组件内部目前是轻量 Presentation 级表达，尚未接入更深的 Context 内容派生、拖入后的成员增删和 Lens 内部编辑。
- 下一阶段再处理 Evolution/Relationship 的更深数据接线；不得把这些工作倒灌到 Workflow。

## 回滚

回滚本阶段提交即可；不触碰 `ProjectEntity`、数据库 schema 或旧 Context 页面。
