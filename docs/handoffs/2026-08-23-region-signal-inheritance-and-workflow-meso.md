# Region Signal Inheritance + Workflow Meso Semantics

## 任务摘要

继续落实 v04 的 Micro / Meso 分层：节点可读取所在 Region 的显式 Presentation 语义；Review、Checkpoint、Workbench 使用同一 Glyph / Light Segment 语言，但不得伪造真实运行或业务状态。

## 变更前后

```text
变更前
Region variant ──只显示在 Region 自身
Workflow Meso ──旧圆点 + Selection 高亮

变更后
Region explicit projectViewId(s)
  └─ Presentation hint → 同一 Project View 的 Glyph 姿态

Review      有绑定=waiting；无绑定=candidate
Checkpoint  有 checkpointId=protected；无绑定=candidate
Workbench   默认 candidate；显式 variant 可覆盖
```

## 边界

- 不按几何重叠推断 Region membership。
- 不写 Entity / Project Truth，不新增 Schema。
- 多个 Region 仅组合成展示候选语义；真实 runtime 的失败/处理中优先。
- Review / Checkpoint / Workbench 仍是 Presentation component，不升级为固定 Core Node Role。
- Workbench 未接真实工具时明确保持 candidate，不伪装 working。

## 修改文件

- `apps/web/src/features/spatial/visual/spatialSignal.ts`
- `apps/web/src/features/surfaces/SurfaceObject.tsx`
- `apps/web/src/features/surfaces/ContextSpaceSurface.tsx`
- `apps/web/src/features/surfaces/WorkflowSurface.tsx`
- `apps/web/src/features/spatial/components/WorkflowComponentRenderers.tsx`
- `apps/web/src/spatial-components.css`
- `apps/web/tests/surfaceComponentFoundation.test.ts`

## 验证

- Web typecheck：PASS。
- Foundation behavior：13/13 PASS。
- Spatial static gate：22/22 PASS。
- `git diff --check`：无空白错误，仅 Windows LF/CRLF 提示。

## 未完成

- Main Surface 当前没有同构 SurfaceElement Layer，不能假装已完成 Region signal inheritance。
- 真实浏览器需核准 Context / Workflow 中 Glyph 密度、低缩放辨识度与 Reduced Motion。

## 回滚

单独 revert 本批提交；无迁移与 Project Truth 变更。
