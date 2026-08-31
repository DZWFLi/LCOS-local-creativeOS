# LCOS v0.15 · A22 Object-local Interaction Grammar Closeout

Date: 2026-08-31
Baseline authority: real local `4c90d4d` + exact-cold A21 final patch
Status: stacked source/static candidate

## Proposition

A22 closes the current object-local GUI grammar regressions without entering Phase B morphology work.

```text
persistent spatial feedback
→ Selection / Color Pin / Locator

direct object actions
→ top-right Action Arc

AI work
→ Compact Composer

management
→ Right-click / More

Surface Component intrinsic work
→ Component Functional Face
```

A22 implements only the parts currently required to repair production interaction ownership. Color Pin / Focus / Search navigation and Composer/Voice refinement remain separately staged.

## Implemented

### Selection

- multi-selected members keep visible individual selection feedback;
- aggregate selection bounding box is restored;
- the aggregate field stays transparent and does not become a filled card;
- Selection feedback remains visible while transient UI is open.

### Action Arc

- `ObjectOrbit` remains the semantic behavior owner;
- visible full 360° ring and track are retired;
- action positions use deterministic hand-tuned templates around the visual top-right corner;
- primary visible action count is capped at four;
- controls remain compact screen-space HUD actions with hover/focus labels;
- top-layer overlay arbitration allows Action Arc underneath Compact Composer.

### Composer invocation

- stable single click on eligible content-like Main objects can request the existing Selection Composer;
- pointerdown remains Selection/drag territory;
- the request does not auto-focus the textarea;
- structural Collection/Context/Workflow/scope/workspace objects fail closed for implicit generic Composer;
- additive multi-selection closes single-target Composer via canonical Selection ownership.

### Right-click

- direct Focus / Pin / Relation duplication is removed from object context menu;
- object context menu is management-oriented: rename/copy/reference/duplicate/remove according to real capabilities;
- simple right-click vs Semantic Drop right-drag ownership remains intact.

### Surface Components

- Surface Component is projected as a Spatial Instrument rather than a mini-window;
- generic permanent `○ / − / ×` chrome is retired;
- a large Map Locator is persistently attached to the component top-center anchor;
- collapse now returns Locator-only, not an empty 34px bar;
- Component Action Arc owns collapse/expand and More;
- right-click/More owns lock-position and remove-projection management;
- intrinsic component body controls remain renderer-owned.

## Historical gate supersessions

A22 intentionally supersedes only these older product assertions:

1. `F4`: multi-selected members must recede inside a shared field → replaced by visible member + aggregate bounds.
2. `Native Visual`: ObjectOrbit must be a full 360° ring → replaced by top-right Action Arc.
3. `A09`: explicit Composer must dismiss object Orbit → replaced by layered Composer-above-Action-Arc coexistence for a single object.
4. `A11`: right-click exposes Focus/Pin → replaced by management-only right-click.
5. `shortcut-kill`: Conversation Where lives in the old Conversation Orbit → source navigation remains dedicated through Birth Provenance; the obsolete fifth Conversation Locate action is not restored.

No validator is relaxed into a generic PASS. Each updated gate now checks the newer owner explicitly.

## Validation contract

Required before formal local authority:

```text
A22 dedicated validator
full runnable v0.15 static sweep
changed TS/TSX syntax transpile
series cold apply: 4c90d4d → A21 → A22
real-local typecheck/unit after user merge
browser/human smoke for actual geometry/handfeel
```

Current construction environment has no `node_modules`; semantic typecheck was actually attempted and is `BLOCKED_ENV` with only missing `node` / `vite/client` type libraries. It is not claimed as PASS.

Construction validation:

```text
A22 dedicated                      19 / 19 PASS
Full runnable v0.15 static         50 PASS / 0 FAIL / 2 SKIP
Changed TS/TSX syntax transpile    15 / 15 PASS
Final cold apply-check/apply       PASS
Final cold dedicated               19 / 19 PASS
Final cold full static             50 PASS / 0 FAIL / 2 SKIP
user-language full scan            PASS (240 product-surface files)
Semantic typecheck                 BLOCKED_ENV
Browser/Human smoke                NOT RUN
```

The two skipped validators remain S9/S10 external semantic/provider gates.

`git diff --check` on the Windows-origin CRLF source reports carriage-return whitespace noise on added CRLF lines. This is the same cross-platform EOL condition seen in prior packages and is not reported as PASS.

## Runtime/Human smoke still required

At minimum:

- single-click content object → Selection + Action Arc + Compact Composer coexist;
- first Esc closes Composer, second Esc closes Arc;
- drag does not summon/steal Composer;
- Shift additive selection closes single-target Composer and shows readable member + aggregate selection feedback;
- right-click contains management actions and no duplicate Focus/Pin/Relation;
- Action Arc visually hugs the actual right-top range instead of reading as a large radial ring;
- Surface Component expanded state shows Locator without permanent generic controls;
- Component collapse leaves only the large Locator at the same spatial anchor;
- Component right-click and More do not duplicate intrinsic functional controls.

## Phase status

```text
A22 SOURCE / STATIC = PASS
A22 STACK COLD APPLY = PASS (final bytes)
A22 REAL LOCAL MERGE = PENDING
A22 HUMAN VISUAL ACCEPTANCE = PENDING
PHASE A COMPLETE = NO
PHASE B ADMISSION = NO
```
