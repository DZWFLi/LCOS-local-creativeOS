# LCOS v0.15 · Surface Component GUI Grammar Freeze

Date: 2026-08-31
Status: PRODUCT FREEZE PROPOSAL / A22-C integration input

---

# 0. Core correction

Previous Component planning was structurally useful but GUI-incomplete.

The remaining mistake is treating a Surface Component as:

```text
generic window/card
+ title bar
+ permanent +/-/x controls
+ collapsed mini-bar
```

LCOS Surface Component should instead be understood as a:

# Spatial Instrument

A Component is a persistent functional instrument placed in a Surface.

It is NOT:
- a Project Object;
- an Artifact;
- a generic node/card;
- a small SaaS window;
- an Assembly warehouse item;
- a permanent toolbar.

Its GUI must express:
1. what the instrument does;
2. where it lives in space;
3. when its controls are transient vs persistent;
4. how it collapses without losing identity;
5. how it coexists with Selection, Orbit/Action Arc, Pin, Focus and Search.

---

# 1. Design lessons inherited from Orbit / Spatial Navigation

The following lessons are now applied to Components.

## 1.1 Semantic owner does not imply heavy visual shell

Orbit is an object-local action owner, but it does not need a visible circular track.

Likewise:

```text
Component lifecycle / ownership
≠
permanent title bar + buttons
```

## 1.2 Persistent identity and transient operations must separate

Persistent:
- Component spatial anchor;
- Component body while expanded;
- Component Map Locator identity;
- Component-specific functional surface.

Transient:
- Action Arc;
- resize handles;
- management affordances;
- popovers;
- settings;
- destructive actions.

## 1.3 Collapse must preserve spatial meaning

Current wrong model:

```text
expanded card
↓ collapse
empty horizontal bar
```

Correct model:

```text
expanded Spatial Instrument
↓ collapse
Map Locator at the SAME spatial anchor
```

Collapse is not “make the window shorter”.
It is “reduce the instrument to its spatial landmark”.

## 1.4 No duplicated command surfaces

Component internal UI, Action Arc and Right-click must have distinct responsibilities.

They must not repeat the same command set.

---

# 2. Canonical Component morphology

## 2.1 Expanded state

A Component should visually read as a functional instrument with minimal outer chrome.

```text
                Map Locator / anchor
                        ▼
                 [ spatial anchor ]

          species-specific functional face
        ┌─────────────────────────────┐
        │                             │
        │    Component's real UI      │
        │                             │
        └─────────────────────────────┘
```

There is no mandatory generic full-width header bar.

Identity may be shown as:
- a small exterior legend;
- a compact species title;
- an internal title only when the component itself needs one.

Permanent `○ / + / ×` chrome is retired.

## 2.2 Selection state

When selected:

```text
Component body
+ light selected outline / bounds
+ optional resize handles
+ top-right corner Action Arc
```

The Action Arc follows the same LCOS object-local grammar:

- no visible track;
- top-right corner-hugging short arc;
- 3 default actions / 4 maximum;
- overflow goes to More / context menu.

## 2.3 Collapsed state

Universal collapsed morphology:

```text
Map Locator only
```

Not:

```text
thin empty bar
```

The Map Locator is large, obvious and spatial.

The same Component identity and world anchor are preserved.

Click / Enter on Locator:
- expand the Component at the same anchor.

Hover:
- may show a small transient Peek with title / type / minimal state.

The Peek is not a persistent compact Component.

---

# 3. Spatial anchor model

A Component gets a stable **Component Anchor**.

Recommended visual anchor:

```text
body top-center
```

The Map Locator tip points to this anchor.

Expanded:

```text
          Map Locator
              ▼
              •  ← anchor
      ┌───────────────┐
      │   Component   │
      └───────────────┘
```

Collapsed:

```text
          Map Locator
              ▼
              •  ← same anchor
```

Expansion grows the instrument body outward/downward from the anchor.

This prevents the collapsed object from visually “jumping” to another coordinate.

---

# 4. Component Map Locator

Component Locator uses the already frozen LCOS map-marker morphology.

It is:
- large;
- high-contrast;
- direction-capable;
- visually distinct from Color Pin dots;
- visually stronger than Action Arc glyphs.

## 4.1 In-view

Expanded Component:
- Locator remains attached to the anchor;
- it acts as spatial landmark and collapse/expand affordance.

