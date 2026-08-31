# LCOS v0.15 · Phase A Fresh Parity Census after A18

Date: 2026-08-31

## Provenance

Real local authority reported and validated by user:

```text
5901c02  feat(v015): A18 dialog dominant owner candidate
```

Lineage:

```text
2d2f30c → 59692ff → 6312ace → 0691812 → ec01327 → 5901c02
```

Local real-dependency evidence supplied for A18:

- A18 dedicated validator: 12/12 PASS
- full v0.15 static: 46 PASS / 0 FAIL / 2 SKIP
- full typecheck: PASS
- web unit: 120 files / 687 tests PASS
- local-core unit: 133 files / 687 tests PASS
- Browser E2E / Human Smoke: BLOCKED_ENV, not claimed PASS

The newly uploaded `5901c02` archive was not readable from the current execution sandbox. For A19 source census only, the working source is reconstructed from the already-validated A18 candidate plus the one explicitly reported local test-assertion update in `apps/web/tests/permission-gate.test.tsx`. No production A18 code delta was reported beyond the candidate.

---

## 1. Relation after A17

No new Relation owner or semantic debt was found. A12–A17 remain the current source/static Relation truth.

---

## 2. Dialog/modal owner after A18

A18 closes the flat multi-dialog render defect:

```text
application dialog states
→ DialogLayerCandidate[]
→ dominantDialogOwner
→ one visible dominant dialog
```

The local `5901c02` validation upgrades A18 from candidate-only evidence to real local PASS for source/static/typecheck/unit.

---

## 3. Newly discovered contextual transient owner defect

The next defect is not SpatialOverlayPlacement yet.

`UnifiedExecutionComposer` is a contextual transient surface, but prior to A19 it does not register itself in `overlayStack`.

Consequences:

1. App global Esc calls `escapeTopOverlay()` before the text-input early return.
2. If the Composer textarea owns focus and the Composer is not in overlayStack, Esc falls through to `isText` and returns.
3. The Composer therefore remains open even though the frozen interaction rule says Esc closes the current top transient layer.
4. In Main multi-selection, `SelectionGroupActions` can remain visible while the Composer is also visible, creating two competing local transient owners.
5. Conversation Subcanvas separately registers a `conversation-work:*` overlay around the same shared Composer, while Main/Context/Workflow Composer instances do not. This creates cross-surface owner asymmetry.

Classification:

```text
UNIFIED COMPOSER TRANSIENT OWNER = MISSING_OWNER
MAIN GROUP-ACTION vs COMPOSER = MULTI_OWNER
CONVERSATION COMPOSER REGISTRATION = DUPLICATE / SURFACE-SPECIFIC OWNER
SPATIAL OVERLAY PLACEMENT = STILL OPEN, SEPARATE
```

---

## 4. Next proposition

```text
A19 · Selection Composer Transient Ownership
```

Scope:

- `UnifiedExecutionComposer` itself registers one overlayStack owner;
- its real DOM root is the overlay hit boundary;
- Esc closes it even while textarea/select owns focus;
- outside pointer closes it only when it is the current top overlay, preserving deeper nested layers;
- Main multi-selection group actions yield while Composer is open and recover after close;
- opening Composer retires NodeInfo; opening NodeInfo retires Composer/Reference Pick;
- Conversation Subcanvas removes its duplicate Composer overlay registration;
- no SpatialOverlayPlacement implementation in A19.

Phase A remains OPEN after A19 for placement/portal convergence and real browser/human evidence.
