# LCOS v0.15 · Phase A Fresh Parity Census after A17

Date: 2026-08-31

## Provenance boundary

User supplied an archive named `LCOS_v015_RC_A17_MERGED_ec01327_20260831.zip`, but the current execution sandbox failed to mount the only grounded upload path. The archive therefore cannot be claimed as exact-byte inspected in this session.

For source census only, this audit uses the already exact-verified source reconstruction:

```text
0691812 exact source snapshot
+ A17 exact cold-applied final patch
= TEMP_RECONSTRUCTED_CURRENT_SOURCE
```

This is sufficient to discover source-owner debt, but not sufficient to claim the user's real `ec01327` runtime/integration truth.

---

## 1. Relation after A17

A12–A17 now establish, at source/static level:

- Main ordinary Project Object Relation starts from Orbit;
- Context/Workflow ordinary Project-material Relation uses one shared physical gesture;
- Workspace no longer owns a permanent hover notch;
- receptor uses 16px screen-space halo;
- `view / note / scope / workspace` endpoints canonicalize before persistence;
- Conversation ordinary Relation resolves through `artifact:<conversationArtifactId>`;
- Conversation Context Mapping remains separate Semantic Drop / `conversation_context` truth.

No new Relation semantic/owner debt was found in this census.

---

## 2. Remaining Phase A owner debt

The next explicit production-owner defect is Overlay/Dialog ownership.

Current `DialogsHost.tsx` still flattens many simultaneously non-null states into the DOM. `extraDialogs` is an opaque Fragment, so the host cannot arbitrate one dominant transient owner. This directly conflicts with frozen L0/donor rules:

```text
one dominant transient layer
Esc/outside close follows one overlay stack
contextual transient UI has one causal owner
```

Classification:

```text
OVERLAY DIALOG OWNERSHIP = WRONG_OWNER / MULTI_OWNER
SPATIAL OVERLAY PLACEMENT = STILL OPEN, SEPARATE
```

The owner problem must be fixed before free-space placement polish.

---

## 3. Next proposition

```text
A18 · Dialog Dominant Owner Arbitration
```

Scope:

- typed dialogs and complex `extraDialogs` become explicit candidates;
- one deterministic dominant dialog/modal renders at a time;
- lower parent state remains alive and may resume when child/blocking layer closes;
- blocking confirmations outrank child/surface/editor layers;
- no second global overlay store;
- no SpatialOverlayPlacement implementation in A18.

Phase A remains OPEN after A18 for spatial placement and real runtime/browser/human proof.
