# Context / Workflow overview projection closeout

## Task summary

Apply the frozen 300+ overview policy to the Context and Workflow material renderers, not only to Main.

## Actual scope

- Added one shared camera-local overview projection helper.
- Context and Workflow retain complete membership, positions and minimap items.
- The current viewport plus explicit selection forms the DOM candidate set.
- At 300+ objects the rich DOM projection is deterministically capped at 180 items; selected identities always survive.
- Relations render only when both projected endpoints are present.

## Data flow

Before:

`Project Truth -> complete Presentation membership -> every node + every local edge in DOM`

After:

`Project Truth -> complete Presentation membership -> camera-local candidates + selected -> overview DOM projection`

The projection is transient and is never written to Local Core.

## Modified files

- `apps/web/src/features/spatial/spatialLod.ts`
- `apps/web/src/features/surfaces/ContextSpaceSurface.tsx`
- `apps/web/src/features/surfaces/WorkflowSurface.tsx`
- `apps/web/tests/spatialCamera.test.ts`

## Verification

- Web TypeScript check: PASS.
- `spatialCamera.test.ts` + `surfaceComponentFoundation.test.ts`: 21/21 PASS.
- Added a 500-item contract test proving the DOM projection is capped, selected identity survives, and source membership remains complete.

## Risk and rollback

- A node outside the current overview projection is intentionally absent from the rich DOM until camera navigation brings it into the candidate area; the minimap remains complete.
- Revert this commit to restore full DOM rendering. No stored data requires migration.

## Remaining

- Real-browser timing/memory evidence at 20/100/500/1000 remains an RC measurement task; this patch establishes the required rendering behavior but does not invent unsupported FPS claims.
