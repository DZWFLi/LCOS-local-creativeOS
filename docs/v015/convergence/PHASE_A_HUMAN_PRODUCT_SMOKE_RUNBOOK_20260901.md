# LCOS v0.15 · Phase A Human Product Smoke Runbook

Date: 2026-09-01
Purpose: operator-level product smoke required before explicit Phase B admission.

## 1. Machine prerequisites

Preferred final evidence machine:

- Windows 11 target environment;
- current supported Chromium/Edge build used by LCOS;
- workspace dependencies installed;
- Local Core runnable;
- microphone physically present and enabled;
- whisper.cpp binary configured through `LCOS_WHISPER_CPP_BIN`;
- multilingual Whisper model configured through `LCOS_WHISPER_CPP_MODEL`;
- FFmpeg available when the provider path requires conversion.

Run first:

```text
npm run preflight:phase-a -- --strict
```

A non-zero result means the machine is not eligible to produce Phase A admission evidence.

## 2. Automated real-App pass

Run:

```text
npm run test:e2e:phase-a
```

Keep the Playwright report, trace on failure, and attached screenshots.

Required automated result:

```text
chromium-dpr100 = PASS
chromium-dpr125 = PASS
chromium-dpr150 = PASS
```

DPR projects are automated layout sanity only. They do not replace Windows OS display-scale review.

## 3. Human matrix

Record each row as `PASS`, `FAIL`, or `BLOCKED`, plus a short note and screenshot/video reference where useful.

| Surface | Interaction | Human acceptance |
|---|---|---|
| Main | Click selection | selected object is obvious without permanent toolbar clutter |
| Main | Shift multi-select | additive selection remains spatially clear |
| Main | Marquee | selection rectangle and result match gesture |
| Main | Move / group move | body drag moves objects predictably |
| Main | Resize | resizing does not reveal old card-shell behavior |
| Main | Action Arc | top-right short arc, 3 default / 4 max, no 360° ring |
| Main | Right-click | management/organization only; no duplicate direct-action system |
| Main | Relation | explicit Relation intent, receptive halo is readable |
| Main | Color Pin | Action Arc → Pin opens compact transient authoring |
| Main | Reference | reference pick does not mutate Selection |
| Main | Composer | compact 2–4 line visual height; internal scroll at cap |
| Main | Semantic Drop | drop target is direct spatial destination, not form-style chooser |
| Main | Focus | F shows Top Spatial Index, not large Focus list |
| Main | Search | Ctrl/Cmd+F shows compact Top Spatial Index Search |
| Main | Esc/outside | only top transient layer closes per action |
| Context | shared object gestures | same Selection/Reference/Arc/Pin/Composer physics as Main |
| Workflow | shared object gestures | same Selection/Reference/Arc/Pin/Composer physics as Main |

## 4. Voice real-device matrix

Use the real microphone and real provider. Do not use Playwright fake media for these rows.

| Case | Expected result |
|---|---|
| Mic permission Allow | same Composer morphs to Recording; no new panel/modal |
| Mic permission Deny | compact permission error; Retry/return-to-text available |
| Recording | Send and unrelated footer controls yield |
| Cancel during Recording | audio discarded; no transcription and no Send |
| Stop | same Composer enters Transcribing |
| Transcription success | transcript becomes ordinary editable prompt text |
| Existing typed prompt + Voice | transcript appends predictably; prior text preserved |
| Transcription failure | compact error; retry does not auto-send |
| Esc during Recording/Transcribing | Voice cancels first; Composer remains |
| Explicit Send after edit | only this action executes; stop/transcribe never executes automatically |

Capture at least one real end-to-end evidence record with:

```text
permission → recording → stop → whisper.cpp → editable text → manual edit → explicit Send
```

## 5. Zoom / DPI matrix

Review at Canvas zoom:

```text
25% · 35% · 60% · 100% · 150%
```

Review Windows display scaling:

```text
125% · 150%
```

At each meaningful combination, inspect:

- text/Object LOD remains intentional rather than fuzzy;
- Action Arc remains attached to the visual top-right corner;
- Composer placement does not collide with the dominant HUD;
- Color Pin local dots remain identity marks, not buttons;
- Top Spatial Index remains centered on active usable canvas, not physical browser center;
- Minimap Camera rect represents the active usable viewport;
- Map Locator stays on the active edge and is never hidden behind persistent edge UI;
- Camera does not move merely because edge UI width changes.

## 6. Occupied-region smoke

Use an existing persistent edge surface/rail at more than one width.

Check:

```text
persistent edge UI width changes
→ HUD / locator / minimap safe region changes
→ Camera remains stationary
```

Then explicitly Focus an object:

```text
Focus
→ Camera may move
→ object is framed inside remaining active region
```

This distinction is release-blocking for B0 Unified Work View.

## 7. Layering smoke

Exercise at least:

```text
Action Arc
→ Composer above Arc
→ Esc closes Composer first
→ second Esc closes Arc
```

and:

```text
Action Arc → Pin popover
→ outside/Esc closes only the current top local layer
```

No outside press should collapse two stacked transient owners at once.

## 8. Final decision

If any row exposes `WRONG_OWNER`, shared-surface parity failure, Camera movement from occupancy alone, Voice auto-send, or a legacy primary UI resurrected, Phase A admission is **FAIL** and the issue must be patched as one bounded proposition before re-running the affected rows.

If all required automated + real-device + human rows pass, create an explicit Phase A Closeout / Phase B Admission document. Do not infer admission from this runbook itself.
