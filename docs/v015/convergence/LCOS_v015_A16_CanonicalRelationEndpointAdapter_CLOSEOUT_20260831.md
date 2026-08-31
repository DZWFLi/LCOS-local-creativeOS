# LCOS v0.15 · A16 Canonical Relation Endpoint Adapter Closeout

Date: 2026-08-31

## 0. Status

```text
Package: A16 · Canonical Relation Endpoint Adapter
Authoritative real RC: 6312ace
Stack prerequisites: A14 → A15
User continuation override: explicit `请继续` before returned A14+A15 local merge
Source/static: PASS
Runtime/typecheck in uploaded archive: BLOCKED_ENV (no node_modules; missing node + vite/client types)
Real local A14+A15 merge/runtime proof: NOT YET RETURNED
Phase A: OPEN
Phase B admission: NO
```

A16 is one persistence-owner proposition. It does not manufacture a fake post-A15 local HEAD.

---

## 1. Proven source truth

Domain/Core already support distinct Relation endpoint types:

```text
view
note
scope
workspace
```

Current runtime mapping already preserves aggregate endpoint identity:

```text
workspace:<id> → workspace
scope:<id> → scope
container ArtifactView + opensScopeId → scope
```

The pre-A16 direct Context/Workflow callback instead did:

```text
sourceEntityType = view
targetEntityType = view
```

for every visible node id.

Therefore the gap is not semantic invention. It is persistence canonicalization.

---

## 2. A16 canonical endpoint resolver

New owner:

`apps/web/src/features/spatial/projectRelationEndpoint.ts`

It resolves one visible `CanvasNode` as:

```text
Conversation
→ null / fail-close

anchored Core Note (kind=note, no artifactId, has anchors)
→ note:<node.id>

local-only note shell without canonical identity
→ null / fail-close

workspace:<workspaceId>
→ workspace:<workspaceId>

scope:<scopeId>
→ scope:<scopeId>

Collection / Context / Workflow container View + opensScopeId
→ scope:<opensScopeId>

ordinary Project material
→ view:<node.id>
```

Unknown ids that are not present in the actual current `projectPresentationNodes` also fail closed. Prefix shape alone is not enough to manufacture an endpoint.

---

## 3. Context / Workflow eligibility

A13's physical adapter remains transient-only.

Context and Workflow now use:

```text
isProjectRelationEligible(node)
```

which delegates admission to the canonical endpoint resolver.

This means proven aggregate Project Objects can use the same Orbit → Relation physics, while Conversation and local-only noncanonical shells do not receive a false capability.

---

## 4. Persistence owner

`App.onCreateDomainRelation(...)` still owns the canonical Core write.

Before creating `Relation`, A16 resolves:

```text
from physical node id → canonical endpoint

to physical node id   → canonical endpoint
```

Then persists:

```text
sourceEntityType = sourceEndpoint.entityType
sourceEntityId   = sourceEndpoint.entityId

targetEntityType = targetEndpoint.entityType
targetEntityId   = targetEndpoint.entityId
```

If either endpoint is unresolved:

```text
RELATION_ENDPOINT_UNPROVEN
→ no saveRelation write
```

No fallback-to-view is permitted.

---

## 5. Owner boundaries preserved

A16 does not move persistence into `projectMaterialRelationGesture`.

Owner split remains:

```text
physical source/pointer/receptor state
→ A13 shared transient adapter

motor tolerance
→ A15 16px screen-space halo

visible-node → canonical endpoint identity
→ A16 canonical endpoint resolver

Core persistence
→ existing App / LocalCore saveRelation path
```

Main keeps its existing edge/connect truth and A14 keeps Workspace source-launch ownership.

Workflow Step/action linking remains `workflowActionState.edges` and is not converted into generic material Relation.

---

## 6. Explicit non-changes / fail-close

Still unchanged:

```text
Conversation ordinary Relation
Conversation Context Mapping
Workflow Step→Step action links
Main blank create-and-connect
A14 Workspace local Orbit source owner
A15 receptor halo
```

A16 does not invent a generic `connect()` that collapses Surface semantics.

---

## 7. Validation contract

Dedicated A16 gate must verify at minimum:

1. Domain supports proven endpoint types;
2. runtimeBridge already proves aggregate mapping;
3. shared endpoint resolver exists;
4. Core Note maps to `note`;
5. aggregate container maps to `scope`;
6. explicit scope/workspace projections map correctly;
7. Conversation fail-closes;
8. local-only Note fail-closes;
9. unknown ids fail-close;
10. Context/Workflow eligibility uses canonical resolver;
11. App resolves both endpoints before save;
12. direct save no longer hardcodes `view`;
13. Main/A14 Workspace ownership remains unchanged;
14. unit tests freeze mapping;
15. responsibility docs record no generic-connect regression;
16. A13/A14/A15 regression gates remain compatible with A16 supersession.

---

## 8. Runtime proof still required after real local merge

Because this is stacked before an A14+A15 local returned HEAD, local verification must eventually include:

```text
full typecheck
web/local-core unit tests
Context: View→Scope and Scope→View relation save/reload
Workflow: Workspace→View and Scope→Workspace relation save/reload
Core Note→View relation save/reload
Conversation still has no ordinary Relation satellite
A14 Workspace launch smoke
A15 16px halo smoke
Escape/cancel competition smoke
```

Browser E2E/Human Product Smoke remain not-PASS until actually executed.

### 8.1 Stacked cold-apply proof

From a clean source snapshot corresponding to the authoritative returned RC `6312ace`:

```text
6312ace source snapshot
-> A14+A15 combined apply-check/apply = PASS
-> A16 apply-check/apply = PASS
-> A14 validator = 10/10 PASS
-> A15 validator = 12/12 PASS
-> A16 validator = 16/16 PASS
-> full runnable v0.15 static sweep = 44 PASS / 0 FAIL / 2 SKIP
```

The temporary verification repository/commit is evidence only and is not user lineage authority.

---

## 9. Remaining Phase A debt after A16 source/static

If A16 validates cleanly, remaining known Relation debt is reduced to:

1. Conversation ordinary Relation semantics (`SEMANTIC_OWNER_UNPROVEN`);
2. real local runtime/browser/human proof for the stacked A14→A16 line;
3. fresh Phase A parity census after that real local merge.

A16 does not itself authorize Phase B.

---

## 10. Final status

```text
A16 dedicated gate = 16/16 PASS
A12 regression = 10/10 PASS
A13 regression = 12/12 PASS
A14 regression = 10/10 PASS
A15 regression = 12/12 PASS
full runnable v0.15 static sweep = 44 PASS / 0 FAIL / 2 SKIP
changed TS/TSX/test syntax transpile = 7/7 PASS
archive semantic typecheck = BLOCKED_ENV (missing node + vite/client type definitions)
Browser E2E execution = NOT RUN / BLOCKED_ENV
Human Product Smoke = NOT RUN / BLOCKED_ENV
A16 SOURCE / STATIC = PASS
A16 STACK MERGE AUTHORIZATION = YES
PHASE A COMPLETE = NO
PHASE B ADMISSION = NO
```
