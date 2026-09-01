# LCOS v0.15 · A24-4 Transcription Transport Closeout

Date: 2026-09-01
Status: **PASS · TRANSPORT ONLY · NO CONCRETE ASR / NO COMPOSER GUI**
Baseline: A24-3 Transcription Provider Seam

---

# 0. Proposition

A24-4 answers one question only:

> Can captured browser audio cross the Web → Local Core boundary through one bounded, authenticated, provider-neutral transport and return normalized transcript evidence without selecting an ASR engine, owning Voice lifecycle, mutating Composer text, or executing a Run?

Answer: **yes**.

---

# 1. Read / reality gate

Before implementation the following were re-read:

- `UNIFIED_COMPACT_COMPOSER_PROMPT_REFERENCE_VOICE_GUI_FREEZE_20260831.md` Voice sections;
- A24-1 / A24-2 / A24-3 closeouts;
- `A24_3_STT_DONOR_PROVIDER_CENSUS_20260901.md`;
- current `server.ts` request/auth/timeout dispatch;
- current `routes/multipart.ts` single-file transport parser;
- existing resource/import multipart routes;
- current Web `LocalCoreClient` request/decode owner.

Fresh transport reality found:

```text
Local Core generic request timeout = 10s
Web transcription may need >>10s
```

Therefore A24-4 adds a **route-specific transcription request budget** while keeping all other Local Core request timeouts unchanged.

---

# 2. Landed transport owner

Local Core route:

```text
POST /runtime/voice/transcriptions
Content-Type: multipart/form-data
```

Production modules:

```text
apps/local-core/src/routes/voice-transcription.ts
apps/local-core/src/server.ts
packages/contracts/src/voice-transcription.ts
apps/web/src/features/execution/voiceTranscriptionTransport.ts
apps/web/src/runtime/localCoreClient.ts
```

Web client:

```text
LocalCoreClient.transcribeVoice(input)
```

---

# 3. Upload contract

Multipart contains one audio file plus only these optional fields:

```text
durationMs
language
prompt
timestamps
providerId
```

Hard boundaries:

```text
body <= 32 MiB
audio MIME must be audio/*
audio bytes must be non-empty
language <= 64 chars
prompt <= 4000 chars
providerId <= 128 chars
timestamps = true/false/1/0
```

No base64 JSON audio transport is introduced.

---

# 4. Timeout / security contract

The route remains behind existing Local Core loopback/origin/bearer security.

Timeouts:

```text
Web request budget          = 120s
Local Core voice route      = >=130s
other Local Core requests   = unchanged generic budget
```

Opening/resizing Voice transport does not create a second runtime or bypass API auth.

---

# 5. Provider seam ownership remains intact

Default Local Core server wires:

```text
VoiceTranscriptionService
→ empty VoiceTranscriptionProviderRegistry
```

Therefore until a concrete provider is intentionally composed:

```text
POST /runtime/voice/transcriptions
→ provider-unavailable
→ HTTP 503 / UNAVAILABLE
```

This is deliberate.

A24-4 does **not** silently choose:

- whisper.cpp;
- faster-whisper;
- sherpa-onnx;
- browser SpeechRecognition;
- Runtime Agent provider (`Codex` / `WorkBuddy`).

---

# 6. Shared response contract

Transport returns only normalized transcript evidence:

```text
text
optional language
optional segments[startMs/endMs/text]
optional model
providerId
```

The Web transport does not directly insert this into Composer.

---

# 7. Error mapping

Transport normalizes:

```text
invalid audio / unsupported audio → 400 INVALID_ARGUMENT
body too large                   → 413 INVALID_ARGUMENT
provider unavailable             → 503 UNAVAILABLE
provider failed                  → 502 UNAVAILABLE
aborted upload/transcription     → 499 ABORTED
```

Provider retryability remains carried by the standard Local Core error envelope.

---

# 8. Scope fence kept

A24-4 intentionally does **not** add:

- concrete STT provider/model/runtime;
- audio decode/resample/model download;
- capture → lifecycle orchestration;
- transcript insertion into Composer;
- mic button / Recording morphology;
- waveform;
- automatic Send/Run;
- separate Voice panel;
- per-Surface Voice implementation.

---

# 9. Evidence

Dedicated gate:

```text
node scripts/validate-v015-a24-4-transcription-transport.mjs
→ 25/25 PASS
```

Runtime multipart smoke:

```text
node scripts/smoke-v015-a24-4-voice-transcription-transport.mjs
→ PASS
```

The smoke verifies:

- browser `FormData` serialization;
- route parsing;
- audio bytes/MIME/duration/hints/provider propagation;
- normalized transcript response;
- unknown field rejection;
- non-audio rejection;
- provider unavailable mapping;
- body size rejection;
- route fail-close on unrelated paths.

Targeted strict typecheck:

```text
tsc --noEmit --target ES2022 --lib ES2022,DOM --strict --skipLibCheck \
  --module ESNext --moduleResolution bundler \
  apps/web/src/features/execution/voiceTranscriptionTransport.ts \
  packages/contracts/src/voice-transcription.ts
→ PASS
```

No Browser/Human GUI PASS is claimed because A24-4 adds no visible Voice GUI and no physical STT backend.

---

# 10. Cumulative regression

```text
A13  = 12/12 PASS
A14  = 10/10 PASS
A15  = 12/12 PASS
A16  = 16/16 PASS
A17  = 15/15 PASS
A18  = 12/12 PASS
A19  = 13/13 PASS
A20  = 15/15 PASS
A21  = 13/13 PASS
A22  = 19/19 PASS
A23  = 16/16 PASS
A24-1 = 18/18 PASS
A24-2 = 23/23 PASS
A24-3 = 22/22 PASS
A24-4 = 25/25 PASS
```

W0/SOP gates remain green.

---

# 11. Phase status

```text
A24-1 Voice Lifecycle Owner        = PASS
A24-2 Native Capture Adapter       = PASS
A24-3 Transcription Provider Seam  = PASS
A24-4 Transcription Transport      = PASS
A24-5 Concrete STT Provider        = NEXT (must begin with fresh donor/package/runtime read)
A24 overall                        = OPEN
Phase A                            = OPEN
```

A24-5 must not be selected from preference or name recognition. It begins with source/license/runtime/packaging comparison against the actual LCOS Desktop/Web constraints, then lands the smallest mature provider adapter that can produce real transcript evidence behind the already-frozen seam.

---

# 12. Patch replay evidence

Final delivery replay:

```text
pure A24-3 baseline
→ git apply A24-4 patch
→ A24-4 25/25 PASS
→ A24-3 22/22 PASS
→ A24-2 23/23 PASS
→ A24-1 18/18 PASS
→ A23 16/16 PASS
→ A13-A22 all dedicated gates PASS
→ W0-3 30/30 PASS
→ W0-2 17/17 PASS
→ SOP-R1 8/8 PASS
```

Current cumulative A13→A24-4 dedicated source/static contracts:

```text
241/241 PASS
```

This still does not claim physical microphone + real ASR + Composer Human GUI acceptance; those require later A24 propositions.
