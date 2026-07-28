# MVP Stage 7 — Shared Preview Copy Cleanup

Date: 2026-07-28
Branch: `codex/mvp-fast-build`

## Summary

Cleaned legacy PortaSplit / Thinker hardcoded copy from shared preview-rendering UI components.

This slice addresses the visible issue where runtime sample nodes could still display `PORTASPLIT` / `Thinker 创意方向` even after fixture isolation.

## Actual scope

- Updated Canvas node preview artwork to render from `CanvasNode` runtime fields:
  - `title`
  - `subtitle`
  - `fileType`
  - `previewStatus`
- Updated Work Rail preview surface to render generic runtime copy instead of fixed PortaSplit / Thinker labels.
- Did not change Domain semantics.
- Did not change SQLite schema.
- Did not add dependencies.
- Did not connect Bridge.

## Files changed

- `apps/web/src/features/canvas/CanvasNodeVisual.tsx`
- `apps/web/src/features/workrail/PreviewSurface.tsx`
- `docs/handoffs/MVP_STAGE7_SHARED_PREVIEW_COPY_CLEANUP_2026-07-28.md`

## Flow change

Before:

```text
Runtime node
→ shared preview component
→ displays hardcoded PortaSplit / Thinker presentation copy
```

After:

```text
Runtime node
→ shared preview component
→ displays node title / subtitle / file type / preview status
```

## Runtime data impact

None.

The earlier disposable sample graph was reset through the Local Core API to restore the intended MVP sample shape:

- 4 artifact views
- 4 artifacts
- 3 relations

That reset is runtime state, not a git-tracked source change.

## Intentionally left for later

The QA waiting/review/accepted fixture states are still retained in the isolated QA fixture area. They are not used as Runtime truth, but should not be deleted before Bridge / Run states are redesigned.

## Tests

To be run before commit:

- `npm run typecheck --workspace @local-creative-os/web`
- `npm run check:fast`

## Risk

Low.

The change only replaces hardcoded preview copy with existing `CanvasNode` fields. If a node lacks subtitle, the UI falls back to preview status copy.

## Rollback

Revert this commit or restore the two UI component files.
