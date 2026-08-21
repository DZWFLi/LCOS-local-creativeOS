# Phase 5 Slice 2 — Staging 面板 + 从暂存创建项目 Completion Audit

> 依据：`LCOS_FINAL_GUI_CAPTURE_PHASE_1_5_PLAN_V2` §8.10 / §8.11。
> 日期：2026-08-12

## Status
SLICE COMPLETE（FUNCTIONAL QA PASS / VISUAL ACCEPTANCE PENDING）
Phase 5 整体：NOT COMPLETE（剩余：MV3 浏览器扩展、桌面快速捕获、截图 dock）

## Acceptance Evidence

### Staging query model（§8.10 子集）
Code: `GET /runtime/captures/staging` 支持 recent/search/kind/limit；web client 透传。
Live: `?search=gateway` 命中；面板加载 3 项。
Result: DONE

### Chronological groups + multi-select + assign
Code: `StagingDialog`（今天/昨天/日期分组、搜索、类型筛选、多选、分配项目=resolveCaptureStaging 批量、预览打开 URL）。
Browser: 面板打开 → 1 组 3 项，无控制台错误。
Result: DONE

### Create project from capture（§8.11）
Code:
- `metadata.getCaptureStagingItem`。
- `StagingProjectService`：校验存在/未归属 → `createProjectRoot` + `metadata.createProject`（含 root scope + Main workspace）→ 按 payloadRef 导入（url/text blob/图片 blob/本地路径）→ `staging.resolve` → 失败回滚项目与目录。
- `POST /runtime/captures/create-project`。
Tests: 文本捕获建项目+落库+标记 resolved；缺失 id/已归属拒绝。
Result: DONE

## Failure injection
- 缺失 capture id、已归属捕获 → 结构化拒绝。
- 项目创建中途失败 → deleteProject + rollback 目录。
Result: PASS

## Restart evidence
- Core restart 后 create-project 路由可用（编译+测试链路）。

## Browser evidence
- 截图：`docs/audit/phase5-staging-dialog-1440x900.png`
- 面板：卡片「3 项等待整理」→ 对话框分组/列表/无报错

## Visual review
VISUAL ACCEPTANCE PENDING

## Hidden-debt scan
改动文件关键词扫描：无本轮新增。

## Remaining Debt（Phase 5 剩余）
- MV3 浏览器扩展（popup / context menu / 拖拽 dock / 截图）
- 桌面快速捕获（全局快捷键 / 文件 / 剪贴板）
- 截图 dock 内容脚本
