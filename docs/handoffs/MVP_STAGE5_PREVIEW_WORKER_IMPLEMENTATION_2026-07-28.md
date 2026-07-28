# MVP Stage 5 — Preview Worker Implementation

Date: 2026-07-28
Branch: `codex/mvp-fast-build`
Base before this slice: `1fddb3f docs(mvp): propose preview worker plan`

## Summary

Implemented the approved Stage 5 Preview Worker slice.

Local Core can now generate PreviewRecord cache entries for registered Runtime revisions, and Web can trigger generation from the Work Rail using only `revisionId + previewProfile`.

## Implemented

- `PreviewWorkerService`
  - serial generation queue;
  - resolves `ArtifactRevision → FileRecord` in Local Core;
  - reads only registered `FileRecord.observedPath`;
  - supports TXT / Markdown / Image mime types;
  - records `failed` for missing/unavailable files;
  - does not publish `ready` if aborted before generation.
- `PreviewCacheService.recordFailed(...)`.
- `POST /projects/:projectId/previews`.
- Browser client `generatePreview(projectId, revisionId, previewProfile)`.
- RuntimeBridge `generatePreview(...)` and state reload.
- Work Rail button: `生成 Preview`.
- `ARCH-P3-010` converted from todo to passing test.

## Not implemented

- No PDF preview.
- No Bridge.
- No Watcher.
- No schema migration.
- No new dependency.
- No browser-supplied paths.
- No browser shell execution.
- No external network.
- No user-file writes.

## Flow

```text
Work Rail click "生成 Preview"
→ Web POST /projects/:projectId/previews
→ body: revisionId + previewProfile only
→ Local Core resolves Revision/FileRecord
→ PreviewWorkerService reads registered source
→ PreviewCacheService writes tmp cache file
→ atomic rename
→ PreviewRecord ready
→ RuntimeBridge reloads graph + preview records
→ Work Rail shows Preview status ready
```

Failure:

```text
missing/unreadable source
→ PreviewRecord failed

unsupported mime type/profile
→ PreviewRecord unsupported

abort before publish
→ no ready PreviewRecord
```

## Files

- `apps/local-core/src/preview-worker-service.ts`
- `apps/local-core/src/preview-cache-service.ts`
- `apps/local-core/src/server.ts`
- `apps/local-core/src/index.ts`
- `apps/local-core/tests/preview-worker-service.test.ts`
- `apps/local-core/tests/server.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/features/workrail/WorkRail.tsx`
- `apps/web/src/runtime/localCoreClient.ts`
- `apps/web/src/runtime/runtimeBridge.ts`
- `apps/web/src/surface.css`
- `apps/web/tests/localCoreClient.test.ts`
- `apps/web/tests/runtimeBridge.test.ts`
- `tests/architecture/phase3-boundaries.test.ts`
- `docs/architecture/ADR_MVP_STAGE5_PREVIEW_WORKER_PLAN.md`
- `docs/mvp-materials/09_KNOWN_ISSUES.md`
- `docs/mvp-materials/10_REFERENCE_FEATURE_STATUS.md`
- `docs/handoffs/MVP_STAGE5_PREVIEW_WORKER_IMPLEMENTATION_2026-07-28.md`

## Tests

Focused:

```text
npm run typecheck --workspace @local-creative-os/local-core
npm run typecheck --workspace @local-creative-os/web
npx vitest run apps/local-core/tests/preview-worker-service.test.ts apps/local-core/tests/preview-cache-service.test.ts apps/local-core/tests/server.test.ts apps/web/tests/localCoreClient.test.ts apps/web/tests/runtimeBridge.test.ts tests/architecture/phase3-boundaries.test.ts --reporter=verbose
```

Result:

```text
PASS
70 passed
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
Web: 26 files / 100 tests
Local Core: 11 files / 76 tests
Domain: 1 file / 5 tests
Contracts: 1 file / 4 tests
Integration: 5 passed
Architecture: 24 passed
Build: PASS
```

Existing warnings:

- Existing React hook dependency warnings in `apps/web/src/App.tsx`.
- Existing Node experimental SQLite warning.

## Browser / Runtime visible change

Select a Runtime sample node with `Preview status = not-generated`, then click `生成 Preview`.

Expected:

- notice says preview is generating;
- Work Rail refreshes;
- supported sample nodes become `ready`;
- unsupported/failure cases show `unsupported` or `failed`, not false `ready`.

## Risk

- Image preview currently stores source bytes in cache under the selected renderer identity; no image transcoding dependency is introduced.
- Large source reads are bounded to the MVP byte limit.
- Cache files are still cache, not Project Truth.

## Rollback

Revert this slice. No schema or Project Truth rollback is needed.

If cache cleanup is required, delete only files inside the configured preview cache root after path containment has been verified.

