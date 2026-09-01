# LCOS v0.15 · Phase A Human Product Smoke / Admission Pack Closeout

Date: 2026-09-01
Status: **HARNESS PACKAGE PASS · CURRENT ENVIRONMENT BLOCKED · PHASE A ADMISSION NOT GRANTED**
Baseline: exact A25-8 delivery tree (`56ae3e1`)

## Proposition

Turn the frozen Phase A Human Product Smoke requirement into a repeatable executable admission package without reopening Phase A product semantics or starting B0.

This package owns acceptance infrastructure only:

```text
environment preflight
→ real-App automated structural smoke
→ visual evidence capture
→ Windows / real-device operator runbook
→ explicit admission decision
```

It does not change Voice, Search, Focus, Color Pin, Map Locator, Camera or Work View canonical product owners.

## Delivered acceptance infrastructure

### Environment preflight

`scripts/phase-a-admission-preflight.mjs`

Checks whether the machine can honestly produce automated App evidence and real Voice evidence, including:

- installed workspace dependencies;
- Playwright / Vite / React availability;
- Chromium / Chrome / Edge executable availability;
- optional prebuilt Web artifact;
- `LCOS_WHISPER_CPP_BIN`;
- `LCOS_WHISPER_CPP_MODEL`;
- FFmpeg availability.

`--strict` fails until both the real-App browser chain and real Voice provider prerequisites exist.

### Automated real-App admission spec

`tests/e2e/v015-phase-a-admission.spec.ts`

`playwright.phase-a.config.ts`

The spec covers:

- Search owns the single Top Spatial Index slot;
- Search result → Focus owner handoff;
- retired large Focus presentation stays retired;
- Color Pin authoring writes canonical membership;
- object-local Color Pin dots project persisted truth;
- one-member Color Pin hands to Focus;
- Voice Recording / Transcribing / Editable morphology with no automatic Send;
- occupied right-edge UI shifts HUD safe center without moving Camera;
- Canvas zoom evidence at 25 / 35 / 60 / 100 / 150%;
- automated DPR sanity at 1.0 / 1.25 / 1.5.

The automated Voice fixture uses fake media and mocked transcription deliberately. It proves browser presentation/orchestration structure only.

```text
fake-media automated Voice smoke
≠ physical microphone evidence
≠ real whisper.cpp inference
≠ Human Voice acceptance
```

### Human / real-device runbook

`docs/v015/convergence/PHASE_A_HUMAN_PRODUCT_SMOKE_RUNBOOK_20260901.md`

Requires Windows target evidence for:

- real microphone Allow / Deny / Start / Stop / Cancel;
- real whisper.cpp configured model inference;
- editable transcript then explicit manual Send;
- Windows 125% / 150% display scaling;
- Canvas 25 / 35 / 60 / 100 / 150% zoom handfeel;
- Main / Context / Workflow interaction parity;
- Search / Focus / Color Pin / Map Locator under occupied viewport geometry;
- Action Arc / Composer / Pin layered Esc and outside behavior.

## Current-host reality

Fresh preflight/probes on the extracted construction host show:

```text
node_modules                         = absent
prebuilt Web bundle                  = absent
@playwright/test / vite / react      = unresolved
Chromium                             = present
FFmpeg                               = present
LCOS_WHISPER_CPP_BIN                 = unset
LCOS_WHISPER_CPP_MODEL               = unset
```

Dependency restoration previously failed with npm `EAI_AGAIN` and local cache is insufficient.

The installed Python Playwright can launch Chromium, but host policy blocks App-capable navigation:

```text
http://127.0.0.1/... → ERR_BLOCKED_BY_ADMINISTRATOR
virtual https://...  → ERR_BLOCKED_BY_ADMINISTRATOR
file://...           → ERR_BLOCKED_BY_ADMINISTRATOR
```

`about:blank` can execute script but is not a secure context and exposes no `navigator.mediaDevices`.

Therefore this host cannot honestly produce real-App Browser or real-microphone evidence.

## Package validation before cold replay

```text
Phase A Human Smoke Pack dedicated validator = 26/26 PASS
Playwright config TypeScript syntax           = PASS
Admission spec TypeScript syntax              = PASS
preflight blocked-state classification        = PASS
A13 → A25-8 historical cumulative             = 563/563 PASS
W0-3                                           = 30/30 PASS
W0-2                                           = 17/17 PASS
SOP-R1                                         = 8/8 PASS
R3.1A6                                         = 10/10 PASS
F6A                                            = 7/7 PASS
```

The Focus-close assertion was hardened to accept the correct owner-none behavior where the Top Spatial Index unmounts entirely rather than requiring a mounted element with a non-Focus attribute.

## Final cold replay

The final package bytes were cold-applied to the exact A25-8 delivery baseline (`56ae3e1`):

```text
git apply --check                         = PASS
git apply                                 = PASS
git diff --check                          = PASS
Phase A Human Smoke Pack validator         = 26/26 PASS
preflight blocked-state classification     = PASS
Playwright config TypeScript syntax        = PASS
Admission spec TypeScript syntax           = PASS
A13 → A25-8 cumulative                     = 563/563 PASS
W0-3                                       = 30/30 PASS
W0-2                                       = 17/17 PASS
SOP-R1                                     = 8/8 PASS
R3.1A6                                     = 10/10 PASS
F6A                                        = 7/7 PASS
```

The cold tree still reports `phaseAAdmissionReady = false`, which is the correct result for this host. Passing the harness package proves that the admission mechanism is replayable; it does not manufacture the missing Browser/Human evidence.

## Admission decision

Even after this harness package passes, the product decision remains:

```text
Phase A automated/source construction = PASS / CLOSED
Phase A admission harness             = READY
Phase A real Browser/Human evidence   = OPEN / CURRENT HOST BLOCKED
Phase A Admission                     = NOT GRANTED
B0 Unified Work View                  = GATED
```

No Phase B implementation may start under the current night-plan authority until an eligible environment runs the real-App automated smoke and the required Windows / real Voice human matrix, followed by an explicit Phase A Closeout / Phase B Admission artifact.
