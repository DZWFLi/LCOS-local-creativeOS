# LCOS v0.15 · A12 Relation Intent Ownership Closeout

Date: 2026-08-31
Proposition: **ordinary Main Project-object Relation creation is initiated by explicit `ObjectOrbit → Relation`, not by a permanent/hover-only relation notch.**

---

# 0. Verdict

```text
Source / static implementation: PASS
Full Web typecheck: BLOCKED_ENV
Browser E2E execution: BLOCKED_ENV
Manual Product Smoke: BLOCKED_ENV
Cross-surface Relation parity: NOT DONE
```

A12 is intentionally **not** a claim that the Phase A Relation domain is complete.

It closes one owner error only:

```text
Main ordinary Project object
Select
→ Object Orbit
→ Relation
→ Orbit yields
→ temporary source port wakes
→ relation line follows pointer
→ target click commits / blank click keeps create-and-connect
```

Still separate debt:

- Context Project material Relation gesture parity;
- Workflow Project material Relation gesture parity;
- Workspace relation-source owner;
- Conversation Glyth Relation endpoint semantics;
- receptor hit-slop / edge-halo final motor-tolerance acceptance;
- full runtime/browser/manual verification.

---

# 1. Baseline

```text
Repo: /mnt/data/lcos_a11_work
Branch: reconstructed local construction line
Patch base: 1de2b37 · fix(gui): unify project object right-click ownership
Worktree before A12: clean before construction; A12 changes only the files listed below
Historical local-user Git lineage: NOT CLAIMED by this reconstructed SHA
```

A12 continues the A00–A11 reconstructed convergence line. It does not rewrite or pretend to recover the user's historical local commit ancestry.

---

# 2. Original-source conformance

## Original source

`LCOS_0.1_三大独立视图组件化详细施工总稿_v03_对话选择与承接全链补齐_20260821.md`

Original product foundation retained:

- Main / Context / Workflow are independent first-class work surfaces on one Shared Spatial Surface Engine;
- Relation is a spatial interaction, not a separate form/page;
- each construction package must independently finish its Done / Acceptance before the next package;
- `remove-projection != delete-project-entity` remains untouched.

## Historical implementation clause that is now superseded

R2-D historically encoded:

```text
boundary Light Notch drag
→ Relation
```

and its static gate literally required the ordinary node `relation-notch`.

That historical implementation is not silently deleted from history. It is classified as superseded by the later explicit user adjudication below.

## Latest explicit override / latest reality feedback

Current L0 interaction truth:

```text
Select
→ Orbit
→ Relation
→ Orbit yields
→ source connection port wakes
→ line follows pointer
→ receptive target edge feedback
→ commit
```

The user must not be expected to discover a tiny permanent/hover-only notch as the primary launch gesture.

## Current construction clause

Phase A requires Relation to live in the shared spatial interaction grammar, while old generic relation launch ownership must retire rather than coexist as a second default path.

---

# 3. Source-Diff Gate

```text
Original User/Freeze:
Shared spatial Relation interaction; no second relation product/page.

Latest Override:
Select → Orbit → Relation → temporary source port → pointer-follow relation → receptive target → commit.

Latest Reality Feedback:
Permanent/tiny Light Notch is too obscure as the primary relation initiator.

Current Construction Clause:
Phase A Shared Spatial Kernel / Production Owner Cleanup → Relation owner convergence.

Current Code Owner before A12:
Main CanvasCard ordinary node permanently mounted `lcos-relation-notch`; hover/selection CSS revealed it; pointerdown started Relation.

Current Product Entry before A12:
Hidden boundary discovery / hover notch.

Classification:
EXPLICIT_OVERRIDE + WRONG_OWNER + IMPLEMENTATION_GAP
```

No semantic ambiguity was found for **ordinary non-Conversation Main Project objects**.

Cross-surface and special-species Relation semantics remain intentionally outside this micro-patch.

---

# 4. Implementation

## 4.1 `ProjectObjectOrbit` gains a fail-close Relation capability

File:

`apps/web/src/features/ui/ProjectObjectOrbit.tsx`

Added optional:

```ts
onRelation?: () => void
```

Only when that real callback exists does Orbit emit:

```text
object-relation · 关系
```

This preserves capability-driven fail-close behavior. Assembly / More are still not invented.

Because `ObjectOrbit` executes the action and then closes by default, Relation naturally produces:

```text
Orbit action
→ relation intent starts
→ Orbit yields
```

without a second transient layer fighting it.

---

## 4.2 Main owns explicit Relation intent state

File:

`apps/web/src/features/canvas/ProjectCanvas.tsx`

Added explicit transient source state:

```ts
relationSourceId
```

and a click-owned entry:

```ts
beginRelationIntent(from, point)
```

This reuses the existing canonical Main relation session refs / edge persistence path instead of creating a second Relation store.

It initializes:

```text
link.current = { from }
relationSourceId = from
linkPoint = source edge
linkMoved = true
```

