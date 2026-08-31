# LCOS v0.15 · Phase A Fresh Census after A20

Date: 2026-08-31
Authority: user-reported real local HEAD `4c90d4d` + exact uploaded RC source bytes
Status: A21 source census

## Fresh findings

### P0-1 · Conversation/Glyth canonical projection regression — CONFIRMED

`runtimeBridge.ts` resolved the canonical Conversation session by `conversationViewId`, then attached Conversation metadata, but a later aggregate-scope `entityKind` assignment overwrote the earlier Conversation identity with `undefined` when the same View was not a Context/Workflow/Collection container.

Effect:

```text
canonical Conversation View
→ backing text Artifact remains visible
→ final entityKind becomes undefined
→ CanvasNodeVisual falls through to ordinary content/text morphology
→ Glyth disappears
```

Correct rule:

```text
conversationViewId match
→ entityKind = conversation has precedence
→ backing Artifact kind never demotes canonical Conversation projection
```

No title/provider/time inference is allowed.

### P0-2 · Context / Workflow capability Drop owner split — CONFIRMED

The source already stated that the bottom Context capability feeds the project-level Context worksite, yet production Drop handling still treated `capability:context` and `capability:workflow` as generative creation commands.

This made one visible affordance own two different meanings:

```text
Click Context / Workflow
→ enter existing worksite

Drop on same control
→ create another Context / Workflow
```

A21 separates the semantics:

```text
capability:context / capability:workflow
→ use the exact canonical worksite owner

generate:context / generate:workflow
→ explicit creation only
```

The same fix applies to Workflow, not only Context.

### P0-3 · Context / Workflow point additive Selection timing — CONFIRMED SOURCE RISK

Main commits Selection during pointerdown. Shared `SurfaceObject` previously committed Selection on click, while Context/Workflow outer spatial wrappers begin drag and take pointer capture during pointerdown.

That creates a browser-level race where click can be retargeted/swallowed after capture, making Shift+Click additive selection unreliable.

A21 moves shared SurfaceObject Selection ownership to pointerdown while preserving Main's group-drag behavior:

- Shift + pointerdown adds/toggles Selection.
- Existing multi-selection member press preserves the group during drag.
- A true ordinary click on an existing group member collapses after the click is delivered.
- Semantic Drop gestures do not mutate Selection.

## Phase decision

These are Phase A shared-truth/shared-interaction defects. They are not B morphology, C surface-specialization, or D polish.

```text
PHASE A COMPLETE = NO
PHASE B ADMISSION = NO
```

A21 must merge and receive real dependency/runtime evidence before Phase A can close.
