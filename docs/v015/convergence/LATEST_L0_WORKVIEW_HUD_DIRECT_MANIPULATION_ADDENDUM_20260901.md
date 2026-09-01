# LCOS v0.15 · Latest L0 Addendum
## Unified Work View / Dynamic Spatial Safe Region / Direct-Manipulation Instruments / Skill ≠ Harness Run

Date: 2026-09-01
Status: **LATEST USER L0 / PRODUCT AUTHORITY ADDENDUM**
Applies to: Phase A navigation geometry, B0 Work View foundation, Phase B Preview/Reader migration, Phase C Context/Workflow/Assembly/Skill, Phase D HUD/Motion polish.

---

# 0. Authority

This addendum records explicit user L0 decisions made after the 2026-08-31 frozen documents.

If an older document conflicts with this addendum:

```text
latest explicit user L0
> this addendum
> 2026-08-31 Freeze/Mandatory Context
> older planning / donor / implementation docs
```

This addendum does not rewrite historical files. Superseded clauses stay visible in history.

---

# 1. Assembly entry = capability-driven Action Arc

Assembly Workspace remains one shared Project-level warehouse/composition workspace.

But for an object/component that can be an Assembly target:

```text
Select target
→ top-right Action Arc / Orbit
→ Assembly
→ open the same Project Assembly
→ target is already known
```

Do NOT require:
- a fixed Canvas Assembly launcher;
- bottom `+`;
- opening a tab/rail first;
- `... / More` as the required path;
- entering Assembly and selecting the target again.

Right-click / More stays management-only.

Older `Right-click → Assembly` as a primary direct entry is **SUPERSEDED**.

---

# 2. No node Christmas tree

LCOS already has enough interaction layers:

```text
Object Body
Selection
Action Arc
Compact Composer
Right-click
Tooltip/local explanation
Pin / Locator
```

Therefore capability existence does NOT justify permanent body icons.

Resting object/component bodies should not accumulate permanent:
- Assembly buttons;
- Relation buttons;
- edit buttons;
- More buttons;
- AI buttons;
- generic mini toolbars;
- capability badges.

Persistent glyphs are admitted only when they are persistent spatial identity/state, e.g. Color Pin, Map Locator, species identity, or real semantic status.

---

# 3. Unified Work View

Preview, sustained Reader/Edit, HTML/Link live view, Context/Workflow deep instrument work, Skill Builder and Assembly larger work surfaces converge on one presentation primitive:

```text
Spatial
→ Focus
→ Docked Work View
→ Immersive Work View
→ Restore
```

Docked and Immersive are two size states of the SAME projection, not two products.

Rules:
- one canonical target/truth;
- one functional renderer state;
- no duplicate Reader/Viewer truth;
- Docked is viewport-fixed and does not follow camera pan/zoom;
- width is user-resizable;
- it may expand into Immersive;
- Restore returns the presentation to the spatial projection;
- v0.15 should keep one dominant Work View, not an IDE tab farm.

Entry remains object-local via Action Arc capability. Public action labels remain species-specific (`Preview`, `Read`, `Edit`, `Assembly`, etc.); users do not need to learn an internal “Dock mode” taxonomy.

---

# 4. Work View state is NOT Surface-local

Forbidden model:

```text
MainDockedState
ContextDockedState
WorkflowDockedState
SubcanvasDockedState
```

Correct model:

```text
Project / active UI work session
→ one viewport Work Layer
→ current Work View projection
```

If a target is docked in Main, switching to Context / Workflow / Glyth subcanvas does not close or duplicate it.

It remains until explicit Restore/Close.

This is Presentation/session state, not Project canonical truth.

---

# 5. Dynamic Spatial Safe Region

Unified Work View may occupy a large edge region of the viewport.

This MUST dynamically integrate with all screen-edge / viewport-relative spatial systems:

