# LCOS v0.15 · A24-2 Native Capture Adapter Closeout

Date: 2026-09-01
Status: **PASS · CAPTURE MECHANICS ONLY**
Baseline: A24-1 Voice Lifecycle Owner

---

# 0. Proposition

A24-2 answers one question only:

> Can LCOS acquire microphone audio through a replaceable browser capture seam, stop/cancel reliably, release hardware resources, and return a typed audio result without owning transcription, Composer text, waveform UI, or execution?

Answer: **yes**.

---

# 1. Landed owner

Production module:

```text
apps/web/src/features/execution/voiceCapture.ts
```

Exports:

```text
VoiceCaptureAdapter
VoiceCaptureEnvironment
NativeVoiceCaptureAdapter
VoiceCaptureResult
VoiceCaptureError
chooseVoiceCaptureMimeType()
classifyVoiceCaptureError()
```

Browser mechanics:

```text
navigator.mediaDevices.getUserMedia({ audio: true, video: false })
→ MediaRecorder
→ Blob chunks
→ stop/cancel
→ all MediaStream tracks stopped
```

MIME preference:

```text
audio/webm;codecs=opus
→ audio/webm
→ audio/mp4
→ browser default
```

---

# 2. Owner fence

A24-2 deliberately does **not** own:

- XState lifecycle transitions;
- Voice/Composer orchestration;
- STT/transcription provider;
- transcript text mutation;
- waveform/AudioContext rendering;
- Send/Run/execution;
- per-Surface Voice UI.

The capture adapter returns typed mechanics only. A later orchestration package maps capture success/failure into A24-1 lifecycle events.

---

# 3. Resource/error contract

Typed capture errors include:

```text
unsupported
permission-denied
device-not-found
device-unavailable
aborted
invalid-state
recorder-failed
capture-failed
```

Hard cleanup:

```text
stop
cancel
recorder construction failure
asynchronous MediaRecorder error
→ detach recorder callbacks
→ stop every MediaStream track
→ clear active session owner
```

`cancel()` discards captured chunks and never produces an execution side effect.

---

# 4. Evidence

Dedicated static/runtime gate:

```text
node scripts/validate-v015-a24-2-native-capture-adapter.mjs
→ 23/23 PASS
```

Runtime smoke with fake browser media primitives:

```text
node --experimental-strip-types scripts/smoke-v015-a24-2-voice-capture.mjs
→ PASS
```

Targeted strict DOM typecheck:

```text
tsc --noEmit --target ES2023 --lib ES2023,DOM --strict --skipLibCheck \
  --module ESNext --moduleResolution bundler \
  apps/web/src/features/execution/voiceCapture.ts
→ PASS
```

Regression:

```text
A24-1 = 18/18 PASS
A13-A23 = 153/153 PASS
```

Full Browser/Human remains **not claimed** because the extracted RC still lacks the normal dependency/runtime environment and no physical microphone browser smoke was performed in this package.

---

# 5. Runtime smoke cases covered

- supported MIME selection;
- fallback when no preferred MIME is supported;
- `audio:true / video:false` constraint;
- Start → active recording;
- duplicate Start rejected;
- Stop → Blob + MIME + duration;
- Cancel → discard + track cleanup;
- idle Cancel is safe;
- idle Stop rejected;
- permission denied mapping;
- missing/unavailable device mapping;
- recorder construction failure cleans acquired stream;
- asynchronous recorder error is observable and releases tracks.

---

# 6. Phase status

```text
A24-1 Voice Lifecycle Owner       = PASS
A24-2 Native Capture Adapter      = PASS
A24-3 Transcription Provider Seam = NEXT
A24 overall                       = OPEN
Phase A                           = OPEN
```

A24-3 must begin with a fresh donor/provider read. Do not hard-code one ASR vendor into the Composer and do not use browser-native SpeechRecognition as the sole production truth.
