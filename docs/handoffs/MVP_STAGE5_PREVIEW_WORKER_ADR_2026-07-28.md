# MVP Stage 5 — Preview Worker ADR

Date: 2026-07-28
Branch: `codex/mvp-fast-build`
Base before this slice: `b6b06f6 feat(mvp): show preview record status`

## Summary

Produced the Stage 5 Preview Worker ADR and implementation gate.

This stage is documentation / decision-prep only because real preview generation touches red-zone behavior: source file reads, cache writes, worker cancellation, and false-ready prevention.

## Files

- `docs/architecture/ADR_MVP_STAGE5_PREVIEW_WORKER_PLAN.md`
- `docs/handoffs/MVP_STAGE5_PREVIEW_WORKER_ADR_2026-07-28.md`
- `docs/mvp-materials/09_KNOWN_ISSUES.md`
- `docs/mvp-materials/10_REFERENCE_FEATURE_STATUS.md`

## Decision prepared

Recommended first implementation:

```text
Local Core PreviewWorkerService
→ TXT / Markdown / Image only
→ revisionId + previewProfile input
→ FileRecord path resolved server-side
→ PreviewCacheService atomic publish
→ PreviewRecord ready/failed/unsupported
```

Not approved by this stage:

- PDF preview.
- Bridge.
- Watcher-triggered preview.
- Schema migration.
- New dependencies.
- Browser path input.
- Browser shell execution.

## Tests required for next implementation stage

- Convert `ARCH-P3-010 worker crash or cancellation cannot publish ready PreviewRecord` from todo to passing.
- TXT/MD/Image ready cases.
- Unsupported/missing/throw/abort cases.
- Cache path containment.
- No graphVersion bump.
- No arbitrary path browser API.

## Tests run

Documentation-only slice.

Validation:

```text
git diff --check
```

## Browser / Runtime visible change

None.

Stage 4 remains the visible browser behavior:

- Work Rail shows `Preview status`.
- Current sample likely reports `not-generated`.

## Red condition

Real worker implementation remains red until Dz explicitly approves the ADR implementation scope.

## Next

If approved:

```text
Stage 5 implementation:
PreviewWorkerService + POST /projects/:projectId/previews + TXT/MD/Image renderers + tests
```

