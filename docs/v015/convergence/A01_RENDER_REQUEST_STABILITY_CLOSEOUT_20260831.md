# A01 Render / Request Stability Closeout

## Product Proposition

Stable semantic inputs must not become unstable React reference dependencies that repeatedly write Active Context or re-read conversation reach. A quiet canvas must remain quiet.

## Source-Diff Gate

### Original user / freeze

- `docs/v015/convergence/original/LCOS_0.1_INTERFACE_PRODUCTIZATION_CODEX_CONSTRUCTION_PLAN_20260816.md`
  - Interface existence is not product completion.
  - UI-touched Sessions require manual smoke and explicit Acceptance before continuing.
- 2026-08-21 Spatial Surface master: Main / Context / Workflow share the same spatial engine and common interaction primitives.

### Latest explicit override

- `docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md`
- `docs/v015/convergence/CONSTRUCTION_SOP_FINAL_FROZEN_20260831.md`

### Latest reality feedback

- Production audit identified App-level render/request feedback risk from per-render `URLSearchParams` identity and per-render surface execution callbacks.
- Uploaded incoming patch `0001-fix-gui-runtime-stability-orbit-lifecycle-ecosystem-.patch` independently contains the same P0 stability diagnosis.

### Current construction clause

Phase A — Shared Spatial Kernel / Production Owner Cleanup, P0 render/request stability before further interaction work.

### Current production owner

- `apps/web/src/App.tsx` owns Active Context write inputs and surface execution callback construction.
- `apps/web/src/features/shell/CanvasSceneHost.tsx` owns surface reach read lifecycle.

### Classification

`IMPLEMENTATION_GAP`

---

## What changed

### `App.tsx`

- derives stable primitive `launchHarness` once per render and uses that primitive in the Active Context effect dependency list instead of the newly-created `URLSearchParams` object;
- hoists `readConversationReach` into `useCallback`;
- both Context and Workflow surface execution projections now receive the stable callback rather than new inline async functions every render.

### `CanvasSceneHost.tsx`

- stores `onReadReach` in a ref;
- reach effect depends only on semantic triggers (`agentNode`, receiver id), not the entire per-render `surfaceExecution` object;
- reach count updates are equality guarded so receiving the same count does not schedule a pointless state update.

### Regression evidence

Added `tests/e2e/render-stability-request-count.spec.ts`:

- idle canvas request-count guard;
- repeated-selection bounded request-count guard;
- `Maximum update depth exceeded` guard.

The counter is installed *before* the measured interaction window so selection-time requests are actually measured.

---

## Old owner retired

No alternate product owner is retired in A01. This patch removes unstable reference identity from the existing canonical owners only.

---

## Acceptance

- [x] Active Context effect no longer depends on `launchSearchParams` object identity.
- [x] Context/Workflow `onReadReach` callback is stable at the App boundary.
- [x] Surface reach effect no longer depends on the whole `surfaceExecution` object.
- [x] Same reach count does not cause redundant state mutation.
- [x] Browser regression spec exists for idle and repeated-selection request storms.
- [x] Patch is limited to one product proposition: render/request stability.

---

## Tests actually run

### Static

- `git diff --check` — PASS (repository configured `cr-at-eol` because tracked TS sources use CRLF).
- targeted source assertions — PASS:
  - no `launchSearchParams` in the Active Context dependency list;
  - `readConversationReach` is shared by both surface projections;
  - reach effect has semantic-only dependency list.

### Typecheck / Unit / Browser E2E

`BLOCKED_ENV` in this extracted RC: `node_modules` is absent. The incoming user patch reports typecheck/unit/E2E evidence from its originating worktree, but that evidence is treated as upstream provenance, **not** as locally re-run PASS.

### Manual product smoke

`NOT_RUN` in this sandbox because the Web/Local Core runtime cannot be built without dependencies.

---

## Main / Context / Workflow parity

- Main: N/A for reach reader, but Active Context stability applies globally.
- Context: stable reach callback path applied.
- Workflow: stable reach callback path applied.

---

## Donor conformance

No visual donor behavior changed in A01.

---

## Index updates

- Construction Context Index: **YES** — added the latest completed Phase A closeout pointer and next admissible micro-patch.
- Mandatory Context: NO — no new L0 product rule was introduced.
- Plan-Diff / Reality / Donor indexes: NO — A01 implements an already-indexed `IMPLEMENTATION_GAP`.

---

## Debt / next patch

The uploaded incoming patch bundles multiple unrelated propositions (Orbit lifecycle, ExecutionItem fail-close, text preview generation, Assembly icon species, Glyth/drop behavior). They are deliberately **not** applied wholesale.

Next admissible Phase A micro-patch after review: Orbit click-open lifecycle stability.

---

## Verdict

`PASS` for source-level A01 implementation and static acceptance; runtime verification remains `BLOCKED_ENV`.

## STOP

Do not merge the remaining incoming patch hunks into A01.
