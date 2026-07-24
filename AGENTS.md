# Local Creative OS v0.6 Engineering Contract

## Product contract

The primary interaction loop is `select → describe → run → confirm`.

- Canvas is the project surface.
- Work Rail is a single persistent contextual workbench.
- Composer is always available inside Work Rail.
- Command is an action before send, and a traceable record after send.
- Process nodes are generated automatically and stay visually secondary.
- Workspace is a semantic viewport on one Project Graph.
- A project may contain multiple Canvas Scopes without duplicating the graph.

## Code boundaries

- `App.tsx`: orchestration only.
- `features/workrail`: adaptive focus, composer and run/review states.
- `state/workContext.ts`: Target / Context inference.
- `features/canvas/scopeLayout.ts`: view-only layout proposals.
- `state/canvasClipboard.ts`: internal ArtifactView clipboard semantics.
- `model.ts`: frontend fixture model, transport agnostic.

## Hard rules

1. Never mount a second right-side panel.
2. Never add a generic empty AI greeting.
3. Never create a process node before the user sends an instruction.
4. Never move or copy a real local file when moving or duplicating a view.
5. Never auto-layout pinned user positions without preview and confirmation.
6. Never expose internal terms as required user steps.
7. Preserve keyboard and reduced-motion behavior.
