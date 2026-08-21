# LCOS Phase 5 Slice 2 Handoff — Staging 面板 + 建项目

## Status
SLICE COMPLETE；PHASE 5 = NOT COMPLETE（继续 Slice 3：扩展/桌面）

## Scope implemented

- Staging 查询参数（search/kind/limit）+ web client 透传。
- `StagingDialog`：时间分组、搜索/筛选、多选、批量分配项目、URL 预览、用选中项创建项目。
- `StagingProjectService` + `POST /runtime/captures/create-project`（校验/建项目/导入/标记 resolved/失败回滚）。

## Files changed

- `apps/local-core/src/metadata-repository.ts`（getCaptureStagingItem）
- `apps/local-core/src/staging-project-service.ts`（新增）
- `apps/local-core/src/server.ts`（create-project 路由）
- `apps/web/src/runtime/localCoreClient.ts`（captureStaging options + createProjectFromStaging）
- `apps/web/src/features/capture/StagingDialog.tsx`（新增）
- `apps/web/src/features/project/ProjectDrive.tsx`、`features/shell/AppShellView.tsx`、`DialogsHost.tsx`、`App.tsx`（入口与接线）
- `apps/web/src/reconstruction.css`
- 测试：`staging-project-service.test.ts`（2）、`phase5Slice2Contract.test.ts`（3）

## Contract changes
- 无新 Core 实体；新增 `/runtime/captures/create-project` 命令。

## State ownership
- 项目真相：Core projects + root scope + Main workspace + 导入的 artifacts。
- Staging 归属：capture_staging_items.resolved_project_id。

## Failure behavior
- 缺失/已归属捕获拒绝；创建失败回滚项目与目录。

## Restart evidence
- Core restart 后路由可用。

## Targeted tests
- 全量 web 358/358、core 379/379、lint/typecheck/build 绿。

## Browser flow tested
1. 项目主页暂存卡片（3 项）→ 点击打开面板
2. 分组/列表/搜索/筛选/分配/创建入口可见，无控制台错误
3. 截图存档

## Screenshots
- `docs/audit/phase5-staging-dialog-1440x900.png`

## Visual review
VISUAL ACCEPTANCE PENDING

## Hidden-debt scan
已扫；无本轮新增。

## Remaining Debt（Phase 5 Slice 3）
- MV3 浏览器扩展（popup / context menu / 拖拽 dock / 截图）
- 桌面快速捕获（全局快捷键 / 文件 / 剪贴板）
