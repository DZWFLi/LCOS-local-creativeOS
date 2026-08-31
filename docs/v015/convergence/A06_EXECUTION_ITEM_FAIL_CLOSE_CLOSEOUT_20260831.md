# A06 ExecutionItem Fail-Close Closeout

日期：2026-08-31

## Product Proposition

Runtime control visibility belongs to canonical `ExecutionItemV1.availableActions`.

```text
Core ExecutionItemV1
→ availableActions
→ Web runtime action controls
```

The Web UI must never reconstruct `cancel / retry / answer_input` from `ActiveRun.status`, provider state, Bridge state, or missing-read-model fallback.

Missing `ExecutionItemV1` or missing action means:

```text
action unavailable
→ control hidden
```

Review / Proposal actions remain a separate review truth and are not forced into the seven-state `ExecutionItemV1` model.

---

## Baseline

- Repo: `/mnt/data/lcos_full_src`
- Branch: `gpt/v015-a06-execution-fail-close`
- Patch base: `5a50dc61ce4b327d051293c01d62219872d3b728`
- Patch head: commit containing this closeout
- Worktree before: clean
- Overall phase: Phase A · Shared Spatial Kernel / Production Owner Cleanup
- Previous patch: A05 · Selection / Reference Separation

---

## Source-Diff Gate

### Original user / freeze

- `docs/v015/convergence/original/LCOS_0.1_INTERFACE_PRODUCTIZATION_CODEX_CONSTRUCTION_PLAN_20260816.md`
  - interface existence is not product completion;
  - consumer-path wiring + real acceptance are mandatory;
  - no second/fallback truth source is allowed for convenience.
- `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_对话选择与承接全链补齐_20260821.md`
  - shared Surface infrastructure is reused rather than re-invented per Surface;
  - every construction package closes its own Done / Acceptance before the next package.

### Latest explicit override / canonical runtime truth

- root `AGENTS.md` §2.1:
  - `ExecutionItemV1` is canonical UI-facing execution projection;
  - Web / Companion render controls from `availableActions` only;
  - missing item/action must fail-close;
  - provider/Bridge/local status must not infer runtime controls.
- `docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md`
- `docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md`
- Backend P0 / Execution HUD integration closeout retained as semantic provenance.

### Latest reality feedback

No new L0 visual behavior was invented in A06.
This patch closes an already-audited owner regression before the larger Context / Workflow visual convergence.

### Current construction clause

Phase A — canonical execution control owner cleanup.

### Production owners audited

- `apps/web/src/App.tsx`
- `apps/web/src/features/workrail/WorkRail.tsx`
- `apps/web/src/features/surfaces/WorkSurface.tsx`
- `apps/web/src/features/surfaces/DeliverSurface.tsx`
- `apps/web/src/features/surfaces/surfaceContracts.ts`
- `scripts/validate-execution-item.mjs`

### Competing / stale owners found

1. `App.tsx`
   - `ExecutionItem.availableActions ?? ActiveRun.status-derived fallback`.
2. `WorkRail.canAct()`
   - `undefined` actions meant **allow**, which silently reopened the fail-open path.
3. `WorkRail ReviewState`
   - runtime retry button bypassed `runActions` entirely.
4. `WorkSurface`
   - Cancel / Retry / Answer controls derived directly from `active.status` / `inputRequest`.
5. `DeliverSurface`
   - Retry derived directly from `activeRun.status === 'failed'`.

### Classification

`IMPLEMENTATION_GAP + WRONG_OWNER`

---

## Root Cause

The canonical read model had already been integrated, but Web still retained multiple legacy presentation fallbacks.

The most visible fallback was:

```text
executionItems.find(... )?.availableActions
?? derive actions from activeRun.status
```

Even removing that expression alone was insufficient because `WorkRail` interpreted missing actions as unrestricted:

```text
runActions === undefined || runActions.includes(action)
```

and dedicated Work / Deliver surfaces independently rendered controls from status.

Therefore the real owner census was broader than one line in `App.tsx`.

---

## Implementation

### 1. One active canonical action projection

`App.tsx` now derives once:

```text
activeRun
→ matching ExecutionItemV1
→ availableActions
→ [] when missing
```

`activeRunActions` is then passed to:

- WorkRail;
- WorkSurface runtime;
- DeliverSurface runtime.

No status-derived fallback remains.

### 2. WorkRail is strict fail-close

`canAct()` now returns true only when the canonical action is explicitly present.

```text
undefined / missing
→ false
```

Review-state `retry` also consumes the same gate.

Accept / Reject / Review remain owned by pending Review truth, not ExecutionItem runtime actions.

### 3. WorkSurface uses canonical runtime actions

The dedicated Work surface now requires:

```text
cancel       ∈ runActions
retry        ∈ runActions
answer_input ∈ runActions
```

before exposing those controls.

A waiting-input question may still be visible as information, but answer choices / free-text submit controls disappear when `answer_input` is unavailable.

### 4. DeliverSurface retry uses canonical runtime action truth

The Deliver review/result surface no longer equates `failed` status with retry permission.

Review buttons continue to use independent review truth.

### 5. Canonical S1 gate strengthened

`check:v015-s1` now rejects regressions where:

- App reconstructs actions from status;
- WorkRail treats missing actions as allowed;
- Review retry bypasses `availableActions`;
- WorkSurface bypasses cancel/retry/answer gates;
- Deliver retry bypasses canonical actions.

### 6. Dedicated A06 gate added

`scripts/validate-v015-a06-execution-fail-close.mjs`

