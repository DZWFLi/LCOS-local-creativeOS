# A03 Orbit Anchor Ownership Stability Closeout

## Product Proposition

A click-open Object Orbit must keep one stable outside-pointer listener for the lifetime of its open state. Parent rerenders and caller-created ref wrapper identities must not tear down and recreate that listener when the actual DOM anchor has not changed.

---

## Source-Diff Gate

### Original user / freeze

- `docs/v015/convergence/original/LCOS_0.1_INTERFACE_PRODUCTIZATION_CODEX_CONSTRUCTION_PLAN_20260816.md`
  - UI work is not complete because an interface exists; the real consumer path and manual behavior must be verified.
- `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_对话选择与承接全链补齐_20260821.md`
  - Main / Context / Workflow reuse the same Spatial Surface interaction primitives rather than cloning interaction behavior per surface.

### Latest explicit reality feedback

- `docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md`
- `docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md`
- A01 / A02 closeouts

Current Orbit rule:

```text
click-open Orbit
→ remains stable until an explicit lifecycle transition
→ parent rerenders must not behave like lifecycle transitions
```

### Relevant donor source

- `VIDEO_LOVART_COMPOSER_REFERENCE_PICK_20260831.md`
- `VIDEO_CODEX_DESKTOP_ANALYSIS_20260831.md`

Borrowed behavior only: explicit local action layers remain anchored and stable while unrelated UI state changes. No donor taxonomy is copied.

### Current construction clause

Phase A — Shared Spatial Kernel / Production Owner Cleanup.

A02 removed hover/pointer-leave dismissal. A03 removes the remaining listener churn caused by ref-object ownership.

### Current production owners

- `apps/web/src/features/ui/ObjectOrbit.tsx`
- Main Conversation/Glyth caller: `apps/web/src/features/canvas/ProjectCanvas.tsx`
- Existing stable comparison caller: `apps/web/src/features/focus/ArtifactLocationOrbit.tsx`

### Old competing behavior retired

- `ProjectCanvas` no longer creates `anchorRef={{ current: conversationOrbit.anchor }}` inline.
- `ObjectOrbit` outside-pointer effect no longer depends on the caller `anchorRef` object identity.

### Classification

`IMPLEMENTATION_GAP + WRONG_OWNER`

The actual DOM anchor is semantic input. The ephemeral wrapper object is not lifecycle truth.

---

## What changed

### `ProjectCanvas.tsx`

Introduced a memoized Conversation Orbit anchor ref:

```text
conversationOrbit.anchor
→ conversationOrbitAnchor
→ stable conversationOrbitAnchorRef
→ ObjectOrbit
```

The ref wrapper changes only when the actual anchor element changes.

### `ObjectOrbit.tsx`

Added an internal `anchorNodeRef` that is refreshed from the latest `anchorRef.current` without becoming an outside-listener dependency.

The outside pointer listener now owns only:

```text
open
close
```

and reads the latest DOM anchor through the internal ref.

This means a parent rerender cannot cause removeEventListener/addEventListener churn solely because a caller created a new ref wrapper.

Orbit geometry still reads the current caller anchor directly, so anchor geometry is not frozen to a stale element.

### Static regression gate

Added:

`scripts/validate-v015-a03-orbit-anchor-stability.mjs`

It asserts:

1. ObjectOrbit's outside listener is independent of caller ref-object identity.
2. Main Conversation Orbit passes a stable memoized anchor ref.
3. Artifact Location Orbit keeps the same stable anchor ownership rule.

---

## Acceptance

- [x] No inline `{ current: conversationOrbit.anchor }` owner remains in `ProjectCanvas`.
- [x] Actual anchor changes still update Orbit geometry/input.
- [x] Outside-pointer listener is not reattached for caller ref-wrapper churn.
- [x] Existing Esc / outside / action lifecycle remains unchanged.
- [x] A02 pointer-leave stability remains intact.
- [x] No Orbit morphology, action catalog or timing changes were bundled.
- [x] Patch remains one product proposition.

---

## Tests actually run

### Static / targeted

- `node scripts/validate-v015-a03-orbit-anchor-stability.mjs` — **3/3 PASS**
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

`NOT_RUN / BLOCKED_ENV`.

A02 already owns the browser lifecycle test. A03 does not invent a fake browser PASS in an environment that cannot build the Web app.

### Manual product smoke

`NOT_RUN / BLOCKED_ENV` for the same reason.

---

## Main / Context / Workflow parity

`ObjectOrbit` is the shared primitive, so its listener ownership is now safe for every current/future consumer.

A03 does **not** claim universal Orbit exposure is complete. Current coverage remains a separate Phase A gap.

---

## Donor Conformance

No animation token changed.

Borrowed principle:

> explicit local action layers keep stable ownership until an explicit transition replaces or closes them.

Explicitly not copied:

- donor layout;
- donor action taxonomy;
- donor panel structure.

---

## Index updates

- Construction Context Index: **YES** — A03 becomes latest completed Phase A patch.
- Mandatory Context: NO — no new L0 rule; this implements an existing stability gap.
- Plan Diff Index: NO.
- Reality/Audit docs: NO.
- Video/Code Donor Index: NO.

---

## Remaining debt / next admissible proposition

Next independent Phase A proposition:

> **A04 — Click Selection must not auto-open the execution Composer.**

That patch must audit `selectNode()` and any second-click / selection-derived composer owners without yet merging Selection into Reference cleanup unless the code proves they are inseparable under one owner.

---

## Verdict

Source/static acceptance: `PASS`.

Runtime/browser verification: `BLOCKED_ENV`.

Overall evidence status: `BLOCKED_ENV`.

## STOP

Do not start A04 in the same patch.
