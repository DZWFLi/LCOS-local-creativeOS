# MVP Stage 7 — Import Persistence & Bridge Reality Gate

> Date: 2026-07-29  
> Branch: `codex/mvp-fast-build`  
> Baseline HEAD: `4e4d321 test(mvp): harden stage6 recovery acceptance`

## 1. Summary

Stage 7 is not a pure implementation stage. It is a reality gate for two capabilities that are often mistaken for “small UI features”:

1. Persisting newly imported local files as Runtime-backed Project Truth.
2. Connecting Bridge as the real execution loop.

Current conclusion:

- Runtime-backed sample project, recovery, file identity and preview cache are already proven through Stage 6.
- Newly dragged browser files are still temporary Web nodes. They are not Runtime Sources and therefore are expected to disappear after refresh/restart.
- Local Core already has the safe source registration primitive: `POST /projects/:projectId/sources`.
- That primitive intentionally accepts only opaque `selectionId`, not browser-supplied absolute paths.
- Browser-only drag/drop cannot safely provide stable local file identity under the current architecture boundary.
- Bridge does not pass the MVP Reality Gate yet because the inspected Bridge source tree has no committed Git baseline and remains largely untracked.

## 2. Runtime Source Import Current State

### Existing backend contract

Local Core exposes:

```text
POST /projects/:projectId/sources
```

Body:

```json
{
  "selectionId": "opaque-selection-id",
  "title": "optional title"
}
```

Important guard:

- `path`, `absolutePath`, and `rootPath` are rejected by the HTTP route.
- The browser is not allowed to submit arbitrary local file paths.
- `TrustedFileSelectionRegistry` is the only place that may temporarily bind a local path to an opaque selection id.
- `FileRegistryService.registerSource()` then creates:
  - `FileRecord`
  - `Artifact`
  - `ArtifactRevision`

This backend design is correct for OS boundaries.

### Existing frontend behavior

`apps/web/src/App.tsx` currently handles dropped files by creating local `CanvasNode` objects with:

- `previewUrl`
- `previewDataUrl`
- `previewText`
- subtitle such as `本地图片 · 临时预览`

These nodes are not registered through Local Core and do not receive:

- `revisionId`
- `fileRecordId`
- `contentHash`
- `observedPath`
- Runtime preview status

Therefore they are not saved as Project Truth.

## 3. Why Dragged Files Do Not Persist

This is not currently a SQLite/schema failure.

The missing piece is the trusted import bridge between the browser and Local Core:

```text
Browser File object
→ temporary Web preview only
→ no selectionId
→ no Local Core source registration
→ no FileRecord / Revision
→ refresh/restart drops the node
```

The safe intended flow is:

```text
Trusted native/local selector
→ Local Core stores path behind opaque selectionId
→ Web submits selectionId only
→ Local Core path guard validates project/external-source rules
→ FileRecord + Artifact + Revision are persisted
→ Web reloads Runtime graph
```

## 4. Schema Change Judgment

No schema change is required for Stage 7 import persistence.

Reason:

- `FileRecord`, `Artifact`, and `ArtifactRevision` already exist.
- `registerSource()` already persists the required records.
- Preview and observation services already read from these identities.
- The gap is adapter/UI contract, not storage model.

## 5. Red/Yellow Boundary

### Safe / allowed

- Add Web client method for existing `POST /sources`.
- Add UI that clearly says browser drag/drop is temporary unless registered.
- Add tests proving the route still rejects raw paths.
- Add docs and diagnostics for Runtime Source import readiness.

### Yellow, needs short approval before implementation

- Add a dev-only trusted selection helper.
- Add a server-side import folder picker/registry.
- Allow external sources outside project root through explicit Local Core option.

### Red unless ADR-approved

- Let Web submit arbitrary absolute paths.
- Persist uploaded file bytes as Project Truth without a file ownership design.
- Add Electron/Tauri/native shell only to solve import.
- Let Bridge or browser write real user files directly.

## 6. Bridge Reality Gate Findings

Inspected Bridge locations:

- `E:\Buddy项目\ai-bridge`
- `E:\Codex 项目\buddy协同测试`

Current evidence:

- Bridge source directory exists.
- Branch is `main`.
- The tree has no usable committed source baseline; most files are untracked.
- Existing source/docs mention `changed_files`, watcher routing, task/result protocols and absolute path validation.
- Existing audit docs already warned that Bridge source provenance was not production-safe.

Current Gate result: **No-Go for direct MVP main-path integration.**

Reason:

The first Go condition fails:

```text
Bridge 仓库、Runtime Root、安装和测试可复现
```

Until Bridge has a committed Git baseline and reproducible install/test evidence, OS should not merge a Bridge adapter into the main MVP path.

## 7. Revised Time Estimate

Assuming strict scope control:

| Work item | Estimate | Notes |
|---|---:|---|
| Stage 7 audit + decision doc | 0.5 day | This document is the start. |
| Runtime Source Import safe UI/client layer | 0.5–1 day | Only if trusted `selectionId` source exists. |
| Proper trusted local file selector | 1–2 days | Needs approved local/native/dev adapter boundary. |
| Bridge Git baseline + reproducible test proof | 0.5–1 day | In Bridge repo, before OS integration. |
| OS Bridge thin adapter after Gate passes | 1–2 days | Run identity, changed files read-only return first. |
| Merge MVP back to mainline | 0.5 day | Conflict audit + full quality chain. |

Best-case path:

```text
Today:
  Stage 7 audit + safe import decision
Tomorrow:
  Bridge baseline + reproducible smoke
Next 1–2 days:
  Thin Bridge adapter
Then:
  MVP branch merge to mainline
```

Conservative path:

```text
2–4 days:
  finish import boundary + Bridge gate + mainline merge
3–6 days:
  begin true OS Bridge loop without overextending into full Artifact Return
```

## 8. Recommended Stage 7 Execution Plan

### Stage 7A — Close Runtime Source truthfully

1. Add frontend `registerSource(selectionId)` client method.
2. Keep drag/drop as explicitly temporary preview.
3. Add Runtime Diagnostics copy explaining temporary vs Runtime Source.
4. Add tests proving:
   - raw path is rejected;
   - selectionId route works;
   - temporary dropped files are not silently promoted to Project Truth.

This can be done now without schema change.

### Stage 7B — Decide trusted selector

Choose one:

1. MVP-safe: keep import persistence limited to sample/seeded Runtime Sources.
2. Dev-only: add an explicit, clearly labeled trusted selection helper for local testing.
3. Product-correct: wait for native shell / approved Bridge file authorization.

### Stage 7C — Bridge Reality Gate

Before OS integration:

1. Establish Bridge Git baseline.
2. Run Bridge tests from clean checkout.
3. Prove task idempotency with an OS-compatible `lcos_run_id` or mapping.
4. Prove `changed_files` returns stable absolute paths.
5. Prove path containment against Sample Project root.
6. Prove no source-file overwrite is required.
7. Only then design OS adapter.

## 9. Risk

The largest remaining risk is not time; it is false confidence.

If browser drag/drop is silently promoted into Project Truth through raw paths or copied bytes, MVP will look complete but violate the OS architecture.

If Bridge is connected before Git/test/provenance is fixed, MVP will inherit an unreproducible execution dependency.

## 10. Current Recommendation

Proceed with Stage 7A immediately:

- make the current import limitation explicit in UI/diagnostics;
- wire Web client to the existing safe source-registration contract;
- keep browser drag/drop temporary unless a trusted selector exists;
- do not connect Bridge yet.

Then run Bridge baseline as a separate Reality Gate task.
