# AGENTS.md — LCOS v0.15 Final Convergence Rules



## 0. Mandatory v0.15 pre-construction gate

Before **any** LCOS v0.15 GUI / UX / Surface / Assembly / Skill / Spatial / convergence / E2E work, read these files **in full**:

1. `docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md`
2. `docs/v015/convergence/CONSTRUCTION_SOP_FINAL_FROZEN_20260831.md`
3. `docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md`
4. the current phase's T1 full-read sources listed by the SOP/index;
5. the current HEAD's latest closeout/handoff and real source/tests.

Do **not** substitute a prior handoff, summary, or keyword search for a required full read. If a required original freeze document is absent from the repository, report `CONTEXT_GAP` and retrieve the original source before changing product semantics.

Every patch must complete the SOP's Source-Diff Gate and classify the work as one or more of:

- `MATCH`
- `PLAN_GAP`
- `REALITY_GAP`
- `EXPLICIT_OVERRIDE`
- `IMPLEMENTATION_GAP`
- `WRONG_OWNER`

For Main / Context / Workflow shared interactions, parity across all three surfaces is release-blocking. For GUI work, human product smoke precedes Full E2E. A new canonical owner is not complete until the competing old production owner is retired.

For local transient UI motion (Orbit yielding, Composer, contextual popover, Pin group popover, control replacement), read `docs/v015/convergence/TODOPANEL_MOTION_TOKEN_20260831.md` and consume the shared LCOS motion tokens rather than inventing per-component timings.

> **AUTHORITATIVE FOR v0.15.** This file completely replaces every pre-v0.15 Agent/Codex rule set.
> Old `0.1`, `Phase 2.5`, PASS8/PASS9, old Workspace/Canvas interaction rules, and historical closeout documents are **not executable instructions** unless the v0.15 Context Trace Index explicitly points to them as evidence.

This repository is in **LCOS v0.15 final convergence**, not exploratory product development.
The job of Codex / TRAE / any implementation agent is to preserve the current product truth, close explicitly-scoped gaps, prove them with executable evidence, and stop.

---

## 0. Mandatory context recovery protocol

Whenever any of the following is unclear:

- what a feature means;
- which service owns canonical truth;
- whether something is a projection or a real object;
- whether an old implementation is still valid;
- which gesture / surface / runtime semantic is current;
- whether a missing-looking capability is truly missing;

**DO NOT infer from old docs or recreate a familiar pattern.**

Read, in order:

1. `AGENTS.md`
2. `docs/v015/CONTEXT_TRACE_INDEX.md`
3. `docs/v015/CODEX_START_HERE_V015.md`
4. the current code + contracts + tests named by the index
5. the specific v0.15 closeout / decision file named by the index

If those still conflict, report a `CONTEXT_GAP:` with the exact files/symbols in conflict. Do not silently choose the older or more conventional design.

### Hard anti-resurrection rule

The following are historical evidence only and must never override v0.15 truth:

- root PASS8/PASS9 / 2026-08-18 build reports;
- `Phase 2.5` / old `0.1` Full Gate wording;
- old Prototype / AdFrame / early Workspace interaction rules;
- old “Attach Context” / drop-zone selection workflows superseded by spatial interaction;
- historical patch plans whose behavior is already present in current source;
- GPT `651043f` integration lineage as a Git base. It is semantic reference only; the local direct-construction line superseded it.

Do not re-apply old patches just because their commit hashes are absent.

---

## 1. Current product model: frozen semantics

### 1.1 Project Surfaces

- **Main = 项目地形 / project terrain**
- **Context = 项目理解 / understanding and evolution**
- **Workflow = 项目行动 / action structure**
- **Assembly = 项目级共用仓库与装配现场 / shared project warehouse + assembly workspace**

They share spatial physics and Project Objects, but they are not four copies of the same page.
A Surface is a projection/work surface, not a second domain truth.

### 1.2 Canonical object rules

- Artifact / Project Object truth lives in Local Core / canonical domain storage.
- Presentation owns spatial membership, hierarchy, layout, emphasis and presentation-only edges.
- Deleting a View does not delete the underlying Artifact unless an explicit domain deletion path is used.
- Assembly applies existing canonical objects to a target; it does not manufacture duplicate object truth.
- Skill is a first-class Project Artifact. The canonical truth is a portable Skill package.
- Skill Builder is an editing/composition projection of that Skill, not a second Skill truth.

