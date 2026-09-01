# LCOS v0.15 · Night Shift Continuous Construction Plan
## ~46-round rolling execution ledger · Phase A closeout → B0/B → early Phase C

Date: 2026-09-01
Status: **CURRENT CONSTRUCTION PLAN / rolling ledger**
Baseline archive: `LCOS_v015_RC_A21_A22_A23_MERGED_70b9427_20260831.zip`
Repository metadata note: extracted archive has no trustworthy current `.git` HEAD; archive label + repo-local A23 closeout are implementation provenance. Root `SOURCE_COMMIT.txt` is historical PASS8 metadata and is NOT the A23-line authority.

---

# 0. Goal

During the user's upcoming continuous `请继续` rounds:

1. close Phase A honestly;
2. establish the minimum B0 foundations needed to prevent rework;
3. complete the highest-value Phase B shell/species migrations needed by Phase C;
4. enter Phase C and finish a meaningful first tranche, prioritizing Context/Workflow/Assembly production fidelity;
5. preserve strict SOP micro-patch discipline rather than accumulating a giant unreviewed branch.

This is a rolling budget, not a promise that one chat turn equals exactly one code patch.
A failed Human Smoke / donor-license gate / owner conflict can consume additional rounds.

---

# 1. Non-negotiable process per micro-patch

Every implementation patch:

```text
confirm current authority
→ FULL READ stage T1 / relevant latest L0
→ read relevant historical user reality feedback
→ read relevant donor source + license + implementation
→ Source-Diff Gate
→ current production owner census
→ define ONE product proposition
→ patch
→ static/unit
→ targeted runtime/browser/manual evidence when GUI touched
→ visual/donor conformance
→ old owner retirement
→ closeout
→ update Construction Context Index / Mandatory / donor/authority ledgers
→ STOP
```

Important:

> Do NOT produce a detailed implementation plan for a donor-dependent package before the donor source has been locally read/audited.

The night plan may name future packages, but each package's exact implementation is decided only after its own read gate.

---

# 2. Current baseline evidence

On the uploaded A23 RC the dedicated static gates were rerun on 2026-09-01:

```text
A18 12/12 PASS
A19 13/13 PASS
A20 15/15 PASS
A21 13/13 PASS
A22 19/19 PASS
A23 16/16 PASS
----------------
88/88 PASS
```

This proves source/static contracts only.
It does NOT close Browser/Human acceptance.

Current known open A product propositions:

```text
A24 Voice / ASR
Centered Spatial Index implementation
shared dynamic activeSpatialViewport geometry needed by navigation
A13–A23 Human/Browser horizontal smoke
fresh Phase A census
Phase A Closeout / Phase B Admission
```

---

# 3. Newly frozen dependency: activeSpatialViewport

Work View is a B0 feature, but A navigation cannot be implemented around a hard-coded browser center.

Therefore Phase A should establish a geometry owner that can later consume Work View without rewrites.

Target conceptual contract:

```text
SpatialViewportEnvironment {
  viewportRect
  staticInsets
  persistentOccupiedRects
  activeSpatialRect
  topCenterAnchor
  edgeBounds
}
```

Rules:
- no Camera mutation when persistent occupied rect changes;
- Centered Spatial Index anchors to `activeSpatialRect` center;
- Map Locator/edge navigation attaches to `activeSpatialRect` edge;
- Minimap/edge-scroll consume the same region;
- explicit Focus converts the edge-attached occupied region into fitting constraints;
- A20 SpatialOverlayPlacement consumes occupied rects from the same environment.

Do not build a second unrelated safe-area system.

---

# 4. Rolling round allocation

## Wave 0 · Authority repair / baseline lock
### Approx. rounds 1–3

### W0-1 · CURRENT TURN · Authority/plan update
Proposition:

> the latest Work View/HUD/direct-manipulation/Assembly/Skill≠Harness L0 becomes discoverable mandatory construction authority.

Deliver:
- latest L0 addendum;
- this rolling plan;
- Mandatory Context pointer/update;
- Construction Context Index pointer/update;
- explicit supersession mapping.

