# Codex Start Here — LCOS v0.15 Final Convergence

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

1. S9 provider seams and regression.
2. S10 format/extractor coverage and regression.
3. Final convergence audit, including removal of any Web control-state fallback that violates `ExecutionItemV1.availableActions` fail-close.
4. Browser v0.15 E2E.
5. Real semantic provider E2E (Curator + Skill Author + retrieval).
6. Bridge/MCP E2E.
7. Desktop/Companion automated E2E.
8. Capture + restart persistence + failure injection.
9. Windows native QA.
10. Installer + cross-system Golden Path.

See the external final-convergence construction package if supplied for the complete release matrix.
