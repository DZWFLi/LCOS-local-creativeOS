# Cross-Surface Material LOD

## 审计发现

四档 LOD 只在 Main Canvas 生效；Context Space 与 Workflow 的材料在 151+ 时仍完整渲染重型预览，违背“三张现场共享性能边界，但不共享界面形态”的规划。

## 修正

- `SurfaceObject` 增加 Presentation-only semantic proxy。
- Context Space 使用同一 80 / 150 / 300 LOD 计算：simplified 使用 compact，aggregate / overview 使用 proxy。
- Workflow 只对 Material 应用该 LOD；WorkflowAction 仍保持独立 Step 形态。
- Selection 永远升级回完整对象面孔，不因大数据量丢失操作目标。

## 边界

- 不减少 Surface membership，不写 Project Truth。
- 不把 Context / Workflow 排列方式改成 Main Canvas。
- 本批不声称完成 300+ 真正 Cluster renderer 或 DOM virtualization。

## 验证

- Web typecheck：PASS。
- Foundation + Spatial LOD：2 files / 20 tests PASS。
- `git diff --check`：无空白错误，仅 Windows LF/CRLF 提示。

## 后续手测

- Context / Workflow 分别加载 80、151、300 个材料。
- 核准未选中代理、选中升级、拖动、Focus 与 Relation 可读性。

## 回滚

单独 revert 本批提交。