covers the exact proposition independently from the broader S1 gate.

---

## Files changed

- `apps/web/src/App.tsx`
- `apps/web/src/features/workrail/WorkRail.tsx`
- `apps/web/src/features/surfaces/WorkSurface.tsx`
- `apps/web/src/features/surfaces/DeliverSurface.tsx`
- `apps/web/src/features/surfaces/surfaceContracts.ts`
- `scripts/validate-execution-item.mjs`
- `scripts/validate-v015-a06-execution-fail-close.mjs`
- `docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md`
- `docs/v015/convergence/GUI_PRODUCTION_OWNER_AUDIT_20260830.md`
- `docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md`
- `docs/v015/convergence/A06_EXECUTION_ITEM_FAIL_CLOSE_CLOSEOUT_20260831.md`

---

## Acceptance

- [x] Missing ExecutionItem produces `runActions=[]`.
- [x] App contains no status-derived Cancel/Retry/Answer fallback.
- [x] WorkRail missing action state fails closed.
- [x] WorkRail review Retry cannot bypass canonical actions.
- [x] WorkSurface Cancel is action-gated.
- [x] WorkSurface Retry is action-gated.
- [x] WorkSurface Answer UI is action-gated.
- [x] DeliverSurface Retry is action-gated.
- [x] Review / Proposal controls remain independent review truth.
- [x] Canonical S1 static gate protects the ownership rule.
- [x] Dedicated A06 gate protects the exact patch proposition.
- [x] `git diff --check` passes.
- [ ] Web TypeScript typecheck: blocked by extracted-RC dependency environment.
- [ ] Manual browser product smoke: blocked by same environment.

---

## Tests actually run

### PASS

```text
node scripts/validate-v015-a06-execution-fail-close.mjs
→ 8/8 PASS
```

```text
npm run check:v015-s1
→ PASS
```

```text
npm run check:v015-r2d
→ 20/20 PASS
```

```text
node scripts/validate-v015-spatial-navigation-f6a2.mjs
→ 14/14 PASS
```

```text
node scripts/validate-v015-a04-selection-composer-ownership.mjs
→ 4/4 PASS
```

```text
node scripts/validate-v015-a05-selection-reference-separation.mjs
→ 8/8 PASS
```

```text
npm run check:v015-r1c
→ 12/12 PASS
```

```text
git diff --check
→ PASS
```

### BLOCKED_ENV

```text
npm run typecheck --workspace @local-creative-os/web
```

Actual failure:

```text
TS2688 Cannot find type definition file for 'node'
TS2688 Cannot find type definition file for 'vite/client'
```

The extracted RC does not contain the dependency installation required for Web typecheck / browser runtime.
No PASS is claimed for TypeScript, Browser E2E, or manual visual smoke.

---

## Manual product smoke

`BLOCKED_ENV`

Required later in a real dependency-enabled Web environment:

1. active queued/running Run with `cancel` omitted → no Cancel control anywhere;
2. active failed Run with `retry` omitted → no Retry control in Rail, Work, Deliver;
3. waiting-input Run with `answer_input` omitted → question may remain visible, but no answer buttons/form;
4. the same states with canonical actions present → controls appear;
5. pending Review still exposes Review/Accept/Reject independently of ExecutionItem runtime controls.

---

## Donor Conformance

Not applicable to visual craft in this patch.
A06 changes runtime truth ownership only and does not alter motion, material, camera, or component morphology.

---

## Owner retirement proof

Retired:

```text
ActiveRun.status
provider status
missing ExecutionItem
```

as owners that can synthesize runtime action availability in Web.

Canonical owner after A06:

```text
Local Core ExecutionItemV1.availableActions
```

Review actions remain:

```text
Pending Review / Proposal truth
```

which is intentionally separate.

---

## Index updates

- Context Index changed? **YES** — A06 closeout added; next proposition moved to A07.
- Mandatory Context changed? **NO** — no new L0 product decision.
- Plan Diff Index changed? **NO** — no newly discovered plan-fidelity gap.
- Video/Code Donor Index changed? **NO** — no donor change.
- Responsibility Matrix changed? **YES** — ExecutionItem fail-close marked done by A06.
- Production Owner Audit changed? **YES** — known fallback marked retired.
- FullE2E Index changed? **NO** — browser/native verification remains a later environment gate.

---

## Remaining debt discovered in this patch

1. Web typecheck/browser runtime cannot be executed in the extracted RC because dependencies are absent.
2. A real browser state matrix must still prove the static fail-close gates against live Core `execution-items` responses.
3. `WorkRail` still contains provider-recovery controls; those are reconnect/recovery actions, not Run mutation controls, and were explicitly left outside A06.
4. Review/Proposal UX remains visually legacy and will be handled in later Surface convergence; A06 does not redesign it.

---

## Explicitly not done

- no Universal Orbit work;
- no Context / Workflow component redesign;
- no Text editing changes;
- no Project navigation changes;
- no Right-click / Pin work;
- no visual/motion polish;
- no runtime schema change;
- no backend change.

---

## Next admissible proposition

A07 · Project Navigation Ownership

```text
ordinary Project open
→ same-tab Project Continuity

new tab
→ explicit secondary action only
```

Do not start A07 until this closeout is reviewed.

---

## Verdict

`BLOCKED_ENV` for full GUI/runtime verification.

The A06 source proposition and executable static gates are closed and PASS.
No Browser / Manual / TypeScript PASS is claimed.

## STOP

Do not start the next patch automatically.
