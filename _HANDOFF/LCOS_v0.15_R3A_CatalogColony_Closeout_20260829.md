# LCOS v0.15 · R3-A Catalog Migration / Colony Closeout
## 2026-08-29

Baseline: `9e3a680` · R2-D Interaction Grammar closeout

Status: **R3-A code-complete + dedicated static / pure interaction Golden complete. STOP before R3-B.**

---

## 1. Slice boundary

R3-A closes the object-species migration only:

```text
legacy Fence / Region
→ canonical Colony / Field primitive

old 15-component Catalog
→ current createable / compatibility / retired ownership
```

It intentionally does **not** implement R3-B Arrange / Gallery / Stack, R3-C Context / Workflow semantic components, R3-D Assembly / Arrange Skill seams, or the final GUI Visual Constitution pass.

The guiding frozen distinction remains:

```text
Collection = durable content containment / 收纳
Colony     = spatial organization scope / 圈起来
```

There is no Collection → Colony truth shortcut.

---

## 2. Canonical Colony truth

Added `PresentationColonyV0` to shared Presentation contracts:

```ts
{
  id
  label?
  surface: 'main' | 'context' | 'workflow'
  memberIds: string[]
  contour: { points: Array<{ x; y }> }
}
```

Semantics:

- Colony membership is **sticky Presentation organization truth**.
- Geometry does not continuously determine membership.
- Merely crossing a Colony contour does not add/remove an object.
- The contour is Presentation geometry, not Collection containment and not a parent tree.
- `PresentationSpatialRegionV0` remains deprecated compatibility input only.

Local Core validates Colony id, Surface, unique/non-empty member ids, and finite closed contour geometry.

A Presentation persistence Golden now covers canonical Colony persistence; the legacy rectangular spatial-region persistence test remains only as migration compatibility evidence.

---

## 3. Legacy migration

### 3.1 Old Presentation `spatialRegions`

On first canonical Main Presentation load:

```text
legacy region bounds
→ derive initial member ids once
→ create Colony contour
→ write canonical colonies
```

The old live `spatialRegion.ts` membership helper is retired. Membership is no longer recomputed every time nodes move.

Prototype-state normalization now preserves the distinction between:

```text
colonies field absent
vs
colonies: []
```

so old `spatialRegions` can actually enter one-time migration instead of being silently shadowed by an invented empty Colony list.

### 3.2 Old bound Fence / Region SurfaceElements

Main legacy `fence` / `region` SurfaceElements with real `projectViewIds` bindings migrate to canonical Colonies and the migrated compatibility element is removed.

Unbound/unsupported compatibility state is not reinterpreted as Collection truth.

---

## 4. Colony interaction semantics

This slice implements the user-confirmed membership grammar.

### Create

Two honest creation paths exist:

```text
free lasso: 圈一片
Selection shortcut: 圈成 Colony
```

Free lasso previews candidate members before commit. Release commits the Colony and its initial sticky member ids.

`Esc` cancels an in-progress lasso without creating truth.

### Add

```text
external object / Selection
→ drag into Colony
→ explicit Drop
→ add member ids
```

Passing through the field does nothing.

### Sticky movement

Moving an existing member near/outside the contour does **not** instantly revoke membership.

### Peel

Only a decisive moved-member separation beyond the current contour threshold commits removal:

```text
move member
→ settle
→ distance beyond peel threshold
→ remove that member from Colony
```

Other members remain untouched.

The final bespoke elastic-neck / detach-ready visual feedback is deliberately deferred to the GUI morphology pass; the underlying semantic boundary is now explicit.

### Rescope

Selected Colony exposes `重新圈定`:

```text
old membership
→ draw a new lasso
→ one commit replaces the spatial scope
```

`Esc` cancels the rescope attempt.

### Dissolve

`解散` deletes **only the Colony**:

```text
Colony removed
objects remain in place
Artifact / Collection truth untouched
```

There is no destructive cascade.

---

## 5. Initial morphology, not final visual constitution

R3-A removes the rectangular Fence renderer for canonical Colony and introduces an initial organic closed contour:

- smoothed closed path;
- stronger contour than fill;
- low-opacity field tint;
- no rectangle resize handle;
- no permanent card header;
- no conversion-to-Collection action.

