# LCOS v0.15 · Unified Compact Composer / Prompt / Reference / Voice GUI Freeze

Date: 2026-08-31
Status: PRODUCT FREEZE
Scope: Main / Context / Workflow / Glyth / Assembly
Primary donor lessons: Lovart / TapNow interaction hierarchy and local prompt behavior, translated into LCOS spatial grammar

---

# 0. Core verdict

LCOS prompt input is standardized as a **target-local Unified Compact Composer**.

It is NOT:
- a permanent side panel;
- a large modal;
- a generic inspector;
- a second Assembly;
- a second Object Action Menu.

The Composer is a local AI Work surface attached to the current Selection / Target.

```text
Selection / Target
├─ persistent spatial feedback
├─ Action Arc
└─ Unified Compact Composer
```

The visual goal is:

> lighter than Lovart / TapNow's large prompt panel, but equally direct and legible.

---

# 1. Command hierarchy freeze

LCOS separates four responsibilities.

## 1.1 Action Arc

Purpose:

```text
“What can I do to this object immediately?”
```

Owns:
- high-frequency direct object actions;
- 3 default actions / 4 maximum;
- overflow → More.

Visual:
- top-right corner-hugging short arc;
- no visible orbit track;
- transient;
- light.

Does NOT own:
- large prompt editing;
- management/destructive actions;
- component-specific functional controls.

---

## 1.2 Right-click / More

Purpose:

```text
“How do I manage / organize / configure this object?”
```

Owns secondary commands such as:
- Rename
- Duplicate
- Copy / Copy Reference
- Move / Add to...
- Align / Distribute / Tidy
- Collection / Colony
- Export
- Inspect / Properties
- Hide / Lock if retained
- Delete

It must not duplicate the entire Action Arc.

---

## 1.3 Unified Compact Composer

Purpose:

```text
“What do I want AI / the active workflow to do with this target?”
```

Owns:
- Prompt
- Reference
- Skill / Tool selection when relevant
- generation / execution parameters
- Voice input
- Run / Send
- Stop / Retry state

It does NOT own:
- Rename
- Delete
- Pin navigation
- Relation
- Align
- Collection / Colony management

---

## 1.4 Component Functional Face

Surface Components keep their intrinsic business controls inside the Component itself.

Examples:
- Structure navigation
- Workflow Review controls
- Checkpoint actions
- Skill composition UI
- Layout instrument controls

These controls are not copied into Action Arc or Composer.

---

# 2. Single-click behavior

For content-like Project Objects, a stable single click may show:

```text
Selection feedback
+ Action Arc
+ Compact Composer
```

This is allowed and is now part of the intended LCOS grammar.

However:

```text
pointerdown
→ Selection intent

drag detected
→ drag continues
→ Composer must not steal focus / reflow during drag

stable click / pointerup without drag
→ Action Arc + Composer appear
```

The Composer must not automatically steal keyboard focus merely because the object became selected.

Focus enters Composer when:
- user clicks the input;
- user starts a dedicated typing shortcut;
- user invokes Voice / Reference / AI Work.

---

# 3. Composer placement

Default placement:

```text
Action Arc
→ top-right of target

Compact Composer
→ below / near the target
```

They should not occupy the same visual region.

Composer placement must use shared placement geometry and occupied rect awareness where available.

It must not:
- cover the target body unnecessarily;
- overlap persistent Color Pin markers;
- cover the Action Arc;
- cover critical Relation / drag affordances.

---

# 4. Default visual size

The Composer is intentionally small.

## 4.1 Idle

Default visible prompt area:

```text
1–2 lines
```

The full Composer should read like a local command surface, not a mini chat window.

## 4.2 Typing

Text area grows gradually:

```text
1 line
→ 2 lines
→ 3–4 visible lines maximum
```

After the height cap:

```text
internal textarea scroll
```

The whole Composer does not continue growing indefinitely.

## 4.3 Long prompt

Long text must not continuously push the surrounding canvas.

The interaction lesson taken from Lovart is:

```text
prompt content grows
→ local text region scrolls
→ outer Composer footprint remains bounded
```

---

# 5. Reference system

Reference is part of Composer context, not Selection.

Core rule:

```text
Selection ≠ Reference
```

Selection answers:

```text
“What am I operating on?”
```

Reference answers:

```text
“What supporting material should this AI operation use?”
```

---

# 6. Explicit Reference UI