### W0-2 · Recoverable raw-source ledger repair
Before code:
- identify 8/21/8/26/8/29/8/30 raw docs that are now present in Context Library/File Library;
- stop calling recoverable sources `RAW_SOURCE_LOST`;
- update provenance ledger/manifest without rewriting originals.

### W0-3 · Fresh source/runtime census at A23 line
Audit:
- actual Voice seams;
- current Pin/Focus/Search owner;
- current `safeInsets`/Minimap/edge-scroll/overlay geometry ownership;
- current Browser/Human runnable environment.

Output:
- next exact A micro-patch sequence.

---

# 5. Wave A1 · A24 Voice
### Approx. rounds 4–10

Do not pre-commit exact library adoption until P0 donor full-read is complete.

Read gate:
- Unified Compact Composer/Voice Freeze;
- A23 Closeout;
- relevant P0 source: VAD + prompt/Composer donor if touched;
- XState source if selected as state-machine donor;
- current runtime/harness/execution truth.

Likely propositions, each separately gated:

```text
A24-1 Voice lifecycle/state owner
A24-2 microphone capture adapter
A24-3 transcription provider seam
A24-4 Composer in-place recording morphology
A24-5 editable transcript / explicit-send contract
A24-6 failure/cancel/permission paths
A24-7 cross-surface shared primitive smoke
```

Hard acceptance:

```text
stop recording != send
transcription != send
transcript = ordinary editable Composer text
Selection/Reference/Skill/params remain editable
no separate Voice panel
no second execution truth
```

---

# 6. Wave A2 · Centered Spatial Index + dynamic viewport geometry
### Approx. rounds 11–18

Read gate:
- Centered Spatial Index Freeze FULL;
- A20 overlay owner FULL;
- Navigation/Pin/Orbit Reality Feedback FULL;
- TapNow donor FULL;
- current Pin/Focus/Search/Minimap/navigation source FULL.

Recommended proposition order after source census:

```text
A-S1 shared SpatialViewportEnvironment / activeSpatialRect owner
A-S2 Top Spatial Index Slot arbitration
A-S3 Color Pin many-to-many projection + only-existing-colors
A-S4 Focus list retirement → occurrence spatial index
A-S5 Map Locator active-edge geometry / Fly-to handoff
A-S6 Search → Focus slot handoff integration
A-S7 Minimap / edge-scroll / overlay consume shared viewport environment
```

Important:
- Work View does not exist yet; test with synthetic persistent occupied rect fixture.
- when B0 Work View lands, it only registers its occupied rect; navigation should not be rewritten.

---

# 7. Wave A3 · Human Product Smoke + Phase A Closeout
### Approx. rounds 19–23

Targeted Human/Browser matrix:

```text
Main / Context / Workflow
Click
Shift multi-select
Marquee
Move / group move
Resize
Action Arc
Right-click
Relation
Pin
Reference
Composer
Semantic Drop
Focus
Esc/outside
```

Additionally:
- A18 dialog arbitration;
- A19 textarea-focus Esc/outside;
- A20 four corners / occupied UI / zoom / DPI visual placement;
- A21 Conversation canonical projection + current Context/Workflow Drop;
- A22 Arc+Composer / Component Locator / management-only right click;
- A23 bounded Composer / Reference chips;
- A24 Voice;
- Centered Spatial Index.

Then:

```text
fresh census
→ patch any newly found blocking WRONG_OWNER / REALITY_GAP one at a time
→ Phase A Closeout
→ explicit Phase B Admission
```

No Phase B admission from static gates alone.

---

# 8. Wave B0 · Mature Foundation / Unified Work View
### Approx. rounds 24–29

This wave begins only after Phase A admission.

## B0-0 Donor/license gate

Before implementation FULL READ locally:
- relevant P0/P1/P2/P3 donor source;
- candidate resize/docking primitive source;
- actual licenses;
- maintenance/adoption surface;
- current Base UI / Motion implementation.

Current locally known facts:
- Motion already installed and should remain primary system UI motion runtime;
- Base UI already owns popover/menu/dialog primitives;
- `react-resizable-panels` and `react-rnd` were not successfully fetched in current donor manifest;
- do NOT plan against a missing donor as if it were reviewed;
- ELK.js source license requires separate legal/adoption review and is not a default permissive vendoring path.