This is an implementation-safe first morphology based on the current product direction, **not** a final visual freeze. The following remain intentionally open for later GUI polish:

- exact organic contour personality;
- local edge wake-up;
- Peel neck / tether animation;
- selected-field motion;
- Component instrument attachment morphology.

---

## 6. Catalog migration

Old createable species are reclassified according to the 2026-08-29 freeze.

Key R3-A changes:

```text
fence        → hidden compatibility adapter
region       → hidden compatibility adapter
context-pack → retired / hidden adapter
compare      → transient action; hidden durable component adapter
workbench    → existing dedicated-workspace compatibility only; no generic creation
```

Other renamed/retained identities continue toward their R3-B / R3-C destination:

```text
source-chain        → 来源
structure-map       → 结构
evolution           → 版本 / 演进
relationship-field  → 关系
stack               → 堆叠
active-path         → 行动路径
```

Agent `organize` / `focus-region` intents now fail closed instead of resurrecting the retired `region` component through a hidden code path.

---

## 7. Collection separation

The old Main action that implied:

```text
Fence / spatial scope → 转 Collection
```

has been removed.

Current user-facing paths remain visibly separate:

```text
创建 Collection
圈成 Colony
```

They express different product truths and neither silently converts into the other.

---

## 8. Spatial Navigation continuity

R2-C semantic-region overview now consumes canonical Colony bounds/members first.

Legacy bound Fence/Region may remain as compatibility navigation sources until migrated, but they do not become canonical Colony truth by naming convention.

R2-C's old pre-R3-A regression assertion was updated accordingly:

```text
before: canonical Colony must not exist yet
now:    canonical Colony may feed overview,
        Collection must still never be renamed/mapped to Colony
```

No Marker intent is written merely because a Colony exists or because camera LOD changes.

---

## 9. Validation

### R3-A dedicated static gate

```text
R3-A Catalog / Colony: 20/20 PASS
```

Covers:

- canonical contract;
- legacy compatibility boundary;
- Core validation;
- persistence Golden source coverage;
- old live region helper retirement;
- migration signal preservation;
- sticky add;
- Peel;
- Rescope;
- Dissolve;
- lasso + Selection creation;
- organic contour renderer;
- Catalog retirements;
- Agent no-legacy-region backdoor;
- Collection / Colony separation.

### Pure interaction execution

```text
PASS Colony pure interaction semantics:
create / sticky / add / peel / rescope
```

### Regression gates

```text
R2-D Interaction Grammar       20/20 PASS
R2-C Spatial Navigation Family 16/16 PASS
User Language Gate             PASS · 233 product-surface files
```

### Syntax / integrity

```text
Modified/new TS/TSX transpile  10/10 PASS
package.json parse             PASS
CRLF-aware git diff --check    PASS
```

The Web TypeScript diagnostic filter returned no errors for the R3-A changed Web paths.

### Environment boundary

This construction workspace still has no root or Web `node_modules`.

Therefore full dependency-backed:

```text
lint / package typecheck / vitest / build
```

is **not claimed** here.

The new Local Core persistence test is present and syntax-clean, but Vitest execution is not represented as completed in this sandbox.

---

## 10. Cross-Surface boundary

`PresentationColonyV0` is already a shared Main / Context / Workflow contract, and the Catalog no longer allows any Surface to create new legacy Fence/Region species.

This micro-patch implements the active canonical Colony authoring/rendering path on Main, where the legacy Fence/Region interaction actually existed.

Context / Workflow must consume the same Colony primitive when their R3-C Surface semantics are wired; they must **not** invent Surface-local Colony truth in the meantime.

---

## 11. Next formal construction point

**R3-B · Universal Components**

Only:

```text
Arrange
Gallery
Stack
```

Carry-forward constraints:

```text
Colony = 哪一片
Component = 这一片怎么看 / 怎么排 / 怎么工作

one Colony
→ at most one Layout Instrument
→ Arrange OR Gallery OR Stack

no Artifact truth duplication
no universal white-card shell
no fake AI arrange
```

R3-B must consume canonical Colony/Selection/object refs established here rather than reintroducing Region/Fence binding semantics.
