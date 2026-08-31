# LCOS v0.15 · Phase A Fresh Parity Census after A19

Date: 2026-08-31

## Provenance

```text
latest real local authority: 5901c02 (A18)
A19: source/static candidate on reconstructed 5901c02-equivalent source
A20 census basis: 5901c02-equivalent + A19 candidate
```

The user explicitly requested continued construction before returning an A19 real-local merge HEAD. This census therefore selects the next source/static proposition only; it does not manufacture a post-A19 real Git authority.

---

## 1. What A18/A19 closed

### A18

```text
Dialog/Modal application state
→ explicit candidates
→ one dominant dialog owner
```

Real-local validation supplied by user: A18 12/12, full v0.15 46/0/2, full typecheck PASS, web/local-core unit PASS.

### A19

```text
UnifiedExecutionComposer
→ shared overlayStack owner
→ top-only Esc/outside lifecycle
→ local transient slot
```

Source/static/cold validation is PASS; real-local A19 merge remains pending at this census point.

---

## 2. Fresh overlay census

| Area | Current production truth | Classification | Next action |
|---|---|---|---|
| Dialog dominant owner | A18 explicit arbitration | CLOSED | preserve |
| Unified Composer transient lifecycle | A19 shared `overlayStack` owner | SOURCE/STATIC PASS | local merge evidence pending |
| Main Composer geometry | manual viewport clamp around persisted Selection anchor | WRONG_OWNER | migrate to SpatialOverlayPlacement |
| NodeInfo geometry | independent hand-coded right/left/above clamp | WRONG_OWNER | migrate to SpatialOverlayPlacement |
| target geometry input | persisted node/selection geometry still used by old placement | WRONG_INPUT | use visual bounds |
| overlay size input | hard-coded 294×510 / 430×128-ish assumptions | WRONG_INPUT | real DOM measurement |
| Dock/Rail/Minimap avoidance | absent from the two hand-coded owners | IMPLEMENTATION_GAP | occupied rect input |
| Base UI menu / Orbit placement | dedicated mature positioners | NOT A20 DEBT | do not mechanically replace |
| all production portals | still mixed | OPEN C02 debt | later census, not A20 |
| final visual placement handfeel | no real four-corner/Dock/Rail/Minimap evidence | HUMAN/RUNTIME DEBT | local QA required |

---

## 3. Why A20 is the next admissible proposition

Mandatory Context freezes:

```text
SpatialOverlayPlacement
inputs:
- target visual bounds
- overlay size
- viewport
- safe insets
- occupied overlay rects
- preferred side

output:
- nearest free canvas rect
```

The current Main Composer and NodeInfo are the clearest duplicate geometry owners and both violate that contract. A20 therefore centralizes geometry ownership first, without pretending the visual acceptance is complete.

---

## 4. A20 proposition

```text
visual target bounds
+ measured overlay size
+ viewport
+ safe/occupied geometry
+ preferred side
→ SpatialOverlayPlacement
→ deterministic nearest low-collision rect
```

First migrated call sites:

1. Main `UnifiedExecutionComposer` near-field placement;
2. `NodeInfoPopover`.

A20 must not:

- rewrite ObjectOrbit/Base UI menu positioners;
- change node/model geometry;
- claim four-corner/Dock/Rail/Minimap visual QA PASS;
- close all portal ownership;
- close Phase A.

---

## 5. Post-A20 expected debt

Even after A20 source/static:

```text
real-local A19/A20 merge/typecheck/unit
+ Browser/Human placement QA
+ remaining portal ownership census
+ final Phase A runtime parity census
```

remain mandatory before Phase A can close.

`PHASE A COMPLETE = NO`

`PHASE B ADMISSION = NO`
