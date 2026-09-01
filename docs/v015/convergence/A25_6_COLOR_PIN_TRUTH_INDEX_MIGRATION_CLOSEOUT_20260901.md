# A25-6 · Color Pin Truth + Index Migration Closeout

Date: 2026-09-01
Status: **SOURCE/STATIC PASS · AUTHORING/HUMAN OPEN**

## Proposition

Land real many-to-many Color Pin truth before authoring UI:

```text
ColorPinDefinition (project color identity / optional name)
↕ many-to-many
ColorPinMembership (canonical target relationship)
→ existing Navigation resolution
→ only live persisted colors enter Centered Spatial Index
```

Color Pin does **not** reuse `SpatialMarkerIntentV0` as a color field and does not persist world/screen coordinates.

## Implemented

- schema `50 → 51` with normalized `color_pin_definitions` + `color_pin_memberships`;
- `UNIQUE(project_id,color_value)` identities and many-to-many membership uniqueness;
- ChangeSet-backed assign/remove with revert/reapply;
- same-project + canonical target resolution validation before write;
- Local Core list/assign/remove routes;
- Web LocalCoreClient contract + read model resolving targets through existing Navigation Marker service;
- Top Spatial Index receives only groups with at least one **resolved persisted membership**;
- no placeholder/default color toolbar;
- Search > Focus > Color Pin > none arbitration remains unchanged;
- legacy binary `SpatialMarkerIntentV0` action is no longer presented as object `Pin` while real Color Pin authoring is still absent.

## Explicitly not implemented in this package

- Action Arc Color Pin authoring palette/popover;
- node-local persistent Color Pin dots;
- multi-member Color Pin compact popover;
- direct member Focus/Fly-to interaction;
- rename/remove color identity management;
- visual/material polish;
- Browser/Human acceptance.

These are A25-7+ propositions. The old binary Spatial Marker system remains a navigation-intent subsystem; it is not deleted or renamed into Color Pin.

## Evidence

```text
node scripts/validate-v015-a25-6-color-pin-truth-index.mjs
→ 32/32 PASS

node --experimental-strip-types
  color-pin.ts + projectColorPinIndex.ts
→ PASS
```

Cumulative regression before cold replay:

```text
A13 → A25-6 dedicated cumulative = 500/500 PASS
W0-3 = 30/30 PASS
W0-2 = 17/17 PASS
SOP-R1 = 8/8 PASS
R3.1A6 = 10/10 PASS
F6A = 13/13 PASS
```

Cold patch replay from the exact A25-5 delivery tree:

```text
git apply --check = PASS
git apply = PASS
A13 → A25-6 cumulative = 500/500 PASS
W0-3 = 30/30 PASS
W0-2 = 17/17 PASS
SOP-R1 = 8/8 PASS
R3.1A6 = 10/10 PASS
F6A = 13/13 PASS
```

A25-6 package status is therefore **PASS** for its bounded truth/index proposition. Browser/Human Color Pin authoring acceptance remains OPEN because authoring/local dots/member navigation are explicitly A25-7+.

## Next

```text
A25-7 · Color Pin Authoring + Local Dots + Member Popover
→ Action Arc Pin returns with real many-to-many semantics
→ compact transient color chooser
→ persistent local dots above target
→ one member = Focus/Fly-to
→ many members = compact member popover
```
