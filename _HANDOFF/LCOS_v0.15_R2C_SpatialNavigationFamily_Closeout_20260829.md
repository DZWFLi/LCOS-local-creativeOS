# LCOS v0.15 · R2-C Spatial Navigation Family Closeout
## 2026-08-29

## 1. Scope

This micro-patch closes **R2-C · Spatial Navigation Family** only.

Restored Round-2 target:

```text
Search / Focus
+ Spatial Marker
+ Beacon
+ MiniMap
+ Location Orbit
+ semantic-area / Colony overview
+ Arrival
+ rail landmark ↔ durable Marker
+ Agent mark proposal
```

Hard invariants:

1. **No third navigation truth.**
   - ephemeral camera/navigation Presentation stays frontend-only;
   - durable landmark intent stays in canonical Core Marker Intent.
2. **Far navigation resolves semantic area first, concrete object second.**
3. **No fake cross-Surface coordinates.**
4. **Zoom never writes durable Marker Intent.**
5. **Agent suggestion never becomes durable Marker without explicit user action.**
6. **R2-C does not rename Collection/Fence/Region into Colony before R3-A truth migration.**

R2-D Pointer/Cursor + Relation/Glyth interaction grammar is intentionally not pulled forward.

---

## 2. What changed

### 2.1 Shared Spatial Navigation helper

Added:

- `apps/web/src/features/spatial/spatialNavigationFamily.ts`

It owns small pure identity/adaptation rules used by the navigation family:

- canonical Marker target equality;
- durable Marker lookup by canonical target;
- Rail item → stable Surface ref, fail-closed;
- Agent proposal → deduped Marker target candidates;
- far semantic-region overview projection.

The helper has no Core client, storage, camera mutation, or Marker write.

### 2.2 Semantic-area overview uses the existing Spatial Marker renderer

R2-C does not create a separate Colony-marker renderer.

At far zoom, current Region/Fence Presentation geometry can be projected as an **ephemeral semantic-region Marker candidate** and passed through the same `SpatialMarkerLayer` that already owns world pin / edge cursor / density projection.

Current adapter sources are:

- legacy `spatialRegions` Presentation geometry;
- `fence` / `region` SurfaceElements that carry identity-only `projectViewIds` bindings.

This is explicitly an adapter seam, not a Colony truth claim. R3-A may replace the source with canonical Colony/Field without changing the navigation contract.

### 2.3 SpatialCanvas merges durable + ephemeral navigation candidates without persisting either copy

`SpatialCanvas` now accepts ephemeral `navigationMarkerItems` alongside R2-A durable Marker projections.

They are merged only for the shared renderer:

```text
Core durable intents -> resolved durable Marker items
                               \
                                -> unified SpatialMarkerLayer
                               /
Presentation semantic regions -> ephemeral Marker items
```

`SpatialCanvas` does not persist ephemeral items and does not create Marker Intent.

### 2.4 Glyth extreme-far cluster click now reuses Focus → Beacon → Approach → Arrival

R2-B intentionally left extreme-far clusters presentation-only.

R2-C makes the cluster interactive without inventing a new camera jump:

```text
cluster click
→ local SpatialFocusRequest
→ existing useSpatialFocusRequest
→ Beacon
→ camera approach
→ Arrival
```

The same local request also keeps the targeted Glyths in the existing Focus-critical breakout set during navigation, so they do not disappear back into the cluster mid-approach.

### 2.5 Semantic-region Marker click uses the same arrival chain

Semantic-region overview Marker click resolves its member View identities and feeds the exact same local `SpatialFocusRequest` path.

It does not directly write camera coordinates and does not mutate Selection/Membership.

### 2.6 Rail landmark ↔ durable Marker

The left Project Rail now consumes the project-level R2-A Marker provider.

For canonical Rail destinations:

- Workspace → `workspace:<workspaceId>`;
- saved Scope → `scope:<scopeId>`.

The hover preview exposes explicit:

```text
固定到导航
取消导航地标
```

Only this explicit action writes/deletes durable `SpatialMarkerIntentV0` with `cross-surface` scope.

The old root Workflow migration bridge (`workflow:<root>`) deliberately fails closed because it is not a canonical stable Surface ref.

### 2.7 Rail is also the honest first stage of cross-Surface navigation

A concrete durable Marker may resolve to a View inside another Surface.

R2-C does **not** fabricate a world coordinate for that object on the current Surface.

Instead, the Rail aggregates resolved Marker records by their canonical target `surfaceRef`:

