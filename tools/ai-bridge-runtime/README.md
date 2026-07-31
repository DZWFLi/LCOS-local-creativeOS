# LCOS AI Bridge Runtime — Purified Baseline

This directory is a purified source baseline derived from the user-owned local
AI Bridge source at:

```text
E:\Buddy项目\ai-bridge
```

It preserves the provider-side Task, Session, Result, Artifact, Health, Metrics,
Capability Registry and message services needed for Slice 4 research. It is not
yet connected to Local Core.

## Current truth

Verified provider capabilities:

- create / claim / start / cancel / supersede Task;
- submit result and finalize provider review;
- Session metadata and heartbeat;
- structured `changed_files` and path-style Artifact records;
- `report_mode=full|short|silent`;
- Health and Metrics;
- six focused core lifecycle tests.

Known limits:

- Bridge `task_id` is not an LCOS `runId`;
- Bridge Session is metadata, not resumable WorkBuddy conversation history;
- `waiting_input` is not implemented;
- provider `review`, `retrying`, `timeout` and `assigned` are not LCOS Run states;
- Bridge Artifact records are Run output evidence, not LCOS Artifact truth;
- JSON Runtime storage is not an event store;
- LCOS task creation is idempotent by `lcos_run_id`, request identity and
  canonical request fingerprint inside one Bridge server process;
- `get_task_by_lcos_run_id` restores the persisted mapping after restart;
- Health declares `bridge-task-v0` / `bridge-result-v0` capabilities;
- watcher / WorkBuddy execution routing is not included in this baseline.

The Slice B contract is not a Local Core Adapter and does not prove WorkBuddy
execution. Running multiple Bridge processes against one Runtime Root is
unsupported.

Frozen contract:
[`docs/protocols/lcos-runtime-contract-v0.md`](docs/protocols/lcos-runtime-contract-v0.md).

## Source-of-truth boundary

LCOS owns Canonical Run, ContextManifestV0, RuntimeInputPackV0,
RuntimeDispatch/Binding, Project Path Guard, ArtifactReturn, Draft Revision,
Accept/Reject/Retry and Current Revision.

Bridge owns provider Task/Session identifiers, provider status, execution result
summary, `changed_files`, provider Artifact records and provider metrics.

The two systems exchange IDs through a future thin Adapter. They do not share a
database or treat Bridge Runtime JSON as LCOS Project Truth.

## Runtime safety

The runtime directory must be explicit:

```powershell
$env:AI_BRIDGE_RUNTIME_ROOT='E:\some-disposable-loopback-only-runtime'
python bridge_server.py --host 127.0.0.1 --port 8920
```

The purified server rejects non-loopback host values. Never point
`AI_BRIDGE_RUNTIME_ROOT` at an LCOS project directory or import historical
runtime snapshots.

## Tests

Core tests require only the Python standard library:

```powershell
python -m unittest tests.test_core_flow -v
```

Server import/startup additionally requires the dependencies declared in
`pyproject.toml`. This baseline records them but does not install them into the
LCOS JavaScript workspace.

## Explicit exclusions

The baseline excludes credentials, tokens, personal paths, runtime snapshots,
WorkBuddy/Codex Skills, user Memory/AGENTS files, companion scripts, watcher,
Route C headless worker configuration, Web console, launch scripts, caches and
compiled Python files.

See `SECURITY.md`, `OWNERSHIP.md` and the Slice 4 audit under
`docs/audit/` for the complete decision.
