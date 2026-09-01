# LCOS v0.15 · A25-4 Focus Location Index Migration Closeout

Date: 2026-09-01
Status: **SOURCE / STATIC PASS · BROWSER/HUMAN OPEN**
Baseline: A25-3 Centered Spatial Index Presentation Owner

## Product proposition

Can Focus / “在哪” stop using a large list or object-local location Orbit as its primary GUI and instead project the already-existing `projectFocusLocations` truth into the one Centered Spatial Index slot, while preserving the existing navigation callback and keeping Search / Color Pin truth separate?

## Mandatory read gate completed before planning

Full-read / source-read for this proposition:

- `CENTERED_SPATIAL_INDEX_SEARCH_ASSEMBLY_FREEZE_20260831.md` Focus / Search-handoff / Map Locator clauses;
- `NAV_PIN_ORBIT_RECEIVER_PROJECT_IDENTITY_20260831.md` Navigation + Pin separation and historical Focus entry behavior;
- `LATEST_L0_WORKVIEW_HUD_DIRECT_MANIPULATION_ADDENDUM_20260901.md` activeSpatialViewport and no-extra-chrome rules;
- `A25_1_ACTIVE_SPATIAL_VIEWPORT_GEOMETRY_OWNER_CLOSEOUT_20260901.md`;
- `A25_2_ACTIVE_SPATIAL_VIEWPORT_CONSUMER_MIGRATION_CLOSEOUT_20260901.md`;
- `A25_3_CENTERED_SPATIAL_INDEX_PRESENTATION_OWNER_CLOSEOUT_20260901.md`;
- current `projectFocus.ts`, `ProjectFocusNavigator`, `ArtifactLocationOrbit`, `navigateProjectFocus()` and App production wiring;
- latest user Reality Feedback that Focus should become a temporary top-centered spatial locator rather than a cramped list, with compact transient expansion instead of another fixed panel.

## Current reality before A25-4

Focus truth was already usable:

```text
projectFocusSourceIds
→ semanticRefsForSourceIds
→ resolveProjectFocusLocations
→ projectFocusLocations
→ navigateProjectFocus(location)
```

But presentation still split by object count:

```text
single object + anchor
→ ArtifactLocationOrbit

otherwise / More
→ ProjectFocusNavigator large list
```

That violated the later Focus GUI freeze even though the underlying location truth was sound.

## Implemented

### 1. Pure Focus → Centered Index adapter

New:

`apps/web/src/features/focus/projectFocusIndex.ts`

It maps each real `ProjectFocusLocation` to one `CenteredSpatialIndexItem` without owning Focus state.

Preserved:

- real location key;
- current/active occurrence;
- location label;
- Surface / Workspace / Collection kind context;
- matched count.

The adapter can resolve an index item id back to the existing `ProjectFocusLocation`; navigation still calls the pre-existing `navigateProjectFocus()` owner.

### 2. Focus now feeds the one top slot

When:

```text
topSpatialIndexOwner === 'focus'
```

App passes `projectFocusIndexItems` into the existing `CenteredSpatialIndex`.

Marker activation:

```text
index item id
→ existing ProjectFocusLocation
→ existing navigateProjectFocus(location)
→ existing cross-Surface / Camera Focus behavior
```

No second Focus store or navigation route was introduced.

### 3. Old Focus primary presentations retired from App

App no longer mounts:

- `ArtifactLocationOrbit` for single-object Focus;
- `ProjectFocusNavigator` for list-mode Focus.

Their source files remain in the tree for history / possible explicit accessibility reuse, but they are no longer production primary owners.

Focus also no longer enters the dominant dialog stack merely to answer “where does this known object occur?”.

### 4. Compact `+N` expansion stays in the spatial-index family

A25-3 already reserved a centered `+N` slot when there are more than seven primary positions.

A25-4 extends the shared renderer with a small, viewport-fixed **overflow fan** under the same top anchor:

- no right sidebar;
- no permanent list;
- compact wrapping pills/markers;
- real location labels;
- same `onActivate` navigation callback;
- Esc closes the overflow fan before closing Focus.

The fan width is bounded by the current active spatial viewport rather than assuming the full browser width.

### 5. Focus remains transient

Opening a new Focus resets overflow expansion.

Keyboard behavior:

```text
F
→ open Focus for current Selection

F again
→ close Focus

Esc with +N fan open
→ close fan only

Esc again
→ close Focus
```

Search still outranks Focus in the one-slot arbiter; if Search takes the slot, Focus truth remains intact but its overflow fan yields.

## Explicitly not implemented

A25-4 does **not**:

- rewrite Search retrieval or Search result UI;
- define Color Pin canonical truth;
- convert binary Spatial Navigation Markers into Color Pins;
- create default Pin colors;
- create a second Focus persistence model;
- change `navigateProjectFocus()` Surface switching / Camera semantics;
- redesign Map Locator morphology;
- claim Browser/Human visual acceptance.

## Map Locator / navigation handoff boundary

A25-4 preserves the existing `navigateProjectFocus()` → `SpatialFocusRequest` path. The top marker chooses a real occurrence/location; existing Focus/camera/navigation infrastructure performs the actual transition and arrival behavior.

The dedicated edge Map Locator morphology remains a separate spatial-navigation presentation and is not duplicated inside the top index.

## Validation

Dedicated evidence covers:

- real Focus truth → index adapter;
- active occurrence preservation;
- one marker per real location;
- existing navigate owner reuse;
- old large-list and object-local location Orbit retired from App;
- Focus removed from dialog stack;
- compact `+N` fan instead of fallback list;
- overflow-first Esc behavior;
- Search / Color Pin truth untouched;
- source/static smoke of the pure adapter.

Final counts are recorded after cold patch replay below.

## Human / browser debt

Still required before Phase A admission:

- actual top marker hit/hover readability;
- current occurrence active feedback;
- `+N` fan handfeel at 1080p / 1440p / 4K;
- Work View / Rail occupancy while Focus stays centered in the remaining Canvas;
- Windows 125% / 150% DPI;
- cross-Surface navigation and arrival beacon;
- Map Locator / Focus index collision behavior;
- accessibility fallback decision if a genuine non-spatial list mode is required.

## Next proposition

```text
A25-5 · Search Result Index Migration
```

Keep Search retrieval/query truth intact, but migrate the result presentation into the same top slot and preserve the frozen handoff:

```text
Search result
→ “在哪”
→ Search yields
→ Focus Location Index
```

Color Pin remains separately staged after Search.

## Construction validation before patch replay

```text
A25-4 dedicated = 31/31 PASS
A13 → A25-4 cumulative = 435/435 PASS
W0-3 = 30/30 PASS
W0-2 = 17/17 PASS
SOP-R1 = 8/8 PASS
```

Browser/Human visual acceptance remains OPEN.

## Final cold patch replay evidence

From the pure A25-3 baseline:

```text
git apply --check A25-4 patch = PASS
git apply A25-4 patch         = PASS
A13 → A25-4                   = 435/435 PASS
W0-3                           = 30/30 PASS
W0-2                           = 17/17 PASS
SOP-R1                         = 8/8 PASS
```

The patch contains no Search backend migration and no Color Pin schema work. The retired Focus primary presentations remain in source history but are no longer mounted by App.
