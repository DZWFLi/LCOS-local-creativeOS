# Frontend Interaction Foundation Contract Handoff

> Status: implemented as pure TypeScript contract vocabulary only
> Scope: `packages/domain`, `packages/contracts`, and contract unit tests
> Explicitly excluded: Local Core, REST, SQLite, filesystem, Preview implementation, and Bridge implementation

## Delivered vocabulary

- Project, Workspace, Artifact, ArtifactView, ArtifactRevision, Note, ContextSnapshot, Command, Conversation, Run, RunEvent, ChangedFile, ArtifactReturn, and Checkpoint.
- Frozen Run states: `queued`, `running`, `waiting_input`, `review`, `completed`, `failed`, `cancelled`.
- Explicit separation of Command target and ContextSnapshot references.
- Revision status distinguishes `draft`, `current`, and `superseded`.
- ArtifactView distinguishes its default primary reference from an explicit additional reference; a persistence layer must preserve that distinction.
- Artifact Return placement is represented by the pure `resolveArtifactReturnPlacement()` rule: Target → Working → Run → Pending Return Zone.
- Workspace query and viewport update commands are available for the Dock/camera adapter.
- Preview state/result is explicit and carries `origin: "fixture" | "runtime"`.
- Result/Error contracts carry the same origin marker so Fixture cannot be presented as Runtime.

## Frontend usage rules

1. Treat `Run.id` as dynamic runtime data; fixtures must not infer it from a node title or GUI thread name.
2. A Run holds one immutable `contextSnapshotId`; creating a new Context Snapshot requires a new Run.
3. Pending Artifact Returns remain non-current until an explicit accept action yields a Current ArtifactRevision.
4. Artifact Notes and ArtifactView Notes use distinct `NoteAnchor` scopes.
5. `packages/contracts` are pure application boundaries. They do not promise HTTP endpoints, database tables, filesystem access, or Bridge connectivity.

## Validation

Each package now owns its TypeScript configuration, lint script, typecheck script, and test location. The contract tests cover the frozen Artifact Return precedence, terminal Run statuses, preview origin, and boundary separation.

Run the package checks directly until the root quality gate is updated:

```text
npm run lint --workspace @local-creative-os/domain
npm run typecheck --workspace @local-creative-os/domain
npm run test --workspace @local-creative-os/domain
npm run lint --workspace @local-creative-os/contracts
npm run typecheck --workspace @local-creative-os/contracts
npm run test --workspace @local-creative-os/contracts
```

The root scripts must explicitly invoke these package scripts before `npm run check` can claim coverage of them.

## Frontend import entry

The intended future adapter imports are:

```ts
import type { Artifact, PreviewResult, Workspace, WorkspaceViewportCommand } from '@local-creative-os/domain'
import type { PreviewContract, Result, WorkspaceQueryContract } from '@local-creative-os/contracts'
```

The current frontend still consumes its local `model.ts` and `fixtures.ts`; this handoff does not claim that the Web app has migrated to these contracts.

## Deferred decisions

- Persistence representation for explicit additional ArtifactView references.
- Runtime idempotency, SSE replay, write leases, and structured errors.
- SQLite schema/migrations, Local Core API, Preview adapters, filesystem watcher, and Bridge adapter.
- Any execution channel beyond Codex.