Collapsed Component:
- Locator becomes the primary visible body.

## 4.2 Offscreen

When a Component that requires navigation is offscreen:

- Locator may attach to viewport safe edge;
- its pointed tip / long axis points toward the Component world anchor;
- click performs Focus/Fly-to.

The exact clutter/aggregation policy for many simultaneous offscreen Components must be solved separately and must not be guessed by individual Components.

---

# 5. Component internal UI vs Action Arc vs Right-click

This division is mandatory.

## 5.1 Internal functional face

Contains actions intrinsic to the Component's actual job.

Examples:

Structure component:
- structure navigation;
- layer/evolution controls specific to Structure.

Review/check component:
- approve/reject/checkpoint interactions.

Layout component:
- its layout-mode controls.

The internal UI should not include generic lifecycle commands like delete, duplicate, move-to-surface.

## 5.2 Action Arc

Contains only high-frequency object-local lifecycle actions.

Candidate Component actions:

```text
Collapse / Expand
Focus / Locate
Pin/Landmark-specific action if needed
More
```

If a Component has one truly universal, high-frequency operation, it may occupy one Arc slot.

Do NOT mirror every internal control into Action Arc.

## 5.3 Right-click / More

Contains low-frequency management commands:

```text
Rename
Duplicate
Move / reposition
Resize mode / reset size
Settings / configure
Hide
Delete / remove Component
Inspect
species-specific secondary commands
```

This follows the same LCOS command hierarchy learned from Lovart:

```text
direct frequent operation
→ Action Arc / functional face

management / structure / destructive
→ Right-click / More
```

---

# 6. No universal “compact bar”

LCOS should NOT define a universal intermediate morphology such as:

```text
[ Component Name ---------------- ○ + × ]
```

If a specific Component genuinely has a meaningful compact view, it may define one as a species-specific morphology.

Examples:
- a real status meter may have a compact status strip;
- a playback component may have a compact transport control.

But this must be semantically meaningful.

Generic collapse always goes to Map Locator.

---

# 7. Reader LOD vs user Collapse

These states must remain distinct.

## User Collapse

User explicitly collapses a Component.

```text
Expanded
→ Locator
```

It remains Locator even after zoom changes.

## Automatic LOD

Reader/camera state temporarily simplifies a Component due to scale.

```text
Expanded Component
→ temporary simplified projection
→ zoom returns
→ expanded projection returns automatically
```

Automatic LOD must NOT mutate the user's Collapse state.

---

# 8. Component frame philosophy

The outer frame should be minimal and conditional.

Rules:
- no permanent heavy card chrome;
- no permanent action row;
- no generic title bar unless necessary;
- no fake “window” controls;
- no empty frame when content is absent;
- selected outline and resize handles appear only when needed;
- Component species may own their own silhouette, padding and internal hierarchy.

This is the same lesson as Object Species:

```text
shared interaction grammar
≠
shared visual rectangle
```

---

# 9. Surface-specific Components

Main / Context / Workflow may share the Component Host grammar but not a forced universal Component catalog.

Each Surface gets only Components that materially support its working semantics.

## Main examples

Potentially useful:
- lightweight project/navigation instruments;
- presentation/layout tools;
- shared overview instruments.

Avoid turning Main into an analytics/dashboard page.

## Context examples

Component morphology should support Context-native work:

```text
Structure
Evolution
Relationship
Source
Focus-related instruments
```

These are not generic cards with labels.
Each should expose its primary Context operation directly.

## Workflow examples

Component morphology should support:

```text
Scope
Path
Review
Checkpoint
Execution / IO inspection
Skill composition projections
```

Again, functional face first; generic shell second.

---

# 10. Component Catalog / creation

The creation UI should not be a tiny fixed `+` menu containing a handful of mysterious components.

Recommended mental model:

```text
Add Component
↓
searchable Surface Component Catalog
↓
only Surface-valid component families
↓
preview / concise purpose
↓
place into current Surface
```

Creation may be entered from:
- blank-canvas right-click;
- Surface add control;
- keyboard shortcut;
- other explicit add affordance.

The catalog is not Assembly.

Components are Surface tools, not warehouse project objects.

---

# 11. Initial placement

Creation should use shared placement logic to suggest a free nearby region.

```text
create candidate
↓
measure expected Component body
↓
SpatialOverlay/placement geometry or dedicated Component placement owner
↓
ghost preview
↓
commit
```

