# ADR: Phase 3 Web Working State

- Status: Accepted for Phase 3 implementation
- Scope: Web working state only
- Decision owner: Local Creative OS
- Evidence baseline:
  - Zustand commit `beca84e600e4e250f6b244d22878e72948f331c7`
  - `LCOS_OPEN_SOURCE_RESEARCH_CODE_2026-07-26.zip`
  - `Local_Creative_OS_OpenSource_Code_Audit_Dev_Feedback_v2.md`

## Decision 1: Use one composed AppWorkingStore

### Decision

Use one Zustand `AppWorkingStore` composed from cohesive slices:

```text
CanvasSlice
WorkspaceSlice
SelectionSlice
InspectorSlice
MutationQueueSlice
RuntimeUiSlice
```

Slices share one store boundary and may coordinate through typed actions. Do
not create several independently persisted stores that synchronize the same
Project state.

### Evidence

- Dev Feedback v2: Zustand section, `[SRC-ZUSTAND-01]` through
  `[SRC-ZUSTAND-03]`.
- `[SRC-ZUSTAND-01]`
  `permissive/zustand/src/vanilla.ts`: the store exposes
  `setState/getState/getInitialState/subscribe`; partial updates merge before
  listeners are notified.
- `[SRC-ZUSTAND-02]`
  `permissive/zustand/src/react.ts`: React bindings read selected state through
  `useSyncExternalStore`.
- `[SRC-ZUSTAND-03]`
  `permissive/zustand/src/middleware/subscribeWithSelector.ts`: selector and
  `equalityFn` support precise slice subscriptions.
- ZIP entries at the same exact paths are SHA-256-identical to the curated
  source files.

### LCOS-specific reasoning

Canvas, Workspace, selection, Inspector, mutation ordering, and Runtime UI are
different responsibilities but participate in one working session. A composed
store gives them a single coherent update boundary while selectors prevent
unrelated UI from rerendering. Multiple mutually synchronized stores would add
ordering and rehydration failure modes without creating a meaningful Domain
boundary.

The store is a disposable Web working model, not a second database.

### Implementation impact

- Define typed slice state and actions under one store creator.
- Components subscribe to the smallest practical selector.
- High-frequency viewport, hover, and selection state must not cause whole
  Canvas business rerenders.
- Keep Local Core client and Domain/contracts outside Zustand implementation
  details.

### Tests / CI gate

- Unit test each slice action and cross-slice invariant.
- Selector tests prove unrelated updates do not notify subscribers.
- Component tests use targeted selectors rather than the whole store.
- Typecheck forbids duplicated Domain entity types in the Web store.

## Decision 2: Never persist Project Truth through Zustand

### Decision

Do not use Zustand `persist`, browser localStorage, or a renderer snapshot to
store Project Truth.

The restart flow is:

```text
Web starts
→ Local Core loads Project / Workspace truth
→ map truth into AppWorkingStore
→ user actions update working state optimistically
→ serialized mutations go to Local Core
→ acknowledgements reconcile working state
```

The entire Web store may be discarded. Durable recovery must come from Local
Core.

### Evidence

- `[SRC-ZUSTAND-01]`: the vanilla store is an in-memory state container; durable
  Project semantics are not inherent in its update model.
- Dev Feedback v2 recommends one composed working store and explicitly rejects
  using `persist` for Project Truth.
- LCOS architecture rules assign Project Graph, Revision, Checkpoint, and other
  durable truth to Local Core, while localStorage is limited to disposable UI
  preferences.

### LCOS-specific reasoning

Persisting the working store would create a competing source of truth and make
restart behavior depend on whichever copy happens to hydrate last. It could
also persist optimistic or stale state that Local Core never acknowledged.
LCOS requires deterministic recovery from its durable repository.

UI preferences may be persisted only when they are explicitly classified as
disposable and cannot overwrite Project, Workspace, Canvas layout, Artifact,
Revision, Relation, Note, or Checkpoint truth.

### Implementation impact

- No Zustand persistence middleware for Project or Workspace data.
- No localStorage migration is introduced by this ADR.
- Store initialization and project switching must reset then rehydrate from
  Local Core.
- Fixture origin remains explicit and must not silently write to the Runtime
  database.

### Tests / CI gate

- Architecture test rejects production imports of Zustand persistence
  middleware in the Project working-store path.
- Restart integration test reconstructs the store from Local Core with browser
  storage empty.
- Project switching cannot leak prior Project entities or selection.
- Unacknowledged optimistic state disappears after a hard reload unless Local
  Core accepted it.
- Fixture data is visibly marked and is not silently persisted.

## Decision 3: Keep mutation ordering explicit

### Decision

`MutationQueueSlice` represents the Web-side serialized mutation state:

```text
in-flight mutation
pending batch
ordered acknowledgement
stale-response guard
```

Debounce may reduce presentation writes but does not replace serialization.
Zustand state notification and React batching do not provide network mutation
ordering.

### Evidence

- `[SRC-ZUSTAND-01]`: `setState` merges state and synchronously notifies local
  listeners; it does not serialize remote requests.
- `[SRC-ZUSTAND-03]`: selective subscription limits notifications but does not
  establish persistence ordering.
- Dev Feedback v2 distinguishes renderer/UI batching from the LCOS serialized
  mutation queue.

### LCOS-specific reasoning

An older slow request must never overwrite a newer Canvas position or semantic
operation. The working store needs observable queue state for optimistic UI and
error recovery, while Local Core remains authoritative after acknowledgement.

### Implementation impact

- Queue actions and acknowledgement tokens are typed explicitly.
- Presentation batching remains separate from semantic mutation commands.
- Runtime UI may expose pending/offline/error state without treating it as
  durable Project data.

### Tests / CI gate

- Ordering test: A is sent, B is produced later, A responds slowly, and final
  working/durable state remains B.
- Failure test: a rejected mutation exposes structured error state and does not
  drop later pending work.
- Rehydration clears transient in-flight state and reloads authoritative data.

## License boundary

Zustand at the pinned commit is MIT-licensed and classified as permissive in the
research package. It may be used as a production dependency. Distribution must
retain its copyright and license notice and include it in third-party notices.
This ADR authorizes no import or copying from research-only source trees.

## Rollback

Replace the Zustand implementation with another in-memory store behind the
same typed working-state actions and selectors. Because Project Truth remains
in Local Core and no Zustand persistence is allowed, rollback requires no data
migration.
