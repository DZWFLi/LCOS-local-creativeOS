# MVP Stage 3 — Demo and Handoff Pack

Date: 2026-07-28
Branch: `codex/mvp-fast-build`
Base before this slice: `bcc1771 feat(mvp): show runtime file identity`

## Summary

Created the MVP fast-build materials package for demo, audit, and next-stage handoff.

This stage is documentation-only. It does not change product behavior, Domain semantics, SQLite schema, dependencies, Bridge, Watcher, Preview workers, or file write behavior.

## Scope

Added:

- runbook and demo path;
- Bridge reality statement;
- storage/file safety summary;
- test and health summary;
- known issues;
- Reference / Feedback feature status;
- sample project description;
- personal constraints for future Codex/Buddy handoff.

## Files

- `docs/mvp-materials/01_README_AND_RUN.md`
- `docs/mvp-materials/06_BRIDGE_REALITY/README.md`
- `docs/mvp-materials/07_STORAGE_AND_FILES.md`
- `docs/mvp-materials/08_TESTS_AND_HEALTH.txt`
- `docs/mvp-materials/09_KNOWN_ISSUES.md`
- `docs/mvp-materials/10_REFERENCE_FEATURE_STATUS.md`
- `docs/mvp-materials/11_SAMPLE_PROJECT/README.md`
- `docs/mvp-materials/12_PERSONAL_CONSTRAINTS.md`
- `docs/handoffs/MVP_STAGE3_DEMO_HANDOFF_PACK_2026-07-28.md`

## Flow

Before:

```text
Stage 1 / Stage 2 implementation handoffs
→ no committed docs/mvp-materials package in MVP worktree
```

After:

```text
Stage 1 / Stage 2 implementation handoffs
→ committed docs/mvp-materials package
→ demo operator can run, verify, and explain what is real vs not connected
```

## Tests

Documentation-only slice. No runtime code changed.

Recommended final sanity:

```text
git diff --check
```

Optional clean browser validation:

```text
npm run dev:open
```

## Browser / Runtime visible change

None from this slice.

Use the Stage 1 / Stage 2 visible behavior:

- Runtime sample project opens from Local Core.
- Canvas shows sample nodes.
- Work Rail shows Runtime identity for sample nodes.

## Risk

- The material package can become stale if Stage 4 changes preview behavior.
- The package intentionally says Bridge and Preview workers are not connected. Do not soften that language until code proves otherwise.

## Rollback

Revert this documentation slice.

## Next

Recommended Stage 4:

```text
Preview visibility/status, still read-only:
ArtifactRevision/FileRecord → PreviewRecord availability → UI status
```

Do not implement real renderer workers or Bridge unless separately approved.

