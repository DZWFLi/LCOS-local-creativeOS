# LCOS v0.15 · A25-2 Active Spatial Viewport Consumer Migration Closeout

Date: 2026-09-01
Status: **SOURCE / STATIC PASS · HUMAN VISUAL ACCEPTANCE OPEN**
Baseline: A25-1 Active Spatial Viewport Geometry Owner

---

# 1. Proposition

A25-1 created one pure screen-space geometry truth. A25-2 makes the first real consumers use it instead of continuing four independent safe-area calculations.

This package migrates exactly:

```text
App shell safe region
CanvasMiniMap
shared useSpatialFocusRequest
ProjectCanvas drag edge auto-pan
```

It does **not** implement Centered Spatial Index UI, Search migration, Focus occurrence UI, Color Pin truth, Map Locator convergence, or Unified Work View itself.

---

# 2. Canonical owner chain

```text
physical viewport
+ static shell insets
+ persistent edge occupants
→ resolveActiveSpatialViewport()
→ ActiveSpatialViewportProvider
→ consumer-local projections
```

Persistent edge UI now declares one generic DOM capability:

```text
data-spatial-viewport-occupant="left|right|top|bottom"
```

The observer knows this generic contract only. It does not hard-code WorkRail, Workspace Rail, or future Work View component names.

Future Unified Work View therefore plugs into the same geometry owner by publishing the same edge-occupancy contract.

---

# 3. Implemented migration

## 3.1 App

Old:

```text
layoutMode → static safeInsets
WorkRail width/collapse → shellWorkingCenter() → automatic Camera translation
```

Current:

```text
staticSpatialInsets
+ observed persistent edge occupants
→ activeSpatialViewport.activeInsets
→ compatibility safeInsets for existing fit/reveal callers
```

`WorkRail` width/collapse no longer translates Camera through `shellWorkingCenter()`.

This closes the old physical contradiction with Unified Work View:

> persistent edge UI may change the usable viewport, but registration/resizing is not itself a Camera command.

## 3.2 CanvasMiniMap

`CanvasMiniMap` no longer receives a separate `safeInsets` prop.

It consumes the shared Active Spatial Viewport and projects it into the current Canvas root via `spatialInsetsWithinRect()` for:

- zoom anchor center;
- camera rectangle;
- fit-content fallback.

## 3.3 Shared Focus

Every Surface already using `useSpatialFocusRequest()` now consumes the shared active viewport automatically.

The hook converts project-level active viewport geometry into target-Surface-local insets before `fitSpatialBounds()`.

Thus Main / Context / Workflow Focus no longer use a raw physical root center when persistent edge UI occupies part of the viewport.

## 3.4 ProjectCanvas edge auto-pan

Old:

```text
ProjectCanvas
→ querySelector(workspace-dock)
→ querySelector(work-rail)
→ custom left/right edge math
```

Current:

```text
ProjectCanvas
→ activeSpatialViewport
→ spatialEdgeBoundsWithinRect()
→ edgeScrollDelta()
```

ProjectCanvas no longer knows which UI component occupies the edge.

---

# 4. Current occupant adapters

The existing persistent edge shells now publish occupancy:

```text
WorkspaceRailVNext → left
legacy WorkspaceDock → left
WorkRail → right
```

These adapters are migration compatibility only. They do not make these shells permanent v0.15 product owners.

Future B0 Unified Work View should publish the same generic attribute rather than adding another safe-area registry.

---

# 5. Explicit non-claims / remaining A25 debt

Still OPEN:

- Centered Spatial Index presentation owner;
- `Search > Focus > Color Pin > none` arbitration;
- Focus large-list retirement;
- Search modal/list primary-shell retirement;
- Color Pin canonical many-to-many semantics;
- SpatialMarker / edge cursor geometry migration;
- shared SpatialCanvas internal minimap center migration;
- Map Locator convergence;
- A20 overlay environment bridge into the same active viewport contract;
- runtime/browser/human visual acceptance.

The W0-3 provisional A25 numbering placed Centered Spatial Index immediately after A25-1. The rolling implementation ledger inserted this consumer-migration proposition first because A25-1 exposed multiple live geometry owners. The next implementation proposition is therefore:

```text
A25-3 · Centered Spatial Index Presentation Owner
```

---

# 6. Validation evidence

Dedicated:

```text
scripts/validate-v015-a25-2-active-spatial-viewport-consumers.mjs
→ 28/28 PASS
```

Runtime geometry smoke:

```text
scripts/smoke-v015-a25-2-active-spatial-viewport-consumers.mjs
→ PASS
```

Cumulative source/static regression at implementation closeout:

```text
A13 → A25-2 = 379/379 PASS
W0-3 = 30/30 PASS
W0-2 = 17/17 PASS
SOP-R1 = 8/8 PASS
```

Browser/Human evidence remains OPEN. The extracted environment still lacks the dependency installation required for browser-suite execution.

---

# 7. Done statement

A25-2 is complete when interpreted narrowly:

> the first shared safe-region consumers now read one Active Spatial Viewport owner, current persistent edge UI can publish occupancy generically, and merely changing that occupied region no longer auto-translates Camera.

It does **not** close A25 or Phase A.

---

# 8. Patch replay evidence

Final delivery was replayed from the exact A25-1 construction tree:

```text
git apply --check A25-2 patch = PASS
git apply A25-2 patch         = PASS
A13 → A25-2                   = 379/379 PASS
W0-3                           = 30/30 PASS
W0-2                           = 17/17 PASS
SOP-R1                         = 8/8 PASS
```

This replay proves the package is not dependent on incidental edits in the A25-2 working directory.