### 1.3 Interaction grammar

Frozen v0.15 grammar:

```text
Click                 = Selection
Shift + Click         = additive Selection
Ctrl/Cmd + Click      = current Reference
Drag object body      = Move / Semantic Drop
Drag Light Notch      = Relation
Ctrl/Cmd + F          = Search
F                     = Focus / “where is this selection used?”
Ctrl/Cmd + K          = Action Launcher (actions only)
```

Selection, Reference, Relation and durable mapping are different semantics. Never collapse them into one “attach” operation.

### 1.4 Universal Composer

One unified execution composer is shared across the execution-capable surfaces. Do not fork new surface-specific command composers unless a frozen product decision explicitly requires it.

---

## 2. Canonical runtime truth

### 2.1 Run / Execution

- **Local Core is the canonical Run/Task truth.**
- `ExecutionItemV1` is the canonical UI-facing execution projection.
- Web / Companion must render controls from `availableActions` only.
- If an ExecutionItem or action is missing, UI must **fail-close**. It must not infer Cancel/Retry/Answer from provider/Bridge/local status.
- Bridge transports execution; it does not own Project/UI truth.

No second `curatorRunState`, `skillAuthorRunState`, provider-derived control state, or browser-only Run truth.

### 2.2 Agentlets

`lcos-project-curator` and `lcos-skill-author` are semantic agentlets on the existing runtime/harness architecture. They are **not separate runtimes**.

Curator:

```text
selection / presentation intent
→ agentlet runtime / semantic provider
→ structured ReorganizeProposalV0
→ existing ReorganizeService
→ ghost Preview
→ Keep / Revert
```

Curator does not directly mutate the canvas.

Skill Author:

```text
completed Run / frozen RunRecipe
→ system-created candidate
→ lcos-skill-author
→ Method vs Fact + Root/Subskill composition
→ structured SkillProposal
→ review
→ SkillPackageService install/update + CAS
```

A pre-author candidate created automatically from a completed Run is `createdBy: 'system'`, not “AI learned”.

---

## 3. Skill ownership

- `SkillPackageService` is the canonical project Skill package filesystem writer.
- System Skill packages are read-only.
- `SkillCatalogService` is a layered read/catalog projection and must not become a second package writer.
- Skill proposal review/install must converge on `SkillPackageService`.
- Update paths use version/CAS semantics.
- Root/Subskill composition uses `SkillCompositionV1`; cycle detection is mandatory.

Do not add a second `.creative-os/skills` writer.

---

## 4. Search / retrieval truth

Product vocabulary is simply **Search**. Do not expose RAG/vector/embedding provider jargon in ordinary surfaces.

Infrastructure rules:

- `SemanticIndexService` owns chunk planning / semantic index orchestration, not provider-specific HTTP.
- `EmbeddingProvider`, `RetrievalProvider`, `ContentExtractor`, `VisualEmbeddingProvider` are infrastructure seams.
- Ollama is the default local embedding adapter, not the definition of semantic search.
- sqlite-vec and blob fallback remain valid retrieval backends.
- Mutation-driven reindex is primary; search-time indexing is stale/missing repair only.
- `contentHash` / chunk hash guards prevent redundant or stale writes.
- Unsupported extraction formats are explicitly `UNSUPPORTED`.
- Visual embedding is not implemented until a real provider is registered. No filename or fake image semantic fallback.

Consult `apps/local-core/src/search-format-coverage.ts` for the current extractor truth.

---

## 5. Storage / mutation rules

- `.creative-os` canonical state is written by Local Core-owned services only.
- Do not bypass Local Core by directly modifying SQLite in application code or E2E tests.
- Schema changes require migration + migration test + restart evidence.
- CAS conflicts must fail explicitly; do not silently overwrite stale versions.
- Deleted/tombstoned entities must not be resurrected by late asynchronous indexing/runtime writes.
- AI-generated changes remain proposals/drafts until the appropriate accept/apply path.

---

## 6. Architecture boundaries

### `apps/web`

Owns interaction, rendering, surface projections and Local Core client usage.
Does **not** own Project/Run/Skill truth and does not call model providers directly.

