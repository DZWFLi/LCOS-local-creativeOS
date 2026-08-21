# LCOS GUI · 弹窗 / Sidecar 纠正交接

日期：2026-08-09
状态：完成

## 任务摘要与实际范围

- 修复通用弹窗点击窗口其余区域不能关闭的问题。
- 统一 14 个可取消 Dialog / Modal 的 backdrop pointer 协议；执行中异步任务保持保护。
- 将 Codex Sidecar 改为 Canvas-first：不渲染全局 Agent、WorkRail 或依赖该 Rail 的入口。
- 保留独立桌面 LCOS 的全局 Agent 能力与状态。

变更流程图见 `docs/audit/LCOS_GUI_MODAL_AND_SIDECAR_CORRECTION_20260809.md`。

## 修改文件

- 新增：`apps/web/src/features/ui/dismissibleLayer.ts`
- 修改：14 个 Dialog / Modal 组件、`foundation.css`
- 修改：`App.tsx`、`AppShellView.tsx`、`ProjectStripVNext.tsx`、`product-interface.css`
- 新增：`apps/web/tests/dialogDismissalContract.test.ts`
- 更新：Sidecar / Round 2 审计与交接说明

## 测试结果

- `npm run lint --workspace @local-creative-os/web`：通过，只有既有 warning。
- `npm run typecheck --workspace @local-creative-os/web`：通过。
- `npm run test --workspace @local-creative-os/web`：36 files / 179 tests 通过。
- 内置浏览器：弹窗内部点击保持、外部真实指针关闭；855 Sidecar 无 Agent / WorkRail；1280 Desktop Agent 可打开；Console 0 / 0。
- 节点单击回归：Desktop 与 855 Sidecar 均验证单击只选择；Camera 三元组不变、无 Dialog、单击后的 Console 0 / 0。

## 风险、未完成与下一步

- 未新增数据库、Runtime、Bridge、Schema 或对象模型变更。
- 当前通用导入面板的窄屏视觉密度仍需要在 GUI 正式化主线中继续打磨，本轮只收口遮罩几何与关闭行为。
- 下一步回到 `First-run & Empty State` 与安装后首次上手主线，不继续扩张 Sidecar 专用功能。

## 回滚说明

回滚本轮 UI 文件即可；无数据迁移。恢复旧 Sidecar Rail 会重新占用 Canvas 空间，不建议作为产品方向保留。
