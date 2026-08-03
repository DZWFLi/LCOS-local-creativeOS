# Slice E Handoff：右侧 Artifact Workbench + Viewer Registry

> 日期：2026-08-03
> 分支：`codex/backend-hardening-20260802`
> 任务：`task_702b2800`（Codex 接管执行）
> Commit：`77f6eb4`

## Decision

Slice E 完成：右侧中部新增单实例 Artifact Workbench（默认关闭、预览⇄概览局部导航、Esc 关闭）；统一只读 Viewer Registry（图片/文本/PDF/PPTX/音视频/Link/Fallback）；双击文件节点打开右侧预览、双击 Scope 节点仍进入一度关系（冻结交互保留）；Editor Host 只预留接口，不实现假编辑器。

## Exact files

- `apps/web/src/features/viewer/artifactViewerRegistry.tsx`（新增）：`resolveArtifactViewerKind`（按 fileType/扩展名/previewText 判型）、`artifactViewerRegistry` 描述表、`ArtifactViewerHost` 统一入口、8 类 Viewer、`ArtifactEditorHost` 接口预留（`artifactEditorHost = null`，诚实未实现）
- `apps/web/src/features/workbench/ArtifactWorkbench.tsx`（新增）：右侧固定面板，preview/overview 双视图，元数据 + 定位 + 资源理解动作，data-testid 可测
- `apps/web/src/App.tsx`：`previewNodeId` Modal 状态替换为 `workbench`；双击路由（Scope→enterScope / 文件→workbench）；Esc 链加入工作台；NodeInfoPopover「只读预览」改走工作台；定位用 `revealNode`
- `apps/web/src/features/preview/DocumentPreviewDialog.tsx`（删除）：PDF/PPTX 渲染逻辑移入 Registry 的 `DocumentViewer`，不再有独立 Modal 路径
- `apps/web/src/surface.css`：工作台/Viewer 样式（右侧 344px、最大化 52vh 图、PDF iframe、fallback 元数据网格）
- 测试：`artifactWorkbench.test.ts`（新增 4 例结构锁定）、`v06InteractionContract.test.ts`（双击断言适配多行分支）

## Schema

无迁移、无新依赖（PptxViewer 为既有依赖）。

## Before / After flow

```text
Before: 双击非 Scope 节点无动作；PDF/PPTX 走独立 Modal；图片/文本预览散在卡片；
        无统一 Viewer 入口；无 Editor 边界
After:  双击文件 → 右侧中部 Artifact Workbench（preview）
        → 概览页显示元数据/关联/定位/资源理解 → Esc 逐级关闭
        双击 Scope → 进入一度关系（不变）
        Viewer 一律经 Registry 解析；未支持格式显示诚实 fallback
```

## Security impact

- 文件内容仍只从 Local Core `file-records/{id}/content` 读取（127.0.0.1），不传第三方
- Link Viewer 仅展示已存 URL，外部跳转显式点击
- 无编辑能力：Editor Host 接口存在但值为 null

## Failure recovery

- 预览请求失败 → viewer-error 明确文案，不崩溃
- 未支持格式（DOCX 等）→ fallback 显示文件元数据 +「只读预览未接入」说明
- Blob URL 在卸载时 revoke，不泄漏

## Tests actually run（真实环境）

- 单元/架构/集成：76 文件 / 365 测试全绿；web + local-core typecheck/lint 全绿
- 浏览器探针（`tests/e2e/workbench-probe.mjs`，headless Chromium + 真实 Core/Web）：
  - 双击 `view-brief` → 工作台打开（heading=Brief、focus=preview）
  - 切概览 → 6 行元数据
  - Esc → 工作台关闭；再次双击可重开
  - 截图证据：`tests/e2e/output/playwright/workbench-*.png`

## Known limitations

- DOCX 只读预览仍为 fallback（DATA-04 未变，不假装支持）
- Workbench 暂未做 Inspector 式的深层导航栈（当前 preview⇄overview 两级）
- 真实 Agent 产物（Run 返回的新文件）在工作台中的预览待 Slice F 浏览器 Golden Path 验证

## Rollback

Revert `77f6eb4`；无 Schema/数据影响。回滚后恢复旧 Modal 预览路径（文件已删除，需从 git 恢复）。

## Worktree clean / STOP-GO

- 本 Handoff 提交后工作区干净
- **GO → Slice F**：完整 Golden Path 与发布纠偏（真实 Bridge/Agent 链、Checkpoint、重启恢复、README/手册更新）

---

_Codex 2026-08-03，全部结论基于本次实测。_
