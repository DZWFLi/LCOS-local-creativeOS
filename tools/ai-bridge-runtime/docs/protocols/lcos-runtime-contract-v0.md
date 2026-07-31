# LCOS Bridge Runtime Contract V0

Status: frozen by MVP Runtime Slice B.

## Ownership

```text
Local Core = Project, ContextManifest, Canonical Run, Return and Revision Truth
Bridge     = Provider Task identity, state and result evidence
WorkBuddy  = Executor
```

This contract does not connect Local Core or start WorkBuddy.

## TaskEnvelopeV0

```json
{
  "contractVersion": "bridge-task-v0",
  "lcosRunId": "run_xxx",
  "idempotencyKey": "run_xxx",
  "requestFingerprint": "sha256",
  "provider": "workbuddy",
  "taskType": "markdown_script_revision",
  "runtimeInputPackPath": "C:/approved-runtime/runtime-input-pack.json",
  "expectedOutputs": [
    {
      "absolutePath": "C:/approved-runtime/staging/script-draft-run_xxx.md",
      "mode": "create_new_file"
    }
  ],
  "timeoutSeconds": 600,
  "reportMode": "short"
}
```

The RuntimeInputPack path must identify an immutable, per-Run materialization.
Legacy `instruction`, `context`, `input_files`, `acceptance_criteria`,
`priority` and `capability` arguments are not trusted as additional LCOS task
semantics. The Bridge derives a fixed provider instruction from TaskEnvelopeV0.

## Canonical fingerprint

The fingerprint input is TaskEnvelopeV0 without `requestFingerprint`.

1. Normalize Windows drive/UNC or POSIX absolute path separators and dot
   segments without resolving the file.
2. Sort object keys recursively.
3. Preserve array order.
4. Encode UTF-8 JSON with no insignificant whitespace, ASCII escaping, NaN or
   Infinity.
5. Calculate SHA-256 lowercase hexadecimal.

The Bridge recalculates the fingerprint and rejects a caller-supplied mismatch.

## Idempotency and recovery

```text
first create
→ persist one Task
→ replayed=false

same run/key/fingerprint/version
→ return original Task
→ replayed=true

same run with incompatible identity
→ IDEMPOTENCY_CONFLICT
→ no second Task
```

The atomic identity operation is process-safe across RuntimeStorage instances
inside one Bridge server process. Multiple Bridge server processes must not
share one Runtime Root.

`get_task_by_lcos_run_id` is read-only and returns the persisted Task identity.
It never creates a Task or changes `updated_at`.

## ResultEnvelopeV0

```json
{
  "contractVersion": "bridge-result-v0",
  "taskId": "task_xxx",
  "lcosRunId": "run_xxx",
  "providerStatus": "review",
  "shortSummary": "Draft created.",
  "resultSummary": "Optional summary.",
  "changedFiles": [
    {
      "path": "C:/approved-runtime/staging/script-draft-run_xxx.md",
      "action": "created"
    }
  ]
}
```

Provider statuses are `review`, `failed`, `cancelled` or `timeout`. They are not
LCOS Run statuses. MVP accepts only `changedFiles.action=created`.

## Capabilities

Health declares:

```text
idempotentCreate    true
lookupByLcosRunId   true
structuredResult   true
cancel              true
finalize            true
eventsAfterSeq      false
```

Health does not expose the Runtime Root or storage file paths.

## Structured errors

```json
{
  "ok": false,
  "error": {
    "code": "IDEMPOTENCY_CONFLICT",
    "message": "...",
    "retryable": false,
    "httpStatus": 409
  }
}
```

`httpStatus` is semantic metadata in the MCP tool response; it is not a claim
that FastMCP changed the transport response status.

Frozen codes used by Slice B:

```text
CONTRACT_UNSUPPORTED
INVALID_TASK_ENVELOPE
INVALID_RESULT_ENVELOPE
INVALID_REQUEST_FINGERPRINT
IDEMPOTENCY_CONFLICT
TASK_NOT_FOUND
RUNTIME_ROOT_UNSET
RUNTIME_STORAGE_CORRUPT
```
