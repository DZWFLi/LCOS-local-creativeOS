# Handoff：Phase 1–3 解耦收口（2026-08-06）

## 任务摘要

按用户要求把“1→2→3”全部做完：Phase 1 结构拆分、Phase 2 契约与适配、
Phase 3 Gate W 前置。Phase 3（能力注册表 + created-Run 取消修复）此前已提交
`a163cbc`；本轮完成 Phase 1 全部与 Phase 2 主体。

## 实际范围

### Phase 1 — 前后端巨型文件拆分（行为不变）

- `apps/local-core/src/server.ts`：3014 行 → 670 行。全部路由块迁至
  `routes/*.ts`（13 个模块 + 共享 `route-context.ts` 与 `multipart.ts`），
  分发器保留健康检查、鉴权、模块调用、artifact-returns、entity、404 兜底。
- `apps/web/src/App.tsx`：JSX 展示层全部迁出，App 只留编排与 props 组装：
  - `features/shell/AppShellView.tsx`（Drive/TopBar/Scene/Rail/Dialogs 总装）
  - `features/shell/CanvasSceneHost.tsx`（Dock/Canvas/Mini-map/面包屑/浮层）
  - `features/shell/WorkRailHost.tsx`
  - `features/shell/DialogsHost.tsx`（14 类弹窗 + extraDialogs 逃生口）

### Phase 2 — 契约与适配

- `qa-fixtures` 退出生产路径：`createBlankProjectState` 迁至
  `state/projectState.ts`，App.tsx 不再引用 fixtures；边界测试防回引。
- `projectionAdapters` 覆盖测试（5 类投影）+ 适配层边界测试。
- 既有架构测试更新指向新路由/宿主文件（july-plan、resource-connector-port、
  v0.6/v0.7 契约测试等 14 处断言）。
- CSS 主题收敛按用户指示暂缓，未动。

### Phase 3 — 已完成项（沿用）

- `tools/lcos-runtime/capabilities.json` + 校验器 + dev-launcher 接线。
- created/planned Run 取消修复 + 回归测试。

## 修改文件

```text
apps/local-core/src/server.ts                          （拆分后 670 行）
apps/local-core/src/routes/                            （13 个新模块）
apps/web/src/App.tsx                                    （编排化）
apps/web/src/features/shell/AppShellView.tsx            （新）
apps/web/src/features/shell/CanvasSceneHost.tsx         （新）
apps/web/src/features/shell/WorkRailHost.tsx            （新）
apps/web/src/features/shell/DialogsHost.tsx             （新）
apps/web/src/state/projectState.ts                      （新）
apps/web/tests/projectionAdapters.test.ts               （新）
tests/architecture/qa-fixtures-boundary.test.ts         （新）
tests/architecture/projection-adapters-boundary.test.ts（新）
apps/web/tests/*（7 个契约测试指向新宿主）
tests/architecture/*（3 个契约测试指向新路由）
```

## 测试结果

```text
npm run check:fast
  lint ✅ / typecheck ✅（web + local-core + domain + contracts）
  web tests 134/134 ✅ / local-core tests 252/252 ✅
  architecture 69/69 ✅ / web build ✅
npm run smoke:gatef-core ✅（schema + capabilities + 全链路）
真实 HTTP 抽查（12 条代表性路由，覆盖全部新模块）全部 200 ✅
```

## 浏览器 / Runtime 验证

dev 栈已更新到本分支最新代码并重新拉起：

- Local Core `127.0.0.1:43121`（token：`devsmoke-token`）
- Light Bridge `127.0.0.1:43122`
- Web `127.0.0.1:5173`

注意：这三个进程是 detached 启动，不受 `npm run dev:stop` 管理；要停用请
`Stop-Process` 对应 PID（core 20892 / bridge 1944 / web 36424），或后续用
launcher 正常方式重启。

## 风险与未完成

- App.tsx 仍约 2930 行（编排逻辑为主）；若继续拆分，建议下一步把
  canvas/runtime 回调组抽成 `useCanvasRuntime()` 等 hooks，属行为变更级重构，
  需单独审批。
- `compose.ts`（服务装配收敛）未做——当前服务创建仍在 `createLocalCoreServer`
  内，可作为 Gate W 前置的下一个切片。
- qa-fixtures 目录保留在 `apps/web/src/qa-fixtures/`，仅供测试引用；若希望
  从源码树彻底移出（如 `tests/fixtures`），需要移动 + 改测试 import。
- CSS 三套并存（v07/v071/porcelain）仍待用户批准后收敛。
- 前端 host 拆分后建议在真实浏览器里按 Golden Path 过一遍交互（本轮验证以
  typecheck/build/契约测试 + 运行时 HTTP 为准，未做逐项点击验收）。

## 回滚

全部提交可单独 revert：`3069c3c eaf754f 8f6033a 9397a93 03eb9c0 102d2b2`，
均为行为不变的机械外迁；回滚后重跑 `npm run check:fast` 即可。
