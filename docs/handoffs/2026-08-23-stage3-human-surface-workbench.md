# LCOS Stage 3 施工交接：Human Surface GUI + Web Workbench

## 任务摘要

基于 `799ef39`，执行施工地图 Stage 3 的最小可用范围：复用现有 Component Shelf / SurfaceFrame，并在 Workbench Frame 内提供 Routine Tabs、Quick Note、固定 Agent Tool slots。

## 实际范围

- Component Shelf 继续作为唯一创建入口，未新增一级页面。
- Workbench Frame 内增加轻量 Web Workbench。
- Routine Tabs：今日工作页、客户反馈、素材与参考。
- Quick Note：临时 Markdown/文本输入，不自动写入 Project Truth。
- Agent Tool slots：页面总结、两页比较、临时待办、文案版本对比；当前为固定预置入口，不自动执行。
- 恢复页面入口明确标注为外部浏览器打开。

## 边界与安全

- 不重做浏览器、飞书文档、多维表格或 Dashboard。
- 不保存 Cookie / Token。
- Quick Note 未显式保留前只存在当前 Presentation 内。
- Workbench 仍是 Surface projection；没有新增数据库实体或 schema。
- Stage 4 的 Agent Composer / Receiver 连续性未开始。

## 修改文件

- `apps/web/src/features/workbench/WebWorkbench.tsx`
- `apps/web/src/features/spatial/components/WorkflowComponentRenderers.tsx`
- `apps/web/src/spatial-components.css`
- `docs/handoffs/2026-08-23-stage3-human-surface-workbench.md`

## 定向检查

- Web typecheck：通过
- `apps/web/tests/surfaceComponentFoundation.test.ts`：7/7 通过
- `git diff --check`：通过

完整浏览器、全栈 build、Golden Path 仍留到 Stage 5 统一执行。

## 未完成 / 下一步

- Routine 的 Project 持久化、真实 URL locator 与恢复上次活动页，需要后续接 Local Core 合约后再做。
- Agent Tool slots 当前是 UI 宿主，真实 Agent Composer / Receiver 留到 Stage 4。
- 不在本阶段增加动态工具市场或插件系统。

## 回滚

回滚本阶段提交即可，不触碰 Stage 1 / Stage 2 提交、Project Truth 或 Runtime。