so normal canvas pointer movement immediately updates the live relation line and target receptivity.

---

## 4.3 Ordinary node notch owner retired

Before:

```tsx
relationsEnabled
→ every ordinary Project CanvasCard mounts `lcos-relation-notch`
→ hover / selection reveals it
→ pointerdown starts Relation
```

After:

```tsx
relationSource={relationSourceId === node.id}
→ only active source mounts `lcos-relation-port`
```

Production ordinary-node test id changed from the obsolete hidden launch affordance to:

```text
relation-source-port-<viewId>
```

There is no ordinary-node `relation-notch-<viewId>` owner after A12.

---

## 4.4 Source port uses a small visible Light Segment with larger hit area

File:

`apps/web/src/interaction-system.css`

A12 source port:

```text
hit rect: 24 × 36 px
visible segment: 4 × 20 px
inverse canvas zoom scaling
hover scale: .92 → 1
```

This follows the current HUD rule that interaction bounds may be larger than visual bounds.

It is mounted only during explicit relation intent, so ordinary Rest / Hover / Selection no longer leak Relation chrome.

---

## 4.5 Workspace legacy source is retained and explicitly isolated

A12 does **not** delete the Workspace relation notch.

CSS now says explicitly that `.lcos-relation-notch` is temporary Workspace debt and removes selectors that exposed it on ordinary `.canvas-node` hover/selection.

This is deliberate:

> retiring a wrong ordinary-object owner is not permission to create a Workspace capability vacuum.

Workspace needs its own later object-local relation intent owner.

---

## 4.6 Target click and all terminal paths clear source intent

A12 clears `relationSourceId` on:

- Escape;
- locked/cancel cleanup;
- edge reconnect entry;
- target commit;
- blank create-and-connect handoff;
- direct node target click.

This prevents the source port from remaining as stale HUD after the relation session ends.

---

## 4.7 Blank-space create-and-connect remains available

Explicit Relation intent does not erase the existing useful path:

```text
Orbit → Relation
→ click blank canvas
→ `anchor-create-menu`
→ create object and connect
```

Blank pointerdown preserves the relation source Selection long enough for the existing pointerup relation flow to open the create menu.

---

# 5. Stale acceptance owner retired

A12 found an important acceptance problem:

`scripts/validate-v015-r2d-interaction-grammar.mjs` still required:

```text
Relation creation starts from one boundary Light Notch
```

That test encoded the superseded implementation, so leaving it untouched would cause a future Agent to resurrect the obsolete owner merely to make the gate green.

The gate now requires:

```text
ProjectObjectOrbit relation capability
+ beginRelationIntent
+ temporary relation source port
+ no ordinary relation-notch / anchor-in / anchor-out
```

This is a test-truth correction caused by an explicit later product override, not history rewriting.

Historical R2-D patch/document evidence remains history-only evidence of what the old implementation did.

---

# 6. Browser regression source updated

`tests/e2e/interaction-foundation.spec.ts` no longer looks for stale `anchor-out-*` handles.

The relation test now encodes:

```text
select Artifact
→ click Orbit Relation
→ source port visible
→ move to target
→ target becomes receptive
→ click target
→ edge count +1
→ source port gone
→ reconnect endpoint
→ cut relation
→ reopen Orbit Relation
→ click blank
→ create-and-connect menu visible
```

The test source is present, but it was **not executed** in this environment because Playwright is absent.

---

# 7. Tests actually run

## A12 dedicated static gate

```text
A12 Relation Intent Ownership: 10/10 PASS
```

Covers:

- capability-driven Orbit Relation;
- explicit relation-intent owner;
- ordinary notch retirement;
- temporary source-port morphology/hit target;
- Workspace debt isolation;
- target commit;
- Escape/cancel cleanup;
- blank create-and-connect preservation;
- Browser regression source;
- explicit non-claim of special/cross-surface parity.

## Existing regression gates already run during A12 construction

```text
R2-D Interaction Grammar: 20/20 PASS
Selection + Relation F4: 12/12 PASS
A11 Universal Right-click Ownership: 10/10 PASS
```

Full regression rerun after the stale A09 / R2-D acceptance updates:

```text
A03 Orbit Anchor Stability                 3/3 PASS
A04 Selection Composer Ownership           4/4 PASS
A05 Selection Reference Separation         8/8 PASS
A06 ExecutionItem Fail-Close               8/8 PASS
A07 Project Navigation Ownership           5/5 PASS
A08 Canonical Text Edit                    9/9 PASS
A09 Universal ObjectOrbit                 10/10 PASS
A10 Selection Group Action Ownership       8/8 PASS
A11 Universal Right-click Ownership       10/10 PASS
A12 Relation Intent Ownership             10/10 PASS
R2-D Interaction Grammar                  20/20 PASS
R1-C Unified Command State                12/12 PASS
Spatial Navigation F6A2                   14/14 PASS
R2-C Spatial Navigation Family            16/16 PASS
Selection + Relation F4                   12/12 PASS
```