- Top Centered Spatial Index;
- Color Pin Index;
- Focus occurrence index;
- Search result index;
- Map Locator/offscreen direction glyphs;
- Minimap;
- Navigation / edge cursor;
- edge-scroll / drag auto-pan;
- screen-space relation/hit affordances near edges;
- contextual overlay placement;
- explicit Camera Focus / reading framing.

The Work View must publish a real occupied rectangle / effective interactive canvas region.

Canonical geometry concept:

```text
physical viewport
- static shell insets
- edge-attached persistent Work View occupied rect
= activeSpatialViewport / interactiveCanvasRect
```

Important physical rules:

### Work View open/resize

```text
NO automatic Camera mutation
```

The world/camera does not move merely because a panel opens or width changes.

### HUD / navigation

They DO reposition around the current activeSpatialViewport.

“Top center” means:

> center of the current usable spatial viewport, not browser physical center.

Map Locator / edge navigation uses the active spatial edge, not the hidden browser edge behind Work View.

### Explicit Focus

When the user explicitly invokes Focus/read/edit framing:

```text
fitSpatialTarget(...)
→ respects activeSpatialViewport / occupied Work View
```

So Focus never intentionally places the target underneath the Dock.

### Pointer / edge gesture

The Work View owns pointers inside its rectangle.
Canvas edge-scroll / edge cursor / drag navigation only wakes on the active spatial edge, not through the Work View.

---

# 6. Prefer extension of existing geometry owners

Do not create another disconnected safe-area system.

Existing useful anchors:
- `spatialOverlayEnvironment.ts`
- `SpatialOverlayPlacement`
- `fitSpatialBounds`
- `CanvasMiniMap.safeInsets`
- `edgeScrollDelta`
- existing screen-space navigation/marker infrastructure.

The next foundation should converge them on one shared viewport-environment contract rather than maintaining:
- hard-coded `safeInsets` in `App.tsx`;
- separate DOM occupied-rect collection;
- separate Minimap center math;
- future Work View geometry;
- future Centered Spatial Index center math.

---

# 7. Context / Workflow / Assembly / Skill instruments = direct manipulation

Large work projections should behave like real dashboards/instruments:

> the content/data itself is directly manipulable.

Do NOT introduce a permanent “edit mode” toolbar or rows of fixed small buttons before users can modify data.

Default operations should be direct where semantically safe:
- select actual item;
- drag actual branch/item;
- reorder actual structure;
- edit label/value in place;
- drag relationships/placements where the instrument owns them;
- use small contextual popover/menu only when needed;
- use Action Arc for object-local direct capabilities;
- use Right-click/More for management.

Component functional face owns its business controls, but these controls must be content-native and low-chrome.

---

# 8. Context core instruments

Context remains a free understanding Surface, but its primary instruments may be promoted into Unified Work View for sustained work.

The GUI must not degrade into:

```text
white card
+ fixed toolbar
+ “Edit” mode
+ secondary form
```

Structure / Evolution / Relationship / Source should expose direct manipulation of their actual semantic content.

Their spatial morphology remains visible in the Canvas; Docked/Immersive is a larger projection of the same instrument/canonical truth.

---

# 9. Workflow core philosophy

Workflow remains:

```text
free spatial action worksite
```

It is NOT:
- FaaS UI;
- Zapier/n8n clone;
- automation DAG form builder;
- “add step → fill parameter → connect provider” product.

The user expresses goal/context/action in LCOS; the existing Runtime/Harness executes.

---

# 10. Skill ≠ Harness Run

These must be explicit separate product concepts.

## Skill

```text
Skill Artifact
+ Skill Builder projection
```

Long-lived, reusable, versioned capability/method package.

## Harness Run

A dedicated execution path/instrument that:

```text
entry / intent
→ existing Runtime/Harness
→ execution
→ structured result returns
→ result is editable/reviewable
→ Keep / Merge / Apply according to canonical proposal/result truth
```

