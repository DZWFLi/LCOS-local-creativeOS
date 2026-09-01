# LCOS v0.15 · A24-7 Composer Voice GUI Closeout

Date: 2026-09-01
Status: **SOURCE/STATIC PASS · BROWSER/HUMAN OPEN**
Baseline: A24-6 Voice Orchestration

## Product proposition

Can the already-working Voice chain appear inside the existing Unified Compact Composer as one in-place input modality, with no separate Voice panel, no duplicate state machine, no automatic execution, and no loss of the A23 compact/target-local grammar?

## Read gate completed

Before implementation, the following were re-read in full against current source:

- `UNIFIED_COMPACT_COMPOSER_PROMPT_REFERENCE_VOICE_GUI_FREEZE_20260831.md`;
- `A23_UNIFIED_COMPACT_COMPOSER_CLOSEOUT_20260831.md`;
- A24-1…A24-6 closeouts and source;
- current `UnifiedExecutionComposer.tsx` and A23 compact CSS;
- current overlay-stack dismissal semantics;
- current Motion/presence constraints relevant to compact transient UI.

A24-7 adds no new Voice donor. XState remains lifecycle donor; native MediaRecorder remains capture primitive; whisper.cpp remains the replaceable first STT provider.

## Landed source

Primary GUI owner:

- `apps/web/src/features/execution/UnifiedExecutionComposer.tsx`
- `apps/web/src/features/execution/voiceComposerInput.ts`
- `apps/web/src/reconstruction.css`

Validation:

- `scripts/validate-v015-a24-7-composer-voice-gui.mjs`
- `scripts/smoke-v015-a24-7-composer-voice-gui.mjs`

## In-place morphology

The Composer shell remains the A23 shell:

```text
width ≈ 382px
same target-local placement owner
same header / Reference strip
same canonical prompt / explicit Send
```

Only the input/control region changes presentation state.

### Idle / Editable

```text
textarea + Send
footer: Voice / Reference / Receiver / Settings
```

### Requesting permission

```text
Mic + compact status + Cancel
```

### Recording

```text
Mic + short waveform + Cancel + Stop
```

The ordinary footer yields while Recording.

### Transcribing

```text
lightweight spinner/status + Cancel
```

No Send is shown by the Voice substate.

### Error

```text
short error identity + Retry + Return-to-text
```

No large warning panel is opened.

### Editable transcript

Successful transcript returns to the ordinary textarea. Existing typed prompt is preserved and the transcript is appended as ordinary editable text.

The transcript handoff is:

```text
A24-6 onTranscript
→ appendVoiceTranscript()
→ existing onPromptChange()
→ ordinary textarea
```

It does not call `onSend()`.

## Owner boundaries

`UnifiedExecutionComposer` may create/consume `DefaultVoiceOrchestrator`, but it does not import or define `voiceLifecycleMachine` and does not touch browser capture APIs directly.

```text
XState machine = lifecycle truth
VoiceCaptureAdapter = microphone truth
VoiceTranscriptionService = STT capability truth
DefaultVoiceOrchestrator = ordering/cancel/retry truth
UnifiedExecutionComposer = presentation + editable prompt + explicit Send truth
```

No separate Voice panel, modal, drawer, portal or per-Surface Voice UI was introduced.

## Esc / outside layering

While Voice is in a transient/error state:

```text
Esc #1 / outside press
→ cancel/reset Voice state
→ Composer remains
```

Only when Voice is back at ordinary `idle/editable` does the Composer itself dismiss.

The outside path deliberately does not call `dismissTop()` before cancelling Voice, because `dismissTop()` removes the registered overlay entry before `onEsc`; doing so would leave a visible Composer without stack ownership.

## Cross-Surface parity

No surface-specific Voice controls were added.

Existing Main / Context / Workflow / Glyth consumers continue to render the same `UnifiedExecutionComposer`, so the Voice presentation primitive is shared automatically.

## Visual constraints landed

- no width change between text and Voice states;
- short 86px waveform footprint;
- no giant Voice overlay;
- unrelated footer controls yield during active Voice state;
- recording/transcribing visuals use restrained local signal treatment;
- reduced-motion disables waveform/spinner animation;
- Voice trigger is disabled honestly when Local Core is absent or execution is busy.

## Static/runtime evidence

`voiceComposerInput.ts` presentation smoke verifies:

- transcript replacement/append semantics;
- whitespace-safe prompt merge;
- transient-state classifier;
- Voice error-state classifier/copy.

Dedicated source gate verifies the full GUI ownership/morphology invariants.

## Historical validator advancement

A23/A24-1/A24-6 gates previously contained scope fences that were correct at those package baselines but would incorrectly fail once a later legal GUI consumer existed.

A24-7 advances those gates so they continue to forbid direct browser capture/lifecycle ownership while allowing the now-authorized presentation layer. This is forward-compatible gate maintenance, not a weakening of the owner split.

## Not claimed

A24-7 does **not** claim:

- real whisper.cpp model E2E;
- browser microphone permission smoke in the final dependency environment;
- acoustic waveform metering/level fidelity;
- final visual acceptance on Windows 125/150% DPI;
- Human Voice acceptance;
- Phase A completion.

## Result

```text
A24-1 Lifecycle             = PASS
A24-2 Capture               = PASS
A24-3 Provider Seam         = PASS
A24-4 Transport             = PASS
A24-5 Concrete Provider     = PASS
A24-6 Voice Orchestration   = PASS
A24-7 Composer Voice GUI    = SOURCE/STATIC PASS
Browser/Human Voice         = OPEN
A24 overall                 = OPEN until runtime/Human acceptance
```

Exact next Voice acceptance proposition:

```text
A24-8 Voice Browser/Human Acceptance + A24 Closeout
```

A25 Active Spatial Viewport / Centered Spatial Index may continue as a separate source package while A24 real-device/browser evidence remains explicitly open; Phase A admission still requires both to close.

## Validation evidence

```text
A24-7 dedicated                         34 / 34 PASS
A13 → A24-7 cumulative                 332 / 332 PASS
W0-3 Fresh Source/Runtime Census        30 / 30 PASS
W0-2 Recovered Source Ledger            17 / 17 PASS
SOP-R1 Reconstructed Authority           8 / 8 PASS
```

The cumulative count includes the A21/A22 validators whose summary format is `N PASS / 0 FAIL`; all A13→A24-7 dedicated validators returned zero failures.

Semantic workspace typecheck and Browser/Human Voice smoke remain environment/open gates because this construction tree still has no local dependency install or real browser/microphone + whisper model runtime assets.

Delivery replay evidence is added only after the final patch is cold-applied to the exact A24-6 baseline and all gates are rerun.

## Delivery replay

The exact A24-7 patch was cold-applied to an exact A24-6 baseline tree:

```text
git apply --check A24-7 patch = PASS
git apply A24-7 patch         = PASS
A13 → A24-7 replay            = ALL PASS (332/332)
W0-3                           = 30/30 PASS
W0-2                           = 17/17 PASS
SOP-R1                         = 8/8 PASS
```

This replay does not upgrade Browser/Human Voice acceptance.
