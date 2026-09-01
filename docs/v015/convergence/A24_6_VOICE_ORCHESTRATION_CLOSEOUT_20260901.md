# LCOS v0.15 · A24-6 Voice Orchestration Closeout

Date: 2026-09-01
Status: **SOURCE/RUNTIME PASS · GUI/HUMAN OPEN**
Baseline: A24-5 Concrete STT Provider

## Product proposition

Can one Web-side orchestration owner connect the already-separated Voice lifecycle, microphone capture, transcription transport and transcript handoff without creating a second execution truth, mutating Composer state directly, or auto-sending after transcription?

## Read gate completed

Before implementation, the following were re-read against current source:

- `UNIFIED_COMPACT_COMPOSER_PROMPT_REFERENCE_VOICE_GUI_FREEZE_20260831.md`, especially Voice sections 10–12 and A24;
- A24-1 lifecycle source/closeout;
- A24-2 native capture source/closeout;
- A24-3 provider seam source/closeout;
- A24-4 transport source/closeout;
- A24-5 concrete provider source/closeout;
- current `UnifiedExecutionComposer.tsx` prompt/Send ownership;
- current `LocalCoreClient.transcribeVoice()` transport owner.

No new donor is introduced by A24-6. XState remains the already-admitted transient lifecycle donor from A24-1.

## Canonical owner split after A24-6

```text
A24-1 voiceLifecycleMachine
= transient Voice lifecycle truth

A24-2 VoiceCaptureAdapter
= browser microphone / MediaRecorder mechanics

A24-3 VoiceTranscriptionService
= provider-neutral STT capability truth

A24-4 LocalCoreClient.transcribeVoice
= authenticated/bounded Web ↔ Local Core transport

A24-5 whisper.cpp-cli
= first replaceable concrete STT adapter

A24-6 DefaultVoiceOrchestrator
= operation ordering / cancellation / retry / transcript handoff

UnifiedExecutionComposer
= editable prompt + explicit Send/Run truth
```

## Landed source

`apps/web/src/features/execution/voiceOrchestration.ts`

Primary API:

```text
DefaultVoiceOrchestrator
createLocalCoreVoiceTranscribePort()
VoiceOrchestrationSnapshot
VoiceTranscriptionHints
VoiceOrchestrationError
```

Public operations:

```text
start()
stop(hints)
cancel()
retry()
reset()
dispose()
subscribe()
onTranscript()
```

## Happy path

```text
idle
→ start()
→ START_RECORDING
→ requestingPermission
→ capture.start()
→ PERMISSION_GRANTED
→ recording
→ stop()
→ capture.stop()
→ STOP_RECORDING
→ transcribing
→ LocalCoreClient.transcribeVoice()
→ TRANSCRIPTION_SUCCEEDED
→ editable
→ transcript handoff only
```

The transcript is returned and emitted to `onTranscript()` consumers. A24-6 deliberately does **not** write it into Composer prompt state. That handoff belongs to A24-7 GUI integration.

## Cancellation semantics

### Permission request pending

Browser `getUserMedia()` does not provide a portable AbortSignal. A24-6 therefore uses a monotonic operation version:

```text
cancel()
→ invalidate current operation
→ lifecycle returns idle
→ if permission grant resolves late
→ capture.cancel()
→ tracks cleaned
→ no Recording transition
```

### Recording

```text
cancel()
→ capture.cancel()
→ chunks discarded
→ idle
→ no transcription
```

### Transcribing

```text
cancel()
→ AbortController.abort()
→ transport aborts
→ idle
→ no transcript handoff
```

## Retry semantics

```text
permissionDenied / captureError
→ RETRY
→ new capture attempt

transcriptionError
→ retain last captured Blob in orchestration memory only
→ RETRY
→ rerun transcription on same capture
```

The retained capture is transient process/session state, not Project Truth and not an Artifact.

## Error ownership

A24-6 normalizes orchestration-facing errors to:

```text
invalid-state
permission-denied
capture-failed
transcription-failed
```

Detailed provider/capture evidence remains available as `cause` and behind the lower-layer contracts.

## Explicit Send invariant

A24-6 contains no Send/Run/execute transition and does not import Composer callbacks.

Frozen rule remains:

```text
recording stop != send
transcription success != send
editable transcript != send
only explicit Unified Composer Send/Run executes
```

## Runtime smoke

`scripts/smoke-v015-a24-6-voice-orchestration.mjs`

Covers:

1. normal capture → transcription → editable handoff;
2. recording cancel without transcription;
3. cancel while permission is pending + late permission cleanup;
4. permission denied mapping;
5. capture failure + retry;
6. transcription failure + same-capture retry;
7. transcribing cancel aborts transport;
8. Local Core runtime-call adapter success/failure normalization.

The smoke uses a tiny actor harness for orchestration-only behavior because the extracted Node environment cannot directly execute the vendored TypeScript XState source tree. Production source is still required by static gate to import the real vendored `createActor` and real `voiceLifecycleMachine`; A24-1 remains the real XState lifecycle gate.

## Not claimed

A24-6 does **not** claim:

- microphone icon / recording morphology;
- waveform rendering;
- transcript insertion into Composer prompt;
- final permission/error copy;
- Browser/Human microphone acceptance;
- real whisper model E2E;
- per-Surface GUI smoke;
- any automatic execution.

## Result

```text
A24-1 Lifecycle             = PASS
A24-2 Capture               = PASS
A24-3 Provider Seam         = PASS
A24-4 Transport             = PASS
A24-5 Concrete Provider     = PASS
A24-6 Voice Orchestration   = PASS
A24-7 Composer Voice GUI    = NEXT
```

Phase A remains open.

## Final validation evidence

Dedicated gate:

```text
A24-6 Voice Orchestration: 30/30 PASS
```

Cumulative replay in the working tree:

```text
A13 → A24-6 = 298/298 PASS
W0-3 = 30/30 PASS
W0-2 = 17/17 PASS
SOP-R1 = 8/8 PASS
```

Delivery replay:

```text
final A24-5 baseline
→ git apply --check A24-6 patch
→ git apply
→ A13 → A24-6 full gate replay
→ 298/298 PASS
```

No Browser/Human Voice PASS is claimed.
