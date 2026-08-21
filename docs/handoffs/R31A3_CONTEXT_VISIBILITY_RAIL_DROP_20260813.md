# LCOS R3.1A3 — Context Visibility + Unified Rail Drop

Date: 2026-08-13
Baseline: R3.1A2 OpenAI direct repair over 68f7597

## Why this exists

Real browser verification after A2 produced a useful split:

- G1/G2/G3/G4/G5/G7 passed.
- Mind Map rendered the same concrete Context membership correctly (10 objects).
- Signal Track reported `4 段 · 10 个对象` but its spatial content was visually blank.
- Context Graph could report existing Context/project-node counts while the graph body was visually blank.
- Rail entity cross-surface Drop worked, but used native left-drag while Main Canvas uses the frozen right-button semantic Drop gesture.

This means the remaining failures were no longer membership truth. They were Presentation visibility/session-camera state plus an interaction-contract mismatch.

## Changes

### 1. Context Graph visibility guard

`ContextRelationshipHomeSurface.tsx`

- calculates bounds over saved Context cards + project graph nodes;
- on first entry, checks whether any graph content intersects the current viewport;
- only if the entire graph is off-screen, repairs the camera with `fitSpatialBounds()`;
- preserves a valid user camera.

This specifically fixes the state where the header says e.g. `1 个 Context · 1 个项目节点` but the graph body appears empty.

### 2. Signal Track visibility guard

`ContextFlowSurface.tsx`

- keeps exact Context membership and existing `trackSegments` logic;
- calculates bounds for the spine/segments and member cards;
- on concrete Context entry, only repairs the camera if all Track content is outside the viewport;
- does not rewrite membership, hierarchy, or Track segment truth.

This fixes the state where `4 段 · 10 个对象` is visible in the heading while the track itself appears empty.

### 3. Rail semantic Drop uses right-button too

`WorkspaceRailVNext.tsx`

Previous mismatch:

```text
Main Canvas entity -> right-button Drop
Project Rail entity -> native left-drag Drop
```

A3 freezes:

```text
Project entity semantic cross-surface Drop -> right-button drag
```

Rail behavior now:

- left click = enter/open entity;
- right press + drag = semantic Drop mode;
- target detection reuses `[data-project-view-drop-target]`;
- target receives `is-direct-drop-target` feedback;
- ghost follows pointer;
- release calls the same App `directDropToProjectRailView(targetId, sourceIds)` pipeline used by Main Canvas;
- native rail left-drag is disabled.

### 4. App wiring

`App.tsx`

`WorkspaceRailVNext` now receives:

```ts
onDirectProjectViewDrop: directDropToProjectRailView
```

No second rail-specific mutation path is introduced.

## Not changed

- Mind Map membership/hierarchy, because real browser QA says it already renders the 10 exact members.
- Workspace/Current Scene first-class entity refactor.
- Collection folder/Region persistence model.
- Context editing model beyond current merge/track/tree foundations.
- Workflow right panel / semantic operator cleanup.
- Agent / Arrange / Undo.

## Targeted checks run

- TS/TSX syntax transpile scan: 220 PASS, 0 syntax failures.
- A3 source contract: 7/7 PASS:
  - Signal Track offscreen repair exists;
  - Context Graph offscreen repair exists;
  - Track still covers exact Context membership;
  - Rail right-button gesture exists;
  - Rail native left drag disabled;
  - App wires rail into canonical direct Drop;
  - Context Graph Context card still opens detail.

## Required real browser QA

### G6-A Context Graph

1. Open a project with at least one saved Context.
2. Click bottom `上下文`.
3. Expect the level-1 Context Graph.
4. Saved Context card(s) must be visible without manual panning/searching.
5. Click a Context card directly in Graph.
6. Expect its Signal Track.

PASS only if left Rail is no longer the only usable way to enter a concrete Context.

### G6-B Signal Track

1. Open a Context whose Mind Map shows 10 members.
2. Switch to Signal Track.
3. Heading may say `N 段 · 10 个对象`.
4. Track spine, segment cards and member nodes must actually be visible.
5. Switch Mind Map -> Track repeatedly; content must remain visible.

### G3/G4 gesture correction

1. Left click a Rail Context/Workflow/Collection: opens it; must NOT begin semantic Drop.
2. Right-press a Rail entity and drag to bottom Context/Workflow or an existing semantic target.
3. Ghost follows pointer and target highlights.
4. Release: direct Drop commits.

## Completion status

R3.1A3 is source-complete but NOT browser-complete until the three scenarios above pass on the Windows dev stack.