A09's old gate also had to be updated: its original fail-close assertion forbade Relation entirely. After A12, the correct regression rule is that Relation may appear **only when a real `onRelation` owner is supplied**, while Assembly / More remain absent.

## TypeScript syntax-only transpile

```text
ProjectCanvas.tsx                    PASS syntax
ProjectObjectOrbit.tsx               PASS syntax
interaction-foundation.spec.ts       PASS syntax
```

This is syntax evidence only, not semantic typecheck.

## CSS parse

```text
interaction-system.css               0 parse errors
```

## Full Web typecheck

Command:

```bash
tsc --noEmit -p apps/web/tsconfig.json --pretty false
```

Actual result:

```text
BLOCKED_ENV
TS2688 Cannot find type definition file for 'node'
TS2688 Cannot find type definition file for 'vite/client'
```

## Browser / Vitest / Manual Product Smoke

```text
node_modules/.bin/playwright: MISSING
node_modules/.bin/vitest: MISSING
Browser E2E: BLOCKED_ENV
Manual Product Smoke: BLOCKED_ENV
```

No runtime/browser PASS is claimed.

---

# 8. Three-Surface parity

## Main

```text
Ordinary non-Conversation Project object
Orbit → Relation intent owner
SOURCE / STATIC PASS
```

## Context

```text
Shared Relation gesture adapter
NOT DONE / IMPLEMENTATION_GAP
```

Context has relationship views/domain presentation but A12 does not pretend they are the same physical `Orbit → Relation` grammar yet.

## Workflow

```text
Shared Relation gesture adapter
NOT DONE / IMPLEMENTATION_GAP
```

Workflow has its own Action/material edge machinery and domain relation operations. A12 does not replace those truths or claim gesture parity.

## Workspace

```text
legacy relation notch retained
DEBT / WRONG OWNER still open
```

## Conversation Glyth

```text
Relation satellite intentionally absent
FAIL-CLOSE pending endpoint semantics
```

Conversation receiver binding / durable body-drop mapping must not be silently conflated with ordinary Relation.

---

# 9. Donor conformance

Relevant donor behavior:

- TapNow / Lovart: object-local controls appear from the current object rather than from permanent chrome;
- current LCOS progressive disclosure rule: controls are satellites, content remains body;
- TodoPanel donor: one dominant local transient layer yields to the next one rather than stacking competing controls.

Borrowed craft:

```text
Orbit yields
→ small temporary local source control
→ direct pointer-follow
```

LCOS truth preserved:

- relation persistence still uses existing LCOS edge truth;
- no donor taxonomy imported;
- no new relation panel/mode/store created.

Explicitly not copied:

- donor IA;
- donor relation ontology;
- permanent visible connection handles.

---

# 10. Acceptance checklist

- [x] ordinary Main object Relation begins from explicit ObjectOrbit action;
- [x] Orbit yields after Relation action;
- [x] only active source mounts relation source port;
- [x] ordinary node hover/selection no longer exposes legacy relation notch;
- [x] live line reuses existing pointer-follow relation session;
- [x] target click commits existing edge truth;
- [x] blank click preserves create-and-connect;
- [x] Escape/cancel/commit clear temporary source HUD;
- [x] stale R2-D Light-Notch acceptance is replaced with latest explicit product truth;
- [x] Workspace legacy owner is retained and recorded rather than silently removed;
- [x] Context / Workflow / Conversation parity is **not** falsely claimed;
- [ ] Browser E2E executed — `BLOCKED_ENV`;
- [ ] Manual Product Smoke — `BLOCKED_ENV`;
- [ ] Full Web typecheck — `BLOCKED_ENV`.

Therefore:

> **A12 product proposition is source/static closed. Phase A Relation as a whole remains open.**

---

# 11. Remaining debt / exact next boundary

A12 does not authorize jumping to Phase B.

The next admissible Relation proposition after review is approximately:

```text
A13 · Cross-surface Relation Gesture Adapter
Main / Context / Workflow Project materials
→ shared Orbit → Relation physical grammar
→ preserve each domain's canonical persistence semantics
```

Before that patch, source census must distinguish:

```text
physical gesture owner
vs
Main reference edge persistence
vs
Context relationship truth
vs
Workflow action/material/domain relation truth
```

No generic `connect()` abstraction may be invented merely to make all three look uniform.

---

# 12. Index updates

```text
Context Index changed? YES
Mandatory Context changed? NO — no new L0 product truth; A12 implements an already-frozen override
Plan Diff Index changed? NO — explicit override already recorded
Video/Code Donor Index changed? NO
Responsibility Matrix changed? YES
Production Owner Audit changed? YES
Frontend Convergence Plan changed? YES
FullE2E Index changed? NO
```

---

# 13. STOP

Do not start A13 automatically.

A12 ends at the micro-patch boundary defined above.
