# MVP Stage 7A Handoff — Runtime Import Boundary & Bridge Gate

> Date: 2026-07-29  
> Branch: `codex/mvp-fast-build`  
> Scope: Stage 7A, no schema migration, no Bridge integration

## Summary

Stage 7A clarified and enforced the current Runtime Source import boundary:

- Browser drag/drop remains a temporary preview path.
- Runtime Source persistence must go through Local Core trusted `selectionId`.
- Web now has a typed client method for the existing safe Local Core source registration route.
- Runtime Diagnostics now exposes the import gate and explains why temporary drag/drop is not saved.
- Bridge was audited enough to decide it is not ready for direct MVP main-path integration.

## Actual Changes

### Code

- `apps/web/src/runtime/localCoreClient.ts`
  - Added `registerTrustedSource(projectId, input)` client method.
  - It calls `POST /projects/:projectId/sources`.
  - It sends only `selectionId` and optional `title`.

- `apps/web/src/features/diagnostics/RuntimeDiagnosticsPage.tsx`
  - Added `Runtime Source Import Gate`.
  - Shows source contract, raw path guard and drag/drop status.

- `apps/web/src/App.tsx`
  - Updated drag/drop node subtitles and toast to state clearly that these are temporary previews and will not survive refresh/restart.

### Tests

- `apps/web/tests/localCoreClient.test.ts`
  - Added coverage for `registerTrustedSource`.
  - Verifies request body does not include raw path fields.

- `apps/web/tests/runtimeBridge.test.ts`
  - Updated mock client shape for the new Local Core client method.

### Docs

- `docs/audit/MVP_STAGE7_IMPORT_AND_BRIDGE_REALITY_GATE_2026-07-29.md`
  - Documents current import gap, schema judgment, Stage 7 plan and Bridge Reality Gate result.

## Tests Run

```text
npx vitest run apps/web/tests/localCoreClient.test.ts apps/web/tests/runtimeDiagnostics.test.ts apps/web/tests/runtimeBridge.test.ts --reporter=verbose
PASS — 3 files, 20 tests

npm run typecheck
PASS

npm run test:architecture
PASS — 3 files, 24 tests
```

Full quality chain is run before commit.

## Browser Visible Changes

Main Canvas:

- Dragging in a local file now says it is a temporary preview and will not be saved across refresh/restart.

Runtime Diagnostics:

- Adds a visible `Runtime Source Import Gate` panel.
- Explains that trusted Runtime Source persistence needs `selectionId`.

## Bridge Gate Result

Current result: **No-Go for direct MVP main-path Bridge integration.**

Primary blocker:

- `E:\Buddy项目\ai-bridge` exists but has no reliable committed source baseline; most source files are untracked.

This must be resolved before OS depends on Bridge as a Runtime component.

## Schema Impact

No schema change recommended.

`FileRecord`, `Artifact`, and `ArtifactRevision` already support source import persistence.

## Risks

- Runtime Source import is not complete until a trusted selection provider exists.
- Browser drag/drop cannot safely become Project Truth by itself.
- Bridge may be useful operationally, but should not be merged as OS mainline Runtime until Git/test/provenance evidence is fixed.

## Rollback

Revert this Stage 7A commit.

No migration, dependency or persisted data format was changed.

## Next Step

Decision needed for Stage 7B:

1. Keep drag/drop temporary for MVP and merge Core MVP.
2. Add a dev-only trusted local selection helper.
3. Wait for proper native/Bridge file authorization before persistent user imports.
