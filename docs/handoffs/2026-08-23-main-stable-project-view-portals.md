# Main stable Project View Portals

## Task summary

Turn Portal from a decorative planned renderer into an adapter-only navigation component backed by a real Rail Project View identity.

## Actual scope

- Portal is `adapter-only`; it is not a generic empty Shelf component.
- Main Shelf lists existing Scene / Context / Workflow targets from the Project Rail.
- Creating a Portal stores only `projectViewId`, Presentation geometry and a display label.
- Double-click follows the existing frozen open gesture and activates the real target through the same Rail navigation handler.
- No target members, Context history or Workflow data are copied into the Portal.

## Flow change

Before:

`Portal renderer -> unbound label -> no creation/navigation path`

After:

`stable Project Rail View -> identity-only Portal -> explicit double-click -> existing view activation`

## Modified files

- `apps/web/src/App.tsx`
- `apps/web/src/features/canvas/ProjectCanvas.tsx`
- `apps/web/src/features/spatial/components/SurfaceComponentShelf.tsx`
- `apps/web/src/features/spatial/components/PortalComponent.tsx`
- `apps/web/src/features/spatial/components/surfaceComponentTypes.ts`
- `apps/web/src/features/spatial/model/surfaceComponentCatalog.ts`
- `apps/web/src/spatial-components.css`
- `apps/web/tests/surfaceComponentFoundation.test.ts`

## Verification

- `git diff --check`: PASS.
- Web TypeScript check: PASS.
- Surface component foundation: 18/18 PASS.

## Risk and rollback

- v0.1 exposes creation from Main first. The shared Portal renderer is Surface-agnostic, but Context/Workflow Shelves do not yet receive the Rail target list; this avoids duplicating navigation plumbing before the Main path is browser-verified.
- Revert this commit to hide Portal creation again. Existing identity-only elements remain data-safe.

## Remaining

- RC browser test: create Portal, reload, double-click, verify target identity and independent camera/layout.
- Context/Workflow Portal creation can reuse the same adapter after Main validation; no new data contract is required.
