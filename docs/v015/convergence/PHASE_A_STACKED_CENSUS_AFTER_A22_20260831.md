# LCOS v0.15 · Phase A Stacked Census after A22

Date: 2026-08-31
Real local authority: `4c90d4d`
Stacked source state inspected: `4c90d4d + A21 + A22`

## Fresh finding

A22 fixes object-local interaction grammar, but `UnifiedExecutionComposer` is still visually and behaviorally heavier than the newly frozen Compact Composer contract:

- default shell is still 470px wide;
- an empty Reference tray remains visible even with zero explicit References;
- Receiver / Selection / Reach / advanced controls occupy the first screen simultaneously;
- textarea has a CSS max-height but no deterministic autosize/overflow owner;
- the Ctrl/Cmd Reference accelerator can become active from a modifier alone even when the Composer is closed.

The execution truth itself is already largely correct:

```text
Selection != Reference
Ctrl/Cmd = Reference modifier
Shift = additive Selection
UnifiedExecutionComposer = shared Main/Context/Workflow/Conversation shell
provider = advanced execution choice
```

Therefore the next Phase A source proposition is presentation/interaction convergence, not a new execution model.

## A23 proposition

```text
current Selection / Target
→ bounded local Compact Composer
→ prompt grows to a small cap, then scrolls internally
→ explicit References render only when present
→ Ctrl/Cmd Reference is an accelerator only while Composer is active
→ Receiver / settings stay compact and progressively disclosed
```

## Explicit non-goals

A23 does not:

- add Voice / ASR;
- implement Assembly AI instruction flow;
- change run persistence semantics;
- merge Selection into Reference;
- change canonical receiver identity;
- enter Phase B.

## Phase status before A23 local merge

```text
A22 SOURCE/STATIC = PASS
A22 FINAL-BYTE STATIC = 50 PASS / 0 FAIL / 2 SKIP
A22 REAL LOCAL MERGE = PENDING
PHASE A COMPLETE = NO
PHASE B ADMISSION = NO
```
