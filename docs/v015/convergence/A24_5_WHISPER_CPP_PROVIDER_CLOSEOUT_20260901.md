# LCOS v0.15 · A24-5 Whisper.cpp Concrete STT Provider Closeout

Date: 2026-09-01
Status: **SOURCE/RUNTIME PASS · REAL MODEL E2E = OPEN · BROWSER/HUMAN = OPEN**

## Proposition

Admit one concrete mature local STT implementation behind the already-frozen A24-3 provider seam without coupling Voice/Composer to a model/runtime.

## Landed

```text
apps/local-core/src/voice-transcription-whisper-cpp-provider.ts
apps/local-core/src/voice-transcription-defaults.ts
apps/local-core/src/server.ts
scripts/smoke-v015-a24-5-whisper-cpp-provider.mjs
scripts/validate-v015-a24-5-whisper-cpp-provider.mjs
```

Donor/packaging authority:

```text
docs/v015/convergence/A24_5_CONCRETE_STT_PROVIDER_DECISION_20260901.md
```

## Owner split after A24-5

```text
A24-1 XState lifecycle
A24-2 browser capture
A24-3 provider-neutral transcription service
A24-4 authenticated multipart transport
A24-5 whisper.cpp CLI concrete provider + environment-gated default composition
A24-6 orchestration
A24-7+ Composer recording/transcription morphology + human acceptance
```

## Concrete provider behavior

```text
input audio bytes
→ temp file
→ FFmpeg 16kHz mono PCM s16 WAV
→ whisper-cli -oj JSON
→ text / language / optional segment offsets / model provenance
```

Provider id:

```text
whisper.cpp-cli
```

Provider registration requires both:

```text
LCOS_WHISPER_CPP_BIN
LCOS_WHISPER_CPP_MODEL
```

and both paths must exist.

No local asset:

```text
provider not registered
→ existing A24-3 provider-unavailable behavior
```

## Runtime smoke evidence

The dedicated smoke executes real child processes using controlled fake FFmpeg/whisper executables and verifies:

- audio conversion arguments;
- JSON output file parsing;
- language hint normalization (`zh-CN → zh`);
- prompt propagation through argv without shell interpolation;
- optional timestamp segment normalization;
- model provenance;
- no-timestamp response shape;
- environment-gated provider registration;
- missing binary/model behavior;
- missing FFmpeg behavior;
- AbortSignal process termination.

## Explicitly not claimed

```text
REAL whisper.cpp binary execution = OPEN
REAL Whisper model inference = OPEN
model packaging / integrity / updater = OPEN
browser microphone → real STT E2E = OPEN
Composer transcript insertion = OPEN
Voice GUI morphology = OPEN
Human Product Smoke = OPEN
```

The current container has no installed whisper.cpp binary/model and package-registry/network access remains unreliable; no fake real-model PASS is recorded.

## Acceptance

A24-5 may close source/runtime when:

- dedicated validator passes;
- subprocess runtime smoke passes;
- A24-4 transport invariant still passes after its temporary empty-registry assumption is superseded;
- A13→A24 cumulative static/runtime gates remain green;
- patch replays from clean A24-4 baseline.

## Next

```text
A24-6 Voice Orchestration
```

## Final delivery replay evidence

Final candidate was generated from the clean A24-4 baseline and replayed as:

```text
clean A24-4 baseline
→ git apply --check A24-5 patch
→ git apply A24-5 patch
→ A13→A24-5 cumulative gates 268/268 PASS
→ W0-3 30/30 PASS
→ W0-2 17/17 PASS
→ SOP-R1 8/8 PASS
```

A bounded attempt was also made to obtain the official upstream whisper.cpp binary/model only in the temporary test area for a real-model smoke. The current execution environment could not retrieve the release/model binary assets through the available download path. Therefore:

```text
REAL whisper.cpp binary execution = OPEN
REAL Whisper model inference = OPEN
```

No release asset/model weight was added to the repository and no real-model PASS is fabricated from the fake-subprocess runtime smoke.