Composer contains an explicit Reference affordance.

Candidate presentation:

```text
[ + Reference ]
```

or compact icon/button.

After addition:

```text
[thumbnail A] [thumbnail B] [+2]
```

Reference chips / thumbnails exist primarily to confirm identity.

They should not:
- duplicate the full node UI;
- become another list inspector;
- mutate Selection.

Hover / click may show:
- object title;
- species;
- remove action;
- locate / inspect if useful.

---

# 7. Ctrl/Cmd Reference Pick

Fast path:

```text
Composer active
+ Ctrl/Cmd + click Project Object
→ add as Reference
→ Selection remains unchanged
```

This is a shortcut / accelerator.

It must not be the only way to add a Reference.

Explicit Add Reference remains available for discoverability.

Reference Pick mode:
- may use temporary highlight;
- Esc exits Reference Pick while keeping Composer alive;
- it does not create Relation;
- it does not create Pin;
- it does not change canonical Selection.

---

# 8. Composer footer

The footer is the compact control strip.

Recommended hierarchy:

```text
left
→ Reference / Voice / auxiliary context

middle
→ lightweight task parameters

right
→ Model / Run / Send / Stop
```

Exact controls depend on mode.

Examples:

Object/image work:
- aspect ratio
- output count
- quality
- model

Workflow work:
- Skill / tool
- execution target
- run mode

Do not expose irrelevant parameters on every Composer.

---

# 9. Progressive parameter disclosure

Lovart donor lesson:

- frequently checked parameters stay compact;
- complex settings open as anchored popovers;
- the user stays in the same local worksite.

LCOS adopts this pattern.

Examples:

```text
Model
→ anchored model picker

Aspect ratio / size
→ anchored size popover

Quality
→ small option popover

Advanced
→ secondary panel only when explicitly requested
```

Do not open a full Inspector for every small parameter change.

Do not place every advanced parameter permanently inside the Composer.

---

# 10. Voice input

Voice is a **Unified Composer input modality**.

It is NOT:
- a separate Voice panel;
- a separate screen;
- a separate product subsystem in GUI.

All Composer surfaces reuse the same Voice primitive.

---

# 11. Voice state machine

Frozen behavior:

```text
Idle
↓
Recording
↓
Transcribing
↓
Editable Text
↓
Explicit Send
```

## 11.1 Idle

Compact right-side controls may contain:

```text
🎙  parameters  Send
```

## 11.2 Recording

The same control region morphs in place:

```text
🎙  waveform  Cancel/Stop
```

During Recording:
- Send / output count / unrelated controls yield;
- Composer width should remain stable;
- waveform should be short and readable;
- no large Voice overlay is opened.

## 11.3 Transcribing

Show a lightweight transcription state.

No automatic execution.

## 11.4 Editable Text

STT result becomes ordinary editable prompt text.

User may:
- correct words;
- add references;
- change Skill / model / params;
- append typing;
- discard.

## 11.5 Send

Execution requires an explicit Send / Run action.

Never automatically execute merely because recording ended.

---

# 12. Voice implementation direction

Do not invent a custom ASR engine.

Recommended architecture:

```text
microphone capture / MediaRecorder
↓
mature Speech-to-Text provider adapter
↓
transcribed text
↓
Unified Composer text model
```

Provider remains replaceable.

Browser-native speech APIs may be used as fallback / experiment, but must not be the sole production semantic dependency.

---

# 13. Target adapters

One Composer shell, multiple canonical target adapters.

```text
UnifiedCompactComposer
├─ ObjectWorkAdapter
├─ MultiSelectionWorkAdapter
├─ GlythSpeakAdapter
├─ WorkflowWorkAdapter
└─ AssemblyInstructionAdapter
```

Shared:
- text input
- Reference
- Voice
- parameter shell
- Send / Stop
- keyboard / Esc lifecycle
- placement grammar

Different:
- canonical target identity
- allowed tools / skills
- task parameters
- execution backend
- output handling

---

# 14. Object Work

For content-like Artifacts:

```text
target = selected Project Object / Selection
mode = object work
```

Default behavior:
- stable click may show Compact Composer;
- Reference is optional;
- Composer is local to the selected object(s).

Suitable:
- text
- image
- video
- link / HTML where AI work is meaningful
- generated result Artifacts

---

# 15. Multi-selection Work

For multiple selected Project Objects:

```text
target = Selection
```

Important:

```text
Selection members
≠ automatic References
```

The current Selection defines the task target.

References remain separately user-authored.

Composer should remain compact even for large Selection counts.

Use a small Selection identity summary:

```text
3 selected
```

not three duplicated full cards.

---

# 16. Glyth Speak

Glyth uses the same Composer shell but a different target adapter.

```text
mode = Glyth Speak / Conversation Work
target = canonical Conversation / active receiver identity
```

Single-click may show:
- Glyth Action Arc;
- compact Speak Composer.

Do not build a separate visually unrelated `GlythPromptBox`.

Do not infer target identity from title/provider/time.

---

# 17. Surface Component relationship

Surface Components are Spatial Instruments.

Default rule:

> A structural Component does not automatically show a generic Prompt Composer merely because it was selected.

For a Component:
- intrinsic work lives in Component Functional Face;
- lifecycle actions live in Action Arc;
- management lives in Right-click;
- AI Work opens Composer only from an explicit AI / Work affordance.

Exception:
A Component whose primary product function is AI instruction may explicitly own an always-available Compact Composer as part of its functional face.

This must be species-specific, not universal.

---

# 18. Assembly relationship

Assembly remains a project-level shared Workspace / warehouse.

It is NOT a “large Composer mode”.

Assembly core work:
- browse;
- select;
- drag/drop;
- inspect;
- admission validation;
- target/source composition.

Prompt is an enhancement layer.

Assembly uses the same Compact Composer only when AI instruction is requested.

Example:

```text
current Assembly target
+ selected warehouse material
+ prompt
→ candidate assembly mutation
→ validate
→ preview
→ commit
```

Prompt execution must not silently mutate canonical project truth without the Assembly mutation gate.

---

# 19. Assembly Composer

Assembly Composer reuses:
- Voice
- Reference UI
- compact prompt behavior
- parameter/popover grammar

But target identity is Assembly-specific:

```text
target = current Assembly target
mode = Assembly Instruction
```

It must not create another private warehouse inside a Component or Glyth.

---

# 20. Search / Focus / Pin relationship

Composer remains distinct from spatial navigation systems.

```text
Composer
= “What should AI do?”

Color Pin
= “Which user-authored spatial group?”

Focus
= “Where does this known object occur?”

Search
= “Find an object I do not yet know exactly.”

Map Locator
= “The target is in that direction.”
```

Composer may reference or operate on results from these systems, but does not replace them.

---

# 21. Persistent vs transient hierarchy

Persistent spatial feedback must survive transient AI UI.

Persistent:
- Selection outline / group bounds;
- Color Pin dots;
- Component / Map Locator state;
- canonical spatial projection.

Transient:
- Action Arc;
- Compact Composer;
- parameter popovers;
- Reference Pick mode;
- Voice Recording state.

Opening Composer must not erase Selection feedback.

Opening Action Arc must not hide Color Pin markers.

---

# 22. Esc / outside behavior

Recommended lifecycle:

```text
parameter popover
→ Esc closes popover first

Reference Pick
→ Esc exits Reference Pick, Composer stays

Voice Recording
→ Esc / cancel stops recording without sending

Composer text focus
→ Esc may release focus / close Composer according to top overlay owner

Action Arc
→ yields according to transient owner rules
```

Outside click must respect overlay ownership and must not immediately close the Composer on the same pointer sequence that opened it.

---

# 23. Keyboard

Recommended keyboard grammar:

```text
Enter
→ newline or task-specific behavior depending on editor mode

Cmd/Ctrl + Enter
→ Send / Run

Esc
→ layered dismissal

Cmd/Ctrl + click
→ Reference accelerator while Composer active
```

Exact key behavior must remain consistent across Main / Context / Workflow / Glyth / Assembly.

---

# 24. Visual weight hierarchy

Desired hierarchy:

```text
Project Object / Component body
= primary spatial content

Selection / Color Pin
= persistent spatial feedback

Action Arc
= light transient direct actions

Compact Composer
= local AI Work surface

Right-click
= management layer

Advanced parameter popover
= secondary transient layer
```

Do not let Composer become visually heavier than the object unless the user explicitly expands it.

---

# 25. Expanded Composer

A small expand affordance may exist.

```text
Compact
→ Expanded local editor
```

Expanded mode is user-requested, not default.

It may provide:
- larger text editor;
- deeper Reference management;
- history/version view;
- advanced task settings.

