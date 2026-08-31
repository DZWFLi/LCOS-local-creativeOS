# LCOS v0.15 · A10 Selection Group Action Ownership + Selection Strip Retirement Closeout

日期：2026-08-31
性质：Phase A · Shared Spatial Kernel / Production Owner Cleanup
命题：**多选是 Selection Field 的 transient spatial session，不是单对象 Project Object；残余 Selection Strip 必须在不丢 group capability 的前提下完全退役，并由一个局部、screen-space、低侵入的 group action owner 承接。**

---

## Baseline

- Repo: `/mnt/data/lcos_full_src`
- Branch: `gpt/v015-a06-execution-fail-close`（branch 名为历史命名；真实施工以 HEAD 为准）
- Patch base: `26166740b0f982c0caabd6facc5b406ca156e9df` (`fix(gui): extend object orbit across spatial surfaces`)
- Dirty before A10: none
- Current phase: Phase A · Shared Spatial Kernel / Production Owner Cleanup
- Previous accepted micro-patch: A09 Universal ObjectOrbit Coverage

---

# Product Proposition

```text
Select 2+ objects
→ one shared Selection Field remains the interaction body
→ one compact screen-space group-action notch appears on that field
→ click notch opens local group menu
→ group operations act on the current Selection
→ no Project Entity / Node / fake ObjectOrbit is created
```

A10 **does not** turn multi-selection into a fake object and does not route it through single-object `ObjectOrbit`.

---

# Source-Diff Gate

## Original User / Freeze

### 2026-08-21 Spatial Surface master

Frozen requirements relevant to this patch:

- Main / Context / Workflow use one Shared Spatial Surface Engine.
- Selection / marquee / spatial interaction are shared primitives.
- Presentation operations do not create a second Project truth.
- every construction package must independently complete Done / Acceptance before the next package.

### Malleable Spatial Surface research

Relevant material/physics rule:

- spatial behaviors belong to the material / interaction primitive that actually owns them;
- same data can have different surface projections without cloning Project Truth;
- multi-selection is a surface interaction state, not a new Entity species.

## Latest Explicit Override / Reality Feedback

Current v0.15 interaction grammar:

```text
Click             = Selection
Shift + Click     = additive Selection
Ctrl/Cmd + Click  = explicit Reference
ObjectOrbit        = one object's local high-frequency hand
Right-click        = universal low-frequency management
```

Further frozen rules:

- Multi-selection is a shared spatial primitive.
- Selection Field is visual interaction state, not a Node.
- `ObjectOrbit` must not become a hammer for every non-object interaction.
- controls are satellites / contextual layers, not another white-card toolbar.
- one dominant transient UI at a time.
- outside click / Esc close the current top lightweight layer.

## Latest Reality / Current Source before A10

A09 correctly retired **single-object** Selection Strip ownership and established Universal ObjectOrbit for ordinary objects.

Residual production owner still existed for:

```text
selectedIds.length > 1
→ Selection Strip
```

That strip still carried real group capabilities, so deleting it first would create a capability vacuum.

### Important A09 closeout correction

A09 closeout listed `Focus / 在哪` among the capabilities supposedly still carried by the multi strip.

Current source census proved that statement was **not implementation truth**:

```ts
onFocusSelection:
  selectedIds.length === 1
    ? () => openProjectFocus()
    : undefined
```

Therefore the actual pre-A10 multi strip did **not** expose Project Focus.

This is recorded as a historical closeout imprecision, not silently rewritten.

The existing `openProjectFocus(sourceIds = selectedIds)` already accepts a set of IDs, and `ProjectFocusNavigator` already renders exact / partial multi-selection coverage (`全部命中`, `2/3 命中`, etc.). A10 therefore restores the already-existing multi Focus capability instead of inventing a new locator model.

## Current Construction Clause

A10 from the authoritative Context Index:

```text
Audit Align / Distribute / Colony / Focus / Arrange / Copy / Duplicate / Remove
→ move them to the correct group-selection contextual owner
→ delete the remaining Selection Strip
→ do not route multi-selection through single-object Orbit
```

## Current Production Owner

Before A10:

- `ProjectCanvas.tsx` residual `selection-toolbar lcos-selection-strip`
- legacy `details.lcos-selection-more`
- multiple stale CSS compatibility owners across `surface.css`, `product-interface.css`, `interaction-system.css`, `reconstruction.css`, `vnext.css`

## Classification

```text
WRONG_OWNER
+
IMPLEMENTATION_GAP
```

No new product taxonomy is introduced.

---

# Authoritative Path after A10

## Multi-selection group owner

