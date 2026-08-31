# Phase A Stacked Parity Census · after A15 source/static

Date: 2026-08-31

## Provenance boundary

Authoritative real local RC remains:

```text
6312ace
```

The user explicitly instructed continuation before returning a real local A14+A15 merged HEAD. Therefore this census evaluates the ordered source stack:

```text
6312ace
→ A14 Workspace Relation Intent Ownership
→ A15 Relation Receptor Screen-space Halo
```

It does not invent a post-A15 local HEAD, browser evidence, or Human Product Smoke.

---

## Fresh endpoint census

The previous debt label `Context/Workflow aggregate scope/workspace endpoint adapter` was too narrow.

Current code shows a broader canonical-owner defect:

```text
visible physical node id
≠ always canonical Relation view id
```

Core already defines:

```text
RelationEntityType = artifact | note | scope | view | workspace
```

and the existing runtime bridge already maps:

- `workspace:<id>` → `workspace` endpoint;
- `scope:<id>` → `scope` endpoint;
- Collection/Context/Workflow container ArtifactView with `opensScopeId` → `scope` endpoint.

The direct A13 Context/Workflow `saveRelation()` callback, however, still hardcodes both endpoints as `view`.

This creates two proven correctness gaps:

1. aggregate Project objects can persist as fake View truth;
2. anchored Core Note projections can be offered Relation but their ids are Note ids, not ArtifactView ids.

Conversation is different: ordinary Relation semantics are still not explicitly ruled and remain fail-close.

---

## Reclassification after A15

| Item | Current source truth | Classification | Decision |
|---|---|---|---|
| ordinary Artifact/View material | physical node id is canonical view id | KEEP | preserve |
| anchored Core Note | canonical Relation endpoint is `note`; old callback would fake `view` | **PERSISTENCE OWNER GAP** | A16 |
| Collection/Context/Workflow container body | visible container View represents canonical Scope through `opensScopeId` | **PERSISTENCE OWNER GAP** | A16 |
| explicit `scope:*` projection | Domain/runtime truth already proves Scope endpoint | **ADAPTER GAP** | A16 |
| explicit `workspace:*` projection | Domain/runtime truth already proves Workspace endpoint | **ADAPTER GAP** | A16 |
| local-only note shell without canonical Core identity | no proven durable endpoint | FAIL-CLOSE | preserve |
| Conversation ordinary Relation | Conversation Context Mapping is separate; ordinary endpoint not ruled | `SEMANTIC_OWNER_UNPROVEN` | preserve fail-close |
| Browser / Human proof | no returned local A14+A15 runtime evidence | `RUNTIME_EVIDENCE_GAP` | carry forward |

---

## Why A16 is next

A16 is not a feature expansion. It removes a false assumption in the already-existing canonical save path:

```text
nodeId == viewId
```

The correct proposition is:

> Before Context/Workflow persists a Project-material Relation, the visible node identity must resolve to its proven canonical Relation endpoint. `view / note / scope / workspace` are preserved as distinct truths; unproven endpoints fail closed.

This is smaller and safer than touching Conversation because every endpoint admitted by A16 is already explicitly supported by Domain/Core/runtime source.

---

## A16 non-goals

A16 does not:

- add Conversation ordinary Relation;
- reinterpret Conversation Context Mapping;
- alter Main Relation persistence;
- alter A14 Workspace source-owner UI;
- alter A15 16px hit halo;
- change Workflow Step→Step action links;
- create a generic universal `connect()` ontology;
- enter Phase B Object Species.
