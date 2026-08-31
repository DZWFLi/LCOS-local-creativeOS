# LCOS v0.15 · A14 Workspace Relation Intent Ownership Closeout

Date: 2026-08-31

Proposition:

> **Main Workspace Relation creation is initiated by Workspace-local `ObjectOrbit → Relation`, not by the remaining permanent/hover relation notch.**

---

# 0. Verdict

```text
Source / static implementation: PASS
Cold patch apply: PASS
All runnable v0.15 static gates: 42 PASS / 0 FAIL / 2 SKIP
Post-A14 semantic typecheck in extracted archive: BLOCKED_ENV
Browser E2E: BLOCKED_ENV / pending real local merge
Human Product Smoke: BLOCKED_ENV / pending real local merge
Phase A: OPEN
Phase B admission: NO
```

A14 is merge-authorized as a **source/static Phase A owner-cleanup micro-patch**.

It does not claim runtime/manual acceptance in the extracted archive environment.

---

# 1. Authoritative baseline

User-validated real local baseline before A14:

```text
Branch: a13-cross-surface-20260831
HEAD: 6312ace
Subject: feat(v015): A13 cross-surface relation gesture adapter
Under: 59692ff SOP-R1
```

Real local evidence already supplied for `6312ace`:

```text
SOP-R1: 8/8 PASS
A13: 12/12 PASS
Full v0.15 static: 41 PASS / 0 FAIL / 2 SKIP
Full typecheck: PASS
Web Vitest: 687 PASS
Local-core: one timing-sensitive flaky, isolated rerun 10/10 PASS
Browser E2E: BLOCKED_ENV
Human Product Smoke: BLOCKED_ENV
```

The supplied RC source ZIP does not include `.git`; A14 construction therefore treats `6312ace` as provenance established by the user's local merge validation, not by inventing a new historical SHA inside the extracted tree.

---

# 2. Fresh Phase A parity census after A13

The post-A13 census does **not** mechanically execute the old debt list in order. It reclassifies each remaining item by owner type.

| Remaining item | Classification | A14 decision |
|---|---|---|
| Main Workspace permanent/hover relation notch | `WRONG_OWNER` | **DO NOW** |
| Conversation Glyth ordinary Relation endpoint | `SEMANTIC_OWNER_UNPROVEN` | fail-close; do not guess |
| Conversation Context Mapping | canonical separate semantic path | keep separate; not ordinary Relation |
| Context/Workflow `scope:*` / `workspace:*` relation endpoints | endpoint adapter / semantic debt | fail-close in view-only A13 adapter |
| Relation target extra 12–18px screen-space halo | interaction acceptance debt | later Phase A QA proposition |
| Browser/manual save→reload evidence | runtime evidence debt | must be executed on real local env |

Why Workspace first:

- A12 retired ordinary Main-object permanent/hover Relation launch ownership;
- A13 gave eligible Context/Workflow Project material the same physical Orbit Relation grammar;
- Workspace remained the last **proven wrong launch owner** in the current Relation production path;
- Conversation is not a launch-owner bug. Its ordinary Relation endpoint requires semantic proof and its durable Context Mapping is explicitly a different Glyth/Semantic Drop language;
- hit-halo is a motor-tolerance acceptance item, not an owner ambiguity.

---

# 3. Source-Diff Gate

## Original / surviving product truth

Workspace is a recoverable working-set / spatial working-scene projection, not a fake ordinary View and not a second business truth.

Relation is shared physical interaction grammar, while endpoint semantics remain canonical-owner-specific.

## Latest explicit L0 interaction override

```text
Select / activate local object
→ Orbit
→ Relation
→ Orbit yields
→ temporary source port
→ line follows pointer
→ receptive target
→ commit
```

Permanent tiny/hover-only Relation affordances must not be the primary launch path.

## Current production problem before A14

Main ordinary Project objects already used Orbit Relation, but Workspace still rendered:

```text
workspace-relation-notch-*
.lcos-relation-notch
workspace hover → reveal notch
```

