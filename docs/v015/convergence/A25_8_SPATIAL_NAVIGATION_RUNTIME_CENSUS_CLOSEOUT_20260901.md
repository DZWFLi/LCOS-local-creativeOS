# LCOS v0.15 · A25-8 Spatial Navigation Runtime / Fresh Census Closeout

Date: 2026-09-01
Status: **PACKAGE PASS · A25 SOURCE/STATIC CHAIN CLOSED · BROWSER/HUMAN OPEN**
Baseline: exact A25-7 delivery tree

## Proposition

Re-audit the production navigation chain after A25-1…A25-7 and close only the last source/runtime geometry blockers that would force B0 Unified Work View to rewrite navigation.

This package does not add a new navigation product. It checks whether the existing owners actually consume one Active Spatial Viewport in production.

## Fresh production census

Confirmed current owners:

```text
ActiveSpatialViewport
→ Top Spatial Index
   Search > Focus > Color Pin > none
→ Focus fitting
→ Main edge auto-pan
→ Minimap safe geometry
→ Spatial Marker / Map Locator edge projection
```

Canonical truth remains separated:

```text
Search transient retrieval state
≠ Focus transient occurrence state
≠ Color Pin persisted many-to-many truth
≠ SpatialMarkerIntent durable navigation intent
```

### Retired primary presentations

- `ProjectFocusNavigator.tsx` still exists as historical/accessibility fallback source, but App does not mount it as normal Focus GUI.
- `ArtifactLocationOrbit.tsx` still exists as source history, but App does not mount it as normal Focus GUI.
- `ProjectSearchLens.tsx` remains reachable only through the old `ProjectToolsDialog(searchOnly)` source branch; App no longer invokes that branch for normal Search.

Source existence is not counted as production ownership.

## Blocking reality gaps found

The fresh census found two live consumers that A25-2 had not actually migrated:

### 1. Map Locator / Spatial Marker edge projection

Before A25-8:

```text
world target
→ full physical Canvas viewport
→ onscreen/offscreen decision
→ physical browser/Canvas edge
```

Therefore a target fully hidden behind a future right Work View could still be classified as onscreen, or its locator could be placed behind the Work View.

A25-8 changes the projection to:

```text
world target
→ Surface-local activeSpatialViewport insets
→ active safe world bounds
→ active screen edge
```

`SpatialMarkerLayer`, Beacon and the legacy EdgePin adapter all receive the same safe insets. No component-specific WorkRail/WorkView query is introduced.

### 2. Embedded `SpatialCanvas` minimap

The Main `CanvasMiniMap` had already migrated in A25-2, but the shared `SpatialCanvas` minimap used by capability surfaces still:

- drew the Camera rectangle from the full physical viewport;
- centered minimap clicks on the physical viewport center;
- used CSS placement rules with a WorkRail-specific `:has(.work-rail...)` exception.

A25-8 closes that divergence:

- Camera rectangle uses `spatialSafeViewportWorldBounds()`;
- minimap click uses the active local center;
- both Main and embedded minimaps publish the same safe right/bottom CSS variables;
- active CSS no longer has a WorkRail-specific minimap exception.

## Camera invariant

Work View/rail occupancy still does **not** move Camera automatically.

Only explicit navigation actions may move Camera. Durable marker activation and minimap activation now target the center of the active usable region rather than browser physical center.

## Runtime geometry evidence

`smoke-v015-a25-8-spatial-navigation-active-edge.mjs` verifies:

- active safe world bounds;
- a target physically inside the browser viewport but hidden behind a 400px right occupied region becomes offscreen;
- its locator clamps to the active right edge, not the browser edge;
- the symmetric left-edge case;
- zero-inset fallback preserves legacy behavior.

Result:

```text
8/8 PASS
```

## Residual reality ledger

| Item | Current reality | Classification |
|---|---|---|
| Search top index owner | production owner | PASS |
| Focus top index owner | production owner | PASS |
| Color Pin truth/index/authoring | production owner | PASS |
| Map Locator active edge | shared active viewport | PASS after A25-8 |
| Main + embedded minimap geometry | shared active viewport | PASS after A25-8 |
| old Focus/Search source files | unmounted/fallback source | RETIRED PRIMARY OWNER |
| binary Spatial Marker subsystem | separate durable navigation intent | KEEP · NOT COLOR PIN |
| exact Map Locator silhouette/material | current marker family still visually provisional | D_VISUAL_FIDELITY_GAP |
| Voice real microphone / whisper model | no real browser/device evidence | A24-8 HUMAN/RUNTIME OPEN |
| A25 zoom/DPI/Work View human handfeel | no real browser/human evidence | HUMAN OPEN |

## Phase A decision

Fresh source/runtime census found no additional canonical-owner or geometry blocker after this repair.

Therefore:

```text
A25 source/static construction chain = CLOSED
Phase A automated/source construction = READY FOR HUMAN PRODUCT SMOKE
Phase A admission = NOT GRANTED
```

The Night Shift plan explicitly forbids Phase B admission from static gates alone. The remaining admission gate is real Browser/Human Product Smoke, including A24 Voice and A25 navigation at real zoom/DPI.

The extracted environment still has Chromium but no usable installed web dependencies, so that gate remains `ENVIRONMENT_BLOCKED / HUMAN OPEN` rather than being relabeled PASS.

## Delivery replay evidence

The candidate package was cold-applied to the exact A25-7 delivery baseline:

```text
git apply --check = PASS
git apply = PASS
git diff --check = PASS
A13 → A25-8 cumulative = 563/563 PASS
W0-3 = 30/30 PASS
W0-2 = 17/17 PASS
SOP-R1 = 8/8 PASS
R3.1A6 = 10/10 PASS
F6A = 7/7 PASS
```

This closes the bounded A25-8 package and the A25 source/static construction chain only. It does not substitute for Phase A Browser/Human admission.

## Next

```text
Phase A Human Product Smoke / Admission
→ A24 Voice real runtime
→ A25 navigation real zoom/DPI/occupied-region handfeel
→ explicit Phase A closeout + Phase B admission
```

Do not begin B0 implementation before that admission under the current night-plan authority.
