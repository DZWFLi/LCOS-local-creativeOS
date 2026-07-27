# Phase 3 Stage 5 — File Observation Handoff

Date: 2026-07-27

## Completed

- Added `FileObservationService`.
- Added manual HTTP refresh endpoint:
  - `POST /file-records/:fileRecordId/refresh`
- Observation accepts only opaque `FileRecord.id`.
- Browser-facing refresh does not accept or trust a file path.
- Observation flow:
  - `stat`
  - unchanged size / mtime keeps current known state
  - changed size / mtime triggers streaming SHA-256
  - hash differs from frozen current Revision hash → `stale`
  - file missing → `missing`
  - non-file / unreadable path → `unreadable`
- Artifact display availability is synchronized:
  - FileRecord `current` → Artifact `available`
  - FileRecord `stale` → Artifact `stale`
  - FileRecord `missing` → Artifact `missing`
  - FileRecord `unreadable` → Artifact `stale`

## Preserved Boundaries

- No Watcher.
- No automatic directory scan.
- No real user file writes.
- No automatic ArtifactRevision creation.
- Existing frozen `ArtifactRevision.contentHash` remains unchanged.
- Observation does not bump Project `graphVersion`.
- No Preview / Renderer / Worker / PDF work.

## Flow

Before:

```text
FileRecord
→ stored import-time observedHash
```

After:

```text
FileRecord.id
→ stat observedPath
→ if size/mtime changed: streaming SHA-256
→ compare with Artifact.currentRevisionId → ArtifactRevision.contentHash
→ update FileRecord availability
→ update Artifact display availability
→ keep Revision list unchanged
```

## Tests

Focused checks:

```text
npm run typecheck --workspace @local-creative-os/local-core
npx vitest run apps/local-core/tests/file-observation-service.test.ts apps/local-core/tests/file-registry-service.test.ts apps/local-core/tests/server.test.ts tests/architecture/phase3-boundaries.test.ts --reporter=verbose
```

Result:

```text
PASS
45 passed / 6 todo
```

Final checks:

```text
npm run check:fast
npm run test:integration
npm run test:architecture
```

Result:

```text
PASS
Web: 26 files / 95 tests passed
Local Core: 8 files / 63 tests passed
Domain: 1 file / 5 tests passed
Contracts: 1 file / 4 tests passed
Integration: 5 passed
Architecture: 18 passed / 6 todo
Build: PASS
```

Architecture test converted from todo:

```text
ARCH-P3-006 external observation does not automatically create Revision
```

## Not Done

- No live filesystem watcher.
- No PreviewRecord.
- No Preview cache.
- No worker pool.
- No PDF.js.
- No Bridge / AI Run.

## Next

Phase 3 Stage 6:

```text
Renderer Registry + Preview Cache
```
