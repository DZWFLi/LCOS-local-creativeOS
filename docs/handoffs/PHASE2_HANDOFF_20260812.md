# LCOS Phase 2 Handoff

## Status
COMPLETE（FUNCTIONAL QA PASS / VISUAL ACCEPTANCE PENDING）

## Scope implemented

- 关系优先布局路由（elk-directed / fcose-relation / manual）接入 arrange 管线。
- 布局质量指标 `measureLayoutQuality`（crossings / backward / length / overlap / pinned drift）。
- 真实 Source actions：打开、资源管理器定位、复制路径、快捷方式解析与重新链接（原 `openNative` 占位已替换）。
- Change Trace 投影（内容 / 来源 / 历史）接入 Workbench 版本页。

## References studied
- 计划 §5（Phase 2 规格与验收）、既有 layout 引擎基建、os-integration、artifacts 路由、revisionList/provenance。

## LCOS-native decisions

ADOPT:
- 路由阈值（0.6 directedRatio / hierarchy）作为产品调优参数，用测试夹具钉住。
- Source 路径解析以 file_record 优先、artifacts.local_path 兜底；URL 与本地文件分流。
- 快捷方式目标解析只读、Base64 传输避免编码损坏。

ADAPT:
- 计划中的 `SourceActionAdapter` 以 Core 路由 + Web handler 实现，不新增抽象层。
- ChangeTraceEntry 直接由 revision/provenance 投影，不新建实体。

KEEP LCOS:
- 外部布局引擎是离线兜底之上的细化器；不强制网络依赖。
- Relink 只改路径归属与可用性，不动 Artifact 内容/Revision。

REJECT:
- 不新增 ThoughtProcess / WorkflowStage 等业务实体。

## Files changed

- `apps/web/src/features/layout/layoutService.ts`（路由）
- `apps/web/src/features/layout/layoutQuality.ts`（新增，质量指标）
- `apps/web/src/features/trace/changeTrace.ts`（新增，Change Trace 投影）
- `apps/web/src/features/workbench/ArtifactWorkbench.tsx`（变更轨迹 UI）
- `apps/web/src/features/canvas/NodeInfoPopover.tsx`（Source actions + 失效/重新链接）
- `apps/web/src/runtime/localCoreClient.ts`（5 个 Source action 方法）
- `apps/web/src/App.tsx`（真实 openNative/reveal/copy/relink + 快捷方式解析）
- `apps/local-core/src/os-integration.ts`（open / revealFile / shortcut resolve）
- `apps/local-core/src/metadata-repository.ts`（getArtifactSourcePath / relinkArtifactSource）
- `apps/local-core/src/routes/artifacts.ts`（5 个 Source action 路由）
- 测试：`layoutRouterAndQuality.test.ts`、`changeTrace.test.ts`、`phase2SourceAndTraceContract.test.ts`、`runtimeBridge.test.ts`、`metadata-repository.test.ts`

## Contract changes
无新 Core 实体/表；新增 5 个 artifacts 子路由（open/reveal/source-path/relink/shortcut-resolve）。

## State ownership
- 源路径真相：Core `file_records.observed_path`（优先）与 `artifacts.local_path`（兜底）。
- Relink 事务同时更新两者，持久化到 SQLite。

## Persistence behavior
- relink 落库，reopen/Core 重启保持。

## Failure behavior
- 结构化 INVALID_ARGUMENT（非法 relink / 非 .lnk resolve）。
- 缺失文件：os-integration 存在性守卫返回失败，不静默。
- 失效快捷方式：targetExists=false → UI「来源已失效」+ 重新链接。

## Restart evidence
- Core restart 后 Source actions 可用；relink 持久化复验。

## Targeted tests
- web：layoutRouterAndQuality（7）、changeTrace（1）、phase2 contract（3）、runtimeBridge。
- core：metadata-repository source-path/relink。

## Full relevant regression
- web 326/326、core 367/367、lint/typecheck/build 全绿。

## Browser flow tested
1. 节点信息面板出现 打开/定位/复制路径
2. 复制路径提示
3. Workbench 版本页 Change Trace 渲染
4. 整理入口面板打开
5. HTTP：source-path / open / reveal / relink / shortcut-resolve（有效+失效+还原）

## Screenshots
- `docs/audit/phase2-change-trace-1440x900.png`
- `docs/audit/phase2-layout-reorganize-1440x900.png`
- `docs/audit/phase2-shell-1366x768.png`

## Visual review
VISUAL ACCEPTANCE PENDING

## Hidden-debt scan
已扫（见 audit），无本轮新增。

## Discovered Debt
无。

## Remaining Debt
NONE
