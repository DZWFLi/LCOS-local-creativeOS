# LCOS Executor / Bridge Communication Protocol

## 0.1 result submission contract

The canonical executor result is `bridge-result-v1`.

For `changedFiles`, every item uses the **result-side** shape:

```json
{
  "path": "C:\\absolute\\project\\output.md",
  "action": "created",
  "role": "deliverable",
  "mediaType": "text/markdown",
  "contentHash": "<optional sha256>"
}
```

Rules:

- `changedFiles[].path` is required and must be absolute.
- Do **not** submit `absolutePath` inside `changedFiles`. `absolutePath` belongs to task/input-output descriptors, not result-side `ChangedFileV1`.
- `outputId`, `required`, and other Task/ExpectedOutput envelope fields are not valid inside a changed-file result item.
- `providerStatus=failed|cancelled|timeout|waiting_input` must not include changed files.
- `waiting_input` requires `inputRequest`; other statuses must not include it.
- Unknown fields are rejected by the Bridge contract (`extra=forbid`).

## Executor preferred path and legal fallback

Preferred execution path:

```text
Codex session
→ lcos-executor MCP
→ get_lcos_run_context / claim / start / heartbeat / submit_lcos_result
→ Local Core executor routes
→ Light Bridge
```

A resumed Codex session can retain an older tool surface. If `lcos-executor` was not exposed when that session was created, a later `resume` may report an unsupported MCP call even when the current LCOS executor server registers the tool.

For LCOS 0.1 this is a **known compatibility condition**, not permission to invent equivalent state transitions. The executor may use the matching Local Core REST executor route only when the MCP call is unavailable, and must record a warning/evidence marker that REST fallback was used. The payload and state-transition contract remain identical.

Do not silently fall back for ordinary agent/project tools. The exception is narrowly scoped to executor continuation compatibility until resumed-session MCP exposure is made authoritative.

## Runtime endpoint binding

All runtime processes must receive explicit endpoint bindings. Never rely on a development default when a test or desktop host owns its own ports.

At minimum:

```text
LCOS_CORE_URL=http://127.0.0.1:43121
LCOS_BRIDGE_URL=http://127.0.0.1:43122
LCOS_CORE_TOKEN_FILE=<authoritative token file>
```

Golden-path scripts that start a dedicated Bridge must pass that exact Bridge URL into Local Core. A task created on one Bridge and claimed on another is a contract failure, not a retry condition.

## Evidence commit identity

Release evidence must record the full `git rev-parse HEAD` hash. Short hashes are display-only and must not be used by the release gate for identity checks.
