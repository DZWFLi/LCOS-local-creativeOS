# LCOS v0.15 · A07 Project Navigation Ownership Closeout

日期：2026-08-31
Patch：A07 · Project Navigation Ownership
Base HEAD：`24f9cef069bcab467fb86b49034995bd60a98631`
阶段：Phase A · Shared Spatial Kernel / Production Owner Cleanup

---

## Product Proposition

普通 Project 打开必须继续当前 Project Continuity：

```text
ordinary Project open
→ same browser tab
→ canonical openProject(projectId)
→ /projects/:id
```

新标签不得继续作为默认 Project owner；如果未来保留，只能作为显式 secondary action。

---

## Source-Diff Gate

### Original user / freeze

- `docs/v015/convergence/original/LCOS_0.1_INTERFACE_PRODUCTIZATION_CODEX_CONSTRUCTION_PLAN_20260816.md`
  - interface existence is not product completion;
  - consumer path must be authoritative and actually wired;
  - no stale fallback / second truth remains after closeout.
- `LCOS_0.1_三大独立视图组件化详细施工总稿_v03_对话选择与承接全链补齐_20260821.md`
  - Project / Surface continuity is preserved through shared infrastructure;
  - each construction slice closes its own Done / Acceptance before the next slice.

### Latest explicit override / reality feedback

- `docs/v015/convergence/GUI_PRODUCTION_OWNER_AUDIT_20260830.md`
  - `openProject()` same-tab continuity already exists;
  - old Phase-A `openProjectInNewTab()` still owned Drive / Assembly production entry;
  - ordinary click must use same-tab continuity.
- `docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md`
  - Project navigation is continuity, not a launcher-new-tab default.

### Current production owner before A07

```text
ProjectDrive.onOpen       → openProjectInNewTab
Assembly.onOpenProject    → openProjectInNewTab
```

### Correct owner already present

```text
openProject(projectId)
```

### Classification

`IMPLEMENTATION_GAP + WRONG_OWNER`

---

## Implementation

### 1. Drive uses canonical same-tab open

`App.tsx` now wires:

```text
drive.onOpen → openProject
```

The Project portal itself remains a normal `onClick`, so ordinary Project open no longer creates a second browser tab.

### 2. Assembly uses the same owner

`capture.onOpenProject` now points to `openProject` as well.

Assembly target double-click therefore returns to the chosen Project in the same browser tab.

### 3. Assembly shell closes only when Project open succeeds

Runtime mode:

```text
loadProject success
→ setCaptureSpaceOpen(false)
→ applyProjectState(...)
```

Prototype mode performs the same transition synchronously.

A failed runtime load does not first throw the user out of the Assembly workspace.

### 4. Legacy default new-tab owner retired

Removed:

```text
openProjectInNewTab
window.open(projectUrl, '_blank', ...)
```

from the default Project navigation path.

No new explicit “Open in New Tab” UI was invented in A07. If that secondary capability is desired later, it must live in an explicit secondary action such as Right-click / More.

### 5. Browser regression guard added

`tests/e2e/project-navigation-continuity.spec.ts` asserts:

- Project Drive click keeps the same page count;
- Project URL becomes `/projects/:id`;
- Canvas appears;
- Assembly project double-click also stays in the same tab and returns to the Project.

---

## Files changed

- `apps/web/src/App.tsx`
- `scripts/validate-v015-a07-project-navigation-ownership.mjs`
- `tests/e2e/project-navigation-continuity.spec.ts`
- `docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md`
- `docs/v015/convergence/GUI_PRODUCTION_OWNER_AUDIT_20260830.md`
- `docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md`
- `docs/v015/convergence/A07_PROJECT_NAVIGATION_OWNERSHIP_CLOSEOUT_20260831.md`

---

## Acceptance

- [x] Project Drive ordinary open consumes `openProject()`.
- [x] Assembly ordinary project open consumes the same `openProject()`.
- [x] `openProjectInNewTab` no longer exists as a production owner.
- [x] Default Project open no longer calls `window.open(..., '_blank')`.
- [x] Same-tab URL remains canonical `/projects/:id`.
- [x] Assembly/Capture shell closes on successful Project open.
- [x] Runtime load failure does not prematurely close Assembly.
- [x] Browser regression spec added.
- [x] Static A07 gate added and PASS.
- [x] Existing spatial / interaction / A04-A06 gates remain PASS.
- [x] `git diff --check` PASS.
- [ ] Web TypeScript typecheck: `BLOCKED_ENV` because extracted RC lacks Node/Vite type packages.
- [ ] Browser Playwright execution: `BLOCKED_ENV` under the same dependency environment.

---

## Tests actually run

### PASS

```text
node scripts/validate-v015-a07-project-navigation-ownership.mjs
→ 5/5 PASS
```

```text
node scripts/validate-v015-spatial-navigation-f6a2.mjs
→ 14/14 PASS
```

```text
npm run check:v015-r2d
→ 20/20 PASS
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
node scripts/validate-v015-a06-execution-fail-close.mjs
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

No TypeScript / Browser E2E PASS is claimed.

---

## Manual Product Smoke

`BLOCKED_ENV`

Required later in dependency-enabled Web runtime:

1. `/projects` → click a Project → same tab enters Project Canvas;
2. browser tab count does not increase;
3. back to Project list → open another Project → current tab switches continuity correctly;
4. Assembly → double-click Project → same tab enters selected Project;
5. failed project load leaves user in the previous viable shell with an error notice;
6. Project navigation state for the previous Project is restored when returning.

---

## Donor Conformance

Not applicable. A07 is production ownership / navigation continuity only; no visual or motion craft changed.

---

## Owner Retirement Proof

Retired:

```text
openProjectInNewTab
```

as the default owner for:

```text
Project Drive
Assembly project target
```

Canonical owner after A07:

```text
openProject(projectId)
```

---

## Index Updates

- Context Index changed? **YES** — A07 closeout added; next proposition moved to A08.
- Mandatory Context changed? **NO** — no new L0 product decision.
- Plan Diff Index changed? **NO** — no newly discovered plan gap.
- Video/Code Donor Index changed? **NO** — no donor change.
- Responsibility Matrix changed? **YES** — default new-tab owner marked retired.
- Production Owner Audit changed? **YES** — A07 production wiring recorded.
- FullE2E Index changed? **NO** — browser evidence remains later environment gate.

---

## Explicitly Not Done

- no explicit Open-in-New-Tab secondary action added;
- no Project Drive visual redesign;
- no ProjectGlazeMark work;
- no Assembly presentation redesign;
- no Text editing work;
- no Universal Orbit / Right-click work;
- no backend/schema change.

---

## Next Admissible Proposition

A08 · Canonical Text Edit Wiring

```text
ordinary Text edit
→ canonical Core text revision
→ same Project Artifact truth

not
→ fork / duplicate confirmation first
```

The legacy fork-before-edit path is reviewed and retired only within that single proposition.

---

## Verdict

`BLOCKED_ENV` for full browser/runtime verification.

A07 source ownership and executable static acceptance are closed and PASS.
No Browser / TypeScript PASS is claimed.

## STOP

Do not start A08 automatically.
