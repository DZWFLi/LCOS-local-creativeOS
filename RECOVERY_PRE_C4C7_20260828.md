# LCOS v0.15 · Pre-C4/C7 Recovery Baseline

Date: 2026-08-28
Branch: \`archive/pre-c4-c7-20260828`

## Purpose

This branch freezes the recoverable full-stack state immediately before the frontend C-4/C-7 truth-wiring round is redone.

The frontend checkpoint is the historical C-3 endpoint at \`b98ebee8` (radial Conversation Orbit + conversation timeline reading). The backend is advanced linearly from that same ancestor through the eight backend commits ending at \`bf798217`, then the supplied \`bf79821 -> 2b0383c` correction is applied.

## Provenance

- Frontend / RC source archive: \`LCOS_RC真仓_b98ebee(1).zip`
  - SHA-256: \`d57af9dd691e95a54b873b6cc4e72cd1364e5099190c79014a128f42405207ce`
  - Git HEAD after extraction/reset: \`b98ebee8`
- Backend source archive: \`LCOS_RC后端HEAD_bf79821_整仓源码_20260827(1).zip`
  - SHA-256: \`c851adefced67ec31beec6b1d9930feb72886fd320a144660d0a3e3a059a13b0`
  - Git HEAD after extraction/reset: \`bf798217`
- Supplied incremental patch:
  - SHA-256: \`01b9e41b88ac856a637d59730b317036c57aede74068dac0e0d90fec8783e707`
  - Applied target blob: \`011b8b2798afd76e068e6e98ef4c0200b45029a4`
  - This is patch-equivalent to the supplied \`2b0383c` fix. The original 2b0383c commit object was not present in the bf79821 archive, so this recovery branch does not pretend to reproduce that exact commit SHA.
- Skill × Huabu handoff:
  - SHA-256: \`c1001a2a44c8e93961083975c81788e13cab284f041af083930a8cf4784c7d1b`
  - Archived at \`docs/recovery/LCOS_后端回传_Skill_Huabu对齐_20260827.md`.

## Git lineage verification

`b98ebee8` is an ancestor of \`bf798217`.

There are exactly 8 commits in \`b98ebee..bf79821`:

1. \`aabea465` selection L1 ladder
2. \`8a78618e` task-recipes cookbook
3. \`ef4e74f7` space search primitive
4. \`6170d843` selected-nodes e2e
5. \`1ee6af56` session lifecycle + execution gate contracts
6. \`98affb1d` live session binding
7. \`36f16769` three-entry execution gate
8. \`bf798217` conversation identity bridge + artifact birth provenance

Outside backend/contracts/tools/skills, that backend sequence changes only:

`apps/web/src/features/workflow/permissionGate.ts`

Therefore the C-3 frontend body at b98ebee is preserved while the backend truth prerequisites needed for the C-4/C-7 redo are present.

## Worktree repair

Both ZIPs initially showed false deleted/untracked paths caused by archive filename/path encoding. No product code was reconstructed by hand. Each extracted repository was repaired with its own Git object database via hard reset, then verified clean.

## Baseline gates run on this recovered tree

- Spatial Component Foundation: **22/22 PASS**
- Spatial Interaction Layer v0.4: **7/9**
  - known red: Main movement still snaps on release
  - known red: pointercancel static gate is identifier-brittle although behavior is already restore/no-commit
- GUI Final static gate: **gate itself crashes** because it still reads retired \`LcosGlyph.tsx`; this is a known stale gate debt, not hidden as product green.
- LCOS Skill v2 static validation: **PASS** (8 managed skills; curator references checked)
- B-stage convergence static: **19/24**; historical convergence debt remains and is not represented as closed.
- \`git diff --check` after incremental patch: **PASS**

Full dependency-based typecheck/vitest/build is not claimed here because the supplied archives do not contain \`node_modules`.

## Frozen next step

From this baseline:

1. redo frontend C-4 Active Glyth against canonical \`active-receiver-identity`;
2. redo C-7 Birth Provenance against canonical \`conversationViewId` and \`/artifacts/{id}/birth`;
3. restore Conversation Truth Gate;
4. repair Spatial 7/9 -> 9/9;
5. repair stale GUI Final gate;
6. close Conversation Subcanvas;
7. continue later rounds.

For highly visible CSS / GUI morphology changes, implementation pauses at an HTML visual specimen checkpoint before production CSS is changed further.
