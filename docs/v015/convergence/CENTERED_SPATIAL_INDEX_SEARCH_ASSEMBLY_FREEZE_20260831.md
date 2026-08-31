# LCOS v0.15 · Centered Spatial Index / Pin / Focus / Search / Assembly GUI Freeze

Date: 2026-08-31
Status: PRODUCT FREEZE / implementation staging differs by Phase

---

## 0. Core verdict

LCOS establishes a shared **Centered Spatial Index** presentation family.

It is a reusable spatial-navigation GUI primitive, not a shared canonical truth.

```text
Centered Spatial Index
├─ Color Pin Index
├─ Focus Location Index
├─ Search Result Index
└─ Assembly Category Index
```

All four may share:
- top-center anchoring,
- quantity-driven center-symmetric layout,
- lightweight marker/constellation motion,
- hover labels / counts,
- selection-to-highlight,
- navigation / Fly-to handoff,
- viewport-safe placement,
- Map Locator integration.

They MUST NOT share canonical state.

```text
Color Pin truth ≠ Focus state ≠ Search state ≠ Assembly taxonomy
```

---

# 1. Top Spatial Index Slot

Normal LCOS surfaces expose one **Top Spatial Index Slot** centered on the visual canvas.

Only one dominant index owner may occupy the primary slot at a time.

Suggested ownership:

```text
default / idle
→ Color Pin Index, only if real Color Pins exist

Focus active
→ Focus Location Index owns the slot
→ Color Pin state remains intact but visually yields

Search active
→ Search Result Index owns the slot
→ Color Pin / Focus presentation yields

Search result → “在哪”
→ Search hands off to Focus
→ Focus becomes the active slot owner

Assembly Workspace
→ Assembly Category Index owns the slot
```

Do not stack multiple full index constellations vertically.

The user should never see:
- a Color Pin toolbar,
- a Focus list,
- a Search result sidebar,
- and an Assembly category strip
all competing for attention.

---

# 2. Quantity-driven centered layout

The index is NOT a rigid left-to-right toolbar.

The visual cluster must remain centered around the canvas visual X-axis.

```text
1 item

        ●


2 items

      ●   ●


3 items

        ●
     ●     ●


4 items

     ●     ●
       ● ●
```

Exact shape may vary by count.

Rules:
1. overall visual center remains on the canvas center axis;
2. adding/removing an item causes the remaining markers to rebalance around center;
3. layout may use a very shallow arc / constellation rather than a flat row;
4. it must not become a second Orbit;
5. visual geometry is quantity-driven and deterministic;
6. no empty placeholder is shown when a category/index has no content.

Animation:
- markers slide/rebalance into the new symmetric configuration;
- no hard left-origin growth;
- no SaaS-style tab bar behavior.

---

# 3. Color Pin Index

## 3.1 Canonical meaning

Color Pin is a **user-authored spatial index relationship**.

It is many-to-many.

```text
Object A → [blue, green]
Object B → [blue]
Object C → [purple, blue]

Blue → A, B, C
Green → A
Purple → C
```

Do NOT model this as:

```text
node.pinColor = blue
```

One object may own multiple Color Pins.

## 3.2 Node-local presentation

A pinned content node shows its Color Pin dots persistently above the node.

```text
       ● ●
┌─────────────┐
│   Artifact  │
└─────────────┘
```

The local Color Pin cluster:
- is persistent while corresponding pin relationships exist;
- is positioned above the node, not at the right-top Action Arc anchor;
- does not replace Selection feedback;
- does not become a map-locator shape.

## 3.3 Canvas-global presentation

The canvas top-center only shows colors that actually exist in the project/surface context.

No real Pin of a color:

```text
nothing is shown
```

One existing color:

```text
        ●
```

Multiple:

```text
      ●   ●
```

or a shallow symmetric constellation.

No system-provided empty set of permanent colors.

## 3.4 Interaction

Click color:

```text
Blue Pin
↓
all objects carrying Blue
→ Blue outline/highlight
```

If one member:
- direct Focus/Fly-to may be available.

If multiple:
- open a compact Color Pin Members popover;
- show object glyph + title;
- selecting a member invokes spatial navigation / Focus/Fly-to.

The popover is not an Inspector and must not become a large side list.

Optional naming:

```text
Blue → “竞品”
Green → “已确认”
Purple → “灵感”
```

Canvas still primarily displays the color marker.
Name/count appear on hover or expanded member view.

---

# 4. Focus / “在哪”

## 4.1 Canonical meaning

Focus answers:

> “I already know this object. Where does it occur?”

It is NOT Search.
It is NOT Color Pin.
It does not create persistent project truth.

