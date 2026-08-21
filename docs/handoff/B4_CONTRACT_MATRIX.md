# B4 Contract Matrix

| Contract | Truth / Source | Runtime output | GUI projection | Mutation? |
|---|---|---|---|---|
| Selected | Spatial session / ActiveContext | Attention selected | native selection | no Project Truth |
| Pinned | ActiveContext | Attention pinned | pinned mark | no Project Truth |
| Excluded | ActiveContext | hard filter | optional inspector | no |
| Locked / Preserve | ActiveContext | pinned-strength preserve evidence | pinned/preserve semantics | no |
| Intent | explicit action + WorkState + provider | IntentCandidate | Agent sidecar / correction | WorkState only |
| Relation | Canonical Relation | explicit_relation evidence | related mark / why | no |
| Context locality | Presentation / Context membership | same_context evidence | related | no |
| Collection locality | Collection presentation/membership | same_collection evidence | related | no |
| Scene locality | Workspace/Scene membership | same_scene evidence | related | no |
| Spatial locality | SpatialRetrieval | spatial_neighbourhood evidence | soft related | no |
| Retrieval | ProjectSearch | semantic_retrieval | retrieved mark | no |
| Continuity Candidate | WorkState projection | Resume/Resolve/Review/Explore | sidecar cards | suppression state only |
| Context Pack | Attention + Intent + budget | L0–L3 items | counts/cost/preview | no |
| Skill route | Intent + harness hint | SkillTargetProposal | sidecar | proposal only |
| Provider | Local Core env/config | redacted provider status | Utility status | no secret returned |

## Precedence

```text
Selected
> Pinned / Locked
> Explicit Relation
> Workflow Requirement
> Same Context
> Same Collection
> Same Scene
> Recent Delta
> Semantic Retrieval / Spatial evidence (Intent-aware ranking decides optional budget)
```

Spatial proximity never creates membership, containment or Relation.