This was an explicit legacy launch owner.

## A14 classification

```text
PLAN_FIDELITY_GAP = YES
REALITY_FEEDBACK_GAP = YES
WRONG_OWNER = YES
SEMANTIC_TRUTH_CHANGE = NO
```

---

# 4. A14 implementation

## 4.1 Workspace remains Workspace

A14 does **not**:

- convert Workspace into a Project View;
- add a second Workspace selection store;
- route Workspace through A13's view-only `projectMaterialRelationGesture` adapter;
- change Workspace move/resize/activation truth;
- invent new Workspace persistence.

Workspace keeps canonical aggregate endpoint identity:

```text
workspace:<workspaceId>
```

## 4.2 Launch owner migration

Before:

```text
Workspace frame hover
→ permanent hidden notch revealed
→ drag notch
→ Relation
```

After:

```text
Workspace header activate / click
→ local ObjectOrbit
→ Relation
→ Orbit closes
→ existing Main Relation intent session
→ temporary Workspace source port wakes
→ target / blank create-and-connect uses existing Main commit path
```

The Workspace Orbit currently exposes only the **proven real capability** `Relation`. A14 does not pad the Orbit with fake actions merely to reach an aesthetic action count.

## 4.3 Temporary source port only

The permanent `.lcos-relation-notch` production CSS and `workspace-relation-notch-*` DOM owner are retired.

Only while the Workspace is the active Relation source:

```text
relationSourceId === workspace:<id>
→ workspace-relation-source-port-*
```

The port reuses the existing screen-space `lcos-relation-port` behavior.

## 4.4 Relation target beats Workspace drag

Before A14, Workspace header pointer ownership could compete with relation-target intent.

A14 gives an active Relation session priority:

```text
Relation active
+ pointerdown Workspace header
→ commit existing Relation to workspace:<id>
→ clear Relation transient state
→ DO NOT begin Workspace drag
```

This is owner convergence, not a new persistence path.

---

# 5. Canonical boundaries preserved

## Conversation ordinary Relation

Still fail-close.

A14 does not guess whether a normal semantic Relation should target:

- `conversationArtifactId`;
- `conversationViewId`;
- connected Conversation identity;
- some presentation-only Glyth body id.

That requires a dedicated endpoint proof.

## Conversation Context Mapping

Still separate and canonical:

```text
Artifact / Context / Workflow / Collection / Workspace body
→ Semantic Drop onto Glyth Context Field
→ durable Conversation Context Mapping
→ canonical Assembly/Core path
```

Ordinary Relation must not impersonate this mapping merely because both involve pointer interaction.

## Context / Workflow aggregate projection

A13 remains view-material-only. `scope:*` and `workspace:*` projections do not get passed as fake `viewId` values.

## Workflow Step/action path

Untouched. It remains a separate Workflow execution-path semantic owner.

---

# 6. Files changed

```text
apps/web/src/features/canvas/ProjectCanvas.tsx
apps/web/src/interaction-system.css
scripts/validate-v015-a12-relation-intent-owner.mjs
scripts/validate-v015-a13-cross-surface-relation-gesture.mjs
scripts/validate-v015-a14-workspace-relation-owner.mjs
docs/v015/convergence/PHASE_A_FRESH_PARITY_CENSUS_AFTER_A13_20260831.md
docs/v015/convergence/GUI_RESPONSIBILITY_MATRIX_20260831.md
docs/v015/convergence/GUI_PRODUCTION_OWNER_AUDIT_20260830.md
docs/v015/convergence/FRONTEND_CONVERGENCE_PLAN_20260831.md
docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md
docs/v015/convergence/LCOS_v015_A14_WorkspaceRelationIntentOwnership_CLOSEOUT_20260831.md
```

A12/A13 validators are updated only so their historical acceptance remains accurate after the later Workspace owner migration. Their closed propositions are not rewritten.

---

# 7. Validation

## A14 dedicated static

```text
A14 Workspace Relation Intent Ownership: 10/10 PASS
```

