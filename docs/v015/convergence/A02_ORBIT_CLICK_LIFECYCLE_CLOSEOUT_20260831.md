# A02 Orbit Click-Open Lifecycle Closeout

## Product Proposition

A click-open Object Orbit is an object-local action layer, not a hover tooltip. Pointer leave must never dismiss it. Once opened, Orbit remains until an explicit lifecycle transition closes or replaces it.

---

## Source-Diff Gate

### Original user / freeze

- `docs/v015/convergence/original/LCOS_0.1_INTERFACE_PRODUCTIZATION_CODEX_CONSTRUCTION_PLAN_20260816.md`
  - UI changes require real acceptance; interface existence is not product completion.
- `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_对话选择与承接全链补齐_20260821.md`
  - Main / Context / Workflow share the same Spatial Surface interaction foundation.

### Earlier superseded behavior

Historical Orbit documents and the current pre-A02 implementation still encoded a hover-style rule:

```text
pointer leave
→ 300ms grace period
→ Orbit closes
```

That rule is historical evidence only for this behavior.

### Latest explicit override / reality feedback

- `docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md`
- `docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md`
- `docs/v015/convergence/FRONTEND_CONVERGENCE_PLAN_20260831.md`

Latest L0 rule:

```text
click-open Orbit
→ stays open across pointer leave
→ closes on action / outside press / Esc / selection change / deeper viewer
```

### Relevant donor source

- `VIDEO_LOVART_COMPOSER_REFERENCE_PICK_20260831.md`: object-local interaction layers yield only when the next explicit layer is entered.
- `VIDEO_CODEX_DESKTOP_ANALYSIS_20260831.md`: hover explanation and explicit local action layers are different interaction levels.

No donor taxonomy is copied.

### Current construction clause

Phase A — Shared Spatial Kernel / Production Owner Cleanup:

> retire `pointerleave Orbit close` before further Orbit expansion.

### Current production owner

- `apps/web/src/features/ui/ObjectOrbit.tsx`

### Old competing behavior retired

- `POINTER_LEAVE_CLOSE_DELAY_MS = 300`
- anchor `mouseenter/mouseleave` close timer lifecycle
- satellite `onPointerEnter/onPointerLeave` timer wiring
- unit assertion freezing the obsolete 300ms behavior

### Classification

`EXPLICIT_OVERRIDE + IMPLEMENTATION_GAP`

---

## What changed

### `ObjectOrbit.tsx`

Removed the hover-tooltip lifecycle entirely:

- no pointer-leave close constant;
- no leave timer state;
- no anchor mouseenter/mouseleave listeners;
- no satellite pointer-enter/pointer-leave close handlers;
- comments now describe the current click-open lifecycle.

Existing explicit close paths remain untouched:

- action executes, then closes unless `keepOpen`;
- outside pointerdown closes;
- Esc closes;
- ProjectCanvas selection change closes the conversation Orbit;
- ProjectCanvas deeper viewer / double-enter path closes the conversation Orbit.

### `ObjectOrbit.test.tsx`

Removed the obsolete 300ms constant contract and points lifecycle behavior to browser E2E.

### `tests/e2e/orbit-lifecycle.spec.ts`

Added browser acceptance for:

1. click Glyth → Orbit opens;
2. move pointer away for 1.2s → Orbit remains visible;
3. Esc → closes;
4. outside press → closes;
5. satellite action → closes.

The setup fails closed if the seeded connected conversation cannot be linked into a visible Glyth.

---

## Acceptance

- [x] Pointer leave cannot dismiss Orbit in source.
- [x] Obsolete 300ms lifecycle constant is gone.
- [x] Obsolete pointer enter/leave timer handlers are gone.
- [x] Esc close path remains.
- [x] Outside-click close path remains.
- [x] Action close path remains.
- [x] Selection-change and deeper-viewer close paths remain in `ProjectCanvas`.
- [x] Browser lifecycle regression spec exists.
- [x] Patch contains one product proposition only.

---

## Tests actually run

### Static

- `git diff --check` — PASS.
- targeted Orbit source assertions — PASS.
- `node scripts/validate-v015-r2d-interaction-grammar.mjs` — **20/20 PASS**.

### Typecheck

`npm run typecheck --workspace @local-creative-os/web` — `BLOCKED_ENV`.

The extracted RC still has no installed type packages / `node_modules`:

```text
TS2688 Cannot find type definition file for 'node'
TS2688 Cannot find type definition file for 'vite/client'
```

### Browser E2E

`NOT_RUN / BLOCKED_ENV` in this sandbox for the same dependency reason.

### Manual product smoke

`NOT_RUN / BLOCKED_ENV` because Web + Local Core cannot be built in this extracted RC.

---

## Main / Context / Workflow parity

`ObjectOrbit` is the shared Orbit primitive, so the lifecycle change applies to every current/future consumer of that primitive.

Current coverage gap remains separate from A02:

- Main Conversation/Glyth currently consumes Orbit;
- universal ordinary Artifact / Context / Workflow Orbit exposure is still a later Phase A proposition.

A02 does **not** pretend that coverage gap is solved.

---

## Donor conformance

No animation timings or morphology changed in A02.

The patch only enforces interaction hierarchy:

> click-open action layer ≠ hover tooltip.

TodoPanel swap tokens remain reserved for the later motion pass / layer-yield transitions.

---

## Index updates

- Construction Context Index: **YES** — A02 becomes latest completed Phase A patch.
- Mandatory Context: NO — the L0 lifecycle rule was already frozen there.
- Reality / Plan Diff indexes: NO — this patch implements an already-indexed gap.
- Video/Code Donor index: NO.

---

## Remaining Orbit debt

Next independent Orbit proposition:

> stabilize the anchor ownership so an inline `anchorRef={{ current: ... }}` cannot force outside-listener reattachment on every parent render.

This is the already-indexed A11 production stability gap and is deliberately not bundled into A02.

---

## Verdict

Source/static acceptance: `PASS`.

Runtime/browser verification: `BLOCKED_ENV`.

Overall evidence status: `BLOCKED_ENV` (not misreported as full runtime PASS).

## STOP

Do not merge anchor-ref stability, universal Orbit coverage, Composer, or Reference semantics into A02.
