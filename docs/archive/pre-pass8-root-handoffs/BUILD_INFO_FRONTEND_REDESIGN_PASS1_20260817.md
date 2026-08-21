# LCOS Frontend Redesign Pass 1 — 2026-08-17

## Baseline

- Input package: `LCOS_FRONTEND_PACKAGE_20260817.zip`
- Baseline app version: `0.9.0`
- Baseline branch: `codex/r1-vision-merge-20260812`
- Baseline commit: `950acba9fca90bbe03872e7bf0fed552b9de2321`
- Pass type: source-level interaction + structural redesign

## User-facing goal

This pass is not a CSS polish pass. It changes how the main surfaces behave and read:

1. Main Canvas nodes become compact working materials instead of large generic cards.
2. The canonical 16×16 DotGlyph becomes a dynamic signal grammar for hover / selected / receiving / running states.
3. Context Graph becomes an associative field of semantic islands instead of purple bubbles.
4. Context Signal Track becomes a denser interpretation track with explicit insertion / receiving feedback.
5. Workflow Graph and Workflow Canvas become directional execution surfaces with compact steps and proximity connection preview.
6. Cross-surface semantic drop destinations visually open before commit.
7. SurfaceObject no longer spawns a duplicate hover info card.
8. Capability Dock Context / Workflow / Arrange entries use the same DotGlyph signal language.
9. Local Agent is reduced toward an anchored utility and participates in the signal grammar.

## Important build note

The uploaded frontend package is not a complete LCOS monorepo checkout. It does not contain the local workspace packages / node_modules required by `apps/web` (`@local-creative-os/*`, `vite/client`, Node type packages, etc.). Therefore this pass cannot honestly produce a rebuilt production `dist` inside this sandbox.

The original compiled `dist` has been renamed to `baseline-dist-950acba` so it is not mistaken for a build containing this redesign.

## Validation completed here

- TypeScript/TSX syntax transpile check: PASS for every changed TS/TSX file.
- `interaction-system.css` PostCSS parse: PASS.
- Full `tsc -p apps/web/tsconfig.json`: UNREACHABLE in this package because required type packages / monorepo dependencies are absent. The first failures are missing `node` and `vite/client` type definitions, before project source typechecking can begin.
- Browser visual QA: UNREACHABLE here because the modified source cannot be rebuilt from the standalone package. Visual acceptance must happen after applying this source to the complete repo.

## Full-repo acceptance gate

After integrating into the full LCOS repo, do not call this visual pass complete until all of these are checked in the real app:

- Main Canvas: idle → hover → selected → drag → drop confirmation.
- DotGlyph: Context / Workflow / Workspace / Agent at idle, hover, selected, receiving, running.
- Context Graph: Context island selection, project node selection, semantic drop receiving state, double-click entry.
- Signal Track: segment hover, selection, segment drop, new-segment insertion target, member selection/removal.
- Workflow Graph: compact overview, selected workflow, active/completed/failed states, semantic drop.
- Workflow Canvas: node hover/selected, whole-node proximity connection target, temporary edge, edge inspector.
- Capability Dock: hover/active/drop target signal transitions.
- Local Agent: idle/focus/sent signal states.
- Desktop viewport + narrow sidecar viewport.
- Console errors/warnings and accessibility/reduced-motion behavior.

## Changed source files

- `apps/web/src/main.tsx`
- `apps/web/src/interaction-system.css` (new consolidated interaction layer)
- `apps/web/src/features/design/DotGlyph.tsx`
- `apps/web/src/features/canvas/canvasGeometry.ts`
- `apps/web/src/features/surfaces/SurfaceObject.tsx`
- `apps/web/src/features/surfaces/ContextRelationshipHomeSurface.tsx`
- `apps/web/src/features/surfaces/ContextFlowSurface.tsx`
- `apps/web/src/features/surfaces/WorkflowGraphSurface.tsx`
- `apps/web/src/features/surfaces/WorkflowSurface.tsx`
- `apps/web/src/features/surfaces/surfaceLayouts.ts`
- `apps/web/src/features/shell/SurfaceDock.tsx`
- `apps/web/src/features/shell/SurfaceAgentNode.tsx`

## CSS migration

`main.tsx` now imports `interaction-system.css` instead of importing these three additive patch layers:

- `r31a-closeout.css`
- `b1-spatial-visual.css`
- `b3-gui-test.css`

The old files remain in the package as historical/reference source but are no longer active imports. The new layer consolidates and replaces their relevant interaction visuals.

## Pass 2 after real screenshot review

Do not broaden features. Use real screenshots/recordings from the integrated repo to tune:

- node optical scale vs zoom bands;
- Context island distribution/density;
- Workflow step width and edge curvature;
- selection toolbar proximity;
- DotGlyph cell transformation amplitude and timing;
- Dock / Sidecar chrome after the working surfaces are accepted.
