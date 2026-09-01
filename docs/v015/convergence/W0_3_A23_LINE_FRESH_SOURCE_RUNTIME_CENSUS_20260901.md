# LCOS v0.15 · W0-3 A23-line Fresh Source / Runtime Census

Date: 2026-09-01
Status: **FRESH CENSUS / IMPLEMENTATION EVIDENCE / NEXT-A INPUT**
Baseline: `LCOS_v015_RC_A21_A22_A23_MERGED_70b9427_20260831.zip` + W0-1 + W0-2 doc/context overlays

---

# 0. Verdict

Fresh source census confirms:

```text
A23 Compact Composer implementation = PRESENT / source-static closed
A24 Voice/ASR implementation          = ABSENT
Centered Spatial Index                = PRODUCT FROZEN / implementation absent
Current Pin                           = durable binary Spatial Navigation Marker, NOT frozen many-to-many Color Pin
Current Focus                         = object-local location Orbit + fallback large ProjectFocusNavigator list
Current Search                        = modal ProjectToolsDialog / Search Lens list, NOT top-center spatial index
Current spatial usable-region truth   = SPLIT across several owners
Browser/Human runtime                 = ENVIRONMENT_BLOCKED in this source-only container
Phase A                               = OPEN
```

This census does not change Product Truth. It maps current production reality against the latest L0 and freezes the exact next micro-patch order.

---

# 1. Source/static baseline re-run

Dedicated source/static validators re-run on the current W0-2 worktree:

```text
A13  12/12
A14  10/10
A15  12/12
A16  16/16
A17  15/15
A18  12/12
A19  13/13
A20  15/15
A21  13/13
A22  19/19
A23  16/16
------------
TOTAL 153/153 PASS

W0-2 recovery gate 17/17 PASS
SOP-R1 gate         8/8 PASS
```

Meaning:

> Existing A13-A23 source/static contracts remain intact after W0-1/W0-2. This is not Browser/Human acceptance.

---

# 2. A24 Voice · current production reality

Source search across `apps/`, `packages/`, `src/`, `tests/`, `scripts/` finds no production:

```text
MediaRecorder
navigator.mediaDevices.getUserMedia voice capture owner
SpeechRecognition production adapter
ASR route
STT route
transcription provider
waveform recording state
```

The only current Voice-related truth is negative evidence:

```text
apps/local-core/src/search-format-coverage.ts
.mp3/.wav/.m4a
→ No speech/audio transcription extractor is registered.
```

A23 validator explicitly guards against smuggling Voice into the compact-shell proposition.

Classification:

```text
A24 Voice = IMPLEMENTATION_GAP
```

No old Voice GUI owner needs migration. This is a clean new shared primitive.

---

# 3. A24 donor gate · local source read

## 3.1 XState

Recovered local donor:

```text
P3_INTERACTION_MOTION/sources/xstate
xstate 5.32.6
@xstate/react 6.1.0
MIT
```

Relevant mature mechanics:

```text
setup().createMachine()
fromPromise()
invoked async actor
onDone / onError
retry/failure states
useMachine()
```

Adoption verdict:

```text
ADOPT for Voice transient lifecycle only
DO NOT rewrite LCOS canonical runtime/store around XState
```

A24 lifecycle is a strong fit:

```text
idle
→ requestingPermission
→ recording
→ transcribing
→ editable

error branches:
permissionDenied
captureError
transcriptionError
cancelled
```

`Explicit Send` remains Composer execution truth, not a Voice machine auto-transition.

## 3.2 @ricky0123/vad-web

Recovered local donor:

```text
@ricky0123/vad-web 0.0.30
ISC
onnxruntime-web dependency
Silero VAD model
AudioWorklet/ScriptProcessor
MicVAD
getUserMedia
onSpeechStart / onSpeechEnd
```

The package is mature but operationally heavier:
- ONNX Runtime Web;
- `.wasm` / `.mjs` runtime assets;
- Silero `.onnx` model assets;
- `vad.worklet.bundle.min.js`;
- Vite asset-path/build handling.

Adoption verdict for v0.15:

```text
DEFER as optional A24 enhancement
NOT the first Voice proposition
```