## B0-W1 Viewport Work Layer owner

One `ViewportWorkLayer` / `WorkViewHost`.
One active Work View in v0.15.
No tabs/floating/multi-dock system.

## B0-W2 Docked ↔ Immersive projection lifecycle

Same target/state/renderer.
No second Viewer truth.

## B0-W3 resizable edge work view

Work View registers occupied rect into `SpatialViewportEnvironment`.

Hard:

```text
resize Work View
→ HUD/edge geometry reflows
→ Camera unchanged
```

## B0-W4 session persistence across Surface switching

Main → Context → Workflow → Glyth subcanvas:
Work View remains.

---

# 9. Wave B · Object Species + Preview migration
### Approx. rounds 30–36

Read Phase B T1 FULL before the first B package.
Read V01 Lovart + V03 TapNow FULL.
Each species gets its own Source-Diff Gate.

Priority order chosen for C dependency reduction:

## B-P1 Preview shell migration

Retire current fixed-width `ImmersiveViewer` Drawer shell owner.
Move ArtifactViewerHost into Unified Work View.

Acceptance:
- Preview can shrink/grow;
- Docked→Immersive uses same projection;
- no fixed 56vw/82vw product owner;
- no fake non-interactive resize grip.

## B-P2 Text
- Geometry LOD;
- same-face reading/edit;
- sustained long work may promote into Work View.

## B-P3 Link + HTML/Web Artifact Host
- Compact/Rich/Live;
- local HTML and remote live preview share host grammar;
- Docked/Immersive same lifecycle.

## B-P4 File morphology / Preview Gate
- OS-like identity;
- real preview when supported;
- system-native fallback;
- unknown file remains a valid Project Object.

## B-P5 Glyth / Project species blockers only
Only if fresh census proves they block C/Human use.
Do not use B to redesign Glyth motion engine.

---

# 10. Wave C1 · Component Host + Camera + direct manipulation
### Approx. rounds 37–40

Before C code, FULL READ all Phase C T1 and relevant donor source.

First C proposition should retire generic shell ownership rather than immediately rewrite every renderer.

## C1-1 Surface Instrument Host

```text
SurfaceFrame
→ geometry/hit/move/resize owner only
visual body
→ species-owned
```

No permanent mini toolbar.
No generic compact bar.

## C1-2 Focus / Promote lifecycle

```text
Spatial Component
→ Focus = same-canvas reading framing
→ Keep Open / sustained work = Unified Work View
→ Immersive = same Work View larger
```

Default double-click must not jump to an independent fullscreen portal.

## C1-3 direct-manipulation contract

Define and validate:
- no permanent edit-mode button row;
- actual content branches/items are selectable/draggable/editable;
- transient popovers/actions only when needed;
- species-specific resize affordance.

---

# 11. Wave C2 · Context first tranche
### Approx. rounds 41–43

After donor/source read, choose the smallest useful order from actual source census.

Expected priority:

```text
Structure
→ Evolution
→ Relationship
→ Source/Provenance
```

But do NOT blindly implement all four from this plan.
Each one gets a separate donor-informed micro-plan.

Target product posture:
- Spatial morphology remains meaningful in Canvas;
- persistent/deep work uses Unified Work View;
- direct manipulation of real semantic content;
- no generic card/form/edit-mode owner;
- old ContextTree/Flow/Relationship page owner retires when corresponding production projection lands.

---

# 12. Wave C3 · Assembly + Workflow first tranche
### Approx. rounds 44–46

The exact split depends on remaining rounds and Human Smoke.
Priority is product-critical owner wiring, not Catalog breadth.

## Assembly

```text
eligible target Action Arc
→ Assembly
→ target already known
→ Docked Source Bay
→ optional Immersive expansion
```

Current live Canvas is Target Scene.
No target re-selection.
No permanent Canvas launcher.

## Workflow

Before GUI planning, FULL READ:
- Browser Harness/runtime truth;
- Run/Result/RunRecipe source;
- Skill Freeze;
- relevant donor implementations.

Mandatory separation:

```text
Skill Artifact / Skill Builder
≠
Harness Run / Result
```