Do not randomly dump new Components on top of project objects.

After placement:
- user position becomes meaningful spatial state;
- automatic push/reflow must not silently mutate neighboring content.

---

# 12. Component interaction priority

A Component contains interactive UI, so hit-testing must distinguish:

1. internal control interaction;
2. Component body selection;
3. drag/reposition;
4. resize;
5. Action Arc;
6. canvas selection/marquee behind it.

A click on an internal control must not accidentally start canvas drag/marquee.

A click on the Component's non-control body may select the Component.

This must be explicit, not left to bubbling accidents.

---

# 13. Selection relationship

Surface Components are selectable spatial instruments but are NOT automatically Project Objects.

Therefore:
- selection may include Component-local selection state;
- Project semantic Relation must not treat a Component as a canonical Project Relation endpoint unless an explicit product decision creates such semantics;
- Assembly must not ingest Surface Components as project materials;
- Focus/Search behavior for Components must be explicitly classified as Surface-local navigation, not inferred from Artifact behavior.

---

# 14. Visual hierarchy

Recommended hierarchy:

```text
Map Locator
= strong persistent spatial landmark

Component body
= primary functional surface

Action Arc
= light transient local controls

Selection/resize chrome
= temporary editing feedback

Right-click
= management layer
```

The current implementation reverses this too often:
- permanent control chrome is visually stronger than Component content;
- collapsed bar remains visually large while semantically empty.

That hierarchy is retired.

---

# 15. Example state sequence

## Expanded idle

```text
             📍
              ▼
      ┌─────────────────┐
      │  Structure UI   │
      │                 │
      └─────────────────┘
```

No permanent control buttons.

## Selected

```text
                 ○
              ○
           ○
             📍
              ▼
      ╔═════════════════╗
      ║  Structure UI   ║
      ╚═════════════════╝
```

`○` represents the top-right corner Action Arc geometry, not a literal diagonal row.

## Collapsed

```text
             📍
```

## Collapsed selected

```text
               ○
            ○
          📍
```

## Offscreen

```text
viewport safe edge

📍→

tip/axis points toward Component anchor
```

---

# 16. Relationship to Centered Spatial Index

Component Locator belongs to the Spatial Navigation family, but is not a Color Pin.

```text
Color Pin
= user-authored color index relationship

Focus marker
= transient occurrence chooser

Map Locator
= spatial direction / landmark

Component Map Locator
= the Component's landmark projection
```

Top Centered Spatial Index may navigate to Components only through an explicitly defined Search/Focus path.

Do not insert every Component's Locator into the global Color Pin index.

---

# 17. A/C/D ownership

## A22 / interaction grammar

Freeze or implement:
- Component = Spatial Instrument;
- permanent generic top-right buttons retired;
- generic collapsed bar retired;
- collapse → Map Locator;
- Action Arc / Right-click division;
- anchor semantics;
- hit-test ownership;
- user Collapse vs reader LOD separation.

## Phase B

Only if shared Species infrastructure materially affects Component host geometry.
Do not convert Components into Project Object species.

## Phase C

Implement/refine Surface-specific Component families:
- Context components;
- Workflow components;
- Skill Builder projections;
- Assembly stays separate.

## Phase D

Polish:
- Locator size/material;
- Component frame material;
- selection outline;
- Action Arc motion;
- resize handles;
- expansion/collapse transition;
- species-specific visual refinement.

D must not redefine Component semantics.

---

# 18. Final freeze

1. Surface Component is a Spatial Instrument, not a generic card/window.
2. Component functionality lives in its own species-specific functional face.
3. Generic permanent header/action chrome is removed.
4. Universal collapse goes directly to Map Locator.
5. The collapsed empty mini-bar is retired.
6. Map Locator and expanded body share one stable spatial anchor.
7. Action Arc is transient and contains only high-frequency object-local lifecycle actions.
8. Right-click / More owns management, structure and destructive actions.
9. Internal functional controls are not duplicated into Action Arc.
10. A universal compact bar does not exist; compact morphology is species-specific only when meaningful.
11. User Collapse and automatic LOD are separate states.
12. Components remain Surface-local instruments and do not silently become Project Objects or Assembly materials.
13. Shared Component Host grammar does not force shared visual rectangles.
14. Surface-specific Components must visibly express the job they perform.
