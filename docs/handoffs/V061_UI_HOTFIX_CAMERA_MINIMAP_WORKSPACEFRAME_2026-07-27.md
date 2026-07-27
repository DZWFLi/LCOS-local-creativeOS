# v0.6.1 UI Hotfix: Camera / Minimap / WorkspaceFrame

## Summary

完成两个热修复文档要求的前端窄修，不修改 Local Core、SQLite、Bridge、Preview、Watcher 或真实文件写入。

## Root Cause

1. Camera → Project Save：
   - `RuntimeBridge.diffStateToOps()` 仍把 `Workspace.camera` 差异映射为 `update_workspace_viewport`。
   - v0.6.1 后 Camera 是 Navigation State，`Workspace.viewport/camera` 仅保留 legacy 兼容字段，不应由当前 Camera navigation 产生 Project Mutation。

2. Minimap 幽灵节点：
   - `App.tsx` 给 `CanvasMiniMap` 传入了全项目 `nodes`。
   - Root Scope 下因此混入 Child Scope 节点：
     - `hx-ref-1` / `scope-hx-delivery`
     - `hx-ref-2` / `scope-hx-delivery`
     - `hx-lock` / `scope-hx-delivery`
   - 这些节点在 Root Canvas 找不到，所以表现为 Minimap 左上幽灵点。

3. WorkspaceFrame：
   - Canvas 和 Minimap 传入/渲染了当前 Scope 的所有 Workspace Frames。
   - 热修后只渲染 active workspace frame；Project Overview 下 frame count 为 0。

## Changed Behavior

- Pan / Zoom / Minimap Navigation / Workspace Locate 只更新 Camera。
- Camera 静默持久化仍走 `projectNavigation` localStorage UI-state。
- Project Mutation Queue 不再收到 Camera-only workspace viewport mutation。
- Minimap 数据源改为当前 active Scope 的完整 ViewModel：`scopeNodes`。
- Minimap node 增加诊断属性：
  - `data-minimap-view-id`
  - `data-minimap-artifact-id`
  - `data-minimap-scope-id`
  - `data-minimap-visible`
- Workspace Frame：
  - Project Overview：0
  - Active Workspace：Canvas 1 / Minimap 1
  - 非 active frame 不 render。

## Tests

```text
npm run typecheck --workspace @local-creative-os/web
npx vitest run apps/web/tests/v061CanvasInteractionContract.test.ts apps/web/tests/runtimeBridge.test.ts apps/web/tests/workspaceFrames.test.ts --reporter=verbose
npm run check:v061-static
npm run check
```

Result:

```text
PASS
```

`npm run check` result:

```text
Web: 26 files / 94 tests passed
Local Core: 7 files / 58 tests passed
Domain: 1 file / 5 tests passed
Contracts: 1 file / 4 tests passed
Architecture: 17 passed / 7 todo
Build: PASS
```

## Browser Verification

Verified after commit `134f3bd` with `npm run dev:open` against `http://127.0.0.1:5173/`.

```text
statusBefore: saved
statusAfterCamera: saved
zoomIn: 0.9276986844325562
zoomOut: 0.35
sceneScopeId: scope-root
sceneWorkspaceId: understand
overviewCanvasFrames: 0
overviewMiniFrames: 0
activeCanvasFrames: 1
activeMiniFrames: 1
minimapNodeScopes: [scope-root]
uiRectsStable: true
```

Browser assertions:

- Camera zoom did not change `tabbar`, `workspace-dock`, `work-rail`, `canvas-hud`, or `project-minimap` client rects.
- Camera zoom did not move save status into `saving`.
- Project Overview rendered 0 canvas workspace frames and 0 minimap workspace frames.
- Active workspace rendered 1 canvas workspace frame and 1 minimap workspace frame.
- Minimap nodes all matched the active scene scope.

## Not Done

- No schema/migration.
- No Local Core navigation endpoint.
- No Bridge / Run / SSE.
- No File Observation / Preview / Watcher.
- No React Flow migration.

## Rollback

Revert this hotfix commit. No database or lockfile changes are involved.
