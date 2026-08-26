# Main Agent Surface Composer parity

## Task summary

Let Human and Agent use the same trusted component Catalog on all three primary Surfaces.

## Actual scope

- Main Agent Composer can propose a Presentation Region or a bound Workbench from the current selection.
- Intent resolves through the existing deterministic geometry helper.
- Proposal renders as a ghost and requires explicit Keep; Revert drops it without persistence.
- Selected Project objects are only referenced by stable view identity and are not moved or rewritten.
- Context and Workflow Composer choices remain unchanged.

## Flow change

Before:

`Main selection -> legacy reorganize panel only`

After:

`Main selection -> SurfaceIntent -> validated SurfaceOps -> ghost -> Keep/Revert -> Core Presentation`

The existing semantic reorganize feature remains separate because it proposes node layout rather than Surface components.

## Modified files

- `apps/web/src/features/surfaces/AgentSurfaceComposer.tsx`
- `apps/web/src/features/canvas/ProjectCanvas.tsx`
- `apps/web/tests/surfaceComponentFoundation.test.ts`

## Verification

- `git diff --check`: PASS.
- Web TypeScript check: PASS.
- Surface component foundation: 16/16 PASS.

## Risk and rollback

- Two Agent affordances now exist on Main for different jobs: component composition and semantic node reorganization. Their labels and outputs remain distinct.
- Revert this commit to remove only Main Composer parity. Existing components and Project Truth are unaffected.

## Remaining

- Base-revision conflict reporting is supplied by the Presentation bridge CAS path; real-browser conflict handling still needs RC pressure evidence.
- Cross-Surface suggestions remain explicit and are not silently applied.
