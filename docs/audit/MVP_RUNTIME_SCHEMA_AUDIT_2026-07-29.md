# MVP Runtime / Schema Audit

Date: 2026-07-29
Branch: `codex/mvp-fast-build`
Audit HEAD: `4341eb9`
Current Schema Version: `5`
Status: read-only decision; no Schema or Adapter implementation

## Decision

LCOS Function:
Prepare the minimum persistent execution spine for one Project, one WorkBuddy
provider and one Markdown Script Revision flow.

Open-source Evidence:

- [SRC-BRIDGE-CORE] `tools/ai-bridge-runtime/`
- [SRC-LCOS-DOMAIN] `packages/domain/src/index.ts`
- [SRC-LCOS-CONTRACTS] `packages/contracts/src/index.ts`
- [SRC-LCOS-SCHEMA] `apps/local-core/src/metadata-repository.ts`
- [SRC-LCOS-MANIFEST] `apps/local-core/src/context-manifest-service.ts`

Adoption Mode:
LCOS self-build for Canonical Run, RuntimeDispatch, RuntimeBinding,
ContextManifest persistence and ArtifactReturn. Bridge remains a provider
runtime behind a thin Adapter.

What We Borrow:
Provider Task lifecycle, Session metadata, structured `changed_files`, Health
and result-review primitives.

What We Do Not Borrow:
Bridge Task ID as Run ID, Provider status as Run status, Bridge JSON as Project
Truth, Provider Artifact as LCOS Artifact, old-task retry as user Retry, fake
`waiting_input`, or native Conversation Resume.

License:
The purified Bridge baseline is recorded as user-owned private source.

## 1. Current evidence

### 1.1 Existing tables

Schema v5 contains:

```text
projects
scopes
workspaces
artifacts
artifact_views
relations
artifact_revisions
notes
checkpoints
file_records
preview_records
```

It does not contain:

```text
context_manifests
commands
conversations
runs
run_events
runtime_dispatches
runtime_bindings
artifact_returns
changed_files
```

There are no synonymous Run, Dispatch, Binding or Return tables.

### 1.2 Existing migrations

Migration code is embedded in `SqliteMetadataRepository`:

```text
v1 / v2 → v3
v3 → v4 FileRecord
v4 → v5 PreviewRecord
```

Current version is hard-coded as `5`.

Existing migration tests cover:

- Fresh database;
- malformed v1 failure backup;
- v3 → v4 FileRecord migration and backup;
- migration without deleting project truth;
- restart recovery for existing graph/checkpoint data.

There is no v5 → v6 test because v6 does not exist yet.

### 1.3 Existing Domain shells

`packages/domain` already contains Phase 5 shell types:

- ContextSnapshot;
- Command;
- Conversation;
- Run;
- RunEvent;
- ChangedFile;
- ArtifactReturn.

They are not persisted or served by Local Core.

Conflicts with the frozen Canonical Contract:

- `RunStatus` contains `review`;
- `RunStatus` lacks `created`;
- `RunExecutor` is only `codex`, while MVP provider is WorkBuddy;
- Run requires Conversation, Command and ContextSnapshot shell IDs;
- Run lacks target Artifact/Revision, ContextManifest, retry lineage and error
  fields;
- ArtifactReturn uses `disposition` rather than
  `pending_review / adopted / rejected`;
- ArtifactReturn has no base Revision, returned FileRecord, action or update
  timestamp;
- Execution contracts expose `continueRun`, implying behavior that is not
  implemented and should not be used to fake `waiting_input`.

Conclusion: these are shell types, not reusable Canonical Runtime truth. They
must be minimally reconciled rather than copied into a second type family.

### 1.4 ContextManifestV0

Current behavior:

```text
Project Graph
→ ContextManifestService.build()
→ rendered Markdown + hash
→ HTTP response / Web copy or download
```

It is deterministic for the same graph but is not persisted.

Missing frozen properties:

- immutable Manifest ID;
- `createdAt`;
- canonical JSON and canonical JSON hash;
- structured instruction and acceptance criteria;
- structured decisions;
- persisted target Revision identity;
- API to retrieve an immutable Manifest by ID.

Current `renderedManifestHash` hashes Markdown, not canonical JSON.
`renderedMarkdown` is embedded inside the Manifest object instead of being a
separate renderer result.

No absolute local paths are emitted in the current Manifest, which is reusable.

### 1.5 ArtifactRevision and FileRecord

Reusable facts:

- ArtifactRevision already has `runId?`;
- ArtifactRevision already has parent Revision, source and status;
- FileRecord is a separate identity and stores observed path/hash/size/mime;
- streaming SHA-256 already exists;
- Source registration, Import Copy and external adoption already create
  FileRecord + Revision transactionally;
- `idx_revision_current` guarantees at most one `current` Revision per Artifact.

Gaps:

- Revision status is only `draft / current / superseded`; no rejected state;
- no dedicated returned-file registration service;
- no Result Ingestion idempotency record;
- no ArtifactReturn-to-Draft transaction;
- no accepted/rejected lifecycle command.

### 1.6 Current Revision update safety

There is no formal Domain Command dedicated to accepting an ArtifactReturn.

Safe transactional precedents exist:

- `registerSource`;
- `registerImportedSource`;
- `adoptExternalChange`.

But two generic paths can bypass the future review lifecycle:

```text
POST Project Graph Mutation
→ upsert_artifact
→ arbitrary currentRevisionId

PUT /projects/:projectId/artifacts/:artifactId
→ metadata.upsertArtifact()
→ arbitrary currentRevisionId
```

Repository FK checks ensure the Revision exists, but they do not prove that an
ArtifactReturn was pending review or accepted.

Before Accept/Reject implementation, browser-facing generic Artifact writes
must be prevented from changing `currentRevisionId`. Current changes must go
through an explicit transactional lifecycle service.

### 1.7 Bridge / Provider fields in Project Graph

No Bridge Task ID, Provider Session, Provider status or RuntimeDispatch fields
are stored in `ProjectGraphSnapshot` or existing SQLite graph tables.

This is good: the new runtime spine can remain separate from Canvas graph
serialization.

## 2. Answers required by the gate

1. Existing Run table or synonym: **No**.
2. RuntimeBinding / Dispatch / Return synonym: **No**.
3. Command / ContextSnapshot / Run only shell types: **Yes**.
4. Migration version and tests: **v5**, embedded repository migrations and
   `apps/local-core/tests/metadata-repository.test.ts`.
5. ArtifactRevision sourceRun/status: **`runId?` exists; status exists but lacks
   rejected**.
6. FileRecord returned-file support: **structurally reusable; no dedicated
   returned-file ingestion**.
7. Formal currentRevision Domain Command: **No; only specialized repository
   transactions and generic upsert paths**.
8. Generic Mutation bypass risk: **Yes**.
9. Bridge fields scattered in graph: **No**.
10. Correct landing:
    - Domain states and invariants: `packages/domain`;
    - boundary DTOs/contracts: `packages/contracts`;
    - v6 persistence: `apps/local-core/src/metadata-repository.ts`;
    - runtime lifecycle services: new Local Core service files;
    - browser-safe routes: `apps/local-core/src/server.ts`;
    - Provider implementation: Local Core Adapter calling
      `tools/ai-bridge-runtime`.

## 3. Canonical Contract freeze

### 3.1 LcosRun

```text
status:
created | queued | running | waiting_input | completed | failed | cancelled
```

`waiting_input` may remain an enum value but has no MVP behavior or UI.

Provider-only states:

```text
assigned | review | retrying | timeout
```

Minimum identity:

```text
id
projectId
workspaceId?
targetArtifactId
targetRevisionId
contextManifestId
retryOfRunId?
provider = workbuddy
status
instruction
resultSummary?
shortSummary?
errorCode?
errorMessage?
createdAt
updatedAt
completedAt?
```

### 3.2 RuntimeDispatch

```text
id
runId
provider
idempotencyKey = runId
status = planned | dispatching | bound | failed | recovery_required
externalTaskId?
externalSessionId?
providerStatus?
attemptCount
lastErrorCode?
lastErrorMessage?
createdAt
updatedAt
```

For MVP, RuntimeDispatch may physically carry RuntimeBinding fields. Code must
still treat dispatch lifecycle and provider binding as separate concepts.

### 3.3 ArtifactReturn

```text
status = pending_review | adopted | rejected
action = created
runId
targetArtifactId
baseRevisionId
returnedFileId
contentHash
canonicalPath
draftRevisionId?
createdAt
updatedAt
```

Provider `review` maps to:

```text
LcosRun = completed
ArtifactReturn = pending_review
Draft Revision created once
Current Revision unchanged
```

### 3.4 Retry

User Retry always creates:

```text
new LcosRun
retryOfRunId = oldRunId
new RuntimeDispatch
new Bridge Task
new expected output path
```

The old Run never returns to queued/running.

## 4. Bridge recovery contract freeze

Both capabilities are required:

```text
create_task(
  lcos_run_id,
  idempotency_key
)

get_task_by_lcos_run_id(lcos_run_id)
```

Required behavior:

- the first create stores both values with the Provider Task;
- a repeated create for the same LCOS Run returns the existing Task;
- mismatched reuse of an idempotency key returns a structured conflict;
- lookup returns zero or one Task;
- the mapping survives Bridge restart;
- tests cover repeated create and recovery lookup;
- neither API creates LCOS Project Truth.

The purified Bridge currently has neither capability. This is a known,
bounded Slice B change and must land before Local Core claims dispatch crash
recovery.

## 5. Schema impact

Recommended next Schema version: `6`.

Minimum new tables:

```text
context_manifests
runs
runtime_dispatches
artifact_returns
```

`runtime_dispatches` may carry RuntimeBinding fields for MVP. A separate
`runtime_bindings` table is not required unless implementation evidence shows
that the combined row cannot preserve the two concepts.

Recommended constraints/indexes:

- unique `runtime_dispatches.idempotency_key`;
- unique non-null `runtime_dispatches.external_task_id`;
- index Run by Project/status;
- index Dispatch by status;
- unique ArtifactReturn ingestion identity over:
  `run_id + canonical_path + content_hash + action`;
- foreign keys to Project, Run, Artifact, Revision and FileRecord;
- immutable ContextManifest row with canonical JSON/hash.

No existing table needs destructive replacement.

## 6. Before / after flow

Before:

```text
Project Truth
→ ephemeral ContextManifest response
→ Markdown Handoff

Web local UI
→ placeholder Run presentation
```

After the separately approved implementation:

```text
BEGIN LCOS TRANSACTION
  immutable ContextManifest
  LcosRun(created)
  RuntimeDispatch(planned)
COMMIT
→ Bridge idempotent create
→ Runtime binding
→ Run queued
→ provider sync
→ changed_files Path Guard
→ ArtifactReturn.pending_review
→ Draft Revision
→ explicit Accept / Reject / Retry
```

Browser never calls Bridge and never supplies absolute paths.

## 7. Required Migration tests

Slice A must include:

- Fresh v6 database;
- v5 → v6 upgrade;
- v5 backup before migration;
- migration failure preserves original data;
- foreign-key check;
- Run + Dispatch(planned) same-transaction crash window;
- restart reload of Run / Dispatch / Manifest / Return;
- unique idempotency and external Task constraints;
- existing v1/v2/v3/v4 upgrade chain still reaches v6.

## 8. Architecture tests to add

```text
ARCH-RUN-001
LCOS Run rejects assigned/review/retrying/timeout

ARCH-RUN-002
Provider status never becomes Run status directly

ARCH-RUN-003
Provider review creates completed Run + pending ArtifactReturn

ARCH-DISPATCH-001
Run and planned Dispatch are created atomically

ARCH-DISPATCH-002
Browser cannot call Bridge

ARCH-DISPATCH-003
Dispatch idempotency is unique per Run

ARCH-CONTEXT-001
Markdown is rendered from persisted ContextManifest

ARCH-CONTEXT-002
Manifest contains no absolute path or Provider data

ARCH-CONTEXT-003
Manifest is immutable

ARCH-RETRY-001
Retry creates a new Run

ARCH-RETRY-002
Terminal Run cannot be revived

ARCH-RETRY-003
New Run records retryOfRunId

ARCH-REVISION-001
Generic Artifact mutation cannot change currentRevisionId
```

## 9. Risks

- Existing shell Domain types conflict with the frozen runtime contract;
- changing them can affect old UI placeholder tests;
- generic Artifact writes can bypass Accept;
- ContextManifest persistence changes the current response-only service;
- embedded migrations make v6 a high-impact repository edit;
- Bridge JSON persistence needs an explicit LCOS Run index for crash recovery;
- ArtifactReturn ingestion touches file safety, hashing and Revision lifecycle;
- the full implementation spans multiple red-zone concepts and must be sliced.

## 10. Stop conditions and recommendation

No synonymous tables were found, so there is no duplicate-Schema stop.

There are material contract conflicts and a generic-mutation bypass, but both
have bounded minimal remedies.

Recommendation:

```text
GO for separately approved Slice A:
Canonical Contracts + Migration v6 only

STOP before:
Bridge contract code
Local Core Adapter
Result Ingestion
Accept / Reject / Retry
```

Slice A must be committed and reviewed before Slice B.

## 11. Rollback

This audit only adds Markdown reports. Removing the reports restores the prior
worktree. No Schema, Runtime or product behavior changed.