Harness Run target:

```text
simple entry
→ existing Runtime/Harness
→ structured result returns
→ direct edit/review
→ Keep/Merge/Apply
```

Forbidden:
- FaaS builder;
- low-code DAG;
- MCP/CDP/provider setup forms;
- fixed button rows pretending to be workflow semantics.

If insufficient rounds remain after proper read gates, stop at a clean C closeout rather than rushing semantic UI.

---

# 13. Work View × edge systems acceptance matrix

Every B0/B/C Work View consumer must eventually test:

```text
Work View closed
Work View narrow
Work View ~half width
Work View wide
Immersive
```

At each state:
- Top Spatial Index centered in active spatial area;
- Pin/Focus/Search usable;
- offscreen Map Locator uses active edge;
- Minimap does not hide under Work View;
- edge-scroll wakes at active Canvas edge;
- Canvas cursor/drag does not leak through Work View;
- A20 contextual overlays avoid Work View;
- explicit Focus frames target in remaining active region;
- opening/resizing Work View does not mutate camera;
- Surface switch preserves Work View.

Zoom/DPI later inherits Phase D matrix.

---

# 14. Direct-manipulation acceptance for C instruments

For every Context/Workflow/Skill/Assembly instrument:

```text
Can I click the thing itself?
Can I drag/reorder the thing itself where semantics permit?
Can I edit the visible value directly where semantics permit?
Does a small transient control appear only when needed?
Is there a permanent toolbar/button row that merely gates editing? → FAIL unless intrinsic to the instrument.
Does the body still express its species/job at rest?
```

Dashboard principle:

> “Edit” is usually a state of the content itself, not a permanent button-defined mode.

---

# 15. Per-round cumulative task ledger

Each `请继续` response must update an internal/current ledger with:

```text
Current authority baseline
Current phase/wave
Last closed proposition
Open proposition
Read gate completed
Donor gate completed
Source-Diff classification
Files changed
Tests
Human/visual evidence
Old owner retired
Index updates
New debt
Exact next proposition
```

If context compresses:

```text
STOP coding
→ FULL READ T0 again
→ reload this plan + latest closeout
→ continue from ledger
```

---

# 16. Success target for the night

Best-case target:

```text
Phase A = formally closed
B0 Work View foundation = landed
critical Preview/Object migration = landed
Phase C = entered with Component Host/Focus + at least one or more real Context/Assembly/Workflow propositions landed
```

Not acceptable:

```text
46 rounds consumed
→ lots of docs/partial branches
→ no owner retirement
→ no Human evidence
```

Quality gate beats round count.

---

# 17. Current exact next action

After this authority/plan patch is reviewed:

```text
W0-2 Recoverable Raw Source Ledger Repair
```

Then W0-3 fresh A23-line source/runtime census.

Do not start A24 Voice implementation before those two process/context debts are closed.


---

# 17. Rolling progress update · 2026-09-01 W0-2

```text
W0-1 Latest L0 / Night Plan Indexing = PASS
W0-2 Recoverable Raw Source Ledger Repair = PASS
W0-3 Fresh source/runtime census at A23 line = NEXT
```

W0-2 recovered exact local mirrors for four 8/26–8/30 authorities and corrected LS-001 from a false current `RAW_SOURCE_LOST` claim to `RAW_SOURCE_RECOVERED_EXTERNAL / LOCAL_VENDOR_PENDING`. No File Library excerpt was fabricated into a local original.

---

# 18. Rolling progress update · 2026-09-01 W0-3

```text
W0-1 Latest L0 / Night Plan Indexing          = PASS
W0-2 Recoverable Raw Source Ledger Repair     = PASS
W0-3 Fresh A23-line Source / Runtime Census   = PASS
A24-1 Voice Lifecycle Owner                   = NEXT
```

W0-3 source facts:

```text
A13-A23 static contracts = 153/153 PASS
Voice/ASR                 = no production owner
Centered Spatial Index    = no production owner
Pin                        = binary navigation marker foundation
Focus                      = still has large-list fallback
Search                     = still modal/list
active spatial viewport    = fragmented across safeInsets / marker / minimap / focus / edge auto-pan
Browser runtime            = ENVIRONMENT_BLOCKED in current extracted source environment
```

