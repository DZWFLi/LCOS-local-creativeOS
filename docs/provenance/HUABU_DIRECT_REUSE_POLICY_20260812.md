# Huabu direct reuse policy for LCOS closeout

Huabu is an MIT-licensed Microsoft open-source project. LCOS may directly reuse isolated, architecture-neutral implementation pieces when doing so reduces correctness risk, provided the upstream source/revision and MIT notice are preserved for copied/substantially derived code.

## Reuse tiers

### DIRECT PORT (allowed after dependency check)
- pure transient gesture-preview helpers/store semantics
- pure geometry / snap-guide helpers
- inverse-delta / touched-field fingerprint helpers for safe revert
- architecture-boundary test patterns

A direct port must record:
- upstream repository: `microsoft/Huabu`
- exact pinned commit SHA used by Codex
- upstream file path
- copied/adapted range or mechanism
- MIT attribution in the repository NOTICE / third-party notice as appropriate

### ADAPT PATTERN, DO NOT COPY WHOLE MODULE
- session read-before-write
- canvas/write coordination
- persistence transactions
- spatial neighborhood retrieval
- agent change review

These mechanisms touch LCOS's SQLite, Revision/CAS, PresentationView, CLI/Skill and provenance contracts. Whole-module copying would import the wrong ownership model.

### REJECT AS ARCHITECTURE
- replacing LCOS SpatialCanvas with Huabu/ReactFlow canvas ownership
- Space/Frame as LCOS business ontology
- Electron/ACP-only front door
- Huabu storage/sidecar architecture
- spatial proximity as semantic truth

## GUI rule

Huabu is a visual/interactivity benchmark, not LCOS's design system. Reuse behavior where it is isolated; implement visual hierarchy in LCOS's existing components/tokens so the product does not acquire a second shell/component architecture.

## Current assisted patch

The 2026-08-12 vision-assisted frontend patch does **not** vendor Huabu source code. It adapts previously audited interaction patterns and fixes LCOS-native state/UI issues. If Codex later directly ports upstream code, it must add exact SHA/path provenance before commit.
