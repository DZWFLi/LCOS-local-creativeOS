# LCOS v0.15 · A24-3 Transcription Provider Seam Closeout

Date: 2026-09-01
Status: **PASS · PROVIDER CONTRACT/REGISTRY ONLY**
Baseline: A24-2 Native Capture Adapter

---

# 0. Proposition

A24-3 answers one question only:

> Can Local Core own a replaceable, deterministic speech-to-text capability seam that accepts captured audio and returns normalized editable transcript evidence without coupling Voice to a model/vendor, Runtime Agent provider, Composer state, or Send/Run?

Answer: **yes**.

---

# 1. Donor/read gate

Before implementation, the current Voice Freeze, A24-1/A24-2 closeouts, Local Core runtime/semantic provider seams, and current mature STT donors were read.

Donor record:

`docs/v015/convergence/A24_3_STT_DONOR_PROVIDER_CENSUS_20260901.md`

Reviewed families:
- whisper.cpp / MIT;
- faster-whisper / MIT;
- sherpa-onnx / Apache-2.0.

Decision:

> The LCOS seam is **not** a Whisper seam. PCM/decode/model/runtime mechanics stay behind a provider.

---

# 2. Landed owner

Production module:

```text
apps/local-core/src/voice-transcription-service.ts
```

Exports:

```text
VoiceTranscriptionProvider
VoiceTranscriptionProviderRegistry
VoiceTranscriptionService
VoiceTranscriptionRequestV1
VoiceTranscriptionResultV1
VoiceTranscriptionSegmentV1
VoiceTranscriptionError
```

Input:

```text
Uint8Array bytes
+ MIME
+ optional duration
+ optional language / prompt / timestamp hints
```

Output:

```text
text
+ optional language
+ optional millisecond segments
+ optional model
+ providerId
```

---

# 3. Owner fence

A24-3 intentionally does **not** add:
- concrete Whisper/faster-whisper/sherpa provider implementation;
- model download or packaging;
- audio decode/resample implementation;
- HTTP/multipart route;
- browser capture mechanics;
- XState lifecycle orchestration;
- Composer transcript insertion;
- waveform GUI;
- Send/Run/execution.

Runtime Agent provider state (`auto/codex/workbuddy`) remains a separate product domain.

---

# 4. Provider selection contract

Registry behavior:

```text
explicit requested provider
→ use only that provider if registered + MIME-supported
→ no silent fallback

no explicit provider
→ preferred provider if MIME-supported
→ otherwise highest supports() score
→ deterministic provider-id tiebreak
```

No provider guessing from:
- Composer executor choice;
- Conversation provider;
- title/time;
- active Run.

---

# 5. Validation / error normalization

Typed errors:

```text
invalid-audio
unsupported-audio
provider-unavailable
provider-failed
aborted
```

Provider segment output is checked for:
- finite timestamps;
- non-negative start;
- `end >= start`;
- monotonic non-overlapping ordering.

Transcript text is not semantically rewritten or trimmed. Only CRLF/CR line endings are normalized to LF so ordinary editable text remains provider-authored evidence.

---

# 6. Evidence

Dedicated gate:

```text
node scripts/validate-v015-a24-3-transcription-provider-seam.mjs
→ 22/22 PASS
```

Provider-neutral runtime smoke:

```text
node --experimental-strip-types scripts/smoke-v015-a24-3-voice-transcription.mjs
→ PASS
```

Targeted strict typecheck:

```text
tsc --noEmit --target ES2022 --lib ES2022,DOM --strict --skipLibCheck \
  --module ESNext --moduleResolution bundler \
  apps/local-core/src/voice-transcription-service.ts
→ PASS
```

No full Browser/Human claim is made; this proposition has no GUI and the extracted RC dependency environment remains incomplete.

---

# 7. Phase status

```text
A24-1 Voice Lifecycle Owner        = PASS
A24-2 Native Capture Adapter       = PASS
A24-3 Transcription Provider Seam  = PASS
A24-4 Transcription Transport      = NEXT
A24 overall                        = OPEN
Phase A                            = OPEN
```

A24-4 should expose the Local Core seam over one narrow audio upload/transcription route/client contract, still without hard-coding a concrete ASR engine or mutating Composer text.

---

# 8. Final regression / patch replay

Cumulative source/static regression on the constructed tree:

```text
A13-A23 = 153/153 PASS
A24-1   = 18/18 PASS
A24-2   = 23/23 PASS
A24-3   = 22/22 PASS
```

Patch-level replay:

```text
A24-2 clean baseline
→ git apply A24-3 patch
→ A13-A24-3 cumulative dedicated gates PASS
→ W0-3 30/30 PASS
→ W0-2 17/17 PASS
→ SOP-R1 8/8 PASS
→ targeted strict typecheck PASS
```

No Browser/Human PASS is claimed because this package adds no visible GUI and no concrete STT backend.
