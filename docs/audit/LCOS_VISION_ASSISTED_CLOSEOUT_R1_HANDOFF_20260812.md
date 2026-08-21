# LCOS Vision-Assisted Closeout R1 Handoff
Date: 2026-08-12
Target source package: `frontend-package-20260811-fullstack-closeout.zip`

## 0. Status

**PATCHED / NOT YET COMPLETE**

This is intentionally not marked COMPLETE because the uploaded package is frontend/shared-only and has no installed dependencies or running Local Core. The patch received source-level and screenshot-level review plus TypeScript syntax transpilation, but the full repo regression and real browser Golden flow must still run in Codex/the developer machine.

Highest-priority doctrine:

> 宁可慢一倍，也不要用十倍返工。测试绿不是完成本身；每个 Done 要落到 code + failure/restart + real interaction evidence。

---

# 1. Why we do not blindly copy all Huabu code

Huabu is MIT licensed, so direct reuse is legally possible when the MIT notice/provenance obligations are respected. The technical boundary is more important than the license boundary.

Use three tiers:

## DIRECT PORT
Good candidates are isolated, architecture-neutral implementation pieces:

- transient gesture-preview helpers/store semantics
- pure snap/geometry helpers
- inverse-delta / touched-field fingerprint helpers for safe revert
- architecture-boundary test patterns

For actual copied/substantially adapted code, record the **exact pinned Huabu SHA + source path** and preserve the MIT notice/third-party attribution.

## ADAPT PATTERN
Do not copy whole modules when the mechanism touches LCOS ownership:

- read-before-write session leases
- mutation transactions
- spatial retrieval
- Agent change review
- persistence/write coordination

These must remain native to LCOS SQLite / Revision CAS / PresentationView / CLI / Skill contracts.

## REJECT AS LCOS ARCHITECTURE

- replacing LCOS SpatialCanvas with Huabu/ReactFlow ownership
- Space/Frame as business ontology
- ACP/Electron as mandatory front door
- Huabu storage model
- spatial proximity as semantic truth

The R1 patch below **does not vendor Huabu code**. It adapts interaction patterns into the existing LCOS architecture. See `docs/provenance/HUABU_DIRECT_REUSE_POLICY_20260812.md`.

---

# 2. LCOS first-principle corrections included

## 2.1 Presentation Session identity isolation

File:
- `apps/web/src/state/presentationViewState.ts`

Changed:
- `PresentationViewSessionCore` is recreated by `projectId + scopeId + capability + renderer` identity.
- prevents a Session constructed for Scope A from being registered/used under Scope B after navigation.

Why:

```text
PresentationView = one committed durable truth
```

Scope crossing is a P0 violation of `别丢 / 别串`.

## 2.2 Fail-closed Presentation persistence

Changed:
- removed silent “Core unavailable → browser memory as durable fallback” behavior.
- failed durable write restores last committed snapshot and marks bridge not ready.
- UI receives `lcos:presentation-persistence` notice.
- pending Presentation mutations are drained in a loop so edits arriving during an in-flight save are not silently stranded.
- CAS stale path rebases captured intent once on latest committed state.

This makes module Maps optimistic/transient only, not a second Project Truth.

## 2.3 Empty committed state wins

Changed:
- empty members / positions / pins / presentation edges can clear stale optimistic state.
- committed `[]` / `{}` is treated as valid truth, not “nothing to restore”.

## 2.4 Membership restore no longer immediately writes stale local state back

Changed:
- `usePresentationMembership` now tracks a restore guard.
- when Core restores membership, the corresponding React update is not immediately interpreted as a user edit against the stale pre-restore value.

This closes a subtle restore/writeback loop.

## 2.5 Hierarchy reconciliation

File:
- `apps/web/src/state/presentationHierarchyState.ts`

Changed:
- fixed hierarchy storage key vs bridge key ownership.
- removed one-shot restore semantics.
- committed bridge changes continuously reconcile the optimistic hierarchy.
- on identity change, local seed resets first, then committed Core state wins.

## 2.6 Context renderer position collision

File:
- `apps/web/src/state/presentationDraftState.ts`

Closeout contract:
- `context-*` renderer geometry is treated as derived/transient.
- it does not overwrite the one canonical `PresentationState.positions` map.
- workflow/manual Presentation placement remains persistent.

This is the smallest production-safe contract without inventing renderer-namespaced persistence during closeout.

## 2.7 Reorganize cannot physically delete Artifact from the broad flow

File:
- `apps/web/src/features/reorganize/ReorganizePanel.tsx`

Changed:
- removed destructive checkbox / `confirmDelete` UI.
- frontend calls `applyReorganize(..., false)`.
- delete candidates are shown only as “建议单独清理”.
- physical deletion must be a separate explicit destructive action.

**Backend must still enforce this invariant in the full repo. Frontend alone is not sufficient.**

## 2.8 Agent target/context inference no longer uses business NodeKind

File:
- `apps/web/src/state/workContext.ts`

Changed:
- no `working/generated/source/context/decision` semantic inference.
- targetability uses mechanical facts:
  - explicit `editable`
  - or managed Artifact + concrete Revision + non-historical state
- Selection/focus is context evidence; semantic target interpretation belongs to user/Agent/Skill.

## 2.9 Capability popover no longer uses business title regex / kind for recent assets

File:
- `apps/web/src/features/shell/CapabilityPopover.tsx`

Changed:
- removed `/reference|参考|feedback|script/` filtering.
- recent assets are mechanical/recent/search results.
- visible metadata prefers fileType/preview state rather than business NodeKind.

## 2.10 Relation three-layer scope is explicit

Changed:
- Core canonical Relation → `scope:'domain'`
- Presentation-only relation → `scope:'presentation'`
- Run/temporary execution relation → `scope:'runtime'`

