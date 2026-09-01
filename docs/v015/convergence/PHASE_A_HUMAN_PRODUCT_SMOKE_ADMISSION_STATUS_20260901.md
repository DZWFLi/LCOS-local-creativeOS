# LCOS v0.15 · Phase A Human Product Smoke / Admission Status

Date: 2026-09-01
Status: **ADMISSION HARNESS READY · CURRENT CONSTRUCTION ENVIRONMENT BLOCKED · PHASE A ADMISSION = NOT GRANTED**

## Proposition

Turn the Night Shift Wave A3 requirement into executable admission evidence without reopening Phase A product semantics.

This package adds acceptance infrastructure only:

```text
preflight
→ real-App Playwright smoke
→ visual evidence attachments
→ Windows real-microphone / real-whisper human smoke
→ explicit admission decision
```

It does **not** implement B0 and does not change Search / Focus / Color Pin / Voice canonical owners.

Classification:

```text
IMPLEMENTATION_GAP = Phase A admission had no dedicated executable harness
REALITY_GAP        = current extracted environment cannot run the real App/browser chain
```

## Current construction-environment facts

A fresh probe on the A25-8 delivery tree confirms:

```text
node_modules                         = ABSENT
apps/web/dist / prebuilt web bundle = ABSENT
@playwright/test                     = UNRESOLVED
vite                                 = UNRESOLVED
react / react-dom                    = UNRESOLVED
Chromium binary                      = PRESENT (/usr/bin/chromium)
ffmpeg                               = PRESENT (/usr/bin/ffmpeg)
LCOS_WHISPER_CPP_BIN                 = UNSET
LCOS_WHISPER_CPP_MODEL               = UNSET
```

The earlier bounded dependency probe failed with npm `EAI_AGAIN`; the local npm cache is not sufficient to restore the workspace.

The installed Python Playwright + Chromium can launch a browser process, but this host applies a navigation policy:

```text
http://127.0.0.1/...  → net::ERR_BLOCKED_BY_ADMINISTRATOR
https://virtual/...   → net::ERR_BLOCKED_BY_ADMINISTRATOR
file:///...            → net::ERR_BLOCKED_BY_ADMINISTRATOR
```

A non-navigation `about:blank` probe reports:

```text
isSecureContext = false
navigator.mediaDevices = absent
MediaRecorder = present
devicePixelRatio = configurable by browser context
```

Therefore neither the LCOS App nor secure microphone capture can be exercised honestly in this container.

## New executable admission pack

### 1. Environment preflight

```text
npm run preflight:phase-a
npm run preflight:phase-a -- --strict
```

Owner:

`/scripts/phase-a-admission-preflight.mjs`

It checks:

- installed workspace dependencies;
- Playwright / Vite / React availability;
- Chromium / Chrome / Edge executable availability;
- optional prebuilt Web artifact;
- `LCOS_WHISPER_CPP_BIN`;
- `LCOS_WHISPER_CPP_MODEL`;
- optional FFmpeg;
- whether automated browser smoke and real Voice provider evidence are actually runnable.

`--strict` exits non-zero until both the real App browser chain and real Whisper provider assets are available.

### 2. Real-App automated browser smoke

```text
npm run test:e2e:phase-a
```

Config:

`/playwright.phase-a.config.ts`

Spec:

`/tests/e2e/v015-phase-a-admission.spec.ts`

Automated browser coverage includes:

- Search uses the one Top Spatial Index slot;
- old Search dialog is not the normal owner;
- Search result handoff yields to Focus;
- Focus does not resurrect the old large navigator;
- Color Pin authoring writes canonical membership through the live App;
- object-local Color Pin dots render from persisted truth;
- one-member Color Pin hands off to Focus;
- Composer Voice morphology reaches Recording and returns transcribed text to the editable prompt;
- Send is absent while Recording;
- fake occupied right-edge geometry shifts the Top Spatial Index safe center without moving Camera;
- Canvas visual evidence at 25 / 35 / 60 / 100 / 150% camera zoom;
- automated runs at DPR 1.0 / 1.25 / 1.5.

The Playwright Voice fixture intentionally mocks media capture and the transcription HTTP response so the browser test can prove GUI/orchestration morphology deterministically.

Hard distinction:

```text
fake-media Browser smoke ≠ real microphone / whisper.cpp evidence
```

Passing this automated spec is necessary but **not sufficient** for Phase A admission.

### 3. Human / real-runtime gate

The real-device gate remains mandatory for:

- actual microphone permission Allow / Deny;
- real browser/desktop `MediaRecorder` Start / Stop / Cancel;
- real whisper.cpp binary + configured model inference;
- Recording → Transcribing → Editable end to end;
- transcription failure / retry with the real provider process;
- no automatic Send after recording or transcription;
- Windows 125% and 150% display scaling;
- Canvas 25 / 35 / 60 / 100 / 150% zoom handfeel;
- Search / Focus / Color Pin / Map Locator at occupied viewport edges;
- Action Arc + Composer + Pin popover layered Esc/outside behavior;
- Main / Context / Workflow shared-interaction parity.

The detailed operator checklist is:

`docs/v015/convergence/PHASE_A_HUMAN_PRODUCT_SMOKE_RUNBOOK_20260901.md`

## Harness package closeout

The acceptance-infrastructure package itself has passed cold replay from the exact A25-8 delivery baseline. Evidence:

`docs/v015/convergence/PHASE_A_HUMAN_SMOKE_ADMISSION_PACK_CLOSEOUT_20260901.md`

This changes the harness status to `PACKAGE PASS / READY`; it does not change Phase A admission.

## Admission rule

Phase A may receive explicit admission only after all of the following are true:

```text
A13 → A25 source/static cumulative gates = PASS
A24 real Voice device/provider smoke       = PASS
Phase A real-App Playwright smoke          = PASS
Windows 125% / 150% human visual smoke     = PASS
Main / Context / Workflow parity           = PASS
blocking WRONG_OWNER / REALITY_GAP         = none
```

Only then create the explicit closeout/admission artifact.

Until then:

```text
Phase A automated/source construction = CLOSED / PASS
Phase A Human Product Smoke            = OPEN
Phase A Admission                      = NOT GRANTED
B0 Unified Work View                   = GATED
```

**Do not begin B0 from this pack alone.** The pack makes the gate executable; it does not waive the gate.