Use later only if auto-stop / speech segmentation materially improves the product.

The first usable capture path should remain native manual Start/Stop.

---

# 4. Exact A24 construction order after W0-3

Formal next sequence:

## A24-1 · Voice Lifecycle Owner

```text
XState transient machine
+ typed Voice state/event contract
+ no capture yet
+ no GUI redesign yet
```

Acceptance:
- one lifecycle owner;
- no bool soup in Composer;
- cancel/error transitions explicit;
- state machine cannot auto-Send.

## A24-2 · Native Capture Adapter

```text
MediaRecorder
+ getUserMedia
+ start/stop/cancel
+ stream/track cleanup
+ Blob/audio metadata
```

No VAD dependency required.

## A24-3 · Transcription Provider Seam

Before implementation:
- research current supported STT providers/protocols;
- prefer provider-neutral local-core contract;
- secrets remain in Core;
- browser does not call provider keys directly.

Then:

```text
Audio Blob / PCM
→ Local Core transcription request
→ provider adapter
→ transcript text
```

## A24-4 · Compact Composer Recording Morph

Same local Composer region:
- width stable;
- mic → stop/cancel state;
- short waveform/activity display;
- unrelated footer controls yield;
- no giant overlay/panel.

## A24-5 · Editable Transcript / Explicit Send

```text
transcript
→ ordinary Composer textarea text
→ editable
→ references/skill/model/params remain editable
→ explicit Send/Run only
```

## A24-6 · Failure / Permission / Retry

Human/runtime cases:
- permission denied;
- no device;
- recorder error;
- repeated start/stop;
- transcription failure/timeout;
- retry;
- cancel never sends.

## A24-7 · Shared Primitive Parity

Where product mode exists, verify one primitive across:
- Main object Work;
- Glyth Speak;
- Context/Workflow local Composer;
- Assembly instruction adapter later.

Phase A still does not close here; A25 + Human Smoke remain.

---

# 5. Centered Spatial Index · current production reality

The Product Freeze exists:

`CENTERED_SPATIAL_INDEX_SEARCH_ASSEMBLY_FREEZE_20260831.md`

Production source contains no `CenteredSpatialIndex` / Top Spatial Index Slot implementation.

Classification:

```text
Centered Spatial Index = IMPLEMENTATION_GAP
```

---

# 6. Current Pin is not the frozen Color Pin

Current canonical contract:

`packages/contracts/src/navigation-marker.ts`

`SpatialMarkerIntentV0` stores:
- id;
- projectId;
- targetRef;
- local/cross-surface scope;
- optional sourceSurfaceRef;
- timestamps.

It does NOT store:
- color identity;
- user label;
- multiple category relationships;
- Color Pin group semantics.

Current `ProjectObjectOrbit` exposes one binary toggle:

```text
Pin
↔ Cancel Pin
```

`markerForNavigationTarget()` returns the first marker for a target.

This is a valid durable navigation-marker foundation, but it is not the latest frozen Color Pin truth:

```text
Color Pin = many-to-many user-authored index relationship
```

Classification:

```text
SpatialMarker persistence/runtime = KEEP / REUSE
Color Pin semantic layer           = IMPLEMENTATION_GAP
```

Do not delete the mature marker resolver/projection stack merely because Color Pin is richer.

---

# 7. Current Focus is still split between two presentations

Current source:

```text
ArtifactLocationOrbit
→ single known object, small object-local location Orbit

ProjectFocusNavigator
→ fallback large list / aside
```

`ProjectFocusNavigator` remains mounted through `DialogsHost` as a child dialog candidate.

The latest freeze explicitly says:

```text
Retire current large Focus result list as primary presentation.
Focus → Centered Spatial Index occurrence markers.
```

Classification:

```text
Focus canonical location resolver = KEEP
Focus large-list primary GUI      = WRONG_OWNER / RETIRE
Centered occurrence index         = IMPLEMENTATION_GAP
```

---

# 8. Current Search is still a modal/list Lens

Current source:

```text
Cmd/Ctrl+F
→ setProjectToolsMode('search')
→ ProjectToolsDialog(searchOnly)
→ ProjectSearchLens
→ modal/list result presentation
```

