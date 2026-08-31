# LCOS v0.15 · A18 Dialog Dominant Owner Arbitration Closeout

Date: 2026-08-31

## Proposition

Dialogs/modals must not all render merely because multiple application states are non-null. `DialogsHost` owns a deterministic dominant transient dialog layer while preserving lower parent state for return after a child/blocking layer closes.

---

## 0. Verdict

```text
Exact real local ec01327 archive inspected: NO / UPLOAD_MOUNT_BLOCKED
Temporary source basis: 0691812 exact source + exact A17 final patch
A18 Source-Diff Gate: PASS on temporary reconstructed current source
A18 implementation: PASS
A18 dedicated validator: 12/12 PASS
Full runnable v0.15 static sweep: 46 PASS / 0 FAIL / 2 SKIP
Changed TS/TSX syntax transpile: 4/4 PASS
Pure owner functional smoke: 4/4 PASS
Full semantic typecheck: BLOCKED_ENV in archive source (no node_modules)
Exact ec01327 cold apply: NOT CLAIMED
A18 merge authorization: NO / candidate only until exact ec01327 bytes or local apply validation
Phase A complete: NO
Phase B admission: NO
```

---

## 1. Source-Diff Gate

Frozen authority says:

```text
一次只允许一个 dominant transient layer
```

and Phase A explicitly includes Overlay Placement / Esc / outside-close / ownership convergence.

Production audit still showed `DialogsHost` flattening many non-null dialog states together and `extraDialogs` bypassing central arbitration.

Classification:

```text
PRODUCT RULE = ALREADY FROZEN
CURRENT OWNER = MULTI_OWNER
IMPLEMENTATION GAP = YES
NEW PRODUCT INVENTION = NO
```

---

## 2. Implementation

### 2.1 `dialogOwner.ts`

Adds one pure owner selector with four causal tiers:

```text
editor < surface < child < blocking
```

Same-tier ties use candidate order. The selector stores no UI state.

### 2.2 `DialogsHost`

- removes flat `return <>{[...]}` rendering;
- receives explicit `DialogLayerCandidate[]` for complex upstream layers;
- chooses exactly one dominant candidate;
- preserves the application state of hidden parent layers;
- blocking delete confirmations outrank all lower layers.

### 2.3 App integration

`extraDialogs` is no longer an opaque Fragment. Permission confirmation, revision upgrade, workspace states, Conversation controller, Project Focus and Reorganize enter the same arbitration path.

Project Create also becomes `null` while closed rather than a permanently supplied `{ open:false }` candidate.

---

## 3. Important non-goals

A18 does NOT:

- implement SpatialOverlayPlacement;
- migrate every portal to `overlayStack`;
- change Dialog component internals;
- change focus trap / keyboard implementation;
- change modal business state;
- change ObjectOrbit / Relation / Composer semantics.

Therefore A18 closes only the dominant dialog owner defect, not the entire Overlay phase debt.

---

## 4. Validation

```text
A18 dedicated gate = 12/12 PASS
Full runnable v0.15 sweep = 46 PASS / 0 FAIL / 2 SKIP
Changed syntax transpile = 4/4 PASS
Pure dominant-owner execution = 4/4 PASS
```

Skipped validators:

```text
S9 / S10 external semantic-provider gates
```

---

## 5. Remaining Phase A debt

1. SpatialOverlayPlacement / free-canvas placement owner;
2. portal/registerOverlay classification convergence where still needed;
3. real runtime/browser/human evidence for A14–A18 interaction chains;
4. exact-byte verification against the real merged `ec01327` source before A18 formal merge authorization.

---

## 6. Stop condition

```text
A18 SOURCE / STATIC = PASS
A18 FORMAL MERGE AUTHORIZATION = NO (UPLOAD_MOUNT_BLOCKED)
PHASE A COMPLETE = NO
PHASE B ADMISSION = NO
```

Do not auto-name A19 until the exact current source or local A18 apply evidence is available and a fresh census is rerun.
