# Workflow Review / Checkpoint real adapters

## Task summary

Replace the decorative planned Review and Checkpoint shells with adapter-only components that can enter Workflow only when a real Core identity exists.

## Actual scope

- Added optional `runId` to identity-only Surface bindings.
- Review and Checkpoint Catalog entries are now `adapter-only`, never free-created from the Shelf.
- Local Core client can list the existing checkpoint endpoint.
- Workflow projects real RunReview and Checkpoint identities and offers an add action only for unprojected records.
- Review opens the existing real Run review flow; Checkpoint displays its immutable Core label/date.
- Surface geometry remains Presentation-only and persists through the existing bridge.

## Data flow

Before:

`Catalog planned shell -> renderer exists -> no truthful creation/binding path`

After:

`Core RunReview / Checkpoint -> Workflow adapter affordance -> identity-only SurfaceElement -> movable Presentation component`

No Run, Return, Revision or Checkpoint payload is copied into Presentation state.

## Modified files

- `packages/contracts/src/presentations.ts`
- `apps/web/src/runtime/localCoreClient.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/features/surfaces/ProjectionSurfaces.tsx`
- `apps/web/src/features/surfaces/WorkflowSurface.tsx`
- `apps/web/src/features/spatial/model/surfaceComponentCatalog.ts`
- `apps/web/src/features/spatial/components/surfaceComponentTypes.ts`
- `apps/web/src/features/spatial/components/WorkflowComponentRenderers.tsx`
- `apps/web/src/spatial-components.css`
- `apps/web/tests/surfaceComponentFoundation.test.ts`

## Verification

- Full workspace TypeScript check: PASS.
- Surface foundation + Local Core Presentation persistence: 30/30 PASS.
- Local Core/contracts build chain: PASS.

## Risk and rollback

- Review polling now remains active while Workflow is open even if the right rail is collapsed, so real adapter choices do not disappear. It retains the existing 4-second cadence.
- Revert this commit to return both components to hidden planned status. Stored identity-only bindings remain data-safe.

## Remaining

- Checkpoint restoration itself remains owned by the existing Core/workspace-state flows; this component is a projection, not a second restore implementation.
- A full browser exercise with real pending Review and Checkpoint records remains part of RC hand testing.
