# MVP V1 Slice 3 — File Evolution

## Task Summary

Slice 3 completes the explicit external file evolution path:

```text
Manual Refresh
→ current / stale / missing / unreadable
→ explicit user Adopt
→ New External Revision
→ Current pointer update
```

No filesystem Watcher, automatic Revision, source overwrite, or Schema migration was
introduced.

## Change Flow

Before:

```text
external file changes
→ Refresh
→ FileRecord stale
→ Artifact stale
→ no product action to adopt the change
```

After:

```text
external file changes
→ user clicks Refresh
→ Observation only
→ stale is visible
→ user clicks Adopt as New Revision
→ verify path content did not change again
→ create new FileRecord observation identity
→ old Revision = superseded
→ new external Revision = current
→ Artifact.currentRevisionId updated
→ Views following old Current move to new Current
→ Project graph version increments
```

## Decision

### LCOS Function

Allow a user to explicitly adopt a verified external file change without Watcher
creating a Revision automatically.

### Open-source Evidence

- LangGraph checkpoint identity:
  `E:\Codex 项目\OS开发\OS项目文档\LCOS-open-source-research\permissive\langgraphjs\libs\checkpoint\src\base.ts`
- n8n version / execution separation:
  `E:\Codex 项目\OS开发\OS项目文档\LCOS-open-source-research\source-available-research-only\n8n\packages\workflow\src\interfaces.ts`
- Watcher research gap and Chokidar audit requirement:
  `C:\Users\1\Desktop\OS开发\MVP重构\LCOS_MVP_V1_完整OS纵向能力_开源借鉴矩阵_v1.0.md`

### Adoption Mode

- identity and immutable history pattern;
- LCOS self-build for Observation and Current Revision policy.

### What We Borrow

- immutable revision identity;
- old execution/version history is not rewritten;
- explicit state transition after verification.

### What We Do Not Borrow

- LangGraph state as Project Truth;
- n8n workflow version semantics;
- automatic Watcher adoption;
- source file overwrite.

### Implementation

- `apps/local-core/src/file-observation-service.ts`
  - explicit `adopt(fileRecordId)`.
- `apps/local-core/src/metadata-repository.ts`
  - transactional FileRecord / Revision / Artifact / View update.
- `apps/local-core/src/server.ts`
  - `POST /file-records/:fileRecordId/adopt`.
- `apps/web/src/runtime/localCoreClient.ts`
  - Refresh and Adopt Runtime calls.
- `apps/web/src/runtime/runtimeBridge.ts`
  - graph reload after state transition.
- `apps/web/src/features/workrail/WorkRail.tsx`
  - file status, Refresh, and stale-only Adopt action.
- `apps/web/src/model.ts`
  - Runtime FileRecord availability projection.

### Tests

- stale does not create Revision;
- missing and unreadable remain explicit;
- content returning to the frozen hash returns current;
- explicit adopt creates new Current and supersedes old Revision;
- a second file change between Refresh and Adopt is rejected.

### License

No GPL or source-available implementation code was copied.

## Data Safety

- Browser sends only opaque `fileRecordId`.
- Local Core resolves the trusted path from stored FileRecord identity.
- Adopt is allowed only for `stale`.
- Local Core hashes and stats the file again immediately before adoption.
- If content changed after Refresh, adoption returns Conflict and creates no Revision.
- Old Revision remains immutable and becomes `superseded`.
- New Revision uses `source: external`.
- No source file is written, moved, deleted, or overwritten.
- The transaction increments Project graph version.

## Test Results

```text
npx vitest run apps/local-core/tests/file-observation-service.test.ts --reporter=dot
PASS — 6/6

npm run typecheck --workspace @local-creative-os/local-core
PASS

npm run typecheck --workspace @local-creative-os/web
PASS
```

Full integration, architecture, browser, and restart tests remain deferred to the
unified MVP closeout.

## Browser-visible Change

For Runtime nodes with a FileRecord, Work Rail now shows:

- current / stale / missing / unreadable status;
- Refresh File Status;
- Adopt as New Revision only when status is stale.

After adoption, Runtime graph reloads and the selected node points to the new Current
Revision.

## Risks and Unfinished Work

- Manual browser verification is pending.
- No Chokidar dependency or automatic Watcher.
- Multiple simultaneous Adopt requests are serialized by SQLite, but a dedicated
  concurrent-request test is deferred.
- Old FileRecord remains as historical observation identity; Revision content hash is
  the immutable historical content evidence.

## Rollback

Revert the Slice 3 commit. No Schema rollback is required.

## Next

The project has reached the Slice 4 Bridge purification gate.

Stop and discuss with Dz before importing Bridge code or wiring a real Executor.
