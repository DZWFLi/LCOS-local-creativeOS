# LCOS v0.15 · Phase A Fresh Parity Census after A16

Date: 2026-08-31
Authoritative real local RC: `0691812`

## 1. Relation debt classification

| Area | State at A16 | Fresh ruling | A17 action |
|---|---|---|---|
| Main ordinary object | Orbit → Relation | source/static closed | regression only |
| Context material | A13 grammar + A16 canonical endpoint | source/static closed | regression only |
| Workflow material | A13 grammar + A16 canonical endpoint | source/static closed | regression only |
| Workspace | A14 local Orbit owner | source/static closed | regression only |
| Receptor tolerance | A15 16px screen-space halo | source/static closed | reuse for Glyth receptor |
| view/note/scope/workspace endpoint | A16 canonicalized | source/static closed | regression only |
| Conversation ordinary Relation | fail-close pending semantics | **SEMANTIC OWNER NOW PROVEN** | Conversation Artifact endpoint + Glyth Orbit Relation |
| Conversation Context Mapping | separate canonical path | KEEP SEPARATE | no change |
| Browser/Human runtime proof | not executed | OPEN RUNTIME DEBT | local validation required |

## 2. Why the old fail-close is now superseded

The previous fail-close was correct, not a mistake. It prevented receiver/context-binding identity from being guessed into ordinary Relation.

The semantic gap is now closed by converging evidence:

1. latest L0 explicitly lists Relation in Glyth Orbit;
2. later UX freeze distinguishes Project Semantic Relation from Conversation Context Mapping;
3. Conversation structurally owns both `conversationArtifactId` and `conversationViewId`;
4. the real Conversation projection is the ArtifactView backed by that Artifact;
5. Domain Relation supports `artifact` endpoints;
6. runtime projection carries `artifactId` on the real Conversation CanvasNode.

Ruling:

```text
ordinary Project Semantic Relation endpoint = Conversation Artifact
physical Main projection id = conversationViewId / CanvasNode id
Conversation Context Mapping = separate truth
```

## 3. Remaining Phase A after A17

Do not declare Phase A complete from source/static evidence alone.

The next fresh census after real A17 merge must prioritize:

- Browser E2E execution;
- Human Product Smoke across Main / Context / Workflow / Workspace / Glyth;
- save → reload proof for view/note/scope/workspace/artifact Relation endpoints;
- any remaining shared interaction owner revealed by runtime behavior;
- only then Phase A close / Phase B admission.
