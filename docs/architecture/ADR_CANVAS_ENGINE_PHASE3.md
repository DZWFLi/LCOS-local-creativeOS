# ADR: Phase 3 Canvas Engine Candidate

- Status: Accepted for controlled adoption — production integration deferred
- Scope: Phase 3 Stage 1–3
- Decision owner: Local Creative OS
- Evidence baseline:
  - xyflow / React Flow commit `dd308ab401d49518f73d1e91c43faf254ff5a4c9`
  - `LCOS_OPEN_SOURCE_RESEARCH_CODE_2026-07-26.zip`
  - `Local_Creative_OS_OpenSource_Code_Audit_Dev_Feedback_v2.md`

The isolated LCOS spike passed its acceptance gate. React Flow is selected as
the Canvas-engine candidate behind a Web-only adapter; this does not authorize
an immediate full replacement of the current renderer.

Spike evidence:

- Branch: `codex/phase3-react-flow-spike`
- Commit: `f77edd93cc6463ca6c8f544c04758dfe7408308f`
- Findings: `spikes/react-flow-phase3/SPIKE_FINDINGS.md` in the spike worktree
- Typecheck/build PASS, Playwright 2/2 PASS, architecture 10/10 PASS
- Controlled update sample: 100 Views 194.5 ms; 300 Views 360.6 ms

## Decision 1: Evaluate React Flow as a replaceable Canvas engine

### Decision

Adopt React Flow in controlled increments behind an adapter so the Domain and
working-state model do not depend on `@xyflow/react`. Do not replace the
production renderer until an in-app parity gate passes.

The candidate mapping is:

```text
ReactFlowNode.id            = ArtifactViewId
ReactFlowNode.data.entityId = ArtifactId
ReactFlowEdge               = projection of Relation
```

### Evidence

- Dev Feedback v2: React Flow section, `[SRC-XY-01]` through `[SRC-XY-08]`.
- `[SRC-XY-01]`
  `permissive/xyflow/packages/react/src/hooks/useNodesEdgesState.ts`:
  `useNodesState` is `useState + applyNodeChanges`; its documentation points
  larger production applications toward a state library such as Zustand.
- `[SRC-XY-03]`
  `permissive/xyflow/packages/react/src/store/index.ts`: React Flow itself uses
  Zustand `createWithEqualityFn`.
- `[SRC-XY-04]`
  `permissive/xyflow/packages/system/src/types/nodes.ts`: public user nodes and
  `InternalNode` are separate types; engine-only geometry and handle state do
  not need to enter the LCOS Domain.
- ZIP entries at the same exact paths are SHA-256-identical to the curated
  source files.

### LCOS-specific reasoning

LCOS persists one Project Canvas, while an Artifact may have zero or many
ArtifactViews. Therefore the render node represents an ArtifactView, not an
Artifact. Keeping a renderer adapter preserves this identity rule and prevents
engine internals such as absolute positions, handle bounds, and transient drag
state from becoming Project Truth.

React Flow and Zustand are not inherently incompatible. The open question is
whether React Flow preserves LCOS interaction semantics, visual language, and
performance in the current Web application. Only the spike can answer that.

### Implementation impact

- Add no React Flow type or import to `packages/domain`.
- Translate between `CanvasNodeVM` and renderer nodes at the adapter boundary.
- Keep the current renderer available until in-app parity is accepted.
- Add React Flow to the formal Web path only through a Web-only adapter.

### Tests / CI gate

- Architecture test: `packages/domain` must not import `@xyflow/react`.
- Architecture test: renderer snapshots must not enter Project persistence.
- Spike gate:
  - 8–12 LCOS nodes: Source Artifact, Generated Artifact, and Note.
  - At least 6 projected relations.
  - Drag, multi-select, pan, zoom, fitView, single click, double click,
    Inspector, relation display, and viewport restore work.
  - Deleting an ArtifactView does not delete its Artifact.
  - `CanvasNodeVM` maps without semantic loss.
  - 100–300 views show no material interaction regression.
  - LCOS custom visual language remains intact.

## Decision 2: Treat controlled changes as operations, not snapshots

### Decision

