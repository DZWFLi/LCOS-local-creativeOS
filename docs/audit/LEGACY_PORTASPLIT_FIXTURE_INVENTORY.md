# Legacy PortaSplit Fixture Inventory

Date: 2026-07-28
Branch: `codex/mvp-fast-build`
Baseline: `3cd090b feat(mvp): generate runtime previews`

## Scope

Inventory only. No code deletion, migration, CSS cleanup, fixture isolation, or production entry rewrite was performed.

This audit follows `LCOS_Legacy_PortaSplit_Fixture_Cleanup_Timing_and_Plan.md`.

## Current judgment

The MVP branch now has a Runtime-backed sample project and Runtime preview generation, so it is close to the cleanup window.

However, the old frontend Fixture still covers states that are not yet backed by Runtime/Bridge:

- `waiting_input`
- `review`
- `accepted`
- fake Artifact Return
- fake Retry
- fake Checkpoint banner
- generated draft lifecycle

Therefore the next safe slice is not deletion. The next safe slice is QA Fixture isolation:

```text
Production Runtime path
→ uses Local Core sample

QA Fixture path
→ keeps ?state= waiting/review/accepted/perf coverage
→ explicitly dev/test only
```

## 1. Fixture Data

| File | Reference | Production dependency | Replacement | Risk | Suggested stage |
| --- | --- | --- | --- | --- | --- |
| `apps/web/src/fixtures.ts` | `fixtureProjects`, `fixtureScopes`, `fixtureWorkspaces`, `fixtureNodes`, `fixtureEdges` hard-code PortaSplit / Thinker sample nodes | Still used as offline/demo fallback and tests | Runtime `disposable-mvp-sample` for production; dedicated QA fixture module for tests | High if deleted directly: tests and fallback break | Stage 2.5 QA isolation |
| `apps/web/src/fixtures.ts` | `makePerformanceFixture(count)` via `?perf=` | Dev/performance QA only | Keep but move under `apps/web/src/qa-fixtures/` or test-only module | Medium: performance LOD tests may rely on it | Stage 2.5, keep as QA |
| `apps/web/src/state/projectFixtures.ts` | `fixtureStateForProject(...)` maps fixture graph into app state | Used by `App.tsx` fallback/open/close path | Runtime project loading for production; QA fixture factory for test routes | High: current fallback and some tests depend on it | Stage 2.5 |
| `apps/web/src/state/projectFixtures.ts` | `huaxinState(...)` second project fixture | Demo-only catalog data | Explicit QA sample or remove from production catalog | Medium: Project Drive demo may lose second tab | Stage 2.5 |
| `apps/web/src/state/projectFixtures.ts` | `defaultProjectCatalog()` returns fixture projects | Used as initial catalog before runtime catalog resolves | Runtime catalog first; empty/explicit Demo fallback second | Medium: startup fallback behavior changes | Stage 2.5 |
| `apps/web/src/App.tsx` | `initialPrototype(...)` loads localStorage then fixture | Production-adjacent boot fallback | Keep fallback only as explicit Demo mode | High: accidental Demo-as-Runtime risk | Stage 2.5 |
| `apps/web/src/App.tsx` | `?state=` seeds `waiting`, `review`, `accepted`, `phase2-*`, etc. | QA/dev only, but lives in production component | Move state scenarios to QA route/harness | High if deleted before Bridge exists | Stage 2.5 QA isolation |
| `apps/web/src/App.tsx` | fake generated return title `Thinker_Concept_${run.id}_AI.pptx` | UI lifecycle fixture | Real Bridge Artifact Return later | High: currently provides review surface without Bridge | Keep QA until Bridge |
| `apps/web/src/App.tsx` | fake `RUN-044`, `RUN-045`, `RUN-043` defaults | QA/dev lifecycle | Real Run model / Bridge later | High: deleting breaks waiting/review visual QA | Keep QA until Bridge |
| `apps/web/src/state/prototypeStorage.ts` | `localStorage` project/canvas persistence | Runtime fallback and demo state | Runtime graph for production; localStorage only UI preferences / QA | Medium-high: accidental Project Truth risk | Stage 2.5 |
| `apps/web/tests/workContext.test.ts` | imports `fixtureNodes`, `fixtureWorkspaces` | Test dependency | Keep as QA fixture import | Low if moved with test updates | Stage 2.5 |

## 2. Fixture-only Components / Routes