Files include:
- `runtime/runtimeBridge.ts`
- `App.tsx`
- `ContextFlowSurface.tsx`
- `WorkflowSurface.tsx`

Added:
- `apps/web/tests/relationScopeContract.test.ts`

---

# 3. Vision-assisted GUI fixes

The supplied Golden screenshots were reviewed visually. The main problem was not missing features; it was weak hierarchy/materiality:

- 145-node canvas looked like a repeated wall of generic pale cards.
- “image” acceptance screenshots still showed generic FILE cards.
- selection toolbar used unlabeled glyphs for the most important actions.
- domain/presentation/runtime edges were too visually similar/faint.
- bottom dock and minimap competed more than necessary with the canvas.
- Ghost future state was easy to miss.

## 3.1 Content preview classification

File:
- `CanvasNodeVisual.tsx`

Changed:
- `fileType` and `previewMimeType` are complementary signals.
- a generic Artifact type can no longer mask a real `image/*` preview MIME.
- real preview MIME is also passed into visual-family classification.

Expected effect:
- actual PNG/JPG preview data should render as image material rather than generic FILE.
- PDF/text thumbnail path remains available when the preview pipeline supplies content.

This does **not** manufacture previews. If Core/preview pipeline does not provide preview data, tomorrow's test should still fail content-first acceptance.

## 3.2 Selection near-field toolbar

Changed:
- primary actions are now visibly labeled:
  - Agent
  - 整理
  - 上下文
- secondary operations stay under More.
- toolbar has a compact floating surface so the actions read as one local interaction group.

This follows the Huabu-class principle of selection-adjacent action without copying Huabu's component system.

## 3.3 Canvas hierarchy polish

CSS closeout pass:
- quieter/cleaner canvas background
- slightly more tangible material surfaces
- smaller/softer persistent bottom capability dock
- minimap de-emphasized
- mechanical edge layers made legible:
  - domain structural
  - presentation lighter/dashed
  - runtime active/dashed
- selected/focused local edge remains strongest
- Ghost future state gets clearer dashed/tinted future-state language

No product semantics were added in CSS.

---

# 4. Verification performed here

## Screenshot / visual review
Reviewed supplied GUI evidence including:
- Golden mixed 145-node canvas
- Image/PDF/URL/Text closeups
- selection toolbar
- Reorganize Ghost / Apply
- Context / Workflow

## Source redline scan
Verified in patched frontend:
- `workContext.ts` has no NodeKind behavioral branches.
- CapabilityPopover has no business-title regex.
- ReorganizePanel has no `confirmDelete` UI.
- Presentation state files no longer contain “memory fallback / local source of truth” language.
- domain / presentation / runtime scopes are explicitly assigned in frontend projection paths.

## Syntax check
All changed TS/TSX files were passed through TypeScript `transpileModule` using TypeScript 5.8.3. No syntax diagnostics were reported.

## CSS structural check
- braces balanced.

---

# 5. What was NOT independently verified here

The uploaded package has no:
- `node_modules`
- `apps/local-core`
- full backend/scripts/tools
- running Local Core

Therefore this environment did **not** claim:
- full typecheck
- Vitest regression
- production build
- Playwright/browser interaction QA
- backend Reorganize delete enforcement
- HU-1/HU-2/HU-4/HU-5 backend correctness

Container network also cannot clone Huabu directly, so this pass relies on the already-audited Huabu mechanisms and official source references, not a new vendored copy.

---

# 6. Codex merge protocol

Do NOT overwrite the full repo blindly.

1. Apply/merge the R1 frontend patch.
2. Re-open every changed file in the real repo and resolve drift.
3. For any direct Huabu source port Codex chooses to do:
   - use the Session-0 pinned Huabu SHA,
   - record exact path/range,
   - preserve MIT attribution.
4. Backend must independently enforce:
   - broad Reorganize cannot hard-delete Artifact,
   - Presentation durable ownership contract,
   - existing HU safety rules.
5. Run in this order:

```text
lint
→ typecheck
→ targeted Web tests
→ targeted Core tests
→ architecture tests
→ full regression
→ build
→ browser Golden acceptance
```

6. Completion Audit before claiming COMPLETE.

---

# 7. Targeted checks Codex must add/run

## Presentation identity

```text
Scope A: positions/pins/hierarchy/members
Scope B: different values
A → B → A → B → reload
0 leakage
```

Also project switch if App remains mounted.

## Core unavailable

```text
stop Core
→ try drag/pin/hierarchy/presentation-edge
→ no fake saved state
→ restart Core/reload
→ committed state intact
```

## slow save / second edit

First save remains in flight while a second Presentation patch arrives.

PASS:
- second intent is drained after first save,
- no silent pending patch.

## empty committed state

Core returns:

```text
memberViewIds=[]
positions={}
pinnedViewIds=[]
presentationEdges=[]
```

PASS:
- stale optimistic state is cleared.

## Reorganize safety

PASS:
- broad 整理 contains no Artifact physical delete path in frontend **or backend**.

## Real materiality

Use actual:
- PNG/JPG
- screenshot
- PDF
- URL
- Markdown/text

Do not seed fake preview metadata.

## Real collaboration

```text
Selection
→ natural language request
→ Agent reads/retrieves
→ Ghost/change appears
→ Apply
→ follow-up sentence without rebuilding context
→ Revert
```

This is the Huabu-class collaboration gate.

---

# 8. Closeout verdict

This R1 pass should be treated as a **candidate correction**, not a completed release.

If the full-repo tests and tomorrow's Human Golden Test pass after merge:

```text
Feature / Architecture Freeze
→ Phase I Resource & Performance Hardening
→ Phase J Formal Software Closeout / RC
```

Do not open a new product phase from this patch.
