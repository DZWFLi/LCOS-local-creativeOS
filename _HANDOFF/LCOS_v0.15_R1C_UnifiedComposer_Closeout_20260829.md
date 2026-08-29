# LCOS v0.15 · R1-C Unified Composer 真统一 · Closeout · 2026-08-29

## 0. Baseline

- supplied RC: `7f0690d`
- R1-B Human Language Gate patch applied first and treated as immutable baseline
- this patch is **R1-C incremental only**

## 1. Product question closed

R1-C closes one question:

> Can Main / Context / Workflow / Conversation / Assembly participate in one command state without turning Selection, Reference, Receiver, Relation or durable Conversation mapping into the same thing?

Answer in this patch: **yes, at the command-state / proposal / run seam.**

The shared state is now:

```text
Surface
+ Selection
+ Receiver
+ Reference Set
+ Prompt
+ Provider / Intent / Result Policy
```

Selection and Reference remain distinct UI truths. They are merged only into a deterministic ordered execution foreground immediately before Proposal / Run.

## 2. What changed

### 2.1 Shared Command State replaces per-Surface local memories

Added `SharedComposerCommandState`.

- Main owns the project-level command state.
- Context / Workflow consume the same state instead of local `surfacePrompt / surfaceReceiverId / surfaceReferenceIds / ...` stores.
- Conversation Subcanvas consumes the same Project nodes + Reference Set.
- Conversation timeline messages remain non-Project entities and cannot be forged into Run References.
- entering a linked Conversation writes its canonical ConnectedConversation into the shared Receiver; unlinked Conversation explicitly clears Receiver instead of falling back to Project Active Receiver.

### 2.2 Selection != Reference

Opening Main composer no longer copies `selectedIds` into `selectionReferenceIds`.

Execution uses:

```text
mergeExecutionReferenceIds(Selection, Reference Set, optional edit target)
```

Rules:

- edit target is excluded from ordered references;
- Selection participates as foreground context;
- explicit Reference Set preserves its own order;
- duplicate IDs collapse deterministically;
- ResultSlot is never a Reference.

Composer copy now exposes `当前选择` and `额外参考` separately.

### 2.3 Proposal -> Run uses the same identity contract

The Core had already landed `receiverRef / orderedReferences / resultSlotId` on `CreateRunProposal`, but Web still treated the seam as unavailable.

R1-C consumes the real contract:

- `LocalCoreClient.proposeRun` now exposes all three fields;
- Main and Surface proposal calls send them;
- proposal output is used as the authoritative envelope handed to Run;
- stale frontend blockers requiring Project Active Receiver or artifact-only references are removed;
- stale ResultSlot proposal blocker is removed;
- explicit Agent `validate-plan` path now preserves the same fields too;
- proposal human summary counts `orderedReferences` when present instead of undercounting heterogeneous references.

### 2.4 CommandDraft becomes a real shared command draft

Metadata schema advances **48 -> 49**.

`CommandDraftV1` now persists:

- `surfaceKind / surfaceId`
- `selectionViewIds`
- ordered explicit refs in the existing `contextViewIds` storage field (legacy wire/storage name retained)
- `receiverId`
- `prompt`
- `provider`
- `intent`
- `resultPolicy`

A blank prompt no longer deletes the draft when Selection / Reference Set / Receiver still contains meaningful command state.

### 2.5 Assembly Project Warehouse joins the same Reference Set

The latest Assembly synchronized-space decision is consumed without creating another attachment store.

For the active Project target:

- canonical Warehouse objects that can resolve to a supported existing Project node expose a hover `这次参考` affordance;
- the affordance toggles the exact same project-level Reference Set used by Canvas / Context / Workflow / Conversation Composer;
- unsupported Note / Resource identities remain fail-closed until their canonical reference contract is closed;
- cross-project targets never write into the current Project Reference Set.

This is only the R1-C state bridge. Dedicated Workspace / Docked Source Bay / Quick Tray morphology remains R3-D / GUI Visual Pass work.

## 3. Static gates updated to the new truth

Older F6B static scripts encoded superseded assumptions such as:

- Surface Reference Pick must be local-only;
- Conversation must render `nodes=[] / referenceIds=[]`;
- ResultSlot must fail closed at Proposal;
- mixed refs / non-active Receiver must remain blocked.

Those gates were updated to test the current canonical contract rather than forcing a regression.

Current results:

```text
R1-C Unified Command State            12/12 PASS
Unified Composer F6B                  13/13 PASS
Cross-Surface Unified Execution F6B    8/8 PASS
Conversation Subcanvas F6B            12/12 PASS
ResultSlot F6B                         12/12 PASS
Spatial Component Foundation          22/22 PASS
v0.15 User Language Gate              PASS (229 product-surface files)
CRLF-aware git diff --check            PASS
Modified TS/TSX transpile diagnostics  21/21 PASS
```

`npm ci --ignore-scripts --no-audit --no-fund --prefer-offline` timed out in this sandbox and left no `node_modules`, therefore full dependency-backed `lint / typecheck / test / build` is **not claimed** here.

A direct Contracts `tsc --noEmit` attempt reached the project tests but cannot resolve `vitest` because dependencies are absent; this is environment-limited, not counted as a pass.

## 4. Baseline-equal unrelated static debt

`validate-v015-assembly-source-bay-f6a2.mjs` remains **9/10** on both the untouched R1-B baseline and this R1-C patch because its existing `Sources does not fake provider-native data` string check is already stale. R1-C does not alter the Sources provider contract, so this is not silently rewritten here.

## 5. R1-C status

**Code-complete + R1-C/F6B static-gate complete.**

Dependency-backed integration validation remains pending in an environment with workspace dependencies.

## 6. Next official micro-patch

`R1-D · Preview / Fragment Entry + fallback`

Carry-forward that must not disappear:

- PDF / PPT / Text fragment Golden
- page / slide / section locator survives reload
- `Preview -> native open / reveal / relink` fallback chain
- unsupported formats stay usable without inventing fake renderers
- DOCX/XLSX true renderer remains non-blocking for 0.15 unless a newer freeze overrides it

R2 Pointer / Reference Pick cursor grammar and R3-D Docked Assembly / Quick Tray are deliberately not pulled into R1-C.