Do NOT turn Harness Run into a low-code flow editor.
Do NOT merge Harness Run GUI into Skill Builder.
Do NOT expose CDP/MCP/provider plumbing as the ordinary workflow.

Completed Run / RunRecipe may later propose a reusable Skill, but that is a separate Teach/Update path.

---

# 11. Assembly + Unified Work View

For object-targeted Assembly:

```text
Object Action Arc
→ Assembly
→ Docked Source Bay by default
```

The current live SpatialCanvas is the Target Scene.
Do not duplicate the target scene into another left pane simply to recreate a split-screen diagram.

Docked Assembly can expand to Immersive using the same responsive GUI.

At larger width it may reveal richer warehouse/category/admission information, but target truth remains unchanged.

---

# 12. Superseded requirement mapping

| Older clause | Latest status |
|---|---|
| Orbit 3–5 visible direct actions | **SUPERSEDED** by A22 `3 normal / 4 max` |
| Right-click can own Assembly direct entry | **SUPERSEDED**; direct target Assembly is Action Arc |
| fixed Canvas / bottom `+` / Rail Assembly primary entry | **SUPERSEDED for object-target flow** |
| Preview = fixed right drawer | **SUPERSEDED** by Unified Work View lifecycle |
| Component “maximize” = independent fullscreen portal | **SUPERSEDED as default**; same Work View projection |
| panel opens → camera automatically shifts to make room | **SUPERSEDED** for Unified Work View |
| persistent panel geometry may define browser physical center | **SUPERSEDED**; HUD uses activeSpatialViewport center |
| permanent instrument edit buttons required before modifying data | **SUPERSEDED**; direct manipulation first |
| Skill and Run/Harness can collapse into one workflow builder | **FORBIDDEN**; keep separate |

---

# 13. Phase ownership

## Phase A
- Voice / ASR proposition;
- Centered Spatial Index semantic/navigation owner;
- establish shared active spatial viewport geometry contract needed by navigation;
- Human Product Smoke / Phase A closeout.

Do NOT migrate Preview/Component shells in A.

## Phase B0
- mature primitive/donor registry gate;
- Unified Work View Host;
- Docked↔Immersive state;
- resizable viewport Work Layer;
- Work View publishes occupied region to shared spatial viewport environment.

## Phase B
- Text/File/Link/HTML/Web Artifact Host consumers;
- retire fixed Preview drawer shell;
- same projection Docked↔Immersive.

## Phase C
- Context/Workflow direct-manipulation instruments;
- Skill Builder;
- Harness Run/Result projection (separate from Skill);
- Assembly Action Arc entry;
- Docked/Immersive Assembly Source Bay;
- retire duplicate component immersive/workbench/target-manager owners.

## Phase D
Visual/motion polish only:
- dynamic HUD placement around Work View;
- sash/resize feedback;
- Docked↔Immersive transition;
- material/density/DPI/reduced-motion.

D must not redefine the above semantics.

---

# 14. Permanent acceptance additions

Every relevant patch must additionally answer:

```text
Does this add permanent node chrome? Why?
Does it preserve direct manipulation?
Does it respect activeSpatialViewport?
Does Work View open/resize move Camera? (must be NO)
Does Surface switching preserve the docked view?
Are Action Arc / Right-click / Composer / functional face responsibilities distinct?
Does old fixed panel/portal owner retire when the new owner lands?
For Workflow: did this accidentally become a low-code/FaaS builder?
For Skill/Run: are Skill and Harness Run still separate?
```

---

# 15. One-line freeze

> **LCOS keeps the world spatial, but lets important work be promoted into one persistent viewport Work View. The Work View may occupy the usable canvas edge, so navigation/HUD dynamically reflow around the remaining active spatial region while the camera itself stays untouched. Inside the Work View, users manipulate real content directly; Skill remains Skill, Harness Run remains execution, and Assembly is entered directly from the target's Action Arc.**
