# Phase 3 Prestart Git Audit

> Audit date: 2026-07-26  
> Status: Phase 2.5 verification failed; closure required before Phase 3 Stage 1–4

## Git baseline

- Worktree: `E:\Codex 项目\OS开发-phase3-stage1-4`
- Branch: `codex/phase3-stage1-4`
- HEAD: `59d4991eeb0e438aa91216dd6b69cd39e758581d`
- Phase 2.5 baseline: `684bba858eb581307ac0be60f04de95fe162095b`
- Baseline confidence: explicit. The next commit is `80d7de9 feat(domain): Phase 2.5 Data Spine Cleanup — Domain/Contracts 层`.
- Original repository state: detached HEAD with one untracked evidence directory, `OS项目文档/LCOS-open-source-research/`.
- Resolution: created this dedicated clean worktree from HEAD. The research directory remains read-only evidence outside this worktree.

## Phase 2.5 change inventory

`684bba8..59d4991` changes 25 files, with 2,293 insertions and 511 deletions.

### Domain and contracts

- `packages/domain/src/index.ts`
- `packages/contracts/src/index.ts`
- corresponding tests

Changes introduced Scope, entity-based Relation, graph/semantic versioning, Note and lifecycle contracts.

### Local Core

- `apps/local-core/src/metadata-repository.ts`
- `apps/local-core/src/project-catalog.ts`
- `apps/local-core/src/server.ts`

Changes introduced schema v3, mutation handling, version guard and entity CRUD.

### Web runtime

- `apps/web/src/runtime/runtimeBridge.ts`
- `apps/web/src/runtime/localCoreClient.ts`
- `apps/web/src/App.tsx`
- diagnostics and fixture adapter changes

The full-graph PUT was removed from routine autosave, but the current runtime still converts the complete front-end state into a full set of upsert operations.

### Tests and CI

- `.github/workflows/fast-gate.yml`
- `.github/workflows/full-gate.yml`
- `tests/architecture/*`
- `tests/integration/*`
- `tests/e2e/*`
- `scripts/phase25-*`
- `playwright.config.ts`

## Preflight result

| Check | Result | Evidence summary |
|---|---|---|
| P25-01 Runtime save | FAIL / partial | Full PUT is no longer routine, but autosave still maps the complete ViewModel state into full upserts instead of action-level deltas. |
| P25-02 Serialized queue | FAIL | Promise serialization exists, but successful mutation responses do not return/update graph version; stale retry reload is discarded and stale-response protection is incomplete. |
| P25-03 semanticGraphVersion | FAIL | Guard exists, but `delete_relation` is classified as presentation and `resize_artifact_view` has no repository handler. |
| P25-04 Camera | PASS | Current camera comes from `Workspace.viewport`; checkpoint camera is not used for restore. |
| P25-05 Lifecycle | FAIL | Generic revision/checkpoint mutation and direct checkpoint creation remain exposed. |
| P25-06 Artifact/View | PASS | Artifact supports zero/many Views; deleting the last View does not delete the Artifact. |
| P25-07 focusedViewIds | FAIL | Domain, contracts, database mapping and Web still use `focusedNodeIds`. |
| P25-08 NoteAnchor | FAIL | Union shape does not match the frozen model and HTTP writes lack runtime validation. |

**Initial decision: Phase 2.5 was not verified PASS. A closure commit was required before Phase 3 feature implementation.**

## Existing quality gate result

### Install

- Command: `npm ci`
- Exit: `0`
- Result: 67 packages installed, 0 vulnerabilities.

### Phase 2.5 check

- Command: `npm run check:phase25`
- Exit: `1`
- Lint: completed with existing Web warnings.
- Typecheck: all four workspaces passed.
- Web tests: 22 files / 79 tests passed.
- Local Core tests: 3 files failed; 10 tests failed, 31 passed.
- Remaining architecture, integration, build and E2E steps were not reached.

Failure groups:

- schema v3 tests still expect old schema/disposable behaviour;
- v1 migration fixture is incomplete for the migration being exercised;
- old fixtures omit `graphVersion`;
- project catalog expectations do not include the normalized `graphVersion`.

## QA system gaps

- `check:phase25` is not equivalent to the Full CI workflow.
- Root `build` builds Web only.
- Full CI references a missing `tests/integration/migration` directory.
- Playwright has no `webServer` configuration and requires external services.
- `test:e2e:golden` is not part of `check:phase25`.
- The root Vitest configuration does not exclude the external research tree in the original repository.

## Closure verification

The dedicated worktree closed the P25-01/02/03/05/07/08 gaps:

- runtime autosave now computes deltas from the last acknowledged state;
- mutation batches are serialized and use authoritative version acknowledgements;
- stale batches reload but are not silently replayed;
- semantic and presentation operations are explicitly separated;
- Relation deletion is semantic and resize/presentation handlers are implemented;
- generic Revision/Checkpoint mutations are removed;
- Checkpoint creation is immutable and command-specific;
- `focusedViewIds` is the formal Domain/Contract/Web term;
- NoteAnchor is a runtime-validated discriminated union.

Verification after closure:

- `npm run check:fast`: PASS
  - Web: 23 files / 82 tests
  - Local Core: 5 files / 41 tests at this run
  - Domain: 5 tests
  - Contracts: 4 tests
  - Architecture: 10 tests
  - Web build: PASS
- `npm run test:integration`: 4/4 PASS
- `npm run check:local-core`: PASS; after the final server validation additions, 47/47 Local Core tests passed
- isolated Phase 2.5 Golden Path on `127.0.0.1:43129`: PASS

The fixed development port `43121` was occupied by an unrelated WorkBuddy process. It was not terminated; the closure verification used the test-only `LOCAL_CORE_TEST_PORT` override and a disposable temporary database.

**Closure result: PHASE 2.5 VERIFIED PASS for the data spine checks. Real browser E2E remains part of the Stage 3/Stage 4 final gate.**

## Rollback

This audit only added a Markdown file in the dedicated worktree. Remove this file and delete the worktree/branch to return to `59d4991`.