Remaining A-stage package after Voice is formally:

```text
A25 Active Spatial Viewport / Centered Spatial Index
```

A24-1 scope fence:
- XState lifecycle + typed events only;
- no MediaRecorder yet;
- no STT provider yet;
- no waveform/Composer visual rewrite;
- explicit Send remains outside Voice auto-transition.

Voice donor result:
- XState 5.32.6 / @xstate/react 6.1.0 (MIT) = adopt candidate for transient lifecycle;
- @ricky0123/vad-web 0.0.30 (ISC) = defer until auto-stop/segmentation is justified.

---

# 19. Rolling progress update · 2026-09-01 A24-1

```text
W0-1 Latest L0 / Night Plan Indexing          = PASS
W0-2 Recoverable Raw Source Ledger Repair     = PASS
W0-3 Fresh A23-line Source / Runtime Census   = PASS
A24-1 Voice Lifecycle Owner                   = PASS
A24-2 Native Capture Adapter                  = NEXT
```

A24-1 landed one XState-owned transient lifecycle with explicit permission/capture/transcription error states and zero execution transitions.

The reviewed XState core `5.32.6` source is vendored repo-locally under MIT because registry installation is unavailable in the extracted RC environment. `@xstate/react`, VAD, capture, STT, waveform and Composer GUI remain deliberately outside this micro-patch.

---

# 20. Rolling progress update · 2026-09-01 A24-2

```text
W0-1 Latest L0 / Night Plan Indexing          = PASS
W0-2 Recoverable Raw Source Ledger Repair     = PASS
W0-3 Fresh A23-line Source / Runtime Census   = PASS
A24-1 Voice Lifecycle Owner                   = PASS
A24-2 Native Capture Adapter                  = PASS
A24-3 Transcription Provider Seam             = NEXT
```

A24-2 owns capture mechanics only: audio-only `getUserMedia`, MediaRecorder lifecycle, MIME fallback, typed capture errors, Blob/timing result, cancel/discard and deterministic track cleanup. It does not import the XState lifecycle, mutate Composer prompt text, render waveform UI, call STT, or execute a Run.

---

# 21. Rolling progress update · 2026-09-01 A24-3

```text
W0-1 Latest L0 / Night Plan Indexing           = PASS
W0-2 Recoverable Raw Source Ledger Repair      = PASS
W0-3 Fresh A23-line Source / Runtime Census    = PASS
A24-1 Voice Lifecycle Owner                    = PASS
A24-2 Native Capture Adapter                   = PASS
A24-3 Transcription Provider Seam              = PASS
A24-4 Transcription Transport                  = NEXT
```

A24-3 keeps ASR replaceable. Mature donor families were source-read (whisper.cpp / faster-whisper / sherpa-onnx), but no engine/model/runtime is allowed to become the canonical Voice contract. Local Core now owns only deterministic provider registration/selection, typed errors, and normalized transcript evidence.


---

# 22. Rolling progress update · 2026-09-01 A24-4

```text
W0-1 Latest L0 / Night Plan Indexing           = PASS
W0-2 Recoverable Raw Source Ledger Repair      = PASS
W0-3 Fresh A23-line Source / Runtime Census    = PASS
A24-1 Voice Lifecycle Owner                    = PASS
A24-2 Native Capture Adapter                   = PASS
A24-3 Transcription Provider Seam              = PASS
A24-4 Transcription Transport                  = PASS
A24-5 Concrete STT Provider                    = NEXT
```

A24-4 lands only transport mechanics: Web `FormData` → authenticated/bounded Local Core multipart route → provider-neutral A24-3 service → normalized transcript response. The default provider registry remains intentionally empty, so this package cannot pretend Voice is functional before a real mature STT backend is separately admitted.

The original Wave A1 list was explicitly a likely sequence. Fresh source/runtime census inserted provider seam + transport work before GUI morphology. The current rolling ledger supersedes that provisional numbering; product invariants remain unchanged.

---

# 23. Rolling progress update · 2026-09-01 A24-5

