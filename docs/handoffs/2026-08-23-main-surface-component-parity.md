# Main Surface component parity

## Task summary

Close the mismatch where the shared Catalog advertised Main components but only Context and Workflow mounted the shared Shelf and component layer.

## Actual scope

- Main now reads/writes trusted `surfaceElements` through the existing Local Core Presentation bridge.
- The shared Component Shelf is available on Main.
- Main mounts the same component frame/layer used by Context and Workflow.
- Selection bounds seed identity-only bindings and deterministic placement.
- Existing legacy Main spatial regions remain intact and recoverable; this patch does not migrate or delete them.
- Workbench binding copy now understands `projectViewIds` arrays instead of incorrectly showing an unbound state.

## Flow change

Before:

`Main -> legacy fence adapter only`

After:

`Main selection / viewport -> shared Catalog -> SurfaceElement -> Core Presentation -> shared SurfaceFrame`

Project entities and canonical canvas coordinates are not copied into SurfaceElement state.

## Modified files

- `apps/web/src/App.tsx`
- `apps/web/src/features/canvas/ProjectCanvas.tsx`
- `apps/web/src/features/spatial/components/WorkflowComponentRenderers.tsx`

## Verification

- Web TypeScript check: PASS.
- Surface component foundation: 15/15 PASS.
- Production web build: PASS; inherited large-chunk warnings remain.

## Risk and rollback

- Main can temporarily show both an existing legacy spatial region and a newly created Catalog Fence. They have distinct durable identities; no automatic conversion is attempted in v0.1.
- Revert this commit to remove the Main Shelf/layer. Stored Presentation elements remain data-safe and can be rendered again after reapplying the feature.

## Remaining

- Agent Composer parity on Main is a separate reviewable change.
- Portal / Review / Checkpoint remain hidden while their durable binding/creation paths are incomplete.