Classify React Flow controlled changes at the adapter boundary. Presentation
changes may update working state and the presentation mutation path; semantic
actions must use explicit LCOS Domain operations.

```text
position / dimensions / viewport / selection
→ presentation or ephemeral working-state operation

semantic create / delete / relation mutation
→ explicit LCOS Domain operation
```

`ReactFlow.toObject()` must never become the Project persistence contract.

### Evidence

- `[SRC-XY-05]`
  `permissive/xyflow/packages/react/src/hooks/useReactFlow.ts`: `toObject()`
  returns only nodes, edges, and viewport.
- `[SRC-XY-08]`
  `permissive/xyflow/packages/react/src/utils/changes.ts` and
  `permissive/xyflow/packages/system/src/types/changes.ts`: controlled changes
  are normalized as position, select, dimensions, remove, add, and replace.
- `[SRC-XY-06]`
  `permissive/xyflow/packages/react/src/components/BatchProvider/index.tsx`:
  node and edge updates are batched and converted to changes.
- `[SRC-XY-07]`
  `permissive/xyflow/packages/react/src/components/BatchProvider/useQueue.ts`:
  queued updates flush in layout timing while accounting for React automatic
  batching.
- ZIP entries at the same exact paths are SHA-256-identical to the curated
  source files.

### LCOS-specific reasoning

A renderer snapshot cannot express LCOS invariants around Artifact identity,
Revision lifecycle, Relation semantics, or semantic graph versioning. Using it
as persistence would recreate the prohibited full-graph-save path and allow
presentation state to overwrite semantic truth.

React Flow batching is useful evidence for the interaction hot path, but it is
not a substitute for LCOS's serialized Local Core mutation queue and ordered
acknowledgements.

### Implementation impact

- Add a change classifier to the candidate adapter.
- Preserve optimistic ViewModel updates and the existing serialized mutation
  path.
- Permit `toObject()` only for diagnostics or disposable spike inspection.

### Tests / CI gate

- Architecture test: no production persistence call site consumes
  `ReactFlow.toObject()`.
- View position, dimensions, and viewport changes do not increment
  `semanticGraphVersion`.
- Semantic operations use Domain commands and increment semantic version
  according to the existing batch rule.
- A slow acknowledgement cannot overwrite a newer presentation update.

## Decision 3: Use React Flow hot paths only if LCOS semantics survive

### Decision

The spike may rely on React Flow's viewport and batched-update hot paths, but
adoption remains conditional on LCOS behavior and appearance. Performance
evidence is necessary but not sufficient.

### Evidence

- `[SRC-XY-02]`
  `permissive/xyflow/packages/react/src/container/Viewport/index.tsx`: viewport
  transform is subscribed from the store and written directly to DOM
  `style.transform`, keeping React out of each pan/zoom frame.
- `[SRC-XY-06]` and `[SRC-XY-07]`: node/edge update batching and synchronous
  layout-time flushing.
- All cited xyflow sources are under `permissive/xyflow` at fixed commit
  `dd308ab`.

### LCOS-specific reasoning

Viewport rendering and drag batching are costly to maintain in a custom engine,
but LCOS also has frozen click, Inspector, View identity, and visual behavior.
The project benefits only if the engine reduces interaction risk without
changing those semantics.

### Implementation impact

- Profile the candidate with LCOS node components and relations.
- Do not redesign the App Shell, Workspace Dock, Inspector architecture, or
  Canvas visual language as part of this spike.
- Record production integration evidence before retiring the current renderer.

### Tests / CI gate

- Exercise pan/zoom and node movement at 100–300 views.
- Confirm single click, double click, selection, and Inspector behavior.
- Confirm viewport restore comes only from `Workspace.viewport`.
- The isolated gate is PASS; production integration remains deferred.

## License boundary

xyflow at the pinned commit is MIT-licensed and classified as permissive in the
research package. It may be evaluated as a production dependency. Distribution
must preserve the copyright and license notice and include it in the project's
third-party notices. No source from research-only directories may be imported
through this ADR or spike.

## Rollback

Reject the candidate, remove spike-only dependency and adapter code, and retain
the current Canvas renderer. The Domain, contracts, Project persistence, and
working-state model remain unchanged because the engine is isolated behind the
adapter.
