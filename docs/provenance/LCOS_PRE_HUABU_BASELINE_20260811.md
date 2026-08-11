# LCOS Public Git Freeze｜Pre-Huabu Audit Baseline

- Freeze date: 2026-08-11
- Tag: `pre-huabu-audit-2026-08-11`

## Purpose

This commit/tag freezes the current LCOS implementation and design state before any code-level Huabu comparison or reuse work begins.

The goal is not to claim exclusive ownership of broad ideas such as spatial canvases, agent workspaces, retrieval, skills, or persistent context. Those concepts have many prior implementations.

The goal is to preserve a truthful engineering provenance record showing what LCOS had independently converged on before the Huabu repository became a direct implementation reference.

## What this baseline includes

- Core / Runtime / GUI
- Capture Plane / Project Affinity / Staging
- Presentation / Agent Reorganize / Rollback
- Indexed Curator Skill（thin SKILL.md + skill.index.yaml + routes/policies/recipes）
- Retrieval / sqlite-vec KNN / FTS + vector + relation 混合管线
- Ollama integration（embedding probe + native KNN）
- Session Continuity（session_context_refs）
- architecture docs / research docs / tests

No Huabu-derived code or design changes were introduced before this freeze commit.

## Provenance note

LCOS had already established the following principles before the Huabu code-level audit:

- Zero-Front-Door
- Zero Selection
- Zero Naming
- Semantic Late-Binding
- Agent + Skill + CLI → simple deterministic Core → nodes / relations / provenance → Presentation → GUI
- Capture Plane
- Project Affinity / Staging
- Selection as explicit context
- FTS + vector + relation retrieval
- PresentationView persistence
- Domain Relation vs Presentation Edge
- manual anchors / agent reorganize / rollback
- cross-session context continuity
- thin indexed Skill with progressive disclosure
- optional local intelligence via Ollama

Huabu was identified as a highly relevant external comparison project on 2026-08-11.

From this point onward, any Huabu-derived implementation idea or directly reused code is documented separately with source attribution and license review (see `HUABU_COMPARISON_LOG.md` and `THIRD_PARTY_CODE_ATTRIBUTION.md`).

## Git commands used to create this freeze

```bash
git add -A
git commit -m "chore: freeze LCOS pre-Huabu audit baseline"
git tag -a pre-huabu-audit-2026-08-11 -m "LCOS baseline before Huabu code-level comparison"
git switch -c research/huabu-gap-audit-20260811
```

Old history is not squashed; it truthfully represents development.
