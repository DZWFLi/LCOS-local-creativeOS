# LCOS v0.15 · R2-A Marker Core ↔ Web Bridge · Closeout · 2026-08-29

## 0. Baseline / micro-patch boundary

- supplied RC baseline: `7f0690d`
- R1-B / R1-C / R1-D are already applied and treated as immutable baseline
- this patch is **R2-A incremental only**
- recovered Round 2 plan is authoritative for carry-forward:
  1. LocalCoreClient marker API
  2. frontend contract convergence
  3. durable Marker Intent consume
  4. Glyth automatic far marker → **R2-B**
  5. Colony semantic overview marker → **R2-C**
  6. rail landmark ↔ marker → **R2-C**
  7. Agent mark proposal → **R2-C**
- Reference Pick / Relation / durable Glyth mapping / full Pointer grammar remain **R2-D / GUI Visual Pass**

R2-A intentionally does **not** pull forward automatic Glyth far-LOD, Colony overview, rail landmark, Agent mark proposal, or Pointer/Cursor visual language.

## 1. Product question closed

R2-A closes one question:

> Does the Web actually consume the Core-owned durable Spatial Marker truth through one canonical contract, or does the frontend still maintain a parallel “future contract” / local marker memory?

After this patch the path is:

```text
Core SpatialMarkerIntentV0
→ LocalCoreClient list/create/delete
→ Core navigation/resolve
→ one Project-level Web read model
→ canonical StableSurfaceRefV0
→ shared SpatialCanvas
→ shared SpatialMarkerLayer
→ world pin / edge cursor / cluster (Presentation only)
```

The reverse user-persistent write seam is also real:

```text
Web create/delete
→ existing Core Marker routes
→ MutationSafety / ChangeSet
→ spatial_marker_intents
```

No browser-local Marker truth is introduced.

## 2. Canonical Web client bridge

`apps/web/src/runtime/localCoreClient.ts` now exposes the four real Core operations:

```text
listSpatialMarkers(projectId)
createSpatialMarker(projectId, input)
deleteSpatialMarker(projectId, markerId)
resolveNavigationTarget(projectId, targetRef)
```

They call the existing Core routes:

```text
GET    /projects/:id/spatial-markers
POST   /projects/:id/spatial-markers
DELETE /projects/:id/spatial-markers/:markerId
POST   /projects/:id/navigation/resolve
```

`navigation/resolve` keeps Core's honest `200 + unresolved` result. Web does not convert missing targets into fuzzy rebinding or a fake local success.

## 3. Duplicate frontend Marker contract retired

`apps/web/src/features/spatial/spatialMarkerSystem.ts` no longer owns copied definitions for:

- `SpatialMarkerIntentV0`
- `SpatialMarkerTargetRefV0`
- frontend-only navigation resolution variants

It consumes `@local-creative-os/contracts` directly:

```text
SpatialMarkerIntentV0
SpatialMarkerTargetRefV0
SpatialMarkerScopeV0
NavigationResolutionV0
NavigationSurfaceKindV0
```

Cross-project resolution now uses the canonical Core language:

```text
{ status: 'unresolved', reason: 'cross-project' }
```

instead of the old frontend-only `blocked` variant.

The old F6A2 static gate was migrated to assert the canonical contract import/alias rather than demanding the deleted duplicate union literal.

## 4. Stable Surface identity is now real at the Web boundary

R2-A tightens the canonical contract:

```ts
sourceSurfaceRef?: StableSurfaceRefV0
```

instead of arbitrary `string`.

The Marker create route now prevents durable GUI/test identifiers from entering Core truth:

```text
allowed stable grammar:
main
assembly
scope:<scopeId>
workspace:<workspaceId>
conversation:<conversationId>
```

For `scope/workspace/conversation`, a stable-looking string must also resolve in the current Project and resolve back to the exact same canonical Surface ref. For example a root scope alias cannot be persisted as `scope:<root>` because its canonical Surface is `main`.

`local` Marker creation requires an explicit `sourceSurfaceRef`.

This does not change DB schema. Overall metadata schema remains **49** from R1-C.

## 5. One Project-level durable Marker owner in Web

New:

```text
apps/web/src/features/spatial/ProjectSpatialMarkerContext.tsx
```

`ProjectSpatialMarkerProvider` is installed once under the existing `LocalCoreClientProvider`.

It owns only the current Web read model:

```text
Marker Intent + latest canonical NavigationResolution
```

It deliberately does **not** store:

- pin / edge-cursor state
- screen x/y
- cluster membership
- camera zoom
- browser-local durable copies

On Project switch the provider is keyed by Project ID so a previous Project's Marker read model cannot flash into the next Project.

Create/delete also pass through the same provider seam, so later R2-C affordances do not need to invent another Marker store.

