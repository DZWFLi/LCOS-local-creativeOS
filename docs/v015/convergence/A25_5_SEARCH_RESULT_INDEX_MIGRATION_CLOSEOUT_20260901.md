# LCOS v0.15 · A25-5 Search Result Index Migration Closeout

Date: 2026-09-01
Status: **SOURCE / STATIC PASS · BROWSER/HUMAN OPEN**

## Proposition

Migrate the existing transient Project Search query/result presentation into the one A25-3 Top Spatial Index slot without rewriting Search retrieval truth and without merging Search into Focus or Color Pin.

Frozen product chain:

```text
Ctrl/Cmd + F
→ compact top-center Search input
→ existing local + Local Core projectSearch retrieval
→ readable labeled result constellation
→ result activation
→ existing Focus / Fly-to handoff when a real occurrence exists
```

Search continues to answer “I do not know exactly what/where the object is.” Focus continues to answer “I know the object; show me its occurrences.”

## Implementation

New Search projection modules:

- `apps/web/src/features/project/projectSearchIndex.ts`
  - owns transient query/loading/error/active-result presentation state;
  - reuses `LocalCoreClient.projectSearch()`;
  - reuses `searchProjectFocusEntries()` for local project projection hits;
  - preserves the existing local-first dedupe / bounded merged result behavior.
- `apps/web/src/features/project/projectSearchIndexModel.ts`
  - pure Search result → Centered Spatial Index adapter;
  - human-readable kind / source-anchor metadata;
  - no Pin, Relation, Selection, Camera or persistence owner.
- `apps/web/src/features/project/ProjectSearchIndexInput.tsx`
  - compact top-center input only;
  - Arrow Up/Down, Enter and layered Esc;
  - no dialog/backdrop/modal shell.

The shared `CenteredSpatialIndex` now accepts a compact control and a `result` presentation. Search result morphology is a small labeled identity pill with a non-circular species glyph; it does not reuse literal Color Pin dots.

## Primary owner retirement

App no longer mounts Search through the `ProjectToolsDialog` search-only path.

```text
before
ProjectToolsDialog(searchOnly)
→ ProjectSearchLens modal/list

after
projectToolsMode = search
→ CenteredSpatialIndex owner = search
→ ProjectSearchIndexInput + labeled result constellation
```

`ProjectSearchLens` remains source/history fallback only; it is not mounted by App as the normal Search GUI. `ProjectToolsDialog` remains for actual full Project Tools management.

## Search → Focus handoff

Search result activation reuses existing navigation truth:

```text
result with sourceIds
→ close Search
→ openProjectFocus(sourceIds, title)
→ Search presentation yields
→ Focus Location Index owns the top slot

artifact result
→ existing focusArtifactFromSearch()
→ Focus when a real View exists
```

A result with no locatable View stays a Search result and reports that reality. It does not fabricate a View, Pin, Relation or occurrence.

## One-slot / overflow behavior

- Search still wins `Search > Focus > Color Pin > none` while active.
- Primary capacity remains the A25-3 seven-slot cap.
- `+N` expands the existing compact top-index overflow field; no Search sidebar/list is reintroduced.
- Empty Search keeps the compact input visible while rendering no fake result markers.
- Width is driven by `activeSpatialViewport`, so persistent edge occupancy / future Unified Work View can reduce the usable top region without Camera mutation.

## Explicit non-goals

A25-5 does **not**:

- change Local Core Search ranking / FTS / semantic retrieval;
- change Search result canonical entity identity;
- define or persist Color Pin truth;
- create Pin or Relation from Search;
- merge Search state into Focus state;
- redesign Map Locator;
- add a Search sidebar, modal or fixed panel;
- claim Browser/Human visual acceptance.

The frozen Search-hover → visible occurrence attention behavior remains part of final A25 runtime/Human convergence; this migration does not introduce a second Selection/highlight truth merely to simulate it.

## Validation

Dedicated evidence verifies:

- existing Local Core `projectSearch()` reuse;
- existing local `searchProjectFocusEntries()` reuse;
- local/remote dedupe and result mapping;
- readable non-Color-Pin Search morphology;
- one Top Spatial Index owner;
- no App Search dialog primary mount;
- compact Search input and compact overflow;
- Search result → existing Focus handoff;
- no Camera/Pin/Relation/Selection ownership;
- source/static Search model smoke.

Browser/Human remains OPEN for:

- real Search typing/loading/error feel;
- labeled result readability at 1080p / 1440p / 4K;
- Windows 125% / 150% DPI;
- active viewport / Work View occupancy;
- hover attention on a visible result occurrence;
- Search → Focus transition motion and arrival;
- keyboard/a11y handfeel of primary + overflow results.

## Next proposition

```text
A25-6 · Color Pin Truth + Index Migration
```

This next package must establish real user-authored many-to-many Color Pin truth before any idle color marker appears. Search and Focus migrations are not permission to reinterpret the legacy binary Spatial Marker as Color Pin state.

## Final cold patch replay evidence

From pure A25-4 baseline (`/mnt/data/a25_4_final_apply`):

```text
git apply --check = PASS
git apply = PASS
A25-5 dedicated = 33/33 PASS
A13 -> A25-5 cumulative = 468/468 PASS
R3.1A6 = 10/10 PASS
F6A = 13/13 PASS
W0-3 = 30/30 PASS
W0-2 = 17/17 PASS
SOP-R1 = 8/8 PASS
```

Browser/Human Search presentation acceptance remains **OPEN** and is not inferred from these source/static gates.
