# MVP Stage 6 — Recovery, Failure Paths, and Acceptance

Date: 2026-07-28
Branch: `codex/mvp-fast-build`
Base: `173d60a feat(mvp): display preview cache content`

## Summary

Executed the approved Stage 6 scope: recovery, failure paths, and acceptance evidence.

This stage does not implement Bridge, Watcher, automatic Revision, PDF/PPT renderers, or a new desktop shell. It verifies that the Core MVP path can survive refresh/restart and that major failure states are explicit instead of silently falling back to Fixture or corrupting Project Truth.

## Code changes

Only E2E / recovery harness fixes:

- `tests/e2e/golden-path.spec.ts`
  - Fixed repository root detection for the Playwright E2E test.
  - Added `fileRecords: []` to the seeded snapshot so the E2E fixture matches the current Phase 3 graph contract.
  - Made Local Core restart wait for the old process to exit before starting the new one.
  - Switched Local Core health polling and seed PUT to `fetch`, avoiding brittle `ECONNRESET` behavior during restart windows.
- `scripts/phase25-golden-path.mjs`
  - Added `fileRecords: []` to the Golden Path snapshot so the script matches the current graph contract.

No product semantics changed.

## Required coverage matrix

| Requirement | Evidence | Status |
| --- | --- | --- |
| Browser refresh | Playwright E2E loads app through Vite proxy and verifies Runtime badge | PASS |
| Local Core restart | Playwright E2E kills/restarts Local Core, reloads page, verifies Runtime badge | PASS |
| File missing | `apps/local-core/tests/file-observation-service.test.ts` marks deleted files `missing` without changing frozen revision hash | PASS |
| File stale | `apps/local-core/tests/file-observation-service.test.ts` marks external changes `stale` without creating a Revision | PASS |
| File unreadable | `apps/local-core/tests/file-observation-service.test.ts` maps non-file path to `unreadable`/stale artifact behavior | PASS |
| Preview unsupported | `tests/architecture/phase3-boundaries.test.ts` and `preview-cache-service.test.ts` prevent unsupported formats reporting ready | PASS |
| Preview worker failure | `apps/local-core/tests/preview-worker-service.test.ts` records failed when source file is missing | PASS |
| Worker abort/crash safety | `ARCH-P3-010` prevents ready PreviewRecord on abort | PASS |
| Runtime unavailable | `apps/web/tests/localCoreClient.test.ts` maps offline fetch to stable `UNAVAILABLE` without fixture fallback | PASS |
| Fixture禁止静默接管 | `apps/web/tests/runtimeDiagnostics.test.ts`, `localCoreClient.test.ts`, and `ARCH-011` verify Runtime-only diagnostics/client paths and explicit fixture isolation | PASS |
| SQLite migration failure does not destroy original data | `apps/local-core/tests/metadata-repository.test.ts` backs up malformed v1 database before migration failure; architecture migration tests pass | PASS |
| Restart recovery at repository level | `metadata-repository.test.ts`, integration `INT-006`, `INT-007` | PASS |
| Core Golden Path E2E | `scripts/phase25-golden-path.mjs` via temporary Local Core DB | PASS |

## Quality chain results

### Required automatic chain

```text
npm run check:fast
npm run test:integration
npm run test:architecture
```

Result:

```text
PASS
```

Observed totals:

- Web tests: 26 files / 101 tests passed
- Local Core tests: 11 files / 76 tests passed
- Domain tests: 1 file / 5 tests passed
- Contracts tests: 1 file / 4 tests passed
- Integration tests: 1 file / 5 tests passed
- Architecture tests: 3 files / 24 tests passed

Existing lint warnings remain in `apps/web/src/App.tsx` React hook dependency checks; they are pre-existing and did not block `check:fast`.

### Core Golden Path E2E

Command executed with an isolated temporary Local Core DB:

```text
node scripts/phase25-golden-path.mjs
```

Result:

```text
GOLDEN PATH PASS
```

Verified:

- PUT → GET → Mutate → GET
- Checkpoint immutable after mutation
- Child scope parent/container recovery
- Entity-based relations
- Camera from Workspace, not Checkpoint
- Artifact survives last View deletion

### Browser Restart Recovery E2E

Executed:

```text
npx playwright test tests/e2e/golden-path.spec.ts --reporter=list
```

with a temporary Web dev server on `127.0.0.1:5173`.

Result:

```text
4 passed
```

Verified:

- Browser loads Runtime data through Vite proxy.
- Nonexistent Runtime project returns 404.
- Browser-side E2E remains tied to the Node Golden Path mutation script.
- Local Core restart followed by page reload restores Runtime availability.

## Findings fixed during Stage 6

1. `tests/e2e/golden-path.spec.ts` had an incorrect `ROOT` path.
   - Before: `tests`
   - After: repository root

2. The E2E and Node Golden Path seed snapshots were missing the Phase 3 `fileRecords` array.
   - This caused current Local Core graph save to fail against stale test data.

3. Restart E2E used brittle `http.get` polling.
   - During Local Core restarts, `ECONNRESET` could fail the test even when recovery was valid.
   - Replaced with retrying `fetch` health polling and process-exit synchronization.

## Manual browser acceptance script

After pulling this stage:

```powershell
cd "E:\Codex 项目\OS开发\.worktrees\mvp-fast-build"
npm run dev:open
```

Then test:

1. Open the MVP sample project.
2. Refresh the browser.
3. Confirm the Runtime badge returns and sample nodes remain available.
4. Run `npm run dev:stop`.
5. Run `npm run dev:open`.
6. Confirm the sample project still opens and Runtime Diagnostics is online.
7. Select sample MD/Image nodes and confirm Stage 5 preview behavior still works.

Failure state spot checks:

1. For a Runtime sample node, generate Preview.
2. Move/delete the source file only inside a disposable sample copy if doing destructive local testing.
3. Refresh FileRecord through existing Local Core test/API paths.
4. Confirm UI/test state reports missing/stale/unreadable rather than creating a new Revision or pretending everything is current.

## Stage 7 Bridge Reality Gate

Stage 7 is not started in this stage.

Bridge may enter MVP main path only if all are true:

- Bridge repository, Runtime Root, installation, and tests are reproducible.
- It can idempotently create/query tasks by `lcos_run_id`.
- `changed_files` returns stable absolute paths.
- Watcher routing and Sample Project isolation are proven.
- It does not need to overwrite source files.
- Project Path Guard can verify results.

If any condition fails, Bridge stays out of MVP main path and only Handoff export remains.

## Deferred work intentionally not included

- Node detail overlay restoration is parked in stash:
  - `stash@{1}: wip node overlay pending-ui-reference`
- Production copy cleanup is parked in stash:
  - `stash@{0}: wip production copy cleanup deferred`

Both are outside the approved Stage 6 recovery/failure scope.

## Risk

Low.

This stage changes recovery test harnesses, not product runtime semantics. The value is stronger acceptance evidence and less brittle restart validation.

## Rollback

Revert the E2E/golden-path script changes. Product runtime code is unchanged.
