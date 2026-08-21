# Stage 7A Runtime Source Gate Revert Audit

> Date: 2026-07-29  
> Branch: `codex/mvp-fast-build`  
> Audited commit: `a896cd5 feat(mvp): gate runtime source import`  
> Backup branch created: `backup/mvp-fast-build-before-import-revert`

## 1. Commit Scope

`a896cd5` changed:

```text
M apps/web/src/App.tsx
M apps/web/src/features/diagnostics/RuntimeDiagnosticsPage.tsx
M apps/web/src/runtime/localCoreClient.ts
M apps/web/tests/localCoreClient.test.ts
M apps/web/tests/runtimeBridge.test.ts
A docs/audit/MVP_STAGE7_IMPORT_AND_BRIDGE_REALITY_GATE_2026-07-29.md
A docs/handoffs/MVP_STAGE7_IMPORT_BRIDGE_GATE_2026-07-29.md
```

## 2. Product Gate Behavior to Revert

- Production drag/drop copy changed to say files are temporary and will not survive refresh/restart.
- Runtime Diagnostics added `Runtime Source Import Gate`.
- Stage 7A documentation framed drag/drop persistence as blocked by trusted source selection.

These behaviors conflict with the MVP V1 decision:

```text
Drop = Import Copy
Trusted Selection = External Source Binding
```

## 3. Diagnostic Copy to Revert or Supersede

- `Runtime Source Import Gate` panel.
- Any user-facing statement that ordinary drag/drop is intentionally temporary.
- Stage 7A audit/handoff documents must be marked superseded if preserved.

## 4. Security Boundaries to Preserve

- Browser must not submit arbitrary absolute local paths.
- `POST /projects/:projectId/sources` must continue to accept only opaque `selectionId`.
- `TrustedFileSelectionRegistry` and `Path Guard` remain valid for External Source Binding.
- Security tests around `/sources` remain valuable, but should be reintroduced only if they do not preserve the wrong product gate.

## 5. Reusable Ideas

- Typed Web client methods are useful, but the specific Stage 7A client method is for External Source Binding, not Import Copy.
- Runtime Diagnostics may later show Import Copy health, but it must not replace the real import path with an explanatory gate.

## 6. Related History Search

Search findings:

- `Runtime Source Import Gate`: only `a896cd5`.
- `刷新/重启不会保存`: only `a896cd5`.
- `temporary preview`: only `a896cd5`.
- `selectionId`: also appears in earlier Local Core source identity commits. Those are retained as External Source Binding infrastructure.
- `previewUrl` / `previewText` temporary frontend drop behavior existed before `a896cd5` and must be replaced by Import Copy rather than merely reverted.

## 7. Revert Plan

1. Revert `a896cd5` as a full commit.
2. Mark Stage 7A documents as superseded only if they remain after revert or are reintroduced as history.
3. Implement Stage 7B Import Copy Persistence:
   - multipart import API;
   - Local Core import transaction;
   - idempotency by `projectId + importRequestId`;
   - Web temporary importing node replacement with Runtime ArtifactView;
   - restart recovery tests.
