# B4 Huabu Reuse Log

## DIRECT PORT / algorithmic inspiration

LCOS B4 uses architecture-neutral geometry ideas from Huabu neighbourhood code:
- rectangle edge-to-edge distance
- local clustering / arrangement concepts
- reading-order / group-level locality ideas

No Huabu Space/Frame persistence model is copied.

## ADAPT

- explicit Selection as independent context channel
- preview-first / read-on-demand
- spatial neighbourhood as structured evidence
- group before deep retrieval
- user-visible explanation of why AI is looking at an object
- provider/model separation concept; LCOS adds explicit `utility` / `chat` roles and multi-provider fallback

## REJECT

- Frame / Grandframe as LCOS Core Entity
- Agent Node / Question Node as mandatory anchor
- fixed pixel distance as semantic truth
- ReactFlow ownership / Huabu persistence
- second AI-only graph/database

## LCOS-native mapping

Huabu locality is absorbed into `SpatialNeighbourhoodProvider`; it is one provider among Selection, Pin, Relation, Context, Collection, Scene, RecentDelta and Retrieval evidence.

When code is later substantially ported line-for-line from an upstream pure helper, pin upstream SHA and add MIT attribution at that time. Current implementation is LCOS-native and conceptually informed rather than a copied Huabu module.
