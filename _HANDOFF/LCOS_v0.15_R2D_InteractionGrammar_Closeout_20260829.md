# LCOS v0.15 · R2-D Interaction Grammar / Relation + Glyth Mapping + Pointer State · Closeout
## 2026-08-29

## 0. Baseline / micro-patch boundary

- formal upstream: `R2-C · Spatial Navigation Family`
- supplied product baseline: `7f0690d + R1-B + R1-C + R1-D + R2-A + R2-B + R2-C`
- this delivery is **R2-D incremental only**
- authoritative UX freeze: `LCOS_v0.15_UX冻结_Assembly同步空间与PointerCursor交互语言_20260829.md`

R2-D closes the shared interaction grammar. It does **not** start R3-A Catalog Migration and does not pull the final GUI Visual Constitution pass forward.

---

## 1. Product question closed

R2-D closes one product-level question:

> Can Main / Context / Workflow use one physical interaction language while Selection, one-run Reference, explicit Relation, and durable Conversation mapping remain four different semantics?

After this patch:

```text
Click                 = Selection
Shift + Click         = Multi-selection
Ctrl/Cmd + Click      = this-run Reference
Drag object body      = Move / Semantic Drop
Drag boundary notch   = explicit Relation
Middle Mouse Drag     = Camera Pan
Space + Left Drag     = Camera Pan fallback
Wheel / Pinch         = Zoom / Semantic LOD
```

And the identity boundary remains:

```text
Selection ≠ Reference Pick ≠ Relation ≠ durable Glyth mapping
```

---

## 2. What changed

### 2.1 Shift is now the only additive Selection modifier

The old desktop inheritance:

```text
Shift / Ctrl / Cmd = additive Selection
```

is retired from the spatial Surface renderers touched by the shared physics layer.

Main, Context, Workflow, SurfaceObject, SurfaceFrame and Collection-member selection now use one helper:

```ts
additiveSelectionModifier(event)
```

which returns only `event.shiftKey`.

`Ctrl/Cmd` is no longer silently consumed as multi-select while the product language says “Reference”.

`CaptureMaterialFlow` is intentionally not migrated in R2-D because it belongs to the still-pending R3-D Source Bay / Assembly final morphology rather than the three final spatial Surfaces.

### 2.2 Physical Ctrl/Cmd Reference Pick no longer requires opening Composer

R1-C already established one Project-level Reference Set / Shared Composer command truth.

R2-D makes the frozen muscle memory real:

```text
Ctrl/Cmd held
→ Reference Pick intent
→ local receptive feedback
→ click object
→ shared Reference Set toggle
```

Main now keeps the R1-C `referencePick` bridge available whenever desktop spatial interaction is active, not only while the Composer UI happens to be open.

Context / Workflow reuse `SharedComposerCommandState` through `CanvasSceneHost`; they do not create Surface-local reference arrays.

### 2.3 Glyth is a Receiver, not a normal reference chip

For Conversation Glyths:

```text
Ctrl/Cmd + Click Glyth
→ choose / switch Receiver
```

It does not call the ordinary Reference toggle.

Main routes this through the existing active Conversation seam; Context / Workflow route it through `SharedComposerCommandState.onReceiverChange` when the Glyth resolves to a connected Conversation.

No new Receiver truth is created.

### 2.4 Relation starts from one boundary Light Notch

The Main Canvas legacy permanent pair:

```text
anchor-in
anchor-out
```

is retired from node relation creation.

A node now exposes one contextual boundary affordance:

```text
Light Notch
→ drag
→ explicit Relation
```

Workspace relation creation receives the same single-notch source language.

The target object becomes locally receptive during the relation drag. The whole node is not turned into a permanent connector UI.

Workflow Action Path ports are intentionally not rewritten here: they are a separate Workflow execution/path semantic owner, not ordinary semantic Relation.

### 2.5 Canvas body → Glyth now means durable Conversation Context Mapping

A Conversation Glyth exposes a semantic body-drop target:

```text
Canvas object body
→ drag onto Glyth
→ “给这段对话”
```

R2-D does **not** invent a frontend mapping store or new route.

The host resolves safe Project identities and calls the existing canonical Assembly seam:

```text
LocalCoreClient.applyAssembly(
  projectId,
  {
    sourceRefs,
    targetRef: { kind: 'conversation', id: connectedConversationId }
  }
)
```

The existing Core Assembly path remains the owner of the durable Conversation context relation.

Unlinked Conversation identity fails closed. Unknown source identities are reported and never guessed.

### 2.6 Body drag and Semantic Drop share one destination dispatcher

Both existing direct body-drag and explicit Semantic Drop converge through one dispatcher:

```text
commitProjectViewTarget(targetId, ids)
```

- ordinary Project/Rail/Surface target → existing `onDirectProjectViewDrop`
- Glyth semantic target → `onMapToConversation`

No generic “what do you want to do?” modal is introduced.

### 2.7 Middle Mouse Pan remains pure Camera interaction

The shared `SpatialCanvas` middle-button branch still returns before object selection / move / drop / relation logic.

Pointer presentation exposes:

```text
pan-open-hand
pan-closed-hand
```