This preserves the correct mental model (`Search != Focus`) but violates the newest GUI freeze:

```text
compact top-center Search input
→ center-balanced compact result markers
→ Search → Focus handoff
```

Classification:

```text
Search retrieval/backend       = KEEP
Search result identity logic   = KEEP/ADAPT
modal/list primary shell       = WRONG_OWNER / RETIRE
Top Spatial Index Search GUI   = IMPLEMENTATION_GAP
```

---

# 9. Spatial usable-region ownership is currently fragmented

This is the most important geometry finding for the latest Work View L0.

There is no single `activeSpatialViewport` / usable-region owner in production.

## 9.1 App `safeInsets`

Current `App.tsx` computes static layout-mode insets:

```text
desktop-ish:
left 76 / right 28 / top 24 / bottom 72

sidecar:
18 / 18 / 46 / 60
```

They do not dynamically include a future Work View occupied rect.

## 9.2 Main Minimap

`CanvasMiniMap` consumes `safeInsets` for:
- viewport center;
- fit content;
- camera safe viewport bounds.

This is useful existing infrastructure.

## 9.3 Shared SpatialCanvas Minimap

The generic Context/Workflow `SpatialMiniMap` computes viewport directly from the full `viewportSize` and does not consume `safeInsets`.

Classification:

```text
three-Surface geometry parity gap
```

## 9.4 Spatial Marker / edge cursor

`SpatialMarkerLayer → projectSpatialMarkers → edgePinForWorldBounds` uses:

```text
full viewportSize
viewport center = width/2, height/2
edge inset = 18px
```

No safe/occupied rect is consumed.

Therefore a future right Docked Work View would cause:
- markers to attach under the Work View;
- directional center/angle to be based on the wrong visual center;
- clustering to use an occluded edge.

Classification:

```text
WRONG_GEOMETRY_OWNER for latest L0
```

## 9.5 Focus camera animation

`useSpatialFocusRequest` uses:

```text
fitSpatialBounds(bounds, width, height, padding)
```

without insets.

Main App has several separate `fitBounds*` calls that do pass `safeInsets`.

Classification:

```text
Focus framing geometry split
```

## 9.6 Drag edge auto-pan

`ProjectCanvas.autoPanBounds()` performs its own DOM queries:

```text
workspace-dock
work-rail
```

then derives left/right active edge ad hoc.

It does not use `safeInsets` or a shared region contract.

Context/Workflow shared `SpatialCanvas` does not expose this exact Main auto-pan owner.

Classification:

```text
duplicate geometry owner + three-Surface parity gap
```

## 9.7 Overlay placement

A20 `SpatialOverlayPlacement` is the most mature reusable geometry contract:

```text
targetBounds
+ overlaySize
+ viewport
+ safeInsets
+ occupiedRects
+ preferredSide
```

`spatialOverlayEnvironment` already measures Dock/Rail/Minimap and transient occupied rects from DOM.

This should remain the contextual-overlay owner, but its environment should consume the same future active viewport registry rather than becoming the global geometry owner itself.

---

# 10. Legacy WorkRail conflict confirmed

Current App still contains:

```text
shellWorkingCenter()
useLayoutEffect()
rail width / layout mode change
→ mutate camera x/y
```

This was valid for the older Rail model.

Latest L0 now freezes:

```text
Unified Work View open/resize
→ NO automatic Camera mutation
```

Classification:

```text
legacy WorkRail behavior = SUPERSEDED for future Unified Work View
```

Do not mechanically delete it during A25. B0 Work View migration owns retirement.

---

# 11. Formalize A25 · Active Spatial Viewport + Centered Spatial Index

A24 numbering is already frozen for Voice. W0-3 therefore formally names the remaining A-stage navigation package:

# `A25 · Active Spatial Viewport / Centered Spatial Index`

Exact micro-patch order:

## A25-1 · Active Spatial Viewport Geometry Owner

Introduce one shared, screen-space contract representing the usable spatial region:

```text
viewport rect
- persistent occupied regions
- safe gutters
= activeSpatialViewport
```

Initial consumers/adapters:
- Main `safeInsets`;
- Context/Workflow shared SpatialCanvas;
- explicit Focus framing;
- marker projection;
- Minimap;
- edge auto-pan;
- A20 overlay environment bridge.

