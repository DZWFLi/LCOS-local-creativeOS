# LCOS v0.15 · A24-5 Concrete STT Provider Decision

Date: 2026-09-01
Status: **DONOR / PACKAGING READ COMPLETE · WHISPER.CPP CLI ADMITTED AS FIRST CONCRETE PROVIDER**

## Product boundary

A24-5 does not redefine the A24-3 provider-neutral contract.

```text
Voice Capture
→ Transcription Transport
→ VoiceTranscriptionProvider
→ concrete provider adapter
→ normalized transcript evidence
```

Concrete engine/model/runtime details remain behind the provider seam.

---

## Shortlist read

### 1. ggml-org/whisper.cpp · selected first provider

Source:
- https://github.com/ggml-org/whisper.cpp
- MIT
- current reviewed release at construction time: `b4938` (2026-08-20)
- official release assets include Windows x64 prebuilt binaries
- current repository includes CLI, C API, WASM/JavaScript binding and a Node/Electron addon example

Relevant current CLI contract:

```text
whisper-cli
-m <model>
-f <audio>
-oj
-of <output-prefix>
-l <language|auto>
--prompt <optional context>
```

The CLI documents JSON output and the project documents FFmpeg conversion to 16-bit WAV. The current top-level README lists approximate multilingual model footprint:

```text
tiny  ~75 MiB disk / ~273 MB memory
base  ~142 MiB disk / ~388 MB memory
small ~466 MiB disk / ~852 MB memory
```

Why selected for A24-5:
- native offline inference;
- MIT code and upstream Whisper code/model weights are MIT;
- official Windows x64 binaries exist;
- child-process boundary avoids coupling Local Core to Node/Electron native-addon ABI;
- CLI JSON contract maps cleanly into A24-3 text/language/segment normalization;
- model/binary can be packaged later without changing Web/Composer code.

Why CLI instead of the whisper.cpp Node addon for this first package:
- the addon is valuable reference and supports Node/Electron, but would introduce `cmake-js`/native-addon build coupling into this package;
- the CLI is already an official first-class example and keeps provider failure/process lifecycle isolated;
- future Desktop packaging may replace the CLI adapter with an in-process addon without changing the canonical provider seam.

### 2. SYSTRAN/faster-whisper · keep as sidecar candidate

Source:
- https://github.com/SYSTRAN/faster-whisper
- MIT

Packaging shape:

```text
Python
+ CTranslate2
+ PyAV audio decode
+ model assets
```

Strengths:
- mature Whisper inference path;
- strong performance / quantization ecosystem;
- simple path/BinaryIO/ndarray transcription API.

Why not first provider:
- adds a Python runtime/sidecar plus CTranslate2/PyAV packaging surface to an otherwise Node Local Core;
- creates more installer/updater and Windows environment work than A24-5 needs.

It remains a valid future provider behind the same seam.

### 3. k2-fsa/sherpa-onnx · keep as future Local Core/Desktop candidate

Source:
- https://github.com/k2-fsa/sherpa-onnx
- Apache-2.0

Strengths:
- Windows, NodeJS, WebAssembly and offline ASR support;
- many ASR families beyond Whisper;
- strong long-term fit for local/offline speech capabilities.

Current packaging caution:
- the repository Node addon wrapper is documented as developer-oriented;
- the source build path uses CMake + `cmake-js` + `node-addon-api` + native sherpa/onnxruntime artifacts;
- adopting it now would expand A24-5 into native-addon packaging rather than one concrete provider adapter.

It should remain a high-priority future comparison, especially if LCOS later wants streaming ASR, broader model families, or an in-process Desktop speech runtime.

---

# Admitted A24-5 runtime shape

```text
Web MediaRecorder Blob
→ A24-4 multipart transport
→ A24-3 VoiceTranscriptionService
→ whisper.cpp-cli provider
→ temp input file
→ FFmpeg 16 kHz / mono / PCM s16 WAV
→ whisper-cli JSON output
→ normalized text / optional language / optional segments / model provenance
```

## Configuration boundary

A concrete provider is only registered when both exact local assets exist:

```text
LCOS_WHISPER_CPP_BIN
LCOS_WHISPER_CPP_MODEL
```

Optional runtime configuration:

```text
LCOS_WHISPER_CPP_FFMPEG
LCOS_WHISPER_CPP_THREADS
LCOS_WHISPER_CPP_NO_GPU
```

No model or binary is downloaded by Local Core in A24-5.

Missing binary/model means:

```text
provider not installed
→ do not register
→ provider-unavailable
```

This prevents a half-configured provider from masquerading as functional Voice.

---

# Model policy

Do not make a Whisper model name canonical GUI truth.

For early multilingual LCOS Desktop packaging, `base` is the current practical default candidate because its footprint is modest while retaining multilingual recognition, but this remains a packaging/default choice, not the Voice contract.

Model install/update, integrity verification and user-selectable quality tiers belong to a later packaging proposition.

---

# Audio policy

Browser MediaRecorder commonly returns WebM/Opus or MP4-family audio, while current whisper.cpp CLI paths are most predictable with WAV/other documented file inputs.

Therefore A24-5 owns provider-local decoding only:

```text
compressed audio bytes
→ FFmpeg
→ 16kHz mono PCM s16 WAV
```

This conversion must not leak into A24-2 capture or A24-3 canonical request types.

---

# Not admitted in A24-5

- automatic model download;
- model picker GUI;
- VAD/autostop;
- streaming transcription;
- browser SpeechRecognition fallback;
- Composer prompt mutation;
- auto Send/Run;
- waveform or recording morphology;
- Whisper as permanent canonical product vocabulary.

---

# Next gate

```text
A24-6 Voice Orchestration
```

Connect the already-separated lifecycle / capture / transport pieces so that:

```text
recording stop
→ transcribing
→ transcript evidence
→ editable text state
```

Still no auto Send.
