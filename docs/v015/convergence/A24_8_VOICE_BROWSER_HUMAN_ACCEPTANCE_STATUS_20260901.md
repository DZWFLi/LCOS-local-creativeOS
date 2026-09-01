# LCOS v0.15 · A24-8 Voice Browser/Human Acceptance Status

Date: 2026-09-01
Status: **AUTOMATED BROWSER ENVIRONMENT BLOCKED · HUMAN/REAL-ASR OPEN**
Baseline: A24-7 Composer Voice GUI

## Proposition

Can the final Voice chain be proven in a real browser/device environment with microphone permission, real recording, real whisper.cpp/model transcription and visual/human acceptance?

## Automatic environment probe

Current construction environment facts:

```text
Chromium binary = PRESENT
node_modules = ABSENT
npm cache / dependency install = NOT AVAILABLE within bounded construction window
```

A bounded `npm ci --ignore-scripts --prefer-offline --no-audit --no-fund` probe was repeated on the A24-7 tree and timed out without producing `node_modules`.

Therefore Playwright/Vite/Vitest browser execution cannot honestly be claimed from this extracted RC environment.

## Still-open real evidence

- browser microphone permission prompt / deny / allow;
- real `MediaRecorder` Start / Stop / Cancel on target browser;
- real whisper.cpp binary + configured model inference;
- Recording → Transcribing → Editable transcript end-to-end;
- transcription failure/retry with real process/provider;
- Esc/outside layered behavior with actual DOM/OverlayStack;
- Windows 125% / 150% DPI visual acceptance;
- waveform/Stop/Cancel human handfeel;
- cross-Surface Main / Context / Workflow / Glyth human parity.

## What remains valid

A24-1…A24-7 source/static/runtime-smoke evidence remains valid and is not downgraded by the unavailable dependency environment.

A24 overall remains **OPEN FOR HUMAN/REAL-RUNTIME ACCEPTANCE** and Phase A cannot close from source/static evidence alone.

Per the rolling plan, A25 source construction may continue while this evidence is explicitly open. The project must return to A24-8 before Phase A admission.

## 2026-09-01 Phase A admission-pack environment addendum

A stronger Browser-host probe now confirms that the current extracted environment is blocked at two independent layers:

```text
App runtime layer:
- node_modules absent
- Vite / React / @playwright/test unresolved
- no prebuilt Web bundle

Browser host layer:
- Chromium process launches
- http://127.0.0.1 navigation → ERR_BLOCKED_BY_ADMINISTRATOR
- virtual https:// navigation → ERR_BLOCKED_BY_ADMINISTRATOR
- file:// navigation → ERR_BLOCKED_BY_ADMINISTRATOR
- about:blank is not a secure media context and exposes no navigator.mediaDevices
```

The reusable admission harness is documented in `PHASE_A_HUMAN_PRODUCT_SMOKE_ADMISSION_STATUS_20260901.md`. This addendum does not change A24-8 to PASS; real microphone / real whisper.cpp / Human Voice evidence remains OPEN.