## 4.2 GUI freeze

Retire the current large Focus result list as the primary presentation.

Focus uses the same Centered Spatial Index family.

```text
Focus object X
↓
top-center temporary occurrence markers
↓
each marker = one real occurrence/location
```

Current visible occurrence:
- directly highlight its spatial body / projection.

Offscreen occurrence:
- use a Map Locator at the viewport edge.

Click occurrence marker:
- Focus/Fly-to that occurrence.

Hover:
- show Surface / scope / workspace context.

Example:

```text
◉ Main
◉ Context A
◉ Workflow B
```

Text does not need to be permanently visible.

Many occurrences:

```text
◉ ◉ ◉ +4
```

`+N` may expand into a second compact constellation/fan.
Do not fall back to a large permanent list unless there is a genuine accessibility fallback mode.

## 4.3 Search handoff

A Search result may be passed to Focus:

```text
Search finds Artifact X
↓
user asks “在哪”
↓
Search presentation yields
↓
Focus Location Index shows all occurrences of X
```

---

# 5. Map Locator Navigation

Map Locator is a separate spatial-navigation morphology.

```text
Color Pin = index/category relationship
Focus marker = occurrence chooser
Map Locator = direction / landmark / Fly-to
```

Map Locator:
- uses the recognizable map-marker silhouette;
- is visually large and obvious;
- has a pointed tip that carries direction;
- may represent a collapsed Component landmark;
- when target is offscreen, attaches to viewport safe edge;
- rotates/orients so its tip/axis points toward the target world position;
- clicking invokes Focus/Fly-to.

Map Locator is NOT:
- a generic toolbar icon,
- a tiny badge,
- the same morphology as Color Pin.

---

# 6. Search reuse

## 6.1 Product mental model remains unchanged

Search answers:

> “I do not know exactly where / what the object is.”

Focus answers:

> “I know the object; show me where it occurs.”

Do not expose:
- FTS mode,
- vector mode,
- database mode,
- semantic mode
as separate user search modes.

Underlying retrieval may fuse those systems.

## 6.2 What Search reuses

Search SHOULD reuse:
- the Top Spatial Index Slot;
- top-center anchoring;
- centered responsive layout;
- selection highlight;
- Map Locator for offscreen result navigation;
- Search → Focus handoff;
- spatial Fly-to.

Search SHOULD NOT reuse literal Color Pin dots for all results.

Reason:
Search results are unknown to the user and therefore need readable identity.

## 6.3 Search GUI proposal

Activation:

```text
Cmd/Ctrl + F
↓
compact top-center Search input
```

After query:

```text
Search input
↓
top ranked results represented as compact labeled markers
```

A result marker may include:
- species glyph,
- short title,
- optional scope hint.

Example:

```text
[▣ Moodboard]
[◈ Workflow A]
[● Skill Builder]
```

The cluster remains center-balanced, not a left-origin list.

Limit the primary constellation to a small number of top hits, e.g. 5–7.

Overflow:

```text
+12
```

may open an expanded compact result field.

Result interaction:
- hover → highlight visible occurrence if present;
- click → Focus/Fly-to/open according to object type;
- “在哪” → hand off to Focus Location Index;
- Search never silently creates Pin or Relation.

## 6.4 Search state

Search is transient reader/retrieval state.

```text
Search state
≠ canonical project truth
≠ Color Pin relationship
≠ Focus occurrence truth
```

---

# 7. Assembly reuse

Assembly remains an independent project-level **Assembly Workspace / warehouse**.

It is NOT:
- a Surface Component,
- a Main/Context/Workflow dialog,
- a Search result mode.

The same Assembly is opened from Main / Context / Workflow with the current site/object as target.

## 7.1 Assembly top GUI

Assembly may reuse the Centered Spatial Index family for its **warehouse category index**.

Top-center:

```text
Artifact   Context   Workflow   Skill   Workspace ...
```

But presentation should be spatial markers/icons/compact labels, not a SaaS tab bar.

Only categories that contain real project objects appear.

No empty permanent taxonomy chrome.

If project has only:

```text
Artifacts
Contexts
Skills
```

then only those three category markers appear and remain center-balanced.

## 7.2 Recommended Assembly taxonomy

Canonical candidate categories:

1. **Artifacts / Materials**
   - Text
   - File
   - Link
   - HTML
   - Image/media
   - Note
   - other material Artifacts

2. **Contexts**
   - saved Context scopes / Context sets

3. **Workflows**
   - saved Workflow scopes / Workflow sets

4. **Skills**
   - Skill Artifacts
   - Root Skills
   - reusable Subskills/packages