```text
W0-1 Latest L0 / Night Plan Indexing           = PASS
W0-2 Recoverable Raw Source Ledger Repair      = PASS
W0-3 Fresh A23-line Source / Runtime Census    = PASS
A24-1 Voice Lifecycle Owner                    = PASS
A24-2 Native Capture Adapter                   = PASS
A24-3 Transcription Provider Seam              = PASS
A24-4 Transcription Transport                  = PASS
A24-5 Concrete STT Provider                    = PASS
A24-6 Voice Orchestration                      = NEXT
```

A24-5 admits `whisper.cpp-cli` as the first concrete offline provider behind the provider-neutral seam. The adapter uses an external/local whisper binary + model, provider-local FFmpeg normalization and JSON output parsing. No model/binary is vendored or downloaded by Local Core, and real-model E2E remains open until packaging assets exist.

---

# 24. Rolling progress update · 2026-09-01 A24-6

```text
W0-1 Latest L0 / Night Plan Indexing           = PASS
W0-2 Recoverable Raw Source Ledger Repair      = PASS
W0-3 Fresh A23-line Source / Runtime Census    = PASS
A24-1 Voice Lifecycle Owner                    = PASS
A24-2 Native Capture Adapter                   = PASS
A24-3 Transcription Provider Seam              = PASS
A24-4 Transcription Transport                  = PASS
A24-5 Concrete STT Provider                    = PASS
A24-6 Voice Orchestration                      = PASS
A24-7 Composer Voice GUI                       = NEXT
```

A24-6 is the first package that wires the previously isolated Voice organs into one operation chain. It owns ordering, cancellation, retry and transcript handoff only. Transcript success ends in editable input evidence; explicit Unified Composer Send/Run remains separate and mandatory.

The runtime smoke covers permission-prompt cancellation with late cleanup, recording cancel, transcription abort, capture retry and same-capture STT retry. Browser/Human Voice acceptance remains open because no final Composer Voice morphology is mounted yet.

---

# 25. Rolling progress update · 2026-09-01 A24-7

```text
A24-1 Voice Lifecycle Owner                    = PASS
A24-2 Native Capture Adapter                   = PASS
A24-3 Transcription Provider Seam              = PASS
A24-4 Transcription Transport                  = PASS
A24-5 Concrete STT Provider                    = PASS
A24-6 Voice Orchestration                      = PASS
A24-7 Composer Voice GUI                       = SOURCE/STATIC PASS
A24-8 Voice Browser/Human Acceptance           = OPEN
A25 Active Spatial Viewport / Centered Index   = QUEUED
```

A24-7 lands the visible Voice modality inside the existing A23 Unified Compact Composer. Recording/Transcribing reuse the same shell and input footprint; no standalone Voice UI is created. Transcript success returns to ordinary editable prompt state and still requires explicit Send/Run. Historical A24 package gates were advanced only where later legal GUI progress would otherwise make a prior scope-fence test stale.

The original early night-plan A24-4…A24-7 labels are now historical planning only; the rolling A24-1…A24-8 closeouts above are the authoritative implementation sequence.


---

# 26. Rolling progress update · 2026-09-01 A24-8 / A25-1

```text
A24-1…A24-7 Voice source/static chain          = PASS
A24-8 Browser/Human Voice Acceptance           = ENVIRONMENT_BLOCKED / HUMAN OPEN
A25-1 Active Spatial Viewport Geometry Owner   = PASS
A25-2 Active Spatial Viewport Consumer Migration = NEXT
```

A24-8 was bounded: Chromium exists, but the extracted RC still has no `node_modules` and bounded dependency restoration did not complete. Real microphone / whisper model / Windows visual evidence remains explicitly open and must return before Phase A admission.

A25-1 establishes the pure screen-space geometry owner before any HUD/Work View consumer migration. It intentionally has no Camera mutation, DOM queries, Search/Pin state, or Work View implementation.


---

# 27. Rolling progress update · 2026-09-01 A25-2

```text
A24-1…A24-7 Voice source/static chain             = PASS
A24-8 Voice Browser/Human Acceptance              = ENVIRONMENT_BLOCKED / HUMAN OPEN
A25-1 Active Spatial Viewport Geometry Owner      = PASS
A25-2 Active Spatial Viewport Consumer Migration  = PASS
A25-3 Centered Spatial Index Presentation Owner   = NEXT
```

