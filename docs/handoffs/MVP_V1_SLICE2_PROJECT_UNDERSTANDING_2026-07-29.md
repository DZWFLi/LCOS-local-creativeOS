# MVP V1 Slice 2 — Project Understanding

## Task Summary

Slice 2 establishes a real Project Truth → ContextManifestV0 → Handoff path.

It does not connect Bridge, create Runs, change SQLite Schema, or persist a second copy
of project truth.

## Actual Scope

```text
Project Graph
→ Current Revision / FileRecord
→ Reference / Feedback Relations
→ Notes / Checkpoints
→ ContextManifestV0
→ deterministic Markdown
→ Preview / Copy / Download
```

Runtime Canvas projection now distinguishes Reference and Feedback sources from their
persisted Relation roles. Relation endpoints are projected to ArtifactView IDs rather
than incorrectly assuming Artifact IDs are Canvas node IDs.

## Decision

### LCOS Function

Build a provider-neutral, path-free context package from Project Truth for both human
Handoff and the future RuntimeInputPack.

### Open-source Evidence

- n8n serialized schema:
  `E:\Codex 项目\OS开发\OS项目文档\LCOS-open-source-research\source-available-research-only\n8n\packages\cli\src\modules\n8n-packages\spec\serialized\`
- LangGraph serializer:
  `E:\Codex 项目\OS开发\OS项目文档\LCOS-open-source-research\permissive\langgraphjs\libs\checkpoint\src\serde\`
- LibTV explicit caller contract:
  `E:\Codex 项目\OS开发\OS项目文档\LCOS-open-source-research\behavior-only\libtv-skills\skills\libtv-skill\SKILL.md`

### Adoption Mode

- n8n: source-available research-only pattern.
- LangGraph: permissive serializer pattern.
- LibTV: behavior-only contract research.
- ContextManifestV0 semantics: LCOS self-build.

### What We Borrow

- versioned serialized boundary;
- deterministic output;
- separation between serializer and product entities;
- explicit caller input and provider-neutral output.

### What We Do Not Borrow

- n8n Project or Workflow Domain;
- LangGraph State as Project Truth;
- provider-specific request fields;
- local absolute paths;
- generic workflow nodes as Artifact or Revision.

### Implementation

- `packages/contracts/src/index.ts`
  - ContextManifestV0 contract and build input.
- `apps/local-core/src/context-manifest-service.ts`
  - deterministic builder from Project Graph and trusted Current files.
- `apps/local-core/src/server.ts`
  - `POST /projects/:projectId/context-manifests/v0`.
- `apps/web/src/runtime/localCoreClient.ts`
  - Local Core client method.
- `apps/web/src/runtime/runtimeBridge.ts`
  - Handoff bridge method and Reference / Feedback projection.
- `apps/web/src/features/handoff/HandoffDialog.tsx`
  - Runtime-only Preview / Copy / Download UI.
- `apps/web/src/App.tsx`
  - Handoff entry.

### Tests

- focused ContextManifest builder test;
- Local Core TypeScript check;
- Web TypeScript check.

Complete integration, architecture, browser, and restart tests are intentionally
deferred to the unified MVP V1 closeout as approved by Dz.

### License

No GPL or source-available implementation code was copied. The LCOS builder and UI
are clean-room implementations using only the documented behavioral patterns.

## Data and Security Boundaries

- No Schema migration.
- No new dependency.
- Manifest response contains no `observedPath` or Project root.
- Browser may send only optional `targetArtifactId` and `requestedOutput`.
- Current Revision is read from `Artifact.currentRevisionId`.
- Manifest is stably rebuilt; it does not become an alternate Project Truth store.
- Unreadable content is explicit.
- Text content is capped per item and truncation is recorded.

## Test Results

```text
npx vitest run apps/local-core/tests/context-manifest-service.test.ts --reporter=dot
PASS — 1/1

npm run typecheck --workspace @local-creative-os/local-core
PASS

npm run typecheck --workspace @local-creative-os/web
PASS
```

## Browser-visible Change

Runtime mode now exposes a `Handoff` button in the Project tab bar.

It opens a Runtime ContextManifest preview with:

- Schema and builder identity;
- item count;
- rendered manifest hash;
- Markdown preview;
- Copy Markdown;
- Download Handoff.

Demo mode cannot silently generate a Fixture Handoff.

## Risks and Unfinished Work

- Full browser interaction has not yet been manually verified.
- Feedback is structured in the Manifest projection, while the underlying Note Domain
  remains deliberately unchanged.
- Locked elements use explicit `Keep / Locked / 保留 / 锁定` lines; no semantic AI
  extraction is performed.
- ContextManifest is not yet connected to Bridge or Run.
- Slice 3 external-change adoption is not part of this commit.

## Rollback

Revert the Slice 2 commit. No Schema or stored Project data migration is required.

## Next

Proceed to Slice 3:

```text
Manual Refresh
→ stale / missing / unreadable
→ explicit Adopt External Change
→ New Revision
```

Do not begin Bridge import or adapter wiring before the Slice 4 discussion gate.
