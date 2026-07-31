# MVP V1 Slice 4 Bridge Purification Gate

> Superseded for implementation scope by
> `MVP_V1_SLICE4_BRIDGE_RESEARCH_PACKAGE_REVIEW_2026-07-29.md`.
> This document remains as the initial audit record.

Date: 2026-07-29
Branch: `codex/mvp-fast-build`
LCOS HEAD at audit start: `2b4ec17`
External source: `E:\Buddy项目\ai-bridge`

## Decision

LCOS Function:
Enter Slice 4 by preparing a reproducible Bridge runtime baseline for `ContextManifestV0 -> RuntimeInputPack -> Canonical LCOS Run -> Bridge Adapter -> WorkBuddy -> changed_files`.

Open-source Evidence:
- Project: existing local AI Bridge / WorkBuddy code package
- [SRC-BRIDGE-001] `E:\Buddy项目\ai-bridge\bridge_server.py`
- [SRC-BRIDGE-002] `E:\Buddy项目\ai-bridge\app\services\tasks.py`
- [SRC-BRIDGE-003] `E:\Buddy项目\ai-bridge\app\services\results.py`
- [SRC-BRIDGE-004] `E:\Buddy项目\ai-bridge\app\validators\__init__.py`
- [SRC-BRIDGE-005] `E:\Buddy项目\ai-bridge\app\runtime\storage.py`
- [SRC-BRIDGE-006] `E:\Buddy项目\ai-bridge\workbuddy_watcher.py`
- [SRC-BRIDGE-007] `E:\Buddy项目\ai-bridge\tests\test_core_flow.py`
- [SRC-BRIDGE-008] `E:\Buddy项目\ai-bridge\tests\test_watcher_semantics.py`

Adoption Mode:
Clean-room extraction into an LCOS-owned source package first. Adapter wiring is a later approval gate.

What We Borrow:
- Task lifecycle service shape: create, claim, start, submit review result, finalize review.
- Session and project routing concepts.
- `changed_files` as structured execution evidence.
- Watcher as a WorkBuddy inbox router, not as LCOS file watcher.
- Focused unit tests around task/result lifecycle and watcher semantics.

What We Do Not Borrow:
- Bridge `task_id` as LCOS `runId`.
- Bridge runtime JSON files as LCOS Project Truth.
- External Bridge task history, logs, cache, private tokens, local inbox configuration, or personal absolute paths.
- Watcher-driven execution start as canonical LCOS Run state.
- Bridge decision over Artifact, Revision, Current, Accept, Retry, or Reject.

Implementation:
No Bridge code has been copied into LCOS in this audit. The recommended next commit, after Dz approval, is a separate purified baseline under an LCOS-owned directory.

Tests:
Not run in this audit. Existing external tests discovered:
- `E:\Buddy项目\ai-bridge\tests\test_core_flow.py`
- `E:\Buddy项目\ai-bridge\tests\test_watcher_semantics.py`

License:
No explicit license file was found during this quick gate. Treat the external package as private local source until Dz confirms license/ownership. Do not import third-party production code from this package without license review.

## Current External State

The external Bridge directory is a Git repository, but all visible files are untracked. It is not a reproducible baseline yet.

Observed exclude candidates:

```text
venv/
__pycache__/
app/__pycache__/
app/storage/
runtime/logs/
companion/.token_private.json
bridge_response_4f371f3c.txt
*.docx
local batch launchers unless rewritten for LCOS
personal docs/prompts unless explicitly retained as reference docs
watcher_config.json with personal absolute paths
```

Sensitive/local path observations:

- `companion/.token_private.json` is ignored and must not be imported.
- `watcher_config.json` contains personal absolute inbox mappings.
- docs and examples contain `E:\Buddy项目\...` and `C:\Users\1\...` absolute paths.
- `scripts\build_tech_docx.py` hard-codes source and output paths under `E:\Buddy项目\ai-bridge`.
- `app\runtime\storage.py` defaults runtime state to `Path.home() / ".ai_bridge"`.

## Purified Baseline Proposal

Recommended target directory:

```text
tools/ai-bridge-runtime/
```

Rationale:
The current Bridge is Python runtime infrastructure, not a TypeScript LCOS domain package. `tools/` keeps it clearly outside `packages/domain` and `packages/contracts`, while still versioning the source needed for Slice 4.

Recommended include list:

```text
tools/ai-bridge-runtime/README.md
tools/ai-bridge-runtime/bridge_server.py
tools/ai-bridge-runtime/capability_registry.json
tools/ai-bridge-runtime/app/
tools/ai-bridge-runtime/tests/test_core_flow.py
tools/ai-bridge-runtime/tests/test_watcher_semantics.py
tools/ai-bridge-runtime/docs/protocols/
```

Recommended conditional include:

```text
tools/ai-bridge-runtime/workbuddy_watcher.py
```

Include it only if clearly labeled as WorkBuddy inbox router. It must not be described as LCOS file observation watcher.

Recommended exclude list:

```text
venv/
runtime/
app/storage/
__pycache__/
companion/.token_private.json
companion/.last_dispatch.json
bridge_response_*.txt
*.docx
start_bridge.bat
start_workbuddy_watcher.bat
watcher_config.json
test_auto.py
personal prompt templates
personal example task files
```

## Adapter Boundary For Next Approval

LCOS side:

- owns `lcos_run_id`
- persists Canonical Run and RunEvent cursor
- builds RuntimeInputPack from ContextManifestV0
- stores external Bridge task mapping
- validates `changed_files` with Project Path Guard
- decides ArtifactReturn, Draft Revision, Accept, Retry, Reject, and Current

Bridge side:

- owns external `task_id`
- exposes create / query / status / submit-result primitives
- routes WorkBuddy inbox by project identity
- returns structured result evidence
- never mutates LCOS Project Truth directly

Minimum adapter contract:

```text
createExternalTask(lcosRunId, runtimeInputPack) -> { externalTaskId }
getExternalTask(externalTaskId) -> status/result/events
pollExternalEvents(externalTaskId, afterSeq) -> RunEvent[]
normalizeChangedFiles(result) -> ChangedFileEvidence[]
```

## Go / No-Go For Copying Baseline

Go only if Dz approves:

- target directory, recommended `tools/ai-bridge-runtime/`
- include/exclude list above
- separate commit for purified baseline
- no adapter wiring in the same commit

No-Go until resolved:

- missing explicit license/ownership note
- personal absolute path leakage in imported files
- runtime data or private token file included
- Bridge `task_id` treated as LCOS `runId`
- watcher confused with LCOS file watcher

## Next Step

Ask Dz to approve or adjust the target directory and include/exclude list. After approval, perform the purified baseline copy, run only focused Bridge tests if feasible, commit that baseline, then discuss LCOS Adapter wiring as the next Slice 4 sub-step.
