# Phase 3 Stage 4 — File Identity and Trusted Path Plan

## Change reason

Phase 3 must represent a real selected source without making the Browser a path authority. The current model stores `Artifact.localPath` and `ArtifactRevision.localPath`, which conflates content identity, version evidence and the latest observed disk state.

## Before flow

```text
Browser/ViewModel
→ string path on Artifact
→ Local Core metadata
```

There is no trusted picker boundary, FileRecord, initial import command or shared Path Guard.

## After flow

```text
Browser
→ requestPickFile()
→ TrustedFilePicker adapter
→ Local Core trusted selected path
→ PathGuard
→ transaction:
   FileRecord
   + Artifact
   + ArtifactRevision(source=import)
   + Artifact.currentRevisionId
→ Browser receives IDs and metadata
```

Subsequent browser requests use IDs, not arbitrary absolute paths.

## User operation change

The user selects a source through a trusted picker boundary. No free-form absolute-path registration is exposed as a formal Browser API.

## Data flow change

- `Artifact` remains content identity.
- `ArtifactRevision.contentHash` freezes version evidence.
- `FileRecord.observedHash` represents the most recent disk observation.
- The initial revision and current revision pointer are created atomically.

## Impacted modules

- `packages/domain`
- `packages/contracts`
- `apps/local-core`
- architecture and integration tests

No production Canvas/Inspector redesign is included.

## File and schema migration

- Add `file_records`.
- Add `artifact_revisions.file_record_id`.
- Keep legacy path columns only as repository compatibility until a later approved cleanup.
- Advance schemaVersion through an append-only migration with backup behaviour preserved.

## Development cost

One domain/contract slice, one migration/repository slice, one Local Core command/API slice and focused Windows path tests.

## Risks

- Windows case and junction/symlink resolution can invalidate naive prefix checks.
- Existing disposable fixtures may not have real files and must not be silently registered.
- A failed hash or transaction must not leave an Artifact without its initial Revision.

## Acceptance

- Source registration creates FileRecord + Artifact + Initial Revision atomically.
- Artifact.currentRevisionId points to the new Revision.
- Browser-facing formal API accepts no arbitrary absolute path.
- Path Guard verifies normalization, realpath, containment/external trusted policy and read permission.
- Real user files are never modified.
- Tests use disposable temporary files only.

## Rollback

Revert the Stage 4 commit. Migration rollback restores the pre-migration backup; no source file is ever modified or deleted.

## Evidence

- Dev Feedback v2 sections 10–13 and 11 “Source 导入必须直接创建 Initial Revision”.
- Current LCOS frozen Domain rules: Artifact ≠ ArtifactView; Revision evidence is immutable.
- No third-party SRC is treated as authority for LCOS file identity; this is an LCOS-specific domain decision.
