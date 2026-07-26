# Phase 3 Stage 1–4 Review

## 1. Git baseline

- Worktree: `E:\Codex 项目\OS开发-phase3-stage1-4`
- Branch: `codex/phase3-stage1-4`
- Phase 2.5 baseline: `684bba8`
- Audited starting HEAD: `59d4991`
- Review HEAD before this report: `0874d64`
- Original repository was left untouched; its untracked open-source research directory was treated as evidence only.

## 2. Phase 2.5 result

Phase 2.5 is verified PASS after closure commit `106af18`.

- Runtime edits use classified state deltas and a serialized mutation queue.
- Stale acknowledgements cannot overwrite newer working state.
- Presentation mutations do not change semantic graph version.
- Revision and Checkpoint generic mutation paths were removed.
- Camera restores from `Workspace.viewport`.
- `focusedViewIds` and the validated `NoteAnchor` union are formal contracts.

## 3. CI and test results

- `npm run check:fast`: PASS.
  - Web: 24 files / 86 tests.
  - Local Core: 7 files / 56 tests.
  - Domain: 5 tests.
  - Contracts: 4 tests.
  - Architecture: 17 PASS / 7 TODO reserved for Preview and File Observation stages.
  - Build: PASS.
- `npm run test:integration`: 4/4 PASS after the v4 fixture adaptation.
- Stage 4 focused typecheck and Local Core tests: PASS.
- Lint reports nine pre-existing Web warnings in `App.tsx`; there are no lint errors.
- Node reports the existing experimental SQLite warning.

## 4. React Flow Spike

Recommendation: **controlled adoption** behind a Web-only `CanvasEngineAdapter`.
Do not replace the current renderer until the in-app parity gate passes.

- Spike branch: `codex/phase3-react-flow-spike`
- Spike commit: `f77edd93cc6463ca6c8f544c04758dfe7408308f`
- Typecheck/build PASS; Playwright 2/2 PASS; architecture 10/10 PASS.
- Required LCOS identity and interactions passed.
- Controlled-update samples: 100 Views 194.5 ms; 300 Views 360.6 ms.
- Formal Web and Domain code were not modified by the spike.

## 5. Zustand Working State

One composed `AppWorkingStore` now owns Canvas, Workspace, Selection,
Inspector, MutationQueue and RuntimeUi slices. It has explicit Local Core
rehydration/reset and does not use Zustand persist or localStorage for Project
Truth. Canvas undo/redo now uses the Canvas slice as its authority.

## 6. FileRecord and Initial Revision

Schema v4 separates:

```text
Artifact
  → currentRevisionId

ArtifactRevision
  → fileRecordId
  → frozen contentHash

FileRecord
  → observedPath
  → observedHash
  → current/stale/missing/unreadable
```

Trusted source registration atomically creates `FileRecord + Artifact +
ArtifactRevision(source=import,current)` and increments graph version once.
The source file is read and hashed but never modified.

The v3→v4 migration preserves revisions, creates migrated unreadable
FileRecords for legacy rows and writes a `.v3.bak` backup.

## 7. Trusted Picker status

The formal contract is frozen around an opaque `selectionId`. A Local Core
registry accepts a trusted absolute path only from a launcher/native adapter.
The Browser route rejects `path`, `absolutePath` and `rootPath`.

The launcher/native picker itself is a deliberate placeholder and is not
implemented in this stage.

## 8. Path Guard

Implemented normalization, absolute-path validation, `realpath`, project-root
containment, Windows case normalization, junction escape rejection, readable
regular-file checks and an explicit trusted external-source policy.

Tests passed for inside-root files, outside-root rejection and a real Windows
junction escape.

## 9. Changed areas

- `apps/web`: Zustand working store, history integration, Runtime snapshot adaptation.
- `apps/local-core`: File registry service, Path Guard, schema v4 repository and trusted source API.
- `packages/domain`: `FileRecord`, `FileRecordId`, Revision link; path removed from Artifact/Revision.
- `packages/contracts`: FileRecord snapshot/repository and trusted selection contracts.
- `tests`: Phase 3 architecture gates, migration/path/registration/server/integration coverage.
- `docs`: Git audit, ADRs, Stage 4 plan and this review.

## 10. Commits

- `106af18` — Phase 2.5 runtime guard closure
- `5224088` — Phase 3 ADRs and architecture gates
- `dc9ed1b` — Zustand working store
- `35d198e` — trusted source identity, migration and Path Guard
- `0874d64` — integration fixture alignment
- `f77edd9` — isolated React Flow Spike (separate worktree/branch)

## 11. Next recommendation

After review approval, implement Stage 5 File Observation first:

```text
stat
→ unchanged fast path
→ changed size/mtime
→ streaming SHA-256
→ FileRecord stale/missing/unreadable
→ never auto-create Revision
```

Then activate `ARCH-P3-006`. Renderer Registry, Preview cache, worker pool and
PDF remain untouched and require the next approved stage.

## Rollback

Revert the Stage 4 commit to remove the new identity path, or restore a migrated
database from its `.v3.bak`. Revert the Zustand commit independently for Web
working state. No real source file was written or deleted.
