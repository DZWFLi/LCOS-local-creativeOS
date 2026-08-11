# Phase C Handoff｜Capture Plane + Preview Completion

> 日期：2026-08-11
> 施工包：LCOS A-H FINAL V2.2（00_MASTER_AH_FINAL_V2.md）
> 完成标准：05_PRODUCTION_COMPLETION_DOCTRINE

---

## Completed

Phase C 目标：把 Eagle/流光证明有效的"工作现场 Capture"正式接进 LCOS。本轮完成：

1. **Capture 契约**（C1/C2）：`CaptureRequestV0`（9 种 kind + 4 种 payload）+ `CaptureReceiptV0`（created/reused/staged/failed）。
2. **CaptureApplicationService**（C3）：幂等（operationId → receipt 落 SQLite）→ Affinity → 高置信直接进项目 / 不确定进 Staging；热路径不等 LLM/Ollama。
3. **真实入口 `POST /capture`**（C7）：loopback + Bearer 全局保护；text / url / local_path / staged_blob 四种 payload 全部真实导入（text→Text Artifact、url→Resource 导入、file/blob→文件导入；scope 自动取项目 root scope，spawn 位置常量待 Phase D Presentation Engine 接管）。
4. **Extension Token 配对**：`POST /runtime/extension-token`（幂等，需已有 Core token 才能取）→ 扩展弹窗粘贴一次。
5. **Browser Extension**（C4-C6）：`apps/browser-extension/` MV3 最小权限（activeTab/contextMenus/storage/notifications；host 仅 127.0.0.1）；右键网页/图片/链接/选中文字 + `Alt+Shift+S` 快捷键 + popup 配对与手动保存；不监听所有浏览行为、不扒 Web Chat。
6. **Capture Watch**（C11/C12）：`CaptureWatchService` + `capture_watch_rules` 表（v27）；轮询扫描 + settle 算法（两次扫描间 size/mtime 不变才提交）；规则 CRUD API；服务随 Core 启动（unref，不阻塞退出）。
7. **CLI**：`lcos capture send --url/--text/--file [--title] [--session] [--project]`、`lcos runtime extension-token`。

**Preview 主线核查**（C15-C20）：`CanvasNodeVisual` 已使用 `visualFamilyFor` + `previewUrl/previewDataUrl` 缩略图渲染，`ImmersiveViewer` 两级预览已存在 —— 本轮不重复实现；剩余收口（ResourceDetailDialog 用户文案、ImmersiveViewer 更多类型）列入 Phase H。

## Backend / Runtime

新增：

- `apps/local-core/src/capture-application-service.ts`
- `apps/local-core/src/capture-watch-service.ts`
- `apps/browser-extension/`（manifest + service-worker + capture-client + popup + README）
- `scripts/phase-c-smoke.mjs`

修改：

- `packages/contracts/src/capture.ts`（CaptureRequestV0 / ReceiptV0 / WatchRuleV0）
- `apps/local-core/src/metadata-repository.ts`（v26 receipt 表、v27 watch 表 + CRUD）
- `apps/local-core/src/runtime-registry-service.ts`（extensionToken）
- `apps/local-core/src/compose.ts` / `server.ts`（capture/watch 装配 + 5 个路由 + watch 启停）
- `tools/lcos-agent/cli.mjs`（capture send / runtime extension-token）

## GUI / Frontend

本轮无前端改动（Capture 主入口在浏览器扩展与 CLI；GUI 触达沿用 Phase B 的"最近捕获"计数，Quick Capture 弹窗待 Phase D/H）。

## CLI

`lcos capture send` / `lcos runtime extension-token`；输出 JSON。

## Node / Relation / Presentation semantics

- Capture 的 node 导入后进入 root scope 的 spawn zone（常量 {480,240}，代码注释标注：Phase D Presentation Engine 接管后由引擎决定，Agent/Extension 不传 x/y）。
- Staged 项不建节点，等 resolve 后由 Curator/下一轮 Capture 处理。

## Ollama / Local Intelligence impact

Capture 热路径不碰 Ollama（C26 不做语义匹配参与 Capture）。semantic hint 仍留 Phase F。

## Files changed

- contracts 1 改；core 2 新 + 5 改；browser-extension 7 新；CLI 1 改
- 测试：`capture-application-service.test.ts`（4 用例）、`capture-watch-service.test.ts`（3 用例）
- smoke：`scripts/phase-c-smoke.mjs`（7 项真实 HTTP 全过）

## Contracts frozen

- `CaptureKindV0` / `CaptureRequestV0` / `CaptureReceiptV0` / `CaptureWatchRuleV0`
- HTTP：`POST /capture`、`POST /runtime/extension-token`、`GET/POST/DELETE /runtime/capture-watch/rules`
- CLI：`lcos capture send` / `lcos runtime extension-token`

## Migrations

- SQLite `user_version` 26 → 27：`capture_receipts`（v26）、`capture_watch_rules`（v27）。

## Tests

- Core：65 文件 / 322 用例全过（新增 7）
- `node scripts/phase-c-smoke.mjs`：text capture（affinity direct）、幂等 receipt、explicit targetHint、staged blob、extension token 幂等、watch rules CRUD、坏 body 400 —— 全过

## Manual evidence

- 真实 Core（独立端口/DB/blob）全链路跑通。
- 浏览器扩展尚未在真实 Chrome/Edge 加载验证（需要用户安装 + 配对）；API 契约与 capture-client 已在 smoke 中覆盖等价路径。

## Source references actually used

- `phases/PHASE_C_CAPTURE_PREVIEW.md`（C1-C26）
- Eagle extension 权限模型（最小权限借鉴）
- `sources/research/` 流光截图（网页/截图直接进画布）

## Compatibility still present

- 旧 DB 自动迁移 v27；旧前端/CLI 不受影响。
- `POST /capture` 独立于现有 imports 路由，不破坏既有导入流程。

## Explicitly NOT implemented

- ❌ Native Messaging（C8：Phase J 再评估）
- ❌ Desktop Quick Capture 全局快捷键弹窗（C9：GUI 侧 Phase D/H；Runtime 能力 foundation 已有）
- ❌ 剪贴板自动监听（C10：解析器逻辑简单，但需要桌面 shell 事件源，Phase J）
- ❌ Preview 新一轮施工（既有实现已覆盖主线；收口列 Phase H）
- ❌ Web Chat 深度捕获（Phase G 专门处理）

## Next risks

1. Extension 需要真实浏览器加载验收：token 配对流程依赖用户粘贴，Phase H 统一做真人验收；如果体验不佳，可在 Phase J 换 native messaging。
2. spawn zone 常量：多个 Capture 连续导入会重叠在同一点；Phase D 布局引擎接管前可接受（Presentation Engine 本来就是 Phase D 主线）。
3. watch 轮询 2s：低开销（unref），但规则目录不可读时静默跳过；Phase I 资源治理时统一看日志策略。

## Commit

提交将在本 Handoff 完成后执行（见 git log）。

