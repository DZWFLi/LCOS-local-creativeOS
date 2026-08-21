# v0.6.1 Frontend / Runtime Alignment Handoff

## Summary

已将 v0.6.1 Canvas Interaction Refactor 前端候选改动选择性接入当前 Phase 3 后端 worktree，并保留现有 Local Core / SQLite / RuntimeBridge 保存链。

## Actual Scope

- 接入 Project Overview、Workspace Frame、Workspace Active / Locate、Workspace Group Drag、Node Resize、Canvas HUD、Project-wide Minimap、Camera rectangle。
- Runtime 项目保存继续走 `RuntimeBridge.saveMutations()`。
- Camera / Navigation State 暂按 v0.6.1 候选作为静默 UI-state 保存，不进入 Project Graph mutation。
- 未新增 Local Core navigation endpoint，未新增 SQLite schema/migration。

## Flow Change

Before:

```text
v0.6.1 candidate
→ frontend localStorage prototype save
→ camera localStorage
```

After:

```text
Project semantic/presentation data
→ RuntimeBridge.saveMutations()
→ Local Core / SQLite

Camera navigation state
→ silent UI-state persistence
→ does not bump semanticGraphVersion
```

## Changed Files

- `package.json`
- `apps/web/package.json`
- `apps/web/src/App.tsx`
- `apps/web/src/model.ts`
- `apps/web/src/runtime/runtimeBridge.ts`
- `apps/web/src/features/canvas/ProjectCanvas.tsx`
- `apps/web/src/features/canvas/CanvasMiniMap.tsx`
- `apps/web/src/features/workspace/WorkspaceDock.tsx`
- `apps/web/src/foundation.css`
- `apps/web/src/surface.css`
- `apps/web/src/state/projectNavigation.ts`
- `apps/web/src/state/workspaceFrames.ts`
- `apps/web/tests/v061CanvasInteractionContract.test.ts`
- `apps/web/tests/workspaceFrames.test.ts`
- `apps/web/tests/surfaceCalibration.test.ts`
- `scripts/validate-v061-static.mjs`

## Tests

Manual / Codex:

```text
npm run typecheck --workspace @local-creative-os/web
npx vitest run apps/web/tests/workspaceFrames.test.ts apps/web/tests/v061CanvasInteractionContract.test.ts apps/web/tests/runtimeBridge.test.ts apps/web/tests/surfaceCalibration.test.ts --reporter=verbose
npm run check:v061-static
git diff --check
```

Buddy/sub-agent read-only verification:

```text
node scripts/validate-v061-static.mjs
npm run check
```

Result:

```text
PASS
```

Sub-agent reported:

```text
Web: 26 files / 93 tests passed
Local Core: 7 files / 58 tests passed
Domain: 1 file / 5 tests passed
Contracts: 1 file / 4 tests passed
Architecture: 17 passed, 7 todo
Build: PASS
```

## Evidence

- `npm run check:v061-static`: 20/20 static contracts passed.
- `npm run check`: passed.
- `git diff --check`: no whitespace errors.

## Not Done

- No React Flow production adapter.
- No Local Core navigation endpoint.
- No SQLite schema/migration for camera.
- No Scope persistence redesign.
- No Watcher / Preview / Bridge / SSE.
- No real user file write.
- No localStorage formal migration.

## Risk

Camera persistence is still UI-state localStorage, not Local Core. This is intentionally kept out of Project Graph to preserve v0.6.1 semantics, but should become a separate lightweight Runtime endpoint in a later approved slice.

## Rollback

Revert this v0.6.1 alignment changeset. It does not alter database schema or lockfile.

## Next Step

Run browser E2E/manual validation against the running Local Core:

```text
Project Overview → pan/zoom no save indicator
Workspace activate no camera jump
Locate changes only camera
Resize end saves once
Group drag saves member positions once
Restart restores Runtime project data
```
