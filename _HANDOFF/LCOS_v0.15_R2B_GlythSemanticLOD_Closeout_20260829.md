# LCOS v0.15 · R2-B Glyth Semantic LOD Closeout
## 2026-08-29

## 1. Scope

This micro-patch closes **R2-B · Glyth Semantic LOD** only.

Frozen target:

```text
normal
→ full living Glyth body

mid
→ simplified living body + identity colour + runtime state

far
→ fixed-screen-pixel Glyth Identity Pin
→ map-pin morphology
→ own silhouette / face identity retained

extreme-far
→ non-critical Glyths may enter ephemeral semantic clusters
→ current / active / selected / Focus/Search target Glyths remain independent
```

Hard invariant:

> Camera-driven Glyth LOD is Presentation only. Zoom never creates or mutates durable Marker Intent.

R2-C (Colony semantic overview / rail landmark / Agent mark proposal / full Spatial Navigation family) is intentionally not pulled forward.

---

## 2. What changed

### 2.1 One shared four-band Glyth LOD contract

Added:

- `apps/web/src/features/spatial/glythSemanticLod.ts`

It owns the camera bands used by Conversation projections:

```text
zoom >= .90  → normal
zoom >= .60  → mid
zoom >= .35  → far
zoom <  .35  → extreme-far
```

The contract contains no Core client, storage, Marker mutation, or durable state.

### 2.2 Conversation identity no longer falls through generic Artifact presentation

`CanvasNodeVisual` now gives canonical `entityKind === 'conversation'` priority over document/artifact visual fallback.

This closes a historical hole where a Conversation-backed Artifact could be rendered as an ordinary document depending on its Artifact kind.

### 2.3 normal / mid / far anatomy

`ConversationGlythObject` now consumes camera zoom:

- `normal`: full living body;
- `mid`: simplified body, preserving core/eyes/state while suppressing decorative dots/arcs;
- `far`: `ConversationGlythIdentityPin`;
- `extreme-far`: independent critical/single Glyths remain identity pins.

The far pin is not a generic map icon. Its center reuses the Conversation's own Glyth silhouette/face.

### 2.4 Fixed-screen morphology

Far pins use an inverse camera presentation scale (`--glyth-ui-scale`) so the identity target stays readable while the world zoom changes.

The scale is Presentation CSS only and is never copied into Project/Core truth.

### 2.5 Extreme-far semantic clusters

`clusterExtremeFarGlyths()` creates screen-density buckets and returns ephemeral world anchors.

Only **non-critical Conversation projections** are eligible.

Critical means:

- selected Glyth;
- active Conversation / Receiver identity;
- current Focus/Search navigation target.

Cluster membership is not persisted, and no Marker/Relation write is performed.

Clusters are intentionally presentation-only in R2-B. Cluster navigation/arrival behavior belongs to R2-C.

### 2.6 Generic overview proxy can no longer erase Glyth identity

Both Main `ProjectCanvas` and shared `SurfaceObject` exclude Conversation from the generic overview proxy path.

Context / Workflow camera-driven spatial Surfaces now pass their zoom through the shared material renderer, so Conversation LOD uses one contract rather than per-Surface heuristics.

### 2.7 Cardless Conversation interaction host

The invisible `CanvasNode` interaction hull remains, but Conversation hosts no longer paint a generic porcelain/card shell.

The visible morphology is the Glyth body / identity pin itself.

---

## 3. Explicit non-goals / deferred to R2-C+

This patch does **not** implement:

- Colony semantic overview Marker;
- fixed-to-rail durable landmark creation;
- Agent marker proposals;
- cross-Surface semantic-area navigation resolution;
- cluster click → approach/arrival behavior;
- full Pointer/Cursor visual language;
- Relation / Glyth durable Context Field interaction changes.

Those remain R2-C / R2-D / GUI Visual Pass work.

---

## 4. Validation

### R2-B dedicated static gate

```text
R2-B Glyth Semantic LOD: 15/15 PASS
```

Covers:

- four camera LOD states;
- no Core/storage writes in LOD contract;
- selected/active/Focus target breakout;
- critical exclusion from extreme-far cluster;
- ProjectCanvas ephemeral cluster derivation;
- generic overview proxy exclusion;
- Conversation entity priority over Artifact fallback;
- living body vs Identity Pin anatomy;
- own Glyth silhouette retained inside pin;
- inverse camera scale;
- Context/Workflow shared zoom contract;
- cardless Conversation host;
- durable Marker schema unchanged.

### Pure execution checks

```text
PASS four semantic zoom bands execute
PASS active Conversation stays critical
PASS extreme-far clustering executes without swallowing critical Glyth
```

### Modified/new TS/TSX syntax transpile

```text
8/8 PASS
```

### Regression gates

```text
R2-A Marker Core ↔ Web Bridge       15/15 PASS
Spatial Marker F6A2                 16/16 PASS
Spatial Navigation F6A2             14/14 PASS
R1-D Preview / Fragment              15/15 PASS
R1-C Shared Command State            12/12 PASS
Unified Composer                     13/13 PASS
Cross-Surface Execution               8/8 PASS
Conversation Subcanvas               12/12 PASS
ResultSlot                            12/12 PASS
Spatial Component Foundation         22/22 PASS
User Language Gate                    PASS · 231 files
CRLF-aware git diff --check           PASS
```

### Known pre-existing debt

```text
Assembly Source Bay F6A2: 9/10
```

The unchanged failing legacy gate is:

```text
Sources does not fake provider-native data with Project resources
```

R2-B did not alter or disguise that debt.

### Full dependency-backed validation

Not claimed in this sandbox.

The workspace still has no repository `node_modules`, so full dependency-backed `lint / typecheck / vitest / build` is not represented as passing. Global TypeScript `transpileModule` was used only as a syntax/transpile check for the modified/new TS/TSX files.

---

## 5. Next formal construction point

**R2-C · Spatial Navigation Family**

Restore the fuller Round-2 intent, not merely the shortened heading:

```text
Search / Focus / Marker / Beacon / MiniMap / Orbit / Arrival
+
Colony semantic overview
+
rail landmark ↔ durable Marker
+
Agent mark proposal
```

R2-C should consume the R2-B ephemeral Glyth/cluster presentation and the R2-A durable Marker bridge without creating a third navigation truth.
