# MVP Prestart Audit

Date: 2026-07-28
Worktree: `E:\Codex 项目\OS开发\.worktrees\mvp-fast-build`
Branch: `codex/mvp-fast-build`
Base commit: `5c29bf0 feat(local-core): add preview cache registry`
Version: `0.6.1`

## Scope

Approved yellow operation only:

- Create independent branch / worktree from `5c29bf0`.
- Audit Git, Phase 2.5, Phase 3 baseline.
- Run existing quality gates.
- Audit Fixture entry points, Runtime API gaps and Sample Project data design.
- Decide whether MVP Stage 1-3 needs a SQLite schema change.

No Domain semantic change, schema migration, dependency addition, Bridge integration, Stage 1 implementation, or main worktree edits were performed.

## Git Baseline

Created:

- Branch: `codex/mvp-fast-build`
- Worktree: `E:\Codex 项目\OS开发\.worktrees\mvp-fast-build`
- HEAD: `5c29bf0 feat(local-core): add preview cache registry`

Preflight:

- Main repository was on `fix/repo-worktree-location` at `3bf8a23`.
- Main repository had pre-existing untracked files: `.dev-launcher/`, `OS项目文档/LCOS-open-source-research/`, `scripts/open-lcos-dev.cmd`, `scripts/stop-lcos-dev.cmd`.
- Source Phase 3 worktree was on `feature/phase3-stage1-4` at `5c29bf0`.
- Source Phase 3 worktree had pre-existing untracked `docs/mvp-materials/`; it was treated as user material and was not copied into the new worktree.
- New MVP worktree started clean.

## Phase 2.5 / Phase 3 Baseline

Phase 2.5, from existing handoff:

- Runtime edits use action-level deltas and a serialized mutation queue.
- Stale graph versions are rejected with `409 STALE_GRAPH_VERSION`.
- Presentation mutations do not bump semantic `graphVersion`.
- `Workspace.viewport` is the camera restore source.
- Workspace / Artifact / ArtifactView / Relation / Note / Checkpoint are persisted in SQLite.

Phase 3, current `5c29bf0`:

- Stage 4 FileRecord / ArtifactRevision identity exists.
- Trusted source registration creates `FileRecord + Artifact + ArtifactRevision`.
- Browser source registration accepts only opaque `selectionId`, not paths.
- Stage 5 File Observation exists through manual refresh by `FileRecord.id`; no watcher, no automatic Revision.
- Stage 6 PreviewRecord / RendererRegistry / PreviewCacheService exists.
- Preview cache is cache only, not Project Truth.
- No Worker pool, no image / TXT / MD real renderer, no PDF preview, no Bridge / Run / SSE.

## Quality Gate Results

Commands run in `E:\Codex 项目\OS开发\.worktrees\mvp-fast-build`:

| Command | Result | Notes |
| --- | --- | --- |
| `git status --short` | PASS | Clean before audit report creation. |
| `git branch --show-current` | PASS | `codex/mvp-fast-build`. |
| `git rev-parse --short HEAD` | PASS | `5c29bf0`. |
| `git log --oneline -10` | PASS | Starts with `5c29bf0`. |
| `git diff --check` | PASS | No whitespace errors before report creation. |
| `npm run check:fast` | FAIL | Fails during web typecheck. |
| `npm run test:integration` | PASS | 5 tests passed. |
| `npm run test:architecture` | PASS | 23 passed, 1 todo (`ARCH-P3-010`). |
| `npm run test` | FAIL | Web test suite fails loading `zustand`; 25 web test files passed before failure, 92 tests passed. |

Follow-up dependency hydration:

```text
npm ci
```

Result:

```text
PASS
added 68 packages
found 0 vulnerabilities
```

Fresh quality gates after dependency install:

| Command | Result | Notes |
| --- | --- | --- |
| `npm run check:fast` | PASS | Web 26 files / 96 tests; Local Core 9 files / 68 tests; Domain 5 tests; Contracts 4 tests; architecture 23 passed / 1 todo; build PASS. |
| `npm run test:integration` | PASS | 5 tests passed. |
| `npm run test:architecture` | PASS | 23 passed / 1 todo (`ARCH-P3-010`). |

`check:fast` failure summary:

- Initial audit misread the `zustand` error as a missing declared dependency.
- Follow-up check against thread `019f8da6-2f71-7560-9f1c-48e2778b7663` and Git history shows `zustand` was intentionally added in `dc9ed1b feat(web): add zustand working store`.
- `apps/web/package.json` declares `"zustand": "5.0.14"`, and `package-lock.json` contains `node_modules/zustand`.
- The new `mvp-fast-build` worktree had no installed workspace `node_modules` links, so `npm run check:fast` was run before dependency installation in that worktree.
- Some TypeScript diagnostics from that run are therefore not trustworthy as product contract drift until dependencies are installed from the lockfile and the gate is rerun.

Known contract state at `5c29bf0`:

- `packages/domain/src/index.ts` still defines `Workspace.focusedViewIds`.
- `packages/contracts/src/index.ts` mutation contracts still use `focusedViewIds`.
- The earlier audit note claiming current Domain requires `focusedNodeIds` is withdrawn.

Conclusion: after dependency hydration from the committed lockfile, the `5c29bf0` baseline is green. The earlier `zustand` and TypeScript diagnostics were caused by an unhydrated new worktree, not confirmed source-level drift.

## Fixture Entry Points

Production / runtime-adjacent Fixture paths:

- `apps/web/src/App.tsx`
  - imports `makePerformanceFixture`.
  - builds initial state from `fixtureStateForProject(...)`.
  - falls back to `loadPrototypeState(...) ?? fixtureStateForProject(...)`.
  - shows Runtime/Demo save badge.
  - exposes "重置演示数据".
- `apps/web/src/fixtures.ts`
  - static project, workspace, node and edge fixtures.
- `apps/web/src/state/projectFixtures.ts`
  - converts static fixtures into `PersistedPrototypeState`.
  - provides `defaultProjectCatalog()`.
- `apps/web/src/state/prototypeStorage.ts`
  - persists prototype state and project catalog to `localStorage`.
- `apps/web/src/state/projectNavigation.ts`
  - persists UI navigation/camera state to `localStorage`.
- `apps/web/src/adapters/fixtureAdapter.ts`
  - explicit fixture adapter for workspace, preview and runtime contracts.
- `apps/web/src/features/diagnostics/RuntimeDiagnosticsPage.tsx`
  - intentionally displays Fixture and Runtime side by side for diagnostics.
- Tests import fixtures directly in `apps/web/tests/*`.

Allowed MVP interpretation:

- Keep Fixture for tests, diagnostics and explicit demo fallback.
- Do not let Fixture silently masquerade as Runtime.
- Production MVP open path should prefer Local Core project graph and show Fixture only as an explicit non-runtime demo mode.

## Runtime API Gaps

Existing browser client supports:

- `GET /health`
- `GET /projects`
- `POST /project-roots/validate`
- `GET /metadata/status`
- `GET /projects/:projectId/graph`
- `PUT /projects/:projectId/graph`
- `POST /projects/:projectId/graph`

Existing Local Core server additionally supports:

- Project / Workspace / Artifact / ArtifactView / Relation / Note / ArtifactRevision / Checkpoint read or focused CRUD routes.
- `POST /projects/:projectId/sources` with opaque `selectionId`.
- `GET /projects/:projectId/file-records`
- `GET /file-records/:fileRecordId`
- `POST /file-records/:fileRecordId/refresh`

MVP gaps before Stage 1-3:

- Web `LocalCoreClient` does not expose file records, artifact revisions, preview records, source registration or observation refresh.
- Web `RuntimeBridge` is typecheck-clean after dependency hydration.
- Runtime MVP work should still avoid relying on full snapshot save for day-to-day edits except approved bootstrap/import/recovery/test paths.
- No browser client for `PreviewRecord` / preview cache lookup yet.
- No worker-backed MD/TXT/Image preview generation endpoint yet.
- No Context Manifest / Handoff Pack runtime contract yet.
- No Bridge Run / Artifact Return API connected; out of MVP core unless separately approved.

## Sample Project Data Design

Recommended Sample Project should be a real Local Core disposable project, not only a frontend fixture.

Identity:

- `Project`: stable id, name, rootPath under a disposable sample directory.
- 2-3 `Workspace` records as Semantic Viewports:
  - `brief-script`
  - `reference-feedback`
  - `handoff-review`
- One root `Scope`; child scopes only if already supported by current UI without semantic changes.

