# LCOS MVP Fast Build — Runbook

Date: 2026-07-28
Branch: `codex/mvp-fast-build`
Current baseline: `bcc1771 feat(mvp): show runtime file identity`

## Purpose

This package documents the MVP fast-build state after Stage 1 and Stage 2.

It is meant for demo, handoff, and next-stage implementation planning. It is not a claim that Bridge, real Preview workers, Watcher, or Artifact Return are connected.

## Recommended worktree

```powershell
cd "E:\Codex 项目\OS开发\.worktrees\mvp-fast-build"
```

## Preflight

```powershell
git status --short
git branch --show-current
git rev-parse --short HEAD
git log --oneline -5
git diff --check
```

Expected:

```text
branch: codex/mvp-fast-build
HEAD: bcc1771 or newer on this MVP branch
working tree: clean before dev launcher
```

## Start / status / stop

Use repository scripts:

```powershell
npm run dev:open
npm run dev:status
npm run dev:stop
```

Expected endpoints:

- Web: `127.0.0.1:5173`
- Local Core: `127.0.0.1:43121`

Do not kill all `node.exe`. Do not close unrelated owners of ports `5173` or `43121`.

## Demo path

1. Start with `npm run dev:open`.
2. Confirm the app opens the Runtime-backed MVP sample project.
3. Open or select the project named `LCOS MVP Sample` / `disposable-mvp-sample`.
4. Select Brief, Script, Reference, or Feedback nodes.
5. Confirm Work Rail shows `Runtime identity` with Revision, FileRecord, Hash, and Path.
6. Refresh the page and confirm the graph is still restored from Runtime, not Fixture.
7. Stop and reopen through the launcher to confirm Local Core startup keeps the sample without overwriting it.

## Current visible promise

The MVP currently demonstrates:

- Runtime project catalog preferred over frontend Fixture.
- Disposable Local Core sample project.
- Project / Workspace / Artifact / View / Relation / Note / Checkpoint persisted in SQLite.
- FileRecord and current ArtifactRevision identity visible in Web.
- Runtime vs Demo distinction remains explicit.

It does not yet demonstrate:

- Bridge execution.
- Artifact Return.
- Real Preview worker rendering.
- Watcher-driven observation.
- Automatic Revision.
- Real user-file import UX.

