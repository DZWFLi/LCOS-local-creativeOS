# MVP V1 Slice 4 Bridge Purified Baseline Handoff

Date: 2026-07-29
Branch: `codex/mvp-fast-build`
Base HEAD: `f1d2474`

## Task summary

Reviewed the Bridge migration package and LCOS MVP v1.2 Runtime / Context / Retry
supplement, then imported a minimal provider-side Bridge Core baseline into:

```text
tools/ai-bridge-runtime/
```

No LCOS Adapter, Schema migration, Canonical Run, RuntimeDispatch,
ArtifactReturn or WorkBuddy Executor wiring was implemented.

## Actual scope

Imported:

- MCP Bridge entry point;
- Task / Session / Result / Artifact / Message / Health / Metrics services;
- repositories, validators, schemas and JSON Runtime abstraction;
- capability registry example;
- six original core lifecycle tests;
- selected provider protocol documents.

Added:

- private-source ownership and provenance record;
- security rules and packaging denylist;
- reproducible Python dependency declaration;
- explicit Runtime Root requirement;
- loopback-only host guard;
- three purification safety tests.

Removed from the imported server:

- direct WorkBuddy Automation database writer.

Excluded:

- watcher and watcher configuration;
- companion / Route C headless scripts and registry;
- credentials and tokens;
- runtime snapshots and migration history;
- Web console and launch scripts;
- user Skills, Memory and AGENTS;
- personal task templates;
- caches and compiled Python files.

## Decision

LCOS Function:
Provide an auditable provider runtime source baseline before implementing
`ContextManifestV0 -> RuntimeInputPackV0 -> Canonical Run -> RuntimeDispatch ->
Bridge Task`.

Open-source Evidence:

- [SRC-BRIDGE-001] `E:\Buddy项目\ai-bridge\bridge_server.py`
- [SRC-BRIDGE-002] `E:\Buddy项目\ai-bridge\app\services\tasks.py`
- [SRC-BRIDGE-003] `E:\Buddy项目\ai-bridge\app\services\results.py`
- [SRC-BRIDGE-004] `E:\Buddy项目\ai-bridge\app\runtime\storage.py`
- [SRC-BRIDGE-005] migration research ZIP dated 2026-07-28
- [SRC-BRIDGE-006] LCOS MVP v1.2 Runtime / Context / Retry supplement

Adoption Mode:
User-owned private source purification.

What We Borrow:

- provider Task lifecycle;
- provider Session metadata;
- structured result / `changed_files`;
- report modes;
- Health / Metrics;
- focused lifecycle tests.

What We Do Not Borrow:

- Bridge `task_id` as LCOS `runId`;
- Provider status as LCOS Run status;
- Bridge Artifact as LCOS Artifact Truth;
- Bridge Runtime JSON as Project Truth;
- Provider retrying as user Retry;
- fake `waiting_input` or Conversation Resume;
- watcher as execution engine;
- historical Runtime state.

Implementation:

- provider baseline: `tools/ai-bridge-runtime/`;
- LCOS Adapter: not implemented;
- LCOS Domain / Schema: unchanged.

Tests:

```text
python -m unittest discover -s tests -v
PASS 9/9

Bridge import smoke with audited external venv
PASS

--host 0.0.0.0
REJECTED by argparse as expected

git diff --check
PASS
```

License:
No license file was present in the source package. The baseline is documented as
user-owned private source. Python dependencies retain their upstream licenses.

## Flow change

Before:

```text
external untracked Bridge directory
→ personal Runtime / watcher / companion mixed with source
```

After:

```text
LCOS Git
→ purified provider Bridge Core
→ explicit disposable Runtime Root
→ future thin Adapter approval gate
```

User-visible product behavior: unchanged.

## Risks and unresolved items

- The original migration ZIP contains a private credential; it was not imported.
  The original credential still requires external rotation.
- Bridge create-task is not idempotent by `lcos_run_id` and has no recovery
  lookup. RuntimeDispatch crash recovery is therefore not yet implementable.
- Bridge Session does not resume native WorkBuddy Conversation.
- `waiting_input` is not implemented.
- historical Runtime shows `running` / `review` accumulation.
- Bridge Artifact storage has duplicate-ID risk and remains provider evidence only.
- Adapter and Result Ingestion still require a separate red-zone approval.

## Rollback

Revert the purified baseline commit. It has no Schema change, no Runtime state,
no dependency installation and no external Bridge mutation.

## Next step

Produce a short RuntimeDispatch / Adapter impact proposal covering:

- existing LCOS tables and contracts;
- `lcos_run_id` idempotency or recovery query;
- Provider-to-LCOS status mapping;
- RuntimeInputPack path materialization;
- Result Ingestion idempotency and Path Guard;
- Retry creating a new Run;
- restart recovery.

Stop before implementation and request Dz approval.
