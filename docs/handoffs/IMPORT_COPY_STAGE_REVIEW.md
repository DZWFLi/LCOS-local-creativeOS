# Import Copy Stage Review

> Date: 2026-07-29  
> Branch: `codex/mvp-fast-build`

## 1. Reverted Commit

- `cd2ed05 Revert "feat(mvp): gate runtime source import"`
- Backup branch: `backup/mvp-fast-build-before-import-revert`
- Revert audit: `docs/audit/STAGE7A_RUNTIME_SOURCE_GATE_REVERT_AUDIT.md`

## 2. Reverted Old Behavior

Removed the product direction that treated dropped files as permanently temporary:

- No `Runtime Source Import Gate` production explanation.
- No user-facing copy saying normal dropped files necessarily disappear.
- No use of `/sources` as the only story for ordinary drag/drop persistence.

## 3. Preserved Safety Boundaries

- Browser still cannot submit arbitrary absolute paths.
- Existing `POST /projects/:projectId/sources` remains trusted `selectionId` only.
- Path Guard and Trusted Selection Registry remain for External Source Binding.
- Import Copy writes only inside the project-owned `imports/` directory.

## 4. Import Copy API

```http
POST /api/local-core/v1/projects/:projectId/imports
Content-Type: multipart/form-data
```

Fields:

```text
file
importRequestId
scopeId
position.x
position.y
sourceKind=import_copy
```

Browser does not submit:

```text
absolutePath
targetPath
observedPath
```

## 5. Local Core Service

Added `ImportCopyService`.

Responsibilities:

- validate supported MVP extensions: `.md`, `.txt`, `.png`, `.jpg`, `.jpeg`, `.webp`;
- enforce 25 MiB file limit;
- create project `imports/`;
- write `.tmp`;
- hash content;
- atomic rename to final project-owned file;
- create FileRecord, Artifact, Initial ArtifactRevision and ArtifactView;
- reuse the same Runtime entities for repeated `importRequestId`.

## 6. File Transaction

Current flow:

```text
multipart file
→ validate size/type
→ write imports/<request-id>-<safe-name>.tmp
→ hash bytes
→ rename to imports/<request-id>-<safe-name>
→ SQLite transaction
   → FileRecord
   → Artifact
   → Initial Revision
   → ArtifactView
→ graph_version + 1
```

DB failure path:

```text
SQLite transaction throws
→ rollback
→ imported file removed
```

Unsupported type path:

```text
reject before file write
→ no imports residue
→ no database residue
```

## 7. Idempotency

Idempotency key:

```text
projectId + importRequestId
```

Implementation:

- deterministic IDs derived from `importRequestId`;
- repeated request returns existing FileRecord / Artifact / Revision / View;
- no duplicate ArtifactView is created.

## 8. Temporary → Runtime Replacement

Web drop flow:

```text
drop file
→ create Importing temporary node at drop coordinate
→ upload File through Import Copy
→ RuntimeBridge reloads Project Graph
→ temporary graph is replaced by Runtime graph
→ selected node switches to returned ArtifactView
→ Preview generation is requested for returned Revision
```

Failure:

```text
temporary node remains marked Import failed
```

## 9. Tests and Results

```text
npx vitest run apps/local-core/tests/server.test.ts --reporter=verbose
PASS — 37 tests

npx vitest run apps/local-core/tests/server.test.ts apps/web/tests/localCoreClient.test.ts apps/web/tests/runtimeBridge.test.ts --reporter=verbose
PASS — 52 tests

npm run check:fast
PASS

npm run test:integration
PASS

npm run test:architecture
PASS (inside check:fast and focused run)
```

## 10. Browser E2E

Automated browser E2E was not added in this slice.

Manual browser acceptance should verify:

```text
open Runtime project
→ drop MD / TXT / JPG / PNG / WEBP
→ see Importing
→ see Runtime node with Runtime identity
→ Preview status appears
→ refresh browser
→ node remains
→ restart Local Core
→ node remains
```

## 11. Refresh / Restart Recovery

Covered at Local Core level:

- import creates FileRecord / Artifact / Revision / View;
- close and reopen repository using the same SQLite file;
- recovered graph still contains imported identity chain.

## 12. `/sources` External Binding

`POST /sources` is retained for:

```text
External Source Binding
→ trusted selector creates selectionId
→ browser submits selectionId only
→ Local Core registers external source through Path Guard
```

It is no longer treated as the blocker for ordinary dropped-file persistence.

## 13. Changed Files

Backend:

- `apps/local-core/src/import-copy-service.ts`
- `apps/local-core/src/server.ts`
- `apps/local-core/src/metadata-repository.ts`
- `apps/local-core/src/index.ts`
- `apps/local-core/tests/server.test.ts`

Frontend:

- `apps/web/src/App.tsx`
- `apps/web/src/model.ts`
- `apps/web/src/runtime/localCoreClient.ts`
- `apps/web/src/runtime/runtimeBridge.ts`
- `apps/web/src/features/canvas/CanvasNodeVisual.tsx`
- `apps/web/src/surface.css`
- `apps/web/tests/localCoreClient.test.ts`
- `apps/web/tests/runtimeBridge.test.ts`

Docs:

- `docs/audit/STAGE7A_RUNTIME_SOURCE_GATE_REVERT_AUDIT.md`
- `docs/handoffs/IMPORT_COPY_STAGE_REVIEW.md`

## 14. Commits

Created before this review:

- `611acd9 docs(mvp): audit runtime source gate revert`
- `cd2ed05 Revert "feat(mvp): gate runtime source import"`
- `1c042da feat(local-core): add import copy persistence`
- `17c2170 feat(web): persist dropped files via import copy`

## 15. Known Limits

- Supported Import Copy formats: MD, TXT, PNG, JPG, JPEG, WEBP.
- PPT / DOCX / PDF Import Copy preview is not implemented in this slice.
- Browser E2E for physical drag/drop is still pending.
- Import Copy stores a project-owned copy; External Source Binding remains a separate future UI entry.
- No Bridge, Watcher, Safe Write, Artifact Return, or automatic Revision adoption was implemented.

## 16. Post-review Hardening

The independent read-only review found that entity IDs were originally derived from
`importRequestId` alone. The implementation now derives IDs from:

```text
projectId + importRequestId
→ deterministic scoped identity
→ FileRecord / Artifact / Revision / View IDs
```

This prevents the same request ID from reusing entities across Projects.

An idempotent replay is accepted only when the existing Project, file name, content
hash, and Scope match. An incompatible replay returns HTTP `409 CONFLICT` and does
not create a second file or ArtifactView.

Additional hardening:

- Import Copy rejects browser-supplied `path`, `absolutePath`, `targetPath`,
  `observedPath`, and `rootPath` fields.
- Temporary files are removed if publish fails.
- Published files and temporary files are removed if SQLite registration fails.
- The focused Local Core server suite passed: `40/40`.

Not verified in this focused pass:

- physical browser drag/drop;
- concurrent requests using the same idempotency key;
- the complete repository quality chain.