### `apps/local-core`

Owns canonical project persistence, presentation persistence, runtime projections, indexing, import/capture application, proposal application, Skill package writes and provider credentials/infrastructure.
Must bind local services to loopback unless an explicit reviewed transport says otherwise.

### `packages/contracts`

Owns cross-layer contracts and validators. Do not duplicate contract types in Web/Core.

### `packages/domain`

Pure domain rules/types. No React, filesystem, HTTP or provider adapters.

### `packages/agentlets`

Packaged semantic executors/harness entrypoints. They use the existing runtime architecture and structured contracts.

### `packages/skills`

Portable Skill packages / Skill content. Not a plugin marketplace and not UI state.

### Desktop / Capture / Bridge

Desktop supervises the local product runtime. Capture feeds canonical intake. Bridge transports execution/events. None may persist a second copy of Project or Run truth.

---

## 7. Change discipline

### 7.1 One micro-patch = one product proposition

For every task:

1. identify existing anchor (`KEEP / EXTEND / ADD / RESERVE`);
2. state the one proposition;
3. modify the smallest coherent surface;
4. run executable acceptance;
5. produce closeout;
6. STOP.

Do not opportunistically redesign adjacent modules during final convergence.

### 7.2 Truth before convenience

Never make a test pass by:

- adding browser-side fallback truth;
- writing DB rows directly;
- replacing real semantic provider checks with rule fallback;
- mocking a native Windows interaction and calling it native QA;
- broadening capability declarations beyond real executor support;
- catching contract errors and returning fake success.

### 7.3 No silent mass changes

Do not run repository-wide formatting/renaming/moves during final convergence unless the task specifically requires it. Large unrelated diffs are release blockers.

---

## 8. Mandatory session start

Before editing:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
git log --oneline -12
git diff --check
```

Then read:

```text
AGENTS.md
docs/v015/CONTEXT_TRACE_INDEX.md
docs/v015/CODEX_START_HERE_V015.md
docs/OPEN_DEBTS.md
```

If worktree is unexpectedly dirty: STOP and report. Do not reset unknown work.

---

## 9. Testing ladder

Do not call a lower layer “full E2E”. Evidence must name the layer actually run.

1. static gate
2. typecheck
3. unit/contracts
4. architecture/integration
5. Browser Playwright E2E
6. real semantic provider E2E
7. Bridge/MCP runtime E2E
8. Desktop/Companion automated E2E
9. Capture automated E2E
10. restart persistence / failure injection
11. Windows native QA
12. installer fresh-profile smoke
13. cross-system Golden Path

Rule/fake provider tests are valid deterministic tests, but they do not satisfy release real-provider E2E.

---

## 10. Native QA honesty

The following need actual Windows evidence when release-gating:

- Explorer OLE drag / folder drag / `.lnk` / `.url` / cancel;
- Edge unpacked extension interaction;
- tray / always-on-top behavior;
- multi-monitor and DPI scaling;
- installer fresh-profile launch.

Until verified, mark `PENDING_NATIVE_QA` or `BLOCKED_ENV`, never PASS.

---

## 11. Documentation authority

### Current semantic authority

- `AGENTS.md`
- `docs/v015/CONTEXT_TRACE_INDEX.md`
- `docs/v015/CODEX_START_HERE_V015.md`
- current contracts / services / tests
- v0.15 closeouts explicitly linked by the trace index

### Historical evidence only

Any document whose title contains old `0.1`, PASS8/PASS9, Phase2.5, old prototype phases, or superseded GUI rules unless the trace index explicitly says otherwise.

When a historical doc conflicts with current code + v0.15 index, the historical doc loses.

---

## 12. Session closeout

Every implementation session reports:

```text
SESSION:
BASE HEAD:
END HEAD:
WORKTREE CLEAN:
SCOPE:
NOT TOUCHED:

FILES CHANGED:
SCHEMA CHANGE:
CAPABILITY CHANGE:

TESTS EXECUTED:
PASS:
FAIL:
SKIP:
BLOCKED:

REAL ENVIRONMENT EVIDENCE:
RESTART EVIDENCE:

OPEN DEBTS ADDED:
OPEN DEBTS CLOSED:

ROLLBACK:
NEXT SESSION ENTRY CONDITION:
```

No evidence = no “complete”.
