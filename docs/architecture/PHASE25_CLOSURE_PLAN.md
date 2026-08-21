# Phase 2.5 Closure Plan

## Change reason

Phase 3 requires trusted file identity and Preview work to build on an ordered, versioned data spine. The current Phase 2.5 implementation fails that prerequisite.

## Before flow

```text
App state snapshot
→ generate full set of upsert ops
→ Promise chain
→ mutation response without new semantic version
→ next save uses stale base
→ 409 / reload / retry
```

Generic mutation routes can also create or update Revision and Checkpoint without a lifecycle command.

## After flow

```text
UI/domain action
→ explicit semantic or presentation op
→ pending batch + single in-flight request
→ Local Core transaction
→ response includes authoritative semanticGraphVersion
→ ordered acknowledgement
→ next batch uses acknowledged version
```

Revision and Checkpoint changes use explicit lifecycle commands/services. Note anchors are runtime validated. Workspace focus uses `focusedViewIds`.

## User operation change

No visible interaction changes. Save ordering and stale conflict handling become deterministic.

## Data flow change

- Presentation operations never advance semantic version.
- Semantic operations advance it once per successful transaction.
- Relation deletion is semantic.
- Mutation acknowledgement returns the authoritative semantic version.
- Stale reload state is returned to the caller instead of silently discarded.

## Impacted modules

- `packages/domain`
- `packages/contracts`
- `apps/local-core`
- `apps/web/src/runtime`
- Phase 2.5 architecture/integration tests

## File and schema migration

The domain name becomes `focusedViewIds`. Existing SQLite column compatibility may remain behind the repository adapter during this closure; no destructive database migration is allowed in this commit.

## Cost

One closure commit plus focused tests and one complete Phase 2.5 gate.

## Risks

- Renaming focus fields has broad compile impact.
- Retrying an operation after stale reload can overwrite newer state unless the operation is action-level and revalidated.
- Removing generic lifecycle operations may expose hidden test/fixture dependencies.

## Acceptance

- P25-01 through P25-08 have executable evidence.
- A-slow/B-new ordered mutation test passes.
- Presentation and semantic version tests use exact assertions.
- Local Core unit, integration and Phase 2.5 checks pass.
- No Project Truth is persisted by Web localStorage.

## Rollback

Revert the closure commit. The dedicated Phase 3 worktree can be deleted without affecting the original detached worktree or the research evidence directory.
