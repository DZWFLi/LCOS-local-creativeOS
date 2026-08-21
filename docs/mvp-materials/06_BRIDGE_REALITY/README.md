# 06 — Bridge Reality

## Status

Bridge is not part of the current MVP fast-build core.

Current branch `codex/mvp-fast-build` does not connect:

- Run creation
- SSE / event stream
- `waiting_input`
- Artifact Return
- Accept / Retry
- Changed Files
- Bridge executor recovery

## What exists

The repository has broader Alpha product requirements describing a future Bridge loop, but this MVP slice only proves Runtime project graph visibility and sample persistence.

## Why Bridge stays out for this round

Bridge touches red-zone semantics:

- canonical Run identity;
- user confirmation states;
- Artifact Return;
- changed file ownership;
- retry lineage;
- conflict and waiting-input handling.

Those require an ADR / handoff and explicit approval before implementation.

## MVP-safe substitute

For demo and handoff, represent execution state as documentation and explicit sample notes only.

Do not create fake Run records that appear canonical.
Do not label mock execution as Runtime Bridge.

## Required pre-Bridge audit

Before Bridge enters MVP scope, write a short ADR covering:

- Run lifecycle and state transitions.
- Event source and retry behavior.
- Artifact Return target model.
- File write ownership and conflict path.
- UI states for `queued`, `running`, `waiting_input`, `review`, `completed`, `failed`.
- Recovery behavior after restart.
- Tests and rollback.