A25-2 migrates App safe-area compatibility, CanvasMiniMap, shared Focus fitting and Main drag edge auto-pan onto one Active Spatial Viewport environment. Current persistent edge chrome publishes a generic occupancy attribute; future Unified Work View must use the same contract.

The W0-3 A25 numbering was provisional. The rolling ledger inserts this migration package before Centered Spatial Index presentation because the fresh A25-1 geometry owner exposed multiple live consumers that otherwise would immediately diverge.

# 28. Rolling progress update · 2026-09-01 A25-3

```text
A24-1…A24-7 Voice source/static chain             = PASS
A24-8 Voice Browser/Human Acceptance              = ENVIRONMENT_BLOCKED / HUMAN OPEN
A25-1 Active Spatial Viewport Geometry Owner      = PASS
A25-2 Active Spatial Viewport Consumer Migration  = PASS
A25-3 Centered Spatial Index Presentation Owner   = PASS
A25-4 Focus Location Index Migration              = NEXT
```

A25-3 creates only the one-slot presentation/arbitration primitive. It uses the remaining active Canvas top-center, deterministic symmetric 1–7 marker geometry and `Search > Focus > Color Pin > none` priority. It does not yet move Search/Focus data into the slot and does not invent Color Pin truth.

The next package migrates Focus first because current `projectFocusLocations` truth and navigation callbacks already exist, while Search result retrieval and many-to-many Color Pin persistence require separate propositions.


# 29. Rolling progress update · 2026-09-01 A25-4

```text
A24-1…A24-7 Voice source/static chain             = PASS
A24-8 Voice Browser/Human Acceptance              = ENVIRONMENT_BLOCKED / HUMAN OPEN
A25-1 Active Spatial Viewport Geometry Owner      = PASS
A25-2 Active Spatial Viewport Consumer Migration  = PASS
A25-3 Centered Spatial Index Presentation Owner   = PASS
A25-4 Focus Location Index Migration              = PASS
A25-5 Search Result Index Migration               = NEXT
```

A25-4 reuses the existing `projectFocusLocations` / `navigateProjectFocus()` truth and retires both the large Focus navigator and single-object location Orbit as App primary presentations. More locations stay in a compact top-index overflow fan rather than reopening a fixed list.

Search and Color Pin remain separate propositions; Focus migration does not rewrite their state.


# 30. Rolling progress update · 2026-09-01 A25-5

```text
A24-1…A24-7 Voice source/static chain             = PASS
A24-8 Voice Browser/Human Acceptance              = ENVIRONMENT_BLOCKED / HUMAN OPEN
A25-1 Active Spatial Viewport Geometry Owner      = PASS
A25-2 Active Spatial Viewport Consumer Migration  = PASS
A25-3 Centered Spatial Index Presentation Owner   = PASS
A25-4 Focus Location Index Migration              = PASS
A25-5 Search Result Index Migration               = PASS
A25-6 Color Pin Truth + Index Migration            = NEXT
```

A25-5 keeps the existing Search retrieval stack and migrates only its normal presentation into the one top slot: compact input + readable labeled result constellation + compact overflow. Search-only ProjectTools modal/list presentation is retired from App.

Search activation remains transient and has priority over Focus visually; selecting a locatable result hands off to existing Focus truth, so Search yields and A25-4 Focus occurrence presentation takes over. Color Pin remains completely separate and no placeholder color marker is created.

# 31. Rolling progress update · 2026-09-01 A25-6

```text
A24-1…A24-7 Voice source/static chain             = PASS
A24-8 Voice Browser/Human Acceptance              = ENVIRONMENT_BLOCKED / HUMAN OPEN
A25-1 Active Spatial Viewport Geometry Owner      = PASS
A25-2 Active Spatial Viewport Consumer Migration  = PASS
A25-3 Centered Spatial Index Presentation Owner   = PASS
A25-4 Focus Location Index Migration              = PASS
A25-5 Search Result Index Migration               = PASS
A25-6 Color Pin Truth + Index Migration            = PASS
A25-7 Color Pin Authoring / Local Dots / Members  = NEXT
```

