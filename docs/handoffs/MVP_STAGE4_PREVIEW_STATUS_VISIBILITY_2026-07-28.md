# MVP Stage 4 — Preview Status Visibility

Date: 2026-07-28
Branch: `codex/mvp-fast-build`
Base before this slice: `6c6a435 fix(mvp): align diagnostics with sample project`

## Summary

Added read-only PreviewRecord visibility from Local Core to Web.

The UI now tells the user whether the selected Runtime revision has a preview cache record:

- `ready`
- `failed`
- `unsupported`
- `not-generated`

This does not generate previews and does not display rendered file content. It only exposes existing PreviewRecord metadata.

## Scope

Implemented:

- Local Core read-only route:
  - `GET /projects/:projectId/preview-records`
- Web Local Core client method:
  - `previewRecords(projectId)`
- RuntimeBridge preview status projection:
  - `PreviewRecord.revisionId → CanvasNode.previewStatus`
- Canvas DOM debug attribute:
  - `data-preview-status`
- Work Rail `Preview status` panel.
- Tests for client route, server route, and RuntimeBridge mapping.
- Updated diagnostics safety test after Stage 4a Runtime-only diagnostics change.

Not implemented:

- No renderer worker.
- No preview generation endpoint.
- No cache file serving.
- No SQLite schema migration.
- No Domain semantic change.
- No Bridge.
- No Watcher.
- No real user-file write.

## Flow

Before:

```text
ProjectGraphSnapshot
→ ArtifactRevision/FileRecord visible
→ Preview status invisible
```

After:

```text
GET /projects/:projectId/graph
GET /projects/:projectId/preview-records
→ match PreviewRecord by revisionId
→ CanvasNode.previewStatus
→ Work Rail Preview status panel
```

## Files

- `apps/local-core/src/server.ts`
- `apps/local-core/tests/server.test.ts`
- `apps/web/src/model.ts`
- `apps/web/src/runtime/localCoreClient.ts`
- `apps/web/src/runtime/runtimeBridge.ts`
- `apps/web/src/features/canvas/ProjectCanvas.tsx`
- `apps/web/src/features/workrail/WorkRail.tsx`
- `apps/web/src/surface.css`
- `apps/web/tests/localCoreClient.test.ts`
- `apps/web/tests/runtimeBridge.test.ts`
- `apps/web/tests/runtimeDiagnostics.test.ts`
- `docs/mvp-materials/10_REFERENCE_FEATURE_STATUS.md`
- `docs/handoffs/MVP_STAGE4_PREVIEW_STATUS_VISIBILITY_2026-07-28.md`

## Tests

Focused:

```text
npm run typecheck --workspace @local-creative-os/web
npm run typecheck --workspace @local-creative-os/local-core
npx vitest run apps/web/tests/localCoreClient.test.ts apps/web/tests/runtimeBridge.test.ts apps/local-core/tests/server.test.ts --reporter=verbose
```

Result:

```text
PASS
Focused tests: 45 passed
```

Full:

```text
npm run check:fast
npm run test:integration
npm run test:architecture
```

Result:

```text
PASS
Web: 26 files / 99 tests
Local Core: 10 files / 71 tests
Domain: 1 file / 5 tests
Contracts: 1 file / 4 tests
Integration: 5 passed
Architecture: 23 passed / 1 todo
Build: PASS
```

Existing warnings:

- Existing React hook dependency warnings in `apps/web/src/App.tsx`.
- Existing Node experimental SQLite warning.
- Existing architecture todo `ARCH-P3-010`.

## Browser / Runtime visible change

Open the main app and select a Runtime sample node.

Expected:

- Work Rail still shows `Runtime identity`.
- Work Rail now also shows `Preview status`.
- Current MVP sample likely shows `not-generated`, because renderer workers are not connected.
- Canvas node has `data-preview-status="not-generated"` unless a PreviewRecord exists.

## Risk

- Users may read `not-generated` as a broken preview. The panel copy explicitly says this is expected before renderer workers are connected.
- The endpoint exposes metadata only; serving cache files or generating previews remains future work.

## Rollback

Revert this slice. No persisted data or schema rollback is needed.

## Next

Recommended next stage:

```text
Stage 5 — Preview worker plan / ADR
```

Do not implement worker-backed MD/TXT/Image preview generation without explicit approval, because it starts touching cache generation and file-read behavior.

