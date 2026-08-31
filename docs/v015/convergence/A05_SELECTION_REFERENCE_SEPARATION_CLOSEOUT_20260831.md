# A05 Selection / Reference Separation Closeout

## Product Proposition

Selection and explicit Reference are different interaction truths.

```text
Click / Shift+Click
= Selection / additive Selection

Ctrl/Cmd+Click or Composer Reference Pick
= explicit this-run Reference
```

Opening or executing from a Selection must never manufacture ordered Reference IDs from that Selection.
Selection still remains foreground execution context and may be used as the direct target/input of the command.

---

## Source-Diff Gate

### Original / frozen sources

- `docs/v015/convergence/original/LCOS_0.1_INTERFACE_PRODUCTIZATION_CODEX_CONSTRUCTION_PLAN_20260816.md`
  - interface existence is not product completion;
  - UI changes require real consumer-path audit + acceptance.
- `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_对话选择与承接全链补齐_20260821.md`
  - Main / Context / Workflow share the same spatial interaction foundation.

### Latest L0 / reality sources

- `docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md`
- `docs/v015/convergence/THREE_SURFACE_INTERACTION_RULE_20260831.md`
- `docs/v015/convergence/VIDEO_LOVART_COMPOSER_REFERENCE_PICK_20260831.md`

Frozen rule:

```text
Selection != Reference
```

Lovart donor confirms the interaction sequence:

```text
Selection
→ explicit Compose
→ explicit Add Reference / Pick Mode
→ Reference strip
```

Selection alone does not populate Reference.

### Current construction clause

Phase A — Shared Spatial Kernel / Production Owner Cleanup.

A04 retired Selection as the owner of Composer activation.
A05 retires Selection as the owner of explicit execution Reference IDs.

### Current production owners audited

- `apps/web/src/features/execution/commandDraft.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/features/shell/CanvasSceneHost.tsx`
- `apps/web/src/features/surfaces/ConversationSpaceSurface.tsx`
- `apps/web/src/features/execution/UnifiedExecutionComposer.tsx`

Historical/static gates that encoded the old merged behavior were also audited and updated.

### Classification

`IMPLEMENTATION_GAP + WRONG_OWNER`

---

## Root Cause

The legacy helper:

```text
mergeExecutionReferenceIds(selectionIds, referenceIds, targetId)
```

merged both UI sets into one ordered list.

That meant:

```text
ordinary Selection
→ became orderedReferences
```

Even though the UI visually described Selection and References as separate concepts.

This was a semantic contradiction, not a styling issue.

---

## What Changed

### 1. `commandDraft.ts`

Removed the ambiguous helper and split the two truths explicitly.

#### Explicit Reference owner

```text
explicitExecutionReferenceIds(referenceIds, targetId)
```

Only consumes explicit `referenceIds`.

It:
- preserves explicit Reference order;
- deduplicates;
- removes the edit target if the same object was also explicitly referenced;
- never reads `selectionIds`.

#### Foreground execution context owner

```text
mergeExecutionContextIds(selectionIds, referenceIds, targetId)
```

Selection remains usable as foreground execution material without relabelling it as explicit Reference.

This separation is intentional:

```text
execution context
!=
ordered explicit references
```

---

### 2. Main Selection Composer execution

`selectionExecutionReferenceIds` now comes only from:

```text
selectionReferenceIds
```

`selectedIds` no longer enter ordered Reference candidates.

A separate:

```text
selectionExecutionContextIds
```

keeps selected Artifact material available to the Run / Proposal context.

So:

```text
Selected Artifact A
Explicit Reference B

orderedReferences = [B]
foreground context = [A, B]
```

For revise:

```text
Selected editable target A
Explicit Reference B

edit target = A
orderedReferences = [B]
foreground context = [B]
```

---

### 3. Context / Workflow surface execution

`CanvasSceneHost` now validates only `command.referenceIds` as explicit References.

A selected Surface object no longer fails Reference validation merely because it was selected.

`requestSurfaceAgentRun()` separately builds:

- explicit ordered References from `input.referenceIds`;
- foreground context from `input.selectionIds + input.referenceIds`.

This preserves the same grammar across Main / Context / Workflow.

---

### 4. Conversation Subcanvas

`ConversationSpaceSurface` was a fourth production consumer of the legacy merged helper.

It now derives Reference candidates only from:

```text
execution.command.referenceIds
```

Conversation timeline messages remain non-Project entities and cannot become fake References.

---

### 5. Composer language

The empty Reference tray now says:

