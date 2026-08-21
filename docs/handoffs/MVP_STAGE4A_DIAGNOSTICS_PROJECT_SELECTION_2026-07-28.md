# MVP Stage 4a — Diagnostics Project Selection

Date: 2026-07-28
Branch: `codex/mvp-fast-build`
Base before this slice: `0858f1d docs(mvp): add demo handoff pack`

## Summary

Updated the development Runtime Diagnostics page so it no longer queries or creates the old PortaSplit disposable project.

Diagnostics now reads the Runtime catalog first, prefers `disposable-mvp-sample`, and falls back to the first Runtime catalog entry if the MVP sample is unavailable.

## Scope

Implemented:

- Removed old hardcoded `disposable-portasplit-phase2-lite` graph lookup.
- Removed the diagnostics-only PortaSplit snapshot creation path.
- Updated diagnostics copy from Phase 2 Lite / Fixture wording to Runtime Project wording.
- Kept diagnostics read-only with respect to project graph data.

Not implemented:

- No schema migration.
- No Domain semantic change.
- No Bridge.
- No Preview worker.
- No Watcher.
- No runtime file writes.

## Flow

Before:

```text
Diagnostics load
→ GET /projects
→ GET /projects/disposable-portasplit-phase2-lite/graph
→ MVP sample appears in catalog but metadata panel reports Project not found
```

After:

```text
Diagnostics load
→ GET /projects
→ choose disposable-mvp-sample, else first catalog project
→ GET /projects/:selectedProjectId/graph
→ metadata panel describes the same project shown in catalog
```

## Files

- `apps/web/src/features/diagnostics/RuntimeDiagnosticsPage.tsx`
- `docs/handoffs/MVP_STAGE4A_DIAGNOSTICS_PROJECT_SELECTION_2026-07-28.md`

## Tests

```text
npm run typecheck --workspace @local-creative-os/web
npx vitest run apps/web/tests/localCoreClient.test.ts apps/web/tests/runtimeBridge.test.ts --reporter=verbose
```

Result:

```text
PASS
Local Core client: 6 passed
RuntimeBridge: 5 passed
```

## Browser / Runtime visible change

Open:

```text
http://127.0.0.1:5173/__diagnostics
```

Expected:

- Project Catalog shows `LCOS MVP Sample`.
- Runtime Project Metadata shows the same project graph instead of `Project not found`.
- The old `Create disposable PortaSplit metadata` button is gone.

## Risk

If Local Core catalog is empty, diagnostics cannot infer a graph id and now reports that no Runtime project graph is available.

## Rollback

Revert this slice. No persisted data or schema rollback is needed.

