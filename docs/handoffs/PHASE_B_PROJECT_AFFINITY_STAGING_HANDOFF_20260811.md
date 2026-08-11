# Phase B Handoff｜Project Access + Project Affinity + Staging

> 日期：2026-08-11
> 施工包：LCOS A-H FINAL V2.2（00_MASTER_AH_FINAL_V2.md）
> 完成标准：05_PRODUCTION_COMPLETION_DOCTRINE

---

## Completed

Phase B 目标：解决 Capture / Agent 动作前"先选 Project"的额外层。本轮完成：

1. **ProjectAffinity 契约**（B2）：`packages/contracts/src/project-affinity.ts`（Input / Reason / Candidate / Result）+ `capture.ts`（CaptureStagingItemV0）。
2. **确定性 Resolver**（B3-B9）：规则顺序 explicit(1.0) > session_bound(1.0) > path_inside_root(1.0) > browser_tab_bound(0.98) > pinned_capture_target(0.99) > recent_focus(0.9/0.82/0.75 按时间衰减) > recent_project(0.55 仅候选)；semantic_hint 只留契约槽，Phase F 前不激活。评估时刻 = capturedAt（capture 发生时语义）。
3. **Capture Staging Buffer**（B10-B14）：schema v25 `capture_staging_items` 表；大文件 blob 落 `~/.lcos/capture-staging/blobs/<sha256>`（hash 去重，SQLite 不存 binary）；enqueue / listRecent / countPending / resolve（幂等：重复 resolve 返回 404）。
4. **真实 API**：`POST /runtime/affinity/resolve`、`POST /runtime/captures/staging`、`GET /runtime/captures/staging?recent=`、`POST /runtime/captures/:id/resolve`、`POST /runtime/registry/browser-tab`（真实持久化 tab→project 绑定，不是拿 lastFocused 顶替）。
5. **CLI**（B17）：`lcos affinity resolve --explicit/--session/--path/--tab`、`lcos capture pending [--recent 30m]`、`lcos capture resolve <id> --project <id>`、`lcos project pin-capture / unpin-capture / reveal`。
6. **GUI 轻量触达**（B13）：Project Home 显示"最近捕获 · N 项等待整理"计数（纯展示，不造假按钮；管理动作 Phase C 接 Quick Capture）。

## Backend / Runtime

新增：

- `packages/contracts/src/project-affinity.ts` / `capture.ts`（+ index.ts re-export）
- `apps/local-core/src/project-affinity-service.ts` —— 确定性 resolver（无状态纯函数）
- `apps/local-core/src/capture-staging-service.ts` —— staging + blob 存储

修改：

- `apps/local-core/src/metadata-repository.ts` —— schema v25；createCaptureStagingItem / listCaptureStagingItems / countPendingCaptureStagingItems / resolveCaptureStagingItem
- `apps/local-core/src/path-guard.ts` —— 导出 `isContained` / `canonicalComparisonPath`（复用同一 canonicalizer，不重造）
- `apps/local-core/src/runtime-registry-service.ts` —— browserTabBindings（持久化 + set/clear/resolve）
- `apps/local-core/src/compose.ts` / `server.ts` —— 5 个新路由 + 服务装配

## GUI / Frontend

- `apps/web/src/runtime/localCoreClient.ts` —— captureStaging / affinityResolve / resolveCaptureStaging 三个方法
- `apps/web/src/App.tsx` —— Project Home 打开时拉取 pendingCount
- `apps/web/src/features/project/ProjectDrive.tsx` / `AppShellView.tsx` / `surface.css` —— "最近捕获"轻量卡片

## CLI

见 Completed #5；全部走 Core HTTP，输出 JSON，无重复逻辑。

## Node / Relation / Presentation semantics

- Affinity 不是 Project Truth：只回答"这个动作最可能属于哪个项目"，落 registry（runtime preference）。
- Staging 是 transport buffer 不是 Inbox domain：resolve 后只写 resolved_project_id，不建节点/关系（那是 Phase C Capture 的活）。
- 评估时刻 = capturedAt：capture 发生时 resolve，而不是服务端响应时刻（保证可复现、可测试）。

## Ollama / Local Intelligence impact

semantic_hint 契约已留槽，B 阶段 resolver 显式不激活（B9）。Phase F 激活时只需在 resolver 增加一个候选源。

## Files changed

- contracts 2 新文件 + index.ts
- core 2 新服务 + 4 处修改
- web 3 处修改
- CLI 1 处修改
- 测试：`project-affinity-service.test.ts`（12 用例）、`capture-staging-service.test.ts`（5 用例）
- smoke：`scripts/phase-b-smoke.mjs`（6 项真实 HTTP 全过）
- 5 个既有测试文件 schemaVersion 24→25 快照更新

## Contracts frozen

- `ProjectAffinityInputV0` / `AffinityReasonV0` / `ProjectAffinityResultV0` / `ProjectAffinityCandidateV0`
- `CaptureStagingItemV0`
- HTTP：`POST /runtime/affinity/resolve`、`POST/GET /runtime/captures/staging`、`POST /runtime/captures/:id/resolve`、`POST /runtime/registry/browser-tab`
- CLI：`lcos affinity resolve` / `lcos capture pending|resolve` / `lcos project pin-capture|unpin-capture|reveal`

## Migrations

- SQLite `user_version` 24 → 25：`capture_staging_items` 表 + captured_at 索引。

## Tests

- Core：63 文件 / 315 用例全过（新增 17）
- Web：60 文件 / 274 用例全过
- `node scripts/phase-b-smoke.mjs`：recent_focus → A；path 压过 pinned；explicit；browser tab 绑定/清除；staging enqueue/pending/resolve + 重复 resolve 404 —— 全过

## Manual evidence

- 真实 Core（独立端口 43132 + 独立 DB + 独立 registry/blob 目录）跑通全流程。
- 未做真人 GUI 点击验收（计数卡片显示），列入 Phase H。

## Source references actually used

- `phases/PHASE_B_PROJECT_AFFINITY_STAGING.md`（B1-B21）
- Zero-Front-Door §8-§9（Affinity 优先级 / Staging UX）
- Late-Binding §9（provisional project 原则，Phase B 未做创建但契约方向一致）
- `sources/research/LCOS_GUI_SURFACE_SKILL_GAP_INVENTORY_20260811.md` §9.2/9.3

## Compatibility still present

- 旧 DB 自动迁移 v25；旧前端不受影响（新 client 方法可选）。
- `explicitProjectId` 保持最高优先级，GUI 未来接 Quick Capture 时"选项目"仍可用，但不再是必选。

## Explicitly NOT implemented

- ❌ Semantic affinity（Phase F）
- ❌ 正式 Browser Extension / Capture Gateway（Phase C）
- ❌ Quick Capture 弹窗 / Tray 计数 UI（Phase C + 保持现有 tray 脚本）
- ❌ provisional project 快速创建（B15：契约方向已留；等 Phase C Capture 入口真正需要时接）
- ❌ `lcos capture enqueue` CLI（Capture 入口属于 Phase C，避免提前造半吊子入口）

## Next risks

1. Staging 表会随时间增长：resolve 后条目仍保留（有 resolved_at 可清理），Phase I 资源治理时补 TTL 清理。
2. browserTabBindings 目前只能由 API 写入：真实浏览器扩展（Phase C）接入后才有数据来源；在此之前 resolver 的 tab 分支靠测试覆盖。
3. GUI 计数只在 Project Home 打开时拉一次：Tray 计数等 Phase C 的 Capture 事件流一起做，避免重复轮询。

## Commit

提交将在本 Handoff 完成后执行（见 git log）。

