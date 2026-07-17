# Progress

## Current milestone

Day 3 — portfolio demo packaging and PortaSplit narrative calibration.

## Completed

- Project path created at `E:\Codex 项目\演示demo`.
- Bridge project id `adframe_demo` mapped to this project's `.workbuddy` inbox.
- Bridge and watcher runtime started and the project inbox protocol corrected.
- Headless WorkBuddy route was tested, found unreliable, and stopped; future Buddy work uses direct Bridge dispatch plus Feishu wake-up.
- React + TypeScript + Vite scaffold created.
- Product scope and project rules frozen.
- WorkBuddy visual-reference research returned and passed Bridge review.
- Full-screen concept generated and saved under `docs/design/`.
- Concept and data-model sub-agent reviews completed.
- Day 1 implementation specification frozen.
- Static one-page workspace shell implemented.
- Asset/version switching, evaluation-tab switching, context expansion, and export-drawer expansion implemented as presentation-only interactions.
- `npm run lint` and `npm run build` pass.
- 1366×768 and 1024×768 evidence saved under `docs/qa/`; 1024px has no horizontal overflow.
- Day 1 passed Sol review; `docs/DAY1_SOL_REVIEW.md` remains the frozen audit baseline.
- Creative Review replaces numeric scoring with Issue / Impact / Evidence / Suggestion cards.
- Review status supports Open / Accepted / Resolved and persists in localStorage.
- PortaSplit review examples were calibrated against the real project iteration record rather than invented dashboard data.
- Product direction narrowed from finished-video review to pre-production script and Shot Review.
- Left rail now manages Script V1/V2/V3 and script sections; the center is an editable Script Canvas.
- Human Review, version-bound Mock AI Skill analysis, Decision, source/current comparison, local persistence, and Codex Handoff are implemented.
- Review Cards are isolated by Script Version + Segment; switching versions no longer mixes review counts, AI drafts, decisions or exports.
- Brief Snapshot and Creative Direction now supply the commercial judgment context; Purpose, Product Role and Locked Elements are visible per segment.
- Prompt editing was removed from the master script. Shot List, Prompt Pack and Vendor Brief remain clearly marked derived outputs.
- Markdown, JSON and Codex Handoff exports now contain the selected version, accepted issues, evidence, Keep/Modify/Remove decisions and next-version goal.
- Buddy completed `task_909dd410`; its intermediate build blockers were resolved and the task passed final review.
- Day 2 lint/build pass; 1366×768 and 1024×768 have no horizontal overflow.
- Stable Day 2 snapshot tagged as `v0.2.0-script-review`; hardening continues on `refactor/reusable-review-core`.
- Script, Review, AI Draft, Decision and UI start state now persist in one schema-versioned project envelope.
- Legacy Day 2 localStorage keys migrate once into the new envelope; incompatible/corrupt state falls back to demo seed.
- Demo Reset uses a confirmation dialog and restores Script V2 / PRODUCT SETUP / Human Review with an Open Review and pending AI Draft.
- Markdown and Codex/JSON payload assembly moved out of the UI component into reusable builders.
- Day 2.5 passed Codex, sub-agent and WorkBuddy review and was frozen at commits `b3d590d` and `48f03ad`.
- PortaSplit V1/V2/V3 now form a truthful revision chain: ice-block draft → human heat actions with an over-dense install paragraph → three-shot production handoff candidate.
- Script V2 / PRODUCT SETUP includes two evidence-backed Human Review cards and a segment-specific Mock AI draft.
- Day 3 demo script, portfolio README and case study are complete.
- 1366×768 and 1024×768 Day 3 screenshots render without horizontal overflow.

## In progress

- Day 3 final interaction regression, Buddy verification and audit packaging.

## Next

- Keep Match Night deferred until project-scoped seed/storage can be added without weakening the three-minute demo.
- Keep video-finished-asset evaluation as the future `AdFrame Motion` stage.
