# MVP Stage 2 — Runtime Identity UI

Date: 2026-07-28
Branch: `codex/mvp-fast-build`
Base before this slice: `21a37b6 chore(dev): point launcher at mvp worktree`

## Summary

Projected existing Runtime identity metadata from Local Core into the Web UI.

The Web canvas nodes now preserve:

- Artifact id
- current / pinned Revision id
- FileRecord id
- content hash
- observed source path
- whether the view follows the current revision

This is a read-only UI projection. It does not change Domain semantics, SQLite schema, migration, Bridge, Watcher, or file write behavior.

## Flow

Before:

```text
ProjectGraphSnapshot
→ ArtifactView
→ CanvasNode
→ title / kind only
```

After:

```text
ProjectGraphSnapshot
→ Artifact.currentRevisionId
→ ArtifactRevision.fileRecordId
→ FileRecord.observedPath / observedHash
→ CanvasNode runtime identity fields
→ Canvas data attributes + Work Rail identity panel
```

## Files

- `apps/web/src/model.ts`
- `apps/web/src/runtime/runtimeBridge.ts`
- `apps/web/src/features/canvas/ProjectCanvas.tsx`
- `apps/web/src/features/workrail/WorkRail.tsx`
- `apps/web/src/surface.css`
- `apps/web/tests/runtimeBridge.test.ts`
- `docs/handoffs/MVP_STAGE2_RUNTIME_IDENTITY_UI_2026-07-28.md`

## Tests

Focused:

```text
npm run typecheck --workspace @local-creative-os/web
npx vitest run apps/web/tests/runtimeBridge.test.ts --reporter=verbose
npx vitest run apps/local-core/tests/mvp-sample-project.test.ts --reporter=verbose
```

Result:

```text
PASS
RuntimeBridge: 5 passed
MVP sample: 2 passed
```

Final:

```text
npm run check:fast
npm run test:integration
npm run test:architecture
```

Result:

```text
PASS
Web: 26 files / 97 tests passed
Local Core: 10 files / 70 tests passed
Domain: 1 file / 5 tests passed
Contracts: 1 file / 4 tests passed
Integration: 5 passed
Architecture: 23 passed / 1 todo
Build: PASS
```

## Browser Verification

Not run in this dirty implementation state because `npm run dev:open` correctly refuses dirty worktrees.

Expected clean-state check:

```text
npm run dev:open
```

Then select a Runtime sample node and confirm:

- canvas node has `data-revision-id` and `data-file-record-id`;
- Work Rail shows `Runtime identity`;
- Runtime badge remains Runtime;
- no Demo / Fixture fallback is presented as Runtime.

## Risk

- Observed local paths are visible in the Work Rail. For MVP dev sample this is useful; before real user-file import UX, decide whether to show full path, project-relative path, or masked path.
- The current preview surface is still illustrative; this slice only makes identity visible, not real file rendering.

## Rollback

Revert this slice. No persisted data or schema needs rollback.

## Next

After commit, run clean `dev:open` browser validation. Then Stage 3 can focus on preview visibility / sample handoff pack, still without Bridge.