```text
2+ selected objects
→ existing Selection Field bounds
→ SelectionGroupActions trigger (screen-space)
→ local registered menu
→ current Selection operations
```

`SelectionGroupActions` is deliberately **not** `ObjectOrbit`.

It is a transient interaction projection over the current Selection only.

## Carried-forward / restored capabilities

Actual group actions now available through the new owner:

```text
Focus / 在哪          (restored; underlying multi Focus already canonical)
整理这些              (Reorganize when available; Arrange fallback)
圈成 Colony
Left / Center / Right align
Top / Middle / Bottom align
Horizontal / Vertical distribute (3+)
Text group direct-reading / compact toggle when applicable
Create Collection     (Main project surface)
Copy                  (Main project surface)
Duplicate View        (Main project surface)
Remove View           (Main project surface)
```

No capability is represented as disabled fake UI. Actions remain callback/capability-driven.

## Screen-space ownership

The group trigger is 36×36 CSS px and lives in the overlay layer projected from Selection Field world bounds.

Canvas zoom changes its anchor location, not its interaction target size.

This preserves:

```text
Visual Bounds
!=
Interaction Bounds
```

and avoids reviving a zoom-scaled toolbar island.

---

# Selection Strip Retirement

A10 removes the final production DOM owner:

```text
selection-toolbar
lcos-selection-strip
lcos-selection-more
```

and removes their stale CSS owners from current Web sources.

Static census after A10:

```text
rg "selection-toolbar|lcos-selection-strip|lcos-selection-more" apps/web/src
→ 0 production matches
```

This is real retirement, not another visual restyle of the old strip.

---

# Overlay / Motion Conformance

The local group menu uses the repository's mature Base UI menu primitive rather than introducing a second handwritten popup state machine:

```text
Menu.Root
→ Menu.Trigger
→ Menu.Portal
→ Menu.Positioner
→ Menu.Popup
→ Menu.Item
```

Base UI owns the menu interaction mechanics already used elsewhere in LCOS:

- portal rendering;
- trigger / popup focus behavior and keyboard navigation;
- outside-press / Escape menu lifecycle;
- anchor-side positioning / collision handling;
- item activation close behavior.

LCOS still registers the open popup with `overlayStack` as `kind: 'menu'` so the product-wide transient-layer owner can dismiss it through the same global contract. `onEsc` delegates to `MenuRootActions.close()` rather than bypassing the menu primitive.

Any Selection membership change starts a new transient session via `selectionKey`; even a same-count A+B → C+D change closes the previous group's menu.

The popup consumes the frozen TodoPanel-derived LCOS motion tokens through Base UI's transition states rather than maintaining a handwritten `opening / closing` timer:

```text
Base UI data-starting-style / data-ending-style

opacity:   var(--lcos-dur-swap-opacity)   = 180ms
transform: var(--lcos-dur-swap-transform) = 260ms
ease:      var(--lcos-ease-swap-in)
scale:     var(--lcos-swap-scale) = .985 → 1
travel:    10px for this small HUD menu
```

The `data-ending-style` exit state keeps the visual exit in the menu primitive's transition lifecycle instead of A10 immediately deleting a custom portal node. `prefers-reduced-motion` removes the transitions.

---

# Files Changed

## Production

- `apps/web/src/App.tsx`
- `apps/web/src/features/canvas/ProjectCanvas.tsx`
- `apps/web/src/features/ui/SelectionGroupActions.tsx` (new)
- `apps/web/src/features/shell/CanvasSceneHost.tsx` (stale owner comments corrected)
- `apps/web/src/interaction-system.css`
- `apps/web/src/product-interface.css`
- `apps/web/src/reconstruction.css`
- `apps/web/src/spatial-components.css`
- `apps/web/src/surface.css`
- `apps/web/src/vnext.css`

## Regression / gates

