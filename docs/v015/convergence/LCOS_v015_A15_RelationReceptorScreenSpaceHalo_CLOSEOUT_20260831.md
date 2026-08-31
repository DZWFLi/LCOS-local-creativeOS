# LCOS v0.15 · A15 Relation Receptor Screen-space Halo Closeout

Date: 2026-08-31

## 0. Status

```text
Package: A15 · Relation Receptor Screen-space Halo
Authoritative real RC: 6312ace
Stack prerequisite: A14 Workspace Relation Intent Ownership
User continuation override: explicit `请继续` after A14 delivery
Source/static: PASS
Runtime/typecheck in uploaded archive: BLOCKED_ENV (no node_modules; missing node + vite/client type definitions)
A14 real local merge/runtime proof: NOT YET RETURNED
Phase A: OPEN
Phase B admission: NO
```

A15 is a single acceptance proposition. It does not use the user's continuation request to invent a fake post-A14 local HEAD.

---

## 1. Frozen requirement

Latest Mandatory Context:

```text
Relation receptive edge：额外 12–18px halo
```

The tolerance must be **screen-space**. A world-space padding would shrink/grow with canvas zoom and fail the Interaction LOD requirement.

A15 selects:

```text
RELATION_RECEPTOR_SCREEN_HALO_PX = 16
```

which sits inside the frozen 12–18px band.

---

## 2. Pre-A15 gap

Before A15:

```text
pointer
→ document.elementFromPoint(...)
→ visible target body required
```

The UI already displayed a receptive state once a body target was hit, but that visual marker did not create additional physical hit tolerance.

Therefore:

```text
visual receptive feedback != motor-tolerant receptor
```

---

## 3. Implementation

### Shared screen-space resolver

`apps/web/src/features/spatial/projectMaterialRelationGesture.tsx`

adds:

```text
RELATION_RECEPTOR_SCREEN_HALO_PX = 16
relationReceptorScreenDistance(...)
relationTargetWithinScreenHaloAt(...)
```

Resolution order:

```text
1. direct elementFromPoint body hit wins
2. otherwise inspect explicit receptor elements
3. use getBoundingClientRect() screen pixels
4. radial distance to visible rect <= 16px becomes receptive
5. source endpoint is excluded
6. nearest receptor wins when halos overlap
```

The helper never falls back to generic `[data-node-id]`.

### Main

Ordinary Project material continues through `[data-project-relation-target]`.

Workspace continues through explicit `[data-relation-target="workspace:..."]`.

Both now share the 16px physical tolerance without changing endpoint identity or Main `connect()` persistence.

### Context / Workflow

A13 already owned transient physical Relation state, but a halo click can land outside the target button body. That exposed two competing pointer owners:

- empty-space Marquee;
- outer material Drag.

A15 therefore makes Relation dominant only while Relation intent is active:

```text
Relation active
→ disable Marquee start
→ material outer drag yields
→ stage pointerdown resolves halo target
→ existing A13 commitTarget(...)
→ existing surface-owned canonical persistence
```

When Relation ends, Marquee and Drag return unchanged.

---

## 4. Visual / geometry invariant

A15 intentionally does **not** enlarge:

- object visual body;
- Selection Field;
- layout bounds;
- resize geometry;
- saved presentation geometry.

The 16px halo is hit-testing only.

The existing receptive marker still appears only after the target becomes receptive. A15 does not add a permanent glow, large blur halo, or hidden always-on notch.

---

## 5. Regression coverage

New unit source:

`apps/web/src/features/spatial/__tests__/projectMaterialRelationGesture.test.ts`

freezes:

- 16px constant;
- body distance = 0;
- edge distances in screen pixels;
- radial corner distance rather than oversized rectangular catchment.

Browser regression source updates Main Relation to move/click **14px outside** the target's visible body and expects the target to become receptive and commit.

A15 validator:

`scripts/validate-v015-a15-relation-receptor-halo.mjs`

checks 12 acceptance clauses.

A13 regression validator is updated only to recognize the new explicit halo helper; it still rejects generic `data-node-id` target ownership.

---

## 6. Explicit non-changes

Still fail-close / unchanged:

```text
Conversation ordinary Relation endpoint
Context/Workflow scope:* aggregate Relation
Context/Workflow workspace:* aggregate Relation
Conversation Context Mapping
Workflow Step→Step action linking
```

A15 is not permission to collapse these semantic owners.

---

## 7. Local merge order

Because A14 real local merge evidence has not yet returned, A15 is stacked on A14 source.

Apply in order:

```text
6312ace
→ A14
→ A15
```

A combined convenience patch may be supplied, but the two propositions remain separately auditable.

Required real local evidence after applying the series:

```text
full typecheck
web/local-core unit tests
Main Relation halo smoke
Context Relation halo + save/reload
Workflow Relation halo + save/reload
Workspace Relation launch + target/save-reload
Escape/cancel competition smoke
```

Browser E2E must not be called PASS until actually executed.

---

## 8. Remaining Phase A debt after A15 source/static

1. Conversation ordinary Relation endpoint semantics (`SEMANTIC_OWNER_UNPROVEN`);
2. Context / Workflow aggregate `scope:*` / `workspace:*` endpoint adapter;
3. real Browser E2E + Human Product Smoke for Main / Context / Workflow / Workspace;
4. fresh parity census after the real local A14+A15 merge before naming another micro-patch.

The 12–18px receptor motor-tolerance source gap is closed by A15, subject to local runtime proof.

---

## 9. Final status

```text
A15 dedicated gate = 12/12 PASS
A12 regression = 10/10 PASS
A13 regression = 12/12 PASS
A14 regression = 10/10 PASS
full runnable v0.15 static sweep = 43 PASS / 0 FAIL / 2 SKIP
changed TS/TSX/test syntax transpile = 6/6 PASS
A14 → A15 cold apply from 6312ace = PASS
cold series full sweep = 43 PASS / 0 FAIL / 2 SKIP
archive typecheck = BLOCKED_ENV
Browser E2E execution = BLOCKED_ENV / NOT RUN
Human Product Smoke = BLOCKED_ENV / NOT RUN
A15 SOURCE / STATIC = PASS
A15 SERIES MERGE AUTHORIZATION = YES
MERGE SERIES ORDER = A14 → A15
PHASE A COMPLETE = NO
PHASE B ADMISSION = NO
```

STOP after A15. Do not auto-start the next package without a fresh post-merge census.
