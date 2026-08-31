# A04 Selection / Composer Ownership Closeout

## Product Proposition

Ordinary object Selection must never summon the execution Composer. Click owns Selection only. The Composer is an explicit work surface and may open only through an explicit Composer/Speak/keyboard action.

---

## Source-Diff Gate

### Original user / freeze

- `docs/v015/convergence/original/LCOS_0.1_INTERFACE_PRODUCTIZATION_CODEX_CONSTRUCTION_PLAN_20260816.md`
  - UI work must verify the real consumer path and manual behavior; interface existence is not product completion.
- `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_对话选择与承接全链补齐_20260821.md`
  - Main / Context / Workflow reuse the same spatial interaction foundation.

### Latest explicit reality feedback

- `docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md`
- `docs/v015/convergence/THREE_SURFACE_INTERACTION_RULE_20260831.md`
- `docs/v015/convergence/VIDEO_LOVART_COMPOSER_REFERENCE_PICK_20260831.md`

Current frozen grammar:

```text
Click
= Selection

Shift + Click
= additive Selection

Ctrl/Cmd + Click
= this-run Reference

Orbit / explicit Compose action
= Composer
```

Ordinary Click must not:

- open Composer;
- add Reference;
- open Detail.

### Relevant donor source

`VIDEO_LOVART_COMPOSER_REFERENCE_PICK_20260831.md`

Borrowed behavior only:

```text
Selection
→ local object state

explicit work intent
→ Composer
```

No Lovart product taxonomy is copied.

### Current construction clause

Phase A — Shared Spatial Kernel / Production Owner Cleanup.

A01 stabilized render/request ownership. A02/A03 stabilized Orbit lifecycle. A04 removes the legacy second-click path that let Selection itself become the owner of Composer opening.

### Current production owner

- `apps/web/src/App.tsx::selectNode()`
- Explicit Composer owner remains `requestComposerFocus()` / explicit run-entry paths.
- Browser interaction owner: `tests/e2e/interaction-foundation.spec.ts`

### Old competing behavior retired

```text
setSelectionComposerOpen(layoutMode === 'desktop' && !additive && selectedIds.includes(id))
```

That line encoded:

```text
click selected object again
→ open Composer
```

which violates the current interaction grammar.

### Classification

`IMPLEMENTATION_GAP + WRONG_OWNER`

Selection was incorrectly allowed to own execution-surface activation.

---

## What changed

### `App.tsx`

`selectNode()` now uses a monotonic close/keep rule:

```text
closed Composer
+ any ordinary Selection
→ remains closed

already-open explicit Composer
+ same single target reselected
→ may remain open

already-open explicit Composer
+ additive/different target Selection
→ closes
```

The important invariant is:

> Selection can preserve or dismiss an already explicit Composer, but can never create one.

`layoutMode` is no longer a dependency of `selectNode()` because layout mode no longer decides whether a click may summon execution UI.

### `ProjectCanvas.tsx`

Updated the stale drag/double-press comment. The second-press gesture belongs to deeper reading/open behavior, not a Workbench/Composer activation path.

### Browser regression guard

Extended `tests/e2e/interaction-foundation.spec.ts`:

```text
select one node
wait beyond double-press window
reselect the same already-selected node
→ selection-composer count remains 0
```

The wait is intentional: it proves that even a deliberate later second click cannot reopen the retired legacy Composer path while avoiding the separate double-click/deeper-view gesture.

### Static regression gate

Added:

`scripts/validate-v015-a04-selection-composer-ownership.mjs`

It asserts:

1. ordinary Selection cannot change Composer `false → true`;
2. `requestComposerFocus()` remains an explicit owner that can open the Composer;
3. browser regression coverage exists for same-node reselection;
4. double-click remains a separate deeper-view gesture and closes Composer before entering detail.

---

## Acceptance

- [x] First click on an object does not open Composer.
- [x] Later ordinary click on the same selected object does not open Composer.
- [x] Shift/additive Selection does not open Composer.
- [x] Explicit `requestComposerFocus()` still opens the selection Composer.
- [x] Double-click/deeper-view gesture remains separate from Composer activation.
- [x] No Reference semantics were changed in this patch.
- [x] No Composer morphology/timing changes were bundled.
- [x] Patch remains one product proposition.

---

## Tests actually run

### Static / targeted

- `node scripts/validate-v015-a04-selection-composer-ownership.mjs` — **4/4 PASS**
- `node scripts/validate-v015-r2d-interaction-grammar.mjs` — **20/20 PASS**
- `node scripts/validate-v015-native-visual.mjs` — **14/14 PASS**
- `node scripts/validate-v015-spatial-navigation-f6a2.mjs` — **14/14 PASS**
- `git diff --check` — **PASS**

### Typecheck

`npm run typecheck --workspace @local-creative-os/web` — **BLOCKED_ENV**.

Actual errors:

```text
TS2688 Cannot find type definition file for 'node'
TS2688 Cannot find type definition file for 'vite/client'
```

The extracted RC still has no installed project dependencies / `node_modules`.

### Browser E2E

Regression test added, but execution is `NOT_RUN / BLOCKED_ENV` because the current extracted RC cannot build the Web app without dependencies.

### Manual product smoke

`NOT_RUN / BLOCKED_ENV` for the same reason.

---

## Main / Context / Workflow parity

A04 fixes the Main selection owner where the legacy auto-open path currently lives.

It does **not** claim Context / Workflow full interaction parity is complete. Their Selection primitives remain a separate Phase A convergence target.

The invariant to preserve across all three surfaces is now explicit:

```text
Selection
!= Composer activation
```

---

## Donor Conformance

Relevant donor:

- Lovart Composer / Reference Pick analysis.

Borrowed:

- explicit transition from object-local interaction to task Composer;
- Composer does not appear merely because an object is selected.

Explicitly not copied:

- donor layout;
- donor taxonomy;
- donor prompt IA.

No motion token changed in A04.

---

## Index updates

- Construction Context Index: **YES** — A04 becomes latest completed Phase A patch.
- Mandatory Context: NO — no new L0 rule; this implements an already frozen rule.
- Plan Diff Index: NO.
- Reality/Audit docs: NO.
- Video/Code Donor Index: NO.

---

## Remaining debt / next admissible proposition

Next independent Phase A proposition:

> **A05 — Selection IDs must not be merged into execution Reference IDs.**

Audit target already known:

```text
mergeExecutionReferenceIds(selectedIds, selectionReferenceIds, selectionTargetNode?.id)
```

A05 must preserve target/selection context separately while allowing only explicit Reference Pick state to own `referenceIds`.

Do not bundle Universal Orbit, right-click, or visual Composer redesign into A05.

---

## Verdict

Source/static acceptance: `PASS`.

Runtime/browser verification: `BLOCKED_ENV`.

Overall evidence status: `BLOCKED_ENV`.

## STOP

Do not start A05 in the same patch.
