# LCOS Stage 4 施工交接：Agent Surface Composer + Receiver Continuity

## 任务摘要

基于 `9d68629`，执行 Stage 4 的安全前端部分：让 Agent 使用与人相同的 Surface Catalog / SurfaceIntent / SurfaceOps 路径，并提供可预览、可保留的 Composer。

## 实际范围

- 新增 `AgentSurfaceComposer`：选择受控 intent、生成预览、显式保留。
- 增补 routine / workbench / quick-note / agent-tool / collapse 的声明式 intent 类型。
- `resolveSurfaceIntent` 继续调用 Catalog、几何放置和 SurfaceOps 边界；不输出任意 HTML、CSS 或像素坐标。
- `restore-routine`、`save-current-routine`、`open-page-set`、`foreground-page`、`continue-from-current` 当前没有真实 runtime capability，因此保持空操作 fail-closed。
- Workbench 内嵌 Composer 入口，仍不自动执行 Agent。

## Receiver 边界

仓库当前没有可确认的 `setActiveReceiver / sendToReceiver` 真实 runtime capability。本阶段没有用 fixture 冒充；Receiver GUI 连续性记录为 blocked capability，留待真实合约出现后接线。

## 修改文件

- `apps/web/src/features/spatial/model/surfaceIntent.ts`
- `apps/web/src/features/surfaces/AgentSurfaceComposer.tsx`
- `apps/web/src/features/workbench/WebWorkbench.tsx`
- `apps/web/src/spatial-components.css`
- `apps/web/tests/surfaceComponentFoundation.test.ts`
- `docs/handoffs/2026-08-23-stage4-agent-composer.md`

## 定向检查

- Web typecheck：通过
- `apps/web/tests/surfaceComponentFoundation.test.ts`：8/8 通过
- `git diff --check`：通过

完整浏览器、全栈 build、Receiver 真实 E2E 和 Golden Path 按施工地图留到 Stage 5 后统一验收。

## 未完成 / 下一步

- Receiver 需要真实 runtime contract 后才能实现 active chip、one-off send 和 successor handoff。
- Routine 的真实 URL locator / Local Core 持久化仍未接入。
- Stage 5 再统一处理 Spatial Signal Language 与 Layout Brain Skill。

## 回滚

回滚本阶段提交即可，不触碰前 3 个阶段、Executor 或 Bridge。
