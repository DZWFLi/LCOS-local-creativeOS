# LCOS v0.15 · A24-1 Voice Lifecycle Owner Closeout

Date: 2026-09-01  
Status: **SOURCE/STATIC CLOSED · NO GUI CHANGE · RUNTIME PACKAGE EXECUTION ENVIRONMENT BLOCKED**

## Proposition

A24-1 establishes exactly one transient Voice lifecycle owner before microphone capture, STT, waveform or Composer GUI work begins.

Frozen lifecycle:

```text
idle
→ requestingPermission
→ recording
→ transcribing
→ editable

error branches:
permissionDenied
captureError
transcriptionError
```

Explicit Composer `Send / Run` remains outside this machine.

## Donor read / adoption

The local P3 donor snapshot was read before implementation:

```text
statelyai/xstate
xstate 5.32.6
commit 21872cdc93a3baddbcf43f1d83553991d39f28ab
MIT
```

Because registry installation is unavailable in the extracted RC environment, A24-1 vendors the reviewed XState core source locally, preserving upstream source + LICENSE + README + upstream package metadata and recording SHA-256 for copied upstream files.

LCOS adds only a local package boundary so the upstream `#is-development` import condition resolves while Vite/TypeScript consumes source directly.

This donor is scoped to Voice transient lifecycle only. It does not replace LCOS canonical project/runtime state.

## Production changes

Added:

- `apps/web/src/features/execution/voiceLifecycle.ts`
- `apps/web/src/vendor/xstate-5.32.6/**`
- `scripts/validate-v015-a24-1-voice-lifecycle-owner.mjs`

Updated:

- `apps/web/tsconfig.json` (`allowImportingTsExtensions: true` for exact upstream TS imports)
- Construction index / night rolling ledger

## Scope fence kept

A24-1 intentionally does **not** add:

- `MediaRecorder` / `getUserMedia`;
- STT/ASR provider;
- waveform/activity rendering;
- mic button or Composer morph;
- transcript insertion into prompt;
- automatic Send/Run;
- `@xstate/react` dependency.

Those belong to later A24 propositions.

## Acceptance

Dedicated validator:

```text
node scripts/validate-v015-a24-1-voice-lifecycle-owner.mjs
```

Required:

- one Voice lifecycle module;
- mature XState donor actually owns the machine definition;
- typed events and explicit permission/capture/transcription failure states;
- cancel/reset/retry paths explicit;
- no Send/Run event or execution state;
- no capture/STT/GUI smuggling;
- vendored upstream provenance/hash integrity;
- A23 Unified Composer remains untouched.

Syntax/module-resolution smoke in the extracted environment:

```text
tsc --noCheck --target ES2022 --module ESNext --moduleResolution bundler \
  --allowImportingTsExtensions --noEmit \
  apps/web/src/features/execution/voiceLifecycle.ts
```

## Runtime/Human evidence

No GUI changes exist in A24-1, so Human GUI smoke is not applicable to this proposition.

Full application typecheck/unit/browser remains `ENVIRONMENT_BLOCKED` in the extracted RC because `node_modules` is absent and bounded npm dependency restoration does not complete.

This is **not** converted to PASS.

## Verdict

```text
A24-1 Voice Lifecycle Owner = PASS (source/static proposition)
A24-2 Native Capture Adapter = NEXT
Phase A = OPEN
```

## Final regression evidence

External donor-source exact comparison performed during construction:

```text
packages/core/src        = exact diff PASS
packages/core/LICENSE    = exact byte PASS
packages/core/README.md  = exact byte PASS
packages/core/package.json → UPSTREAM_PACKAGE.json = exact byte PASS
```

Patch-level clean-baseline replay:

```text
W0-3 clean baseline
→ git apply A24-1 patch
→ A24-1 18/18 PASS
→ A13-A23 cumulative dedicated static gates remain PASS
→ W0-3 30/30 PASS
→ W0-2 17/17 PASS
→ SOP-R1 8/8 PASS
```

No Browser/Human claim is made because A24-1 adds no visible UI and the full dependency environment remains unavailable in this extracted RC.
