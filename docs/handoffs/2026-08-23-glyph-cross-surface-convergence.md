# Glyph Cross-Surface Convergence

## 摘要

把 Main 节点、跨 Surface 材料、整理 Review 与局部 Agent 的旧 DotGlyph 收束到 Glyph Micro 本体，避免同一状态在不同现场换脸。

## 状态映射

- Main：运行中 → working；错误 → blocked；Review 待确认 → waiting；Draft → candidate；定位脉冲 → focus。
- Reorganize：整理中 → working；结果待确认 → waiting。
- Surface Agent：运行中 → working；waiting_input / review → waiting；失败 → blocked；完成 / 取消 → stable。
- Context / Workflow Material：继续读取真实节点 runtime，并允许显式 Region Presentation hint。

## 边界

- Glyph 只表达当前对象附近的语义姿态，不承担操作入口。
- Draft 不等于等待；未经确认的候选使用 candidate。
- 不删除旧 DotGlyph 实现，避免扩大到未审计历史界面；当前三现场主链不再依赖它。
- 无 Schema、Project Truth 或运行协议变更。

## 修改文件

- `apps/web/src/features/canvas/ProjectCanvas.tsx`
- `apps/web/src/features/reorganize/ReorganizePanel.tsx`
- `apps/web/src/features/shell/SurfaceAgentNode.tsx`

## 验证

- Web typecheck：PASS。
- Foundation behavior：13/13 PASS。
- Spatial static gate：22/22 PASS。
- `git diff --check`：无空白错误，仅 Windows LF/CRLF 提示。

## 未完成

- 真实浏览器需核准不同密度下的 Glyph 可见性和 hover 扰动。
- 旧 DotGlyph 仍供历史/非主链代码保留，最终删除需另做引用审计。

## 回滚

单独 revert 本批提交。
