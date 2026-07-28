# 09 — Known Issues

## Confirmed limitations

### Bridge not connected

No Run / SSE / waiting_input / Artifact Return loop exists in this MVP branch.

### Preview is not yet real rendering

PreviewRecord and renderer registry infrastructure exist, but the MVP branch does not yet provide worker-backed MD/TXT/Image/PDF preview rendering through Web.

### Watcher is not enabled

File observation is manual API-level infrastructure only. No filesystem watcher and no automatic ArtifactRevision creation are enabled.

### Sample project is disposable

`disposable-mvp-sample` is a dev sample. It is not a real import workflow and should not be presented as user-file ingestion.

### Runtime identity shows local paths

Stage 2 exposes observed source path in Work Rail. This is useful for dev validation, but before real user import UX decide whether to show full path, project-relative path, or masked path.

### Demo fallback still exists

Frontend Fixture / Demo paths remain for tests, diagnostics, and fallback. UI must continue to label Demo vs Runtime clearly.

## Non-blockers

- Existing lint warnings in `apps/web/src/App.tsx`.
- Node experimental SQLite warning.
- Architecture test has one existing todo.

## Red-zone items not to “quick fix”

- Schema migration.
- Domain semantic changes.
- Bridge lifecycle.
- Artifact Return.
- Watcher.
- Real user-file writes.
- Automatic Revision.
- Browser-triggered shell.
- Non-loopback Local Core binding.

