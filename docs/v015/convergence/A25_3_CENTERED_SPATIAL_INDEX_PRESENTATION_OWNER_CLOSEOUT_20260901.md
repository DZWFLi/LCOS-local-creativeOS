# LCOS v0.15 · A25-3 Centered Spatial Index Presentation Owner Closeout

Date: 2026-09-01
Status: **SOURCE / STATIC PASS · FOCUS/SEARCH/COLOR-PIN CONSUMER MIGRATION OPEN**
Baseline: A25-2 Active Spatial Viewport Consumer Migration

## Product proposition

Can Phase A establish exactly one viewport-fixed **Top Spatial Index Slot** whose geometry is centered on the *active* SpatialCanvas region and whose presentation owner follows the frozen priority:

```text
Search
> Focus
> Color Pin
> none
```

without merging Search / Focus / Color Pin / Assembly canonical truth and without prematurely rewriting their existing consumers in the same package?

## Mandatory read gate completed before planning

Full-read / source-read for this proposition:

- `CENTERED_SPATIAL_INDEX_SEARCH_ASSEMBLY_FREEZE_20260831.md`;
- `NAV_PIN_ORBIT_RECEIVER_PROJECT_IDENTITY_20260831.md`;
- `A22_OBJECT_LOCAL_INTERACTION_GRAMMAR_CLOSEOUT_20260831.md`;
- `A25_1_ACTIVE_SPATIAL_VIEWPORT_GEOMETRY_OWNER_CLOSEOUT_20260901.md`;
- `A25_2_ACTIVE_SPATIAL_VIEWPORT_CONSUMER_MIGRATION_CLOSEOUT_20260901.md`;
- current `ProjectFocusNavigator` / `ArtifactLocationOrbit` / `ProjectSearchLens` production paths;
- V03 TapNow original analysis and current Video Donor Index;
- latest user Reality Feedback: Focus must stop reading like a cramped list; Pin/Focus/Search may share a top-centered spatial language but MUST NOT share truth; only one dominant top owner may be visible.

## Current reality before A25-3

A25-1/A25-2 already establish:

```text
persistent edge UI
→ ActiveSpatialViewport
→ topCenterAnchor / activeInsets / edgeBounds
```

But no shared top-slot presentation owner existed yet.

Meanwhile current production still has:

- Search inside `ProjectTools` / `ProjectSearchLens` dialog/list presentation;
- Focus primarily in `ProjectFocusNavigator`, with one-object `ArtifactLocationOrbit` special case;
- old binary Spatial Navigation Marker truth, not many-to-many Color Pin truth.

Those are **consumer migration debts**, not a reason to let A25-3 absorb Search/Focus/Pin semantics into one store.

## Implemented

### 1. Pure arbitration owner

New:

`apps/web/src/features/spatial/centeredSpatialIndex.ts`

Normal Surface arbitration is deterministic:

```text
searchActive
→ search

else focusActive
→ focus

else real colorPinCount > 0
→ color-pin

else
→ none
```

Assembly is represented as a valid shared presentation variant but remains outside the normal Main/Context/Workflow arbiter because Assembly owns its own Workspace slot.

### 2. Deterministic center-symmetric layout

The primitive uses count-driven templates for 1–7 primary positions.

Hard geometry properties:

- center-balanced X-axis;
- shallow constellation rather than flat toolbar;
- deterministic per count;
- no left-origin growth;
- no empty placeholder marker;
- overflow reserves one of the seven primary positions instead of being appended to the right.

For >7 items:

```text
6 direct markers
+ centered +N marker
```

The next consumer packages may choose different content-specific primary caps below seven, but they must use the same centered geometry family.

### 3. One viewport-fixed renderer

New:

`apps/web/src/features/spatial/CenteredSpatialIndex.tsx`

The renderer:

- consumes `ActiveSpatialViewport.topCenterAnchor`;
- owns presentation only;
- stores no Search/Focus/Pin canonical state;
- emits `onActivate` / `onHover` / `onOverflow` callbacks;
- exposes `data-spatial-index-owner` for deterministic ownership evidence;
- renders no marker when item input is empty.

### 4. App-level live arbitration wiring

`App.tsx` now resolves the current winner from existing live state:

```text
projectToolsMode === 'search'
projectFocusOpen
future real Color Pin count
```

Color Pin input is intentionally `0` until its many-to-many truth is implemented. A25-3 does **not** create permanent default colors merely to make the HUD visible.

The slot shell is mounted exactly once.

### 5. Motion boundary

A25-3 adds only restrained screen-space rebalance transitions for marker position changes and disables them under `prefers-reduced-motion`.

Phase D still owns final motion/material polish.

## Explicitly not implemented

A25-3 does **not**:

- migrate Focus locations into the centered slot;
- retire `ProjectFocusNavigator` yet;
- migrate Search result rendering;
- change Search retrieval/backend;
- define Color Pin canonical schema;
- convert current binary Spatial Marker into Color Pin;
- add permanent empty color choices;
- modify Map Locator morphology;
- modify Camera behavior;
- implement Assembly category consumers.

That separation is intentional.

## Validation

Dedicated evidence:

```text
A25-3 centered index gate
→ arbitration priority
→ no placeholder truth
→ deterministic 1–7 symmetry
→ centered overflow
→ activeSpatialViewport anchor
→ one App slot
→ existing Focus/Search consumer retained for later migration
→ reduced motion
```

Current result is recorded after final patch replay below.

## Human / browser debt

Still required later:

- actual top-center location with left/right edge occupants;
- 1080p / 1440p / 4K;
- Windows 125% / 150% DPI;
- Search / Focus handoff without stacked constellations;
- hit target and hover label handfeel;
- Work View open/resize while slot remains visually centered in remaining Canvas;
- no collision with Map Locator / Action Arc / Composer / top shell.

## Next proposition

```text
A25-4 · Focus Location Index Migration
```

Use existing `projectFocusLocations` truth and `navigateProjectFocus()` behavior, but replace the old large Focus list as the primary presentation with the Centered Spatial Index + Map Locator handoff. Search and Color Pin remain separately staged.

## Construction validation before patch replay

```text
A25-3 dedicated = 25/25 PASS
A13 → A25-3 cumulative = 404/404 PASS
W0-3 = 30/30 PASS
W0-2 = 17/17 PASS
SOP-R1 = 8/8 PASS
```

Browser/Human visual acceptance remains OPEN.

## Final cold patch replay evidence

From the committed pure A25-2 baseline:

```text
git apply --check A25-3 patch = PASS
git apply A25-3 patch         = PASS
A13 → A25-3                   = 404/404 PASS
W0-3                           = 30/30 PASS
W0-2                           = 17/17 PASS
SOP-R1                         = 8/8 PASS
```

The baseline authority documents retain their existing CRLF convention; final diff checking uses Git's `cr-at-eol` rule rather than normalizing whole authoritative files.

This replay proves A25-3 does not depend on incidental working-tree edits.
