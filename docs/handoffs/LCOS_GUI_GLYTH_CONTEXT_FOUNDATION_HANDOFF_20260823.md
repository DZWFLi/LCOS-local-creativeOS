# LCOS GUI · Glyth 与 Context 组件基础交接（2026-08-23）

## 任务摘要

本批以“LCOS 数据形态讨论”为产品真相，纠正早期前端实现把 Glyth 做成静态水印、把组件架做成灰色目录、把 Context 留成空白画布的问题。详细施工稿只作为文件与验收参考，不作为新的产品规则中心。

## 实际范围

- Desktop 启动过程增加 Glyth 状态界面，错误与卡住阶段可见。
- 建立 LCOS 原创 Glyth SVG 动效内核：稳定核心、双竖眼、四段开放外壳、连续状态形变。
- 全部 Glyth 共用单一动画时钟；后台、视口外与 Reduced Motion 会降级。
- 引用 Bloub 的 MIT 动效代码思想与许可边界；未复制 xAI / Grok 视觉设计。
- 围栏退出人工组件架；“语境区”改为可理解的“区域”；Workflow 不再出现 Context Pack；无选择时不显示灰色 Context Pack。
- Context 首次进入会按真实对象非破坏式生成来源链、结构、演进/关系组件，并记录一次性 Bootstrap 标记；用户删除后不会自动复生。
- 固定 `pointer-events: none` 来源条退出；来源成为可移动 Surface Component。
- 来源卡支持链内重排、跨链拼接、断开当前引用、剪出平行来源链；操作只改 Presentation。
- Main 画布显式关系可显示文字标签；Agent 组织入口使用可感知状态的 Glyth。

## 变更流程

```text
旧：固定来源条 / 空 Context / 灰色假入口
  → 组件目录与真实能力错位
  → 用户看不见数据结构，也无法编辑来源脉络

新：Project Truth
  → Context 首次 Composition（一次性、可删除）
  → Source Chain / Structure / Evolution / Relationship
  → 用户移动、重排、剪切、拼接
  → 只保存 Presentation geometry + identity refs
```

## 关键文件

- `apps/web/src/features/spatial/visual/LcosGlyth.tsx`
- `apps/web/src/features/spatial/visual/glythMotion.ts`
- `apps/web/src/features/spatial/components/SourceChainComponent.tsx`
- `apps/web/src/features/spatial/model/sourceChainOps.ts`
- `apps/web/src/features/spatial/components/SurfaceComponentShelf.tsx`
- `apps/web/src/features/surfaces/ContextSpaceSurface.tsx`
- `apps/web/src/features/canvas/ProjectCanvas.tsx`
- `apps/web/src/state/presentationDraftState.ts`
- `packages/contracts/src/presentations.ts`

## 测试结果

- Web TypeScript：PASS。
- Local Core TypeScript：PASS。
- Contracts TypeScript：PASS。
- Glyth + Surface Component 单元测试：23/23 PASS。
- Spatial Component Foundation 静态验收：22/22 PASS。
- Desktop Runtime host 定向测试：8/8 PASS（启动提交前执行）。
- `git diff --check`：PASS；仅存在 Windows 换行提示。

## 尚未完成

- 尚未进行本批真实浏览器视觉与拖拽手操总验收。
- 节点视觉签名与 Grid 参照体系还需继续深化；现有对象解剖已保留，但关系层级只是先补了显式标签。
- Workflow 的 Input/Output、Active Path 等能力仍应从真实 Workflow 数据生成，不能用空壳占位。
- Source Chain 已支持重排、跨链拼接与平行分支，但链间“大因果关系”仍应复用真实/Presentation Edge 的下一轮编辑能力。
- Golden Path 项目需在真实浏览器确认一次性 Context Bootstrap 是否与已有 Presentation 状态正确共存。

## 风险与回滚

- `surfaceBootstrapVersion` 是新增可选 Presentation 字段；旧数据向后兼容。若 Bootstrap 行为异常，可回滚 `f78e566`。
- 来源链编辑只改 `SurfaceElement.binding.projectViewIds`，不会删除 Artifact、View 或 Project Entity。若交互不合适，可单独回滚 `232f380`。
- Glyth 动效不拥有业务状态，状态仍由现有 Presentation Helper 提供；若性能异常，可关闭 `animated` 或回滚 Glyth 提交，不影响 Project Truth。

## 提交锚点

- `e894054` — Desktop Glyth 启动界面。
- `f78e566` — Glyth、正确组件目录与 Context 首次沉淀。
- `232f380` — 来源链编辑与关系可读性。

未 Push。仓库中继承的未跟踪 patch / Buddy 文件未修改、未提交。