But it must still preserve the current target identity.

Expansion does not turn the Composer into a generic chat page.

---

# 26. History / previous prompts

Do not copy Lovart's tendency to let old prompt/history text accumulate indefinitely inside the current editable prompt region.

Separate:
- current editable prompt;
- recent versions / prior task prompts;
- generated output history.

History may be:
- collapsed;
- chips;
- version lens;
- dedicated history popover.

Current prompt must remain visually obvious.

---

# 27. Species-sensitive parameters

Composer shell is shared, parameter vocabulary is not.

Image:
- model
- size / aspect
- quality
- count

Text:
- model / skill
- format / tone if needed

Workflow:
- skill / executor / run target

Glyth:
- conversation target / active receiver state

Assembly:
- mutation / arrangement instruction context

Do not show irrelevant image-generation controls on every object species.

---

# 28. No automatic canonical mutation from prompt

AI Work follows the broader LCOS fail-close principle.

Where the prompt changes project structure:

```text
prompt
→ Candidate mutation
→ Validate
→ Preview / receipt
→ Commit
```

This is mandatory for:
- Assembly composition;
- bulk organization;
- Context / Workflow restructuring;
- Relation creation when AI-generated;
- destructive project mutations.

Pure content generation may return a generated Artifact/output through the normal return path.

---

# 29. A-stage implementation ownership

This freeze informs the remaining Phase A interaction closeout.

Recommended implementation decomposition:

## A22 · Object-local Interaction Grammar

- Selection visual feedback retained;
- Action Arc morphology / command split;
- Composer invocation regression fixed;
- local Composer / Action Arc coexistence;
- Right-click duplication removed;
- persistent vs transient owner hierarchy.

## A23 · Unified Compact Composer Grammar

- bounded textarea growth;
- internal scrolling;
- Reference chips / thumbnails;
- Ctrl/Cmd Reference accelerator;
- compact footer;
- anchored parameter popovers;
- stable placement.

## A24 · Voice Input Primitive

- reusable microphone capture;
- Recording morph;
- waveform;
- Transcribing;
- editable text;
- explicit Send.

Exact numbering may be consolidated if implementation proves tightly coupled, but product propositions must remain separately testable.

---

# 30. C-stage relationship

Phase C may build richer:
- Assembly Instruction flows;
- Context AI mutation;
- Workflow AI work;
- Skill Builder AI assistance.

They must reuse this Composer grammar rather than create new prompt systems.

---

# 31. D-stage relationship

Phase D only polishes:
- exact Composer width/height;
- radii/material;
- typography;
- transitions;
- waveform motion;
- parameter popover material;
- Reference chip styling;
- Action Arc / Composer choreography.

D must not redefine:
- target semantics;
- Reference vs Selection;
- Voice state machine;
- command ownership.

---

# 32. Final freeze

The following is now frozen:

1. Unified Composer is a local Compact Composer anchored to the current Selection/Target.
2. Content-like objects may show Action Arc + Compact Composer on stable single click.
3. Composer must not steal focus during drag initiation.
4. Default Composer is small; prompt text grows only to a bounded height, then internally scrolls.
5. Selection and Reference are separate truths.
6. Reference uses compact thumbnail/chip identity confirmation.
7. Ctrl/Cmd + click is a Reference accelerator and never mutates Selection.
8. Composer footer carries compact task parameters and execution controls.
9. Complex parameters use anchored popovers / dropdowns, not automatic full Inspector expansion.
10. Voice is an input mode of Unified Composer, not a separate tool surface.
11. Voice lifecycle is Idle → Recording → Transcribing → Editable Text → Explicit Send.
12. Voice transcription never auto-executes.
13. Main / Context / Workflow / Glyth / Assembly reuse the same Composer shell and input primitives.
14. Canonical target adapters remain mode-specific.
15. Glyth Speak uses Unified Composer rather than a separate prompt UI.
16. Structural Surface Components do not automatically open generic Composer on selection.
17. Component-specific work remains in the Component Functional Face.
18. Assembly remains a standalone project-level Workspace; prompt is an enhancement layer only.
19. Persistent Selection / Color Pin / Locator feedback remains visible while transient Composer / Action Arc is open.
20. AI structural mutations remain Candidate → Validate → Preview → Commit.
21. Current editable prompt is not mixed indefinitely with prompt history.
22. Shared Composer shell does not imply shared species parameters.
