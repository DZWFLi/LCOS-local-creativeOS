# Phase 2 Completion Audit

> 依据：`LCOS_FINAL_GUI_CAPTURE_PHASE_1_5_PLAN_V2_REFERENCES_CODE_GATES_20260812.md` §5 Phase 2。
> 日期：2026-08-12

## Status
COMPLETE（FUNCTIONAL QA PASS / VISUAL ACCEPTANCE PENDING）

## Acceptance Evidence

### Item 1 — relation-first fixture uses ELK/fCoSE correctly
Requirement: 布局路由按拓扑选择 elk-directed / fcose-relation / manual。

Code:
- `apps/web/src/features/layout/layoutService.ts`：`chooseRelationFirstLayoutMode`（directedRatio≥0.6 或 hierarchy → elk；其余有边 → fcose；自由/无边 → manual），`chooseLayoutStrategy` 接入 arrange 管线。
- 外部引擎（elk/fcose）作为懒加载细化器沿用既有 `loadPresentationLayoutEngines`；内置同步布局作为离线兜底。

Tests:
- `apps/web/tests/layoutRouterAndQuality.test.ts`：有向链 → layered；reference 图 → relational；free/无边 → manual；fixture 排布后 crossings=0 / overlap=0 / pinned drift=0。
Result: DONE

### Item 2 — edge crossing metric recorded
Code: `apps/web/src/features/layout/layoutQuality.ts`（`measureLayoutQuality`：crossings/backwardEdges/totalEdgeLength/overlappingNodes/pinnedNodeDrift）。
Tests: 交叉/反向/重叠/漂移计数夹具 + 干净布局全零。
Result: DONE

### Item 3 — pinned nodes unchanged
Code: `preserveManualAnchors` 既有策略 + 质量指标 pinnedNodeDrift；夹具断言 drift=0。
Result: DONE

### Item 4 — open local file
Code:
- `apps/local-core/src/os-integration.ts`：`openRegisteredPath`（注册路径 + 存在性校验）。
- `apps/local-core/src/routes/artifacts.ts`：`POST /artifacts/:id/open`。
- `apps/web/src/runtime/localCoreClient.ts` + `App.tsx`（`openNative` 由占位提示改为真实调用）。
Browser/HTTP evidence: `POST /artifacts/golden-img-01/open` → `{ ok: true, opened: true }`（真实拉起系统默认程序）。
Result: DONE

### Item 5 — reveal file in Explorer
Code: `revealRegisteredFile`（`explorer.exe /select`）+ `POST /artifacts/:id/reveal`。
Evidence: HTTP 实测 `{ ok: true, revealed: true }`。
Result: DONE

### Item 6 — copy path
Code: `GET /artifacts/:id/source-path` + `copySourcePath`（clipboard，失败回退显示路径）。
Evidence: 浏览器点击「复制路径」→ 提示路径（headless 无剪贴板权限时走回退提示；真实浏览器走剪贴板）。
Result: DONE

### Item 7 — open URL
Code: 节点信息面板「浏览器打开」沿用 `window.open`（URL 节点）。
Result: DONE（既有能力，未回退）

### Item 8 — shortcut open/relink
Code:
- `resolveShortcutTarget`（WScript.Shell，Base64 传输解决中文路径乱码）。
- `relinkArtifactSource`（artifacts.local_path + file_records.observed_path 事务更新）。
- `POST /artifacts/:id/shortcut-resolve` / `POST /artifacts/:id/relink`。
- NodeInfoPopover：`.lnk` 失效 → 「来源已失效」+ 重新链接输入。
Evidence（真实 .lnk 闭环）：
- 有效快捷方式 → resolvedTarget 正确（含中文路径）、targetExists=true。
- 失效快捷方式 → targetExists=false（来源已失效路径）。
- relink 后源路径持久化并还原。
Result: DONE

### Item 9 — Change Trace from real revisions/provenance
Code: `apps/web/src/features/trace/changeTrace.ts`（确定性联接 revision/provenance/run，不提取隐藏推理链）+ Workbench 版本页「变更轨迹 · 内容 / 来源 / 历史」。
Tests: `apps/web/tests/changeTrace.test.ts`（actor/action/reasonSummary/sourceRefs/runId 断言）。
Browser evidence: 真实节点版本页渲染「V1 · 用户 · 2026/8/11 19:44:52」。
Result: DONE

### Item 10 — no hidden chain-of-thought
Code: `buildChangeTrace` 只读 revision/provenance 字段；测试断言输出不含 thought。
Result: DONE

### Item 11 — source identity survives Core restart
Evidence: relink 事务落库，reopen repository 后路径保持（`metadata-repository.test.ts`）；Core 重启后 source-path 仍返回原路径。
Result: DONE

## Failure injection

- 非绝对路径 relink → 结构化 `INVALID_ARGUMENT`（"Relink requires an existing absolute local path."）。
- 非 .lnk shortcut-resolve → 结构化 `INVALID_ARGUMENT`。
- 缺失文件路径 open → `Path does not exist` 错误路径（os-integration 存在性守卫）。
- 快捷方式失效 → `targetExists:false`，UI 显示「来源已失效」，不假装可用。
Result: PASS

## Restart / reload evidence

- Core restart（restart-core.ps1，PID 34760）后 Source actions 可用；relink 持久化。
- 浏览器 reload 后节点信息面板 Source 按钮保持。
Result: PASS

## Browser evidence

- 节点信息面板动作条：打开 / 定位 / 复制路径（headless 实测）。
- Workbench 版本页 Change Trace：`docs/audit/phase2-change-trace-1440x900.png`。
- 整理入口面板：`docs/audit/phase2-layout-reorganize-1440x900.png`。
- 主界面：`docs/audit/phase2-shell-1366x768.png`。
- Source 端点 HTTP 实录（open/reveal/source-path/relink/shortcut-resolve）。

## Visual review
VISUAL ACCEPTANCE PENDING

## Hidden-debt scan
关键词扫描覆盖全部 Phase 2 改动文件：命中均为既有合法用途（placeholder 属性、真 fallback 参数、DB CHECK 约束名），无本轮新增。

## Discovered Debt
无本轮新增（.lnk 解析的 PowerShell 编码问题已在本轮修复并复验）。

## Remaining Debt
NONE