## 6. Durable Marker Intent is actually consumed by SpatialCanvas

`SpatialCanvas` now accepts a canonical:

```ts
surfaceRef?: StableSurfaceRefV0
```

Main / Context / Workflow / Conversation pass stable identities instead of using `testId` or Semantic Drop target IDs as durable ownership.

Resolved durable Marker targets on the current Surface are projected through the existing shared:

```text
SpatialMarkerLayer
→ projectSpatialMarkers()
→ world-pin / edge-cursor / density cluster
```

No second marker renderer was added.

### Main live-bounds recovery from the earlier Round 2 construction idea

The recovered Round 2 patch had an important detail that was lost from the later compressed task list: Main durable markers should follow the **current Presentation bounds** of their real target instead of becoming anonymous fixed coordinate dots.

R2-A preserves that with `markerAnchorItems`:

```text
Core target identity
+ current ProjectCanvas node bounds / label
→ current marker projection
```

Therefore moving an object changes the Marker projection immediately from live Presentation state without writing copied x/y back into Core.

When no live local bounds exist but Core has an honest `worldPosition`, SpatialCanvas can use that resolved point as a minimal fallback.

## 7. Navigation remains canonical at click time

Clicking a durable Marker does not trust a stale cached coordinate.

Before camera movement Web calls:

```text
resolveNavigationTarget(targetRef)
```

again, then uses:

1. current live local target bounds when available;
2. otherwise the freshly resolved Core `worldPosition`.

If the target has disappeared, Core returns `unresolved`; Web does not guess by title/provider/time.

## 8. Honest boundary: what R2-A does not pretend to finish

R2-A consumes durable intents that can be **honestly projected in the active Surface**.

Some legal intents intentionally remain Core truth without an invented visual in this micro-patch, especially cases whose target belongs to another Surface and therefore cannot borrow that Surface's world coordinates. Their cross-Surface direction/landmark language belongs to the recovered R2-C navigation-family work, not to a fake coordinate projection in R2-A.

Deliberately deferred:

### R2-B

- Conversation Glyth → automatic far identity pin
- extreme-far Conversation cluster
- ephemeral LOD only; zoom must never write durable Marker Intent

### R2-C

- Colony semantic overview marker
- rail landmark ↔ Marker convergence
- Agent mark proposal
- cross-Surface landmark/direction consolidation

### R2-D / GUI Visual Pass

- Reference Pick ≠ Selection ≠ Relation ≠ durable mapping
- complete Pointer/Cursor semantic grammar

## 9. Validation

Available static / dependency-free validation in this sandbox:

```text
R2-A Marker Core ↔ Web Bridge               15/15 PASS
Spatial Marker F6A2                          16/16 PASS
Spatial Navigation F6A2                      14/14 PASS
R1-D Preview / Fragment                      15/15 PASS
R1-C Unified Command State                   12/12 PASS
Unified Composer F6B                         13/13 PASS
Cross-Surface Unified Execution F6B           8/8 PASS
Conversation Subcanvas F6B                   12/12 PASS
ResultSlot F6B                               12/12 PASS
Spatial Component Foundation                 22/22 PASS
v0.15 User Language Gate                     PASS (230 product-surface files)
Modified/new TS/TSX transpile diagnostics    20/20 PASS
git diff --check                             PASS
R2-A incremental patch apply-check            PASS
7f0690d cumulative patch apply-check           PASS
```

Existing unrelated baseline debt remains unchanged:

```text
Assembly Source Bay F6A2                      9/10
```

The failing item remains the previously documented stale `Sources does not fake provider-native data with Project resources` string gate. R2-A does not rewrite that unrelated historical gate to fabricate a green number.

This workspace still has no installed monorepo `node_modules`. Therefore full dependency-backed:

```text
lint / package typecheck / vitest / build
```

is **not claimed** here. The code has been checked with global TypeScript `transpileModule` for every modified/new TS/TSX file plus the static compatibility gates above.

## 10. R2-A status

**Code-complete + R2-A static/compatibility-Golden complete.**

The old state:

```text
Core Marker API exists
+ Web marker renderer exists
+ nobody actually joins them
```

is closed.

The Web now reads and mutates Core-owned Marker Intent, resolves canonical targets, uses stable Surface identities, and projects durable Marker truth through the existing shared Spatial Marker presentation system without forking persistence.

## 11. Next official micro-patch

`R2-B · Glyth Semantic LOD`

Carry-forward that must not disappear:

- normal / mid / far / extreme-far Glyth semantic states
- far state becomes a compact **Conversation identity pin**, not a generic dot
- automatic camera-driven projection only
- never creates/deletes `SpatialMarkerIntentV0` merely because zoom changed
- durable and ephemeral projections must not duplicate the same target visually
- do not pull Colony overview / rail landmark / Agent mark proposal forward from R2-C
