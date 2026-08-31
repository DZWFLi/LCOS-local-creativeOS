# LCOS v0.15 · A19 Selection Composer Transient Ownership Closeout

Date: 2026-08-31

## Proposition

The shared Unified Selection/Execution Composer is one contextual transient owner. It must participate in the same overlay lifecycle as other local transient UI instead of depending on surface-specific wrappers or text-focus fallthrough behavior.

---

## 0. Verdict

```text
Real local authority: 5901c02 (user-reported/local-validated)
Exact 5901c02 archive inspected in this sandbox: NO / UPLOAD_MOUNT_BLOCKED
A19 Source-Diff Gate: PASS on reconstructed 5901c02-equivalent production source
A19 implementation: PASS
A19 dedicated validator: 13/13 PASS
Full runnable v0.15 static sweep: 47 PASS / 0 FAIL / 2 SKIP
Changed TS/TSX/E2E syntax transpile: 6/6 PASS
Full semantic typecheck: BLOCKED_ENV in archive source (no node_modules)
Browser E2E: source assertions added; execution BLOCKED_ENV
Human Product Smoke: BLOCKED_ENV
A19 reconstructed cold apply: PASS
A19 local merge authorization: CANDIDATE / requires real 5901c02 apply+typecheck validation
Phase A complete: NO
Phase B admission: NO
```

---

## 1. Frozen authority

Latest frozen interaction rules require:

```text
one dominant transient layer
Esc/outside closes the current local transient layer
contextual transient UI has one causal owner
```

A18 fixed dialog/modal dominance, but fresh census found the shared Unified Composer outside the overlayStack lifecycle.

---

## 2. Production defect

Before A19:

```text
UnifiedExecutionComposer
→ no overlayStack registration

App Escape
→ escapeTopOverlay() returns false
→ focused textarea triggers isText early return
→ Composer stays open
```

At the same time Main multi-selection could render:

```text
SelectionGroupActions
+
UnifiedExecutionComposer
```

Conversation Subcanvas separately registered the same shared Composer through `conversation-work:*`, creating a surface-specific duplicate owner.

Classification:

```text
MISSING_OWNER + MULTI_OWNER + DUPLICATE_OWNER
```

---

## 3. Implementation

### 3.1 Shared Composer owns its overlay lifecycle

`UnifiedExecutionComposer` now:

- registers itself in `overlayStack`;
- provides its actual root DOM node as the stack element;
- delegates Esc to its current `onClose` through a stable ref;
- declares `dismissOnOutside: true`;
- listens to capture-phase outside pointer events;
- only calls `dismissTop()` when the Composer itself is the current stack top;
- therefore does not punch through a deeper transient layer that may be above it.

### 3.2 Main local transient dominance

While `selectionComposer` exists:

- `SelectionGroupActions` is not rendered;
- when Composer closes, the group action notch can return for the still-live Selection.

Opening the Composer explicitly closes NodeInfo first.
Opening NodeInfo explicitly closes Reference Pick and the Composer first.

### 3.3 Conversation Subcanvas duplicate owner retired

`ConversationSpaceSurface` no longer registers a second `conversation-work:*` overlay owner.
The shared `UnifiedExecutionComposer` now owns this lifecycle consistently in Main / Context / Workflow / Conversation projection surfaces.

---

## 4. Browser contract source

E2E source now asserts:

1. Selection Composer textarea receives focus → Esc → Composer count becomes zero.
2. Multi-selection group actions visible → Composer opens → group actions disappear.
3. Composer Esc closes → group actions recover for the same Selection.

These are source-level regression contracts only until Playwright is executed in a running local environment.

---

## 5. Validation

```text
A19 dedicated gate = 13/13 PASS
Full runnable v0.15 sweep = 47 PASS / 0 FAIL / 2 SKIP
Changed syntax transpile = 6/6 PASS
```

Skipped validators:

```text
S9 / S10 external semantic-provider gates
```

Reconstructed baseline cold `git apply --check` + apply + A19 gate + full static sweep all PASS.

Full `npm run typecheck` was attempted and blocked only because this archive/reconstruction environment has no installed `node_modules` type packages:

```text
TS2688: node
TS2688: vite/client
```

This is recorded as `BLOCKED_ENV`, not PASS.

---

## 6. Superseded historical assertion

`validate-v015-conversation-subcanvas-execution-f6b.mjs` previously required `ConversationSpaceSurface` itself to register `conversation-work:*`.

A19 explicitly supersedes that ownership because the shared Composer now owns its own overlay registration. The validator was updated to require:

```text
Conversation Work
→ shared UnifiedExecutionComposer
→ shared Composer overlayStack owner
```

and to reject the old surface-specific duplicate registration.

---

## 7. Non-goals

A19 does NOT:

- implement `SpatialOverlayPlacement`;
- move NodeInfo/Composer geometry;
- migrate all portals;
- replace Base UI menu/popover positioning;
- change Composer execution semantics;
- change Reference truth;
- change Relation/Orbit behavior.

---

## 8. Remaining Phase A debt

Source-level next census should inspect:

```text
SpatialOverlayPlacement owner / real DOM measurement
object-local portal census
safe inset + occupied rect handling
Esc/outside lifecycle for remaining unregistered object-local transients
```

Runtime debt still includes Browser E2E and Human Product Smoke.

---

## 9. Stop

```text
A19 SOURCE / STATIC = PASS
A19 FORMAL LOCAL MERGE = PENDING real 5901c02 apply/typecheck/unit evidence
PHASE A COMPLETE = NO
PHASE B ADMISSION = NO
```

Do not auto-open Phase B from this closeout.
