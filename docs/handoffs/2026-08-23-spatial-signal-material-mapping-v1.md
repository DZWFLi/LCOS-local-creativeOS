# Spatial Signal Material Mapping v1

## 任务摘要

依据《LCOS 0.1 三大独立视图组件化详细施工总稿 v04》，把 Glyph、Light Segment、Matrix 从分散的视觉效果收束为同一套 Presentation Signal。Glyph 继续只是对象旁的 living punctuation，不升级为 Fence、Region、Edge 或 Surface。

## 实际范围

- 新增纯展示层 `resolveSpatialSignal`，把真实运行状态、保护状态、候选状态与当前选择转为统一视觉信号。
- Fence / Region / Surface Panel 使用同一映射，不写 Project Truth。
- Workflow Step 从旧占位信号切换到 Glyph Micro，并优先读取真实 Run Overlay。
- Matrix 只在真正的 working 状态激活；单纯选中不再伪装成“系统正在工作”。
- 工作台 / Review 类型不再因为组件类型本身而伪造 activity。
- 补充受保护、候选、等待、阻塞、工作中的轻量材料差异。

## 变更流程

```text
变更前
选择 / 组件类型 / 局部 Run 状态
  ├─ 各组件自行判断
  ├─ Selection 可能误触发 Matrix
  └─ Workbench / Review 可能被伪装为 working

变更后
真实运行状态 + Presentation variant + Selection
  ↓
resolveSpatialSignal（Presentation Helper）
  ├─ Glyph：对象级语义姿态
  ├─ Light Segment：边界 / 路径局部强调
  └─ Matrix：仅真实处理态的能量场
```

## 设计边界

- Resolver 是可覆盖的展示助手，不是 Core membership resolver，也不是业务规则中心。
- 不新增 Schema，不保存信号状态，不改变 Canonical Canvas 坐标。
- Main / Context / Workflow 仍是三种独立 Surface；只共享视觉语法，不共享界面形态。
- 默认启发式不是产品真理，后续 Agent / 用户显式 Presentation Intent 可覆盖。

## 修改文件

- `apps/web/src/features/spatial/visual/spatialSignal.ts`
- `apps/web/src/features/spatial/visual/spatialVisualTokens.ts`
- `apps/web/src/features/spatial/components/FenceComponent.tsx`
- `apps/web/src/features/spatial/components/RegionComponent.tsx`
- `apps/web/src/features/spatial/components/SurfacePanelComponent.tsx`
- `apps/web/src/features/surfaces/WorkflowSurface.tsx`
- `apps/web/src/spatial-components.css`
- `apps/web/tests/surfaceComponentFoundation.test.ts`

## 验证结果

- Web typecheck：PASS。
- Foundation behavior：12/12 PASS。
- Spatial static gate：22/22 PASS。
- 首轮测试发现“待客户确认”被保护态关键词误判；已收紧正则并复测通过。
- `git diff --check`：无空白错误，仅现有 Windows LF/CRLF 提示。
- 真实浏览器视觉验收：本批未完成。官方启动器受用户保留的未跟踪交付文件阻止；内置浏览器直接访问开发服务被客户端策略拦截。不得将其记为通过。

## 风险与未完成

- 当前只完成 Surface Component 与 Workflow Step 的统一映射；节点继承 Region 信号、Review / Checkpoint / Workbench 的完整 Meso 语义仍属后续阶段。
- 需要在可用的真实浏览器环境核准：低缩放辨识度、Reduced Motion、三种 Surface 的密度差异。

## 回滚

单独 revert 本批提交即可；无数据库、Schema、Project Truth 或迁移变更。