- `scripts/validate-v015-a09-universal-object-orbit.mjs` (A09 gate no longer requires A10's now-retired temporary debt)
- `scripts/validate-v015-a10-selection-group-owner.mjs` (new)
- `tests/e2e/orbit-lifecycle.spec.ts`

## Context / owner docs

- this closeout
- `GUI_RESPONSIBILITY_MATRIX_20260831.md`
- `GUI_PRODUCTION_OWNER_AUDIT_20260830.md`
- `CONSTRUCTION_CONTEXT_INDEX_20260831.md`
- `FRONTEND_CONVERGENCE_PLAN_20260831.md`

---

# Acceptance

- [x] Multi-selection does not use single-object ObjectOrbit.
- [x] Residual horizontal Selection Strip DOM owner is deleted.
- [x] `lcos-selection-more` details owner is deleted.
- [x] Legacy Selection Strip CSS ownership is deleted from active Web source stylesheets.
- [x] Current Selection has one compact screen-space group action trigger.
- [x] Group trigger minimum visual target is 36×36 CSS px.
- [x] Arrange/Reorganize is preserved.
- [x] Colony action is preserved.
- [x] Align / Distribute are preserved.
- [x] Text group direct-reading toggle is preserved when applicable.
- [x] Collection / Copy / Duplicate View / Remove View are preserved on Main project surface.
- [x] Multi Project Focus is restored using the existing multi-source Focus owner.
- [x] Menu uses the repository's Base UI Menu primitive instead of a new handwritten popup lifecycle.
- [x] Open menu registers with overlayStack and delegates global Esc to `MenuRootActions.close()`.
- [x] Base UI owns keyboard / focus / outside / item-close / portal / positioning mechanics.
- [x] Same-count Selection membership changes also close the old menu session.
- [x] Menu uses frozen 180/260 local swap grammar through Base UI starting/ending transition states.
- [x] Reduced motion is respected.
- [x] A09 static gate is updated so historical temporary debt is not reintroduced by a regression gate.
- [x] Browser regression is authored for group-owner appearance and menu actions.
- [ ] Browser E2E actually run: `BLOCKED_ENV` in this extracted repo until dependencies are available.
- [ ] Manual Product Smoke: `BLOCKED_ENV` in this extracted repo.

---

# Main / Context / Workflow Parity

## Main

```text
PASS for this patch proposition
```

The old Selection Strip only existed in `ProjectCanvas`; all its actual multi group actions now have a replacement owner.

## Context

```text
N/A for Selection Strip retirement
```

Context did not consume the legacy Main Selection Strip. A10 does **not** claim that all Context-specific multi group operations are now designed or exposed.

Its shared multi-selection / Orbit parity remains governed by the Phase A three-Surface rule.

## Workflow

```text
N/A for Selection Strip retirement
```

Workflow likewise did not consume the retired Main strip. A10 does **not** claim cross-surface right-click / Relation / group-operation parity.

This distinction is intentional: no semantic completion by renaming a Main-only owner patch as “three-Surface group actions done”.

---

# Explicitly Not Done

A10 does **not** complete:

- universal object right-click menu;
- multi-selection right-click entry into the group owner;
- Relation initiation (`Select → Orbit → Relation → port/receptive halo`);
- Assembly Orbit entry;
- single-object `More` migration, including the currently stranded explicit Rename / note-layout management actions;
- DialogsHost top-owner / mutual exclusion;
- global SpatialOverlayPlacement abstraction;
- Context / Workflow domain-specific group operation catalogs;
- Phase B species morphology / generic frame cleanup.

These remain separate propositions.

---

# Manual Product Smoke Required Later

Dependency-enabled runtime must verify:

1. Main select one ordinary object → ObjectOrbit appears; no group trigger.
2. Shift-add second object → single Orbit closes; Selection Field remains; one 36px group trigger appears.
3. Click group trigger → local menu opens adjacent to the Selection Field, without moving/reflowing selected objects.
4. Outside click → only the group menu closes; Selection remains.
5. Esc → only the group menu closes first.
6. Trigger again → menu reopens; no stale previous menu remains.
7. `在哪` with 2+ objects → Project Focus opens with the full Focus Set and exact/partial location coverage.
8. `整理这些` uses current Reorganize/Arrange owner, not a new local algorithm.
9. Align / distribute mutate Presentation positions only and persist through the existing commit path.
10. `圈成 Colony` uses existing Colony truth.
11. Copy / Duplicate View / Remove View keep their existing semantics; Remove View must not delete Project Entity truth.
12. Multi text selection exposes direct-read / compact toggle only when applicable.
13. At 25/35/60/100/150% canvas zoom, group trigger stays readable/clickable at screen-space size.
14. Main / Context / Workflow ordinary single-object Orbit behavior from A09 remains unchanged.

---

# Donor Conformance

Relevant donors:

- TapNow
- Lovart
- Trae
- OpenCodeUI TodoPanel code donor

Borrowed behavior:

```text
Selection Field remains the body
controls are local satellites
progressive disclosure
one dominant transient UI
small blast radius
same-origin popup
180/260 local swap
```

LCOS truth preserved:

- Selection remains transient interaction state.
- No selection-group Entity / Node is created.
- No donor taxonomy is imported.
- Group operations continue using existing LCOS owners.

Explicitly not copied:

- donor panel taxonomy;
- donor task model;
- donor visual skin;
- donor persistence model.

---

# Tests Actually Run

## A10 owner gate

```text
node scripts/validate-v015-a10-selection-group-owner.mjs
→ 8/8 PASS
```

## Updated A09 gate

```text
node scripts/validate-v015-a09-universal-object-orbit.mjs
→ 10/10 PASS
```

A09 no longer requires the temporary multi strip debt that A10 is explicitly responsible for retiring.

## Existing Phase A regression gates

```text
A03 Orbit Anchor Stability               3/3 PASS
A04 Selection Composer Ownership         4/4 PASS
A05 Selection Reference Separation       8/8 PASS
A06 ExecutionItem Fail-Close             8/8 PASS
A07 Project Navigation Ownership         5/5 PASS
A08 Canonical Text Edit                   9/9 PASS
A09 Universal ObjectOrbit                10/10 PASS
A10 Selection Group Owner                 8/8 PASS
R2-D Interaction Grammar                 20/20 PASS
R1-C Unified Command State               12/12 PASS
Spatial Navigation F6A2                  14/14 PASS
R2-C Spatial Navigation Family           16/16 PASS
git diff --check                              PASS
```

One initial validation command used the obsolete/nonexistent path:

```text
scripts/validate-spatial-navigation.mjs
→ MODULE_NOT_FOUND
```

This was a command-name error, not a product-test failure. The actual repository gates were then discovered and run:

```text
scripts/validate-v015-spatial-navigation-f6a2.mjs → 14/14 PASS
scripts/validate-v015-r2c-spatial-navigation-family.mjs → 16/16 PASS
```

The failed invocation remains documented rather than disappearing from history.

## TypeScript syntax-only parse

Using the globally available TypeScript compiler API with `transpileModule` (no module resolution):

```text
App.tsx                         PASS syntax
ProjectCanvas.tsx               PASS syntax
SelectionGroupActions.tsx       PASS syntax
CanvasSceneHost.tsx             PASS syntax
```

This is **syntax evidence only**, not Web typecheck.

## CSS parse

`tinycss2` parse of all touched active CSS files:

```text
surface.css              0 parse errors
product-interface.css    0 parse errors
vnext.css                0 parse errors
reconstruction.css       0 parse errors
interaction-system.css   0 parse errors
```

## Web Typecheck

```text
npm run typecheck --workspace @local-creative-os/web
→ BLOCKED_ENV
```

Actual environment errors:

```text
TS2688 Cannot find type definition file for 'node'
TS2688 Cannot find type definition file for 'vite/client'
```

No typecheck PASS is claimed.

## Browser / Vitest binary census

```text
node_modules/.bin/playwright → MISSING
node_modules/.bin/vitest     → MISSING
```

The Playwright regression is authored but cannot be executed in this extracted dependency-less repository.

Therefore:

```text
Browser E2E          = BLOCKED_ENV
Manual Product Smoke = BLOCKED_ENV
```

---

# Index Updates

- Context Index changed? **YES** — A10 current owner truth + A11 next proposition.
- Mandatory Context changed? **NO** — no new user L0 rule was invented.
- Plan Diff Index changed? **NO** — no new Plan Fidelity Gap was discovered.
- Video/Code Donor Index changed? **NO** — donor set unchanged; existing TodoPanel token consumed.
- Responsibility Matrix changed? **YES** — Selection Strip owner count → 0; actual production census remains 9 literal `createPortal(...)` files / 4 `registerOverlay(...)` files because A10 uses Base UI `Menu.Portal`, not a new handwritten `createPortal(...)` owner.
- Production Owner Audit changed? **YES** — A10 final retirement + A09 Focus implementation correction.
- Frontend Convergence Plan changed? **YES** — Selection Strip marked DONE A10.
- FullE2E Index changed? **NO** — targeted regression only; final source set unchanged.

---

# Next Admissible Proposition

After A10 review, the next Phase A proposition is:

> **A11 · Universal Object / Selection Right-click Ownership**

Reason:

- latest three-Surface hard rule explicitly requires Right-click on Main / Context / Workflow;
- current source still has blank-surface context menu ownership while object node contextmenu paths largely suppress the native menu without a universal object manager;
- the new A10 group owner can become the selected-group low-frequency action projection, but A11 must wire the actual pointer entry and shared capability menu deliberately.

A11 must not be started inside A10.

---

# Verdict

```text
Implementation / Static Acceptance = PASS
Browser / Manual Product Smoke      = BLOCKED_ENV
Overall Session Verdict             = BLOCKED_ENV
```

The implementation proposition is statically accepted, but A10 is **not** represented as runtime-complete until dependency-enabled Browser / Manual smoke is run.

## STOP

A10 stops after its own Acceptance / docs / patch artifacts are complete.