and keeps:

```text
Space + Left Drag
```

as the trackpad / no-middle-button fallback.

### 2.8 Pointer intent is Presentation-only

A dependency-free pointer grammar module now names the intended states:

```text
normal
selection
reference-pick
relation-drag
semantic-drop
pan-open-hand
pan-closed-hand
resize
zoom-navigation
```

R2-D uses transient modifier / interaction state only.

It does not persist pointer mode in Core, localStorage, sessionStorage, CommandDraft, Marker Intent, or Presentation Truth.

The final bespoke cursor artwork, motion polish and complete state-by-state visual constitution remain the later GUI Visual Pass.

---

## 3. Explicit truth boundaries preserved

### Reference Pick does not mutate Project Truth

`Ctrl/Cmd + Click` does not create:

- Relation;
- durable Conversation Context Mapping;
- Collection membership;
- Workspace membership;
- Marker Intent.

It only changes the R1-C shared one-run Reference Set.

### Durable Glyth mapping is explicit body-drop semantics

Conversation Context Mapping occurs only through the explicit semantic destination:

```text
object → Glyth
```

and reuses Core-owned Assembly/Relation behavior.

### Relation is not Glyth mapping

Dragging the boundary Light Notch creates explicit Relation semantics.

Dragging the object body to a Glyth creates durable Conversation Context Mapping.

They do not share a persistence action merely because both involve a pointer drag.

### Navigation remains R2-A/B/C-owned

R2-D does not create another Marker / Beacon / Focus / Arrival store.

---

## 4. Validation

### R2-D dedicated static gate

```text
R2-D Interaction Grammar: 20/20 PASS
```

Covers:

- Shift-only additive Selection;
- Ctrl/Cmd Reference Pick;
- Reference bridge available without opening Composer;
- shared Reference Set toggle;
- persistent Main reference identity presentation;
- Glyth Receiver special case;
- one Light Notch relation source;
- local Relation target feedback;
- Glyth semantic body-drop target;
- durable mapping through `applyAssembly`;
- Core Assembly conversation target remains canonical `conversation_context` Relation truth;
- unlinked Conversation fail-close;
- Reference path cannot call durable mapping / Relation;
- middle-button pure Camera Pan;
- Space+left fallback;
- transient pointer state language;
- one semantic destination dispatcher;
- Context/Workflow reuse `SharedComposerCommandState`;
- shared Shift-only Selection physics across Surface renderers;
- Context/Workflow local receptive Reference feedback without local Reference truth.

### R2-C regression gate available in this builder

```text
R2-C Spatial Navigation Family: 16/16 PASS
```

### User language gate

```text
PASS · 233 product-surface source files
```

### Modified/new TS/TSX syntax transpile

```text
13/13 PASS
```

### Pure pointer helper execution

```text
5/5 PASS
```

Covers Shift additive, Ctrl Reference, Shift precedence and Glyth drop-target round-trip.

### Package / diff integrity

```text
package.json parse                 PASS
CRLF-aware git diff check          PASS
```

### Validation boundary

This builder is the R2-C reconstructed construction workspace. For R2-D it additionally realigned the exact R1-C `CanvasSceneHost → SharedComposerCommandState` seam from the authoritative R1-C patch before generating the R2-D incremental diff, so the final R2-D patch does not regress to the stale pre-R1-C host.

The following older regression scripts are not physically present in this reconstructed workspace and are therefore **not re-claimed as rerun here**:

```text
F4 Selection/Relation
R2-A Spatial Marker
R2-A Spatial Navigation
Assembly Source Bay
```

Their prior closeouts remain the evidence for those completed slices. The known Assembly Source Bay historical `9/10` debt is not changed or disguised by R2-D.

The workspace still has no monorepo `node_modules`; full dependency-backed:

```text
lint / package typecheck / vitest / build
```

is **not claimed** here.

---

## 5. R2-D status

**Code-complete + R2-D static/interaction-Golden complete.**

The old contradictory state:

```text
product spec: Ctrl/Cmd = Reference
actual surfaces: Ctrl/Cmd = additive Selection
Main: permanent relation ports
Canvas → Glyth: no canonical durable mapping gesture
```

is closed at the shared interaction-grammar layer.

---

## 6. Next formal construction point

**R3-A · Catalog Migration / final object species**

Carry-forward that must not disappear:

```text
Fence / Region → Colony / Field
old Catalog species retirement
Colony = spatial scope primitive
Component = how that scope is viewed / arranged / worked
no Collection → Colony truth shortcut
no universal white-card shell resurrection
```

Then:

```text
R3-B Universal Components
→ Arrange / Gallery / Stack

R3-C Surface Components + Context Version convergence

R3-D Assembly / Arrange / Skill seams
→ Dedicated Assembly Workspace
→ Docked Source Bay
→ Quick Tray
→ real Surface Arrange Skill
→ applyAssembly consumer completion
→ Link Title / Card / Live
```

Final bespoke Cursor/Pointer artwork and full motion polish remain part of the R3 GUI Visual Constitution pass, using the interaction state language frozen by R2-D rather than inventing a new one.
