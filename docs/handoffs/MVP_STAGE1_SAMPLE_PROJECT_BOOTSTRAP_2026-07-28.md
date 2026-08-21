# MVP Stage 1 — Runtime Sample Project Bootstrap

Date: 2026-07-28
Branch: `codex/mvp-fast-build`
Base: `5c29bf0 feat(local-core): add preview cache registry`

## Summary

Added a real disposable Runtime-backed MVP sample project bootstrap path.

Local Core dev startup now ensures one sample project exists:

```text
disposable-mvp-sample
→ apps/local-core/.data/mvp-sample-project/
→ schema v5 SQLite metadata
→ Web Runtime catalog
→ App opens Runtime MVP Sample when Local Core is online
```

The sample project is not a frontend Fixture and is not stored in browser `localStorage`.

## Scope

Implemented:

- `disposable-mvp-sample` Runtime project seed.
- Real sample files written under Local Core disposable `.data`:
  - `brief.md`
  - `script.txt`
  - `reference.png`
  - `feedback.md`
- SQLite metadata using existing schema v5:
  - Project
  - Scope
  - 3 Workspaces
  - 4 Artifacts
  - 4 FileRecords
  - 4 initial ArtifactRevisions
  - 4 ArtifactViews
  - 3 Relations
  - 2 Notes
  - 1 Checkpoint
- Web boot now uses Runtime catalog and prefers `disposable-mvp-sample` when Local Core is online.

Not implemented:

- No schema migration.
- No Domain semantic change.
- No Bridge / Run / SSE / Artifact Return.
- No Watcher.
- No real user file write.
- No Preview worker or PDF.
- No localStorage migration.

## Flow

Before:

```text
Local Core starts
→ opens SQLite
→ catalog only reflects existing metadata
→ Web RuntimeBridge tries default project-portasplit
→ fallback Demo if no project exists
```

After:

```text
Local Core starts
→ opens SQLite
→ ensureMvpSampleProject()
→ if missing, create disposable sample files + schema v5 graph
→ if existing, do not overwrite
→ Web loads Runtime catalog
→ prefers disposable-mvp-sample
→ loads graph into Canvas
```

## Files

- `apps/local-core/src/mvp-sample-project.ts`
- `apps/local-core/src/index.ts`
- `apps/local-core/tests/mvp-sample-project.test.ts`
- `apps/web/src/App.tsx`
- `docs/handoffs/MVP_STAGE1_SAMPLE_PROJECT_BOOTSTRAP_2026-07-28.md`

## Tests

Focused:

```text
npm run typecheck --workspace @local-creative-os/local-core
npx vitest run apps/local-core/tests/mvp-sample-project.test.ts apps/local-core/tests/server.test.ts --reporter=verbose
npm run typecheck --workspace @local-creative-os/web
npx vitest run apps/web/tests/runtimeBridge.test.ts apps/web/tests/localCoreClient.test.ts apps/web/tests/fixtures.test.ts --reporter=verbose
```

Result:

```text
PASS
Local Core focused: 33 passed
Web focused: 12 passed
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
Web: 26 files / 96 tests passed
Local Core: 10 files / 70 tests passed
Domain: 1 file / 5 tests passed
Contracts: 1 file / 4 tests passed
Integration: 5 passed
Architecture: 23 passed / 1 todo
Build: PASS
```

Existing warnings:

- Web lint still reports pre-existing React hook dependency warnings in `apps/web/src/App.tsx`.
- Node still reports the existing experimental SQLite warning.

## Browser / Runtime Verification

Not run in this dirty implementation state because `npm run dev:open` correctly refuses dirty worktrees.

Next clean-state verification:

```text
npm run dev:open
```

Expected visible result:

- Runtime catalog includes `LCOS MVP Sample`.
- App opens Runtime MVP Sample by default when Local Core is online.
- Save badge shows Runtime.
- Closing and reopening restores the sample graph without reseeding over user edits.

## Risk

- The seed is dev/runtime bootstrap only. It must not be treated as real import UX.
- Sample files are disposable under `apps/local-core/.data`, not user files.
- If the sample project already exists, the seeder does not overwrite it, so stale local test data can persist until the database is intentionally reset.
- Web still has Demo fallback; UI must continue to label Runtime vs Demo clearly.

## Rollback

Revert this Stage 1 commit. Existing disposable `.data` sample files/database can be deleted as runtime artifacts if a clean local dev state is needed.

## Next

Stage 2 should make FileRecord / current Revision identity more visible in the Web UI and add a clean browser validation pass through `dev:open`.
