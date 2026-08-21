# LCOS Frontend Semantic Drop PASS4 — Build / Handoff

Date: 2026-08-17

## Verdict

- **Source implementation:** PASS
- **TS/TSX syntax transpile:** PASS — 155 source files
- **Declaration parse:** PASS — 2 `.d.ts` files
- **CSS parse:** PASS — 11 stylesheets
- **Full workspace build:** BLOCKED by the same frontend-only package dependency gap (`@types/node`, `vite/client`)
- **Rendered Edge / Chrome interaction QA:** PENDING full LCOS monorepo/browser runtime

This pass does not add another Drop system. It refactors the existing cross-surface drop behavior around one product concept:

> **Semantic Drop is the interaction. Right-drag is only its fastest trigger.**

---

## 1. Edge first-open compatibility notice

Modified:

`apps/web/src/features/ui/LcosToaster.tsx`

Behavior:

- Detect **desktop Microsoft Edge only**.
- Prefer User-Agent Client Hints brand detection; fall back to desktop `Edg/` token.
- Chrome does not see this notice.
- Notice is shown only until the user dismisses it once.
- Dismissal is persisted under:

```text
lcos.edge-semantic-drop-notice.v1
```

Notice copy:

> Edge：建议关闭「鼠标手势」
>
> Edge 的原生右键鼠标手势会和 LCOS Semantic Drop 冲突。如果你平时不用它，建议在 Edge 设置里关闭「鼠标手势」，右键拖放体验最好。

This intentionally does **not** attempt to inspect, toggle, or fight Edge's browser-level mouse gesture setting from webpage JavaScript.

---

## 2. New Semantic Drop input contract

New canonical file:

`apps/web/src/features/spatial/semanticDrop.ts`

Legacy compatibility bridge remains:

`apps/web/src/features/spatial/semanticRightDrop.ts`

Supported pointer triggers:

```text
secondary-pointer
modifier-primary
handle-primary
```

User-facing mapping:

```text
Right mouse drag
      |
Alt / Option + left drag
      |
Visible grab handle + primary drag
      |
      v
Semantic Drop Session
      |
Canvas / Context / Workflow / Project View targets
```

Shared helpers:

```ts
semanticDropTriggerFromPointer()
isSemanticDropPointer()
beginSemanticDrop()
```

The old `beginSemanticRightDrop` export remains as a deprecated alias so old tests/fixtures do not require a flag-day migration.

---

## 3. Grab-handle fallback

A small Semantic Drop grab handle now appears on hover / selection for key work objects:

- Main Canvas nodes
- shared `SurfaceObject`
- Context core objects
- Workflow graph objects

The handle uses **primary-button drag**, so it is usable with trackpads and other pointer workflows without teaching the user a browser-specific right-button trick.

The handle does not replace right-drag. It is the visible affordance for the same Semantic Drop state machine.

---

## 4. Main Canvas behavior

Modified:

`apps/web/src/features/canvas/ProjectCanvas.tsx`

Before:

```text
Right button = unique semantic projection gesture
Left button = spatial movement
```

Now:

```text
Semantic Drop trigger detected
→ source remains in place
→ Semantic Drop ghost / target preview
→ commit projection

otherwise primary drag
→ ordinary spatial movement
```

This prevents `handle-primary` / `Alt+primary` from accidentally entering the ordinary node-move candidate path.

The main canvas session stores the trigger and expected mouse-button mask so a browser/OS cancellation can abort the semantic session instead of leaving stale drag state behind.

---

## 5. Surface objects / Context / Workflow

Modified:

- `features/surfaces/SurfaceObject.tsx`
- `features/surfaces/ContextTreeSurface.tsx`
- `features/surfaces/ContextRelationshipHomeSurface.tsx`
- `features/surfaces/WorkflowGraphSurface.tsx`

All now call the generic `beginSemanticDrop()` contract rather than hard-coding `beginSemanticRightDrop()`.

Workflow ordinary left-drag only starts when the event was **not** consumed as Semantic Drop.

---

## 6. Workspace Rail cancellation fix

Modified:

`features/shell/WorkspaceRailVNext.tsx`

The rail now uses the same trigger grammar:

- right-drag → Semantic Drop
- Alt/Option + left-drag → Semantic Drop
- ordinary left-drag → rail reorder/delete behavior

Important bug fix:

### Before

```text
pointercancel
→ finishRightDrop()
→ possible commit
```

A browser-level interruption could therefore be interpreted like a normal pointer release.

### Now

```text
pointercancel
→ cancelRailSemanticDrop()
→ remove target state / ghost
→ NEVER commit
```

This is especially important around Edge mouse-gesture conflicts.

---

## 7. Dynamic interaction styling

Modified:

`apps/web/src/interaction-system.css`

Added:

- `.lcos-semantic-drop-handle`
- semantic source picked-up state
- handle hover / selected / coarse-pointer rules
- dynamic DotSignal response during Semantic Drop
- trigger-aware ghost hook

The visible handle is intentionally quiet at idle and appears on hover / selection, preserving the current LCOS material-first visual direction.

---

## 8. Browser compatibility policy after PASS4

### Chrome / Chromium without conflicting gesture ownership

```text
Right drag = fastest Semantic Drop
```

No compatibility prompt.

### Microsoft Edge desktop

First LCOS open only:

```text
small Sonner notice
→ recommend disabling Edge mouse gestures
→ dismiss once
```

After that LCOS does not keep nagging the user.

Fallbacks still exist even if the user keeps Edge mouse gestures enabled:

```text
Alt / Option + primary drag
or
visible Semantic Drop handle
```

### Touch / coarse pointer

When an object is selected, the handle becomes larger and remains available as the explicit Semantic Drop affordance.

---

## 9. Source gates run

### TypeScript / TSX syntax

```text
155 TS / TSX source files
2 declaration files
0 parse/transpile errors
```

### CSS

```text
11 CSS files
0 PostCSS parse errors
```

### Full build attempt

Command:

```bash
npm --prefix apps/web run build
```

Blocked before application typechecking/build by the frontend-only handoff package missing complete workspace dependencies:

```text
TS2688 Cannot find type definition file for 'node'
TS2688 Cannot find type definition file for 'vite/client'
```

This is the same packaging limitation as PASS3. The stale baseline dist is not presented as a PASS4 build.

---

## 10. Browser QA to run after merge into full repo

Required real-browser checks:

1. Chrome: node right-drag → Context / Workflow commits normally.
2. Chrome: Alt+left-drag does the exact same Semantic Drop and does not move the source.
3. Chrome: grab-handle primary drag does the exact same Semantic Drop.
4. Edge first open: notice appears once.
5. Edge after dismiss + reload: notice does not reappear.
6. Chrome: Edge notice never appears.
7. Edge with browser mouse gestures enabled: `pointercancel` never commits a Rail Semantic Drop.
8. Escape during Semantic Drop cancels the operation.
9. Touch/coarse-pointer selected object exposes the larger grab handle.
10. Existing ordinary primary node movement and Rail reorder remain unchanged when no Semantic Drop trigger is used.

---

## 11. Product freeze after this pass

The UI language should now describe this feature as:

> **Semantic Drop**

not:

> right-click drag system

The preferred desktop/browser interaction remains right-drag because it is fast and visually clean. Other input methods are transports into the same semantic session, not separate feature modes.
