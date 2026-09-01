# LCOS v0.15 · A24-3 STT Donor / Provider Census

Date: 2026-09-01
Status: **DONOR READ COMPLETE · PROVIDER-NEUTRAL SEAM AUTHORITY**

## Product boundary

Voice Freeze requires:

```text
capture / MediaRecorder
→ mature replaceable Speech-to-Text provider adapter
→ editable Composer text
→ explicit Send only
```

A24-3 therefore must not freeze LCOS to Whisper, ONNX, Python, a cloud vendor, or browser-native SpeechRecognition.

---

## Donor 1 · whisper.cpp

Source:
- https://github.com/ggml-org/whisper.cpp
- reviewed current repository / `include/whisper.h`
- license: MIT

Relevant implementation shape:

```text
float PCM samples
→ whisper_full(...)
→ n segments
→ whisper_full_get_segment_text(...)
```

Current repository supports Windows and WebAssembly among other targets.
The CLI path documents 16-bit WAV input, while the C API itself consumes raw float PCM.

LCOS conclusion:
- strong future local/Desktop provider candidate;
- audio decode/resample belongs inside its provider adapter/preprocessor;
- LCOS Voice contract must not require GGML model names or WAV.

---

## Donor 2 · faster-whisper

Source:
- https://github.com/SYSTRAN/faster-whisper
- reviewed current `faster_whisper/transcribe.py`
- license: MIT

Relevant implementation shape:

```text
path / BinaryIO / ndarray
→ transcribe(...)
→ segments generator + TranscriptionInfo
```

The project uses CTranslate2; its Python path decodes audio through PyAV.

LCOS conclusion:
- strong service/sidecar provider candidate;
- Python/CTranslate2/PyAV are provider implementation details;
- normalized LCOS result may preserve text + language + time segments without exposing Python types.

---

## Donor 3 · sherpa-onnx

Source:
- https://github.com/k2-fsa/sherpa-onnx
- reviewed current JS/Node non-streaming recognition API + source/examples
- license: Apache-2.0

Relevant implementation shape:

```text
Float32 waveform + sample rate
→ OfflineStream.acceptWaveform(...)
→ decode(...)
→ result.text / timestamps / language where model supports it
```

Current project supports NodeJS, WebAssembly, Windows and many offline ASR model families.

LCOS conclusion:
- especially attractive future Local Core/Desktop provider candidate;
- model family is not LCOS GUI truth;
- timestamps/language fit the normalized optional result contract.

---

# A24-3 contract decision

Canonical provider-neutral input:

```text
audio bytes
+ MIME type
+ optional duration
+ optional language/prompt/timestamp hints
```

Canonical provider-neutral output:

```text
text
+ optional language
+ optional millisecond segments
+ optional model provenance
+ providerId
```

Provider owns:
- compressed audio decode;
- resample / mono conversion;
- PCM/model format;
- model files/downloads;
- local process/WASM/Node/Python/cloud transport;
- model-specific token/timestamp representation.

LCOS seam owns:
- input validation;
- explicit provider registry/selection;
- normalized text/segment shape;
- typed provider errors;
- abort propagation;
- zero connection to Run/Send semantics.

---

# Rejected short-cuts

Do not:
- name the contract `WhisperProvider`;
- let Runtime Agent provider selection (`Codex` / `WorkBuddy`) choose STT;
- make browser SpeechRecognition the only production truth;
- let a transcription provider write Composer state directly;
- auto-send after provider success.

---

# Next donor gate

A concrete provider must be selected in its own proposition after checking:
- install/runtime footprint on LCOS Desktop/Windows;
- model distribution/license;
- audio decoding requirements;
- cold start / memory;
- offline behavior;
- packaging/updater strategy;
- fallback behavior.