| File | Reference | Production dependency | Replacement | Risk | Suggested stage |
| --- | --- | --- | --- | --- | --- |
| `apps/web/src/adapters/fixtureAdapter.ts` | `createFixtureFrontendAdapter()` | Not currently main runtime path, but contract test/fallback utility | Move to QA/test adapter package or keep explicitly `fixture` | Low-medium | Stage 2.5 |
| `apps/web/src/App.tsx` | query route states: `drive`, `collapsed`, `create`, `confirm`, `scope`, `selection`, `multi`, `running`, `waiting`, `review`, `accepted`, `layout`, `scope-create`, `phase2-single`, `phase2-multi` | Dev/demo state fixture inside production App | Dedicated dev QA route, e.g. `/__qa/state/:state` | High if removed directly | Stage 2.5 |
| `apps/web/src/features/workrail/PreviewSurface.tsx` | Always renders PortaSplit/Thinker mock preview copy | Shared component with fixture content hard-coded | Render from Runtime preview/cache/content metadata; use mock only in QA | Medium: review/compare visual will become generic/empty | Stage 2.5 or after preview content UI |
| `apps/web/src/features/workrail/WorkRail.tsx` | `WaitingState` hard-coded “35% / 30%” question | Fixture-only waiting_input UI | Real Bridge waiting_input payload later; QA fixture until then | High: no Bridge replacement yet | Keep QA until Bridge |
| `apps/web/src/features/workrail/WorkRail.tsx` | `ReviewState` compare uses fake before/after PreviewSurface | Fixture review UI | Real Artifact Return compare later | High: no Bridge replacement yet | Keep QA until Bridge |
| `apps/web/src/features/create/ProjectCreateDialog.tsx` | Says “当前为前端 Fixture” | Stale production copy after Runtime exists | Update to Runtime/Local Core wording | Low | Immediate small copy cleanup |
| `apps/web/src/features/diagnostics/RuntimeDiagnosticsPage.tsx` | `SourceBadge` still supports `fixture`; placeholder path `E:\Projects\PortaSplit` | Diagnostics only | Remove fixture badge branch only after no diagnostics/test needs it; update placeholder | Low | Stage 2.5 or small copy cleanup |

## 3. Shared Components with Fixture Defaults

These should not be deleted. They are shared product components that still contain PortaSplit/Fixture defaults.

| File | Hard-coded default | Replacement object | Deletion risk | Suggested handling |
| --- | --- | --- | --- | --- |
| `apps/web/src/features/canvas/CanvasNodeVisual.tsx` | `PORTASPLIT`, `Thinker V6`, `Thinker V7`, `品牌简报`, `客户反馈摘要`, fake feedback copy | Runtime artifact title/kind/preview content; neutral placeholders only if no preview | High if deleted; component is core Canvas visual | Keep component; remove sample copy |
| `apps/web/src/features/workrail/PreviewSurface.tsx` | `PORTASPLIT`, `Thinker 创意方向`, `更直接的产品利益点`, `35%` copy | Runtime preview content, PreviewRecord state, Artifact title | High if deleted; used by Work Rail review | Keep component; make content prop-driven |
| `apps/web/src/features/workrail/WorkRail.tsx` | Waiting question, feedback source labels, “当前 V3” | Bridge waiting_input / Run / Artifact Return payload | High until Bridge exists | Move to QA scenario or prop-driven state |
| `apps/web/src/features/create/ScopeCreateDialog.tsx` | placeholder “第二轮客户反馈” | Neutral placeholder or Runtime sample-derived label | Low | Copy cleanup |
| `apps/web/src/features/workspace/WorkspaceDialog.tsx` | placeholder “Thinker 创意探索” | Neutral workspace placeholder | Low | Copy cleanup |
| `apps/web/src/features/create/ProjectCreateDialog.tsx` | placeholder “PortaSplit 夏季传播”; fixture explanatory text | Local Core project wording | Low | Copy cleanup |
| `apps/web/src/runtime/runtimeBridge.ts` | `mapStateToGraph(...)` fallback project name/root `PortaSplit`, `disposable://portasplit` | Use current project metadata or explicit test-only fallback | Medium: bootstrap/recovery path may still use it | Stage 2.5 |
| `apps/web/src/App.tsx` | default demo reset label `重置演示数据`; fallback save behavior | Explicit Demo mode only | Medium | Stage 2.5 |

## 4. Dead Assets / Dead CSS candidates

This is a candidate list only. Deletion requires full reference search, build, tests, and browser regression.

