# LCOS v0.15 · A20 SpatialOverlayPlacement Owner Closeout

Date: 2026-08-31
Status: **SOURCE / STATIC PASS · STACKED COLD APPLY PASS · LOCAL-MERGE CANDIDATE**

## 0. Provenance

```text
latest real local authority = 5901c02 (A18)
A19 real-local merge        = pending
construction stack          = 5901c02-equivalent → A19 candidate → A20
```

The user explicitly authorized continued construction. No post-A19 HEAD is invented.

---

## 1. Proposition

A20 closes one geometry-owner proposition:

> Contextual near-field overlays must delegate screen-space placement to one `SpatialOverlayPlacement` owner using visual target bounds, measured overlay size, viewport geometry and occupied/safe space. The placement owner does not mutate Project object geometry and does not replace mature Base UI/Orbit positioners.

---

## 2. New canonical owner

New files:

- `apps/web/src/features/ui/spatialOverlayPlacement.ts`
- `apps/web/src/features/ui/spatialOverlayEnvironment.ts`
- `apps/web/src/features/ui/__tests__/spatialOverlayPlacement.test.ts`

Canonical contract:

```text
targetBounds
+ overlaySize
+ viewport
+ safeInsets
+ occupiedRects
+ preferredSide
→ resolveSpatialOverlayPlacement()
→ { left, top, width, height, side, free, overlapArea }
```

The resolver operates purely in screen-space geometry. It does not import `CanvasNode`, mutate node layout, or create persistence truth.

---

## 3. Main Unified Composer migration

Before A20:

```text
Selection persisted/world anchor
→ manual Math.min/Math.max viewport clamp
→ guessed 430×128-ish footprint
```

After A20:

```text
selectedVisualBounds
→ screen-space target rect
→ real canvas viewport
→ measured Composer getBoundingClientRect()
→ occupied Dock/Rail/Minimap/transient rects
→ SpatialOverlayPlacement
```

`UnifiedExecutionComposer` measures its real rendered footprint with `ResizeObserver`. Existing `x/y` remain only as fallback for non-migrated call sites; Main provides the canonical placement context.

A19 lifecycle ownership remains intact: one `overlayStack` registration, top-only Esc/outside dismissal.

---

## 4. NodeInfo migration

Before A20:

```text
persisted node rectangle
+ hard-coded 294×510
+ preferLeft / preferAbove
+ window clamp
```

After A20:

```text
nodeVisualBounds(node)
→ screen-space visual target rect
+ measured Popover footprint
+ canvas viewport
+ occupied rects
→ SpatialOverlayPlacement
```

The old `preferLeft` / `preferAbove` geometry owner is retired.

---

## 5. Occupied rect environment

A20 adds a shared DOM measurement adapter for known occupied screen-space regions, including:

- bottom Dock;
- workspace Rail;
- open Work Rail;
- Minimap;
- Project Strip;
- Orbit layer;
- Selection group actions;
- surface context/create menus.

This is architecture evidence, not final visual acceptance.

---

## 6. Deliberate non-goals

A20 does **not**:

- replace ObjectOrbit satellite placement;
- replace Base UI `Menu.Positioner`;
- migrate every production portal;
- alter Selection/model geometry;
- claim motion-direction causality B08 complete;
- claim final four-corner/Dock/Rail/Minimap visual QA;
- close Phase A.

---

## 7. Validation

```text
A20 dedicated validator          15 / 15 PASS
A19 regression                   13 / 13 PASS
full runnable v0.15 static       48 PASS / 0 FAIL / 2 SKIP
changed syntax transpile         7 / 7 PASS
placement functional smoke       4 / 4 PASS
git diff --check                 PASS
semantic typecheck               BLOCKED_ENV
```

The two skipped static gates remain S9/S10 external semantic/provider gates.

Typecheck attempt fails only because the construction archive has no local dependency tree:

```text
TS2688 node
TS2688 vite/client
```

This is not counted as PASS.

---

## 8. Required local evidence

Before A20 becomes a real RC authority, local merge must provide:

```text
A19 + A20 applied to real 5901c02 lineage
new HEAD
full typecheck PASS
web unit PASS
local-core unit PASS
A19/A20 dedicated gates PASS
full v0.15 static PASS
```

And before placement is product-accepted:

```text
25 / 35 / 60 / 100 / 150% zoom
four viewport corners
Dock open/closed
Rail / Work Rail
Minimap
Windows 125% / 150% DPI where applicable
```

must receive real runtime/Human QA.

---

## 9. Verdict

```text
A20 SOURCE / STATIC             = PASS
A20 STACKED COLD APPLY          = PASS
A20 LOCAL MERGE CANDIDATE       = YES
A20 VISUAL ACCEPTANCE           = NOT CLAIMED
PHASE A COMPLETE                = NO
PHASE B ADMISSION               = NO
```
