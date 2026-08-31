# LCOS v0.15 · A23 Unified Compact Composer Closeout

Date: 2026-08-31
Baseline for construction: `4c90d4d + A21 final + A22 final`
Status: stacked source/static candidate

## Proposition

A23 converts the already-canonical Unified Execution Composer into the frozen target-local Compact Composer grammar without inventing a second execution model.

```text
Selection / Target
→ Compact Composer
→ Prompt / explicit Reference / Receiver / Settings / Send
```

## Implemented

### Compact shell

- default unified Composer footprint is reduced from the old 470px class to a ~382px local shell;
- the Composer remains spatially placed through A20 SpatialOverlayPlacement;
- no large permanent side panel or modal is introduced.

### Bounded prompt editing

- prompt textarea starts at one compact row;
- height is measured from actual `scrollHeight`;
- it grows only from 34px to 88px;
- after the cap, the textarea becomes the explicit internal vertical scroll owner;
- the outer Composer stops growing indefinitely.

### Reference presentation

- empty Reference tray disappears entirely;
- explicit References render only when real references exist;
- ordered reference identity / thumbnail / remove / reorder behavior remains canonical;
- compact references use one horizontal strip rather than a second panel;
- `Selection != Reference` language and persistence are preserved.

### Reference shortcut ownership

The existing pointer grammar already defines:

```text
Shift = additive Selection
Ctrl/Cmd = this-run Reference
```

A23 narrows the shortcut lifecycle:

- explicit Reference Pick remains available from the Composer;
- Ctrl/Cmd + click becomes an accelerator only while the local Composer is active;
- Main uses `selectionComposerOpen` to enable the modifier bridge;
- Context/Workflow uses the local Composer presence (`agentNode`) to enable the modifier bridge;
- closed Composer no longer exposes an invisible global Reference mutation mode.

This explicitly supersedes the older R2-D assertion that modifier Reference Pick must be available without opening Composer.

### Progressive controls

- Receiver remains a real canonical execution target selector, but moves into the compact footer;
- provider / intent / result controls remain in an anchored Advanced popover;
- the disabled placeholder `更多来源` control is removed;
- Ctrl/Cmd+Enter remains explicit Send.

### Shared shell

Main, Context/Workflow and Conversation continue to reuse `UnifiedExecutionComposer`.
A23 does not introduce surface-specific prompt boxes.

## Validation

```text
A23 dedicated                         16 / 16 PASS
A05 Selection/Reference regression     8 / 8 PASS
F6B Unified Composer regression       13 / 13 PASS
A19 transient-owner regression        13 / 13 PASS
A22 interaction-grammar regression    19 / 19 PASS
R2-D updated interaction grammar      20 / 20 PASS
Full runnable v0.15 static            51 PASS / 0 FAIL / 2 SKIP
User-language full scan               PASS (240 product-surface files)
Changed TS/TSX syntax transpile        4 / 4 PASS
Semantic typecheck                    BLOCKED_ENV / local dependencies absent
Browser/Human                         NOT RUN
```

S9/S10 remain external semantic/provider gates and are not counted as PASS.

## Typecheck evidence

The uploaded/source construction tree has no local `node_modules`. The workspace typecheck was actually attempted; a global `tsc` attempt cannot resolve the intended local workspace dependency environment and timed out before producing trustworthy semantic diagnostics. This is recorded as `BLOCKED_ENV`, not PASS.

## Human/runtime acceptance still required

At minimum:

- stable single click shows a small local Composer without stealing drag initiation;
- short prompt stays one row;
- multi-line prompt grows smoothly and caps at the bounded height;
- long prompt scrolls inside the textarea without continuously pushing the canvas;
- zero References show no empty tray;
- explicit References show compact identity chips;
- Ctrl/Cmd click with Composer open adds Reference without changing Selection;
- Ctrl/Cmd click with Composer closed does not mutate Reference;
- Receiver/settings remain reachable without making the shell feel like an Inspector;
- Main / Context / Workflow / Glyth show the same shell grammar.

## Non-goals

```text
Voice / ASR = A24
Centered Spatial Index = separately staged
Assembly Instruction UI = Phase C consumer of the shared Composer
Phase B Species morphology = NOT entered
```

## Status

```text
A23 SOURCE / STATIC = PASS
A23 STACK COLD APPLY = PASS (exact final patch bytes; external cold-apply log)
A23 REAL LOCAL MERGE = PENDING
A23 HUMAN VISUAL ACCEPTANCE = PENDING
PHASE A COMPLETE = NO
PHASE B ADMISSION = NO
```
