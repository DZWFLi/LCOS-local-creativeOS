# Phase 4 Slice 2 — Workflow Strip + 导出/导入 Completion Audit

> 依据：`LCOS_FINAL_GUI_CAPTURE_PHASE_1_5_PLAN_V2` §7.4 / §7.6 / §7.7。
> 日期：2026-08-12

## Status
SLICE COMPLETE（FUNCTIONAL QA PASS / VISUAL ACCEPTANCE PENDING）
Phase 4 整体：FUNCTIONAL COMPLETE（端口连线/视觉项待人工验收，见 Remaining Debt）

## Acceptance Evidence

### Right workspace strip（§7.4）
Code: `WorkflowSurface` 右侧 `.lcos-workflow-workspace-strip`：标题 + 成员数 + 上移/下移 + 把选中加入 + drop（text/plain）加入。
Reorder 持久化：复用 Phase 1 `reorder_workspaces` mutation（Core sort_index）。
Result: DONE（重排持久化已有 Phase 1 全链路证据）

### No Stage semantics / no mandatory Skill
Code: strip 只表达子现场（title/memberCount/order），无 Stage 状态；导入导出不要求 Skill。
Result: DONE

### Export workflow（§7.6）
Code:
- `workflow-export-service.ts`：manifest.json + workflow.json（members/workspaces/edges/operators）+ references.json，`buildZip`（STORE + CRC32）。
- `GET /projects/:id/workflow/export?scopeId=…` → application/zip。
Tests: roundtrip fixture（导出 → 解析断言内容）。
Live: HTTP 200 / application/zip / 1973 bytes（Golden 项目）。
Result: DONE

### Import workflow + exact roundtrip
Code: `import()` 校验 schemaVersion=1/kind、成员唯一、边引用成员、workspace id 唯一、引用存在、operator 分支目标为成员；写入 workspaces + workflow presentation（CAS）。
Tests: 导出 → 导入 → presentation 成员/边/operators 一致；workspace 落库。
Result: DONE

### Failure paths
Tests: 未知 schema、重复 workspace id、缺失 reference、边引用非成员 → 结构化拒绝。
Result: PASS

## Browser evidence
- 导出端点 HTTP 实录（200/zip）。
- Strip/导出/导入按钮与端口连线视觉验收待人工（叠层命中问题部分修复，见 Phase 4 Slice 1 Debt）。

## Visual review
VISUAL ACCEPTANCE PENDING

## Hidden-debt scan
改动文件关键词扫描：无本轮新增。

## Remaining Debt
- 端口连线浏览器级最终 QA + 工作流表面叠层视觉验收（人工/UI）
- Strip 拖放/按钮的人工视觉复核
