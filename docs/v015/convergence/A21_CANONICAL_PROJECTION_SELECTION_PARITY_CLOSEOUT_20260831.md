# LCOS v0.15 · A21 Canonical Projection & Selection Parity Closeout

Date: 2026-08-31
Baseline authority: `4c90d4d` (A19+A20 merged; exact uploaded RC bytes readable)
Patch proposition: canonical projection / existing-worksite Drop convergence / point-selection parity

## Proposition

A21 closes three source-level Phase A regressions without entering B morphology or A22 GUI grammar.

### 1. Conversation/Glyth identity

Final `CanvasNode.entityKind` now resolves Conversation first:

```text
conversationByViewId(view.id)
→ conversation
→ final entityKind = conversation
```

Aggregate Context/Workflow/Collection container mapping only runs when the View is not a canonical Conversation projection.

A text/markdown backing Artifact therefore cannot demote a real Conversation View into an ordinary content card.

### 2. Context / Workflow Drop convergence

Bottom capability targets now mean “use this worksite”, matching their click navigation language.

```text
capability:context
→ activeContextId ?? rootScope.id
→ append exact Context Presentation members/refs

capability:workflow
→ activeWorkflowId ?? rootScope.id
→ append exact Workflow Presentation members/refs
```

Creation is separated:

```text
generate:context
→ createContextFromMembersDirect

generate:workflow
→ createWorkflowFromMembersDirect
```

Switching between surface families clears only the opposite family owner; it no longer destroys the active owner of the surface being re-entered.

### 3. Shared point Selection timing

`SurfaceObject` now commits ordinary/Shift Selection on pointerdown, before Context/Workflow outer drag wrappers take pointer capture.

Group-drag preservation matches Main:

```text
existing multi-selection member press
→ preserve group while pointer may become drag

real ordinary click
→ collapse to clicked member

Shift+Click
→ additive/toggle
```

Explicit Semantic Drop triggers do not mutate Selection.

## Explicit non-goals

A21 does NOT:

- redesign Orbit into the new top-right Action Arc;
- implement Color Pin / Focus centered navigation;
- implement Component Spatial Instrument morphology;
- restore multi-selection visual bounds beyond existing source behavior;
- change Search / Assembly GUI;
- enter Phase B.

Those remain A22 / later-phase work according to the latest product freeze.

## Validation

### Dedicated A21 gate

```text
13 / 13 PASS
```

### Full runnable v0.15 static sweep

```text
49 PASS / 0 FAIL / 2 SKIP
```

Only S9/S10 external semantic/provider gates are skipped.

### Changed TypeScript syntax transpile

```text
5 / 5 PASS
```

### Full semantic typecheck

Attempted in uploaded RC source environment:

```text
BLOCKED_ENV
TS2688 node
TS2688 vite/client
```

The archive contains no `node_modules`; this is not reported as PASS.

### Browser / Human product smoke

```text
NOT RUN / requires real app environment
```

Required local smoke after merge:

1. Main / Context / Workflow Shift+Click point multi-selection.
2. Existing multi-selection group drag remains grouped.
3. Bottom Context click and Drop resolve the same worksite owner.
4. Bottom Workflow click and Drop resolve the same worksite owner.
5. Explicit new Context/Workflow creation still creates a new owner.
6. Imported/linked Conversation with canonical `conversationViewId` renders as Glyth after reload even when backing Artifact kind is text/markdown.

## Status

```text
A21 SOURCE / STATIC = PASS
A21 EXACT SOURCE BASELINE = 4c90d4d uploaded RC bytes
A21 LOCAL MERGE = PENDING
A21 TYPECHECK = BLOCKED_ENV in archive
PHASE A COMPLETE = NO
PHASE B ADMISSION = NO
```
