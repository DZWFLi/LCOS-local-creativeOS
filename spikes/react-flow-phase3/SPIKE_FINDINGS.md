# Phase 3 React Flow Spike Findings

- Status: PASS — recommend controlled adoption
- Branch: `codex/phase3-react-flow-spike`
- Engine: `@xyflow/react@12.11.2`
- Scope: isolated spike only; `apps/web` was not modified
- Test viewport: 1440 × 900
- Browser: Headless Chromium 151 on Windows

## Decision

Recommend React Flow as the Phase 3 Canvas engine candidate and proceed to a
controlled `CanvasEngineAdapter` integration plan.

This is not approval for a one-step replacement of the current Canvas. The
production integration must keep LCOS Domain types independent, preserve the
existing serialized mutation path, and retain the current renderer until the
same checks pass inside `apps/web`.

## Evidence

### Open-source evidence

- Dev Feedback v2 `[SRC-XY-01]`:
  `permissive/xyflow/packages/react/src/hooks/useNodesEdgesState.ts`.
  Controlled node state is `useState + applyNodeChanges`, and the source points
  larger applications toward Zustand.
- `[SRC-XY-02]`:
  `permissive/xyflow/packages/react/src/container/Viewport/index.tsx`.
  Pan/zoom transform is written directly to the DOM hot path.
- `[SRC-XY-03]`:
  `permissive/xyflow/packages/react/src/store/index.ts`.
  React Flow internally uses Zustand.
- `[SRC-XY-04]`:
  `permissive/xyflow/packages/system/src/types/nodes.ts`.
  User nodes are distinct from engine `InternalNode` state.
- `[SRC-XY-05]`:
  `permissive/xyflow/packages/react/src/hooks/useReactFlow.ts`.
  `toObject()` contains nodes, edges, and viewport only; the spike does not use
  it for persistence.
- `[SRC-XY-06]`, `[SRC-XY-07]`, `[SRC-XY-08]`: batch queues and normalized
  controlled changes are suitable for an adapter boundary.
- All cited ZIP entries were previously SHA-256-matched to the curated exact
  paths at fixed xyflow commit
  `dd308ab401d49518f73d1e91c43faf254ff5a4c9`.

### LCOS semantic fixture

The default spike fixture contains:

```text
8 Artifacts
10 ArtifactViews
8 Relations
```

It includes Source, Generated Draft, and Note families. Two Artifacts each have
more than one ArtifactView, proving the engine mapping is View-based:

```text
ReactFlowNode.id            = ArtifactViewId
ReactFlowNode.data.entityId = ArtifactId
```

Deleting two selected Views changed the visible model from:

```text
Artifacts 8 / Views 10 / Relations 8
```

to:

```text
Artifacts 8 / Views 8 / Relations 6
```

The Artifact collection remained unchanged.

### Interaction checks

Automated in `tests/spike.spec.ts`:

- immediate single-click selection;
- Shift multi-select;
- node drag;
- middle-button Canvas pan;
- wheel zoom;
- fitView;
- double-click Inspector open;
- Inspector displays distinct ArtifactViewId and ArtifactId;
- relations render and incident relations are removed with deleted Views;
- delete View without deleting Artifact;
- save, move away, and restore Workspace viewport;
- custom Source / Generated / Note node styling;
- 100-View and 300-View selection remains interactive;
- no browser Console errors or uncaught page errors.

Screenshots:

- `evidence/lcos-react-flow-interactions.png`
- `evidence/lcos-react-flow-100-views.png`
- `evidence/lcos-react-flow-300-views.png`

## LCOS-specific reasoning

React Flow successfully handled the renderer responsibilities that LCOS should
not reproduce in its Domain: node dragging, multi-selection, pan/zoom, fit,
relations, and viewport mechanics. The spike kept Artifact identity outside the
engine and used controlled node changes without persisting an engine snapshot.

The custom nodes retained LCOS's porcelain surface, restrained family accents,
and distinct Note geometry. Adoption therefore does not inherently require
falling back to default React Flow visual language.

The remaining risk is integration, not basic engine fit. The isolated spike
does not prove compatibility with every existing `apps/web` shortcut,
Inspector transition, mutation acknowledgement, or runtime rehydration path.

## Performance record

Evidence file: `evidence/performance-results.json`.

Latest sample:

| Views | Controlled state update to second animation frame |
|---:|---:|
| 100 | 194.5 ms |
| 300 | 360.6 ms |

Both samples supported immediate post-render selection and fitView in the
automated browser run.

These numbers are an initial-render/commit sample in headless Chromium, not a
frame-time or sustained-drag benchmark. They show no blocking failure at the
required scale, but production adoption still needs interaction profiling with
real LCOS node content and normal viewport culling.

The production build for the isolated spike emitted approximately:

```text
JavaScript 376.27 kB / 119.22 kB gzip
CSS         18.98 kB /   3.68 kB gzip
```

Bundle impact should be recorded during production integration.

## Implementation impact

If accepted for the next integration step:

1. Introduce a Web-only `CanvasEngineAdapter`.
2. Keep `CanvasNodeVM` and Domain entities free of `@xyflow/react` types.
3. Translate position/dimensions/selection into presentation or ephemeral
   working-state operations.
4. Translate semantic create/delete/relation actions into explicit LCOS Domain
   operations.
5. Restore camera only from `Workspace.viewport`.
6. Never send React Flow snapshots to Project persistence.
7. Keep the current renderer available until the in-app parity gate passes.

## Tests / CI gate

Commands run:

```text
npm run typecheck:spike:react-flow  PASS
npm run build:spike:react-flow      PASS
npm run test:spike:react-flow       PASS (2/2)
npm run test:architecture           PASS (10/10)
git diff --check                    PASS
```

Required production integration gates:

- Domain import scan rejects `@xyflow/react`.
- Persistence scan rejects renderer snapshot input.
- View presentation changes do not increment `semanticGraphVersion`.
- Slow acknowledgement cannot overwrite newer View state.
- Existing LCOS click, double-click, Inspector, delete, and viewport behavior
  passes inside `apps/web`.
- 100–300 real LCOS Views are profiled for drag and pan frame behavior.

## License boundary

xyflow at the pinned research commit and the installed React Flow package are
MIT-licensed. Production distribution must preserve its copyright and license
notice and include it in third-party notices. No copyleft, source-available, or
other research-only source was copied or imported.

## Rollback

Remove the isolated spike scripts, directory, dependency, and lockfile change.
No LCOS Domain, Local Core, database, or production Web migration is required.