5. **Collections**
   - explicit Collection scopes / reusable sets

6. **Conversations**
   - project Conversation/Glyth objects when they are real canonical project objects

7. **Workspaces**
   - saved/project Workspaces / work sites

Categories are dynamic:
- a category does not appear if the project currently has zero members of that family;
- category count/order is driven by project content and stable product ordering;
- the user is not asked to understand underlying database entity types.

## 7.3 Why these categories

They correspond to meaningful LCOS project-object families rather than technical storage classes.

Do NOT classify the Assembly primarily as:
- JSON,
- view,
- scope,
- reference,
- database record.

Those remain implementation concepts.

## 7.4 Assembly overview behavior

Assembly overview is a spatial warehouse, not a table.

```text
Top Category Index
        ↓
spatial field of available collections/objects
        ↓
select source/category
        ↓
enter Assembly split view
```

Split view:

```text
Target Site / Target Object
        ↕
Warehouse / candidate material
```

Objects retain Species morphology.

Drag/drop into target is subject to explicit **Admission Rules**.

Do not interpret “can be dragged” as “semantically valid”.

## 7.5 Assembly category interaction

Click category:
- filter/emphasize that warehouse family;
- do not navigate to a separate SaaS subpage unless the object itself is entered.

Hover:
- category name + count.

Click selected category again:
- may return to All / neutral warehouse state.

An explicit permanent `All` marker is optional and should be avoided if neutral state is obvious.

---

# 8. Shared primitive vs shared truth

Recommended shared implementation primitive:

```text
CenteredSpatialIndex
```

Input may include:

```text
items
anchor = canvas-top-center
layout = count-driven symmetric
activeId
hoverId
overflowPolicy
onActivate
onHover
```

Variants:

```text
ColorPinIndex
FocusLocationIndex
SearchResultIndex
AssemblyCategoryIndex
```

Shared geometry / interaction plumbing is allowed.

Shared persistence is NOT.

---

# 9. Top-slot arbitration

Suggested presentation priority on Main / Context / Workflow:

```text
Search active
> Focus active
> Color Pin Index
> none
```

Search → Focus handoff:
- Search gives up the slot;
- Focus takes it.

Color Pin remains canonical/persistent in project state while visually yielding.

Assembly owns its own top slot while inside Assembly Workspace.

This prevents stacked top-center UI.

---

# 10. Phase ownership

## A / Interaction grammar closeout

Freeze and/or implement:
- Top Spatial Index Slot ownership;
- Color Pin canonical many-to-many relation;
- only-existing-colors presentation;
- centered quantity-driven layout behavior;
- Focus list retirement and spatial occurrence index;
- Map Locator responsibility / Fly-to;
- Search/Focus/Pin non-conflation.

## B

Species morphology may affect:
- result glyphs,
- node-local Pin anchoring,
- object visual bounds.

Do not change navigation semantics.

## C

Assembly implementation:
- Assembly Category Index;
- warehouse taxonomy;
- split-view source/target flow;
- Admission Rules;
- Skill/Context/Workflow/Collection/Workspace integration.

Context/Workflow may project the same navigation grammar without creating separate truths.

## D

Polish only:
- marker size,
- exact spacing,
- easing/spring,
- hover pulse,
- outline glow,
- material,
- Color Pin palette,
- Map Locator silhouette refinement,
- exact constellation geometry.

D must not redefine ownership or semantics.

---

# 11. Product language summary

```text
Color Pin
= “我事先把这一组东西标出来了”

Search
= “我不知道对象在哪/叫什么，帮我找到”

Focus / 在哪
= “我知道这个对象，告诉我它出现在哪”

Map Locator
= “目标在那个方向，带我过去”

Assembly
= “我从项目仓库里挑东西，给当前目标装配”
```

They form one spatial-navigation family, but remain five distinct user intents.

---

# 12. Freeze decision

The following is now frozen:

1. Color Pin is many-to-many.
2. Node-local Color Pins appear above the node.
3. Global Color Pin Index appears only for colors that actually exist.
4. Global index layout remains center-axis symmetric as count changes.
5. Focus primary GUI is no longer a large list; it becomes a temporary spatial occurrence index.
6. Search reuses the top-center spatial index grammar but retains text-bearing result identity.
7. Search remains separate from Focus; Search result may hand off to Focus.
8. Map Locator remains a separate large directional navigation morphology.
9. Assembly reuses the same index family for dynamic warehouse categories.
10. Assembly categories are based on user-meaningful project object families, not storage/entity implementation types.
11. One dominant Top Spatial Index Slot is visible at a time.
12. Shared presentation primitive does not imply shared canonical truth.