| File / selector | Reference | Production dependency | Replacement | Risk | Suggested stage |
| --- | --- | --- | --- | --- | --- |
| `apps/web/src/features/diagnostics/runtime-diagnostics.css` `.source-fixture` | Only useful if diagnostics displays Fixture badge | Diagnostics Runtime-only after Stage 4a, but `SourceBadge` still supports fixture type | Remove after diagnostics test updated and no fixture badge branch remains | Low | Stage 2.5 |
| `apps/web/src/surface.css` `.generated-material-glint`, `.artifact-generated-material`, generated node material selectors | Used by Generated/Draft node visuals | Generated node family still needed for future Artifact Return | Do not delete until Bridge/Return states are redesigned | High | Keep |
| `apps/web/src/surface.css` `.accepted-result-banner` | Used by WorkRail accepted fixture/result state | Needed for current QA accepted state | Replace with real accepted/current state after Bridge | Medium-high | Keep QA until Bridge |
| `apps/web/src/surface.css` `.preview-art.ppt.generated`, `.preview-art.document` | Used by `CanvasNodeVisual` fixture-like preview art | Replace with Runtime preview rendering | Medium | Stage 2.5 / Preview UI stage |
| `apps/web/src/foundation.css` old `.preview-sheet`, `.node-preview-slot`, `.generated` visual variants | Some may be legacy duplicated with `surface.css` | Needs selector-level DOM/build audit | Unknown | Dedicated CSS dead-code slice |
| `apps/web/src/foundation.css` old iridescent/generated material selectors | May still style CanvasNodeVisual | Needs browser screenshot compare before removal | Medium | Dedicated CSS dead-code slice |

No obvious local image asset files were identified in this inventory pass. The main cleanup target is hard-coded fixture data/copy/CSS, not binary assets.

## 5. Runtime replacement readiness

Already available:

- Runtime sample project opens from Local Core.
- Sample artifacts have FileRecord and ArtifactRevision identity.
- Work Rail shows Runtime identity.
- Preview status is visible.
- Preview generation for TXT / MD / Image is implemented.
- Diagnostics reads Runtime catalog and graph.

Still not available:

- Bridge Run.
- `waiting_input` from real executor.
- Artifact Return.
- Accept / Retry semantics.
- Real Checkpoint after accepted Run.
- Runtime-driven generated draft lifecycle.

Conclusion:

```text
Production entry can continue moving toward Runtime-only.
Run lifecycle fixtures must be isolated, not deleted, until Bridge exists.
```

## 6. Recommended cleanup sequence from here

### Commit 1 — this inventory

```text
docs/audit/LEGACY_PORTASPLIT_FIXTURE_INVENTORY.md
```

### Commit 2 — QA Fixture isolation

Move or mark:

- `apps/web/src/fixtures.ts`
- `apps/web/src/state/projectFixtures.ts`
- `?state=` scenarios
- `fixtureAdapter.ts`

Target shape:

```text
apps/web/src/qa-fixtures/
apps/web/src/qa-routes/
```

Production `App` should not need to import PortaSplit fixture for normal Runtime startup.

### Commit 3 — Production copy cleanup

Low-risk copy-only removals:

- `ProjectCreateDialog` fixture wording.
- `ScopeCreateDialog` placeholder.
- `WorkspaceDialog` placeholder.
- Diagnostics PortaSplit placeholder.

### Commit 4 — Prop-drive shared visual defaults

Update:

- `CanvasNodeVisual`
- `PreviewSurface`
- Work Rail waiting/review copy

Do not remove generated/current/draft visual affordances.

### Commit 5 — CSS dead-code audit and deletion

Only after:

```text
rg selector references
npm run check:fast
browser regression
actual-size screenshots
```

## 7. Stop conditions for cleanup

Stop before deletion if cleanup would:

- remove the only QA coverage for waiting/review/accepted;
- hide Runtime vs Demo distinction;
- change Artifact / Revision / Current semantics;
- remove Generated/Draft/Decision visual language without replacement;
- require Bridge assumptions;
- require schema migration;
- expand into broad CSS rewrite without screenshot evidence.

## Validation

Inventory-only document.

Command run:

```text
git status --short
rg "PortaSplit|portaSplit|fixture|Fixture|?state=|queryState|disposable-portasplit|客户反馈|Thinker|RUN-0|generated|accepted" apps/web/src apps/web/tests docs -n
rg "fixtureStateForProject|defaultProjectCatalog|loadPrototypeState|savePrototypeState|clearPrototypeState|makePerformanceFixture|fixture" apps/web/src/App.tsx apps/web/src/state/prototypeStorage.ts apps/web/src/adapters/fixtureAdapter.ts apps/web/src/features -n
rg "PORTASPLIT|Thinker|客户反馈|品牌简报|35%|30%|RUN-|V3|V4|Fixture|PortaSplit" apps/web/src -n
```

No code tests were run because no code changed.

