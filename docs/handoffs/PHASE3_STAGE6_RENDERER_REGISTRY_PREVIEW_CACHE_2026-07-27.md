# Phase 3 Stage 6 — Renderer Registry + Preview Cache Handoff

Date: 2026-07-27

## Completed

- Added minimal `PreviewRecord` domain model.
- Added SQLite schema v5 migration for `preview_records`.
- Added `RendererRegistry` with first supported renderer identities:
  - image
  - text
  - markdown
- Added `PreviewCacheService`.
- Preview cache key is derived from:
  - source content hash
  - renderer id
  - renderer version
  - preview profile
- Ready previews write through temp file then rename to final cache file.
- Unsupported formats create `unsupported` PreviewRecord and do not report `ready`.
- Preview cache records and files can be removed without changing Project Truth.

## Preserved Boundaries

- No Worker pool.
- No PDF.js.
- No Watcher.
- No Bridge / Run / SSE.
- No real user file writes.
- No automatic ArtifactRevision creation.
- No Preview data in `ProjectGraphSnapshot`.
- Preview jobs do not bump semantic `graphVersion`.

## Flow

Before:

```text
ArtifactRevision
→ FileRecord
→ no formal preview cache identity
```

After:

```text
ArtifactRevision.contentHash
→ FileRecord.mimeType
→ RendererRegistry.select(profile)
→ cacheKey(hash + renderer id + version + profile)
→ tmp cache file
→ final cache file
→ PreviewRecord ready
```

Unsupported:

```text
FileRecord.mimeType
→ no renderer
→ PreviewRecord unsupported
→ no ready preview
```

## Tests

Focused checks:

```text
npm run typecheck --workspace @local-creative-os/domain
npm run typecheck --workspace @local-creative-os/contracts
npm run typecheck --workspace @local-creative-os/local-core
npx vitest run apps/local-core/tests/preview-cache-service.test.ts apps/local-core/tests/metadata-repository.test.ts tests/architecture/phase3-boundaries.test.ts --reporter=verbose
```

Result:

```text
PASS
27 passed / 3 todo before final architecture todo cleanup
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
Web: 26 files / 96 tests passed
Local Core: 9 files / 68 tests passed
Domain: 1 file / 5 tests passed
Contracts: 1 file / 4 tests passed
Integration: 5 passed
Architecture: 23 passed / 1 todo
Build: PASS
```

Architecture tests converted from todo:

```text
ARCH-P3-004 deleting Preview cache preserves Project Truth
ARCH-P3-007 Preview jobs do not change semanticGraphVersion
ARCH-P3-008 identical source hash, renderer/version, and profile reuse cache
ARCH-P3-009 renderer version changes produce a cache miss
ARCH-P3-011 unsupported formats cannot report successful Preview
```

Remaining todo:

```text
ARCH-P3-010 worker crash or cancellation cannot publish ready PreviewRecord
```

This is intentionally left for Phase 3 Stage 7 Worker.

## Modified Files

- `packages/domain/src/index.ts`
- `packages/contracts/src/index.ts`
- `apps/local-core/src/metadata-repository.ts`
- `apps/local-core/src/renderer-registry.ts`
- `apps/local-core/src/preview-cache-service.ts`
- `apps/local-core/src/index.ts`
- `apps/local-core/tests/preview-cache-service.test.ts`
- `apps/local-core/tests/metadata-repository.test.ts`
- `apps/local-core/tests/file-registry-service.test.ts`
- `apps/local-core/tests/file-observation-service.test.ts`
- `tests/architecture/data-spine.test.ts`
- `tests/architecture/phase3-boundaries.test.ts`

## Not Done

- No actual image / text / markdown rendering implementation.
- No bounded worker pool.
- No worker crash recovery.
- No PDF preview.
- No browser preview UI integration.

## Next

Phase 3 Stage 7:

```text
Worker + Image / TXT / MD
```