Hard rule:

> registering/resizing an occupied region does not mutate Camera.

Camera changes only from explicit spatial navigation / pan / zoom.

## A25-2 · Centered Spatial Index Presentation Owner

Build:
- one Top Spatial Index Slot;
- `Search > Focus > Color Pin > none` arbitration;
- deterministic quantity-centered layout;
- active viewport visual center, not physical browser center;
- no canonical truth in this component.

## A25-3 · Focus Migration

Reuse current location resolver.

Retire primary `ProjectFocusNavigator` list in favor of:
- occurrence markers in top index;
- offscreen Map Locator/marker handoff;
- compact overflow/fan only.

Accessibility fallback may retain a list only as a non-primary mode.

## A25-4 · Search Migration

Reuse current retrieval/backend and result identity logic.

Retire modal Search list as primary shell:
- compact top-center input;
- top 5–7 center-balanced results;
- overflow compact field;
- Search → Focus handoff.

## A25-5 · Color Pin Canonical Semantic Extension

Extend, do not replace, current Spatial Marker persistence.

Required truth:

```text
one target ↔ many Color Pin relationships
one color/group ↔ many targets
optional user label
```

Exact schema/contract must remain Project canonical and reversible through mutation safety.

Do not store screen coordinates/clusters.

## A25-6 · Color Pin Local + Top Index Projection

- node-local persistent color dots;
- top-center only colors that actually exist;
- member compact popover;
- no permanent empty palette;
- no Action Arc collision.

## A25-7 · Marker / Locator / Minimap / Edge Geometry Convergence

Make all screen-edge consumers read `activeSpatialViewport`:
- SpatialMarkerLayer / edge cursor;
- Map Locator;
- Main + shared Spatial MiniMap;
- drag edge auto-pan;
- top centered index;
- explicit Focus;
- contextual overlays through A20 bridge.

## A25-8 · Cross-Surface Runtime/Human Smoke

Main / Context / Workflow:
- pin/index remains usable;
- Focus occurrence navigation;
- Search handoff;
- Minimap placement;
- edge drag/auto-pan;
- zoom;
- no geometry owner divergence.

Then Phase A global Human Smoke may begin.

---

# 12. Browser / Human environment census

Current source bundle contains:
- Playwright config and E2E source;
- Chromium binary exists in the container;
- relevant E2E specs exist for Composer/Relation/Minimap/Orbit/right-click.

But this extracted RC contains no `node_modules`.

Runtime resolution check:

```text
playwright        MISSING as Node package
@playwright/test  MISSING
vitest            MISSING
react             MISSING
vite              MISSING
npm cache         EMPTY
```

A bounded `npm ci --ignore-scripts --no-audit --no-fund` recovery attempt timed out without producing `node_modules`.

Classification:

```text
Browser/Vitest/Typecheck in this container = ENVIRONMENT_BLOCKED
```

Therefore:
- source/static validators may run and are reported honestly;
- Browser/Human remains OPEN;
- no phase admission may use this container's missing runtime as a PASS.

When the real dependency-complete Windows/RC environment is available, run the existing targeted browser contracts plus the new A24/A25 runtime specs before Phase A closeout.

---

# 13. Current Phase A debt after W0-3

```text
A13-A23 source/static         = GREEN
A13-A23 Browser/Human         = OPEN
A24 Voice                     = IMPLEMENTATION_GAP
A25 ActiveViewport/SpatialIdx = IMPLEMENTATION_GAP
Phase A fresh Human census    = OPEN
Phase A closeout              = NOT ADMITTED
Phase B                       = NOT ADMITTED
```

---

# 14. Exact rolling pointer

```text
W0-1 = PASS
W0-2 = PASS
W0-3 = PASS after dedicated gate

NEXT = A24-1 Voice Lifecycle Owner
```

A24-1 must FULL READ:
- Unified Compact Composer/Voice Freeze;
- A23 Closeout;
- this W0-3 census;
- XState local donor source/license/API;
- current UnifiedExecutionComposer source;
- current execution/send owner.

No capture/STT/GUI expansion is allowed to be bundled into A24-1.