Checks include:

1. legacy permanent/hover Workspace notch retired;
2. Workspace header activation opens local transient Orbit without new Workspace selection truth;
3. Workspace Orbit exposes explicit Relation capability;
4. Relation reuses existing Main relation intent session;
5. temporary source port mounts only for the active Workspace source;
6. Relation target commit wins before Workspace drag ownership;
7. canonical `workspace:<id>` endpoint preserved;
8. Context/Workflow aggregate projections remain fail-close in A13 view-only adapter;
9. Conversation ordinary Relation remains unguessed;
10. responsibility docs close Workspace WRONG_OWNER while keeping semantic/hit-halo debt open.

## Regression gates

```text
A12: 10/10 PASS
A13: 12/12 PASS
```

## Full runnable v0.15 static sweep

Cold-applied source tree:

```text
42 PASS
0 FAIL
2 SKIP
```

SKIP:

```text
S9 / S10 external semantic/provider gates
```

They are not counted as PASS.

## Patch cold apply

Against a clean extracted snapshot corresponding to user-validated `6312ace`:

```text
git apply --check: PASS
git apply: PASS
A12: PASS
A13: PASS
A14: PASS
full runnable sweep: 42 PASS / 0 FAIL / 2 SKIP
```

## Semantic typecheck in extracted tree

Actually attempted:

```text
npm run typecheck
```

Result:

```text
BLOCKED_ENV
TS2688 Cannot find type definition file for 'node'
TS2688 Cannot find type definition file for 'vite/client'
```

The extracted RC has no local dependency installation. This is not counted as PASS or product failure.

The real local merge must rerun typecheck and relevant Vitest after applying A14.

---

# 8. Runtime acceptance required after local merge

On the user's real dependency environment:

```text
npm run typecheck
relevant Web Vitest
node scripts/validate-v015-a14-workspace-relation-owner.mjs
```

Human Product Smoke minimum:

```text
Workspace header click
→ local Orbit appears around Workspace header/body anchor
→ Relation satellite
→ Orbit yields
→ temporary source port appears
→ connect Workspace → ordinary Project object
→ save/reload relation survives

ordinary Project object → Workspace
→ Workspace becomes receptive target
→ commit occurs
→ Workspace does not start dragging
→ save/reload survives

Workspace normal header drag
→ still moves working set
→ no accidental Orbit after drag

Workspace resize
→ unchanged

Escape during Relation
→ source port / live edge cleanup

Main ordinary Project object Relation
Context Project material Relation
Workflow Project material Relation
Workflow Step→Step action linking
→ no regression
```

Do not claim Phase B admission until the required Phase A runtime/manual gate is actually executed.

---

# 9. Remaining Phase A debt after A14

A14 closes the last **known explicit Relation launch WRONG_OWNER** found by the fresh census.

Still open:

1. **Conversation ordinary Relation endpoint semantics**
   - must prove canonical endpoint;
   - must remain distinct from Conversation Context Mapping.

2. **Context / Workflow aggregate `scope:*` / `workspace:*` Relation endpoint adapter**
   - cannot lie to the view-only A13 path.

3. **Relation receptor motor tolerance**
   - frozen acceptance requires extra **12–18px screen-space edge halo**;
   - current receptor/body state must not be declared final QA until this is verified/implemented.

4. **real Browser E2E + Human Product Smoke**
   - Main / Context / Workflow / Workspace Relation save→reload;
   - interaction competition / cancellation.

Fresh census must be repeated after the real local A14 merge before naming the next micro-patch.

---

# 10. Final A14 status

```text
A14 Workspace Relation Intent Ownership
SOURCE / STATIC = PASS
PATCH COLD APPLY = PASS
MERGE AUTHORIZATION = YES
POST-MERGE TYPECHECK = REQUIRED
POST-MERGE HUMAN SMOKE = REQUIRED
PHASE A = OPEN
PHASE B = NOT ADMITTED
```

STOP.

Do not auto-start the next package from this closeout.