Core entities:

- `Artifact` records:
  - Brief markdown.
  - Script markdown / text.
  - Reference image.
  - Feedback markdown.
  - Optional generated draft placeholder as explicit Draft/Generated.
- `FileRecord` for every real source file.
- One initial `ArtifactRevision` per source artifact, linked to its `FileRecord`.
- `ArtifactView` placements for each Workspace.
- `Relation` records:
  - Reference informs Brief.
  - Feedback comments on Script.
  - Brief informs Script.
  - Draft derives from Script only if represented as explicit non-accepted draft.
- `Note` records:
  - artifact-level note.
  - artifact_view-level workspace note.
  - optional page note only after PDF/PPT preview path is approved.
- `Checkpoint`:
  - manual MVP checkpoint after sample graph is assembled.

Storage approach:

- Use Local Core repository / mutation contracts.
- Store only metadata and hashes in SQLite.
- Keep actual sample files as normal files in the sample project root.
- Keep cache generated and disposable.
- Do not auto-migrate old browser `localStorage` prototype data into Project Truth.

## Schema Change Recommendation

Stage 1-3 does not require a SQLite schema migration if the Sample Project is modeled with existing entities:

- Project
- Scope
- Workspace
- Artifact
- ArtifactView
- Relation
- Note
- FileRecord
- ArtifactRevision
- Checkpoint
- PreviewRecord as cache metadata

Recommended no-migration path:

- Fix Web-to-contract adapter drift.
- Seed/import Sample Project through existing schema v5 repository/API.
- Represent Reference / Feedback through existing Artifact, Relation and Note types.
- Represent Handoff Pack as a markdown Artifact plus optional Checkpoint snapshot.

Possible future schema / contract extensions, not for this round:

- A first-class `ContextManifest` entity if handoff snapshots need durable querying beyond Checkpoint JSON.
- A Run / ArtifactReturn schema when Bridge integration is approved.
- Preview worker job state if cancellation/crash recovery must be durable.

## Stage 1-3 Plan

Stage 1: Baseline confirmation and MVP sample path.

- Keep the installed dependency state local to the worktree; no lockfile change is needed.
- Treat `5c29bf0` as the green MVP baseline.
- Start with a real disposable Sample Project bootstrap using existing schema v5 entities.
- Keep Fixture explicit and test-only / demo-only.
- Acceptance: `npm run check:fast`, `npm run test:integration`, `npm run test:architecture` remain green.
- Keep Fixture explicit and test-only / demo-only.
- Acceptance: `npm run check:fast`, `npm run test:integration`, `npm run test:architecture` pass.

Stage 2: Real Sample Project bootstrap.

- Create a disposable sample project root with real MD/TXT/Image files.
- Seed Local Core metadata through existing repository/API.
- Build Workspaces, ArtifactViews, Relations, Notes and initial Checkpoint.
- Acceptance: Local Core restart restores sample graph; no browser `localStorage` is Project Truth.

Stage 3: MVP UI open path.

- Make Web open the sample Runtime project as the primary MVP path.
- Keep explicit Demo/Fixture fallback visible as fallback, not default truth.
- Show FileRecord / current Revision identity in UI where already appropriate.
- Add focused tests for Runtime-vs-Fixture origin and restart recovery.

## Risks

- Baseline is green after installing dependencies, but future fresh worktrees must run `npm ci` before gates.
- Adding `zustand` would be wrong unless a fresh install proves the committed lockfile is unusable; it already exists in `apps/web/package.json` and `package-lock.json`.
- Renaming `focusedViewIds` to `focusedNodeIds` would be a semantic/contract change and is not indicated by `5c29bf0`.
- `RuntimeBridge.mapStateToGraph()` currently filters out note/process/decision nodes; relying on it for MVP Project Truth would lose important MVP entities.
- Preview cache foundation exists, but real worker rendering is still Stage 7 and has a remaining architecture todo.
- Bridge is intentionally not connected; treating Bridge as MVP core would trigger red/yellow protocol.

## Stop Point

This audit intentionally stops before Stage 1 implementation.

Next approval should choose whether Stage 1 may:

- create a real disposable Sample Project fixture/root under an approved path; and
- add the smallest Runtime-facing sample bootstrap/open path without changing Domain semantics or schema.