```text
current Surface
→ Rail shows destination Surface has N navigation priorities
→ enter destination Surface
→ existing SpatialCanvas Marker projection resolves the concrete target
→ approach / arrival
```

Main receives the same aggregate indicator on its fixed root Rail entry.

This implements the frozen “semantic area first, concrete object second” rule without creating a fake cross-Surface arrow coordinate.

### 2.8 Location Orbit can explicitly create/remove a durable landmark

Conversation Glyth Orbit now exposes:

```text
固定到导航
取消导航地标
```

The target is the canonical Conversation View identity and the write goes through the same project Marker provider.

Camera-driven Glyth far pins remain ephemeral; this action is the explicit durable-intent boundary.

### 2.9 Agent mark proposal is opt-in, not an automatic write

Existing `ContextChangeProposalV1` remains the Agent proposal truth.

R2-C derives marker candidates from its existing target/add View identities and adds a user action:

```text
固定为导航重点
固定 N 项重点
取消导航重点
```

There is no second Agent-marker proposal store.

Nothing is persisted merely because an Agent proposal exists. Durable Marker Intent is created only when the user clicks the explicit navigation-priority action.

---

## 3. Explicit non-goals / deferred

R2-C intentionally does **not** implement:

- full Pointer/Cursor visual language;
- `Ctrl/Cmd + Click` Reference Pick cursor/state visuals;
- boundary Light Notch Relation drag grammar;
- Reference Pick ≠ Relation ≠ durable Glyth mapping interaction pass;
- durable Conversation Context Field changes;
- R3-A canonical Colony/Field migration;
- R3 Component catalog migration;
- Assembly Docked Source Bay / Quick Tray final morphology;
- GUI Visual Constitution pass.

Those remain R2-D / R3 / GUI Visual Pass work.

---

## 4. Validation

### R2-C dedicated static gate

```text
R2-C Spatial Navigation Family: 16/16 PASS
```

Covers:

- one canonical Marker provider remains owner;
- semantic-area overview is Presentation-only;
- no Collection → Colony naming shortcut;
- semantic-region items consume shared SpatialMarkerLayer;
- semantic-region click reuses Focus/Beacon/Arrival;
- Glyth cluster click reuses Focus/Beacon/Arrival;
- Focus-critical Glyth breakout survives local navigation;
- Glyth Orbit durable landmark toggle;
- canonical stable Rail Surface refs only;
- legacy Workflow bridge fail-close;
- Rail cross-Surface destination aggregation;
- Rail Marker writes only on explicit action;
- Agent candidates reuse existing proposal truth;
- Agent durable writes only on explicit action;
- durable Marker schema still contains no projection/camera state;
- SpatialCanvas never persists ephemeral navigation candidates.

### Pure helper execution checks

```text
PASS workspace rail stable surface
PASS scope rail stable surface
PASS legacy workflow fails closed
PASS Agent targets dedupe
PASS near region overview suppressed
PASS far region overview projected
```

### Modified/new TS/TSX syntax transpile

```text
6/6 PASS
```

### Regression gates available in this reconstructed builder

```text
Spatial Marker F6A2                 16/16 PASS
Spatial Navigation F6A2             14/14 PASS
Conversation Subcanvas F6B          12/12 PASS
User Language Gate                   PASS · 232 files
CRLF-aware git diff check            PASS
```

### Validation boundary

This builder was reconstructed from the physical `7f0690d` RC + R1-B patch and the exact R2-A/R2-B **touched-file seams needed by R2-C** recovered from their closeout/patch material.

Therefore this run does **not** claim it reran the full R1-C/R1-D/R2-A/R2-B dependency-backed suite. Their prior closeouts remain the authoritative evidence for those completed micro-patches.

The repository still has no workspace `node_modules`, so full dependency-backed:

```text
lint / typecheck / vitest / build
```

is not represented as passing here. Global TypeScript `transpileModule` was used only for syntax/transpile validation of R2-C modified/new TS/TSX files.

---

## 5. Next formal construction point

**R2-D · Interaction Grammar / Relation + Glyth Mapping + Pointer State**

Frozen boundary to restore:

```text
Selection ≠ Reference Pick ≠ Relation ≠ durable Glyth mapping

Click                 = Selection
Shift + Click         = Multi-selection
Ctrl/Cmd + Click      = this-run Reference
Drag object body      = Move / Semantic Drop
Drag boundary notch   = explicit Relation
Middle drag           = Pan
Space + left drag     = Pan fallback
Wheel / pinch         = Zoom / Semantic LOD
```

R2-D should consume R2-C navigation state rather than invent another pointer-mode store.
