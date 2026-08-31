# LCOS v0.15 · Phase A Stacked Census after A21

Date: 2026-08-31
Construction proposition: A22 Object-local Interaction Grammar

## Provenance

```text
last real local authority = 4c90d4d  (A19+A20 merged)
A21 = exact-cold validated from 4c90d4d, real-local merge still pending
A22 = stacked source/static candidate on 4c90d4d + A21 final
```

No later local HEAD is fabricated in this census.

## Fresh GUI defects confirmed after A21

### 1. Multi-selection feedback had become non-native

Production CSS explicitly reduced individual member selection opacity and represented the temporary group mainly as a shared field. Human GUI review showed that this made ordinary canvas multi-selection hard to read.

A22 adjudication:

```text
selected member feedback
+
aggregate selection bounds
= both remain visible
```

Transient menus and Composer may yield; Selection feedback does not.

### 2. ObjectOrbit semantic owner had been over-expressed as a full radial dial

Production `ObjectOrbit` still encoded:

```text
full 360° distribution
+ visible orbit track
+ equal radial occupation around object
```

This was heavier than the intended LCOS object-local interaction grammar and competed with Pin, Composer, Relation and Selection feedback.

A22 adjudication:

```text
Orbit semantic owner remains
visual full ring retires
→ top-right corner-hugging short Action Arc
→ no visible track
→ 3 normal / 4 maximum direct actions
→ overflow belongs to More / management layer
```

### 3. Composer and direct actions were incorrectly mutually exclusive

A09/A19-era production logic closed all object Orbit projections whenever Selection Composer became visible. The latest frozen interaction grammar explicitly allows a stable single click on a content-like object to reveal:

```text
Selection
+ Action Arc
+ Compact Composer
```

A22 therefore removes the forced visual exclusion while preserving layered overlay ownership:

```text
Composer is registered above Arc
first Esc/outside → Composer
second Esc/outside → Arc
```

Additive/multi-selection still closes the single-target Composer through the canonical Selection owner.

### 4. Right-click duplicated high-frequency direct actions

The object context menu still exposed Focus / Pin alongside Orbit/Action Arc. This made two primary command surfaces compete.

A22 command split:

```text
Action Arc
= direct / frequent / object-local

Right-click / More
= management / copy / reference / duplicate / remove
```

Relation remains Action Arc only. No fake Assembly action is introduced.

### 5. Surface Component collapse was a semantic dead end

Production collapse reduced a Surface Component to a thin empty bar while keeping permanent generic button chrome. This did not preserve meaningful spatial identity.

A22 adjudication:

```text
Surface Component = Spatial Instrument
expanded → functional body + persistent Map Locator
collapsed → Map Locator only at same top-center spatial anchor
```

Generic permanent `○ / − / ×` chrome retires. Component lifecycle actions move to Action Arc; management moves to right-click / More.

### 6. Stable-click Composer invocation had regressed

The shared Composer lifecycle owner existed, but ordinary content selection no longer had a direct local invocation path.

A22 introduces a fail-closed eligibility resolver:

```text
content-like Artifact / Note / Conversation → stable click may request Composer
Collection / Context / Workflow / scope / workspace → no implicit generic Composer
```

The request happens on stable click, not pointerdown, so drag initiation is not stolen and textarea focus is not automatically grabbed.

## Explicitly NOT implemented by A22

A22 does not claim completion of:

- Unified Compact Composer bounded textarea / Reference chips / parameter popovers (A23 target);
- Voice Input Primitive / STT state machine (A24 target);
- Color Pin many-to-many persistence and top-center index;
- Focus list retirement into Centered Spatial Index;
- Search result index migration;
- Assembly category index / admission UX;
- offscreen Map Locator aggregation/collision;
- final D-stage visual/material/motion polish.

The following frozen product authorities are added to the repository for subsequent work:

- `CENTERED_SPATIAL_INDEX_SEARCH_ASSEMBLY_FREEZE_20260831.md`
- `SURFACE_COMPONENT_GUI_GRAMMAR_FREEZE_20260831.md`
- `UNIFIED_COMPACT_COMPOSER_PROMPT_REFERENCE_VOICE_GUI_FREEZE_20260831.md`

## Phase verdict before final validation

```text
A22 proposition = source implementation complete
A22 dedicated gate = 19 / 19 PASS
full static = 50 PASS / 0 FAIL / 2 SKIP
construction typecheck = BLOCKED_ENV; real-local typecheck/unit = pending local merge
Phase A complete = NO
Phase B admission = NO
```