```text
当前选择的 N 项是直接处理对象，不会自动记入参考。
```

This removes the old ambiguous wording that could be read as “Selection silently becomes Reference”.

---

### 6. Regression tests

Added pure unit coverage:

`apps/web/tests/commandDraft.test.ts`

It asserts:

- explicit Reference helper never consumes Selection;
- foreground execution context can contain Selection + explicit Reference while keeping them semantically separate.

Extended Browser E2E:

```text
Select Artifact A
→ open Composer explicitly
→ Reference chips = 0
→ current Selection = 1

Ctrl/Cmd+Click Artifact B
→ Reference chips = 1 (B)
→ A remains selected
→ B does not replace Selection
```

Hard invariant:

```text
Selection count != Reference count
```

---

## Legacy gates updated

Three older static gates encoded the pre-A05 merge implementation and would otherwise falsely reject the correct product semantics:

- `validate-v015-unified-composer-f6b.mjs`
- `validate-v015-cross-surface-execution-f6b.mjs`
- `validate-v015-r1c-unified-command-state.mjs`

They now verify:

```text
Selection context separate
+
explicit ordered References separate
```

rather than requiring `mergeExecutionReferenceIds`.

---

## Acceptance

- [x] Opening Composer over Selection creates zero explicit Reference chips.
- [x] `selectedIds` do not enter ordered Reference IDs.
- [x] Ctrl/Cmd+Click still adds/removes explicit Reference without replacing Selection.
- [x] Selection still participates as foreground execution context / direct target.
- [x] Edit target is excluded from both duplicate context/reference roles where appropriate.
- [x] Main uses the separated semantics.
- [x] Context / Workflow use the separated semantics.
- [x] Conversation Subcanvas uses the separated semantics.
- [x] Explicit Reference fail-close validation remains intact.
- [x] No new backend/runtime truth was added.
- [x] No Composer visual redesign was bundled.
- [x] One product proposition only.

---

## Tests actually run

### Source/static gates

- `node scripts/validate-v015-a05-selection-reference-separation.mjs` — **8/8 PASS**
- `node scripts/validate-v015-unified-composer-f6b.mjs` — **13/13 PASS**
- `node scripts/validate-v015-cross-surface-execution-f6b.mjs` — **8/8 PASS**
- `node scripts/validate-v015-r1c-unified-command-state.mjs` — **12/12 PASS**
- `node scripts/validate-v015-r2d-interaction-grammar.mjs` — **20/20 PASS**
- `node scripts/validate-v015-a04-selection-composer-ownership.mjs` — **4/4 PASS**
- `git diff --check` — **PASS**

### Typecheck

`npm run typecheck --workspace @local-creative-os/web` — **BLOCKED_ENV**

Actual errors remain the known extracted-RC dependency gap:

```text
TS2688 Cannot find type definition file for 'node'
TS2688 Cannot find type definition file for 'vite/client'
```

### Unit test

Test added but execution is `NOT_RUN / BLOCKED_ENV` because Vitest dependencies are not installed in the extracted RC.

### Browser E2E

Regression added but execution is `NOT_RUN / BLOCKED_ENV` for the same dependency/build reason.

### Manual product smoke

`NOT_RUN / BLOCKED_ENV`.

---

## Donor Conformance

Relevant donor:

- Lovart Composer / Reference Pick analysis.

Borrowed:

- Reference requires explicit intent;
- Reference Pick is temporary and does not replace Selection;
- task anchor stays stable while explicit reference state changes.

Explicitly not copied:

- Lovart taxonomy;
- layout;
- image/video-only assumptions;
- prompt model settings.

---

## Responsibility / Index updates

- Construction Context Index: **YES** — A05 is latest completed Phase A patch.
- GUI Responsibility Matrix: **YES** — old Selection→Reference merge is marked retired by A05.
- Mandatory Context: NO — no new L0 rule; this implements an existing freeze.
- Plan Diff Index: NO.
- Video Donor Index: NO.

---

## Remaining debt / next admissible proposition

Next deterministic Phase A proposition:

> **A06 — ExecutionItem controls must fail-close from `availableActions`; UI must not infer Cancel/Retry/Answer from status.**

Do not bundle Universal Orbit, Text morphology, or right-click redesign into A06.

---

## Verdict

Source/static acceptance: `PASS`.

Runtime/browser/manual verification: `BLOCKED_ENV`.

Overall evidence status: `BLOCKED_ENV`.

## STOP

Do not start A06 in the same patch.
