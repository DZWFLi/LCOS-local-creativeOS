# ADR — MVP Stage 5 Preview Worker Plan

Date: 2026-07-28
Status: Accepted / Implemented for TXT, Markdown and Image MVP
Branch: `codex/mvp-fast-build`
Base: `b6b06f6 feat(mvp): show preview record status`

## Decision

Stage 5 introduces preview generation only through a bounded Local Core worker boundary.

The first implementation supports:

- TXT preview
- Markdown preview as escaped/plain text or safe generated HTML/text, with no script execution
- Image preview by copying or normalizing only from already registered FileRecord paths

It does not include PDF preview, Bridge integration, Watcher-triggered jobs, user-file writes, schema migration, or browser-triggered shell.

## Why this ADR exists

Preview worker implementation touches red-zone behavior:

- Local Core reads source files through FileRecord paths.
- Local Core writes cache files.
- Worker cancellation/crash must not publish a false `ready` PreviewRecord.
- Cache path containment and atomic publish must be preserved.

The current MVP branch already exposes PreviewRecord status in Web, but does not generate previews.

## Current baseline

Implemented before this ADR:

- `PreviewRecord` domain model.
- SQLite schema v5 `preview_records`.
- `RendererRegistry`.
- `PreviewCacheService`.
- Read-only Web visibility for PreviewRecord status.

Important existing invariant:

```text
PreviewRecord/cache is rebuildable cache.
It is not Project Truth and does not bump semantic graphVersion.
```

## Proposed flow

```text
Web selects Runtime node
→ Web sees revisionId + preview status
→ user/dev action requests preview generation for revisionId/profile
→ Local Core validates revisionId
→ Local Core resolves ArtifactRevision → FileRecord
→ Worker reads registered observedPath
→ Renderer produces bytes
→ PreviewCacheService writes tmp file
→ atomic rename to cache file
→ only after successful rename: upsert PreviewRecord ready
→ Web refreshes preview records
```

Failure / unsupported flow:

```text
No renderer
→ PreviewRecord unsupported

Read/render error
→ PreviewRecord failed with errorMessage

Abort/crash before atomic publish
→ no ready PreviewRecord
→ tmp file cleaned when possible
```

## Contract shape

Recommended first route:

```text
POST /projects/:projectId/previews
```

Request:

```json
{
  "revisionId": "revision-id",
  "previewProfile": "thumbnail"
}
```

Response:

```json
{
  "ok": true,
  "value": {
    "record": "PreviewRecord",
    "reused": false
  }
}
```

Rules:

- Browser sends only opaque ids, never local paths.
- Route remains loopback-only through Local Core.
- No shell execution.
- No external network.
- No arbitrary path input.
- Generation is cache work, not Project Truth mutation.

## Worker boundary

Recommended MVP implementation:

- `PreviewWorkerService`
  - owns concurrency and cancellation.
  - exposes `generate({ projectId, revisionId, previewProfile, signal })`.
- `PreviewRenderer`
  - pure-ish renderer interface by mime type/profile.
  - returns bytes and output mime type.
- `PreviewCacheService`
  - remains the only publisher of `ready` PreviewRecord.

Concurrency:

- Heavy task concurrency: 1.
- Light task concurrency: 2 for TXT/MD/Image only if implementation remains simple.
- First MVP can use concurrency 1 to reduce risk.

## Renderer rules

TXT:

- Read bounded bytes.
- Output text/plain.
- Limit preview size.

Markdown:

- MVP-safe option: output escaped text/plain.
- If HTML is used, sanitize and do not execute scripts.
- Do not load remote resources.

Image:

- Read from FileRecord path only.
- Initial MVP may copy original image to cache for supported image mime types.
- Do not transcode through new dependencies unless separately approved.

PDF:

- Out of Stage 5 implementation.
- Requires separate Stage 6/8 plan because PDF rendering usually introduces new dependency and heavier worker behavior.

## Safety invariants

- Never accept paths from the browser.
- Never publish `ready` until cache bytes are fully written and atomically renamed.
- Never write cache outside cache root.
- Never update Artifact, ArtifactRevision, FileRecord, Workspace, or graphVersion as part of preview generation.
- Never create ArtifactRevision automatically.
- Never delete user files.
- Treat cache cleanup as best-effort and scoped to cache root.

## Tests required before implementation is accepted

Architecture:

- Convert `ARCH-P3-010 worker crash or cancellation cannot publish ready PreviewRecord` from todo to a real passing test.
- Assert preview jobs do not change semantic graphVersion.
- Assert browser production clients still expose no arbitrary-path preview API.

Local Core:

- TXT generation creates ready PreviewRecord and cache file.
- Markdown generation creates ready PreviewRecord and cache file.
- Image generation creates ready PreviewRecord and cache file.
- Unsupported mime type creates `unsupported`, not `ready`.
- Missing file creates `failed`, not `ready`.
- Abort/cancel before publish does not leave `ready`.
- Renderer throw does not leave `ready`.
- Cache path escape is rejected.

Web:

- Preview generation call, if exposed, sends revisionId/profile only.
- Work Rail updates from `not-generated` to `ready/failed/unsupported` after refresh.

## Rollback

Revert the Stage 5 implementation commit.

Because Preview is cache-only:

- No Project Truth rollback is needed.
- Cache files can be deleted if and only if path containment under cache root is verified.
- PreviewRecord rows can be deleted by project id if needed; Project graph remains recoverable.

## Explicit non-goals

- No Bridge.
- No Run.
- No Watcher.
- No PDF.
- No user-file import UX.
- No schema migration.
- No external network.
- No shell.
- No new dependency without approval.
