# A25-7 · Color Pin Authoring + Local Dots + Members Closeout

Date: 2026-09-01
Status: **PACKAGE PASS · BROWSER/HUMAN OPEN**

## Proposition

Make A25-6 canonical many-to-many Color Pin truth directly usable without adding permanent node chrome:

```text
selected object
→ top-right Action Arc / Orbit
→ Pin
→ compact transient color authoring
→ canonical ColorPinDefinition + ColorPinMembership
→ persistent local dots above every projection of that view

Top Color Pin
→ 1 member  → existing Focus owner
→ N members → compact member popover → existing Focus owner
```

Color Pin stays distinct from the legacy binary Spatial Navigation Marker. No coordinates, Selection truth or Camera state are persisted by Color Pin.

## Implemented

- one project-level `ProjectColorPinRuntime` Context reuses the A25-6 read/write model instead of fetching per object;
- ordinary `ProjectObjectOrbit` restores a real many-to-many `Pin` direct action;
- Conversation Orbit migrates its old binary navigation-marker action to the same Color Pin authoring owner;
- compact `ColorPinAuthoringPopover` reuses A20 collision-aware `SpatialOverlayPlacement`;
- authoring may reuse existing Project color identities or create a small V0 preset color identity; exact palette/material remains D polish;
- clicking an assigned swatch removes only that target↔color membership; other colors remain intact;
- `ColorPinLocalDots` render persistently above Main and shared Context/Workflow object projections without becoming node buttons/toolbars;
- one-member top Color Pin hands to existing `openProjectFocus()`;
- multi-member top Color Pin opens one compact member popover under the top spatial index, then member selection hands to existing Focus;
- Search > Focus > Color Pin > none arbitration remains unchanged;
- Action Arc direct-action ceiling remains four.

## Explicitly not implemented here

- rename/delete Color Pin definition management;
- final palette/material/spacing/pulse polish;
- Browser/Human visual acceptance at real zoom/DPI/Work View occupancy;
- changing legacy Spatial Marker persistence (it remains a separate navigation-intent subsystem);
- any new Camera, Search, Focus or Selection truth.

## Evidence

```text
node scripts/validate-v015-a25-7-color-pin-authoring.mjs
→ 32/32 PASS

node --experimental-strip-types scripts/smoke-v015-a25-7-color-pin-authoring.mjs
→ 3/3 PASS

A13 → A25-7 dedicated cumulative
→ 532/532 PASS

W0-3 → 30/30 PASS
W0-2 → 17/17 PASS
SOP-R1 → 8/8 PASS
R3.1A6 → 10/10 PASS
F6A → 13/13 PASS
```

Cold patch replay evidence:

```text
pure A25-6 exact delivery baseline
→ git apply --check LCOS_v015_A25_7_ColorPinAuthoringLocalDotsMembers_20260901.patch
→ git apply
→ git diff --check
→ A13 → A25-7 dedicated cumulative 532/532 PASS
→ W0-3 30/30 PASS
→ W0-2 17/17 PASS
→ SOP-R1 8/8 PASS
→ R3.1A6 10/10 PASS
→ F6A 13/13 PASS
```

This closes the A25-7 package gate only. Browser/Human visual acceptance remains OPEN.

## Human acceptance still required

- local dots remain readable and non-obstructive at 25/35/60/100/150% zoom;
- Action Arc + Pin authoring popover do not collide with Composer/Relation/Pin dots;
- Context/Workflow projections retain the same Color Pin identity;
- one member Focus and multi-member member-popover handoff feel immediate;
- 1080p/1440p/4K and Windows 125%/150% DPI;
- Unified Work View occupied region does not cover top index/member popover.

## Next

```text
A25-8 · Spatial Navigation runtime/fresh census
→ final automated source/runtime census for A25
→ record Browser/Human environment debt honestly
→ decide smallest remaining Phase A blocker before B0
```