A25-6 establishes independent normalized Color Pin definition/membership truth, ChangeSet safety and persisted-only top-index groups. It deliberately does not masquerade the old binary Spatial Marker as Color Pin. The direct Action Arc `Pin` capability returns only when A25-7 can create real many-to-many memberships.


# 32. Rolling progress update · 2026-09-01 A25-7

```text
A24-1…A24-7 Voice source/static chain             = PASS
A24-8 Voice Browser/Human Acceptance              = ENVIRONMENT_BLOCKED / HUMAN OPEN
A25-1 Active Spatial Viewport Geometry Owner      = PASS
A25-2 Active Spatial Viewport Consumer Migration  = PASS
A25-3 Centered Spatial Index Presentation Owner   = PASS
A25-4 Focus Location Index Migration              = PASS
A25-5 Search Result Index Migration               = PASS
A25-6 Color Pin Truth + Index Migration            = PASS
A25-7 Color Pin Authoring / Local Dots / Members  = PASS
A25-8 Spatial Navigation runtime/fresh census     = NEXT
```

A25-7 restores `Pin` to the Action Arc only after canonical many-to-many truth exists. It adds no permanent node toolbar: local identity is persistent dots above the object; authoring is a compact transient layer; multi-member navigation stays a compact top-index popover and hands to existing Focus. Exact palette/material/motion remain Phase D.


# 33. Rolling progress update · 2026-09-01 A25-8

```text
A24-1…A24-7 Voice source/static chain             = PASS
A24-8 Voice Browser/Human Acceptance              = ENVIRONMENT_BLOCKED / HUMAN OPEN
A25-1…A25-7 Spatial Navigation packages           = PASS
A25-8 Spatial Navigation runtime/fresh census     = PACKAGE PASS
A25 source/static construction                    = CLOSED
Phase A Human Product Smoke / Admission           = NEXT · ENVIRONMENT/HUMAN GATE
```

Fresh A25-8 census found two live A25-2 migration gaps: Map Locator/Spatial Marker still projected against the full physical Canvas viewport, and the embedded shared SpatialCanvas minimap still used physical viewport Camera bounds/center plus an active WorkRail-specific CSS exception. A25-8 migrates both onto Surface-local Active Spatial Viewport geometry and retires the active WorkRail-specific minimap hack.

No additional canonical-owner/source geometry blocker remains in the A25 navigation chain. This does **not** grant Phase A admission: Wave A3 explicitly requires real Browser/Human Product Smoke, including A24 Voice and A25 navigation at real zoom/DPI. The current extracted environment remains unable to run that browser suite because web dependencies are unavailable. B0 implementation remains gated until explicit Phase A admission.

# 34. Rolling progress update · 2026-09-01 Phase A Human Product Smoke Pack

```text
A24-1…A24-7 Voice source/static chain             = PASS
A24-8 Voice real-runtime/Human                     = OPEN
A25-1…A25-8 Spatial Navigation source/static       = PASS / CLOSED
Phase A admission harness                          = PACKAGE PASS / READY
current extracted Browser/App environment          = BLOCKED
Phase A Admission                                  = NOT GRANTED
B0 Unified Work View                               = GATED
```

The admission gate is now executable rather than prose-only. `npm run preflight:phase-a -- --strict` checks whether an environment actually has the App/browser dependencies and real Whisper assets; `npm run test:e2e:phase-a` runs the dedicated real-App structural smoke at DPR 1.0/1.25/1.5 and emits zoom/occupied-region screenshots.

The current extracted environment still cannot produce Browser/Human evidence. It lacks `node_modules` / a prebuilt Web bundle / real Whisper assets, npm restoration previously failed with `EAI_AGAIN`, and the host Chromium navigation policy blocks local/virtual/file navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`.

Automated fake-media Voice coverage is explicitly structural and MUST NOT replace physical microphone + real whisper.cpp evidence. Windows 125% / 150% display-scale human review also remains open.

Therefore the original Wave A3 rule remains unchanged: **no Phase B admission from static gates alone**. Do not start B0 until an explicit Phase A Closeout / Phase B Admission artifact exists.
