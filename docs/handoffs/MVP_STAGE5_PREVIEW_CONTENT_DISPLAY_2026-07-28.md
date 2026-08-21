# MVP Stage 5 — Preview Content Display

Date: 2026-07-28
Branch: `codex/mvp-fast-build`

## Summary

Completed the missing display side of Stage 5 preview generation.

Before this slice, `PreviewRecord` status could become `ready`, but the Web inspector / Work Rail preview surface still rendered a generic placeholder. This caused uploaded JPG / Markdown files to look like they had no real preview in the right rail.

## Actual scope

- Added a read-only Local Core route for reading cached preview content by `PreviewRecord` id.
- Mapped ready preview cache content into Web `CanvasNode` preview fields.
- Rendered real image previews in the Work Rail preview surface.
- Rendered real text previews for text-like content.
- Added temporary browser-side preview support for dropped local files:
  - `image/*` uses object URL.
  - text-like files use `File.text()` and are truncated to 64 KiB for UI preview.
- Disabled native browser dragging on preview images so dragging a selected image node does not start a browser file/image drag and accidentally trigger canvas drop behavior.

## Supported in this slice

- Runtime ready previews:
  - `image/*`
  - `text/*`
- Temporary dropped-file previews:
  - `image/*`, including JPG/JPEG/PNG/WEBP/GIF/BMP/SVG/AVIF when the browser supplies a usable image MIME or filename.
  - text-like files: MD/Markdown/TXT/LOG/JSON/CSV/TSV/YAML/YML.

## Explicitly not supported yet

- DOCX content extraction.
- PDF page rendering.
- PPT/PPTX page rendering.

These formats should be handled by future dedicated renderers. They should not be displayed as if real content has been extracted.

## Files changed

- `apps/local-core/src/server.ts`
- `apps/local-core/src/metadata-repository.ts`
- `apps/local-core/tests/server.test.ts`
- `apps/web/src/model.ts`
- `apps/web/src/runtime/localCoreClient.ts`
- `apps/web/src/runtime/runtimeBridge.ts`
- `apps/web/tests/runtimeBridge.test.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/features/canvas/CanvasNodeVisual.tsx`
- `apps/web/src/features/workrail/PreviewSurface.tsx`
- `apps/web/src/surface.css`

## Flow change

Before:

```text
Generate Preview
→ PreviewRecord.status = ready
→ Web maps status only
→ Work Rail renders generic placeholder
```

After:

```text
Generate Preview
→ PreviewRecord.status = ready
→ Web requests /preview-records/:id/content
→ image/text preview content maps onto CanvasNode
→ Work Rail renders real image or text
```

## Security / boundary notes

- Browser never sends an arbitrary file path for preview content.
- Preview content is read only by opaque `PreviewRecord` id under the project route.
- No CORS expansion.
- No schema migration.
- No new dependency.
- No Bridge connection.

## Tests

Passed before handoff:

- `npm run typecheck --workspace @local-creative-os/web`
- `npm run typecheck --workspace @local-creative-os/local-core`
- `npx vitest run apps/web/tests/runtimeBridge.test.ts apps/local-core/tests/server.test.ts --reporter=verbose`

## Manual validation

After starting the app:

1. Drop a JPG/PNG/WebP image onto the canvas.
2. Select the image node.
3. Confirm the right rail shows the real image, not the generic placeholder.
4. Drag inside the image card; it should select/move the node, not create a duplicated node through browser-native image drag.
5. Drop an MD/TXT file.
6. Select it and confirm the right rail shows real text content.
7. Drop DOCX/PDF/PPTX and confirm they do not pretend to have extracted content.

## Risk

Medium-low.

The route returns base64 JSON, which is simple and bounded by the current preview cache renderer behavior. Future larger previews should move to a streaming/binary endpoint or object URL lifecycle management.

## Rollback

Revert this commit. Preview status records will still exist, but the right rail will return to status-only placeholder rendering.
