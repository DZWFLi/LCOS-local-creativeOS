# Codex Start Here — LCOS v0.15 Frontend Final Convergence

> **2026-08-31 authority update:** before doing anything else, read in full:
>
> 1. `docs/v015/convergence/MANDATORY_PRECONSTRUCTION_CONTEXT_20260831.md`
> 2. `docs/v015/convergence/CONSTRUCTION_SOP_FINAL_FROZEN_20260831.md`
> 3. `docs/v015/convergence/CONSTRUCTION_CONTEXT_INDEX_20260831.md`
> 4. `docs/v015/CONTEXT_TRACE_INDEX.md`
>
> The 2026-08-30 S9/S10 release ordering remains implementation evidence, but it no longer overrides the 2026-08-31 product/reality-feedback convergence gate. Human product smoke and correct production ownership must pass before Full E2E.

This is the v0.15 entry document. Pre-v0.15 root handoffs are historical only.

## Current baseline

The uploaded RC used for this convergence work is based on local direct-construction HEAD `44ab06b` (2026-08-30). That line already absorbed the important canonical decisions from the separate GPT integration lineage and then advanced beyond it.

Already present before S9/S10:

- S0–S4 / S8;
- ExecutionItemV1 UI seam;
- SkillPackage / SkillProposal / CompanionProjection / SkillComposition;
- P0-C `lcos-project-curator` semantic bridge;
- P0-D `lcos-skill-author` semantic bridge;
- agentlet ExecutionItem projection + progress;
- S6 project SSE + reconnect/polling fallback;
- S7 honest control capability gate;
- RESERVE seams for later capability families.

This source package additionally contains the S9/S10 convergence implementation. When applying it to the live Git worktree, commit S9 and S10 as separate reviewable commits if practical.

## Do not do

- Do not reset to GPT `651043f`.
- Do not re-apply historical GPT patches/PASS patches because hashes are absent.
- Do not rewrite semantic indexing from scratch.
- Do not create a second Curator/Skill Author runtime.
- Do not revive old GUI/Workspace interaction rules from 2026-08-18 documents.

## First recovery action when confused

Open `docs/v015/CONTEXT_TRACE_INDEX.md` and locate the concept. Follow its **Code → Tests → Decision evidence** route. If no route resolves the ambiguity, report `CONTEXT_GAP:` rather than guessing.

## Current final-convergence ordering

1. Phase A — Shared Spatial Kernel + production-owner cleanup.
2. Phase B — Object Species / Text / File / Link / HTML / Glyth / Project identity.
3. Phase C — Context / Workflow / Assembly / Skill restoration.
4. Phase D — HUD / Pin / Glyph / Material / Motion convergence.
5. Manual cross-surface Product Smoke.
6. Browser v0.15 E2E.
7. Real semantic provider + Bridge/MCP E2E.
8. Desktop/Companion/Capture/restart/failure-injection E2E.
9. Windows native QA.
10. Installer + final cross-system Golden Path.

The phase plan lives at `docs/v015/convergence/FRONTEND_CONVERGENCE_PLAN_20260831.md`. Patch/diff/handoff mechanics are governed only by the frozen SOP.
