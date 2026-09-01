# LCOS v0.15 · A25-1 Active Spatial Viewport Geometry Owner Closeout

Date: 2026-09-01
Status: **SOURCE/PURE-GEOMETRY PASS · CONSUMER MIGRATION OPEN**
Baseline: A24-7 + A24-8 environment status

## Product proposition

Can Phase A establish one deterministic screen-space geometry owner for the **usable SpatialCanvas region**, so Centered Spatial Index / Pin / Focus / Map Locator / Minimap / edge navigation and future Unified Work View do not each invent another notion of canvas center/edge?

## Read gate completed

Full-read before implementation:

- `CENTERED_SPATIAL_INDEX_SEARCH_ASSEMBLY_FREEZE_20260831.md`;
- `NAV_PIN_ORBIT_RECEIVER_PROJECT_IDENTITY_20260831.md`;
- `LATEST_L0_WORKVIEW_HUD_DIRECT_MANIPULATION_ADDENDUM_20260901.md`;
- current `App.tsx` static `safeInsets` owner;
- current `CanvasMiniMap` safe-inset math;
- current `useSpatialFocusRequest` camera fit;
- current `ProjectCanvas` DOM-query edge auto-pan bounds;
- current `SpatialOverlayPlacement` / `spatialOverlayEnvironment` geometry.

## Current reality confirmed

Before A25-1, usable viewport truth was fragmented:

```text
App.tsx static safeInsets
CanvasMiniMap safeInsets center/bounds
useSpatialFocusRequest raw root width/height with no inset
ProjectCanvas edge auto-pan DOM-queries Dock/Rail itself
SpatialOverlayPlacement separately collects occupied DOM rects
```

That fragmentation would make B0 Unified Work View re-implement navigation geometry several times.

## Landed owner

`apps/web/src/features/spatial/activeSpatialViewport.ts`

Canonical pure input:

```text
physical viewport rect
+ static shell insets
+ persistent edge-attached occupied rects
→ ActiveSpatialViewportEnvironment
```

Output:

```text
activeSpatialRect
activeInsets
topCenterAnchor
edgeBounds
```

## Important physical rule

The resolver has **no Camera input and no Camera setter**.

Changing persistent occupied geometry therefore cannot itself mutate Camera.

Future consumers may use the returned region for:

- HUD/top-center placement;
- edge navigation;
- Minimap safe region;
- explicit Focus fitting;
- overlay placement;
- Work View occupied region publication.

Only an explicit navigation action such as Focus may choose to move Camera.

## Occupied-rect admission

Persistent occupied UI may publish an explicit edge:

```text
left | right | top | bottom
```

This is the preferred future Work View contract.

For existing edge chrome, the pure resolver can conservatively infer an edge by geometry/aspect. A floating center rectangle is deliberately ignored for **active viewport shrink**; it may still remain an overlay-placement obstacle through A20's separate collision list.

This distinction prevents a random floating popover from redefining the entire Canvas center.

## Not yet migrated

A25-1 intentionally does not yet change:

- `App.tsx safeInsets`;
- Minimap props/center math;
- `useSpatialFocusRequest`;
- ProjectCanvas edge auto-pan;
- A20 occupied-rect collection;
- top Centered Spatial Index UI;
- Color Pin contract/state;
- old Focus list;
- Search UI.

Those are subsequent A25 micro-packages.

## Validation

Dedicated gate checks owner purity, no Camera/DOM/WorkView coupling, latest L0 alignment and geometry smoke.

Runtime geometry smoke covers:

- static insets;
- right Work View occupancy;
- left edge inference;
- bottom edge inference;
- floating center non-admission;
- explicit corner-edge disambiguation;
- deterministic ordering;
- active top-center recomputation.

## Result

```text
A25-1 geometry owner = PASS
A25 consumer migration = OPEN
Centered Spatial Index UI = OPEN
Color Pin many-to-many truth = OPEN
Focus list retirement = OPEN
Map Locator active-edge migration = OPEN
```

Exact next proposition:

```text
A25-2 · Active Spatial Viewport Consumer Migration
App/static safeInsets + Minimap + Focus + ProjectCanvas edge auto-pan
→ one environment
```

## Delivery replay

The exact A24-8/A25-1 delivery patch was cold-applied to the A24-7 baseline tree:

```text
git apply --check = PASS
git apply         = PASS
A13 → A25-1       = ALL PASS (351/351)
W0-3              = 30/30 PASS
W0-2              = 17/17 PASS
SOP-R1            = 8/8 PASS
```

A24-8 remains an environment/Human acceptance debt and is not upgraded by this replay.
